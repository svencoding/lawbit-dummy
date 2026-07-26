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
  ArrowLeft,
  ArrowUpDown,
  FolderOpen,
  Building2,
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
import { ProjectEjecucion } from "@/components/ProjectEjecucion";
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

const HOURLY_COST_2026 = 170;

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

  // Serie acumulada mes a mes para el burn-up: costo interno
  // (horas × tarifa costo) y valor trabajado (horas × tarifa cliente).
  const burnSeries = useMemo(() => {
    if (!asuntoId) return [];
    const id = parseInt(asuntoId, 10);
    const entries = getTransformedTimeEntries().filter((e) => e.project_id === id);
    if (entries.length === 0) return [];

    const rateByUser = new Map(getUsuarios().map((u) => [u.id, u.rate || 0]));
    const byMonth = new Map<string, { hours: number; valor: number }>();
    entries.forEach((e) => {
      if (!e.date) return;
      const key = e.date.slice(0, 7); // YYYY-MM
      const b = byMonth.get(key) || { hours: 0, valor: 0 };
      b.hours += e.duration;
      b.valor += e.duration * (rateByUser.get(e.user_id) || 0);
      byMonth.set(key, b);
    });

    const MONTHS = [
      "ene", "feb", "mar", "abr", "may", "jun",
      "jul", "ago", "sep", "oct", "nov", "dic",
    ];
    let accHours = 0;
    let accValor = 0;
    return Array.from(byMonth.keys())
      .sort()
      .map((key) => {
        const b = byMonth.get(key)!;
        accHours += b.hours;
        accValor += b.valor;
        const [y, m] = key.split("-");
        return {
          key,
          label: `${MONTHS[parseInt(m, 10) - 1]} ${y.slice(2)}`,
          horas: accHours,
          costo: accHours * HOURLY_COST_2026,
          valor: accValor,
        };
      });
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
      const horaCosto = p.total_cost;
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
  const costoInternoReal = totalHours * HOURLY_COST_2026;
  const isInProgress = budgetVsActual?.status !== "completed";
  // Costo en curso: lo ya gastado (horas reales × tarifa de costo). Es lo que
  // refleja la situación financiera actual del proyecto.
  const costoEnCurso = costoInternoReal;
  const margenReal = budgetedPrice - costoEnCurso;
  const margenPct = budgetedPrice > 0 ? (margenReal / budgetedPrice) * 100 : 0;
  const areasInvolucradas = new Set<string>();
  const allUsuariosForAreas = getUsuarios();
  professionals.forEach((p) => {
    const u = allUsuariosForAreas.find((u) => u.id === p.user_id);
    if (u?.practice_area) areasInvolucradas.add(u.practice_area);
  });

  const areasList = Array.from(areasInvolucradas);

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

        {/* ===== Ejecución vs presupuesto ===== */}
        <ProjectEjecucion
          ingreso={budgetedPrice}
          costoEnCurso={costoEnCurso}
          valorTrabajado={valorTrabajado}
          margen={margenReal}
          margenPct={margenPct}
          totalHours={totalHours}
          budgetedHours={budgetedHours}
          hourlyCost={HOURLY_COST_2026}
          inProgress={isInProgress}
          areas={areasList}
          levels={
            budgetVsActual?.team.map((m) => ({
              level: m.level,
              label: m.label,
              budgetedHours: m.budgetedHours,
              actualHours: m.actualHours,
            })) ?? []
          }
          burn={burnSeries}
        />

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
                        Costo Real USD
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
                        onClick={() => {
                          const params = new URLSearchParams();
                          params.set("projectId", String(asunto.id));
                          if (asunto.title) params.set("projectName", asunto.title);
                          if (cliente?.id != null) params.set("clientId", String(cliente.id));
                          if (cliente?.name) params.set("clientName", cliente.name);
                          navigate(`/user/${prof.user_code}?${params.toString()}`);
                        }}
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
                            className={`text-[10px] px-1.5 py-0 whitespace-nowrap ${
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
                          {Math.round(prof.rate).toLocaleString()}
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
