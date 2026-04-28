import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Clock,
  ArrowLeft,
  ArrowUpDown,
  FolderOpen,
  Building2,
  Users,
  GitCompare,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Timer,
  TimerReset,
  Gauge,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getClientes,
  getAsuntos,
  getTransformedTimeEntries,
  getFacturacion,
  getUsuarios,
  getBudgetVsActualForAsunto,
} from "@/lib/mockDataUtils";

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    const millions = value / 1000000;
    return millions % 1 === 0 ? `$${millions}M` : `$${millions.toFixed(1)}M`;
  }
  return `$${Math.round(value).toLocaleString()}`;
}

type ProfSortField =
  | "user_name"
  | "category"
  | "total_hours"
  | "budgeted_hours"
  | "hours_dev"
  | "pct_hours"
  | "rate"
  | "valor_referencial"
  | "total_cost";

const CATEGORY_TO_LEVEL_LABEL: Record<string, string> = {
  "Socio": "Socio",
  "Asociado Sr": "Asociado Senior",
  "Asociado Senior": "Asociado Senior",
  "Asociado": "Asociado",
};
type SortOrder = "asc" | "desc";

const COST_RATE_USD = 160;

const categoryColors: Record<string, string> = {
  Socio: "bg-amber-100 text-amber-800 border-amber-200",
  "Asociado Sr": "bg-blue-100 text-blue-800 border-blue-200",
  "Asociado Senior": "bg-blue-100 text-blue-800 border-blue-200",
  Asociado: "bg-green-100 text-green-800 border-green-200",
  "Asociado Junior": "bg-purple-100 text-purple-800 border-purple-200",
};

const ProjectProfile = () => {
  const { asuntoId } = useParams<{ asuntoId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [dataLoading, setDataLoading] = useState(true);

  const [profSortField, setProfSortField] = useState<ProfSortField>("total_hours");
  const [profSortOrder, setProfSortOrder] = useState<SortOrder>("desc");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const projectData = useMemo(() => {
    if (!asuntoId) return null;
    const id = parseInt(asuntoId, 10);

    const asuntos = getAsuntos();
    const asunto = asuntos.find((a) => a.id === id);
    if (!asunto) return null;

    const clientes = getClientes();
    const cliente = asunto.cliente_id
      ? clientes.find((c) => c.id === asunto.cliente_id)
      : null;

    // Get time entries for this project
    const entries = getTransformedTimeEntries().filter(
      (e) => e.project_id === id,
    );

    // Totals
    let totalHours = 0;
    let totalCost = 0;
    let billableHours = 0;

    // Aggregate by professional
    const profMap = new Map<
      number,
      {
        user_id: number;
        user_name: string;
        user_code: string;
        initials: string;
        category: string;
        rate: number;
        total_hours: number;
        total_cost: number;
      }
    >();
    const allUsuarios = getUsuarios();

    const computeInitials = (name: string) =>
      name
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("")
        .slice(0, 3);

    entries.forEach((e) => {
      const cost =
        e.originalEntry.total_cost ?? e.duration * (e.originalEntry.hourly_cost || 0);
      totalHours += e.duration;
      totalCost += cost;
      billableHours += e.billable_duration;

      if (!profMap.has(e.user_id)) {
        const u = allUsuarios.find((u) => u.id === e.user_id);
        profMap.set(e.user_id, {
          user_id: e.user_id,
          user_name: e.user_name,
          user_code: u?.code || "",
          initials: u?.code || computeInitials(e.user_name),
          category: u?.category || "—",
          rate: u?.rate || 0,
          total_hours: 0,
          total_cost: 0,
        });
      }
      const prof = profMap.get(e.user_id)!;
      prof.total_hours += e.duration;
      prof.total_cost += cost;
    });

    // Get payments for this project
    const payments = getFacturacion().filter((p) => p.asunto_id === id);
    const totalBilled = payments.reduce((sum, p) => sum + (p.amount_charged || 0), 0);

    return {
      asunto,
      cliente,
      totalHours,
      totalCost,
      billableHours,
      totalBilled,
      professionals: Array.from(profMap.values()),
    };
  }, [asuntoId]);

  const budgetVsActual = useMemo(() => {
    if (!asuntoId) return null;
    return getBudgetVsActualForAsunto(parseInt(asuntoId, 10));
  }, [asuntoId]);

  useEffect(() => {
    if (user && asuntoId) {
      setDataLoading(true);
      setTimeout(() => setDataLoading(false), 200);
    }
  }, [user, asuntoId]);

  const sortedProfessionals = useMemo(() => {
    if (!projectData?.professionals) return [];
    const total = projectData.totalHours || 0;

    // Build per-level budgeted hours and per-level actual hour totals for distribution
    const budgetedHoursByLevel = new Map<string, number>();
    const actualHoursByLevel = new Map<string, number>();
    if (budgetVsActual?.team) {
      budgetVsActual.team.forEach((t) => {
        budgetedHoursByLevel.set(t.label, t.budgetedHours);
        actualHoursByLevel.set(t.label, t.actualHours);
      });
    }

    const enriched = projectData.professionals.map((p) => {
      const valorReferencial = p.total_hours * p.rate;
      const horaCosto = p.total_hours * COST_RATE_USD;
      const pctHours = total > 0 ? (p.total_hours / total) * 100 : 0;
      const levelLabel = CATEGORY_TO_LEVEL_LABEL[p.category] ?? p.category;
      const levelBudget = budgetedHoursByLevel.get(levelLabel) ?? 0;
      const levelActual = actualHoursByLevel.get(levelLabel) ?? 0;
      const budgetedHours =
        levelActual > 0 ? (p.total_hours / levelActual) * levelBudget : 0;
      const hoursDev = budgetedHours > 0 ? p.total_hours - budgetedHours : 0;
      const hoursDevPct =
        budgetedHours > 0 ? ((p.total_hours - budgetedHours) / budgetedHours) * 100 : 0;
      return {
        ...p,
        valor_referencial: valorReferencial,
        hora_costo: horaCosto,
        pct_hours: pctHours,
        budgeted_hours: budgetedHours,
        hours_dev: hoursDev,
        hours_dev_pct: hoursDevPct,
      };
    });
    enriched.sort((a, b) => {
      let cmp = 0;
      switch (profSortField) {
        case "user_name":
          cmp = a.user_name.localeCompare(b.user_name);
          break;
        case "category":
          cmp = a.category.localeCompare(b.category);
          break;
        case "total_hours":
          cmp = a.total_hours - b.total_hours;
          break;
        case "budgeted_hours":
          cmp = a.budgeted_hours - b.budgeted_hours;
          break;
        case "hours_dev":
          cmp = a.hours_dev - b.hours_dev;
          break;
        case "pct_hours":
          cmp = a.pct_hours - b.pct_hours;
          break;
        case "rate":
          cmp = a.rate - b.rate;
          break;
        case "valor_referencial":
          cmp = a.valor_referencial - b.valor_referencial;
          break;
        case "total_cost":
          cmp = a.hora_costo - b.hora_costo;
          break;
      }
      return profSortOrder === "asc" ? cmp : -cmp;
    });
    return enriched;
  }, [projectData, budgetVsActual, profSortField, profSortOrder]);

  const handleProfSort = (field: ProfSortField) => {
    if (profSortField === field) {
      setProfSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setProfSortField(field);
      setProfSortOrder(
        field === "user_name" || field === "category" ? "asc" : "desc",
      );
    }
  };

  if (authLoading || dataLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) return null;

  if (!projectData) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                Asunto no encontrado
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const { asunto, cliente, totalHours, professionals } = projectData;

  // === Derived KPIs (mirroring the "Resumen Financiero" reference) ===
  const budgetedPrice = budgetVsActual?.budgetedPrice ?? 0;
  const budgetedHours = budgetVsActual?.budgetedHours ?? 0;
  const valorTrabajado = professionals.reduce(
    (s, p) => s + p.total_hours * p.rate,
    0,
  );
  const costoInternoReal = totalHours * COST_RATE_USD;
  const margenReal = budgetedPrice - costoInternoReal;
  const margenPct = budgetedPrice > 0 ? (margenReal / budgetedPrice) * 100 : 0;
  const overrunScope = budgetedPrice > 0 ? valorTrabajado / budgetedPrice : 0;
  const horasExcedidas = totalHours - budgetedHours;
  const tarifaPromedioPonderada = totalHours > 0 ? valorTrabajado / totalHours : 0;
  const areasInvolucradas = new Set<string>();
  const allUsuariosForAreas = getUsuarios();
  professionals.forEach((p) => {
    const u = allUsuariosForAreas.find((u) => u.id === p.user_id);
    if (u?.practice_area) areasInvolucradas.add(u.practice_area);
  });

  const fmtMoney = (v: number) =>
    v < 0 ? `−${formatCurrency(Math.abs(v))}` : formatCurrency(v);
  const areasList = Array.from(areasInvolucradas);

  const secondaryKpis = [
    {
      title: "Horas trabajadas",
      value: totalHours.toFixed(2),
      icon: Clock,
    },
    {
      title: "Horas en budget",
      value: budgetedHours > 0 ? budgetedHours.toString() : "—",
      icon: Timer,
    },
    {
      title: "Horas excedidas",
      value:
        budgetedHours > 0
          ? `${horasExcedidas > 0 ? "+" : ""}${horasExcedidas.toFixed(2)}h`
          : "—",
      icon: TimerReset,
      tone:
        horasExcedidas > 0
          ? "text-red-600 dark:text-red-400"
          : "text-emerald-600 dark:text-emerald-400",
    },
    {
      title: "Hora Costo (2025)",
      value: `$${COST_RATE_USD}/h`,
      icon: Gauge,
    },
    {
      title: "Tarifa prom.",
      value: `$${Math.round(tarifaPromedioPonderada).toLocaleString()}/h`,
      icon: Scale,
    },
    {
      title: "Overrun de scope",
      value: budgetedPrice > 0 ? `${overrunScope.toFixed(2)}×` : "—",
      icon: AlertTriangle,
      tone:
        overrunScope > 1
          ? "text-orange-600 dark:text-orange-400"
          : "text-emerald-600 dark:text-emerald-400",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
              <FolderOpen className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">{asunto.title}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                {cliente && (
                  <button
                    className="hover:text-foreground hover:underline"
                    onClick={() => navigate(`/dashboard/clientes/${cliente.id}`)}
                  >
                    <Building2 className="h-3.5 w-3.5 inline mr-1" />
                    {cliente.name}
                  </button>
                )}
                {asunto.practice_area && (
                  <>
                    <span>·</span>
                    <Badge variant="secondary" className="text-xs">
                      {asunto.practice_area}
                    </Badge>
                  </>
                )}
                {asunto.project_type && (
                  <>
                    <span>·</span>
                    <span>{asunto.project_type}</span>
                  </>
                )}
                {asunto.charge_type && (
                  <>
                    <span>·</span>
                    <span>{asunto.charge_type}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Resumen Financiero — unified compact card */}
        <Card className="border-border/50 overflow-hidden">
          <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h2 className="text-sm font-semibold">Resumen Financiero</h2>
              <p className="text-[11px] text-muted-foreground">
                Honorarios, costo interno y margen real
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {areasList.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {areasList.map((a) => (
                    <Badge key={a} variant="secondary" className="text-[10px] px-1.5 py-0">
                      {a}
                    </Badge>
                  ))}
                </div>
              )}
              {budgetedPrice > 0 && (
                <Badge
                  variant="secondary"
                  className={`text-[11px] ${
                    margenReal >= 0
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  }`}
                >
                  {margenReal >= 0 ? (
                    <ArrowUpRight className="h-3 w-3 mr-0.5" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 mr-0.5" />
                  )}
                  Margen {margenPct.toFixed(1)}%
                </Badge>
              )}
            </div>
          </div>

          {/* Primary money KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 [&>*:nth-child(-n+2)]:border-b md:[&>*:nth-child(-n+2)]:border-b-0">
            <div className="p-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Honorarios</p>
              <p className="text-xl font-semibold mt-0.5 tabular-nums">
                {budgetedPrice > 0 ? fmtMoney(budgetedPrice) : "—"}
              </p>
              <p className="text-[10px] text-muted-foreground">Budget cliente</p>
            </div>
            <div className="p-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Valor trabajado</p>
              <p className="text-xl font-semibold mt-0.5 tabular-nums">
                {fmtMoney(valorTrabajado)}
              </p>
              <p className="text-[10px] text-muted-foreground">Σ horas × tarifa</p>
            </div>
            <div className="p-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Costo interno</p>
              <p className="text-xl font-semibold mt-0.5 tabular-nums">
                {fmtMoney(costoInternoReal)}
              </p>
              <p className="text-[10px] text-muted-foreground tabular-nums">
                {totalHours.toFixed(2)}h × ${COST_RATE_USD}
              </p>
            </div>
            <div className="p-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Margen real</p>
              <p
                className={`text-xl font-semibold mt-0.5 tabular-nums ${
                  margenReal >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {budgetedPrice > 0 ? fmtMoney(margenReal) : "—"}
              </p>
              <p className="text-[10px] text-muted-foreground">Honorarios − Costo</p>
            </div>
          </div>

          {/* Secondary operational KPIs — single dense row */}
          <div className="border-t bg-muted/10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x">
            {secondaryKpis.map((k) => (
              <div key={k.title} className="px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <k.icon className="h-3 w-3 shrink-0" />
                  <p className="text-[10px] whitespace-nowrap">{k.title}</p>
                </div>
                <p className={`text-sm font-semibold mt-0.5 tabular-nums ${k.tone || ""}`}>
                  {k.value}
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* Presupuestado vs Real */}
        {budgetVsActual && (() => {
          const bva = budgetVsActual;
          const deviation = bva.budgetedPrice > 0
            ? ((bva.actualPrice - bva.budgetedPrice) / bva.budgetedPrice) * 100
            : 0;
          const hoursDeviation = bva.budgetedHours > 0
            ? ((bva.actualHours - bva.budgetedHours) / bva.budgetedHours) * 100
            : 0;
          return (
            <Card className="border-border/40 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 shadow-sm">
                      <GitCompare className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-medium">Presupuestado vs Real</CardTitle>
                      <p className="text-xs text-muted-foreground">Cotización original contra ejecución real</p>
                    </div>
                  </div>
                  {bva.status === "completed" ? (
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px]">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Cerrado
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[10px]">
                      <Circle className="h-3 w-3 mr-1" />
                      En curso
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50">
                    <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium mb-0.5">Presupuestado</p>
                    <p className="text-lg font-bold text-blue-900 dark:text-blue-100">${bva.budgetedPrice.toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mb-0.5">Real</p>
                    <p className="text-lg font-bold text-emerald-900 dark:text-emerald-100">${bva.actualPrice.toLocaleString()}</p>
                  </div>
                  <div className={`p-3 rounded-lg border ${deviation > 0 ? "bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/50" : "bg-green-50 dark:bg-green-950/30 border-green-100 dark:border-green-900/50"}`}>
                    <p className={`text-[11px] font-medium mb-0.5 ${deviation > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>Desviación</p>
                    <p className={`text-lg font-bold flex items-center gap-1 ${deviation > 0 ? "text-red-900 dark:text-red-100" : "text-green-900 dark:text-green-100"}`}>
                      {deviation > 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                      {Math.abs(deviation).toFixed(1)}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/50">
                    <p className="text-[11px] text-purple-600 dark:text-purple-400 font-medium mb-0.5">Horas: Ppto vs Real</p>
                    <p className="text-lg font-bold text-purple-900 dark:text-purple-100">{bva.budgetedHours} / {bva.actualHours}</p>
                    <p className={`text-[10px] font-medium mt-0.5 ${hoursDeviation > 5 ? "text-red-600" : hoursDeviation < -5 ? "text-emerald-600" : "text-muted-foreground"}`}>
                      {hoursDeviation > 0 ? "+" : ""}{hoursDeviation.toFixed(1)}%
                    </p>
                  </div>
                </div>

                {bva.team.length > 0 && (
                  <div className="rounded-lg border overflow-hidden bg-background">
                    <div className="px-3 py-2 bg-muted/40 border-b">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-2">
                        <Users className="h-3.5 w-3.5" />
                        Desglose por nivel de senioridad
                      </p>
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/20 border-b">
                          <th className="text-left p-2.5 font-medium text-muted-foreground">Nivel</th>
                          <th className="text-right p-2.5 font-medium text-muted-foreground">Horas Ppto</th>
                          <th className="text-right p-2.5 font-medium text-muted-foreground">Horas Real</th>
                          <th className="text-right p-2.5 font-medium text-muted-foreground">Desv. Horas</th>
                          <th className="text-right p-2.5 font-medium text-muted-foreground hidden sm:table-cell">Tarifa Ppto</th>
                          <th className="text-right p-2.5 font-medium text-muted-foreground hidden sm:table-cell">Tarifa Real</th>
                          <th className="text-right p-2.5 font-medium text-muted-foreground">Monto Ppto</th>
                          <th className="text-right p-2.5 font-medium text-muted-foreground">Monto Real</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bva.team.map((m) => {
                          const hDev = m.budgetedHours > 0
                            ? ((m.actualHours - m.budgetedHours) / m.budgetedHours) * 100
                            : 0;
                          const bAmt = m.budgetedCost;
                          const aAmt = m.actualCost;
                          return (
                            <tr key={m.level} className="border-b last:border-0 hover:bg-muted/20">
                              <td className="p-2.5 font-medium text-foreground">{m.label}</td>
                              <td className="p-2.5 text-right font-medium">{m.budgetedHours}h</td>
                              <td className="p-2.5 text-right font-medium">{m.actualHours}h</td>
                              <td className="p-2.5 text-right">
                                <span className={`font-semibold ${hDev > 5 ? "text-red-600" : hDev < -5 ? "text-emerald-600" : "text-foreground"}`}>
                                  {hDev > 0 ? "+" : ""}{hDev.toFixed(0)}%
                                </span>
                              </td>
                              <td className="p-2.5 text-right text-muted-foreground hidden sm:table-cell">${m.budgetedRate.toLocaleString()}/h</td>
                              <td className="p-2.5 text-right text-muted-foreground hidden sm:table-cell">${m.actualRate.toLocaleString()}/h</td>
                              <td className="p-2.5 text-right font-medium">${bAmt.toLocaleString()}</td>
                              <td className="p-2.5 text-right font-medium">${aAmt.toLocaleString()}</td>
                            </tr>
                          );
                        })}
                        <tr className="bg-muted/30 font-semibold">
                          <td className="p-2.5 text-foreground">Total</td>
                          <td className="p-2.5 text-right">{bva.team.reduce((s, m) => s + m.budgetedHours, 0)}h</td>
                          <td className="p-2.5 text-right">{bva.team.reduce((s, m) => s + m.actualHours, 0)}h</td>
                          <td className="p-2.5"></td>
                          <td className="p-2.5 hidden sm:table-cell"></td>
                          <td className="p-2.5 hidden sm:table-cell"></td>
                          <td className="p-2.5 text-right">${bva.team.reduce((s, m) => s + m.budgetedCost, 0).toLocaleString()}</td>
                          <td className="p-2.5 text-right">${bva.team.reduce((s, m) => s + m.actualCost, 0).toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* Distribución por Abogado */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground">Distribución por Abogado</CardTitle>
            <p className="text-xs text-muted-foreground">
              Horas, tarifa y valor referencial por profesional asignado al asunto
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto rounded-md">
              <Table>
                <TableHeader>
                  <TableRow className="border-b">
                    <TableHead className="h-9 px-2 text-xs font-semibold w-[30px]">
                      #
                    </TableHead>
                    <TableHead className="h-9 px-2 text-xs font-semibold">
                      <button
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={() => handleProfSort("user_name")}
                      >
                        Nombre
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="h-9 px-2 text-xs font-semibold">
                      <button
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={() => handleProfSort("category")}
                      >
                        Cargo
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="h-9 px-2 text-xs font-semibold text-right">
                      <button
                        className="flex items-center gap-1 ml-auto hover:text-foreground"
                        onClick={() => handleProfSort("budgeted_hours")}
                      >
                        Horas Ppto
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="h-9 px-2 text-xs font-semibold text-right">
                      <button
                        className="flex items-center gap-1 ml-auto hover:text-foreground"
                        onClick={() => handleProfSort("total_hours")}
                      >
                        Horas Real
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="h-9 px-2 text-xs font-semibold text-right">
                      <button
                        className="flex items-center gap-1 ml-auto hover:text-foreground"
                        onClick={() => handleProfSort("hours_dev")}
                      >
                        Desv.
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="h-9 px-2 text-xs font-semibold text-right">
                      <button
                        className="flex items-center gap-1 ml-auto hover:text-foreground"
                        onClick={() => handleProfSort("pct_hours")}
                      >
                        % Horas
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="h-9 px-2 text-xs font-semibold text-right">
                      <button
                        className="flex items-center gap-1 ml-auto hover:text-foreground"
                        onClick={() => handleProfSort("rate")}
                      >
                        Tarifa
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="h-9 px-2 text-xs font-semibold text-right">
                      <button
                        className="flex items-center gap-1 ml-auto hover:text-foreground"
                        onClick={() => handleProfSort("valor_referencial")}
                      >
                        Valor referencial USD
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="h-9 px-2 text-xs font-semibold text-right">
                      <button
                        className="flex items-center gap-1 ml-auto hover:text-foreground"
                        onClick={() => handleProfSort("total_cost")}
                      >
                        Hora Costo (USD {COST_RATE_USD})
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedProfessionals.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={10}
                        className="text-center text-muted-foreground py-6 text-xs"
                      >
                        Sin horas registradas
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedProfessionals.map((prof, index) => (
                      <TableRow
                        key={prof.user_id}
                        className="border-b h-8 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => navigate(`/user/${prof.user_code}`)}
                      >
                        <TableCell className="px-2 py-1 text-xs font-medium">
                          {index + 1}
                        </TableCell>
                        <TableCell className="px-2 py-1 text-xs font-medium">
                          {prof.user_name}
                        </TableCell>
                        <TableCell className="px-2 py-1">
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${
                              categoryColors[prof.category] || ""
                            }`}
                          >
                            {prof.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-2 py-1 text-xs text-right text-muted-foreground">
                          {prof.budgeted_hours > 0 ? prof.budgeted_hours.toFixed(1) : "—"}
                        </TableCell>
                        <TableCell className="px-2 py-1 text-xs text-right font-medium">
                          {prof.total_hours.toFixed(2)}
                        </TableCell>
                        <TableCell className="px-2 py-1 text-xs text-right">
                          {prof.budgeted_hours > 0 ? (
                            <span
                              className={`font-semibold ${
                                prof.hours_dev_pct > 5
                                  ? "text-red-600"
                                  : prof.hours_dev_pct < -5
                                    ? "text-emerald-600"
                                    : "text-foreground"
                              }`}
                            >
                              {prof.hours_dev > 0 ? "+" : ""}
                              {prof.hours_dev.toFixed(1)}h
                              <span className="text-[10px] text-muted-foreground ml-1">
                                ({prof.hours_dev_pct > 0 ? "+" : ""}
                                {prof.hours_dev_pct.toFixed(0)}%)
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-2 py-1 text-xs text-right">
                          {prof.pct_hours.toFixed(1)}%
                        </TableCell>
                        <TableCell className="px-2 py-1 text-xs text-right">
                          {prof.rate.toLocaleString()}
                        </TableCell>
                        <TableCell className="px-2 py-1 text-xs text-right font-medium text-emerald-600">
                          {Math.round(prof.valor_referencial).toLocaleString()}
                        </TableCell>
                        <TableCell className="px-2 py-1 text-xs text-right">
                          {Math.round(prof.hora_costo).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ProjectProfile;
