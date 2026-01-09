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
import mockDashboardData from "@/lib/mockDashboardData.json";

// Set to true to use mock data for presentations (no database calls)
const USE_MOCK_DATA = true;

const Dashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [chartData, setChartData] = useState<any>(null); // Chart data always shows all areas
  const [dataLoading, setDataLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false); // For incremental loading
  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Date | undefined>(
    new Date(2025, 0, 1)
  ); // 1/1/2025
  const [endDate, setEndDate] = useState<Date | undefined>(
    new Date(2025, 8, 30)
  ); // 30/9/2025

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

  // Fetch areas disponibles (solo una vez)
  useEffect(() => {
    const fetchAreas = async () => {
      if (availableAreas.length > 0) return;

      if (USE_MOCK_DATA) {
        // Use areas from mock data
        const areas = Array.from(
          new Set(mockDashboardData.facturacionPorArea.map((a: any) => a.area))
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
  }, [user, availableAreas.length]);

  const fetchDashboardData = useCallback(
    async (isFilterChange = false) => {
      try {
        // Use mock data if flag is enabled
        if (USE_MOCK_DATA) {
          console.log("🎭 Using mock data for presentation");
          // Simulate a small delay for realistic loading
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Filter mock data based on selected area (if not "all")
          let filteredData: any;

          if (selectedArea !== "all") {
            // Get area-specific data
            const areaData = (mockDashboardData as any).areaSpecificData?.[
              selectedArea
            ];

            console.log(`🎯 Filtering by area: ${selectedArea}`, {
              hasAreaData: !!areaData,
              areaData,
            });

            if (areaData) {
              // Use area-specific metrics
              filteredData = {
                clientesUnicos: areaData.clientesUnicos,
                totalFacturado: areaData.totalFacturado,
                metaFacturacion: areaData.metaFacturacion,
                promedioDiasFacturacion: areaData.promedioDiasFacturacion,
                promedioDiasPago: areaData.promedioDiasPago,
                // Filter facturacionPorArea to show only selected area
                facturacionPorArea: mockDashboardData.facturacionPorArea.filter(
                  (item: any) => item.area === selectedArea
                ),
                // Use area-specific charts
                statusChart: areaData.statusChart,
                formaCobroChart: areaData.formaCobroChart,
                // Keep revenue chart from base data (or could be area-specific too)
                revenueChart: mockDashboardData.revenueChart,
                areasChart: mockDashboardData.areasChart,
              };
            } else {
              console.warn(
                `⚠️ Area-specific data not found for: ${selectedArea}, using fallback`
              );
              // Fallback if area not found - use base data with filtered facturacionPorArea
              filteredData = { ...mockDashboardData };
              filteredData.facturacionPorArea =
                mockDashboardData.facturacionPorArea.filter(
                  (item: any) => item.area === selectedArea
                );
            }
          } else {
            // Use all base data when "all" is selected
            filteredData = { ...mockDashboardData };
          }

          setDashboardData(filteredData);
          // Chart data always shows all areas
          setChartData(mockDashboardData.facturacionPorArea);
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
          // Always fetch chart data with "all" to keep chart showing all areas
          if (selectedArea !== "all") {
            const { data: chartDataResponse } = await supabase.functions.invoke(
              "dashboard-data",
              {
                body: {
                  selectedArea: "all",
                  startDate:
                    startDate?.toISOString().split("T")[0] || undefined,
                  endDate: endDate?.toISOString().split("T")[0] || undefined,
                },
              }
            );
            if (chartDataResponse) {
              setChartData(chartDataResponse.facturacionPorArea);
            }
          } else {
            setChartData(cachedData.facturacionPorArea);
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
              startDate: startDate?.toISOString().split("T")[0] || undefined,
              endDate: endDate?.toISOString().split("T")[0] || undefined,
            },
          });

        if (edgeFunctionError) {
          console.error("Edge function error:", edgeFunctionError);
          throw edgeFunctionError;
        }

        console.log("✅ Datos obtenidos desde edge function");
        setDashboardData(edgeFunctionData);

        // Always fetch chart data with "all" to keep chart showing all areas
        if (selectedArea !== "all") {
          const { data: chartDataResponse } = await supabase.functions.invoke(
            "dashboard-data",
            {
              body: {
                selectedArea: "all",
                startDate: startDate?.toISOString().split("T")[0] || undefined,
                endDate: endDate?.toISOString().split("T")[0] || undefined,
              },
            }
          );
          if (chartDataResponse) {
            setChartData(chartDataResponse.facturacionPorArea);
          }
        } else {
          // When "all" is selected, use the same data
          setChartData(edgeFunctionData.facturacionPorArea);
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
        // Fallback to old method if edge function fails
        await fetchDashboardDataLegacy();
      } finally {
        setDataLoading(false);
        setIsRefreshing(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [selectedArea, startDate, endDate]
  );

  const fetchDashboardDataLegacy = async () => {
    try {
      console.log("⚠️ Using legacy fetch method as fallback");
      console.time("Dashboard Load Time (Legacy)");

      // 1. Obtener códigos de asuntos filtrados por área
      let caseCodes: string[] = [];
      // let totalCases = 0;
      // let casosActivos = 0;
      // let casosInactivos = 0;
      let clientesUnicos = 0;

      if (selectedArea === "all") {
        // Obtener métricas de asuntos con agregación
        const [
          // totalRes,
          // activosRes,
          // inactivosRes,
          clientesRes,
        ] = await Promise.all([
          // supabase
          //   .from("asuntos")
          //   .select("*", { count: "exact", head: true }),
          // supabase
          //   .from("asuntos")
          //   .select("*", { count: "exact", head: true })
          //   .in("Activo", ["Si", "TRUE"]),
          // supabase
          //   .from("asuntos")
          //   .select("*", { count: "exact", head: true })
          //   .in("Activo", ["No", "FALSE"]),
          supabase.from("asuntos").select("Cliente").not("Cliente", "is", null),
        ]);

        // totalCases = totalRes.count || 0;
        // casosActivos = activosRes.count || 0;
        // casosInactivos = inactivosRes.count || 0;
        clientesUnicos = new Set(clientesRes.data?.map((c: any) => c.Cliente))
          .size;
      } else {
        // Obtener asuntos del área seleccionada
        const { data: asuntosArea } = await supabase
          .from("asuntos")
          .select("Código, Cliente") // Removed "Activo" since it's not used
          .eq('"Area de Práctica"', selectedArea);

        if (asuntosArea) {
          caseCodes = asuntosArea.map((a: any) => a.Código).filter(Boolean);
          // totalCases = asuntosArea.length;
          // casosActivos = asuntosArea.filter((a: any) =>
          //   ["Si", "TRUE"].includes(a.Activo)
          // ).length;
          // casosInactivos = asuntosArea.filter((a: any) =>
          //   ["No", "FALSE"].includes(a.Activo)
          // ).length;
          clientesUnicos = new Set(
            asuntosArea.map((a: any) => a.Cliente).filter(Boolean)
          ).size;
        }
      }

      // 2. Construir query de horas con filtros por "Trabajo (día)"
      let horasQuery = supabase
        .from("horas_valor_cobrado")
        .select(
          '"N° Cobro", "Trabajo (día)", "Fecha Facturación", "Código Asunto"'
        );

      if (selectedArea !== "all" && caseCodes.length > 0) {
        horasQuery = horasQuery.in('"Código Asunto"', caseCodes);
      }

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

      // Traer horas filtradas con paginación
      let horas: any[] = [];
      let page = 0;
      const pageSize = 1000;
      const maxPages = 50;
      let hasMore = true;

      while (hasMore && page < maxPages) {
        const { data, error } = await horasQuery.range(
          page * pageSize,
          (page + 1) * pageSize - 1
        );

        if (error) {
          console.error("Error fetching horas:", error);
          break;
        }

        if (data && data.length > 0) {
          horas = [...horas, ...data];
          hasMore = data.length === pageSize;
          page++;

          if (page % 5 === 0) {
            console.log(`📊 Cargando horas: ${horas.length} registros...`);
          }
        } else {
          hasMore = false;
        }
      }

      if (page >= maxPages) {
        console.warn(
          `⚠️ Límite de páginas alcanzado (${maxPages}). Total horas cargadas: ${horas.length}`
        );
      }

      console.log(
        `Horas cargadas: ${horas.length} registros en ${page} páginas`
      );

      // 3. Obtener cobros únicos de las horas filtradas
      const cobrosUnicos = Array.from(
        new Set(horas.map((h: any) => h["N° Cobro"]).filter(Boolean))
      );

      console.log(`Cobros únicos encontrados: ${cobrosUnicos.length}`);

      // 4. Obtener liquidaciones de esos cobros (SIN filtro de fecha)
      let liquidaciones: any[] = [];

      if (cobrosUnicos.length > 0) {
        const batchSize = 1000;
        for (let i = 0; i < cobrosUnicos.length; i += batchSize) {
          const batch = cobrosUnicos.slice(i, i + batchSize);
          const liqQuery = supabase
            .from("liquidaciones")
            .select("*")
            .in('"N° Cobro"', batch);

          const { data } = await liqQuery;
          if (data) {
            liquidaciones = [...liquidaciones, ...data];
          }
        }
      }

      console.log(`Liquidaciones encontradas: ${liquidaciones.length}`);

      // 5. Calcular total facturado
      const totalFacturado = liquidaciones.reduce((sum, l) => {
        return sum + (parseFloat(l["Total facturado"]) || 0);
      }, 0);

      // 6b. Calcular meta de facturación
      const metaFacturacion = await calcularMetaFacturacion(
        startDate,
        endDate,
        selectedArea
      );

      // 7. Calcular promedio días de facturación
      // Para cada cobro único, obtener MAX(Trabajo (día)) y MAX(Fecha Facturación) de TODAS las horas
      const promedioDiasFacturacion = await calcularPromedioDiasFacturacion(
        cobrosUnicos,
        selectedArea,
        caseCodes
      );

      // 7b. Calcular promedio días de pago
      // Para cada cobro único, obtener MAX(Fecha Facturación) y MAX(Fecha Pago) de TODAS las horas
      const promedioDiasPago = await calcularPromedioDiasPago(
        cobrosUnicos,
        selectedArea,
        caseCodes
      );

      // 7c. Calcular facturación y meta por área profesional
      const facturacionPorArea = await calcularFacturacionPorArea(
        startDate,
        endDate,
        selectedArea
      );

      // 8. Preparar datos de charts
      const revenueByMonth = (liquidaciones || []).reduce(
        (acc: any, l: any) => {
          if (l["Fecha Creación"]) {
            const date = new Date(l["Fecha Creación"]);
            const monthKey = `${date.getFullYear()}-${String(
              date.getMonth() + 1
            ).padStart(2, "0")}`;
            const total = parseFloat(l["Total facturado"]) || 0;
            acc[monthKey] = (acc[monthKey] || 0) + total;
          }
          return acc;
        },
        {}
      );

      const revenueChart = Object.entries(revenueByMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([month, revenue]) => ({ month, revenue }));

      const statusChart = Object.entries(
        (liquidaciones || []).reduce((acc: any, l: any) => {
          const estado = l.Estado || "Sin estado";
          acc[estado] = (acc[estado] || 0) + 1;
          return acc;
        }, {})
      ).map(([name, value]) => ({ name, value }));

      // 8b. Calcular facturación por forma de cobro
      console.log("🔍 Calculando facturación por forma de cobro...");

      // Paso 1: Obtener todos los códigos de asunto únicos de las horas filtradas
      const codigosAsunto = Array.from(
        new Set(horas.map((h: any) => h["Código Asunto"]).filter(Boolean))
      );

      console.log(`📋 Códigos de asunto únicos: ${codigosAsunto.length}`);

      // Paso 2: Obtener la forma de cobro de esos asuntos
      const { data: asuntosData, error: asuntosError } = await supabase
        .from("asuntos")
        .select('"Código", "Forma Cobro"')
        .in("Código", codigosAsunto.length > 0 ? codigosAsunto : ["NONE"])
        .not('"Forma Cobro"', "is", null)
        .not('"Forma Cobro"', "eq", "");

      console.log("📊 Asuntos con forma de cobro:", {
        count: asuntosData?.length || 0,
        error: asuntosError,
      });

      // Paso 3: Crear un mapa de Código Asunto -> Forma Cobro
      const codigoToFormaCobro = new Map<string, string>();
      (asuntosData || []).forEach((asunto: any) => {
        codigoToFormaCobro.set(asunto.Código, asunto["Forma Cobro"]);
      });

      // Paso 4: Para cada cobro, obtener su facturación y asignarlo a la forma de cobro
      const facturacionPorFormaCobro: Record<string, number> = {};

      liquidaciones.forEach((liq: any) => {
        const nCobro = liq["N° Cobro"];
        const totalFacturado = parseFloat(liq["Total facturado"]) || 0;

        // Buscar las horas de este cobro para obtener el código de asunto
        const horasDelCobro = horas.filter(
          (h: any) => h["N° Cobro"] === nCobro
        );

        if (horasDelCobro.length > 0) {
          // Obtener los códigos de asunto únicos de este cobro
          const codigosDelCobro = Array.from(
            new Set(
              horasDelCobro.map((h: any) => h["Código Asunto"]).filter(Boolean)
            )
          );

          // Distribuir la facturación entre las formas de cobro encontradas
          const formasCobro = Array.from(
            new Set(
              codigosDelCobro
                .map((codigo) => codigoToFormaCobro.get(codigo))
                .filter(Boolean)
            )
          );

          if (formasCobro.length > 0) {
            // Si hay múltiples formas de cobro en un mismo cobro, distribuir proporcionalmente
            const montoPorForma = totalFacturado / formasCobro.length;
            formasCobro.forEach((forma) => {
              facturacionPorFormaCobro[forma!] =
                (facturacionPorFormaCobro[forma!] || 0) + montoPorForma;
            });
          }
        }
      });

      const formaCobroChart = Object.entries(facturacionPorFormaCobro)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      console.log("💰 Facturación por forma de cobro:", {
        chartLength: formaCobroChart.length,
        chart: formaCobroChart,
        total: formaCobroChart.reduce((sum, item) => sum + item.value, 0),
      });

      // 9. Obtener distribución de áreas (solo cuando "all" está seleccionado)
      let areasChart: any[] = [];
      if (selectedArea === "all") {
        const { data: areasData } = await supabase
          .from("asuntos")
          .select('"Area de Práctica"')
          .not('"Area de Práctica"', "is", null);

        const areasPractica =
          areasData?.reduce((acc: any, a: any) => {
            const area = a["Area de Práctica"] || "Sin categoría";
            acc[area] = (acc[area] || 0) + 1;
            return acc;
          }, {}) || {};

        areasChart = Object.entries(areasPractica).map(([name, value]) => ({
          name,
          value,
        }));
      }

      const data = {
        clientesUnicos,
        // casosActivos,
        // casosInactivos,
        totalFacturado,
        metaFacturacion,
        // horasTrabajadas,
        promedioDiasFacturacion,
        promedioDiasPago,
        areasChart,
        revenueChart,
        statusChart,
        formaCobroChart,
        facturacionPorArea,
        // totalCases,
      };

      console.log("🔍 Dashboard data:", {
        hasFormaCobroChart: !!formaCobroChart,
        formaCobroChartLength: formaCobroChart?.length || 0,
        formaCobroChart,
      });

      setDashboardData(data);

      // Guardar en caché
      dashboardCache.set(data, {
        selectedArea,
        startDate,
        endDate,
      });

      console.timeEnd("Dashboard Load Time (Legacy)");
    } catch (error) {
      console.error("Error in legacy fetch:", error);
    }
  };

  // Función auxiliar para calcular facturación y meta por área
  const calcularFacturacionPorArea = async (
    fechaMin: Date | undefined,
    fechaMax: Date | undefined,
    areaFiltro: string
  ) => {
    console.log("=== INICIO CÁLCULO FACTURACIÓN POR ÁREA ===");

    if (!fechaMin || !fechaMax) {
      console.log("❌ Sin fechas, retornando array vacío");
      return [];
    }

    // Calcular primer y último día del rango de meses
    const firstDayOfStartMonth = new Date(
      Date.UTC(fechaMin.getFullYear(), fechaMin.getMonth(), 1)
    );
    const lastDayOfEndMonth = new Date(
      Date.UTC(
        fechaMax.getFullYear(),
        fechaMax.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      )
    );

    // 1. Obtener metas de facturación por área profesional
    const metasQuery = supabase
      .from("meta_facturacion")
      .select('"Área Profesional", Meta, Mes')
      .gte("Mes", firstDayOfStartMonth.toISOString())
      .lte("Mes", lastDayOfEndMonth.toISOString());

    const { data: metas, error: metasError } = await metasQuery;

    if (metasError) {
      console.error("❌ Error fetching metas:", metasError);
    }

    console.log("Metas obtenidas:", metas?.length || 0);

    // Agrupar metas por área profesional
    const metasPorArea = (metas || []).reduce((acc: any, m: any) => {
      const area = m["Área Profesional"];
      const meta = parseFloat(m.Meta) || 0;
      acc[area] = (acc[area] || 0) + meta;
      return acc;
    }, {});

    // 2. Obtener facturación real por área profesional
    // Primero obtener todos los cobros en el rango de fechas CON horas trabajadas
    const horasQuery = supabase
      .from("horas_valor_cobrado")
      .select(
        '"N° Cobro", "Área Profesional", "Trabajo (día)", "Horas Trabajadas"'
      )
      .gte('"Trabajo (día)"', fechaMin.toISOString().split("T")[0])
      .lte('"Trabajo (día)"', fechaMax.toISOString().split("T")[0])
      .not('"Área Profesional"', "is", null);

    let horas: any[] = [];
    let page = 0;
    const pageSize = 1000;
    const maxPages = 50; // Límite de seguridad: máximo 50,000 registros
    let hasMore = true;

    while (hasMore && page < maxPages) {
      const { data, error } = await horasQuery.range(
        page * pageSize,
        (page + 1) * pageSize - 1
      );

      if (error) {
        console.error("Error fetching horas:", error);
        break;
      }

      if (data && data.length > 0) {
        horas = [...horas, ...data];
        hasMore = data.length === pageSize;
        page++;

        // Log de progreso cada 10 páginas
        if (page % 10 === 0) {
          console.log(
            `📊 Cargando horas para facturación por área: ${horas.length} registros...`
          );
        }
      } else {
        hasMore = false;
      }
    }

    if (page >= maxPages) {
      console.warn(
        `⚠️ Límite de páginas alcanzado (${maxPages}). Total cargado: ${horas.length}`
      );
    }

    console.log(`Horas cargadas para facturación por área: ${horas.length}`);

    // Obtener cobros únicos
    const cobrosUnicos = Array.from(
      new Set(horas.map((h: any) => h["N° Cobro"]).filter(Boolean))
    );

    console.log(`Cobros únicos: ${cobrosUnicos.length}`);

    // Obtener liquidaciones de esos cobros
    let liquidaciones: any[] = [];

    if (cobrosUnicos.length > 0) {
      const batchSize = 1000;
      for (let i = 0; i < cobrosUnicos.length; i += batchSize) {
        const batch = cobrosUnicos.slice(i, i + batchSize);
        const liqQuery = supabase
          .from("liquidaciones")
          .select('"N° Cobro", "Total facturado"')
          .in('"N° Cobro"', batch);
        // NOTE: No date filter here - already filtered by horas "Trabajo (día)"

        const { data } = await liqQuery;
        if (data) {
          liquidaciones = [...liquidaciones, ...data];
        }
      }
    }

    console.log(`Liquidaciones encontradas: ${liquidaciones.length}`);

    // Crear un mapa de N° Cobro -> Total Facturado
    const facturadoPorCobro = liquidaciones.reduce((acc: any, l: any) => {
      acc[l["N° Cobro"]] = parseFloat(l["Total facturado"]) || 0;
      return acc;
    }, {});

    // Paso 1: Agrupar horas por cobro y calcular total de horas por cobro y por área
    const cobrosPorArea = new Map<string, Map<string, number>>(); // cobro -> (area -> horas)
    const horasTotalesPorCobro = new Map<string, number>(); // cobro -> total horas

    horas.forEach((h: any) => {
      const cobro = h["N° Cobro"];
      const area = h["Área Profesional"];
      const horasTrabajadas = parseFloat(h["Horas Trabajadas"]) || 0;

      if (!cobro || !area) return;

      // Inicializar mapas si no existen
      if (!cobrosPorArea.has(cobro)) {
        cobrosPorArea.set(cobro, new Map());
      }
      if (!horasTotalesPorCobro.has(cobro)) {
        horasTotalesPorCobro.set(cobro, 0);
      }

      // Acumular horas por área en este cobro
      const areaMap = cobrosPorArea.get(cobro)!;
      areaMap.set(area, (areaMap.get(area) || 0) + horasTrabajadas);

      // Acumular total de horas del cobro
      horasTotalesPorCobro.set(
        cobro,
        horasTotalesPorCobro.get(cobro)! + horasTrabajadas
      );
    });

    console.log(`Cobros procesados con áreas: ${cobrosPorArea.size}`);

    // Paso 2: Distribuir facturación proporcionalmente por área
    const facturacionPorArea: Record<string, number> = {};

    cobrosPorArea.forEach((areaMap, cobro) => {
      const totalFacturado = facturadoPorCobro[cobro] || 0;
      const totalHoras = horasTotalesPorCobro.get(cobro) || 0;

      if (totalFacturado === 0 || totalHoras === 0) return;

      areaMap.forEach((horasArea, area) => {
        // Distribuir proporcionalmente según las horas de cada área
        const proporcion = horasArea / totalHoras;
        const facturacionArea = totalFacturado * proporcion;

        facturacionPorArea[area] =
          (facturacionPorArea[area] || 0) + facturacionArea;
      });
    });

    console.log(
      "Facturación distribuida por área:",
      Object.entries(facturacionPorArea).map(([area, total]) => ({
        area,
        total: total.toFixed(2),
      }))
    );

    // Verificar que la suma total no exceda el total facturado
    const sumaTotal = Object.values(facturacionPorArea).reduce(
      (sum, val) => sum + val,
      0
    );
    console.log(
      `Suma total facturación por área: $${sumaTotal.toLocaleString()}`
    );

    // Obtener todas las áreas únicas (unión de áreas con meta y áreas con facturación)
    const todasLasAreas = new Set([
      ...Object.keys(metasPorArea),
      ...Object.keys(facturacionPorArea),
    ]);

    // Construir el resultado final
    const resultado = Array.from(todasLasAreas)
      .map((area) => {
        const meta = metasPorArea[area] || 0;
        const facturacion = facturacionPorArea[area] || 0;
        const color = getAreaColor(area);

        return {
          area,
          meta,
          facturacion,
          color,
        };
      })
      .filter((item) => item.meta > 0 || item.facturacion > 0) // Solo incluir áreas con datos
      .sort((a, b) => b.facturacion - a.facturacion); // Ordenar por facturación descendente

    console.log("Resultado facturación por área:", resultado);
    console.log("=== FIN CÁLCULO FACTURACIÓN POR ÁREA ===");

    return resultado;
  };

  // Función auxiliar para calcular meta de facturación
  const calcularMetaFacturacion = async (
    fechaMin: Date | undefined,
    fechaMax: Date | undefined,
    areaFiltro: string
  ) => {
    console.log("=== INICIO CÁLCULO META FACTURACIÓN ===");
    console.log("FechaMin:", fechaMin);
    console.log("FechaMax:", fechaMax);
    console.log("Area Filtro:", areaFiltro);

    if (!fechaMin || !fechaMax) {
      console.log("❌ Sin fechas, retornando 0");
      return 0;
    }

    // Calcular primer día del mes de fechaMin (EOMONTH(FechaMin, -1) + 1)
    const firstDayOfStartMonth = new Date(
      Date.UTC(fechaMin.getFullYear(), fechaMin.getMonth(), 1)
    );

    // Calcular último día del mes de fechaMax (EOMONTH(FechaMax, 0))
    const lastDayOfEndMonth = new Date(
      Date.UTC(
        fechaMax.getFullYear(),
        fechaMax.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      )
    );

    console.log("Primer día mes inicio:", firstDayOfStartMonth.toISOString());
    console.log("Último día mes fin:", lastDayOfEndMonth.toISOString());

    // DEBUG: Ver qué hay en la tabla meta_facturacion
    const {
      data: allMetas,
      error: debugError,
      count,
    } = await supabase
      .from("meta_facturacion")
      .select("*", { count: "exact" })
      .limit(10);
    console.log("🔍 DEBUG meta_facturacion:");
    console.log("  - Error:", debugError);
    console.log("  - Count total:", count);
    console.log("  - Sample data:", allMetas);

    // Check user session
    const {
      data: { session },
    } = await supabase.auth.getSession();
    console.log("  - User authenticated:", session?.user?.id || "NO USER");

    // Query para obtener metas filtradas
    let metasQuery = supabase
      .from("meta_facturacion")
      .select('"Área Profesional", Meta, Mes')
      .gte("Mes", firstDayOfStartMonth.toISOString())
      .lte("Mes", lastDayOfEndMonth.toISOString());

    // Si hay un área específica seleccionada, primero obtener las áreas profesionales asociadas
    if (areaFiltro !== "all") {
      console.log("Filtrando por área específica:", areaFiltro);
      // Obtener todas las áreas profesionales únicas relacionadas con esta área de práctica
      const { data: areasData } = await supabase
        .from("horas_valor_cobrado")
        .select('"Área Profesional"')
        .not('"Área Profesional"', "is", null);

      if (areasData && areasData.length > 0) {
        const areasProfesionales = Array.from(
          new Set(
            areasData.map((a: any) => a["Área Profesional"]).filter(Boolean)
          )
        );

        console.log("Áreas profesionales encontradas:", areasProfesionales);

        // Filtrar por áreas profesionales encontradas
        metasQuery = metasQuery.in('"Área Profesional"', areasProfesionales);
      }
    }

    const { data: metas, error } = await metasQuery;

    console.log("Resultado query metas:");
    console.log("- Error:", error);
    console.log("- Cantidad registros:", metas?.length || 0);
    console.log("- Datos completos:", JSON.stringify(metas, null, 2));

    if (error) {
      console.error("❌ Error fetching metas:", error);
      return 0;
    }

    const metaTotal =
      metas?.reduce((sum, m) => {
        const metaValue = parseFloat(m.Meta as any) || 0;
        console.log(`  - ${m["Área Profesional"]} (${m.Mes}): $${metaValue}`);
        return sum + metaValue;
      }, 0) || 0;

    console.log(`✅ Meta Facturación TOTAL: $${metaTotal.toLocaleString()}`);
    console.log("=== FIN CÁLCULO META FACTURACIÓN ===");

    return metaTotal;
  };

  // Función auxiliar para calcular promedio días de facturación
  const calcularPromedioDiasFacturacion = async (
    cobrosUnicos: string[],
    areaFiltro: string,
    caseCodes: string[]
  ) => {
    if (cobrosUnicos.length === 0) return 0;

    const billingDaysDifferences: number[] = [];

    // Procesar en lotes para evitar queries muy grandes
    const batchSize = 100;
    for (let i = 0; i < cobrosUnicos.length; i += batchSize) {
      const batch = cobrosUnicos.slice(i, i + batchSize);

      // Para cada cobro, obtener todas sus horas (sin filtros de fecha)
      let queryAllHoras = supabase
        .from("horas_valor_cobrado")
        .select('"N° Cobro", "Trabajo (día)", "Fecha Facturación"')
        .in('"N° Cobro"', batch);

      if (areaFiltro !== "all" && caseCodes.length > 0) {
        queryAllHoras = queryAllHoras.in('"Código Asunto"', caseCodes);
      }

      const { data: horasForCobros } = await queryAllHoras;

      if (horasForCobros) {
        // Agrupar por N° Cobro y calcular diferencias
        const cobroMap = new Map<string, any[]>();
        horasForCobros.forEach((h: any) => {
          const cobro = h["N° Cobro"];
          if (!cobroMap.has(cobro)) {
            cobroMap.set(cobro, []);
          }
          cobroMap.get(cobro)!.push(h);
        });

        cobroMap.forEach((horasForCobro, cobroId) => {
          const workDates = horasForCobro
            .map((h: any) => h["Trabajo (día)"])
            .filter(Boolean)
            .map((d: any) => new Date(d));

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

            const diffInMs = billingDate.getTime() - lastWorkDate.getTime();
            const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24));

            billingDaysDifferences.push(diffInDays);
          }
        });
      }
    }

    console.log(
      `Promedio Días Facturación - ${billingDaysDifferences.length} cobros procesados`
    );

    return billingDaysDifferences.length > 0
      ? Math.round(
          billingDaysDifferences.reduce((sum, days) => sum + days, 0) /
            billingDaysDifferences.length
        )
      : 0;
  };

  // Función auxiliar para calcular promedio días de pago
  const calcularPromedioDiasPago = async (
    cobrosUnicos: string[],
    areaFiltro: string,
    caseCodes: string[]
  ) => {
    if (cobrosUnicos.length === 0) return 0;

    const paymentDaysDifferences: number[] = [];

    // Procesar en lotes para evitar queries muy grandes
    const batchSize = 100;
    for (let i = 0; i < cobrosUnicos.length; i += batchSize) {
      const batch = cobrosUnicos.slice(i, i + batchSize);

      // Para cada cobro, obtener todas sus horas (sin filtros de fecha)
      let queryAllHoras = supabase
        .from("horas_valor_cobrado")
        .select('"N° Cobro", "Fecha Facturación", "Fecha Pago"')
        .in('"N° Cobro"', batch);

      if (areaFiltro !== "all" && caseCodes.length > 0) {
        queryAllHoras = queryAllHoras.in('"Código Asunto"', caseCodes);
      }

      const { data: horasForCobros } = await queryAllHoras;

      if (horasForCobros) {
        // Agrupar por N° Cobro y calcular diferencias
        const cobroMap = new Map<string, any[]>();
        horasForCobros.forEach((h: any) => {
          const cobro = h["N° Cobro"];
          if (!cobroMap.has(cobro)) {
            cobroMap.set(cobro, []);
          }
          cobroMap.get(cobro)!.push(h);
        });

        cobroMap.forEach((horasForCobro, cobroId) => {
          const billingDates = horasForCobro
            .map((h: any) => h["Fecha Facturación"])
            .filter(Boolean)
            .map((d: any) => new Date(d));

          const paymentDates = horasForCobro
            .map((h: any) => h["Fecha Pago"])
            .filter(Boolean)
            .map((d: any) => new Date(d));

          if (billingDates.length > 0 && paymentDates.length > 0) {
            const billingDate = new Date(
              Math.max(...billingDates.map((d) => d.getTime()))
            );
            const paymentDate = new Date(
              Math.max(...paymentDates.map((d) => d.getTime()))
            );

            const diffInMs = paymentDate.getTime() - billingDate.getTime();
            const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24));

            paymentDaysDifferences.push(diffInDays);
          }
        });
      }
    }

    console.log(
      `Promedio Días Pago - ${paymentDaysDifferences.length} cobros procesados`
    );

    return paymentDaysDifferences.length > 0
      ? Math.round(
          paymentDaysDifferences.reduce((sum, days) => sum + days, 0) /
            paymentDaysDifferences.length
        )
      : 0;
  };

  // Track if this is the initial load
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    if (user) {
      const isFilterChange = !isInitialLoadRef.current;
      isInitialLoadRef.current = false;
      fetchDashboardData(isFilterChange);
    }
  }, [user, selectedArea, startDate, endDate, fetchDashboardData]);

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
      title: "Promedio días de pago",
      value: dashboardData?.promedioDiasPago || "0",
      description: "Días promedio entre facturación y pago",
      icon: DollarSign,
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

  const baseFacturacionData =
    chartData || dashboardData?.facturacionPorArea || [];
  const transformedFacturacionData = baseFacturacionData.map((item: any) => ({
    ...item,
    facturacion: transformFinalNumber(item.facturacion),
    meta: transformFinalNumber(item.meta),
  }));
  const transformedFormaCobroChart = (dashboardData?.formaCobroChart || []).map(
    (item: any) => ({
      ...item,
      value: transformFinalNumber(item.value),
    })
  );

  return (
    <DashboardLayout>
      <div className="space-y-4">
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

        {/* Gráfico Comparativo: Meta vs Facturación por Área */}
        <div
          className={`relative transition-opacity duration-200 ${
            isRefreshing ? "opacity-60" : "opacity-100"
          }`}
        >
          {baseFacturacionData && baseFacturacionData.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-foreground">
                  Meta vs Facturación por Área Profesional
                </CardTitle>
                <CardDescription>
                  Comparación entre meta de facturación y facturación real
                  <span className="ml-2 text-xs text-muted-foreground">
                    · Haz clic en una barra para filtrar
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <ResponsiveContainer width="100%" height={450}>
                  <ComposedChart
                    data={transformedFacturacionData}
                    margin={{ top: 5, right: 10, left: 5, bottom: 80 }}
                    onClick={(data) => {
                      if (data && data.activeLabel) {
                        const clickedArea = data.activeLabel;
                        // Filter everything, but keep chart data the same
                        if (selectedArea === clickedArea) {
                          setSelectedArea("all");
                        } else {
                          setSelectedArea(clickedArea);
                        }
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="area"
                      tick={{ fontSize: 9 }}
                      angle={-45}
                      textAnchor="end"
                      height={90}
                      interval={0}
                      tickFormatter={(value) => {
                        const maxLength = 15;
                        return value.length > maxLength
                          ? value.substring(0, maxLength) + "..."
                          : value;
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) =>
                        `$${Math.round(value / 1000000)}M`
                      }
                    />
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const metaData = payload.find(
                            (p) => p.dataKey === "meta"
                          );
                          const facturacionData = payload.find(
                            (p) => p.dataKey === "facturacion"
                          );
                          const metaValue = metaData?.value || 0;
                          const facturacionValue = facturacionData?.value || 0;
                          const areaName = payload[0].payload.area;
                          const isFiltered = selectedArea === areaName;

                          return (
                            <div className="bg-white p-3 border rounded shadow-lg">
                              <p className="text-sm font-bold mb-2 flex items-center gap-2">
                                {areaName}
                                {isFiltered && (
                                  <Badge
                                    variant="default"
                                    className="text-xs px-1.5 py-0.5"
                                  >
                                    Filtrado
                                  </Badge>
                                )}
                              </p>
                              <p className="text-sm text-purple-600">
                                Meta: ${Number(metaValue).toLocaleString()}
                              </p>
                              <p className="text-sm text-emerald-600">
                                Facturación: $
                                {Number(facturacionValue).toLocaleString()}
                              </p>
                              <p className="text-sm text-gray-600 mt-1">
                                Cumplimiento:{" "}
                                {Number(metaValue) > 0
                                  ? (
                                      (Number(facturacionValue) /
                                        Number(metaValue)) *
                                      100
                                    ).toFixed(1)
                                  : 0}
                                %
                              </p>
                              <p className="text-xs text-gray-500 mt-2 italic">
                                {isFiltered
                                  ? "Haz clic para deseleccionar"
                                  : "Haz clic para filtrar por esta área"}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: "10px" }}
                      formatter={(value) =>
                        value === "meta" ? "Meta" : "Facturación"
                      }
                    />
                    <Bar
                      dataKey="facturacion"
                      name="facturacion"
                      cursor="pointer"
                    >
                      {baseFacturacionData.map((entry: any, index: number) => {
                        const isFiltered = selectedArea === entry.area;
                        const hasFilter = selectedArea !== "all";

                        // Visual states:
                        // - No filter: all bars at 0.85 opacity
                        // - Filter active & selected: 1 opacity + black stroke
                        // - Filter active & not selected: 0.3 opacity
                        const opacity = hasFilter
                          ? isFiltered
                            ? 1
                            : 0.3
                          : 0.85;

                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            fillOpacity={opacity}
                            stroke={isFiltered && hasFilter ? "#000" : "none"}
                            strokeWidth={isFiltered && hasFilter ? 3 : 0}
                          />
                        );
                      })}
                    </Bar>
                    <Line
                      type="monotone"
                      dataKey="meta"
                      stroke="#9333ea"
                      strokeWidth={3}
                      dot={{ r: 5, fill: "#9333ea" }}
                      activeDot={{ r: 7 }}
                      name="meta"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Charts Section */}
        {(dashboardData?.statusChart && dashboardData.statusChart.length > 0) ||
        (transformedFormaCobroChart &&
          transformedFormaCobroChart.length > 0) ? (
          <div
            className={`grid grid-cols-1 lg:grid-cols-2 gap-4 transition-opacity duration-200 ${
              isRefreshing ? "opacity-60" : "opacity-100"
            }`}
          >
            {/* Status Distribution */}
            {dashboardData?.statusChart &&
              dashboardData.statusChart.length > 0 && (
                <Card className="border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-foreground">
                      Facturación según Estado de Liquidación
                    </CardTitle>
                    <CardDescription>
                      Distribución por estado de facturación
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={dashboardData.statusChart}
                          cx="45%"
                          cy="50%"
                          labelLine={false}
                          label={false}
                          outerRadius={90}
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
                                    {payload[0].value} liquidaciones ({percent}
                                    %)
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
                            const percent = ((itemValue / total) * 100).toFixed(
                              0
                            );
                            return `${value}: ${percent}%`;
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

            {/* Forma de Cobro Distribution */}
            {transformedFormaCobroChart &&
              transformedFormaCobroChart.length > 0 && (
                <Card className="border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-foreground">
                      Facturación según Forma de Cobro
                    </CardTitle>
                    <CardDescription>
                      Distribución de facturación por forma de cobro
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={transformedFormaCobroChart}
                          cx="45%"
                          cy="50%"
                          labelLine={false}
                          label={false}
                          outerRadius={90}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {transformedFormaCobroChart.map(
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
                              const total = transformedFormaCobroChart.reduce(
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
                                    ${Number(payload[0].value).toLocaleString()}{" "}
                                    ({percent}%)
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
                            const total = transformedFormaCobroChart.reduce(
                              (sum: number, item: { value: number }) =>
                                sum + item.value,
                              0
                            );
                            const itemValue = entry.payload?.value || 0;
                            const percent = ((itemValue / total) * 100).toFixed(
                              0
                            );
                            return `${value}: ${percent}%`;
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
        ) : null}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
