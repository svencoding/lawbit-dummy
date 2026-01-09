import { useEffect, useState, useCallback } from "react";
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
  FileText,
  Clock,
  TrendingUp,
  DollarSign,
  Briefcase,
  CalendarIcon,
  X,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from "recharts";

const Dashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Date | undefined>(
    new Date(2025, 0, 1)
  ); // 1/1/2025
  const [endDate, setEndDate] = useState<Date | undefined>(
    new Date(2025, 8, 30)
  ); // 30/9/2025

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const fetchDashboardData = useCallback(async () => {
    try {
      setDataLoading(true);

      // Fetch ALL asuntos usando paginación para evitar el límite de 1000
      let allAsuntos: any[] = [];
      let asuntosPage = 0;
      const pageSize = 1000;
      let hasMoreAsuntos = true;

      while (hasMoreAsuntos) {
        const { data, error } = await supabase
          .from("asuntos")
          .select("*")
          .range(asuntosPage * pageSize, (asuntosPage + 1) * pageSize - 1);

        if (error) {
          console.error("Error fetching asuntos:", error);
          break;
        }

        if (data && data.length > 0) {
          allAsuntos = [...allAsuntos, ...data];
          hasMoreAsuntos = data.length === pageSize;
          asuntosPage++;
        } else {
          hasMoreAsuntos = false;
        }
      }

      // Extract and set available areas (only on first load or when no areas yet)
      if (availableAreas.length === 0 && allAsuntos) {
        const areas = Array.from(
          new Set(
            allAsuntos
              .map((a: any) => a["Area de Práctica"])
              .filter((area) => area && area.trim() !== "")
          )
        ).sort();
        setAvailableAreas(areas as string[]);
      }

      // Filter asuntos by selected area
      const asuntos =
        selectedArea === "all"
          ? allAsuntos
          : allAsuntos?.filter(
              (a: any) => a["Area de Práctica"] === selectedArea
            );

      // Get case codes (Código) for filtering related data
      const caseCodes =
        asuntos?.map((a: any) => a.Código).filter(Boolean) || [];

      // Fetch liquidaciones and horas
      let liquidaciones: any[] = [];
      let horas: any[] = [];
      let allHorasForAverage: any[] = []; // For calculating average billing days without filters

      if (selectedArea === "all") {
        // When "all areas" is selected, fetch everything without filtering
        // Fetch ALL liquidaciones usando paginación
        let allLiquidaciones: any[] = [];
        let liqPage = 0;
        let hasMoreLiq = true;

        while (hasMoreLiq) {
          const { data, error } = await supabase
            .from("liquidaciones")
            .select("*")
            .range(liqPage * pageSize, (liqPage + 1) * pageSize - 1);

          if (error) {
            console.error("Error fetching liquidaciones:", error);
            break;
          }

          if (data && data.length > 0) {
            allLiquidaciones = [...allLiquidaciones, ...data];
            hasMoreLiq = data.length === pageSize;
            liqPage++;
          } else {
            hasMoreLiq = false;
          }
        }

        liquidaciones = allLiquidaciones;

        // Fetch ALL horas usando paginación para evitar el límite de 1000
        let allHoras: any[] = [];
        let page = 0;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from("horas_valor_cobrado")
            .select("*")
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (error) {
            console.error("Error fetching horas:", error);
            break;
          }

          if (data && data.length > 0) {
            allHoras = [...allHoras, ...data];
            hasMore = data.length === pageSize;
            page++;
          } else {
            hasMore = false;
          }
        }

        horas = allHoras;
        allHorasForAverage = allHoras; // Use all horas for average calculation

        // DEBUG: Conteos antes de filtros
        console.log("=== CONTEOS SUPABASE (SIN FILTROS) ===");
        console.log(`Horas cargadas en ${page} página(s)`);
        console.log("Total Asuntos:", allAsuntos?.length || 0);
        console.log("Total Registros Horas:", allHoras?.length || 0);
        console.log(
          "Total Cobros Únicos:",
          new Set(allHoras?.map((h: any) => h["N° Cobro"]).filter(Boolean)).size
        );

        // Fechas
        const fechasTrabajo =
          allHoras?.map((h: any) => h["Trabajo (día)"]).filter(Boolean) || [];
        if (fechasTrabajo.length > 0) {
          console.log(
            "Fecha Más Antigua:",
            new Date(
              Math.min(...fechasTrabajo.map((f: any) => new Date(f).getTime()))
            )
              .toISOString()
              .split("T")[0]
          );
          console.log(
            "Fecha Más Reciente:",
            new Date(
              Math.max(...fechasTrabajo.map((f: any) => new Date(f).getTime()))
            )
              .toISOString()
              .split("T")[0]
          );
        }

        // Filtrar por año 2025
        const horas2025 =
          allHoras?.filter((h: any) => {
            if (!h["Trabajo (día)"]) return false;
            const year = new Date(h["Trabajo (día)"]).getFullYear();
            return year === 2025;
          }) || [];
        console.log("Registros 2025:", horas2025.length);
        console.log(
          "Cobros Únicos 2025:",
          new Set(horas2025.map((h: any) => h["N° Cobro"]).filter(Boolean)).size
        );
        console.log("====================================");
      } else {
        // When a specific area is selected, filter through case codes
        if (caseCodes.length > 0) {
          // First, fetch horas for the selected case codes
          const { data: filteredHoras } = await supabase
            .from("horas_valor_cobrado")
            .select("*")
            .in("Código Asunto", caseCodes)
            .range(0, 50000); // Sin límite de 1000
          horas = filteredHoras || [];
          allHorasForAverage = filteredHoras || []; // Use filtered horas for average calculation

          // Get unique "N° Cobro" values from the filtered horas
          const cobroIds = Array.from(
            new Set(
              horas
                .map((h: any) => h["N° Cobro"])
                .filter((id) => id != null && id !== "")
            )
          );

          // Fetch liquidaciones matching these N° Cobro values
          if (cobroIds.length > 0) {
            const { data: filteredLiquidaciones } = await supabase
              .from("liquidaciones")
              .select("*")
              .in("N° Cobro", cobroIds)
              .range(0, 50000); // Sin límite de 1000
            liquidaciones = filteredLiquidaciones || [];
          }
        }
      }

      // Apply date filters to liquidaciones
      if (startDate || endDate) {
        liquidaciones = liquidaciones.filter((l: any) => {
          if (!l["Fecha Creación"]) return false;
          const date = new Date(l["Fecha Creación"]);
          if (startDate && date < startDate) return false;
          if (endDate) {
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 999);
            if (date > endOfDay) return false;
          }
          return true;
        });
      }

      // Apply date filters to horas
      if (startDate || endDate) {
        horas = horas.filter((h: any) => {
          if (!h["Trabajo (día)"]) return false;
          const date = new Date(h["Trabajo (día)"]);
          if (startDate && date < startDate) return false;
          if (endDate) {
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 999);
            if (date > endOfDay) return false;
          }
          return true;
        });

        // DEBUG: Conteos DESPUÉS de filtros de fecha
        console.log("=== CONTEOS SUPABASE (CON FILTROS DE FECHA) ===");
        console.log("Fecha Inicio:", startDate?.toISOString().split("T")[0]);
        console.log("Fecha Fin:", endDate?.toISOString().split("T")[0]);
        console.log("Registros Horas Filtradas:", horas.length);
        console.log(
          "Cobros Únicos Filtrados:",
          new Set(horas.map((h: any) => h["N° Cobro"]).filter(Boolean)).size
        );
        console.log("===============================================");
      }

      // Calculate stats
      const clientesUnicos = new Set(
        asuntos?.map((a: any) => a.Cliente).filter(Boolean)
      ).size;
      const casosActivos =
        asuntos?.filter((a: any) => a.Activo === "Si" || a.Activo === "TRUE")
          .length || 0;
      const casosInactivos =
        asuntos?.filter((a: any) => a.Activo === "No" || a.Activo === "FALSE")
          .length || 0;

      const totalFacturado =
        liquidaciones?.reduce((sum: number, l: any) => {
          const total = parseFloat(l["Total facturado"]) || 0;
          return sum + total;
        }, 0) || 0;

      const horasTrabajadas =
        horas?.reduce((sum: number, h: any) => {
          return sum + (parseFloat(h["Horas Trabajadas"]) || 0);
        }, 0) || 0;

      // Calculate average billing days (Promedio días de facturación)
      // Logic: Match DAX behavior:
      // 1. Get unique N° Cobro from FILTERED horas (respects date filters like VALUES in DAX)
      // 2. For each cobro, calculate MAX dates from ALL records (like ALLEXCEPT in DAX)
      const uniqueCobros = Array.from(
        new Set(horas?.map((h: any) => h["N° Cobro"]).filter(Boolean))
      );

      const billingDaysDifferences: number[] = [];
      const debugData: any[] = [];

      uniqueCobros.forEach((cobroId) => {
        const horasForCobro = allHorasForAverage?.filter(
          (h: any) => h["N° Cobro"] === cobroId
        );

        if (horasForCobro && horasForCobro.length > 0) {
          // Get the latest work date (Trabajo (día))
          const workDates = horasForCobro
            .map((h: any) => h["Trabajo (día)"])
            .filter(Boolean)
            .map((d: any) => new Date(d));

          // Get the latest billing date (Fecha Facturación)
          const billingDates = horasForCobro
            .map((h: any) => h["Fecha Facturación"])
            .filter(Boolean)
            .map((d: any) => new Date(d));

          if (workDates.length > 0 && billingDates.length > 0) {
            const lastWorkDate = new Date(
              Math.max(...workDates.map((d) => d.getTime()))
            );
            const billingDate = new Date(
              Math.max(...billingDates.map((d) => d.getTime()))
            );

            // Calculate difference in days
            const diffInMs = billingDate.getTime() - lastWorkDate.getTime();
            const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24));

            billingDaysDifferences.push(diffInDays);

            debugData.push({
              cobroId,
              diffInDays,
              lastWorkDate: lastWorkDate.toISOString().split("T")[0],
              billingDate: billingDate.toISOString().split("T")[0],
              numRecords: horasForCobro.length,
            });
          }
        }
      });

      // Sort by diffInDays to see extremes
      debugData.sort((a, b) => b.diffInDays - a.diffInDays);

      console.log("=== DEBUG PROMEDIO DÍAS FACTURACIÓN ===");
      console.log("Total cobros únicos:", uniqueCobros.length);
      console.log("Cobros con fechas válidas:", billingDaysDifferences.length);
      console.log(
        "Promedio:",
        billingDaysDifferences.reduce((sum, days) => sum + days, 0) /
          billingDaysDifferences.length
      );
      console.log("\nTop 10 mayores diferencias:");
      console.table(debugData.slice(0, 10));
      console.log("\nTop 10 menores diferencias:");
      console.table(debugData.slice(-10));
      console.log("\nEstadísticas:");
      console.log("- Máximo:", Math.max(...billingDaysDifferences));
      console.log("- Mínimo:", Math.min(...billingDaysDifferences));
      console.log(
        "- Suma total:",
        billingDaysDifferences.reduce((sum, days) => sum + days, 0)
      );
      console.log(
        "- Valores negativos:",
        billingDaysDifferences.filter((d) => d < 0).length
      );
      console.log(
        "- Valores > 100 días:",
        billingDaysDifferences.filter((d) => d > 100).length
      );

      const promedioDiasFacturacion =
        billingDaysDifferences.length > 0
          ? Math.round(
              billingDaysDifferences.reduce((sum, days) => sum + days, 0) /
                billingDaysDifferences.length
            )
          : 0;

      // Process data for charts
      const areasPractica =
        asuntos?.reduce((acc: any, a: any) => {
          const area = a["Area de Práctica"] || "Sin categoría";
          acc[area] = (acc[area] || 0) + 1;
          return acc;
        }, {}) || {};

      const areasChart = Object.entries(areasPractica).map(([name, value]) => ({
        name,
        value,
      }));

      // Revenue by month
      const revenueByMonth =
        liquidaciones?.reduce((acc: any, l: any) => {
          if (l["Fecha Creación"]) {
            const date = new Date(l["Fecha Creación"]);
            const monthKey = `${date.getFullYear()}-${String(
              date.getMonth() + 1
            ).padStart(2, "0")}`;
            const total = parseFloat(l["Total facturado"]) || 0;
            acc[monthKey] = (acc[monthKey] || 0) + total;
          }
          return acc;
        }, {}) || {};

      const revenueChart = Object.entries(revenueByMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12) // Last 12 months
        .map(([month, revenue]) => ({
          month,
          revenue,
        }));

      // Status distribution
      const estadosLiquidacion =
        liquidaciones?.reduce((acc: any, l: any) => {
          const estado = l.Estado || "Sin estado";
          acc[estado] = (acc[estado] || 0) + 1;
          return acc;
        }, {}) || {};

      const statusChart = Object.entries(estadosLiquidacion).map(
        ([name, value]) => ({
          name,
          value,
        })
      );

      setDashboardData({
        clientesUnicos,
        casosActivos,
        casosInactivos,
        totalFacturado,
        horasTrabajadas,
        promedioDiasFacturacion,
        areasChart,
        revenueChart,
        statusChart,
        totalCases: asuntos?.length || 0,
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setDataLoading(false);
    }
  }, [selectedArea, availableAreas.length, startDate, endDate]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user, fetchDashboardData]);

  if (loading || dataLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return null;
  }

  const stats = [
    {
      title: "Clientes Activos",
      value: dashboardData?.clientesUnicos || "0",
      description: "Total de clientes en el sistema",
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Promedio días de facturación",
      value: dashboardData?.promedioDiasFacturacion || "0",
      description: "Días promedio entre último trabajo y facturación",
      icon: CalendarIcon,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Total Casos",
      value: dashboardData?.totalCases || "0",
      description: "Total de casos en el sistema",
      icon: Briefcase,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "Horas Trabajadas",
      value: Math.round(dashboardData?.horasTrabajadas || 0).toLocaleString(),
      description: "Total de horas registradas",
      icon: Clock,
      color: "text-amber-600",
      bgColor: "bg-amber-100",
    },
    {
      title: "Total Facturado",
      value: `$${(dashboardData?.totalFacturado || 0).toLocaleString()}`,
      description: "Ingresos totales generados",
      icon: DollarSign,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100",
    },
    {
      title: "Casos Cerrados",
      value: dashboardData?.casosInactivos || "0",
      description: "Casos finalizados",
      icon: TrendingUp,
      color: "text-indigo-600",
      bgColor: "bg-indigo-100",
    },
  ];

  const COLORS = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#8884d8",
    "#82ca9d",
    "#ffc658",
    "#ff7c7c",
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Dashboard
              </h1>
              <p className="text-muted-foreground">
                Bienvenido a tu sistema de gestión legal
              </p>
            </div>
          </div>

          {/* Filters Row */}
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* Date Filters */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-1">
              <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                Filtrar por fecha:
              </span>
              <div className="flex flex-wrap gap-3 items-center">
                {/* Start Date */}
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

                {/* End Date */}
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

                {/* Clear Dates Button */}
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

            {/* Area Filter */}
            <div className="w-full lg:w-64">
              <Select value={selectedArea} onValueChange={setSelectedArea}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por área" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las áreas</SelectItem>
                  {availableAreas.map((area) => (
                    <SelectItem key={area} value={area}>
                      {area}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
              <CardContent>
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

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Over Time */}
          {dashboardData?.revenueChart &&
            dashboardData.revenueChart.length > 0 && (
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-foreground">
                    Facturación Mensual
                  </CardTitle>
                  <CardDescription>
                    Ingresos por mes (últimos 12 meses)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={dashboardData.revenueChart}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <ChartTooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white p-2 border rounded shadow-sm">
                                <p className="text-sm font-semibold">
                                  {payload[0].payload.month}
                                </p>
                                <p className="text-sm text-emerald-600">
                                  ${Number(payload[0].value).toLocaleString()}
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

          {/* Practice Areas Distribution - Only show when "all" areas is selected */}
          {selectedArea === "all" &&
            dashboardData?.areasChart &&
            dashboardData.areasChart.length > 0 && (
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-foreground">
                    Casos por Área de Práctica
                  </CardTitle>
                  <CardDescription>
                    Distribución de casos por área legal
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={dashboardData.areasChart}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        angle={-45}
                        textAnchor="end"
                        height={100}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <ChartTooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white p-2 border rounded shadow-sm">
                                <p className="text-sm font-semibold">
                                  {payload[0].payload.name}
                                </p>
                                <p className="text-sm text-blue-600">
                                  {payload[0].value} casos
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="value" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
        </div>

        {/* Status Distribution */}
        {dashboardData?.statusChart && dashboardData.statusChart.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-foreground">
                  Estado de Liquidaciones
                </CardTitle>
                <CardDescription>
                  Distribución por estado de facturación
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={dashboardData.statusChart}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {dashboardData.statusChart.map(
                        (entry: any, index: number) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        )
                      )}
                    </Pie>
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const total = dashboardData.statusChart.reduce(
                            (sum: number, item: { value: number }) =>
                              sum + item.value,
                            0
                          );
                          const percent = (
                            (Number(payload[0].value) / total) *
                            100
                          ).toFixed(1);
                          return (
                            <div className="bg-white p-2 border rounded shadow-sm">
                              <p className="text-sm font-semibold">
                                {payload[0].name}
                              </p>
                              <p className="text-sm">
                                {payload[0].value} liquidaciones ({percent}%)
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend
                      verticalAlign="middle"
                      align="right"
                      layout="vertical"
                      formatter={(value, entry) => {
                        const total = dashboardData.statusChart.reduce(
                          (sum: number, item: { value: number }) =>
                            sum + item.value,
                          0
                        );
                        const itemValue = entry.payload?.value || 0;
                        const percent = ((itemValue / total) * 100).toFixed(0);
                        return `${value}: ${percent}%`;
                      }}
                      wrapperStyle={{
                        paddingLeft: "20px",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Summary Card */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-foreground">
                  Resumen General
                </CardTitle>
                <CardDescription>Vista general del sistema</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">
                    Total Clientes
                  </span>
                  <span className="text-lg font-semibold text-foreground">
                    {dashboardData?.clientesUnicos || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">
                    Casos Activos
                  </span>
                  <span className="text-lg font-semibold text-green-600">
                    {dashboardData?.casosActivos || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">
                    Casos Cerrados
                  </span>
                  <span className="text-lg font-semibold text-gray-600">
                    {dashboardData?.casosInactivos || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">
                    Total Horas
                  </span>
                  <span className="text-lg font-semibold text-amber-600">
                    {Math.round(
                      dashboardData?.horasTrabajadas || 0
                    ).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-muted-foreground">
                    Total Facturado
                  </span>
                  <span className="text-lg font-semibold text-emerald-600">
                    ${(dashboardData?.totalFacturado || 0).toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
