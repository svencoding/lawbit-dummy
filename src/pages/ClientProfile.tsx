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
  Building2,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Timer,
  TimerReset,
  Gauge,
  Scale,
  Layers,
  FolderOpen,
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
  getClientCosts,
  getTransformedTimeEntries,
  getFacturacion,
  getUsuarios,
  getBudgetVsActualForAsunto,
} from "@/lib/mockDataUtils";

const COST_RATE_USD = 160;

const categoryColors: Record<string, string> = {
  Socio: "bg-amber-100 text-amber-800 border-amber-200",
  "Asociado Sr": "bg-blue-100 text-blue-800 border-blue-200",
  "Asociado Senior": "bg-blue-100 text-blue-800 border-blue-200",
  Asociado: "bg-green-100 text-green-800 border-green-200",
  "Asociado Junior": "bg-purple-100 text-purple-800 border-purple-200",
};

type ProfDistSortField =
  | "user_name"
  | "category"
  | "total_hours"
  | "pct_hours"
  | "rate"
  | "valor_referencial"
  | "total_cost";
type DistView = "abogado" | "cargo";

function formatMillions(value: number): string {
  const millions = value / 1000000;
  return millions % 1 === 0 ? `$${millions}M` : `$${millions.toFixed(1)}M`;
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return formatMillions(value);
  return `$${Math.round(value).toLocaleString()}`;
}

type ProjectSortField = "project_name" | "hours" | "cost";
type ProfessionalSortField = "user_name" | "total_hours" | "total_cost";
type SortOrder = "asc" | "desc";

const ClientProfile = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [dataLoading, setDataLoading] = useState(true);

  // Sort state for projects
  const [projectsSortField, setProjectsSortField] = useState<ProjectSortField>("hours");
  const [projectsSortOrder, setProjectsSortOrder] = useState<SortOrder>("desc");

  // Sort state for professionals
  const [profSortField, setProfSortField] = useState<ProfessionalSortField>("total_hours");
  const [profSortOrder, setProfSortOrder] = useState<SortOrder>("desc");

  // Distribution table state (mirrors ProjectProfile)
  const [distSortField, setDistSortField] = useState<ProfDistSortField>("total_hours");
  const [distSortOrder, setDistSortOrder] = useState<SortOrder>("desc");
  const [distView, setDistView] = useState<DistView>("abogado");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Get all client data
  const clientData = useMemo(() => {
    if (!clientId) return null;
    const id = parseInt(clientId, 10);

    const clientes = getClientes();
    const cliente = clientes.find((c) => c.id === id);
    if (!cliente) return null;

    const asuntos = getAsuntos().filter((a) => a.cliente_id === id);
    const clientCosts = getClientCosts();
    const costData = clientCosts.find((c) => c.client_code === String(id));

    // Get time entries for this client
    const entries = getTransformedTimeEntries().filter(
      (e) => e.client_code === String(id),
    );

    // Aggregate by professional (enriched with category/rate/code for distribution table)
    const allUsuarios = getUsuarios();
    type ProfRow = {
      user_id: number;
      user_name: string;
      user_code: string;
      category: string;
      rate: number;
      total_hours: number;
      total_cost: number;
      project_count: number;
    };
    const profMap = new Map<number, ProfRow>();
    const profProjects = new Map<number, Set<number>>();
    let totalHoursAll = 0;
    let totalCostAll = 0;
    entries.forEach((e) => {
      if (!profMap.has(e.user_id)) {
        const u = allUsuarios.find((x) => x.id === e.user_id);
        profMap.set(e.user_id, {
          user_id: e.user_id,
          user_name: e.user_name,
          user_code: u?.code || "",
          category: u?.category || "—",
          rate: u?.rate || 0,
          total_hours: 0,
          total_cost: 0,
          project_count: 0,
        });
        profProjects.set(e.user_id, new Set());
      }
      const prof = profMap.get(e.user_id)!;
      const cost =
        e.originalEntry.total_cost ?? e.duration * (e.originalEntry.hourly_cost || 0);
      prof.total_hours += e.duration;
      prof.total_cost += cost;
      totalHoursAll += e.duration;
      totalCostAll += cost;
      profProjects.get(e.user_id)!.add(e.project_id);
      prof.project_count = profProjects.get(e.user_id)!.size;
    });

    // Get payments
    const payments = getFacturacion().filter((p) => p.cliente_id === id);
    const totalBilled = payments.reduce((sum, p) => sum + (p.amount_charged || 0), 0);

    // Aggregate budget vs actual across all asuntos for this client
    let budgetedPriceTotal = 0;
    let budgetedHoursTotal = 0;
    asuntos.forEach((a) => {
      const bva = getBudgetVsActualForAsunto(a.id);
      if (bva) {
        budgetedPriceTotal += bva.budgetedPrice;
        budgetedHoursTotal += bva.budgetedHours;
      }
    });

    // Areas involucradas (from professionals' practice_area)
    const areasInvolucradas = new Set<string>();
    profMap.forEach((p) => {
      const u = allUsuarios.find((x) => x.id === p.user_id);
      if (u?.practice_area) areasInvolucradas.add(u.practice_area);
    });
    asuntos.forEach((a) => {
      if (a.practice_area) areasInvolucradas.add(a.practice_area);
    });

    return {
      cliente,
      asuntos,
      costData,
      professionals: Array.from(profMap.values()),
      totalBilled,
      totalHoursAll,
      totalCostAll,
      budgetedPriceTotal,
      budgetedHoursTotal,
      areasInvolucradas: Array.from(areasInvolucradas),
    };
  }, [clientId]);

  useEffect(() => {
    if (user && clientId) {
      setDataLoading(true);
      setTimeout(() => setDataLoading(false), 200);
    }
  }, [user, clientId]);

  const sortedProjects = useMemo(() => {
    if (!clientData?.costData?.projects) return [];
    const sorted = [...clientData.costData.projects];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (projectsSortField) {
        case "project_name":
          cmp = a.project_name.localeCompare(b.project_name);
          break;
        case "hours":
          cmp = a.hours - b.hours;
          break;
        case "cost":
          cmp = a.cost - b.cost;
          break;
      }
      return projectsSortOrder === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [clientData, projectsSortField, projectsSortOrder]);

  const sortedProfessionals = useMemo(() => {
    if (!clientData?.professionals) return [];
    const sorted = [...clientData.professionals];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (profSortField) {
        case "user_name":
          cmp = a.user_name.localeCompare(b.user_name);
          break;
        case "total_hours":
          cmp = a.total_hours - b.total_hours;
          break;
        case "total_cost":
          cmp = a.total_cost - b.total_cost;
          break;
      }
      return profSortOrder === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [clientData, profSortField, profSortOrder]);

  const distByAbogado = useMemo(() => {
    if (!clientData?.professionals) return [];
    const total = clientData.totalHoursAll || 0;
    const enriched = clientData.professionals.map((p) => {
      const valor_referencial = p.total_hours * p.rate;
      const hora_costo = p.total_hours * COST_RATE_USD;
      const pct_hours = total > 0 ? (p.total_hours / total) * 100 : 0;
      return { ...p, valor_referencial, hora_costo, pct_hours };
    });
    enriched.sort((a, b) => {
      let cmp = 0;
      switch (distSortField) {
        case "user_name":
          cmp = a.user_name.localeCompare(b.user_name);
          break;
        case "category":
          cmp = a.category.localeCompare(b.category);
          break;
        case "total_hours":
          cmp = a.total_hours - b.total_hours;
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
      return distSortOrder === "asc" ? cmp : -cmp;
    });
    return enriched;
  }, [clientData, distSortField, distSortOrder]);

  const distByCargo = useMemo(() => {
    if (!clientData?.professionals) return [];
    const total = clientData.totalHoursAll || 0;
    const map = new Map<
      string,
      {
        category: string;
        count: number;
        total_hours: number;
        rate_weighted_sum: number;
        valor_referencial: number;
        hora_costo: number;
      }
    >();
    clientData.professionals.forEach((p) => {
      const key = p.category || "—";
      if (!map.has(key)) {
        map.set(key, {
          category: key,
          count: 0,
          total_hours: 0,
          rate_weighted_sum: 0,
          valor_referencial: 0,
          hora_costo: 0,
        });
      }
      const row = map.get(key)!;
      row.count += 1;
      row.total_hours += p.total_hours;
      row.rate_weighted_sum += p.rate * p.total_hours;
      row.valor_referencial += p.total_hours * p.rate;
      row.hora_costo += p.total_hours * COST_RATE_USD;
    });
    const rows = Array.from(map.values()).map((r) => ({
      ...r,
      rate: r.total_hours > 0 ? r.rate_weighted_sum / r.total_hours : 0,
      pct_hours: total > 0 ? (r.total_hours / total) * 100 : 0,
    }));
    rows.sort((a, b) => {
      let cmp = 0;
      switch (distSortField) {
        case "user_name":
        case "category":
          cmp = a.category.localeCompare(b.category);
          break;
        case "total_hours":
          cmp = a.total_hours - b.total_hours;
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
      return distSortOrder === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [clientData, distSortField, distSortOrder]);

  const handleDistSort = (field: ProfDistSortField) => {
    if (distSortField === field) {
      setDistSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setDistSortField(field);
      setDistSortOrder(
        field === "user_name" || field === "category" ? "asc" : "desc",
      );
    }
  };

  const handleProjectsSort = (field: ProjectSortField) => {
    if (projectsSortField === field) {
      setProjectsSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setProjectsSortField(field);
      setProjectsSortOrder(field === "project_name" ? "asc" : "desc");
    }
  };

  const handleProfSort = (field: ProfessionalSortField) => {
    if (profSortField === field) {
      setProfSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setProfSortField(field);
      setProfSortOrder(field === "user_name" ? "asc" : "desc");
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

  if (!clientData) {
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
                Cliente no encontrado
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const {
    cliente,
    asuntos,
    costData,
    professionals,
    totalHoursAll,
    budgetedPriceTotal,
    budgetedHoursTotal,
    areasInvolucradas,
  } = clientData;

  // === Derived KPIs (mirroring ProjectProfile) ===
  const totalHours = totalHoursAll || costData?.total_hours || 0;
  const valorTrabajado = professionals.reduce(
    (s, p) => s + p.total_hours * p.rate,
    0,
  );
  const costoInternoReal = totalHours * COST_RATE_USD;
  const margenReal = budgetedPriceTotal - costoInternoReal;
  const margenPct =
    budgetedPriceTotal > 0 ? (margenReal / budgetedPriceTotal) * 100 : 0;
  const overrunScope =
    budgetedPriceTotal > 0 ? valorTrabajado / budgetedPriceTotal : 0;
  const horasExcedidas = totalHours - budgetedHoursTotal;
  const tarifaPromedioPonderada =
    totalHours > 0 ? valorTrabajado / totalHours : 0;

  const fmtMoney = (v: number) =>
    v < 0 ? `−${formatCurrency(Math.abs(v))}` : formatCurrency(v);

  const secondaryKpis = [
    {
      title: "Horas trabajadas",
      value: totalHours.toFixed(2),
      icon: Clock,
    },
    {
      title: "Horas en budget",
      value: budgetedHoursTotal > 0 ? budgetedHoursTotal.toString() : "—",
      icon: Timer,
    },
    {
      title: "Horas excedidas",
      value:
        budgetedHoursTotal > 0
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
      title: "Tarifa prom. ponderada",
      value: `$${Math.round(tarifaPromedioPonderada).toLocaleString()}/h`,
      icon: Scale,
    },
    {
      title: "Asuntos",
      value: asuntos.length.toString(),
      icon: FolderOpen,
    },
    {
      title: "Abogados",
      value: professionals.length.toString(),
      icon: Users,
    },
    {
      title: "Áreas",
      value: areasInvolucradas.length.toString(),
      icon: Layers,
    },
    {
      title: "Overrun de scope",
      value: budgetedPriceTotal > 0 ? `${overrunScope.toFixed(2)}×` : "—",
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
            <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">{cliente.name}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {cliente.industry && <span>{cliente.industry}</span>}
                {cliente.industry && cliente.fee_type && <span>·</span>}
                {cliente.fee_type && (
                  <Badge variant="secondary" className="text-xs">
                    {cliente.fee_type}
                  </Badge>
                )}
                {cliente.client_manager && (
                  <>
                    <span>·</span>
                    <span>Encargado: {cliente.client_manager}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Resumen Financiero — hero card */}
        <Card className="border-border/50 overflow-hidden">
          <div className="border-b bg-muted/30 px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold">Resumen Financiero</h2>
              <p className="text-xs text-muted-foreground">
                Honorarios, costo interno y margen real agregado del cliente
              </p>
            </div>
            {budgetedPriceTotal > 0 && (
              <Badge
                variant="secondary"
                className={
                  margenReal >= 0
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                }
              >
                {margenReal >= 0 ? (
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 mr-1" />
                )}
                Margen {margenPct.toFixed(1)}%
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x">
            <div className="p-5">
              <p className="text-xs text-muted-foreground">Honorarios estimados</p>
              <p className="text-2xl font-semibold mt-1 tabular-nums">
                {budgetedPriceTotal > 0 ? fmtMoney(budgetedPriceTotal) : "—"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Σ budgets de los asuntos
              </p>
            </div>
            <div className="p-5">
              <p className="text-xs text-muted-foreground">Valor de horas trabajadas</p>
              <p className="text-2xl font-semibold mt-1 tabular-nums">
                {fmtMoney(valorTrabajado)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Σ horas × tarifa abogado
              </p>
            </div>
            <div className="p-5">
              <p className="text-xs text-muted-foreground">Costo interno real</p>
              <p className="text-2xl font-semibold mt-1 tabular-nums">
                {fmtMoney(costoInternoReal)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                {totalHours.toFixed(2)}h × ${COST_RATE_USD}
              </p>
            </div>
            <div className="p-5">
              <p className="text-xs text-muted-foreground">Margen real</p>
              <p
                className={`text-2xl font-semibold mt-1 tabular-nums ${
                  margenReal >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {budgetedPriceTotal > 0 ? fmtMoney(margenReal) : "—"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Honorarios − Costo interno
              </p>
            </div>
          </div>
        </Card>

        {/* Operativo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {secondaryKpis.map((k) => (
            <Card key={k.title} className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">{k.title}</p>
                  <k.icon className="h-3.5 w-3.5 text-muted-foreground/60" />
                </div>
                <p
                  className={`text-xl font-semibold mt-1.5 tabular-nums ${
                    k.tone || ""
                  }`}
                >
                  {k.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {areasInvolucradas.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-muted-foreground">Áreas involucradas:</span>
            {areasInvolucradas.map((a) => (
              <Badge key={a} variant="secondary" className="text-[10px]">
                {a}
              </Badge>
            ))}
          </div>
        )}

        {/* Distribución por Abogado / Cargo */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="text-foreground">
                  Distribución por {distView === "abogado" ? "Abogado" : "Cargo"}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {distView === "abogado"
                    ? "Horas, tarifa y valor referencial por profesional asignado al cliente"
                    : "Horas, tarifa promedio y valor referencial agrupados por nivel de senioridad"}
                </p>
              </div>
              <div className="inline-flex rounded-md border bg-muted/40 p-0.5 text-xs">
                <button
                  onClick={() => setDistView("abogado")}
                  className={`px-2.5 py-1 rounded-sm transition-colors ${
                    distView === "abogado"
                      ? "bg-background shadow-sm font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Por Abogado
                </button>
                <button
                  onClick={() => setDistView("cargo")}
                  className={`px-2.5 py-1 rounded-sm transition-colors ${
                    distView === "cargo"
                      ? "bg-background shadow-sm font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Por Cargo
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto rounded-md">
              <Table>
                <TableHeader>
                  <TableRow className="border-b">
                    <TableHead className="h-9 px-2 text-xs font-semibold w-[30px]">
                      #
                    </TableHead>
                    {distView === "abogado" ? (
                      <>
                        <TableHead className="h-9 px-2 text-xs font-semibold">
                          <button
                            className="flex items-center gap-1 hover:text-foreground"
                            onClick={() => handleDistSort("user_name")}
                          >
                            Nombre
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </TableHead>
                        <TableHead className="h-9 px-2 text-xs font-semibold">
                          <button
                            className="flex items-center gap-1 hover:text-foreground"
                            onClick={() => handleDistSort("category")}
                          >
                            Cargo
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead className="h-9 px-2 text-xs font-semibold">
                          <button
                            className="flex items-center gap-1 hover:text-foreground"
                            onClick={() => handleDistSort("category")}
                          >
                            Cargo
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </TableHead>
                        <TableHead className="h-9 px-2 text-xs font-semibold text-right">
                          # Personas
                        </TableHead>
                      </>
                    )}
                    <TableHead className="h-9 px-2 text-xs font-semibold text-right">
                      <button
                        className="flex items-center gap-1 ml-auto hover:text-foreground"
                        onClick={() => handleDistSort("total_hours")}
                      >
                        Horas
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="h-9 px-2 text-xs font-semibold text-right">
                      <button
                        className="flex items-center gap-1 ml-auto hover:text-foreground"
                        onClick={() => handleDistSort("pct_hours")}
                      >
                        % Horas
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="h-9 px-2 text-xs font-semibold text-right">
                      <button
                        className="flex items-center gap-1 ml-auto hover:text-foreground"
                        onClick={() => handleDistSort("rate")}
                      >
                        {distView === "abogado" ? "Tarifa" : "Tarifa prom."}
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="h-9 px-2 text-xs font-semibold text-right">
                      <button
                        className="flex items-center gap-1 ml-auto hover:text-foreground"
                        onClick={() => handleDistSort("valor_referencial")}
                      >
                        Valor referencial USD
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="h-9 px-2 text-xs font-semibold text-right">
                      <button
                        className="flex items-center gap-1 ml-auto hover:text-foreground"
                        onClick={() => handleDistSort("total_cost")}
                      >
                        Hora Costo (USD {COST_RATE_USD})
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {distView === "abogado" ? (
                    distByAbogado.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="text-center text-muted-foreground py-6 text-xs"
                        >
                          Sin horas registradas
                        </TableCell>
                      </TableRow>
                    ) : (
                      distByAbogado.map((prof, index) => (
                        <TableRow
                          key={prof.user_id}
                          className="border-b h-8 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() =>
                            prof.user_code && navigate(`/user/${prof.user_code}`)
                          }
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
                          <TableCell className="px-2 py-1 text-xs text-right">
                            {prof.total_hours.toFixed(2)}
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
                    )
                  ) : distByCargo.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center text-muted-foreground py-6 text-xs"
                      >
                        Sin horas registradas
                      </TableCell>
                    </TableRow>
                  ) : (
                    distByCargo.map((row, index) => (
                      <TableRow
                        key={row.category}
                        className="border-b h-8 hover:bg-muted/50 transition-colors"
                      >
                        <TableCell className="px-2 py-1 text-xs font-medium">
                          {index + 1}
                        </TableCell>
                        <TableCell className="px-2 py-1">
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${
                              categoryColors[row.category] || ""
                            }`}
                          >
                            {row.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-2 py-1 text-xs text-right font-medium">
                          {row.count}
                        </TableCell>
                        <TableCell className="px-2 py-1 text-xs text-right">
                          {row.total_hours.toFixed(2)}
                        </TableCell>
                        <TableCell className="px-2 py-1 text-xs text-right">
                          {row.pct_hours.toFixed(1)}%
                        </TableCell>
                        <TableCell className="px-2 py-1 text-xs text-right">
                          {Math.round(row.rate).toLocaleString()}
                        </TableCell>
                        <TableCell className="px-2 py-1 text-xs text-right font-medium text-emerald-600">
                          {Math.round(row.valor_referencial).toLocaleString()}
                        </TableCell>
                        <TableCell className="px-2 py-1 text-xs text-right">
                          {Math.round(row.hora_costo).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Projects Table */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium">Asuntos</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <button
                          className="flex items-center gap-1 hover:text-foreground"
                          onClick={() => handleProjectsSort("project_name")}
                        >
                          Asunto
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </TableHead>
                      <TableHead className="text-right">
                        <button
                          className="flex items-center gap-1 ml-auto hover:text-foreground"
                          onClick={() => handleProjectsSort("hours")}
                        >
                          Horas
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </TableHead>
                      <TableHead className="text-right">
                        <button
                          className="flex items-center gap-1 ml-auto hover:text-foreground"
                          onClick={() => handleProjectsSort("cost")}
                        >
                          Costo
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedProjects.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                          Sin asuntos con horas registradas
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedProjects.map((project) => (
                        <TableRow
                          key={project.project_id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() =>
                            navigate(`/dashboard/asuntos/${project.project_id}`)
                          }
                        >
                          <TableCell className="font-medium text-sm">
                            {project.project_name}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {Math.round(project.hours).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {formatCurrency(project.cost)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Professionals Table */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium">Profesionales</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <button
                          className="flex items-center gap-1 hover:text-foreground"
                          onClick={() => handleProfSort("user_name")}
                        >
                          Nombre
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </TableHead>
                      <TableHead className="text-right">
                        <button
                          className="flex items-center gap-1 ml-auto hover:text-foreground"
                          onClick={() => handleProfSort("total_hours")}
                        >
                          Horas
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </TableHead>
                      <TableHead className="text-right">
                        <button
                          className="flex items-center gap-1 ml-auto hover:text-foreground"
                          onClick={() => handleProfSort("total_cost")}
                        >
                          Costo
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedProfessionals.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                          Sin profesionales asignados
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedProfessionals.map((prof) => (
                        <TableRow
                          key={prof.user_id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => {
                            const allUsuarios = getUsuarios();
                            const u = allUsuarios.find(
                              (u) => u.id === prof.user_id,
                            );
                            if (u) navigate(`/user/${u.code}`);
                          }}
                        >
                          <TableCell className="font-medium text-sm">
                            {prof.user_name}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {Math.round(prof.total_hours).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {formatCurrency(prof.total_cost)}
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
      </div>
    </DashboardLayout>
  );
};

export default ClientProfile;
