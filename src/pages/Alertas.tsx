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
import { getBudgetVsActualComparison, getTaskDistributionForAsunto } from "@/lib/mockDataUtils";
import type { BudgetVsActualRow, TaskTypeRow } from "@/lib/mockDataUtils";
import jsPDF from "jspdf";
import { Download } from "lucide-react";

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

type AlertPdfContent = {
  subject: string;
  severity: "critical" | "warning" | "info";
  category: string;
  intro: string;
  recommendations: string[];
  highlights: { label: string; value: string; tone?: "neutral" | "negative" | "positive" }[];
  rows: { label: string; value: string }[];
  team?: { level: string; label: string; budgetedHours: number; actualHours: number }[];
  tasks?: TaskTypeRow[];
};

const SEVERITY_STYLE: Record<
  AlertPdfContent["severity"],
  { label: string; rgb: [number, number, number]; soft: [number, number, number] }
> = {
  critical: { label: "CRÍTICA", rgb: [220, 38, 38], soft: [254, 226, 226] },
  warning: { label: "ADVERTENCIA", rgb: [217, 119, 6], soft: [254, 243, 199] },
  info: { label: "INFORMATIVA", rgb: [37, 99, 235], soft: [219, 234, 254] },
};

const downloadAlertPdf = (content: AlertPdfContent, recipient: string) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const maxWidth = pageWidth - margin * 2;
  const sev = SEVERITY_STYLE[content.severity];

  const ensureSpace = (needed: number, y: number): number => {
    if (y + needed > pageHeight - 18) {
      doc.addPage();
      return 22;
    }
    return y;
  };

  // === Top severity bar ===
  doc.setFillColor(sev.rgb[0], sev.rgb[1], sev.rgb[2]);
  doc.rect(0, 0, pageWidth, 14, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(`ALERTA ${sev.label}`, margin, 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(content.category.toUpperCase(), pageWidth - margin, 9, { align: "right" });

  let y = 24;

  // === Subject ===
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(17, 24, 39);
  const subjectLines = doc.splitTextToSize(content.subject, maxWidth);
  doc.text(subjectLines, margin, y);
  y += subjectLines.length * 6 + 2;

  // === Email metadata ===
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text(
    `De: alertas@lawbit.app  ·  Para: ${recipient}  ·  ${format(new Date(), "dd MMM yyyy HH:mm", { locale: es })}`,
    margin,
    y,
  );
  y += 7;

  // === Highlight cards ===
  if (content.highlights && content.highlights.length > 0) {
    const cardCount = content.highlights.length;
    const gap = 3;
    const cardW = (maxWidth - gap * (cardCount - 1)) / cardCount;
    const cardH = 18;
    content.highlights.forEach((h, i) => {
      const x = margin + i * (cardW + gap);
      const tone = h.tone || "neutral";
      const fill: [number, number, number] =
        tone === "negative"
          ? [254, 226, 226]
          : tone === "positive"
          ? [220, 252, 231]
          : [243, 244, 246];
      const text: [number, number, number] =
        tone === "negative"
          ? [185, 28, 28]
          : tone === "positive"
          ? [22, 101, 52]
          : [55, 65, 81];
      doc.setFillColor(...fill);
      doc.roundedRect(x, y, cardW, cardH, 1.5, 1.5, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(107, 114, 128);
      doc.text(h.label.toUpperCase(), x + 3, y + 5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(...text);
      doc.text(h.value, x + 3, y + 13);
    });
    y += cardH + 6;
  }

  // === Intro / context ===
  y = ensureSpace(20, y);
  doc.setFillColor(sev.soft[0], sev.soft[1], sev.soft[2]);
  doc.setDrawColor(sev.rgb[0], sev.rgb[1], sev.rgb[2]);
  const introLines = doc.splitTextToSize(content.intro, maxWidth - 6);
  const introH = introLines.length * 4.2 + 6;
  doc.roundedRect(margin, y, maxWidth, introH, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(31, 41, 55);
  doc.text(introLines, margin + 3, y + 5);
  y += introH + 6;

  // === Section helper ===
  const sectionTitle = (label: string) => {
    y = ensureSpace(10, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(17, 24, 39);
    doc.text(label, margin, y);
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 1.5, pageWidth - margin, y + 1.5);
    y += 6;
  };

  // === Detalle (key/value rows with zebra) ===
  sectionTitle("Detalle de la alerta");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  content.rows.forEach((row, i) => {
    y = ensureSpace(7, y);
    if (i % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(margin, y - 4, maxWidth, 6.5, "F");
    }
    doc.setTextColor(107, 114, 128);
    doc.text(row.label, margin + 2, y);
    doc.setTextColor(31, 41, 55);
    doc.setFont("helvetica", "bold");
    const valueLines = doc.splitTextToSize(row.value, maxWidth - 80);
    doc.text(valueLines, margin + 70, y);
    doc.setFont("helvetica", "normal");
    y += Math.max(6.5, valueLines.length * 4.5);
  });
  y += 4;

  // === Recomendaciones ===
  if (content.recommendations && content.recommendations.length > 0) {
    sectionTitle("Acciones recomendadas");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(31, 41, 55);
    content.recommendations.forEach((rec) => {
      const lines = doc.splitTextToSize(rec, maxWidth - 6);
      const h = lines.length * 4.2 + 1;
      y = ensureSpace(h, y);
      doc.setFillColor(sev.rgb[0], sev.rgb[1], sev.rgb[2]);
      doc.circle(margin + 1.5, y - 1.5, 0.9, "F");
      doc.text(lines, margin + 5, y);
      y += h;
    });
    y += 4;
  }

  // === Equipo ===
  if (content.team && content.team.length > 0) {
    sectionTitle("Desglose por equipo");
    const colX = [margin + 2, margin + 90, margin + 120, margin + 150];
    doc.setFillColor(243, 244, 246);
    doc.rect(margin, y - 4, maxWidth, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(75, 85, 99);
    doc.text("NIVEL", colX[0], y);
    doc.text("PPTO H", colX[1], y, { align: "right" });
    doc.text("REAL H", colX[2], y, { align: "right" });
    doc.text("DESV.", colX[3], y, { align: "right" });
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    content.team.forEach((m, i) => {
      y = ensureSpace(6, y);
      const dev = m.budgetedHours > 0
        ? ((m.actualHours - m.budgetedHours) / m.budgetedHours) * 100
        : 0;
      if (i % 2 === 0) {
        doc.setFillColor(249, 250, 251);
        doc.rect(margin, y - 4, maxWidth, 6, "F");
      }
      doc.setTextColor(31, 41, 55);
      doc.text(m.label, colX[0], y);
      doc.text(`${m.budgetedHours}h`, colX[1], y, { align: "right" });
      doc.text(`${m.actualHours}h`, colX[2], y, { align: "right" });
      if (dev > 0) doc.setTextColor(185, 28, 28);
      else if (dev < 0) doc.setTextColor(22, 101, 52);
      doc.setFont("helvetica", "bold");
      doc.text(`${dev > 0 ? "+" : ""}${dev.toFixed(0)}%`, colX[3], y, { align: "right" });
      doc.setFont("helvetica", "normal");
      y += 5.5;
    });
    y += 4;
  }

  // === Distribución de tareas ===
  if (content.tasks && content.tasks.length > 0) {
    sectionTitle("Distribución por tipo de tarea");
    const colX = [margin + 2, margin + 110, margin + 140, margin + 170];
    doc.setFillColor(243, 244, 246);
    doc.rect(margin, y - 4, maxWidth, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(75, 85, 99);
    doc.text("TIPO DE TAREA", colX[0], y);
    doc.text("HORAS", colX[1], y, { align: "right" });
    doc.text("%", colX[2], y, { align: "right" });
    doc.text("COSTO", colX[3], y, { align: "right" });
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const totalCost = content.tasks.reduce((s, t) => s + t.costUsd, 0);
    content.tasks.slice(0, 8).forEach((t, i) => {
      y = ensureSpace(8, y);
      if (i % 2 === 0) {
        doc.setFillColor(249, 250, 251);
        doc.rect(margin, y - 4, maxWidth, 6, "F");
      }
      // Mini bar
      const barW = 40;
      const filled = (t.pct / 100) * barW;
      doc.setFillColor(229, 231, 235);
      doc.rect(margin + 60, y - 2.5, barW, 2, "F");
      const sigColor: [number, number, number] =
        t.signal === "muy_alto"
          ? [220, 38, 38]
          : t.signal === "alto"
          ? [217, 119, 6]
          : t.signal === "bajo"
          ? [37, 99, 235]
          : [22, 101, 52];
      doc.setFillColor(...sigColor);
      doc.rect(margin + 60, y - 2.5, filled, 2, "F");

      doc.setTextColor(31, 41, 55);
      const taskLines = doc.splitTextToSize(t.taskType, 55);
      doc.text(taskLines[0], colX[0], y);
      doc.text(`${t.hours.toFixed(0)}h`, colX[1], y, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.text(`${t.pct.toFixed(0)}%`, colX[2], y, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.text(`$${Math.round(t.costUsd).toLocaleString()}`, colX[3], y, { align: "right" });
      y += 6;
    });
    y += 1;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(
      `Costo total estimado de tareas: $${Math.round(totalCost).toLocaleString()} · ${content.tasks.length} categorías activas`,
      margin,
      y,
    );
    y += 5;
  }

  // === Footer on every page ===
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(156, 163, 175);
    doc.text("Generado automáticamente por Lawbit · Sistema de monitoreo de alertas", margin, pageHeight - 7);
    doc.text(`Página ${p} de ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: "right" });
  }

  const safeSubject = content.subject.replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 60);
  doc.save(`Alerta_${safeSubject}_${format(new Date(), "yyyyMMdd")}.pdf`);
};

interface EmailPreviewDialogProps {
  preview: EmailPreview | null;
  userEmail: string | null;
  onClose: () => void;
}

const EmailPreviewDialog = ({ preview, userEmail, onClose }: EmailPreviewDialogProps) => {
  const recipient = userEmail || "responsable@firma.com";

  const buildContent = (): AlertPdfContent | null => {
    if (!preview) return null;

    if (preview.kind === "budget") {
      const r = preview.row;
      const dev = ((r.actualPrice - r.budgetedPrice) / r.budgetedPrice) * 100;
      const hoursDev = r.budgetedHours > 0
        ? ((r.actualHours - r.budgetedHours) / r.budgetedHours) * 100
        : 0;
      const overrunAmount = r.actualPrice - r.budgetedPrice;
      const tasks = getTaskDistributionForAsunto(r.asuntoId);
      const topTask = tasks[0];
      return {
        subject: `Alerta de Presupuesto: ${r.project} (+${dev.toFixed(0)}% sobre cotizado)`,
        severity: "critical",
        category: "Desviación de presupuesto",
        intro: `El asunto ${r.displayId} — ${r.project} ha superado el presupuesto cotizado en más de un 100% y permanece en curso. La desviación acumulada asciende a $${overrunAmount.toLocaleString()} sobre los $${r.budgetedPrice.toLocaleString()} originalmente presupuestados. Se recomienda revisar el alcance del trabajo, validar nuevas tareas con el cliente y reevaluar el cronograma.`,
        recommendations: [
          "Programar reunión con el socio responsable para revisar alcance.",
          "Documentar tareas adicionales no contempladas en la cotización inicial.",
          "Comunicar al cliente y, si procede, emitir cotización complementaria.",
          topTask
            ? `Concentración elevada en "${topTask.taskType}" (${topTask.pct.toFixed(0)}% de horas) — validar eficiencia.`
            : "Revisar concentración por tipo de tarea.",
        ],
        highlights: [
          { label: "Desviación monto", value: `+${dev.toFixed(0)}%`, tone: "negative" },
          { label: "Sobrecosto", value: `$${overrunAmount.toLocaleString()}`, tone: "negative" },
          { label: "Horas reales", value: `${r.actualHours}h`, tone: "negative" },
          { label: "Desviación horas", value: `${hoursDev > 0 ? "+" : ""}${hoursDev.toFixed(0)}%`, tone: "negative" },
        ],
        rows: [
          { label: "Asunto", value: `${r.displayId} — ${r.project}` },
          { label: "Área", value: r.area },
          { label: "Estado", value: "En curso" },
          { label: "Presupuestado", value: `$${r.budgetedPrice.toLocaleString()}` },
          { label: "Facturado / Real", value: `$${r.actualPrice.toLocaleString()}` },
          { label: "Sobrecosto", value: `$${overrunAmount.toLocaleString()}` },
          { label: "Desviación monto", value: `+${dev.toFixed(1)}%` },
          { label: "Horas presupuestadas", value: `${r.budgetedHours}h` },
          { label: "Horas reales", value: `${r.actualHours}h` },
          { label: "Desviación horas", value: `${hoursDev > 0 ? "+" : ""}${hoursDev.toFixed(1)}%` },
          { label: "Última actividad", value: r.lastActivity ? format(new Date(r.lastActivity), "dd MMM yyyy", { locale: es }) : "—" },
        ],
        team: r.team,
        tasks,
      };
    }

    if (preview.kind === "retainer") {
      const r = preview.row;
      const isOverdue = r.alertaEstado === "vencido";
      return {
        subject: `Retainer ${isOverdue ? "VENCIDO" : "por vencer"}: ${r.cliente}`,
        severity: isOverdue ? "critical" : "warning",
        category: "Pago de retainer",
        intro: isOverdue
          ? `El retainer mensual del cliente ${r.cliente} se encuentra vencido hace ${Math.abs(r.diasRestantes)} días por un monto de $${r.monto.toLocaleString()}. Se requiere gestión de cobro inmediata para evitar afectar el flujo de caja del periodo.`
          : `El retainer mensual del cliente ${r.cliente} vence en ${r.diasRestantes} días por un monto de $${r.monto.toLocaleString()}. Se recomienda anticipar la facturación y confirmar disponibilidad de pago con el cliente.`,
        recommendations: isOverdue
          ? [
              "Contactar al área de cuentas por cobrar del cliente hoy mismo.",
              "Validar emisión de factura y verificar recepción.",
              "Escalar al socio responsable si supera 15 días vencido.",
            ]
          : [
              "Emitir factura con anticipación de al menos 7 días.",
              "Confirmar canal de pago vigente con el cliente.",
              "Revisar consumo de horas del retainer para informar al cliente.",
            ],
        highlights: [
          { label: "Monto", value: `$${r.monto.toLocaleString()}`, tone: "neutral" },
          { label: "Vence", value: format(r.fechaProximoPago, "dd MMM", { locale: es }), tone: isOverdue ? "negative" : "neutral" },
          {
            label: isOverdue ? "Días vencido" : "Días restantes",
            value: isOverdue ? `${Math.abs(r.diasRestantes)}d` : `${r.diasRestantes}d`,
            tone: isOverdue ? "negative" : "neutral",
          },
          { label: "Frecuencia", value: r.frecuencia, tone: "neutral" },
        ],
        rows: [
          { label: "Cliente", value: r.cliente },
          { label: "Monto retainer", value: `$${r.monto.toLocaleString()}` },
          { label: "Frecuencia", value: r.frecuencia },
          { label: "Próximo pago", value: format(r.fechaProximoPago, "dd MMM yyyy", { locale: es }) },
          { label: "Inicio", value: format(r.fechaInicio, "dd MMM yyyy", { locale: es }) },
          { label: "Estado", value: r.estado },
          { label: "Días restantes", value: r.diasRestantes < 0 ? `${Math.abs(r.diasRestantes)} días vencido` : `${r.diasRestantes} días` },
          { label: "Alerta", value: r.alertaEstado },
        ],
      };
    }

    const r = preview.row;
    const isClient = r.tipoAlerta === "cliente";
    const horasRestantes = r.horasTotales - r.horasUsadas;
    return {
      subject: `Consumo de horas al ${r.porcentajeUsado}% — ${r.cliente}`,
      severity: r.porcentajeUsado >= 90 ? "critical" : "warning",
      category: isClient ? "Consumo de horas (cliente)" : "Consumo de horas (interno)",
      intro: `${r.cliente} ha consumido ${r.horasUsadas} de ${r.horasTotales} horas asignadas (${r.porcentajeUsado}%) en el periodo actual. ${isClient ? "Se sugiere comunicar al cliente para coordinar el alcance restante y, si aplica, ampliación de horas." : "Se sugiere revisar internamente la asignación de horas y eficiencia del equipo."}`,
      recommendations: isClient
        ? [
            "Notificar al cliente del consumo actual.",
            "Validar tareas pendientes vs. horas restantes.",
            r.porcentajeUsado >= 90 ? "Preparar propuesta de ampliación de horas." : "Monitorear consumo semanal.",
          ]
        : [
            "Revisar eficiencia del equipo asignado.",
            "Identificar tareas no críticas para postergar.",
            "Reasignar carga si es necesario antes de superar el 100%.",
          ],
      highlights: [
        { label: "Consumido", value: `${r.porcentajeUsado}%`, tone: r.porcentajeUsado >= 90 ? "negative" : "neutral" },
        { label: "Horas usadas", value: `${r.horasUsadas}h`, tone: "neutral" },
        { label: "Restantes", value: `${horasRestantes}h`, tone: horasRestantes <= 2 ? "negative" : "positive" },
        { label: "Tipo", value: isClient ? "Cliente" : "Interna", tone: "neutral" },
      ],
      rows: [
        { label: "Cliente", value: r.cliente },
        { label: "Horas usadas", value: `${r.horasUsadas}h` },
        { label: "Horas totales", value: `${r.horasTotales}h` },
        { label: "Horas restantes", value: `${horasRestantes}h` },
        { label: "% Consumido", value: `${r.porcentajeUsado}%` },
        { label: "Tipo de alerta", value: isClient ? "Externa (cliente)" : "Interna" },
        { label: "Periodo", value: `${format(r.fechaInicio, "dd MMM yyyy", { locale: es })} – ${format(r.fechaFin, "dd MMM yyyy", { locale: es })}` },
        { label: "Estado", value: r.estado },
      ],
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

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
          {content && (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => downloadAlertPdf(content, recipient)}
            >
              <Download className="h-3.5 w-3.5" />
              Descargar PDF
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Alertas;
