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
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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

const Alertas = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [retainers, setRetainers] = useState<MonthlyRetainer[]>([]);
  const [retainerHours, setRetainerHours] = useState<RetainerHoursAlert[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchRetainers();
      fetchRetainerHours();
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground truncate mr-2">
                        {rh.cliente}
                      </span>
                      <span className={`text-sm font-bold ${rh.porcentajeUsado >= 90 ? "text-red-600" : "text-amber-600"}`}>
                        {rh.porcentajeUsado}%
                      </span>
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
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground truncate mr-2">
                        {rh.cliente}
                      </span>
                      <span className={`text-sm font-bold ${rh.porcentajeUsado >= 90 ? "text-red-600" : rh.porcentajeUsado >= 80 ? "text-amber-600" : "text-purple-600"}`}>
                        {rh.porcentajeUsado}%
                      </span>
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
                    <div className="flex-shrink-0">
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
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Alertas;
