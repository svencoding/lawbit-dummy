import { useEffect, useState, useCallback, useRef } from "react";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  Search,
  DollarSign,
  FileText,
  TrendingUp,
  Calendar as CalendarIcon,
  ArrowUpDown,
  X,
  Clock,
  Loader2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getAreaColor } from "@/lib/constants";
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
  Area,
  AreaChart,
  Pie,
  PieChart,
  Cell,
} from "recharts";
import mockClientesData from "@/lib/mockClientesData.json";

// Set to true to use mock data for presentations (no database calls)
const USE_MOCK_DATA = true;

interface ClientSummary {
  nombre: string;
  totalFacturado: number;
  totalFacturas: number;
  ultimaFactura: string | null;
  primeraFactura: string | null;
  facturasPagadas: number;
  facturasPendientes: number;
  horasTrabajadas: number;
}

type SortField =
  | "nombre"
  | "totalFacturado"
  | "totalFacturas"
  | "ultimaFactura";
type SortOrder = "asc" | "desc";

const getMaskedClientName = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }

  const randomNumber = (Math.abs(hash) % 9000) + 1000;
  // return `Cliente ${randomNumber}`;
  return name;
};

const transformDisplayNumber = (value: number | null | undefined) => {
  if (value === null || value === undefined) {
    return 0;
  }

  const transformed = Math.round((value / 50000) * 72);
  if (!Number.isFinite(transformed)) {
    return 0;
  }

  // return transformed;
  // Ensure value is never negative
  return Math.max(0, value);
};

const getRoundedTableNumber = (value: number | null | undefined) => {
  // Ensure value is never negative before rounding
  return Math.round(Math.max(0, transformDisplayNumber(value)));
};

const Clientes = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [filteredClients, setFilteredClients] = useState<ClientSummary[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClientForDialog, setSelectedClientForDialog] =
    useState<ClientSummary | null>(null);
  const [clientDetails, setClientDetails] = useState<any>(null);
  const [sortField, setSortField] = useState<SortField>("totalFacturado");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [selectedClientFilter, setSelectedClientFilter] =
    useState<string>("all");
  const [overallRevenueChart, setOverallRevenueChart] = useState<
    { month: string; revenue: number }[]
  >([]);
  const [areasChart, setAreasChart] = useState<
    { name: string; value: number; color: string }[]
  >([]);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [startDate, setStartDate] = useState<Date | undefined>(
    new Date(2025, 0, 1)
  ); // 1/1/2025
  const [endDate, setEndDate] = useState<Date | undefined>(
    new Date(2025, 8, 30)
  ); // 30/9/2025
  const [filteredMetrics, setFilteredMetrics] = useState({
    totalRevenue: 0,
    promedioDiasFacturacion: 0,
    promedioDiasPago: 0,
    horasPendientes: 0,
  });

  // Metrics are now calculated server-side in the edge function
  // No need for heavy client-side calculations anymore

  const fetchClientsData = useCallback(
    async (isFilterChange = false) => {
      try {
        // Use mock data if flag is enabled
        if (USE_MOCK_DATA) {
          console.log("🎭 Using mock data for clientes presentation");
          // Simulate a small delay for realistic loading
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Filter mock data based on selected client (if not "all")
          let filteredData: any;

          if (selectedClientFilter !== "all") {
            // Find the selected client
            const selectedClient = mockClientesData.clients.find(
              (c: any) => c.nombre === selectedClientFilter
            );

            if (!selectedClient) {
              console.warn(
                `⚠️ Client not found: ${selectedClientFilter}, using base data`
              );
              filteredData = {
                clients: mockClientesData.clients,
                overallRevenueChart: mockClientesData.overallRevenueChart,
                areasChart: mockClientesData.areasChart,
                filteredMetrics: mockClientesData.filteredMetrics,
              };
            } else {
              // Check if we have predefined client-specific data
              const clientData = (mockClientesData as any).clientSpecificData?.[
                selectedClientFilter
              ];

              console.log(`🎯 Filtering by client: ${selectedClientFilter}`, {
                hasClientData: !!clientData,
                clientTotal: selectedClient.totalFacturado,
              });

              if (clientData) {
                // Use predefined client-specific metrics and charts
                filteredData = {
                  clients: mockClientesData.clients,
                  overallRevenueChart: clientData.overallRevenueChart,
                  areasChart: clientData.areasChart,
                  filteredMetrics: clientData.filteredMetrics,
                };
              } else {
                // Calculate client-specific data proportionally
                const totalRevenue =
                  mockClientesData.filteredMetrics.totalRevenue;
                const proportion = selectedClient.totalFacturado / totalRevenue;

                // Create a deterministic hash from client name for consistent variation
                let hash = 0;
                for (let i = 0; i < selectedClientFilter.length; i++) {
                  hash =
                    (hash << 5) - hash + selectedClientFilter.charCodeAt(i);
                  hash |= 0;
                }
                const variation = 0.8 + (Math.abs(hash) % 40) / 100; // 0.8 to 1.2

                // Calculate client-specific metrics
                const clientMetrics = {
                  totalRevenue: selectedClient.totalFacturado,
                  promedioDiasFacturacion: Math.round(
                    mockClientesData.filteredMetrics.promedioDiasFacturacion *
                      variation
                  ),
                  promedioDiasPago: Math.round(
                    mockClientesData.filteredMetrics.promedioDiasPago *
                      variation
                  ),
                  horasPendientes: Math.round(
                    selectedClient.horasTrabajadas * 0.1 // ~10% of worked hours are pending
                  ),
                };

                // Calculate client-specific revenue chart (proportional to total)
                const clientRevenueChart =
                  mockClientesData.overallRevenueChart.map((month: any) => ({
                    month: month.month,
                    revenue: Math.round(month.revenue * proportion),
                  }));

                // Calculate client-specific areas chart (distribute based on client's hours)
                // Use a deterministic distribution based on the client's hash
                const areasCount = 3 + (Math.abs(hash) % 3); // 3-5 areas
                const baseProportions = [0.4, 0.3, 0.2, 0.07, 0.03]; // Decreasing proportions
                const clientAreasChart = mockClientesData.areasChart
                  .slice(0, areasCount)
                  .map((area: any, index: number) => ({
                    name: area.name,
                    value: Math.round(
                      selectedClient.horasTrabajadas * baseProportions[index]
                    ),
                    color: area.color,
                  }))
                  .filter((area: any) => area.value > 0);

                filteredData = {
                  clients: mockClientesData.clients,
                  overallRevenueChart: clientRevenueChart,
                  areasChart: clientAreasChart,
                  filteredMetrics: clientMetrics,
                };
              }
            }
          } else {
            // Use all base data when "all" is selected
            filteredData = {
              clients: mockClientesData.clients,
              overallRevenueChart: mockClientesData.overallRevenueChart,
              areasChart: mockClientesData.areasChart,
              filteredMetrics: mockClientesData.filteredMetrics,
            };
          }

          // Set data from mock
          setClients(filteredData.clients);
          setOverallRevenueChart(filteredData.overallRevenueChart);
          setAreasChart(filteredData.areasChart);
          setFilteredMetrics(filteredData.filteredMetrics);
          setDashboardData({});

          setDataLoading(false);
          setIsFiltering(false);
          return;
        }

        // Only show full loading skeleton on initial load
        if (isFilterChange) {
          setIsFiltering(true);
        } else {
          setDataLoading(true);
        }

        // Call edge function for optimized data fetching
        const { data: edgeFunctionData, error: edgeFunctionError } =
          await supabase.functions.invoke("clientes-data", {
            body: {
              startDate: startDate?.toISOString().split("T")[0],
              endDate: endDate?.toISOString().split("T")[0],
              selectedClientFilter,
            },
          });

        if (edgeFunctionError) {
          console.error("Edge function error:", edgeFunctionError);
          throw edgeFunctionError;
        }

        console.log("✅ Clientes: Datos obtenidos desde edge function");

        // Set data from edge function
        setClients(edgeFunctionData.clients);
        setOverallRevenueChart(edgeFunctionData.overallRevenueChart);
        setAreasChart(edgeFunctionData.areasChart);
        setFilteredMetrics(edgeFunctionData.filteredMetrics);

        // We don't need to store allLiquidaciones anymore since metrics are calculated server-side
        setDashboardData({});
      } catch (error) {
        console.error("Error fetching clients data:", error);
      } finally {
        setDataLoading(false);
        setIsFiltering(false);
      }
    },
    [startDate, endDate, selectedClientFilter]
  );

  const filterAndSortClients = useCallback(() => {
    let filtered = [...clients];

    // Apply search filter (NOT client filter - that's just visual)
    if (searchTerm) {
      filtered = filtered.filter((client) =>
        client.nombre.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "nombre":
          comparison = a.nombre.localeCompare(b.nombre);
          break;
        case "totalFacturado":
          comparison = a.totalFacturado - b.totalFacturado;
          break;
        case "totalFacturas":
          comparison = a.totalFacturas - b.totalFacturas;
          break;
        case "ultimaFactura":
          const dateA = a.ultimaFactura
            ? new Date(a.ultimaFactura).getTime()
            : 0;
          const dateB = b.ultimaFactura
            ? new Date(b.ultimaFactura).getTime()
            : 0;
          comparison = dateA - dateB;
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    setFilteredClients(filtered);
  }, [clients, searchTerm, sortField, sortOrder]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  // Track if this is the initial load
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    if (user) {
      const isFilterChange = !isInitialLoadRef.current;
      isInitialLoadRef.current = false;
      fetchClientsData(isFilterChange);
    }
  }, [user, startDate, endDate, selectedClientFilter, fetchClientsData]);

  useEffect(() => {
    filterAndSortClients();
  }, [
    searchTerm,
    clients,
    sortField,
    sortOrder,
    selectedClientFilter,
    filterAndSortClients,
  ]);

  const handleClientClick = async (client: ClientSummary) => {
    setSelectedClientForDialog(client);

    // Fetch detailed data for this client
    try {
      // First get horas filtered by work date
      let horasQuery = supabase
        .from("horas_valor_cobrado")
        .select('"N° Cobro"');

      if (startDate) {
        horasQuery = horasQuery.gte(
          '"Trabajo (día)"',
          startDate.toISOString().split("T")[0]
        );
      }

      if (endDate) {
        horasQuery = horasQuery.lte(
          '"Trabajo (día)"',
          endDate.toISOString().split("T")[0]
        );
      }

      const { data: horasData } = await horasQuery;

      const cobrosUnicos = Array.from(
        new Set(
          (horasData || []).map((h: any) => h["N° Cobro"]).filter(Boolean)
        )
      );

      // Get liquidaciones for those cobros + this client
      let liquidaciones: any[] = [];

      if (cobrosUnicos.length > 0) {
        const batchSize = 1000;
        for (let i = 0; i < cobrosUnicos.length; i += batchSize) {
          const batch = cobrosUnicos.slice(i, i + batchSize);
          const { data } = await supabase
            .from("liquidaciones")
            .select("*")
            .eq("Cliente", client.nombre)
            .in('"N° Cobro"', batch);

          if (data) {
            liquidaciones = [...liquidaciones, ...data];
          }
        }
      }

      // Process data for charts
      const revenueByMonth: { [key: string]: number } = {};
      const facturasByEstado: { [key: string]: number } = {};

      liquidaciones?.forEach((factura: any) => {
        // Revenue by month
        if (factura["Fecha Creación"]) {
          const date = new Date(factura["Fecha Creación"]);
          const monthKey = `${date.getFullYear()}-${String(
            date.getMonth() + 1
          ).padStart(2, "0")}`;
          const total = Math.max(
            0,
            parseFloat(factura["Total facturado"]) || 0
          );
          revenueByMonth[monthKey] = Math.max(
            0,
            (revenueByMonth[monthKey] || 0) + total
          );
        }

        // By status
        const estado = factura.Estado || "Sin estado";
        facturasByEstado[estado] = (facturasByEstado[estado] || 0) + 1;
      });

      const revenueChart = Object.entries(revenueByMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, revenue]) => ({
          month,
          revenue,
        }));

      const statusData = Object.entries(facturasByEstado).map(
        ([estado, count]) => ({
          estado,
          count,
        })
      );

      setClientDetails({
        revenueChart,
        statusData,
        liquidaciones,
      });
    } catch (error) {
      console.error("Error fetching client details:", error);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const handleClientFilterClick = (clientName: string) => {
    // Toggle: if clicking the same client, deselect it
    if (selectedClientFilter === clientName) {
      setSelectedClientFilter("all");
    } else {
      setSelectedClientFilter(clientName);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading || dataLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return null;
  }

  const totalClients = clients.length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Clientes</h1>
          <p className="text-muted-foreground">
            Gestiona y analiza información de tus clientes
          </p>
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
                    disabled={(date) => (startDate ? date < startDate : false)}
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

          {/* Client Filter */}
          <div className="w-full lg:w-64">
            <Select
              value={selectedClientFilter}
              onValueChange={setSelectedClientFilter}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los clientes</SelectItem>
                {clients
                  .sort((a, b) => a.nombre.localeCompare(b.nombre))
                  .map((client) => (
                    <SelectItem key={client.nombre} value={client.nombre}>
                      {getMaskedClientName(client.nombre)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Cards and Areas Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
          {/* Loading Overlay */}
          {isFiltering && (
            <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] z-10 rounded-lg flex items-center justify-center pointer-events-none">
              <div className="flex flex-col items-center gap-2 bg-background/90 px-4 py-2 rounded-lg border shadow-sm">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Actualizando...</p>
              </div>
            </div>
          )}
          {/* Left Column - 4 Cards in 2x2 Grid */}
          <div
            className={`lg:col-span-1 transition-opacity duration-200 ${
              isFiltering ? "opacity-60" : "opacity-100"
            }`}
          >
            <div className="grid grid-cols-2 gap-3">
              <Card className="border-border/50">
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Facturación
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-lg font-bold text-foreground">
                    $
                    {Math.max(
                      0,
                      transformDisplayNumber(
                        Math.max(0, filteredMetrics.totalRevenue) / 1000000
                      )
                    ).toFixed(1)}
                    M
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Total facturado
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" />
                    Días Fact.
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-lg font-bold text-foreground">
                    {Math.round(
                      Math.max(
                        0,
                        transformDisplayNumber(
                          filteredMetrics.promedioDiasFacturacion
                        )
                      )
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Promedio días
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Días Pago
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-lg font-bold text-foreground">
                    {Math.round(
                      Math.max(
                        0,
                        transformDisplayNumber(filteredMetrics.promedioDiasPago)
                      )
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Promedio días
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Horas Pend.
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-lg font-bold text-foreground">
                    {Math.round(
                      Math.max(
                        0,
                        transformDisplayNumber(
                          Math.round(
                            Math.max(0, filteredMetrics.horasPendientes)
                          )
                        )
                      )
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Sin liquidar
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right Column - Areas Chart */}
          {areasChart.length > 0 && (
            <Card
              className={`border-border/50 lg:col-span-2 transition-opacity duration-200 ${
                isFiltering ? "opacity-60" : "opacity-100"
              }`}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-foreground">
                  Distribución por Área Profesional
                </CardTitle>
                <CardDescription>
                  Horas trabajadas por área profesional
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={areasChart}
                      cx="45%"
                      cy="50%"
                      labelLine={false}
                      label={false}
                      outerRadius={90}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {areasChart.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const total = areasChart.reduce(
                            (sum, item) => sum + item.value,
                            0
                          );
                          const rawValue = Math.max(
                            0,
                            Number(payload[0].value)
                          );
                          const transformedValue = Math.max(
                            0,
                            transformDisplayNumber(rawValue)
                          );
                          const percent = Math.max(0, (rawValue / total) * 100);
                          const transformedPercent = Math.max(
                            0,
                            transformDisplayNumber(percent)
                          ).toFixed(1);
                          return (
                            <div className="bg-white p-2 border rounded shadow-sm">
                              <p className="text-sm font-semibold">
                                {payload[0].name}
                              </p>
                              <p className="text-sm">
                                {transformedValue} horas ({transformedPercent}%)
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
                        const total = areasChart.reduce(
                          (sum, item) => sum + item.value,
                          0
                        );
                        const itemValue = Math.max(
                          0,
                          entry.payload?.value || 0
                        );
                        const percent = Math.max(0, (itemValue / total) * 100);
                        const transformedPercent = Math.max(
                          0,
                          transformDisplayNumber(percent)
                        ).toFixed(0);
                        return `${value}: ${transformedPercent}%`;
                      }}
                      wrapperStyle={{
                        paddingLeft: "10px",
                        fontSize: "11px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Overall Revenue Over Time Chart */}
        {overallRevenueChart.length > 0 && (
          <Card
            className={`border-border/50 relative transition-opacity duration-200 ${
              isFiltering ? "opacity-60" : "opacity-100"
            }`}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground">
                Facturación Total por Mes
              </CardTitle>
              <CardDescription>
                Evolución histórica de la facturación total
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart
                  data={overallRevenueChart}
                  margin={{ top: 5, right: 30, left: 20, bottom: 50 }}
                >
                  <defs>
                    <linearGradient
                      id="colorRevenue"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                      <stop
                        offset="95%"
                        stopColor="#10b981"
                        stopOpacity={0.1}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) =>
                      `$${Math.max(
                        0,
                        transformDisplayNumber(Math.max(0, value) / 1000000)
                      ).toFixed(1)}M`
                    }
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white p-3 border rounded shadow-lg">
                            <p className="text-sm font-semibold mb-1">
                              {payload[0].payload.month}
                            </p>
                            <p className="text-sm text-emerald-600 font-medium">
                              $
                              {Math.max(
                                0,
                                transformDisplayNumber(
                                  Math.max(0, Number(payload[0].value))
                                )
                              ).toLocaleString()}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Filters and Table */}
        <Card className="border-border/50">
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <CardTitle className="text-foreground">
                  Lista de Clientes
                </CardTitle>
                <CardDescription>
                  Haz clic en un cliente para filtrar (clic nuevamente para
                  deseleccionar)
                </CardDescription>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:flex-initial">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-full md:w-64"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Mobile Cards View */}
            <div className="block md:hidden space-y-4">
              {filteredClients.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No se encontraron clientes
                </div>
              ) : (
                filteredClients.map((client) => {
                  const isSelected = selectedClientFilter === client.nombre;
                  return (
                    <Card
                      key={client.nombre}
                      className={`cursor-pointer hover:shadow-md transition-all ${
                        isSelected
                          ? "ring-2 ring-emerald-500 bg-emerald-50/50"
                          : ""
                      }`}
                      onClick={() => handleClientFilterClick(client.nombre)}
                    >
                      <CardContent className="p-4">
                        <div className="font-semibold text-lg mb-3">
                          {getMaskedClientName(client.nombre)}
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between items-baseline gap-2">
                            <span className="text-muted-foreground">
                              Total:
                            </span>
                            <span className="font-semibold text-emerald-600 text-right break-all">
                              $
                              {getRoundedTableNumber(
                                client.totalFacturado
                              ).toLocaleString()}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-muted-foreground">
                                Facturas:
                              </span>
                              <span className="ml-2 font-semibold">
                                {getRoundedTableNumber(client.totalFacturas)}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                Última:
                              </span>
                              <span className="ml-2">
                                {formatDate(client.ultimaFactura)}
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-muted-foreground">
                                Pagadas:
                              </span>
                              <span className="ml-2 text-green-600 font-medium">
                                {getRoundedTableNumber(client.facturasPagadas)}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                Pendientes:
                              </span>
                              <span className="ml-2 text-amber-600 font-medium">
                                {getRoundedTableNumber(
                                  client.facturasPendientes
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("nombre")}
                        className="flex items-center gap-1 p-0 hover:bg-transparent"
                      >
                        Cliente
                        <ArrowUpDown className="h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("totalFacturado")}
                        className="flex items-center gap-1 p-0 hover:bg-transparent ml-auto"
                      >
                        Total Facturado
                        <ArrowUpDown className="h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("totalFacturas")}
                        className="flex items-center gap-1 p-0 hover:bg-transparent ml-auto"
                      >
                        Facturas
                        <ArrowUpDown className="h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right hidden lg:table-cell">
                      Horas
                    </TableHead>
                    <TableHead className="text-right">Pagadas</TableHead>
                    <TableHead className="text-right">Pendientes</TableHead>
                    <TableHead className="hidden xl:table-cell">
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("ultimaFactura")}
                        className="flex items-center gap-1 p-0 hover:bg-transparent"
                      >
                        Última Factura
                        <ArrowUpDown className="h-4 w-4" />
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-muted-foreground py-8"
                      >
                        No se encontraron clientes
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredClients.map((client) => {
                      const isSelected = selectedClientFilter === client.nombre;
                      return (
                        <TableRow
                          key={client.nombre}
                          className={`cursor-pointer hover:bg-muted/50 transition-colors ${
                            isSelected
                              ? "bg-emerald-50 hover:bg-emerald-100"
                              : ""
                          }`}
                          onClick={() => handleClientFilterClick(client.nombre)}
                        >
                          <TableCell className="font-medium">
                            {getMaskedClientName(client.nombre)}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-emerald-600">
                            $
                            {getRoundedTableNumber(
                              client.totalFacturado
                            ).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {getRoundedTableNumber(client.totalFacturas)}
                          </TableCell>
                          <TableCell className="text-right hidden lg:table-cell">
                            {getRoundedTableNumber(
                              Math.round(Math.max(0, client.horasTrabajadas))
                            )}
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            {getRoundedTableNumber(client.facturasPagadas)}
                          </TableCell>
                          <TableCell className="text-right text-amber-600">
                            {getRoundedTableNumber(client.facturasPendientes)}
                          </TableCell>
                          <TableCell className="hidden xl:table-cell">
                            {formatDate(client.ultimaFactura)}
                          </TableCell>
                        </TableRow>
                      );
                    })
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

export default Clientes;
