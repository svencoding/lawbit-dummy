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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bell,
  DollarSign,
  Calendar as CalendarIcon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  TrendingUp,
  Mail,
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
      // TODO: Fetch actual retainer data from database
      // For now, using mock data for presentation purposes
      fetchRetainers();
      fetchRetainerHours();
    }
  }, [user]);

  const fetchRetainers = async () => {
    try {
      setDataLoading(true);

      // Mock data for presentation - replace with actual API call
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

      // Simulate API delay
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
      // Mock data for retainer hours alerts
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

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500));
      setRetainerHours(mockRetainerHours);
    } catch (error) {
      console.error("Error fetching retainer hours:", error);
    }
  };

  const getStatusBadge = (retainer: MonthlyRetainer) => {
    switch (retainer.alertaEstado) {
      case "vencido":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Vencido
          </Badge>
        );
      case "por_vencer":
        return (
          <Badge variant="default" className="gap-1 bg-amber-500">
            <Clock className="h-3 w-3" />
            Por vencer
          </Badge>
        );
      case "proximo":
        return (
          <Badge variant="default" className="gap-1 bg-blue-500">
            <Bell className="h-3 w-3" />
            Próximo
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Al día
          </Badge>
        );
    }
  };

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case "activo":
        return (
          <Badge variant="outline" className="text-green-600 border-green-600">
            Activo
          </Badge>
        );
      case "pausado":
        return (
          <Badge variant="outline" className="text-amber-600 border-amber-600">
            Pausado
          </Badge>
        );
      case "cancelado":
        return (
          <Badge variant="outline" className="text-red-600 border-red-600">
            Cancelado
          </Badge>
        );
      default:
        return <Badge variant="outline">{estado}</Badge>;
    }
  };

  const getStats = () => {
    const total = retainers.length;
    const vencidos = retainers.filter(
      (r) => r.alertaEstado === "vencido"
    ).length;
    const porVencer = retainers.filter(
      (r) => r.alertaEstado === "por_vencer"
    ).length;
    const proximos = retainers.filter(
      (r) => r.alertaEstado === "proximo"
    ).length;
    const totalMonto = retainers
      .filter((r) => r.estado === "activo")
      .reduce((sum, r) => sum + r.monto, 0);

    return { total, vencidos, porVencer, proximos, totalMonto };
  };

  const stats = getStats();

  const getRetainerHoursStats = () => {
    const clientAlerts = retainerHours.filter(
      (rh) => rh.tipoAlerta === "cliente" && rh.porcentajeUsado >= 80
    ).length;
    const internalAlerts = retainerHours.filter(
      (rh) => rh.tipoAlerta === "interna" && rh.porcentajeUsado >= 70
    ).length;
    const totalActive = retainerHours.filter(
      (rh) => rh.estado === "activo"
    ).length;

    return { clientAlerts, internalAlerts, totalActive };
  };

  const retainerHoursStats = getRetainerHoursStats();

  if (loading || dataLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return null;
  }

  // Sort retainers: vencidos first, then por vencer, then proximos, then ok
  const sortedRetainers = [...retainers].sort((a, b) => {
    const order = { vencido: 0, por_vencer: 1, proximo: 2, ok: 3 };
    return order[a.alertaEstado] - order[b.alertaEstado];
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Alertas por hitos
          </h1>
          <p className="text-muted-foreground">
            Gestiona y monitorea los retainers mensuales y alertas de horas de
            tus clientes
          </p>
        </div>

        {/* Retainer Hours Alerts Section */}
        <div className="space-y-6">
          {/* Retainer Hours Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Alertas para Clientes
                </CardTitle>
                <Mail className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {retainerHoursStats.clientAlerts}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Clientes con ≥80% de horas usadas
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Alertas Internas
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {retainerHoursStats.internalAlerts}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Retainers con alto uso de horas
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Retainers Activos
                </CardTitle>
                <Users className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {retainerHoursStats.totalActive}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Con seguimiento de horas
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Client Alerts Table */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-500" />
                Alertas para Clientes (≥80% de horas usadas)
              </CardTitle>
              <CardDescription>
                Clientes que deben ser notificados sobre el uso de sus horas de
                retainer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Horas Usadas</TableHead>
                      <TableHead className="text-right">
                        Horas Totales
                      </TableHead>
                      <TableHead className="text-right">Porcentaje</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {retainerHours
                      .filter(
                        (rh) =>
                          rh.tipoAlerta === "cliente" &&
                          rh.porcentajeUsado >= 80
                      )
                      .sort((a, b) => b.porcentajeUsado - a.porcentajeUsado)
                      .length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-muted-foreground py-8"
                        >
                          No hay alertas para clientes en este momento
                        </TableCell>
                      </TableRow>
                    ) : (
                      retainerHours
                        .filter(
                          (rh) =>
                            rh.tipoAlerta === "cliente" &&
                            rh.porcentajeUsado >= 80
                        )
                        .sort((a, b) => b.porcentajeUsado - a.porcentajeUsado)
                        .map((retainerHour) => (
                          <TableRow key={retainerHour.id}>
                            <TableCell className="font-medium">
                              {retainerHour.cliente}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {retainerHour.horasUsadas}h
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {retainerHour.horasTotales}h
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant={
                                  retainerHour.porcentajeUsado >= 90
                                    ? "destructive"
                                    : retainerHour.porcentajeUsado >= 80
                                    ? "default"
                                    : "secondary"
                                }
                                className={
                                  retainerHour.porcentajeUsado >= 90
                                    ? "bg-red-500"
                                    : retainerHour.porcentajeUsado >= 80
                                    ? "bg-amber-500"
                                    : ""
                                }
                              >
                                {retainerHour.porcentajeUsado}%
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {format(retainerHour.fechaInicio, "dd MMM", {
                                locale: es,
                              })}{" "}
                              -{" "}
                              {format(retainerHour.fechaFin, "dd MMM yyyy", {
                                locale: es,
                              })}
                            </TableCell>
                            <TableCell>
                              {getEstadoBadge(retainerHour.estado)}
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Internal Alerts Table */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-500" />
                Alertas Internas (Alto uso de horas)
              </CardTitle>
              <CardDescription>
                Retainers con alto consumo de horas que requieren atención
                interna
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Horas Usadas</TableHead>
                      <TableHead className="text-right">
                        Horas Totales
                      </TableHead>
                      <TableHead className="text-right">Porcentaje</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {retainerHours
                      .filter(
                        (rh) =>
                          rh.tipoAlerta === "interna" &&
                          rh.porcentajeUsado >= 70
                      )
                      .sort((a, b) => b.porcentajeUsado - a.porcentajeUsado)
                      .length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-muted-foreground py-8"
                        >
                          No hay alertas internas en este momento
                        </TableCell>
                      </TableRow>
                    ) : (
                      retainerHours
                        .filter(
                          (rh) =>
                            rh.tipoAlerta === "interna" &&
                            rh.porcentajeUsado >= 70
                        )
                        .sort((a, b) => b.porcentajeUsado - a.porcentajeUsado)
                        .map((retainerHour) => (
                          <TableRow key={retainerHour.id}>
                            <TableCell className="font-medium">
                              {retainerHour.cliente}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {retainerHour.horasUsadas}h
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {retainerHour.horasTotales}h
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant={
                                  retainerHour.porcentajeUsado >= 90
                                    ? "destructive"
                                    : retainerHour.porcentajeUsado >= 80
                                    ? "default"
                                    : "secondary"
                                }
                                className={
                                  retainerHour.porcentajeUsado >= 90
                                    ? "bg-red-500"
                                    : retainerHour.porcentajeUsado >= 80
                                    ? "bg-amber-500"
                                    : "bg-purple-500"
                                }
                              >
                                {retainerHour.porcentajeUsado}%
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {format(retainerHour.fechaInicio, "dd MMM", {
                                locale: es,
                              })}{" "}
                              -{" "}
                              {format(retainerHour.fechaFin, "dd MMM yyyy", {
                                locale: es,
                              })}
                            </TableCell>
                            <TableCell>
                              {getEstadoBadge(retainerHour.estado)}
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

        {/* Retainers Table */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-foreground">
              Lista de Retainers
            </CardTitle>
            <CardDescription>
              Monitorea el estado de todos los retainers mensuales
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Monto Mensual</TableHead>
                    <TableHead>Frecuencia</TableHead>
                    <TableHead>Próximo Pago</TableHead>
                    <TableHead className="text-right">Días Restantes</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Alerta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRetainers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-muted-foreground py-8"
                      >
                        No hay retainers registrados
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedRetainers.map((retainer) => (
                      <TableRow key={retainer.id}>
                        <TableCell className="font-medium">
                          {retainer.cliente}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-emerald-600">
                          ${retainer.monto.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {retainer.frecuencia}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(retainer.fechaProximoPago, "dd MMM yyyy", {
                            locale: es,
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={
                              retainer.diasRestantes < 0
                                ? "text-red-600 font-semibold"
                                : retainer.diasRestantes <= 7
                                ? "text-amber-600 font-semibold"
                                : "text-muted-foreground"
                            }
                          >
                            {retainer.diasRestantes < 0
                              ? `${Math.abs(
                                  retainer.diasRestantes
                                )} días vencido`
                              : `${retainer.diasRestantes} días`}
                          </span>
                        </TableCell>
                        <TableCell>{getEstadoBadge(retainer.estado)}</TableCell>
                        <TableCell>{getStatusBadge(retainer)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-border/50 bg-muted/50">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Sobre las Alertas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div>
                <p className="font-semibold text-foreground mb-1">
                  Alertas de Retainers Mensuales:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>
                    <strong className="text-foreground">Vencido:</strong> El
                    retainer ya pasó su fecha de pago y requiere atención
                    inmediata.
                  </li>
                  <li>
                    <strong className="text-foreground">Por vencer:</strong> El
                    retainer vence en los próximos 7 días.
                  </li>
                  <li>
                    <strong className="text-foreground">Próximo:</strong> El
                    retainer vence en los próximos 30 días.
                  </li>
                  <li>
                    <strong className="text-foreground">Al día:</strong> El
                    retainer está al día y no requiere acción inmediata.
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">
                  Alertas de Horas de Retainer:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>
                    <strong className="text-foreground">
                      Alertas para Clientes:
                    </strong>{" "}
                    Se notifica automáticamente a los clientes cuando alcanzan
                    el 80% de sus horas de retainer para evitar quejas
                    posteriores.
                  </li>
                  <li>
                    <strong className="text-foreground">
                      Alertas Internas:
                    </strong>{" "}
                    Se generan alertas internas cuando se observa un alto
                    consumo de horas en un retainer, permitiendo a la firma
                    anticiparse y comunicarse con el cliente.
                  </li>
                </ul>
              </div>
              <p className="pt-2 text-xs italic">
                Nota: Los métodos de alerta (SMS, email) se configurarán en una
                futura actualización.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Alertas;
