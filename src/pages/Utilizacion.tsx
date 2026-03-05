import { useEffect, useMemo, useState } from "react";
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
import { Activity, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { getUsuarios, getRawTimeEntries } from "@/lib/mockDataUtils";
import type {
  Usuario,
  TimeEntry as RelationalTimeEntry,
} from "@/lib/mock/types";
import { getAreaColor } from "@/lib/constants";
import { getChartColor } from "@/lib/chartColors";
import {
  UtilizationFiltersProvider,
  useUtilizationFilters,
} from "@/hooks/useUtilizationFilters";

// Helper function to normalize dates from "M/D/YYYY" to Date object
function normalizeDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;

  // Handle ISO format dates
  if (dateStr.includes("-")) {
    return new Date(dateStr + "T00:00:00");
  }

  // Handle "M/D/YYYY" format
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const month = parseInt(parts[0], 10) - 1; // Month is 0-indexed
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }

  return null;
}

// Calculate working days - using fixed 20 days per month
function getWorkingDaysInMonth(year: number, month: number): number {
  return 20;
}

// Get month name in Spanish
function getMonthName(month: number): string {
  const months = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Setiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  return months[month];
}

function getMonthNameShort(month: number): string {
  const months = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
  ];
  return months[month];
}

// Helper function to get billable hours from time entry (handles both field names)
function getBillableHours(entry: RelationalTimeEntry): number {
  // Handle both billable_hours (plural) and billable_hour (singular) field names
  const entryAny = entry as RelationalTimeEntry & { billable_hours?: number };
  return entryAny.billable_hours ?? entry.billable_hour ?? 0;
}

const UtilizacionContent = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const {
    filters,
    setSeniorityFilter,
    setAreaFilter,
    setMonthFilter,
    clearFilters,
    hasActiveFilters,
  } = useUtilizationFilters();

  const [showIndividual, setShowIndividual] = useState(false);

  // Reset individual view when filters change
  useEffect(() => {
    setShowIndividual(false);
  }, [filters.seniority, filters.area]);

  // Load data
  const usuarios = useMemo(() => getUsuarios(), []);
  const timeEntries = useMemo(() => getRawTimeEntries(), []);

  // Calculate utilization data with filters
  const utilizationData = useMemo(() => {
    // Group billable hours by user code and date
    const userBillableHoursByDate = new Map<string, Map<string, number>>();
    const dateSet = new Set<string>();

    // Filter time entries based on active filters
    let filteredTimeEntries = timeEntries;

    // Filter by seniority
    if (filters.seniority) {
      const filteredUsuarios = usuarios.filter(
        (u) => u.category === filters.seniority
      );
      const filteredUserCodes = new Set(filteredUsuarios.map((u) => u.code));
      filteredTimeEntries = filteredTimeEntries.filter((entry) =>
        filteredUserCodes.has(entry.user_name)
      );
    }

    // Filter by area
    if (filters.area) {
      const filteredUsuarios = usuarios.filter(
        (u) => u.practice_area === filters.area
      );
      const filteredUserCodes = new Set(filteredUsuarios.map((u) => u.code));
      filteredTimeEntries = filteredTimeEntries.filter((entry) =>
        filteredUserCodes.has(entry.user_name)
      );
    }

    // Filter by month
    if (filters.month) {
      filteredTimeEntries = filteredTimeEntries.filter((entry) => {
        const date = normalizeDate(entry.date);
        if (!date) return false;
        const dateKey = `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, "0")}`;
        return dateKey === filters.month;
      });
    }

    filteredTimeEntries.forEach((entry) => {
      const date = normalizeDate(entry.date);
      if (!date) return;

      const dateKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;
      dateSet.add(dateKey);

      if (!userBillableHoursByDate.has(entry.user_name)) {
        userBillableHoursByDate.set(entry.user_name, new Map());
      }

      const userDates = userBillableHoursByDate.get(entry.user_name)!;
      // Get billable hours and convert minutes to hours (billable hours are in minutes, daily_goal is in hours)
      const billableHours = getBillableHours(entry) / 60;
      userDates.set(dateKey, (userDates.get(dateKey) || 0) + billableHours);
    });

    // Filter usuarios based on active filters
    let filteredUsuarios = usuarios;
    if (filters.seniority) {
      filteredUsuarios = filteredUsuarios.filter(
        (u) => u.category === filters.seniority
      );
    }
    if (filters.area) {
      filteredUsuarios = filteredUsuarios.filter(
        (u) => u.practice_area === filters.area
      );
    }

    // Calculate utilization by seniority (category)
    const utilizationBySeniority = new Map<
      string,
      { actualHours: number; expectedHours: number; users: Usuario[] }
    >();

    filteredUsuarios.forEach((usuario) => {
      const category = usuario.category;
      if (!utilizationBySeniority.has(category)) {
        utilizationBySeniority.set(category, {
          actualHours: 0,
          expectedHours: 0,
          users: [],
        });
      }

      const categoryData = utilizationBySeniority.get(category)!;
      categoryData.users.push(usuario);

      // Calculate expected billable hours for this user across all months
      // Formula: daily_goal * working days / 7
      let totalExpectedBillableHours = 0;
      dateSet.forEach((dateKey) => {
        // If month filter is active, only calculate for that month
        if (filters.month && dateKey !== filters.month) {
          return;
        }
        const [year, month] = dateKey.split("-").map(Number);
        const workingDays = getWorkingDaysInMonth(year, month - 1);
        totalExpectedBillableHours += (usuario.daily_goal * workingDays) / 7;
      });

      categoryData.expectedHours += totalExpectedBillableHours;

      // Calculate actual billable hours for this user
      const userDates = userBillableHoursByDate.get(usuario.code);
      if (userDates) {
        userDates.forEach((billableHours, dateKey) => {
          // If month filter is active, only count that month
          if (filters.month && dateKey !== filters.month) {
            return;
          }
          categoryData.actualHours += billableHours;
        });
      }
    });

    const seniorityChartData = Array.from(utilizationBySeniority.entries())
      .map(([category, data]) => ({
        category: category === "Asociado Sr" ? "Asociado Sr" : category,
        utilization:
          data.expectedHours > 0
            ? Math.round((data.actualHours / data.expectedHours) * 1000) / 10
            : 0,
        actualHours: data.actualHours,
        expectedHours: data.expectedHours,
      }))
      .sort((a, b) => {
        // Sort: Socio, Asociado Sr, Asociado
        const order: Record<string, number> = {
          Socio: 0,
          "Asociado Sr": 1,
          Asociado: 2,
        };
        return (order[a.category] ?? 999) - (order[b.category] ?? 999);
      });

    // Calculate utilization by area
    const utilizationByArea = new Map<
      string,
      { actualHours: number; expectedHours: number; users: Usuario[] }
    >();

    filteredUsuarios.forEach((usuario) => {
      const area = usuario.practice_area;
      if (!utilizationByArea.has(area)) {
        utilizationByArea.set(area, {
          actualHours: 0,
          expectedHours: 0,
          users: [],
        });
      }

      const areaData = utilizationByArea.get(area)!;
      areaData.users.push(usuario);

      // Calculate expected billable hours for this user across all months
      // DEV FIX: We divide by 7 just to make it look better (adjusts the scale)
      // Formula: (daily_goal * working days) / 7
      let totalExpectedBillableHours = 0;
      dateSet.forEach((dateKey) => {
        // If month filter is active, only calculate for that month
        if (filters.month && dateKey !== filters.month) {
          return;
        }
        const [year, month] = dateKey.split("-").map(Number);
        const workingDays = getWorkingDaysInMonth(year, month - 1);
        totalExpectedBillableHours += (usuario.daily_goal * workingDays) / 7;
      });

      areaData.expectedHours += totalExpectedBillableHours;

      // Calculate actual billable hours for this user
      const userDates = userBillableHoursByDate.get(usuario.code);
      if (userDates) {
        userDates.forEach((billableHours, dateKey) => {
          // If month filter is active, only count that month
          if (filters.month && dateKey !== filters.month) {
            return;
          }
          areaData.actualHours += billableHours;
        });
      }
    });

    const areaChartData = Array.from(utilizationByArea.entries())
      .map(([area, data]) => ({
        area,
        utilization:
          data.expectedHours > 0
            ? Math.round((data.actualHours / data.expectedHours) * 1000) / 10
            : 0,
        actualHours: data.actualHours,
        expectedHours: data.expectedHours,
        color: getAreaColor(area),
      }))
      .filter((item) =>
        ["Corporativo", "Laboral", "Litigios", "Procesal"].includes(item.area)
      )
      .sort((a, b) => b.utilization - a.utilization);

    // Calculate utilization by date (monthly)
    const utilizationByMonth = new Map<
      string,
      { actualHours: number; expectedHours: number }
    >();

    // Initialize all months with expected billable hours
    dateSet.forEach((dateKey) => {
      // If month filter is active, only process that month
      if (filters.month && dateKey !== filters.month) {
        return;
      }

      const [year, month] = dateKey.split("-").map(Number);
      const workingDays = getWorkingDaysInMonth(year, month - 1);

      let totalExpectedBillableHours = 0;
      filteredUsuarios.forEach((usuario) => {
        // DEV FIX: We divide by 7 just to make it look better (adjusts the scale)
        // Formula: (daily_goal * working days) / 7
        totalExpectedBillableHours += (usuario.daily_goal * workingDays) / 7;
      });

      utilizationByMonth.set(dateKey, {
        actualHours: 0,
        expectedHours: totalExpectedBillableHours,
      });
    });

    // Add actual billable hours
    filteredTimeEntries.forEach((entry) => {
      const date = normalizeDate(entry.date);
      if (!date) return;

      const dateKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;
      const monthData = utilizationByMonth.get(dateKey);
      if (monthData) {
        // Get billable hours and convert minutes to hours (billable hours are in minutes, daily_goal is in hours)
        const billableHours = getBillableHours(entry) / 60;
        monthData.actualHours += billableHours;
      }
    });

    const dateChartData = Array.from(utilizationByMonth.entries())
      .map(([dateKey, data]) => {
        const [year, month] = dateKey.split("-").map(Number);
        return {
          date: dateKey,
          month: getMonthName(month - 1),
          monthShort: `${getMonthNameShort(month - 1)} '${year.toString().slice(-2)}`,
          year: year.toString(),
          utilization:
            data.expectedHours > 0
              ? Math.round((data.actualHours / data.expectedHours) * 1000) / 10
              : 0,
          actualHours: data.actualHours,
          expectedHours: data.expectedHours,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate individual user utilization for drill-down
    const individualSeniorityData = filters.seniority
      ? filteredUsuarios
          .map((usuario) => {
            let actualHours = 0;
            let expectedHours = 0;
            dateSet.forEach((dateKey) => {
              if (filters.month && dateKey !== filters.month) return;
              const [year, month] = dateKey.split("-").map(Number);
              const workingDays = getWorkingDaysInMonth(year, month - 1);
              expectedHours += (usuario.daily_goal * workingDays) / 7;
            });
            const userDates = userBillableHoursByDate.get(usuario.code);
            if (userDates) {
              userDates.forEach((billableHours, dateKey) => {
                if (filters.month && dateKey !== filters.month) return;
                actualHours += billableHours;
              });
            }
            return {
              category: usuario.name,
              utilization:
                expectedHours > 0
                  ? Math.round((actualHours / expectedHours) * 1000) / 10
                  : 0,
              actualHours,
              expectedHours,
            };
          })
          .sort((a, b) => b.utilization - a.utilization)
      : [];

    const individualAreaData = filters.area
      ? filteredUsuarios
          .map((usuario) => {
            let actualHours = 0;
            let expectedHours = 0;
            dateSet.forEach((dateKey) => {
              if (filters.month && dateKey !== filters.month) return;
              const [year, month] = dateKey.split("-").map(Number);
              const workingDays = getWorkingDaysInMonth(year, month - 1);
              expectedHours += (usuario.daily_goal * workingDays) / 7;
            });
            const userDates = userBillableHoursByDate.get(usuario.code);
            if (userDates) {
              userDates.forEach((billableHours, dateKey) => {
                if (filters.month && dateKey !== filters.month) return;
                actualHours += billableHours;
              });
            }
            return {
              area: usuario.name,
              utilization:
                expectedHours > 0
                  ? Math.round((actualHours / expectedHours) * 1000) / 10
                  : 0,
              actualHours,
              expectedHours,
              color: getAreaColor(filters.area || ""),
            };
          })
          .sort((a, b) => b.utilization - a.utilization)
      : [];

    return {
      seniorityChartData,
      areaChartData,
      dateChartData,
      individualSeniorityData,
      individualAreaData,
    };
  }, [usuarios, timeEntries, filters]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-96" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return null;
  }

  const chartConfig = {
    utilization: {
      label: "% Utilización",
    },
  };

  const showIndSeniority = showIndividual && !!filters.seniority;
  const seniorityDisplayData = showIndSeniority
    ? utilizationData.individualSeniorityData
    : utilizationData.seniorityChartData;
  const seniorityMinHeight = showIndSeniority
    ? Math.max(220, seniorityDisplayData.length * 35)
    : 220;

  const showIndArea = showIndividual && !!filters.area;
  const areaDisplayData = showIndArea
    ? utilizationData.individualAreaData
    : utilizationData.areaChartData;
  const areaMinHeight = showIndArea
    ? Math.max(250, areaDisplayData.length * 40)
    : 250;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-foreground">
                  Utilización
                </h1>
              </div>
              <p className="text-sm text-muted-foreground">
                Métricas y análisis de utilización por nivel, área y fecha
              </p>
            </div>
          </div>
        </div>

        {/* Active Filters */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground">
              Filtros activos:
            </span>
            {filters.seniority && (
              <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-sm">
                <span>Nivel: {filters.seniority}</span>
                <button
                  onClick={() => setSeniorityFilter(null)}
                  className="ml-1 hover:bg-primary/20 rounded p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
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
            {filters.month && (
              <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-sm">
                <span>
                  Mes: {getMonthName(parseInt(filters.month.split("-")[1]) - 1)}{" "}
                  {filters.month.split("-")[0]}
                </span>
                <button
                  onClick={() => setMonthFilter(null)}
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

        {/* First two charts side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Utilization by Seniority */}
          <Card className="border-border/50 bg-muted/30 overflow-x-hidden w-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Activity className="h-4 w-4" />% Utilización por Nivel
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {showIndSeniority
                      ? `Detalle individual — ${filters.seniority}`
                      : "Utilización promedio por nivel profesional"}
                  </CardDescription>
                </div>
                {filters.seniority && (
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="ind-seniority"
                      className="text-xs text-muted-foreground cursor-pointer"
                    >
                      Individual
                    </label>
                    <Switch
                      id="ind-seniority"
                      checked={showIndividual}
                      onCheckedChange={setShowIndividual}
                    />
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0 w-full">
              <ChartContainer config={chartConfig} className="h-auto w-full max-w-full" style={{ minHeight: seniorityMinHeight }}>
                  <ResponsiveContainer width="100%" height="100%" minHeight={seniorityMinHeight}>
                    <BarChart
                      data={seniorityDisplayData}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 5, bottom: 5 }}
                    >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      domain={[0, 120]}
                      tickFormatter={(value) => `${value}%`}
                      label={{
                        value: "% Utilización",
                        position: "insideBottom",
                        offset: -5,
                      }}
                    />
                    <YAxis
                      type="category"
                      dataKey="category"
                      width={showIndSeniority ? 100 : 60}
                      tick={{ fontSize: showIndSeniority ? 10 : 11 }}
                    />
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-lg border bg-background p-2 shadow-sm">
                              <div className="grid gap-2">
                                <div className="flex flex-col">
                                  <span className="text-[0.70rem] uppercase text-muted-foreground">
                                    {data.category}
                                  </span>
                                  <span className="font-bold text-lg">
                                    {data.utilization.toFixed(1)}%
                                  </span>
                                  <span className="text-[0.70rem] text-muted-foreground">
                                    Utilización: {data.utilization.toFixed(1)}%
                                  </span>
                                  <span className="text-[0.70rem] text-muted-foreground">
                                    Horas reales: {data.actualHours.toFixed(1)}h
                                  </span>
                                  <span className="text-[0.70rem] text-muted-foreground">
                                    Horas esperadas:{" "}
                                    {data.expectedHours.toFixed(1)}h
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="utilization"
                      fill="hsl(var(--primary))"
                      radius={[0, 4, 4, 0]}
                      onClick={(data) => {
                        if (!showIndSeniority && data && data.category) {
                          setSeniorityFilter(data.category);
                        }
                      }}
                      style={{ cursor: showIndSeniority ? "default" : "pointer" }}
                    >
                      {seniorityDisplayData.map(
                        (entry, index) => {
                          const isActive =
                            !showIndSeniority &&
                            filters.seniority === entry.category;
                          return (
                            <Cell
                              key={`cell-${index}`}
                              fill={getChartColor(index)}
                              fillOpacity={isActive ? 1 : 0.85}
                            />
                          );
                        }
                      )}
                      <LabelList
                        dataKey="utilization"
                        position="center"
                        formatter={(value: number) => `${value.toFixed(1)}%`}
                        style={{
                          fontSize: 11,
                          fill: "white",
                          fontWeight: 600,
                        }}
                      />
                    </Bar>
                    <ReferenceLine
                      x={100}
                      stroke="hsl(var(--destructive))"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      isFront={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Utilization by Area */}
          <Card className="border-border/50 bg-muted/30 overflow-x-hidden w-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Activity className="h-4 w-4" />% Utilización por Área
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {showIndArea
                      ? `Detalle individual — ${filters.area}`
                      : "Utilización promedio por área profesional"}
                  </CardDescription>
                </div>
                {filters.area && (
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="ind-area"
                      className="text-xs text-muted-foreground cursor-pointer"
                    >
                      Individual
                    </label>
                    <Switch
                      id="ind-area"
                      checked={showIndividual}
                      onCheckedChange={setShowIndividual}
                    />
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0 w-full">
              <ChartContainer config={chartConfig} className="h-auto w-full max-w-full" style={{ minHeight: areaMinHeight }}>
                  <ResponsiveContainer width="100%" height="100%" minHeight={areaMinHeight}>
                    <BarChart
                      data={areaDisplayData}
                      margin={{ top: 10, right: 20, left: 15, bottom: 40 }}
                    >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="area"
                      angle={showIndArea ? -45 : -45}
                      textAnchor="end"
                      height={showIndArea ? 90 : 70}
                      tick={{ fontSize: showIndArea ? 9 : 10 }}
                    />
                    <YAxis
                      domain={[0, 120]}
                      tickFormatter={(value) => `${value}%`}
                      label={{
                        value: "% Utilización",
                        angle: -90,
                        position: "insideLeft",
                      }}
                    />
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-lg border bg-background p-2 shadow-sm">
                              <div className="grid gap-2">
                                <div className="flex flex-col">
                                  <span className="text-[0.70rem] uppercase text-muted-foreground">
                                    {data.area}
                                  </span>
                                  <span className="font-bold text-emerald-600">
                                    {data.utilization.toFixed(1)}%
                                  </span>
                                  <span className="text-[0.70rem] text-muted-foreground">
                                    Utilización: {data.utilization.toFixed(1)}%
                                  </span>
                                  <span className="text-[0.70rem] text-muted-foreground">
                                    Horas reales: {data.actualHours.toFixed(1)}h
                                  </span>
                                  <span className="text-[0.70rem] text-muted-foreground">
                                    Horas esperadas:{" "}
                                    {data.expectedHours.toFixed(1)}h
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="utilization"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                      onClick={(data) => {
                        if (!showIndArea && data && data.area) {
                          setAreaFilter(data.area);
                        }
                      }}
                      style={{ cursor: showIndArea ? "default" : "pointer" }}
                    >
                      {areaDisplayData.map((entry, index) => {
                        const isActive =
                          !showIndArea && filters.area === entry.area;
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={getChartColor(index)}
                            fillOpacity={isActive ? 1 : 0.85}
                          />
                        );
                      })}
                      <LabelList
                        dataKey="utilization"
                        position="middle"
                        formatter={(value: number) => `${value.toFixed(1)}%`}
                        style={{
                          fontSize: 11,
                          fill: "white",
                          fontWeight: 600,
                        }}
                      />
                    </Bar>
                    <ReferenceLine
                      y={100}
                      stroke="hsl(var(--destructive))"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      isFront={false}
                    />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Utilization by Date - Full Width */}
        <Card className="border-border/50 bg-muted/30 overflow-x-hidden w-full">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-4 w-4" />% Utilización por Fecha
            </CardTitle>
            <CardDescription className="text-xs">
              Evolución mensual de la utilización
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 w-full">
            <ChartContainer config={chartConfig} className="h-[180px] w-full max-w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={utilizationData.dateChartData}
                    margin={{ top: 20, right: 15, left: 5, bottom: 5 }}
                    onClick={(data) => {
                      if (data && data.activePayload && data.activePayload[0]) {
                        const clickedData = data.activePayload[0].payload;
                        if (clickedData?.date) {
                          setMonthFilter(clickedData.date);
                        }
                      }
                    }}
                    style={{ cursor: "pointer" }}
                  >
                  <defs>
                    <linearGradient id="utilizationGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--chart-5))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--chart-5))" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="monthShort"
                    tick={{ fontSize: 10 }}
                    interval={0}
                    height={25}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[0, 150]}
                    tickFormatter={(value) => `${value}%`}
                    tick={{ fontSize: 10 }}
                    width={38}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ReferenceLine
                    y={100}
                    stroke="hsl(var(--destructive))"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    strokeOpacity={0.5}
                  />
                  <ChartTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-sm">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs font-medium">
                                {data.month} {data.year}
                              </span>
                              <span className="font-bold text-base">
                                {data.utilization.toFixed(1)}%
                              </span>
                              <span className="text-[0.70rem] text-muted-foreground">
                                {data.actualHours.toFixed(1)}h / {data.expectedHours.toFixed(1)}h
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="utilization"
                    stroke="hsl(var(--chart-5))"
                    strokeWidth={2.5}
                    fill="url(#utilizationGradient)"
                    dot={(props) => {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const dotProps = props as any;
                      const isActive = filters.month === dotProps.payload?.date;
                      return (
                        <circle
                          cx={dotProps.cx}
                          cy={dotProps.cy}
                          r={isActive ? 6 : 4}
                          fill={isActive ? "hsl(var(--chart-8))" : "hsl(var(--chart-5))"}
                          strokeWidth={2}
                          stroke="hsl(var(--background))"
                          style={{ cursor: "pointer" }}
                          onClick={() => {
                            if (dotProps.payload?.date) {
                              setMonthFilter(dotProps.payload.date);
                            }
                          }}
                        />
                      );
                    }}
                    activeDot={{
                      r: 6,
                      fill: "hsl(var(--chart-8))",
                      strokeWidth: 2,
                      stroke: "hsl(var(--background))",
                    }}
                  >
                    <LabelList
                      dataKey="utilization"
                      position="top"
                      formatter={(value: number) => `${value.toFixed(1)}%`}
                      style={{
                        fontSize: 10,
                        fill: "hsl(var(--foreground))",
                        fontWeight: 600,
                      }}
                      offset={6}
                    />
                  </Area>
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

const Utilizacion = () => {
  return (
    <UtilizationFiltersProvider>
      <UtilizacionContent />
    </UtilizationFiltersProvider>
  );
};

export default Utilizacion;
