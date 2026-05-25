import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
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
  X,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getAreaColor, AREAS_PROFESIONALES } from "@/lib/constants";
import { getChartColor } from "@/lib/chartColors";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { dashboardCache } from "@/lib/dashboardCache";
import { Button } from "@/components/ui/button";
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
import facturacionData from "@/lib/mock/facturacion.json";
import clientesData from "@/lib/mock/clientes.json";
import { formatDateLocal } from "@/lib/utils";
import {
  FacturacionFiltersProvider,
  useFacturacionFilters,
} from "@/hooks/useFacturacionFilters";
import { useDateFilter, DateFilterProvider } from "@/hooks/useDateFilter";
import ChartInfoModal from "@/components/ChartInfoModal";

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
    setEncargadoFilter,
    setIndustryFilter,
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
  const [industryChartData, setIndustryChartData] = useState<
    Array<{ name: string; value: number }>
  >([]);
  const [industryClients, setIndustryClients] = useState<Record<string, string[]>>({});
  const [allRevenueByUsers, setAllRevenueByUsers] = useState<
    Array<{ user_name: string; user_code: string; revenue: number }>
  >([]);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const isInitialTableLoadRef = useRef(true);
  const { startDate, endDate } = useDateFilter();

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
          const encargadoCode = filters.encargado?.code || undefined;
          const allAreasData = getDashboardData("all", startDate, endDate, undefined, undefined, encargadoCode);
          const filteredData = getDashboardData(
            selectedArea,
            startDate,
            endDate,
            filters.clientName,
            filters.formaCobro,
            encargadoCode
          );

          // Get pie chart data - filter by client and encargado if active
          // But keep formaCobro unfiltered for the chart (only filter by client, not formaCobro)
          const pieChartData =
            filters.clientName || encargadoCode
              ? getDashboardData(
                  "all",
                  startDate,
                  endDate,
                  filters.clientName,
                  undefined, // Don't filter by formaCobro for the area chart
                  encargadoCode
                ).facturacionPorArea
              : allAreasData.facturacionPorArea;

          // Get forma cobro chart data - filter by client, area, or encargado if active
          // But keep formaCobro unfiltered for the chart
          const formaCobroChartDataUnfiltered =
            filters.clientName || filters.area || encargadoCode
              ? getDashboardData(
                  filters.area || "all",
                  startDate,
                  endDate,
                  filters.clientName,
                  undefined, // Don't filter by formaCobro for the chart
                  encargadoCode
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
      filters.encargado?.code,
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
      // Fetch clients filtered by area, formaCobro, or encargado if those filters are active
      const clientCosts = getClientCosts(
        startDate,
        endDate,
        null, // Don't filter by client name here - we want all clients for the table
        filters.area || undefined, // Filter by area if active
        filters.formaCobro || undefined, // Filter by formaCobro if active
        filters.encargado?.code || undefined // Filter by encargado if active
      );
      const filteredByIndustry = filters.industry
        ? clientCosts.filter((c) => (c.industry || "Otros") === filters.industry)
        : clientCosts;

      // Build revenue map per client from facturacion.json (real billed amounts)
      const clienteNameToIdMap = new Map<string, number>();
      (clientesData as Array<{ id: number; name: string }>).forEach((c) => {
        clienteNameToIdMap.set(c.name, c.id);
      });
      const revenueByClientName = new Map<string, number>();
      (facturacionData as Array<{ cliente_id: number; month: string; amount_charged: number }>).forEach((p) => {
        if (!p.month || !p.cliente_id) return;
        const [m, d, y] = p.month.split("/").map(Number);
        if (!m || !d || !y) return;
        const date = new Date(y, m - 1, d);
        if (startDate && date < new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())) return;
        if (endDate && date > new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())) return;
        const cliente = (clientesData as Array<{ id: number; name: string }>).find((c) => c.id === p.cliente_id);
        if (!cliente) return;
        revenueByClientName.set(
          cliente.name,
          (revenueByClientName.get(cliente.name) || 0) + (p.amount_charged || 0),
        );
      });

      const clientsData = filteredByIndustry
        .map((client) => ({
          nombre: client.client_name,
          totalFacturado: revenueByClientName.get(client.client_name) ?? client.total_cost,
        }))
        .sort((a, b) => b.totalFacturado - a.totalFacturado);
      setAllClients(clientsData);

      // Aggregate revenue by industry and collect client names per industry
      const industryMap = new Map<string, number>();
      const industryClientMap = new Map<string, string[]>();
      clientCosts.forEach((client) => {
        const industry = client.industry || "Otros";
        const clientRevenue = revenueByClientName.get(client.client_name) ?? client.total_cost;
        industryMap.set(industry, (industryMap.get(industry) || 0) + clientRevenue);
        const existing = industryClientMap.get(industry) || [];
        existing.push(client.client_name);
        industryClientMap.set(industry, existing);
      });
      const industryData = Array.from(industryMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
      // Keep top 8 and group the rest as "Otros"
      const topIndustries = industryData.slice(0, 8);
      const othersValue = industryData.slice(8).reduce((sum, item) => sum + item.value, 0);
      if (othersValue > 0) {
        const othersClients = industryData.slice(8).flatMap((d) => industryClientMap.get(d.name) || []);
        industryClientMap.set("Otros", othersClients);
        topIndustries.push({ name: "Otros", value: othersValue });
      }
      setIndustryChartData(topIndustries);
      setIndustryClients(Object.fromEntries(industryClientMap));

      // Reset table scroll to top when filters change (not on initial load)
      if (!isInitialTableLoadRef.current && tableScrollRef.current) {
        tableScrollRef.current.scrollTop = 0;
      }

      // Calculate revenue by user (top 5) - filter by client, formaCobro, or encargado if active
      // Don't filter by encargado here so the chart shows all users for cross-filtering
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
    filters.encargado?.code,
    filters.industry,
  ]);

  // Mark initial load as complete once data is ready and table is visible
  useEffect(() => {
    if (!dataLoading && clients.length > 0 && isInitialTableLoadRef.current) {
      isInitialTableLoadRef.current = false;
    }
  }, [clients, dataLoading]);

  if (loading || dataLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16" />
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

  // Colors for pie charts - tones of primary color via CSS variables

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
      color: getChartColor(9), // Use lightest color for "Other"
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
      <div className="space-y-2 w-full min-w-0 max-w-full overflow-x-hidden">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-foreground">
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
            {filters.encargado && (
              <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-sm">
                <span>Encargado: {filters.encargado.name}</span>
                <button
                  onClick={() => setEncargadoFilter(null)}
                  className="ml-1 hover:bg-primary/20 rounded p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {filters.industry && (
              <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-sm">
                <span>Industria: {filters.industry}</span>
                <button
                  onClick={() => setIndustryFilter(null)}
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
            className={`grid grid-cols-1 md:grid-cols-3 gap-3 transition-opacity duration-200 ${
              isRefreshing ? "opacity-60" : "opacity-100"
            }`}
          >
            {stats.map((stat) => (
              <Card
                key={stat.title}
                className="border-border/50 hover:shadow-md transition-shadow"
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`${stat.bgColor} p-1.5 rounded-md`}>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground truncate">
                      {stat.title}
                    </p>
                    <div className="text-lg font-bold text-foreground">
                      {stat.value}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Clients Table, Bar Chart, and Pie Charts */}
        <div
          className={`flex flex-col gap-3 transition-opacity duration-200 min-w-0 ${
            isRefreshing ? "opacity-60" : "opacity-100"
          }`}
        >
          {/* Row 1: Todos los Clientes Table and Facturación por Área Chart */}
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Clients Table */}
            <Card className="flex-1 border-border/50 w-full">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-sm text-foreground">
                Todos los Clientes
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-3 pb-2">
              <div
                ref={tableScrollRef}
                className="overflow-y-auto rounded-md"
                style={{ height: "280px", overflowAnchor: "none" as const }}
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
            <div className="w-full lg:w-[450px] lg:flex-shrink-0">
              <div className="bg-muted/30 rounded-lg p-3 border transition-all duration-300 h-full flex flex-col">
                <ChartInfoModal
                  title="Facturación por Área"
                  info="Distribución de la facturación total según el área profesional. Haz clic en una sección para filtrar."
                  data={(transformedFacturacionData || []).map((d: { area: string; facturacion: number }) => ({ name: d.area, value: d.facturacion }))}
                  unit="$"
                  className="mb-1"
                />
                {transformedFacturacionData &&
                transformedFacturacionData.length > 0 ? (
                  <ChartContainer
                    config={{
                      facturacion: {
                        label: "Facturación",
                      },
                    }}
                  >
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={transformedFacturacionData}
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          fill="hsl(var(--chart-5))"
                          dataKey="facturacion"
                          nameKey="area"
                          label={({ cx, cy, midAngle, outerRadius, index }) => {
                            const RADIAN = Math.PI / 180;
                            const radius = outerRadius + 20;
                            const x = cx + radius * Math.cos(-midAngle * RADIAN);
                            const y = cy + radius * Math.sin(-midAngle * RADIAN);
                            const entry = transformedFacturacionData[index];
                            const total = transformedFacturacionData.reduce(
                              (s: number, d: { facturacion: number }) => s + d.facturacion, 0
                            );
                            const pct = total > 0 ? ((entry.facturacion / total) * 100).toFixed(0) : "0";
                            return (
                              <text
                                x={x}
                                y={y}
                                textAnchor={x > cx ? "start" : "end"}
                                dominantBaseline="central"
                                className="fill-foreground"
                                fontSize={10}
                              >
                                {entry.area}: {pct}%
                              </text>
                            );
                          }}
                          labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
                          onClick={(data) => {
                            if (data?.area && !data.area.startsWith("Otros")) {
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
                            (entry: { area: string }, index: number) => {
                              const isActive = filters.area === entry.area;
                              const isOtherCategory = entry.area?.startsWith("Otros");
                              return (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={getChartColor(index)}
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
                  <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
                    No hay datos disponibles
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Row 2: Facturación por Encargado Comercial and Facturación según Forma de Cobro */}
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Facturación por Encargado Comercial Bar Chart */}
            {revenueByUsers && revenueByUsers.length > 0 && (
              <Card className="flex-1 border-border/50 w-full min-w-0">
                <CardHeader className="pb-1 pt-3 px-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm text-foreground">
                      Facturación por Encargado Comercial
                    </CardTitle>
                    {filters.encargado && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs gap-1.5"
                        onClick={() => {
                          const params = new URLSearchParams();
                          if (startDate) params.set("startDate", startDate.toISOString());
                          if (endDate) params.set("endDate", endDate.toISOString());
                          const queryString = params.toString();
                          navigate(`/user/${filters.encargado!.code}${queryString ? `?${queryString}` : ""}`);
                        }}
                      >
                        <Users className="h-3 w-3" />
                        Ver perfil de {filters.encargado.name}
                      </Button>
                    )}
                  </div>
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
                      <ResponsiveContainer width="100%" height={190} minWidth={0}>
                      <BarChart
                        data={revenueByUsers.map((user) => ({
                          name: user.user_name,
                          code: user.user_code,
                          revenue: transformFinalNumber(user.revenue),
                        }))}
                        margin={{ top: 5, right: 10, left: 0, bottom: 45 }}
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
                                      Haz clic para filtrar
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
                          fill="hsl(var(--chart-5))"
                          radius={[4, 4, 0, 0]}
                        >
                          {revenueByUsers.map((user, index) => {
                            const isActive = filters.encargado?.code === user.user_code;
                            return (
                              <Cell
                                key={`cell-${index}`}
                                fill="hsl(var(--chart-5))"
                                fillOpacity={isActive ? 1 : 0.85}
                                stroke={isActive ? "#000" : "none"}
                                strokeWidth={isActive ? 2 : 0}
                                style={{
                                  cursor: "pointer",
                                  filter: isActive ? "drop-shadow(0 0 4px rgba(0,0,0,0.3))" : "none",
                                }}
                                onClick={() => {
                                  setEncargadoFilter({
                                    code: user.user_code,
                                    name: user.user_name,
                                  });
                                }}
                              />
                            );
                          })}
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
                <div className="w-full lg:w-[450px] lg:flex-shrink-0">
                  <div className="bg-muted/30 rounded-lg p-3 border transition-all duration-300 h-full flex flex-col">
                    <ChartInfoModal
                      title="Facturación según Forma de Cobro"
                      info="Distribución de la facturación según la forma de cobro del cliente. Haz clic en una sección para filtrar."
                      data={transformedFormaCobroChart || []}
                      unit="$"
                      className="mb-1"
                    />
                    <ChartContainer
                      config={{
                        facturacionByFeeType: {
                          label: "Facturación por Forma de Cobro",
                        },
                      }}
                    >
                      <ResponsiveContainer width="100%" height={190}>
                        <PieChart>
                        <Pie
                          data={transformedFormaCobroChart}
                          cx="50%"
                          cy="50%"
                          outerRadius={55}
                          fill="hsl(var(--chart-5))"
                          dataKey="value"
                          nameKey="name"
                          label={({ cx, cy, midAngle, outerRadius, index }) => {
                            const RADIAN = Math.PI / 180;
                            const radius = outerRadius + 18;
                            const x = cx + radius * Math.cos(-midAngle * RADIAN);
                            const y = cy + radius * Math.sin(-midAngle * RADIAN);
                            const entry = transformedFormaCobroChart[index];
                            const total = transformedFormaCobroChart.reduce(
                              (s: number, d: { value: number }) => s + d.value, 0
                            );
                            const pct = total > 0 ? ((entry.value / total) * 100).toFixed(0) : "0";
                            return (
                              <text
                                x={x}
                                y={y}
                                textAnchor={x > cx ? "start" : "end"}
                                dominantBaseline="central"
                                className="fill-foreground"
                                fontSize={10}
                              >
                                {entry.name}: {pct}%
                              </text>
                            );
                          }}
                          labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
                          onClick={(data) => {
                            if (data?.name && !data.name.startsWith("Otros")) {
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
                            (entry: { name: string }, index: number) => {
                              const isActive = filters.formaCobro === entry.name;
                              const isOtherCategory = entry.name?.startsWith("Otros");
                              return (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={getChartColor(index)}
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

          {/* Row 3: Facturación por Industria */}
          <div className="flex flex-col lg:flex-row gap-3">
          {industryChartData && industryChartData.length > 0 && (
            <div className="w-full lg:w-[450px] lg:flex-shrink-0">
              <div className="bg-muted/30 rounded-lg p-3 border transition-all duration-300 h-full flex flex-col">
                <ChartInfoModal
                  title="Facturación por Industria"
                  info="Distribución de la facturación según la industria de los clientes. Haz clic en una industria para ver los clientes que la componen."
                  data={industryChartData || []}
                  unit="$"
                  className="mb-1"
                  details={industryClients}
                  detailLabel="Clientes"
                />
                <ChartContainer
                  config={{
                    facturacionByIndustry: {
                      label: "Facturación por Industria",
                    },
                  }}
                >
                  <ResponsiveContainer width="100%" height={190}>
                    <PieChart>
                      <Pie
                        data={industryChartData}
                        cx="50%"
                        cy="50%"
                        outerRadius={55}
                        fill="hsl(var(--chart-3))"
                        dataKey="value"
                        nameKey="name"
                        label={({ cx, cy, midAngle, outerRadius, index }) => {
                          const RADIAN = Math.PI / 180;
                          const radius = outerRadius + 18;
                          const x = cx + radius * Math.cos(-midAngle * RADIAN);
                          const y = cy + radius * Math.sin(-midAngle * RADIAN);
                          const entry = industryChartData[index];
                          const total = industryChartData.reduce(
                            (s, d) => s + d.value, 0
                          );
                          const pct = total > 0 ? ((entry.value / total) * 100).toFixed(0) : "0";
                          return (
                            <text
                              x={x}
                              y={y}
                              textAnchor={x > cx ? "start" : "end"}
                              dominantBaseline="central"
                              className="fill-foreground"
                              fontSize={10}
                            >
                              {entry.name}: {pct}%
                            </text>
                          );
                        }}
                        labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
                        onClick={(data: { name: string }) => {
                          if (data?.name && !data.name.startsWith("Otros")) {
                            if (filters.industry === data.name) {
                              setIndustryFilter(null);
                            } else {
                              setIndustryFilter(data.name);
                            }
                          }
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        {industryChartData.map(
                          (entry, index: number) => {
                            const isActive = filters.industry === entry.name;
                            const isOtherCategory = entry.name?.startsWith("Otros");
                            return (
                              <Cell
                                key={`cell-industry-${index}`}
                                fill={getChartColor(index)}
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
                            const total = industryChartData.reduce(
                              (sum, item) => sum + item.value,
                              0
                            );
                            const percent = (
                              (Number(payload[0].value) / total) *
                              100
                            ).toFixed(1);
                            return (
                              <div className="rounded-lg border bg-background p-2 shadow-sm">
                                <div className="flex flex-col gap-1">
                                  <span className="text-sm font-medium">
                                    {payload[0].payload.name}
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
    <DateFilterProvider>
      <FacturacionFiltersProvider>
        <FacturacionContent />
      </FacturacionFiltersProvider>
    </DateFilterProvider>
  );
};

export default Facturacion;
