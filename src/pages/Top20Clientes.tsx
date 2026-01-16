import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Calendar as CalendarIcon, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getClientCosts, getTransformedTimeEntries } from "@/lib/mockDataUtils";
import { formatDateLocal } from "@/lib/utils";
import Top20Clientes from "@/components/Top20Clientes";
import facturacionData from "@/lib/mock/facturacion.json";
import clientesData from "@/lib/mock/clientes.json";
import usuariosData from "@/lib/mock/usuarios.json";
import asuntosData from "@/lib/mock/asuntos.json";
import type { Payment, Cliente, Usuario, Asunto } from "@/lib/mock/types";
import {
  ChartFiltersProvider,
  useChartFilters,
  ChartFilters,
} from "@/hooks/useChartFilters";

// Set to true to use mock data for presentations (no database calls)
const USE_MOCK_DATA = true;

interface ClientSummary {
  nombre: string;
  totalFacturado: number;
  totalCost: number;
  totalFacturas: number;
  ultimaFactura: string | null;
  primeraFactura: string | null;
  facturasPagadas: number;
  facturasPendientes: number;
  horasTrabajadas: number;
}

// Helper function to normalize dates
function normalizeDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  if (dateStr.includes("-")) return dateStr;
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const month = parts[0].padStart(2, "0");
    const day = parts[1].padStart(2, "0");
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}

function compareDateOnly(date1: Date, date2: Date): number {
  const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
  return d1.getTime() - d2.getTime();
}

// Transform data for Top 20 Clientes page
const transformMockData = (
  startDate?: Date,
  endDate?: Date,
  filters?: ChartFilters
) => {
  // Get all time entries first, then filter
  const allTimeEntries = getTransformedTimeEntries(startDate, endDate);
  // Keep original entries for cost calculation
  let filteredTimeEntries = allTimeEntries;

  const facturacion = facturacionData as Payment[];
  const clientes = clientesData as Cliente[];
  const usuarios = usuariosData as Usuario[];
  const asuntos = asuntosData as unknown as Asunto[];

  // Create a map of cliente_id to client name
  const clienteIdToNameMap = new Map<number, string>();
  clientes.forEach((cliente) => {
    if (cliente.name) {
      clienteIdToNameMap.set(cliente.id, cliente.name);
    }
  });

  // Create a map of user_id to usuario for category lookup
  const usuarioMap = new Map<number, Usuario>();
  usuarios.forEach((usuario) => {
    usuarioMap.set(usuario.id, usuario);
  });

  // Create a map of asunto_id to asunto for category filtering in payments
  const asuntoMap = new Map<number, Asunto>();
  asuntos.forEach((asunto) => {
    asuntoMap.set(asunto.id, asunto);
  });

  // Helper function to map usuario category to level
  const getCategoryLevel = (usuario: Usuario | undefined): string => {
    if (!usuario) return "Otro";
    if (usuario.category === "Socio") return "Socio";
    if (usuario.category === "Asociado Sr") return "Asociado Sr";
    if (usuario.category === "Asociado") return "Asociado";
    return "Otro";
  };

  // Apply filters to time entries
  if (filters) {
    if (filters.clientName) {
      filteredTimeEntries = filteredTimeEntries.filter(
        (e) => e.client_name === filters.clientName
      );
    }
    if (filters.category) {
      filteredTimeEntries = filteredTimeEntries.filter((e) => {
        const usuario = usuarioMap.get(e.user_id);
        return getCategoryLevel(usuario) === filters.category;
      });
    }
  }

  // Create filtered entries without originalEntry for use in calculations
  const timeEntries = filteredTimeEntries.map((e) => {
    const { originalEntry, ...entry } = e;
    return entry;
  });

  // Recalculate client costs from filtered time entries
  const clientCostsMap = new Map<
    string,
    {
      client_name: string;
      total_cost: number;
      total_hours: number;
      project_count: number;
    }
  >();

  filteredTimeEntries.forEach((entry) => {
    const existing = clientCostsMap.get(entry.client_name);
    // Use total_cost from original entry, or calculate from hours and hourly_cost
    const cost =
      entry.originalEntry.total_cost ??
      entry.duration * (entry.originalEntry.hourly_cost || 0);

    if (existing) {
      existing.total_hours += entry.duration;
      existing.total_cost += cost;
    } else {
      clientCostsMap.set(entry.client_name, {
        client_name: entry.client_name,
        total_hours: entry.duration,
        total_cost: cost,
        project_count: 1,
      });
    }
  });

  // Count unique projects per client
  const clientProjectsMap = new Map<string, Set<number>>();
  filteredTimeEntries.forEach((entry) => {
    if (!clientProjectsMap.has(entry.client_name)) {
      clientProjectsMap.set(entry.client_name, new Set());
    }
    clientProjectsMap.get(entry.client_name)!.add(entry.project_id);
  });

  clientProjectsMap.forEach((projects, clientName) => {
    const clientCost = clientCostsMap.get(clientName);
    if (clientCost) {
      clientCost.project_count = projects.size;
    }
  });

  const clientCosts = Array.from(clientCostsMap.values());

  // Calculate TOTAL unfiltered revenue for percentage calculation
  const totalUnfilteredRevenueMap = new Map<string, number>();
  facturacion.forEach((payment) => {
    if (!payment.month || !payment.cliente_id) return;

    const paymentDate = normalizeDate(payment.month);
    if (!paymentDate) return;

    const date = new Date(paymentDate + "T00:00:00");

    // Filter by date range only (no client/category filters)
    if (startDate) {
      const start = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate()
      );
      if (compareDateOnly(date, start) < 0) return;
    }
    if (endDate) {
      const end = new Date(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate()
      );
      if (compareDateOnly(date, end) > 0) return;
    }

    const clientName = clienteIdToNameMap.get(payment.cliente_id);
    if (!clientName) return;

    const revenue = payment.amount_charged || 0;
    totalUnfilteredRevenueMap.set(
      clientName,
      (totalUnfilteredRevenueMap.get(clientName) || 0) + revenue
    );
  });

  // Calculate total unfiltered revenue
  let totalUnfilteredRevenue = 0;
  totalUnfilteredRevenueMap.forEach((revenue) => {
    totalUnfilteredRevenue += revenue;
  });

  // If no revenue from payments, calculate from client costs
  if (totalUnfilteredRevenue === 0) {
    const allClientCosts = getClientCosts(startDate, endDate);
    totalUnfilteredRevenue = allClientCosts.reduce(
      (sum, client) => sum + client.total_cost,
      0
    );
  }

  // Calculate revenue from facturacion for each client (with filters)
  const clientRevenueMap = new Map<string, number>();

  facturacion.forEach((payment) => {
    if (!payment.month || !payment.cliente_id) return;

    const paymentDate = normalizeDate(payment.month);
    if (!paymentDate) return;

    const date = new Date(paymentDate + "T00:00:00");

    // Filter by date range
    if (startDate) {
      const start = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate()
      );
      if (compareDateOnly(date, start) < 0) return;
    }
    if (endDate) {
      const end = new Date(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate()
      );
      if (compareDateOnly(date, end) > 0) return;
    }

    const clientName = clienteIdToNameMap.get(payment.cliente_id);
    if (!clientName) return;

    // Apply client filter
    if (filters?.clientName && clientName !== filters.clientName) return;

    // Apply category filter (check if payment's asunto is linked to usuario with that category)
    if (filters?.category && payment.asunto_id) {
      const asunto = asuntoMap.get(payment.asunto_id);
      if (asunto?.usuario_id) {
        const usuario = usuarioMap.get(asunto.usuario_id);
        if (getCategoryLevel(usuario) !== filters.category) return;
      } else {
        return; // Skip if no usuario linked
      }
    }

    const revenue = payment.amount_charged || 0;
    clientRevenueMap.set(
      clientName,
      (clientRevenueMap.get(clientName) || 0) + revenue
    );
  });

  // Transform clientCosts to clients array
  const clients: ClientSummary[] = clientCosts.map((client) => {
    // Calculate invoice counts (simulate based on projects)
    const invoiceCount = Math.max(1, Math.floor(client.project_count * 2.5));
    const paidInvoices = Math.floor(invoiceCount * 0.75);
    const pendingInvoices = invoiceCount - paidInvoices;

    // Get dates from time entries
    const clientEntries = timeEntries.filter(
      (e) => e.client_name === client.client_name
    );
    const dates = clientEntries.map((e) => e.date).sort();
    const firstDate = dates[0] || null;
    const lastDate = dates[dates.length - 1] || null;

    // Get revenue from facturacion, fallback to cost if no revenue found
    const revenue = clientRevenueMap.get(client.client_name) || 0;
    const cost = client.total_cost; // This is the cost from time entries

    return {
      nombre: client.client_name,
      totalFacturado: revenue > 0 ? revenue : cost, // Use revenue if available, otherwise fallback
      totalCost: cost,
      totalFacturas: invoiceCount,
      ultimaFactura: lastDate,
      primeraFactura: firstDate,
      facturasPagadas: paidInvoices,
      facturasPendientes: pendingInvoices,
      horasTrabajadas: client.total_hours,
    };
  });

  // Calculate hours by category level (using filtered time entries)
  const hoursByLevelMap = new Map<string, number>();

  timeEntries.forEach((entry) => {
    const usuario = usuarioMap.get(entry.user_id);
    const level = getCategoryLevel(usuario);

    hoursByLevelMap.set(
      level,
      (hoursByLevelMap.get(level) || 0) + entry.duration
    );
  });

  const hoursByLevel = Array.from(hoursByLevelMap.entries())
    .map(([name, value]) => ({ name, value }))
    .filter((item) => item.value > 0);

  // Calculate facturacion by fee_type (with filters)
  const facturacionByFeeTypeMap = new Map<string, number>();

  facturacion.forEach((payment) => {
    if (!payment.month || !payment.cliente_id) return;

    const paymentDate = normalizeDate(payment.month);
    if (!paymentDate) return;

    const date = new Date(paymentDate + "T00:00:00");

    // Filter by date range
    if (startDate) {
      const start = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate()
      );
      if (compareDateOnly(date, start) < 0) return;
    }
    if (endDate) {
      const end = new Date(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate()
      );
      if (compareDateOnly(date, end) > 0) return;
    }

    const cliente = clientes.find((c) => c.id === payment.cliente_id);
    if (!cliente || !cliente.fee_type) return;

    const clientName = clienteIdToNameMap.get(payment.cliente_id);

    // Apply client filter
    if (filters?.clientName && clientName !== filters.clientName) return;

    // Apply category filter
    if (filters?.category && payment.asunto_id) {
      const asunto = asuntoMap.get(payment.asunto_id);
      if (asunto?.usuario_id) {
        const usuario = usuarioMap.get(asunto.usuario_id);
        if (getCategoryLevel(usuario) !== filters.category) return;
      } else {
        return;
      }
    }

    const feeType = cliente.fee_type;
    facturacionByFeeTypeMap.set(
      feeType,
      (facturacionByFeeTypeMap.get(feeType) || 0) +
        (payment.amount_charged || 0)
    );
  });

  const facturacionByFeeType = Array.from(facturacionByFeeTypeMap.entries())
    .map(([name, value]) => ({ name, value }))
    .filter((item) => item.value > 0);

  return {
    clients,
    hoursByLevel,
    facturacionByFeeType,
    totalUnfilteredRevenue,
  };
};

const getMaskedClientName = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }

  const randomNumber = (Math.abs(hash) % 9000) + 1000;
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

  return Math.max(0, value);
};

const getRoundedTableNumber = (value: number | null | undefined) => {
  return Math.round(Math.max(0, transformDisplayNumber(value)));
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

const Top20ClientesPageContent = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const {
    filters,
    setClientFilter,
    setCategoryFilter,
    clearFilters,
    hasActiveFilters,
  } = useChartFilters();
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [hoursByLevel, setHoursByLevel] = useState<
    Array<{ name: string; value: number }>
  >([]);
  const [facturacionByFeeType, setFacturacionByFeeType] = useState<
    Array<{ name: string; value: number }>
  >([]);
  const [totalUnfilteredRevenue, setTotalUnfilteredRevenue] =
    useState<number>(0);
  const [dataLoading, setDataLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(
    new Date(2023, 0, 1)
  ); // 1/1/2023
  const [endDate, setEndDate] = useState<Date | undefined>(
    new Date(2023, 11, 31)
  ); // 31/12/2023

  const fetchClientsData = useCallback(
    async (isFilterChange = false) => {
      try {
        // Use mock data if flag is enabled
        if (USE_MOCK_DATA) {
          console.log("🎭 Using mock data for Top 20 Clientes");
          // No delay for instant updates - charts will animate smoothly

          // Transform new structure to expected format with filters
          const transformedData = transformMockData(
            startDate,
            endDate,
            filters
          );

          console.log(`🎯 Using transformed mock data`, {
            clientsCount: transformedData.clients.length,
            filters,
          });

          // Set data from transformed mock
          setClients(transformedData.clients);
          setHoursByLevel(transformedData.hoursByLevel || []);
          setFacturacionByFeeType(transformedData.facturacionByFeeType || []);
          setTotalUnfilteredRevenue(
            transformedData.totalUnfilteredRevenue || 0
          );

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
              startDate: startDate ? formatDateLocal(startDate) : undefined,
              endDate: endDate ? formatDateLocal(endDate) : undefined,
              selectedClientFilter: "all",
            },
          });

        if (edgeFunctionError) {
          console.error("Edge function error:", edgeFunctionError);
          throw edgeFunctionError;
        }

        console.log("✅ Top 20 Clientes: Datos obtenidos desde edge function");

        // Set data from edge function
        setClients(edgeFunctionData.clients);
      } catch (error) {
        console.error("Error fetching clients data:", error);
      } finally {
        setDataLoading(false);
        setIsFiltering(false);
      }
    },
    [startDate, endDate, filters]
  );

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
  }, [user, startDate, endDate, fetchClientsData]);

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Date Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
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

        {/* Loading Overlay - Only show for non-mock data */}
        {isFiltering && !USE_MOCK_DATA && (
          <div className="relative">
            <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] z-10 rounded-lg flex items-center justify-center pointer-events-none">
              <div className="flex flex-col items-center gap-2 bg-background/90 px-4 py-2 rounded-lg border shadow-sm">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Actualizando...</p>
              </div>
            </div>
          </div>
        )}

        {/* Active Filters */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground">
              Filtros activos:
            </span>
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
            {filters.category && (
              <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-sm">
                <span>Categoría: {filters.category}</span>
                <button
                  onClick={() => setCategoryFilter(null)}
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

        {/* Top 20 Clientes Component */}
        <div className="transition-opacity duration-200">
          <Top20Clientes
            clients={clients}
            getMaskedClientName={getMaskedClientName}
            getRoundedTableNumber={getRoundedTableNumber}
            formatDate={formatDate}
            hoursByLevel={hoursByLevel}
            facturacionByFeeType={facturacionByFeeType}
            onClientClick={(client) => setClientFilter(client.nombre)}
            onCategoryClick={setCategoryFilter}
            activeFilters={filters}
            totalUnfilteredRevenue={totalUnfilteredRevenue}
          />
        </div>
      </div>
    </DashboardLayout>
  );
};

const Top20ClientesPage = () => {
  return (
    <ChartFiltersProvider>
      <Top20ClientesPageContent />
    </ChartFiltersProvider>
  );
};

export default Top20ClientesPage;
