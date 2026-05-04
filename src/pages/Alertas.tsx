import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  TrendingUp,
  Mail,
  ShieldAlert,
  CalendarClock,
  FileText,
  GitCompare,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getBudgetVsActualComparison } from "@/lib/mockDataUtils";
import type { BudgetVsActualRow } from "@/lib/mockDataUtils";

interface MonthlyRetainer {
  id: string;
  cliente: string;
  monto: number;
  fechaInicio: Date;
  fechaProximoPago: Date;
  frecuencia: "mensual" | "trimestral" | "anual";
  estado: "activo" | "pausado" | "cancelado";
  diasRestantes: number;
  alertaEstado: "vencido" | "por_vencer" | "proximo" | "ok";
}

interface RetainerHoursAlert {
  id: string;
  cliente: string;
  horasUsadas: number;
  horasTotales: number;
  porcentajeUsado: number;
  fechaInicio: Date;
  fechaFin: Date;
  tipoAlerta: "cliente" | "interna";
  estado: "activo" | "pausado";
}

type EmailPreview =
  | { kind: "budget"; row: BudgetVsActualRow }
  | { kind: "retainer"; row: MonthlyRetainer }
  | { kind: "hours"; row: RetainerHoursAlert };

const Alertas = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [retainers, setRetainers] = useState<MonthlyRetainer[]>([]);
  const [retainerHours, setRetainerHours] = useState<RetainerHoursAlert[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [budgetAlerts, setBudgetAlerts] = useState<BudgetVsActualRow[]>([]);
  const [emailPreview, setEmailPreview] = useState<EmailPreview | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchRetainers();
      fetchRetainerHours();
      const all = getBudgetVsActualComparison(50);
      setBudgetAlerts(
        all.filter((r) => {
          const dev = r.budgetedPrice > 0
            ? ((r.actualPrice - r.budgetedPrice) / r.budgetedPrice) * 100
            : 0;
          return r.status === "in_progress" && dev > 100;
        }),
      );
    }
  }, [user]);

  const fetchRetainers = async () => {
    try {
      setDataLoading(true);

      const mockRetainers: MonthlyRetainer[] = [
        {
          id: "1",
          cliente: "Empresa ABC S.A.",
          monto: 500000,
          fechaInicio: new Date(2025, 0, 15),
          fechaProximoPago: new Date(2025, 0, 15),
          frecuencia: "mensual",
          estado: "activo",
          diasRestantes: 5,
          alertaEstado: "por_vencer",
        },
        {
          id: "2",
          cliente: "Corporación XYZ Ltda.",
          monto: 1200000,
          fechaInicio: new Date(2025, 2, 1),
          fechaProximoPago: new Date(2025, 0, 1),
          frecuencia: "mensual",
          estado: "activo",
          diasRestantes: -9,
          alertaEstado: "vencido",
        },
        {
          id: "3",
          cliente: "Grupo Legal Solutions",
          monto: 800000,
          fechaInicio: new Date(2025, 5, 10),
          fechaProximoPago: new Date(2025, 1, 10),
          frecuencia: "mensual",
          estado: "activo",
          diasRestantes: 31,
          alertaEstado: "proximo",
        },
        {
          id: "4",
          cliente: "Inversiones Global S.A.",
          monto: 1500000,
          fechaInicio: new Date(2025, 3, 20),
          fechaProximoPago: new Date(2025, 2, 20),
          frecuencia: "mensual",
          estado: "activo",
          diasRestantes: 65,
          alertaEstado: "ok",
        },
        {
          id: "5",
          cliente: "Consultoría Legal Pro",
          monto: 600000,
          fechaInicio: new Date(2025, 8, 5),
          frecuencia: "mensual",
          estado: "pausado",
          fechaProximoPago: new Date(2025, 0, 5),
          diasRestantes: -4,
          alertaEstado: "vencido",
        },
      ];

      await new Promise((resolve) => setTimeout(resolve, 500));
      setRetainers(mockRetainers);
    } catch (error) {
      console.error("Error fetching retainers:", error);
    } finally {
      setDataLoading(false);
    }
  };

  const fetchRetainerHours = async () => {
    try {
      const mockRetainerHours: RetainerHoursAlert[] = [
        {
          id: "rh1",
          cliente: "Empresa ABC S.A.",
          horasUsadas: 16,
          horasTotales: 20,
          porcentajeUsado: 80,
          fechaInicio: new Date(2025, 11, 1),
          fechaFin: new Date(2025, 0, 31),
          tipoAlerta: "cliente",
          estado: "activo",
        },
        {
          id: "rh2",
          cliente: "Corporación XYZ Ltda.",
          horasUsadas: 18,
          horasTotales: 20,
          porcentajeUsado: 90,
          fechaInicio: new Date(2025, 11, 1),
          fechaFin: new Date(2025, 0, 31),
          tipoAlerta: "cliente",
          estado: "activo",
        },
        {
          id: "rh3",
          cliente: "Grupo Legal Solutions",
          horasUsadas: 15,
          horasTotales: 20,
          porcentajeUsado: 75,
          fechaInicio: new Date(2025, 11, 1),
          fechaFin: new Date(2025, 0, 31),
          tipoAlerta: "interna",
          estado: "activo",
        },
        {
          id: "rh4",
          cliente: "Inversiones Global S.A.",
          horasUsadas: 19,
          horasTotales: 20,
          porcentajeUsado: 95,
          fechaInicio: new Date(2025, 11, 1),
          fechaFin: new Date(2025, 0, 31),
          tipoAlerta: "cliente",
          estado: "activo",
        },
        {
          id: "rh5",
          cliente: "Consultoría Legal Pro",
          horasUsadas: 14,
          horasTotales: 20,
          porcentajeUsado: 70,
          fechaInicio: new Date(2025, 11, 1),
          fechaFin: new Date(2025, 0, 31),
          tipoAlerta: "interna",
          estado: "activo",
        },
        {
          id: "rh6",
          cliente: "Tech Solutions Corp",
          horasUsadas: 17,
          horasTotales: 20,
          porcentajeUsado: 85,
          fechaInicio: new Date(2025, 11, 1),
          fechaFin: new Date(2025, 0, 31),
          tipoAlerta: "cliente",
          estado: "activo",
        },
      ];

      await new Promise((resolve) => setTimeout(resolve, 500));
      setRetainerHours(mockRetainerHours);
    } catch (error) {
      console.error("Error fetching retainer hours:", error);
    }
  };

  const getAlertColor = (alertaEstado: string) => {
    switch (alertaEstado) {
      case "vencido":
        return { bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-600 dark:text-red-400", border: "border-l-red-500", bar: "bg-red-500" };
      case "por_vencer":
        return { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-600 dark:text-amber-400", border: "border-l-amber-500", bar: "bg-amber-500" };
      case "proximo":
        return { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-600 dark:text-blue-400", border: "border-l-blue-500", bar: "bg-blue-500" };
      default:
        return { bg: "bg-green-50 dark:bg-green-950/30", text: "text-green-600 dark:text-green-400", border: "border-l-green-500", bar: "bg-green-500" };
    }
  };

  const getAlertLabel = (alertaEstado: string) => {
    switch (alertaEstado) {
      case "vencido": return "Vencido";
      case "por_vencer": return "Por vencer";
      case "proximo": return "Próximo";
      default: return "Al día";
    }
  };

  const getAlertIcon = (alertaEstado: string) => {
    switch (alertaEstado) {
      case "vencido": return AlertTriangle;
      case "por_vencer": return Clock;
      case "proximo": return CalendarClock;
      default: return CheckCircle2;
    }
  };

  const getProgressColor = (pct: number) => {
    if (pct >= 90) return "bg-red-500";
    if (pct >= 80) return "bg-amber-500";
    return "bg-blue-500";
  };

  const getProgressBg = (pct: number) => {
    if (pct >= 90) return "bg-red-100 dark:bg-red-950/40";
    if (pct >= 80) return "bg-amber-100 dark:bg-amber-950/40";
    return "bg-blue-100 dark:bg-blue-950/40";
  };

  const getStats = () => {
    const total = retainers.length;
    const vencidos = retainers.filter((r) => r.alertaEstado === "vencido").length;
    const porVencer = retainers.filter((r) => r.alertaEstado === "por_vencer").length;
    const totalMonto = retainers
      .filter((r) => r.estado === "activo")
      .reduce((sum, r) => sum + r.monto, 0);
    return { total, vencidos, porVencer, totalMonto };
  };

  const stats = getStats();

  const getRetainerHoursStats = () => {
    const clientAlerts = retainerHours.filter(
      (rh) => rh.tipoAlerta === "cliente" && rh.porcentajeUsado >= 80
    ).length;
    const internalAlerts = retainerHours.filter(
      (rh) => rh.tipoAlerta === "interna" && rh.porcentajeUsado >= 70
    ).length;
    const totalActive = retainerHours.filter((rh) => rh.estado === "activo").length;
    return { clientAlerts, internalAlerts, totalActive };
  };

  const retainerHoursStats = getRetainerHoursStats();

  if (loading || dataLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) return null;

  const sortedRetainers = [...retainers].sort((a, b) => {
    const order = { vencido: 0, por_vencer: 1, proximo: 2, ok: 3 };
    return order[a.alertaEstado] - order[b.alertaEstado];
  });

  const clientAlerts = retainerHours
    .filter((rh) => rh.tipoAlerta === "cliente" && rh.porcentajeUsado >= 80)
    .sort((a, b) => b.porcentajeUsado - a.porcentajeUsado);

  const internalAlerts = retainerHours
    .filter((rh) => rh.tipoAlerta === "interna" && rh.porcentajeUsado >= 70)
    .sort((a, b) => b.porcentajeUsado - a.porcentajeUsado);

  const kpiCards = [
    {
      title: "Alertas Críticas",
      value: stats.vencidos,
      subtitle: "Retainers vencidos",
      icon: ShieldAlert,
      color: "text-red-600",
      bgColor: "bg-red-50 dark:bg-red-950/30",
    },
    {
      title: "Sobre Presupuesto",
      value: budgetAlerts.length,
      subtitle: "Desviación >100%",
      icon: GitCompare,
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950/30",
    },
    {
      title: "Por Vencer",
      value: stats.porVencer,
      subtitle: "Próximos 7 días",
      icon: Clock,
      color: "text-amber-600",
      bgColor: "bg-amber-50 dark:bg-amber-950/30",
    },
    {
      title: "Alertas Clientes",
      value: retainerHoursStats.clientAlerts,
      subtitle: "Horas ≥80% usadas",
      icon: Mail,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      title: "Retainers Activos",
      value: retainerHoursStats.totalActive,
      subtitle: "Con seguimiento",
      icon: Users,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950/30",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Alertas por Hitos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitoreo de retainers y consumo de horas
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {kpiCards.map((kpi) => (
            <Card
              key={kpi.title}
              className="border-border/50 hover:shadow-md transition-shadow"
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`${kpi.bgColor} p-2.5 rounded-lg flex-shrink-0`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-foreground leading-none">
                    {kpi.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {kpi.subtitle}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Budget Alerts (from Pricing) */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-orange-50 dark:bg-orange-950/30 p-1.5 rounded-md">
                  <GitCompare className="h-4 w-4 text-orange-600" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold text-foreground">
                    Asuntos sobre presupuesto
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Asuntos en curso con desviación &gt; 100% sobre lo cotizado
                  </CardDescription>
                </div>
              </div>
              <Badge variant="secondary" className="text-xs">
                {budgetAlerts.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {budgetAlerts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Sin asuntos fuera de presupuesto
              </div>
            ) : (
              <div className="space-y-2">
                {budgetAlerts.map((row) => {
                  const dev = ((row.actualPrice - row.budgetedPrice) / row.budgetedPrice) * 100;
                  return (
                    <div
                      key={row.asuntoId}
                      className="flex items-center gap-4 p-3 rounded-lg border border-border/50 border-l-[3px] border-l-red-500 hover:bg-muted/30 transition-colors"
                    >
                      <div className="bg-red-50 dark:bg-red-950/30 p-2 rounded-lg flex-shrink-0">
                        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground truncate">
                            {row.project}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {row.area}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {row.displayId}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Ppto: ${row.budgetedPrice.toLocaleString()} · Real: ${row.actualPrice.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-red-600">
                          +{dev.toFixed(0)}%
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {row.actualHours}h / {row.budgetedHours}h
                        </p>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[10px] gap-1"
                          onClick={() => setEmailPreview({ kind: "budget", row })}
                        >
                          <FileText className="h-3 w-3" />
                          Email
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[10px] gap-1"
                          onClick={() => navigate(`/dashboard/asuntos/${row.asuntoId}`)}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Two-column layout: Hours alerts + Retainers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Client Alerts - Visual cards with progress bars */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-blue-50 dark:bg-blue-950/30 p-1.5 rounded-md">
                    <Mail className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold text-foreground">
                      Alertas para Clientes
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Clientes con alto consumo de horas
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {clientAlerts.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {clientAlerts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Sin alertas activas
                </div>
              ) : (
                clientAlerts.map((rh) => (
                  <div
                    key={rh.id}
                    className="p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <span className="text-sm font-medium text-foreground truncate mr-2">
                        {rh.cliente}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${rh.porcentajeUsado >= 90 ? "text-red-600" : "text-amber-600"}`}>
                          {rh.porcentajeUsado}%
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[10px] gap-1"
                          onClick={() => setEmailPreview({ kind: "hours", row: rh })}
                        >
                          <Mail className="h-3 w-3" />
                          Email
                        </Button>
                      </div>
                    </div>
                    <div className={`w-full h-2 rounded-full ${getProgressBg(rh.porcentajeUsado)}`}>
                      <div
                        className={`h-2 rounded-full transition-all ${getProgressColor(rh.porcentajeUsado)}`}
                        style={{ width: `${Math.min(rh.porcentajeUsado, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-xs text-muted-foreground">
                        {rh.horasUsadas}h / {rh.horasTotales}h
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(rh.fechaInicio, "dd MMM", { locale: es })} - {format(rh.fechaFin, "dd MMM", { locale: es })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Internal Alerts */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-purple-50 dark:bg-purple-950/30 p-1.5 rounded-md">
                    <TrendingUp className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold text-foreground">
                      Alertas Internas
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Retainers con alto consumo interno
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {internalAlerts.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {internalAlerts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Sin alertas internas
                </div>
              ) : (
                internalAlerts.map((rh) => (
                  <div
                    key={rh.id}
                    className="p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <span className="text-sm font-medium text-foreground truncate mr-2">
                        {rh.cliente}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${rh.porcentajeUsado >= 90 ? "text-red-600" : rh.porcentajeUsado >= 80 ? "text-amber-600" : "text-purple-600"}`}>
                          {rh.porcentajeUsado}%
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[10px] gap-1"
                          onClick={() => setEmailPreview({ kind: "hours", row: rh })}
                        >
                          <FileText className="h-3 w-3" />
                          Reporte
                        </Button>
                      </div>
                    </div>
                    <div className={`w-full h-2 rounded-full ${rh.porcentajeUsado >= 90 ? "bg-red-100 dark:bg-red-950/40" : rh.porcentajeUsado >= 80 ? "bg-amber-100 dark:bg-amber-950/40" : "bg-purple-100 dark:bg-purple-950/40"}`}>
                      <div
                        className={`h-2 rounded-full transition-all ${rh.porcentajeUsado >= 90 ? "bg-red-500" : rh.porcentajeUsado >= 80 ? "bg-amber-500" : "bg-purple-500"}`}
                        style={{ width: `${Math.min(rh.porcentajeUsado, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-xs text-muted-foreground">
                        {rh.horasUsadas}h / {rh.horasTotales}h
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(rh.fechaInicio, "dd MMM", { locale: es })} - {format(rh.fechaFin, "dd MMM", { locale: es })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Retainers List - Stacked cards instead of table */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="bg-emerald-50 dark:bg-emerald-950/30 p-1.5 rounded-md">
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">
                  Lista de Retainers
                </CardTitle>
                <CardDescription className="text-xs">
                  Estado de pagos y vencimientos
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sortedRetainers.map((retainer) => {
                const colors = getAlertColor(retainer.alertaEstado);
                const AlertIcon = getAlertIcon(retainer.alertaEstado);
                return (
                  <div
                    key={retainer.id}
                    className={`flex items-center gap-4 p-3 rounded-lg border border-border/50 border-l-[3px] ${colors.border} hover:bg-muted/30 transition-colors`}
                  >
                    {/* Alert icon */}
                    <div className={`${colors.bg} p-2 rounded-lg flex-shrink-0`}>
                      <AlertIcon className={`h-4 w-4 ${colors.text}`} />
                    </div>

                    {/* Client info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">
                          {retainer.cliente}
                        </span>
                        {retainer.estado !== "activo" && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${
                              retainer.estado === "pausado"
                                ? "text-amber-600 border-amber-300"
                                : "text-red-600 border-red-300"
                            }`}
                          >
                            {retainer.estado === "pausado" ? "Pausado" : "Cancelado"}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {format(retainer.fechaProximoPago, "dd MMM yyyy", { locale: es })}
                        </span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                          {retainer.frecuencia}
                        </Badge>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-emerald-600">
                        ${retainer.monto.toLocaleString()}
                      </p>
                      <p className={`text-xs font-medium ${colors.text}`}>
                        {retainer.diasRestantes < 0
                          ? `${Math.abs(retainer.diasRestantes)}d vencido`
                          : `${retainer.diasRestantes}d restantes`}
                      </p>
                    </div>

                    {/* Status badge */}
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <Badge
                        className={`text-[10px] px-2 py-0.5 ${
                          retainer.alertaEstado === "vencido"
                            ? "bg-red-500 hover:bg-red-600"
                            : retainer.alertaEstado === "por_vencer"
                            ? "bg-amber-500 hover:bg-amber-600"
                            : retainer.alertaEstado === "proximo"
                            ? "bg-blue-500 hover:bg-blue-600"
                            : "bg-green-500 hover:bg-green-600"
                        } text-white border-0`}
                      >
                        {getAlertLabel(retainer.alertaEstado)}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[10px] gap-1"
                        onClick={() => setEmailPreview({ kind: "retainer", row: retainer })}
                      >
                        <Mail className="h-3 w-3" />
                        Email
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

      </div>

      <EmailPreviewDialog
        preview={emailPreview}
        userEmail={user?.email ?? null}
        onClose={() => setEmailPreview(null)}
      />
    </DashboardLayout>
  );
};

interface EmailPreviewDialogProps {
  preview: EmailPreview | null;
  userEmail: string | null;
  onClose: () => void;
}

const EmailPreviewDialog = ({ preview, userEmail, onClose }: EmailPreviewDialogProps) => {
  const recipient = userEmail || "responsable@firma.com";

  const buildContent = () => {
    if (!preview) return null;

    if (preview.kind === "budget") {
      const r = preview.row;
      const dev = ((r.actualPrice - r.budgetedPrice) / r.budgetedPrice) * 100;
      const hoursDev = r.budgetedHours > 0
        ? ((r.actualHours - r.budgetedHours) / r.budgetedHours) * 100
        : 0;
      return {
        subject: `🚨 Alerta de Presupuesto: ${r.project} (+${dev.toFixed(0)}% sobre cotizado)`,
        intro: `El asunto ${r.displayId} — ${r.project} ha superado el presupuesto cotizado en más de un 100% y permanece en curso. Se recomienda revisar el alcance y comunicar al cliente.`,
        rows: [
          { label: "Asunto", value: `${r.displayId} — ${r.project}` },
          { label: "Área", value: r.area },
          { label: "Estado", value: "En curso" },
          { label: "Presupuestado", value: `$${r.budgetedPrice.toLocaleString()}` },
          { label: "Facturado / Real", value: `$${r.actualPrice.toLocaleString()}` },
          { label: "Desviación monto", value: `+${dev.toFixed(1)}%` },
          { label: "Horas presupuestadas", value: `${r.budgetedHours}h` },
          { label: "Horas reales", value: `${r.actualHours}h` },
          { label: "Desviación horas", value: `${hoursDev > 0 ? "+" : ""}${hoursDev.toFixed(1)}%` },
          { label: "Última actividad", value: r.lastActivity ? format(new Date(r.lastActivity), "dd MMM yyyy", { locale: es }) : "—" },
        ],
        team: r.team,
      };
    }

    if (preview.kind === "retainer") {
      const r = preview.row;
      return {
        subject: `${r.alertaEstado === "vencido" ? "🚨" : "⏰"} Retainer ${r.alertaEstado === "vencido" ? "VENCIDO" : "por vencer"}: ${r.cliente}`,
        intro: r.alertaEstado === "vencido"
          ? `El retainer mensual del cliente ${r.cliente} se encuentra vencido hace ${Math.abs(r.diasRestantes)} días. Se requiere gestión de cobro.`
          : `El retainer mensual del cliente ${r.cliente} vence en ${r.diasRestantes} días. Se recomienda anticipar la facturación.`,
        rows: [
          { label: "Cliente", value: r.cliente },
          { label: "Monto retainer", value: `$${r.monto.toLocaleString()}` },
          { label: "Frecuencia", value: r.frecuencia },
          { label: "Próximo pago", value: format(r.fechaProximoPago, "dd MMM yyyy", { locale: es }) },
          { label: "Estado", value: r.estado },
          { label: "Días restantes", value: r.diasRestantes < 0 ? `${Math.abs(r.diasRestantes)} días vencido` : `${r.diasRestantes} días` },
          { label: "Alerta", value: r.alertaEstado },
        ],
        team: undefined as undefined,
      };
    }

    const r = preview.row;
    return {
      subject: `📊 Consumo de horas al ${r.porcentajeUsado}% — ${r.cliente}`,
      intro: `${r.cliente} ha consumido ${r.horasUsadas} de ${r.horasTotales} horas asignadas (${r.porcentajeUsado}%) en el periodo actual. ${preview.kind === "hours" && r.tipoAlerta === "cliente" ? "Se sugiere comunicar al cliente para coordinar el alcance restante." : "Se sugiere revisar internamente la asignación de horas."}`,
      rows: [
        { label: "Cliente", value: r.cliente },
        { label: "Horas usadas", value: `${r.horasUsadas}h` },
        { label: "Horas totales", value: `${r.horasTotales}h` },
        { label: "% Consumido", value: `${r.porcentajeUsado}%` },
        { label: "Tipo de alerta", value: r.tipoAlerta === "cliente" ? "Externa (cliente)" : "Interna" },
        { label: "Periodo", value: `${format(r.fechaInicio, "dd MMM yyyy", { locale: es })} – ${format(r.fechaFin, "dd MMM yyyy", { locale: es })}` },
        { label: "Estado", value: r.estado },
      ],
      team: undefined as undefined,
    };
  };

  const content = buildContent();

  return (
    <Dialog open={preview !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4 text-blue-600" />
            Vista previa del email de alerta
          </DialogTitle>
          <DialogDescription className="text-xs">
            Este es el correo automático que se envía cuando se dispara la alerta.
          </DialogDescription>
        </DialogHeader>

        {content && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-1 text-xs">
              <div className="flex gap-2">
                <span className="font-semibold text-muted-foreground w-16">De:</span>
                <span>alertas@lawbit.app</span>
              </div>
              <div className="flex gap-2">
                <span className="font-semibold text-muted-foreground w-16">Para:</span>
                <span>{recipient}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-semibold text-muted-foreground w-16">Asunto:</span>
                <span className="font-medium">{content.subject}</span>
              </div>
            </div>

            <div className="rounded-lg border border-border/50 bg-background p-4 space-y-4">
              <p className="text-sm text-foreground leading-relaxed">{content.intro}</p>

              <div className="rounded-md border border-border/50 overflow-hidden">
                <div className="bg-muted/50 px-3 py-2 border-b border-border/50">
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    <FileText className="h-3 w-3" />
                    Reporte adjunto (PDF)
                  </p>
                </div>
                <table className="w-full text-xs">
                  <tbody>
                    {content.rows.map((row, i) => (
                      <tr key={i} className="border-b last:border-0 border-border/30">
                        <td className="px-3 py-1.5 text-muted-foreground w-1/2">{row.label}</td>
                        <td className="px-3 py-1.5 font-medium text-foreground capitalize">{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {content.team && content.team.length > 0 && (
                <div className="rounded-md border border-border/50 overflow-hidden">
                  <div className="bg-muted/50 px-3 py-2 border-b border-border/50">
                    <p className="text-xs font-semibold flex items-center gap-1.5">
                      <Users className="h-3 w-3" />
                      Desglose por equipo
                    </p>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/30 bg-muted/20">
                        <th className="px-3 py-1.5 text-left text-muted-foreground font-medium">Nivel</th>
                        <th className="px-3 py-1.5 text-right text-muted-foreground font-medium">Ppto h</th>
                        <th className="px-3 py-1.5 text-right text-muted-foreground font-medium">Real h</th>
                        <th className="px-3 py-1.5 text-right text-muted-foreground font-medium">Desv.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {content.team.map((m) => {
                        const d = m.budgetedHours > 0
                          ? ((m.actualHours - m.budgetedHours) / m.budgetedHours) * 100
                          : 0;
                        return (
                          <tr key={m.level} className="border-b last:border-0 border-border/30">
                            <td className="px-3 py-1.5 font-medium">{m.label}</td>
                            <td className="px-3 py-1.5 text-right">{m.budgetedHours}h</td>
                            <td className="px-3 py-1.5 text-right">{m.actualHours}h</td>
                            <td className={`px-3 py-1.5 text-right font-medium ${d > 0 ? "text-red-600" : "text-emerald-600"}`}>
                              {d > 0 ? "+" : ""}{d.toFixed(0)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground italic">
                Este correo se generó automáticamente por el sistema de monitoreo de Lawbit.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Alertas;
