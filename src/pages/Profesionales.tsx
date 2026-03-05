import { useEffect, useState, useMemo } from "react";
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
  Users,
  Clock,
  DollarSign,
  TrendingUp,
  CalendarIcon,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getUsuarios,
  getTransformedTimeEntries,
} from "@/lib/mockDataUtils";
import type { Usuario } from "@/lib/mock/types";

interface ProfessionalData {
  user: Usuario;
  totalHours: number;
  billableHours: number;
  revenue: number;
  cost: number;
  margin: number;
  marginPercent: number;
  utilizationPercent: number;
  clientCount: number;
}

function computeProfessionalData(
  startDate?: Date,
  endDate?: Date,
): ProfessionalData[] {
  const usuarios = getUsuarios();
  const entries = getTransformedTimeEntries(startDate, endDate);

  // Build a map of user_id -> aggregated data
  const userMap = new Map<
    number,
    {
      totalHours: number;
      billableHours: number;
      revenue: number;
      clients: Set<string>;
    }
  >();

  entries.forEach((entry) => {
    if (!userMap.has(entry.user_id)) {
      userMap.set(entry.user_id, {
        totalHours: 0,
        billableHours: 0,
        revenue: 0,
        clients: new Set(),
      });
    }
    const data = userMap.get(entry.user_id)!;
    data.totalHours += entry.duration;
    data.billableHours += entry.billable_duration;

    // Revenue = billable_hours * rate (from usuario)
    const usuario = usuarios.find((u) => u.id === entry.user_id);
    if (usuario) {
      data.revenue += entry.billable_duration * usuario.rate;
    }

    data.clients.add(entry.client_name);
  });

  // Calculate working days in the date range for utilization
  const start = startDate || new Date(2025, 0, 1);
  const end = endDate || new Date(2025, 11, 31);
  const diffMs = end.getTime() - start.getTime();
  const totalDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1);
  // Approximate working days (5/7 of total days)
  const workingDays = Math.round((totalDays * 5) / 7);

  return usuarios.map((user) => {
    const data = userMap.get(user.id) || {
      totalHours: 0,
      billableHours: 0,
      revenue: 0,
      clients: new Set<string>(),
    };

    const cost = data.totalHours * user.hourly_cost;
    const margin = data.revenue - cost;
    const marginPercent = data.revenue > 0 ? (margin / data.revenue) * 100 : 0;

    // Utilization: actual billable hours / expected billable hours
    const expectedHours = user.daily_goal * workingDays;
    const utilizationPercent =
      expectedHours > 0 ? (data.billableHours / expectedHours) * 100 : 0;

    return {
      user,
      totalHours: data.totalHours,
      billableHours: data.billableHours,
      revenue: data.revenue,
      cost,
      margin,
      marginPercent,
      utilizationPercent,
      clientCount: data.clients.size,
    };
  }).sort((a, b) => b.revenue - a.revenue);
}

const categoryColors: Record<string, string> = {
  Socio: "bg-amber-100 text-amber-800 border-amber-200",
  "Asociado Sr": "bg-blue-100 text-blue-800 border-blue-200",
  Asociado: "bg-green-100 text-green-800 border-green-200",
  "Asociado Junior": "bg-purple-100 text-purple-800 border-purple-200",
};

const Profesionales = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState<Date | undefined>(
    new Date(2025, 0, 1),
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    new Date(2025, 11, 31),
  );
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  // Simulate loading
  useEffect(() => {
    if (user) {
      setDataLoading(true);
      const timer = setTimeout(() => setDataLoading(false), 400);
      return () => clearTimeout(timer);
    }
  }, [user, startDate, endDate]);

  const professionals = useMemo(() => {
    return computeProfessionalData(startDate, endDate);
  }, [startDate, endDate]);

  const totals = useMemo(() => {
    const totalHours = professionals.reduce((s, p) => s + p.billableHours, 0);
    const totalRevenue = professionals.reduce((s, p) => s + p.revenue, 0);
    const avgRate = totalHours > 0 ? totalRevenue / totalHours : 0;
    return {
      count: professionals.length,
      totalHours,
      totalRevenue,
      avgRate,
    };
  }, [professionals]);

  const chartData = useMemo(() => {
    return professionals.map((p) => ({
      name: p.user.name,
      code: p.user.code,
      revenue: Math.round(p.revenue),
      category: p.user.category,
    }));
  }, [professionals]);

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
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return null;
  }

  const stats = [
    {
      title: "Total Encargados Comerciales",
      value: totals.count.toString(),
      description: "Encargados comerciales activos en la firma",
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Horas Facturables",
      value: Math.round(totals.totalHours).toLocaleString(),
      description: "Total de horas facturables en el periodo",
      icon: Clock,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Facturación Total",
      value: `$${Math.round(totals.totalRevenue).toLocaleString()}`,
      description: "Ingresos totales generados",
      icon: DollarSign,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100",
    },
    {
      title: "Tarifa Promedio",
      value: `$${Math.round(totals.avgRate).toLocaleString()}/hr`,
      description: "Tarifa promedio de facturación",
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
  ];

  const barHeight = 30;
  const totalHeight = chartData.length * barHeight + 60;

  return (
    <DashboardLayout>
      <div className="space-y-4 w-full min-w-0 max-w-full overflow-x-hidden">
        {/* Header */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Encargados Comerciales
              </h1>
              <p className="text-muted-foreground">
                Resumen de rendimiento de los encargados comerciales de la firma
              </p>
            </div>
          </div>

          {/* Date Filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              Filtrar por fecha:
            </span>
            <div className="flex flex-wrap gap-3 items-center">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`justify-start text-left font-normal ${
                      !startDate && "text-muted-foreground"
                    }`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                    {startDate ? (
                      <span className="truncate">
                        {format(startDate, "dd/MM/yyyy")}
                      </span>
                    ) : (
                      <span>Fecha inicio</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    locale={es}
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`justify-start text-left font-normal ${
                      !endDate && "text-muted-foreground"
                    }`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                    {endDate ? (
                      <span className="truncate">
                        {format(endDate, "dd/MM/yyyy")}
                      </span>
                    ) : (
                      <span>Fecha fin</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    locale={es}
                    disabled={(date) =>
                      startDate ? date < startDate : false
                    }
                  />
                </PopoverContent>
              </Popover>

              {(startDate || endDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStartDate(undefined);
                    setEndDate(undefined);
                  }}
                  className="h-9 px-2"
                >
                  <X className="h-4 w-4 mr-1" />
                  Limpiar fechas
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card
              key={stat.title}
              className="border-border/50 hover:shadow-md transition-shadow"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`${stat.bgColor} p-2 rounded-lg`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-bold text-foreground">
                  {stat.value}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bar Chart */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground">
              Facturación por Encargado Comercial
            </CardTitle>
            <CardDescription>
              Ingresos generados por cada encargado comercial en el periodo
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div
              className="overflow-y-auto rounded-md"
              style={{ maxHeight: "400px" }}
            >
              <ChartContainer
                config={{
                  revenue: { label: "Facturación", color: "hsl(var(--chart-1))" },
                }}
                style={{ height: `${totalHeight}px`, width: "100%" }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 5, right: 80, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      tickFormatter={(value) => {
                        const millions = value / 1000000;
                        return millions >= 1
                          ? `$${millions.toFixed(1)}M`
                          : `$${(value / 1000).toFixed(0)}K`;
                      }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={130}
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          return (
                            <div className="rounded-lg border bg-background p-2 shadow-sm">
                              <div className="flex flex-col gap-1">
                                <span className="text-sm font-medium">
                                  {d.name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {d.category}
                                </span>
                                <span className="font-bold text-emerald-600">
                                  ${d.revenue.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="revenue"
                      radius={[0, 4, 4, 0]}
                      onClick={(data) => {
                        if (data?.code) {
                          const params = new URLSearchParams();
                          if (startDate)
                            params.set("startDate", startDate.toISOString());
                          if (endDate)
                            params.set("endDate", endDate.toISOString());
                          const qs = params.toString();
                          navigate(
                            `/user/${data.code}${qs ? `?${qs}` : ""}`,
                          );
                        }
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      {chartData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill="hsl(var(--chart-5))"
                          fillOpacity={0.8}
                        />
                      ))}
                      <LabelList
                        dataKey="revenue"
                        position="right"
                        content={(props: any) => {
                          const { x, y, width, height, value } = props;
                          return (
                            <text
                              x={x + width + 5}
                              y={y + height / 2}
                              fill="hsl(var(--muted-foreground))"
                              fontSize="11px"
                              textAnchor="start"
                              dominantBaseline="middle"
                            >
                              ${value?.toLocaleString()}
                            </text>
                          );
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        {/* Professionals Table */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground">
              Detalle por Encargado Comercial
            </CardTitle>
            <CardDescription>
              Métricas detalladas de rendimiento por encargado comercial
            </CardDescription>
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
                      Nombre
                    </TableHead>
                    <TableHead className="h-9 px-2 text-xs font-semibold">
                      Categoría
                    </TableHead>
                    <TableHead className="h-9 px-2 text-xs font-semibold">
                      Área
                    </TableHead>
                    <TableHead className="h-9 px-2 text-xs font-semibold text-right">
                      Horas
                    </TableHead>
                    <TableHead className="h-9 px-2 text-xs font-semibold text-right">
                      Clientes
                    </TableHead>
                    <TableHead className="h-9 px-2 text-xs font-semibold text-right">
                      Facturación
                    </TableHead>
                    <TableHead className="h-9 px-2 text-xs font-semibold text-right">
                      Costo
                    </TableHead>
                    <TableHead className="h-9 px-2 text-xs font-semibold text-right">
                      Margen
                    </TableHead>
                    <TableHead className="h-9 px-2 text-xs font-semibold text-right">
                      Margen %
                    </TableHead>
                    <TableHead className="h-9 px-2 text-xs font-semibold text-right">
                      Utilización
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {professionals.map((p, index) => {
                    const isNegativeMargin = p.margin < 0;
                    return (
                      <TableRow
                        key={p.user.id}
                        className="border-b h-8 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => {
                          const params = new URLSearchParams();
                          if (startDate)
                            params.set("startDate", startDate.toISOString());
                          if (endDate)
                            params.set("endDate", endDate.toISOString());
                          const qs = params.toString();
                          navigate(
                            `/user/${p.user.code}${qs ? `?${qs}` : ""}`,
                          );
                        }}
                      >
                        <TableCell className="px-2 py-1 text-xs font-medium">
                          {index + 1}
                        </TableCell>
                        <TableCell className="px-2 py-1 text-xs font-medium">
                          {p.user.name}
                        </TableCell>
                        <TableCell className="px-2 py-1">
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${
                              categoryColors[p.user.category] || ""
                            }`}
                          >
                            {p.user.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-2 py-1 text-xs">
                          {p.user.practice_area}
                        </TableCell>
                        <TableCell className="px-2 py-1 text-xs text-right">
                          {Math.round(p.billableHours).toLocaleString()}
                        </TableCell>
                        <TableCell className="px-2 py-1 text-xs text-right">
                          {p.clientCount}
                        </TableCell>
                        <TableCell className="px-2 py-1 text-xs text-right font-medium text-emerald-600">
                          ${Math.round(p.revenue).toLocaleString()}
                        </TableCell>
                        <TableCell className="px-2 py-1 text-xs text-right">
                          ${Math.round(p.cost).toLocaleString()}
                        </TableCell>
                        <TableCell className="px-2 py-1 text-xs text-right">
                          <span
                            className={`font-medium ${
                              isNegativeMargin
                                ? "text-red-600"
                                : "text-emerald-600"
                            }`}
                          >
                            ${Math.round(p.margin).toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="px-2 py-1 text-xs text-right">
                          <span
                            className={`font-medium ${
                              isNegativeMargin
                                ? "text-red-600"
                                : "text-emerald-600"
                            }`}
                          >
                            {p.marginPercent.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="px-2 py-1 text-xs text-right">
                          <span
                            className={`font-medium ${
                              p.utilizationPercent >= 80
                                ? "text-emerald-600"
                                : p.utilizationPercent >= 50
                                  ? "text-amber-600"
                                  : "text-red-600"
                            }`}
                          >
                            {p.utilizationPercent.toFixed(1)}%
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Profesionales;
