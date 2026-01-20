import { useEffect, useState, useCallback, useRef, useMemo } from "react";
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
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getAreaColor, AREAS_PROFESIONALES } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { dashboardCache } from "@/lib/dashboardCache";
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
  ComposedChart,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getDashboardData,
  getClientCosts,
  getRevenueByUser,
} from "@/lib/mockDataUtils";
import { formatDateLocal } from "@/lib/utils";
import {
  FacturacionFiltersProvider,
  useFacturacionFilters,
} from "@/hooks/useFacturacionFilters";

// Set to true to use mock data for presentations (no database calls)
const USE_MOCK_DATA = true;

const FacturacionContent = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const {
    filters,
    setAreaFilter,
    setClientFilter,
    setFormaCobroFilter,
    clearFilters,
    hasActiveFilters,
  } = useFacturacionFilters();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [chartData, setChartData] = useState<any>(null); // Chart data always shows all areas
  const [formaCobroChartData, setFormaCobroChartData] = useState<any>(null); // Chart data always shows all forma de cobro types
  const [dataLoading, setDataLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false); // For incremental loading
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const [allClients, setAllClients] = useState<
    Array<{ nombre: string; totalFacturado: number }>
  >([]);
  const [allRevenueByUsers, setAllRevenueByUsers] = useState<
    Array<{ user_name: string; user_code: string; revenue: number }>
  >([]);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const isInitialTableLoadRef = useRef(true);
  const [startDate, setStartDate] = useState<Date | undefined>(
    new Date(2025, 0, 1)
  ); // 1/1/2025
  const [endDate, setEndDate] = useState<Date | undefined>(
    new Date(2025, 11, 31)
  ); // 31/12/2025

  // Determine selectedArea from filters (for backward compatibility with getDashboardData)
  const selectedArea = filters.area || "all";

  const transformFinalNumber = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) {
      return 0;
    }
    const numericValue =
      typeof value === "string" ? parseFloat(value) : Number(value);
    if (Number.isNaN(numericValue)) {
      return 0;
    }
    // return Math.round((numericValue / 50000) * 72);
    return numericValue;
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  // Don't filter clients - keep all visible but highlight the selected one
  // Area and formaCobro filtering is already done in getClientCosts
  const clients = useMemo(() => {
    return allClients;
  }, [allClients]);

  // Filter revenue by users based on active filters
  // Note: For now, we show all users. In a full implementation,
  // we would filter users based on which clients they worked for
  const revenueByUsers = useMemo(() => {
    return allRevenueByUsers;
  }, [allRevenueByUsers]);

  // Fetch areas disponibles (solo una vez)
  useEffect(() => {
    const fetchAreas = async () => {
      if (availableAreas.length > 0) return;

      if (USE_MOCK_DATA) {
        // Use areas from mock data
        const dashboardData = getDashboardData("all", startDate, endDate);
        const areas = Array.from(
          new Set(dashboardData.facturacionPorArea.map((a: any) => a.area))
        ).sort() as string[];
        setAvailableAreas(areas);
        return;
      }

      const { data } = await supabase
        .from("asuntos")
        .select('"Area de Práctica"')
        .not('"Area de Práctica"', "is", null)
        .not('"Area de Práctica"', "eq", "");

      if (data) {
        const areas = Array.from(
          new Set(data.map((a: any) => a["Area de Práctica"]))
        ).sort() as string[];
        setAvailableAreas(areas);
      }
    };

    if (user) {
      fetchAreas();
    }
  }, [user, availableAreas.length, startDate, endDate]);

  const fetchDashboardData = useCallback(
    async (isFilterChange = false) => {
      try {
        // Use mock data if flag is enabled
        if (USE_MOCK_DATA) {
          console.log("🎭 Using mock data for presentation");
          // Simulate a small delay for realistic loading
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Get dashboard data from relational data
          const allAreasData = getDashboardData("all", startDate, endDate);
          const filteredData = getDashboardData(
            selectedArea,
            startDate,
            endDate,
            filters.clientName,
            filters.formaCobro
          );

          // Get pie chart data - filter by client if client filter is active
          // But keep formaCobro unfiltered for the chart (only filter by client, not formaCobro)
          const pieChartData =
            filters.clientName
              ? getDashboardData(
                  "all",
                  startDate,
                  endDate,
                  filters.clientName,
                  undefined // Don't filter by formaCobro for the area chart
                ).facturacionPorArea
              : allAreasData.facturacionPorArea;

          // Get forma cobro chart data - filter by client or area if those filters are active
          // But keep formaCobro unfiltered for the chart
          const formaCobroChartDataUnfiltered =
            filters.clientName || filters.area
              ? getDashboardData(
                  filters.area || "all",
                  startDate,
                  endDate,
                  filters.clientName,
                  undefined // Don't filter by formaCobro for the chart
                ).formaCobroChart
              : allAreasData.formaCobroChart;

          console.log(`🎯 Filtering by area: ${selectedArea}`, {
            hasAreaData: !!filteredData.areaSpecificData[selectedArea],
            clientesUnicos: filteredData.clientesUnicos,
            clientFilter: filters.clientName,
          });

          setDashboardData(filteredData);
          // Chart data filtered by client if client filter is active
          setChartData(pieChartData);
          setFormaCobroChartData(formaCobroChartDataUnfiltered);
          setDataLoading(false);
          setIsRefreshing(false);
          return;
        }

        // Intentar obtener datos del caché primero
        const cachedData = dashboardCache.get({
          selectedArea,
          startDate,
          endDate,
        });

        if (cachedData) {
          console.log("📦 Datos cargados desde caché", {
            hasFormaCobroChart: !!cachedData.formaCobroChart,
            formaCobroChartLength: cachedData.formaCobroChart?.length || 0,
          });
          setDashboardData(cachedData);
          // Fetch chart data - filter by client if active, but keep area and formaCobro unfiltered
          if (filters.clientName && USE_MOCK_DATA) {
            // For mock data, use getDashboardData directly
            const pieChartData = getDashboardData(
              "all",
              startDate,
              endDate,
              filters.clientName,
              undefined // Don't filter by formaCobro for area chart
            ).facturacionPorArea;
            setChartData(pieChartData);
            
            // Get forma cobro chart data
            const formaCobroChartDataUnfiltered = getDashboardData(
              filters.area || "all",
              startDate,
              endDate,
              filters.clientName,
              undefined // Don't filter by formaCobro for the chart
            ).formaCobroChart;
            setFormaCobroChartData(formaCobroChartDataUnfiltered);
          } else {
            // Always fetch chart data with "all" to keep chart showing all areas
            if (selectedArea !== "all") {
              const { data: chartDataResponse } =
                await supabase.functions.invoke("dashboard-data", {
                  body: {
                    selectedArea: "all",
                    startDate: startDate
                      ? formatDateLocal(startDate)
                      : undefined,
                    endDate: endDate ? formatDateLocal(endDate) : undefined,
                  },
                });
              if (chartDataResponse) {
                setChartData(chartDataResponse.facturacionPorArea);
                setFormaCobroChartData(chartDataResponse.formaCobroChart);
              }
            } else {
              setChartData(cachedData.facturacionPorArea);
              setFormaCobroChartData(cachedData.formaCobroChart);
            }
          }
          setDataLoading(false);
          setIsRefreshing(false);
          return;
        }

        // Only show full loading skeleton on initial load
        if (isFilterChange) {
          setIsRefreshing(true);
        } else {
          setDataLoading(true);
        }
        console.time("Dashboard Load Time");

        // Call edge function instead of fetching all data client-side
        const { data: edgeFunctionData, error: edgeFunctionError } =
          await supabase.functions.invoke("dashboard-data", {
            body: {
              selectedArea,
              startDate: startDate ? formatDateLocal(startDate) : undefined,
              endDate: endDate ? formatDateLocal(endDate) : undefined,
            },
          });

        if (edgeFunctionError) {
          console.error("Edge function error:", edgeFunctionError);
          throw edgeFunctionError;
        }

        console.log("✅ Datos obtenidos desde edge function");
        setDashboardData(edgeFunctionData);

        // Fetch chart data - filter by client if active, but keep formaCobro unfiltered
        if (filters.clientName && USE_MOCK_DATA) {
          // For mock data, use getDashboardData directly
          const pieChartData = getDashboardData(
            "all",
            startDate,
            endDate,
            filters.clientName,
            undefined // Don't filter by formaCobro for area chart
          ).facturacionPorArea;
          setChartData(pieChartData);
          
          // Get forma cobro chart data
          const formaCobroChartDataUnfiltered = getDashboardData(
            filters.area || "all",
            startDate,
            endDate,
            filters.clientName,
            undefined // Don't filter by formaCobro for the chart
          ).formaCobroChart;
          setFormaCobroChartData(formaCobroChartDataUnfiltered);
        } else {
          // Always fetch chart data with "all" to keep chart showing all areas
          if (selectedArea !== "all") {
            const { data: chartDataResponse } = await supabase.functions.invoke(
              "dashboard-data",
              {
                body: {
                  selectedArea: "all",
                  startDate: startDate ? formatDateLocal(startDate) : undefined,
                  endDate: endDate ? formatDateLocal(endDate) : undefined,
                },
              }
            );
            if (chartDataResponse) {
              setChartData(chartDataResponse.facturacionPorArea);
              setFormaCobroChartData(chartDataResponse.formaCobroChart);
            }
          } else {
            // When "all" is selected, use the same data
            setChartData(edgeFunctionData.facturacionPorArea);
            setFormaCobroChartData(edgeFunctionData.formaCobroChart);
          }
        }

        // Guardar en caché
        dashboardCache.set(edgeFunctionData, {
          selectedArea,
          startDate,
          endDate,
        });

        console.timeEnd("Dashboard Load Time");
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setDataLoading(false);
        setIsRefreshing(false);
      }
    },
    [
      selectedArea,
      startDate,
      endDate,
      filters.area,
      filters.clientName,
      filters.formaCobro,
    ]
  );

  // Track if this is the initial load
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    if (user) {
      const isFilterChange = !isInitialLoadRef.current;
      isInitialLoadRef.current = false;
      fetchDashboardData(isFilterChange);
    }
  }, [user, selectedArea, startDate, endDate, fetchDashboardData]);

  // Fetch clients data
  useEffect(() => {
    if (user && USE_MOCK_DATA) {
      // Fetch clients filtered by area or formaCobro if those filters are active
      const clientCosts = getClientCosts(
        startDate,
        endDate,
        null, // Don't filter by client name here - we want all clients for the table
        filters.area || undefined, // Filter by area if active
        filters.formaCobro || undefined // Filter by formaCobro if active
      );
      const clientsData = clientCosts
        .map((client) => ({
          nombre: client.client_name,
          totalFacturado: client.total_cost,
        }))
        .sort((a, b) => b.totalFacturado - a.totalFacturado);
      setAllClients(clientsData);

      // Calculate revenue by user (top 5) - filter by client or formaCobro if active
      const userRevenue = getRevenueByUser(
        startDate,
        endDate,
        filters.clientName,
        filters.formaCobro
      );
      setAllRevenueByUsers(userRevenue);
    }
  }, [
    user,
    startDate,
    endDate,
    filters.clientName,
    filters.area,
    filters.formaCobro,
  ]);

  // Scroll table to show client #10 on initial load only
  useEffect(() => {
    if (tableScrollRef.current && clients.length >= 10 && isInitialTableLoadRef.current) {
      // Calculate scroll position: each row is approximately h-7 (28px) + border
      // Scroll to show row 10 (index 9) at the top
      const rowHeight = 28; // h-7 = 28px
      const scrollPosition = rowHeight * 9; // Scroll to position of 10th client (index 9)
      tableScrollRef.current.scrollTop = scrollPosition;
      isInitialTableLoadRef.current = false;
    }
  }, [clients]);

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
      title: "Total de horas facturables",
      value: Math.round(
        dashboardData?.totalHorasFacturables || 0
      ).toLocaleString(),
      description: "Total de horas facturables en el período",
      icon: Clock,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    // {
    //   title: "Total Casos",
    //   value: dashboardData?.totalCases || "0",
    //   description: "Total de casos en el sistema",
    //   icon: Briefcase,
    //   color: "text-purple-600",
    //   bgColor: "bg-purple-100",
    // },
    // {
    //   title: "Horas Trabajadas",
    //   value: Math.round(dashboardData?.horasTrabajadas || 0).toLocaleString(),
    //   description: "Total de horas registradas",
    //   icon: Clock,
    //   color: "text-amber-600",
    //   bgColor: "bg-amber-100",
    // },
    {
      title: "Total Facturado",
      value: `$${transformFinalNumber(
        dashboardData?.totalFacturado
      ).toLocaleString()}`,
      description: "Ingresos totales generados",
      icon: DollarSign,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100",
    },
    {
      title: "Tarifa de facturación",
      value: (() => {
        const totalFacturado = transformFinalNumber(dashboardData?.totalFacturado || 0);
        const totalHoras = dashboardData?.totalHorasFacturables || 0;
        if (totalHoras === 0) return "$0/hora";
        const tarifa = totalFacturado / totalHoras;
        return `$${Math.round(tarifa).toLocaleString()}/hora`;
      })(),
      description: "Ingresos promedio por hora facturada",
      icon: DollarSign,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    // {
    //   title: "Meta de Facturación",
    //   value: `$${(dashboardData?.metaFacturacion || 0).toLocaleString()}`,
    //   description: "Meta de facturación para el período",
    //   icon: TrendingUp,
    //   color: "text-purple-600",
    //   bgColor: "bg-purple-100",
    // },
    // {
    //   title: "Casos Cerrados",
    //   value: dashboardData?.casosInactivos || "0",
    //   description: "Casos finalizados",
    //   icon: TrendingUp,
    //   color: "text-indigo-600",
    //   bgColor: "bg-indigo-100",
    // },
  ];

  const baseFacturacionData =
    chartData || dashboardData?.facturacionPorArea || [];

  // Filter out segments with 0% or very small percentages, and transform data
  const totalFacturacion = baseFacturacionData.reduce(
    (sum: number, item: any) =>
      sum + (transformFinalNumber(item.facturacion) || 0),
    0
  );

  // Transform and calculate percentages
  const transformedData = baseFacturacionData
    .map((item: any) => ({
      ...item,
      facturacion: transformFinalNumber(item.facturacion),
      meta: transformFinalNumber(item.meta),
      // Ensure color is set - use existing color or get from getAreaColor
      color: item.color || getAreaColor(item.area),
    }))
    .filter((item: any) => {
      // Filter out segments with 0% or less than 0.5% of total
      const percent =
        totalFacturacion > 0 ? (item.facturacion / totalFacturacion) * 100 : 0;
      return percent >= 0.5;
    });

  // Colors for pie charts - tones of primary color (matching Top20Clientes)
  const PRIMARY_COLORS = [
    "hsl(210 55% 23%)", // Base primary (darkest)
    "hsl(210 55% 35%)", // Medium-dark
    "hsl(210 55% 47%)", // Medium
    "hsl(210 55% 59%)", // Medium-light
    "hsl(210 55% 71%)", // Light
  ];

  // Group small categories (< 2%) into "Other" to prevent label overlap
  const SMALL_THRESHOLD = 2; // Percentage threshold
  const mainCategories: any[] = [];
  const smallCategories: any[] = [];
  let otherTotal = 0;
  const otherAreas: string[] = [];

  transformedData.forEach((item: any) => {
    const percent =
      totalFacturacion > 0 ? (item.facturacion / totalFacturacion) * 100 : 0;
    if (percent >= SMALL_THRESHOLD) {
      mainCategories.push(item);
    } else {
      smallCategories.push(item);
      otherTotal += item.facturacion;
      otherAreas.push(item.area);
    }
  });

  // Sort main categories by facturacion descending
  mainCategories.sort((a: any, b: any) => b.facturacion - a.facturacion);

  // Add "Other" category if there are small categories
  const transformedFacturacionData = [...mainCategories];
  if (smallCategories.length > 0 && otherTotal > 0) {
    transformedFacturacionData.push({
      area: `Otros (${smallCategories.length})`,
      facturacion: otherTotal,
      meta: smallCategories.reduce((sum: number, item: any) => sum + (item.meta || 0), 0),
      color: PRIMARY_COLORS[PRIMARY_COLORS.length - 1], // Use lightest color for "Other"
      originalAreas: otherAreas, // Store original areas for tooltip
    });
  }
  // Process Forma de Cobro chart data with grouping for small categories
  // Use formaCobroChartData if available (unfiltered), otherwise fall back to dashboardData
  const formaCobroData = (formaCobroChartData || dashboardData?.formaCobroChart || []).map(
    (item: any) => ({
      ...item,
      value: transformFinalNumber(item.value),
    })
  );

  // Group small Forma de Cobro categories (< 2%) into "Other"
  const formaCobroTotal = formaCobroData.reduce(
    (sum: number, item: any) => sum + (item.value || 0),
    0
  );

  const formaCobroMain: any[] = [];
  const formaCobroSmall: any[] = [];
  let formaCobroOtherTotal = 0;
  const formaCobroOtherNames: string[] = [];

  formaCobroData.forEach((item: any) => {
    const percent =
      formaCobroTotal > 0 ? (item.value / formaCobroTotal) * 100 : 0;
    if (percent >= SMALL_THRESHOLD) {
      formaCobroMain.push(item);
    } else {
      formaCobroSmall.push(item);
      formaCobroOtherTotal += item.value;
      formaCobroOtherNames.push(item.name);
    }
  });

  // Sort main categories by value descending
  formaCobroMain.sort((a: any, b: any) => b.value - a.value);

  // Add "Other" category if there are small categories
  const transformedFormaCobroChart = [...formaCobroMain];
  if (formaCobroSmall.length > 0 && formaCobroOtherTotal > 0) {
    transformedFormaCobroChart.push({
      name: `Otros (${formaCobroSmall.length})`,
      value: formaCobroOtherTotal,
      originalNames: formaCobroOtherNames, // Store original names for tooltip
    });
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 w-full min-w-0 max-w-full overflow-x-hidden">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-foreground">
                  Resumen de Facturación
                </h1>
                {isRefreshing && (
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1.5"
                  >
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Actualizando...
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground">
                Resumen de facturación para el período y área seleccionada
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
              <Select
                value={filters.area || "all"}
                onValueChange={(value) =>
                  setAreaFilter(value === "all" ? null : value)
                }
              >
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

        {/* Active Filters */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground">
              Filtros activos:
            </span>
            {filters.area && (
              <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-sm">
                <span>Área: {filters.area}</span>
                <button
                  onClick={() => setAreaFilter(null)}
                  className="ml-1 hover:bg-primary/20 rounded p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {filters.clientName && (
              <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-sm">
                <span>Cliente: {filters.clientName}</span>
                <button
                  onClick={() => setClientFilter(null)}
                  className="ml-1 hover:bg-primary/20 rounded p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {filters.formaCobro && (
              <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-sm">
                <span>Forma de Cobro: {filters.formaCobro}</span>
                <button
                  onClick={() => setFormaCobroFilter(null)}
                  className="ml-1 hover:bg-primary/20 rounded p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-8 text-xs"
            >
              Limpiar filtros
            </Button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="relative">
          {/* Loading Overlay */}
          {isRefreshing && (
            <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] z-10 rounded-lg flex items-center justify-center pointer-events-none">
              <div className="flex flex-col items-center gap-2 bg-background/90 px-4 py-2 rounded-lg border shadow-sm">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Actualizando...</p>
              </div>
            </div>
          )}
          <div
            className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 transition-opacity duration-200 ${
              isRefreshing ? "opacity-60" : "opacity-100"
            }`}
          >
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
        </div>

        {/* Clients Table, Bar Chart, and Pie Charts */}
        <div
          className={`flex flex-col gap-4 transition-opacity duration-200 min-w-0 ${
            isRefreshing ? "opacity-60" : "opacity-100"
          }`}
        >
          {/* Row 1: Todos los Clientes Table and Facturación por Área Chart */}
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Clients Table */}
            <Card className="flex-1 border-border/50 w-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground">
                Todos los Clientes
              </CardTitle>
              <CardDescription>
                Lista completa de clientes ordenados por facturación
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div
                ref={tableScrollRef}
                className="overflow-y-auto rounded-md"
                style={{ height: "300px" }}
              >
                <Table>
                  <TableHeader>
                    <TableRow className="border-b">
                      <TableHead className="h-8 px-1 text-[10px] font-semibold w-[15px]">
                        #
                      </TableHead>
                      <TableHead className="h-8 px-1 text-[10px] font-semibold">
                        Nombre
                      </TableHead>
                      <TableHead className="h-8 px-1 text-[10px] font-semibold text-right">
                        Facturación
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map((client, index) => {
                      const isActive = filters.clientName === client.nombre;
                      return (
                        <TableRow
                          key={client.nombre}
                          className={`border-b h-7 transition-all duration-200 cursor-pointer ${
                            isActive 
                              ? "bg-primary/15 border-primary/40 hover:bg-primary/20" 
                              : "hover:bg-muted/50"
                          }`}
                          onClick={() => {
                            // Toggle filter: if already selected, deselect it
                            if (isActive) {
                              setClientFilter(null);
                            } else {
                              setClientFilter(client.nombre);
                            }
                          }}
                        >
                          <TableCell className={`px-1 py-0.5 text-[11px] font-medium ${
                            isActive ? "text-primary font-semibold" : ""
                          }`}>
                            {index + 1}
                          </TableCell>
                          <TableCell className={`px-1 py-0.5 text-[11px] truncate max-w-[200px] ${
                            isActive ? "text-primary font-semibold" : ""
                          }`}>
                            {client.nombre}
                          </TableCell>
                          <TableCell className={`px-1 py-0.5 text-[11px] text-right font-medium ${
                            isActive ? "text-primary font-semibold" : "text-emerald-600"
                          }`}>
                            $
                            {Math.round(client.totalFacturado).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

            {/* Facturación por Área Pie Chart */}
            <div className="w-full lg:w-[500px] lg:flex-shrink-0">
              <div className="bg-muted/30 rounded-lg p-4 border transition-all duration-300 h-full flex flex-col">
                <h3 className="text-sm font-semibold mb-3 text-foreground">
                  Facturación por Área
                </h3>
                {transformedFacturacionData &&
                transformedFacturacionData.length > 0 ? (
                  <ChartContainer
                    config={{
                      facturacion: {
                        label: "Facturación",
                      },
                    }}
                  >
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={transformedFacturacionData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent, payload }) => {
                            // Only show labels for slices >= 2% to prevent overlap
                            const slicePercent = (percent * 100);
                            if (slicePercent >= 2) {
                              return `${name}: ${slicePercent.toFixed(0)}%`;
                            }
                            return ""; // Hide labels for very small slices
                          }}
                          outerRadius={70}
                          fill="#8884d8"
                          dataKey="facturacion"
                          nameKey="area"
                          onClick={(data) => {
                            if (data?.area && !data.area.startsWith("Otros")) {
                              // Don't allow filtering by "Other" category
                              if (filters.area === data.area) {
                                setAreaFilter(null);
                              } else {
                                setAreaFilter(data.area);
                              }
                            }
                          }}
                          style={{ cursor: "pointer" }}
                        >
                          {transformedFacturacionData.map(
                            (entry: any, index: number) => {
                              const isActive = filters.area === entry.area;
                              const isOtherCategory = entry.area?.startsWith("Otros");
                              // Use PRIMARY_COLORS like Top20Clientes
                              const baseColor =
                                PRIMARY_COLORS[index % PRIMARY_COLORS.length];
                              // Make active slice brighter and add visual cues
                              const fillColor = isActive
                                ? baseColor.replace(
                                    /hsl\(([^)]+)\)/,
                                    (match, content) => {
                                      return `hsl(${content.replace(
                                        /\d+%\)/,
                                        "75%)"
                                      )}`;
                                    }
                                  )
                                : baseColor;
                              return (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={fillColor}
                                  fillOpacity={isActive ? 1 : 0.85}
                                  stroke={isActive ? "#000" : "none"}
                                  strokeWidth={isActive ? 3 : 0}
                                  style={{ 
                                    cursor: isOtherCategory ? "default" : "pointer",
                                    filter: isActive ? "drop-shadow(0 0 4px rgba(0,0,0,0.3))" : "none"
                                  }}
                                />
                              );
                            }
                          )}
                        </Pie>
                        <ChartTooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const total = transformedFacturacionData.reduce(
                                (sum: number, item: any) =>
                                  sum + (item.facturacion || 0),
                                0
                              );
                              const percent = (
                                (Number(payload[0].value) / total) *
                                100
                              ).toFixed(1);
                              const entry = payload[0].payload;
                              
                              // If it's the "Other" category, show breakdown
                              if (entry.originalAreas && entry.originalAreas.length > 0) {
                                return (
                                  <div className="rounded-lg border bg-background p-2 shadow-sm">
                                    <div className="flex flex-col gap-1">
                                      <span className="text-sm font-medium">
                                        {entry.area}
                                      </span>
                                      <span className="text-sm text-muted-foreground">
                                        ${Number(payload[0].value).toLocaleString()}{" "}
                                        ({percent}%)
                                      </span>
                                      <div className="mt-2 pt-2 border-t border-border">
                                        <span className="text-xs text-muted-foreground">
                                          Incluye: {entry.originalAreas.join(", ")}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                              
                              return (
                                <div className="rounded-lg border bg-background p-2 shadow-sm">
                                  <div className="flex flex-col gap-1">
                                    <span className="text-sm font-medium">
                                      {entry.area}
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                      ${Number(payload[0].value).toLocaleString()}{" "}
                                      ({percent}%)
                                    </span>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
                    No hay datos disponibles
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Facturación por Encargado Comercial and Facturación según Forma de Cobro */}
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Facturación por Encargado Comercial Bar Chart */}
            {revenueByUsers && revenueByUsers.length > 0 && (
              <Card className="flex-1 border-border/50 w-full min-w-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-foreground">
                    Facturación por Encargado Comercial
                  </CardTitle>
                  <CardDescription>
                    Encargados comerciales con mayor facturación en el período
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 pb-0 px-0 min-w-0">
                  <div className="w-full min-w-0">
                    <ChartContainer
                      config={{
                        revenue: {
                          label: "Facturación",
                        },
                      }}
                      className="w-full min-w-0"
                    >
                      <ResponsiveContainer width="100%" height={200} minWidth={0}>
                      <BarChart
                        data={revenueByUsers.map((user) => ({
                          name: user.user_name,
                          code: user.user_code,
                          revenue: transformFinalNumber(user.revenue),
                        }))}
                        margin={{ top: 10, right: 10, left: 0, bottom: 50 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          width={50}
                          tickFormatter={(value) => {
                            const millions = value / 1000000;
                            return millions % 1 === 0
                              ? `$${millions}M`
                              : `$${millions.toFixed(1)}M`;
                          }}
                        />
                        <ChartTooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="rounded-lg border bg-background p-2 shadow-sm">
                                  <div className="flex flex-col gap-1">
                                    <span className="text-sm font-medium">
                                      {payload[0].payload.name}
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                      $
                                      {Number(
                                        payload[0].value
                                      ).toLocaleString()}
                                    </span>
                                    <span className="text-xs text-muted-foreground mt-1">
                                      Haz clic para ver perfil
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
                          fill="hsl(210 55% 47%)"
                          radius={[4, 4, 0, 0]}
                        >
                          {revenueByUsers.map((user, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill="hsl(210 55% 47%)"
                              style={{ cursor: "pointer" }}
                              onClick={() => {
                                // Pass date filters as query params
                                const params = new URLSearchParams();
                                if (startDate) {
                                  params.set(
                                    "startDate",
                                    startDate.toISOString()
                                  );
                                }
                                if (endDate) {
                                  params.set("endDate", endDate.toISOString());
                                }
                                const queryString = params.toString();
                                navigate(
                                  `/user/${user.user_code}${
                                    queryString ? `?${queryString}` : ""
                                  }`
                                );
                              }}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Forma de Cobro Distribution */}
            {transformedFormaCobroChart &&
              transformedFormaCobroChart.length > 0 && (
                <div className="w-full lg:w-[500px] lg:flex-shrink-0">
                  <div className="bg-muted/30 rounded-lg p-4 border transition-all duration-300 h-full flex flex-col">
                    <h3 className="text-sm font-semibold mb-3 text-foreground">
                      Facturación según Forma de Cobro
                    </h3>
                    <ChartContainer
                      config={{
                        facturacionByFeeType: {
                          label: "Facturación por Forma de Cobro",
                        },
                      }}
                    >
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                        <Pie
                          data={transformedFormaCobroChart}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => {
                            // Only show labels for slices >= 2% to prevent overlap
                            const slicePercent = (percent * 100);
                            if (slicePercent >= 2) {
                              return `${name}: ${slicePercent.toFixed(0)}%`;
                            }
                            return ""; // Hide labels for very small slices
                          }}
                          outerRadius={70}
                          fill="#8884d8"
                          dataKey="value"
                          nameKey="name"
                          onClick={(data) => {
                            if (data?.name && !data.name.startsWith("Otros")) {
                              // Don't allow filtering by "Other" category
                              if (filters.formaCobro === data.name) {
                                setFormaCobroFilter(null);
                              } else {
                                setFormaCobroFilter(data.name);
                              }
                            }
                          }}
                          style={{ cursor: "pointer" }}
                        >
                          {transformedFormaCobroChart.map(
                            (entry: any, index: number) => {
                              const isActive =
                                filters.formaCobro === entry.name;
                              const isOtherCategory = entry.name?.startsWith("Otros");
                              const baseColor =
                                PRIMARY_COLORS[
                                  index % PRIMARY_COLORS.length
                                ];
                              // Make active slice brighter and add visual cues
                              const fillColor = isActive
                                ? baseColor.replace(
                                    /hsl\(([^)]+)\)/,
                                    (match, content) => {
                                      return `hsl(${content.replace(
                                        /\d+%\)/,
                                        "75%)"
                                      )}`;
                                    }
                                  )
                                : baseColor;
                              return (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={fillColor}
                                  fillOpacity={isActive ? 1 : 0.85}
                                  stroke={isActive ? "#000" : "none"}
                                  strokeWidth={isActive ? 3 : 0}
                                  style={{ 
                                    cursor: isOtherCategory ? "default" : "pointer",
                                    filter: isActive ? "drop-shadow(0 0 4px rgba(0,0,0,0.3))" : "none"
                                  }}
                                />
                              );
                            }
                          )}
                        </Pie>
                        <ChartTooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const total = transformedFormaCobroChart.reduce(
                                (sum: number, item: { value: number }) =>
                                  sum + item.value,
                                0
                              );
                              const percent = (
                                (Number(payload[0].value) / total) *
                                100
                              ).toFixed(1);
                              const entry = payload[0].payload;
                              
                              // If it's the "Other" category, show breakdown
                              if (entry.originalNames && entry.originalNames.length > 0) {
                                return (
                                  <div className="rounded-lg border bg-background p-2 shadow-sm">
                                    <div className="flex flex-col gap-1">
                                      <span className="text-sm font-medium">
                                        {entry.name}
                                      </span>
                                      <span className="text-sm text-muted-foreground">
                                        ${Number(payload[0].value).toLocaleString()}{" "}
                                        ({percent}%)
                                      </span>
                                      <div className="mt-2 pt-2 border-t border-border">
                                        <span className="text-xs text-muted-foreground">
                                          Incluye: {entry.originalNames.join(", ")}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                              
                              return (
                                <div className="rounded-lg border bg-background p-2 shadow-sm">
                                  <div className="flex flex-col gap-1">
                                    <span className="text-sm font-medium">
                                      {entry.name}
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                      ${Number(payload[0].value).toLocaleString()}{" "}
                                      ({percent}%)
                                    </span>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

const Facturacion = () => {
  return (
    <FacturacionFiltersProvider>
      <FacturacionContent />
    </FacturacionFiltersProvider>
  );
};

export default Facturacion;
