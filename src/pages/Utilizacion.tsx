import { useEffect, useMemo } from "react";
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
            ? (data.actualHours / data.expectedHours) * 100
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
            ? (data.actualHours / data.expectedHours) * 100
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
          year: year.toString(),
          utilization:
            data.expectedHours > 0
              ? (data.actualHours / data.expectedHours) * 100
              : 0,
          actualHours: data.actualHours,
          expectedHours: data.expectedHours,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      seniorityChartData,
      areaChartData,
      dateChartData,
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
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-4 w-4" />% Utilización por Nivel
              </CardTitle>
              <CardDescription className="text-xs">
                Utilización promedio por nivel profesional
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ChartContainer config={chartConfig} className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={utilizationData.seniorityChartData}
                    layout="vertical"
                    margin={{ top: 30, right: 50, left: 70, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      domain={[0, 150]}
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
                      width={70}
                      tick={{ fontSize: 12 }}
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
                        if (data && data.category) {
                          setSeniorityFilter(data.category);
                        }
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      {utilizationData.seniorityChartData.map(
                        (entry, index) => {
                          const isActive = filters.seniority === entry.category;
                          // Use primary color variations similar to Top20Clientes
                          const PRIMARY_COLORS = [
                            "hsl(210 55% 23%)", // Base primary (darkest)
                            "hsl(210 55% 35%)", // Medium-dark
                            "hsl(210 55% 47%)", // Medium
                            "hsl(210 55% 59%)", // Medium-light
                            "hsl(210 55% 71%)", // Light
                          ];
                          const baseColor =
                            PRIMARY_COLORS[index % PRIMARY_COLORS.length];
                          return (
                            <Cell
                              key={`cell-${index}`}
                              fill={
                                isActive
                                  ? "hsl(var(--primary))"
                                  : entry.utilization >= 100
                                  ? baseColor
                                  : entry.utilization >= 85
                                  ? baseColor.replace(/\d+%\)/, "59%)")
                                  : baseColor.replace(/\d+%\)/, "71%)")
                              }
                            />
                          );
                        }
                      )}
                      <LabelList
                        dataKey="utilization"
                        position="right"
                        formatter={(value: number) => `${value.toFixed(1)}%`}
                        style={{
                          fontSize: 11,
                          fill: "hsl(var(--foreground))",
                          fontWeight: 600,
                        }}
                        offset={8}
                      />
                    </Bar>
                    <ReferenceLine
                      x={100}
                      stroke="hsl(var(--destructive))"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      label={{ value: "Meta 100%", position: "top" }}
                      isFront
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Utilization by Area */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-4 w-4" />% Utilización por Área
              </CardTitle>
              <CardDescription className="text-xs">
                Utilización promedio por área profesional
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ChartContainer config={chartConfig} className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={utilizationData.areaChartData}
                    margin={{ top: 25, right: 80, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="area"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      domain={[0, 150]}
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
                        if (data && data.area) {
                          setAreaFilter(data.area);
                        }
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      {utilizationData.areaChartData.map((entry, index) => {
                        const isActive = filters.area === entry.area;
                        // Use primary color variations similar to Top20Clientes
                        const PRIMARY_COLORS = [
                          "hsl(210 55% 23%)", // Base primary (darkest)
                          "hsl(210 55% 35%)", // Medium-dark
                          "hsl(210 55% 47%)", // Medium
                          "hsl(210 55% 59%)", // Medium-light
                          "hsl(210 55% 71%)", // Light
                        ];
                        const baseColor =
                          entry.color ||
                          PRIMARY_COLORS[index % PRIMARY_COLORS.length];
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              isActive
                                ? "hsl(var(--primary))"
                                : entry.utilization >= 100
                                ? baseColor
                                : entry.utilization >= 85
                                ? baseColor.replace(/\d+%\)/, "59%)")
                                : baseColor.replace(/\d+%\)/, "71%)")
                            }
                          />
                        );
                      })}
                      <LabelList
                        dataKey="utilization"
                        position="top"
                        formatter={(value: number) => `${value.toFixed(1)}%`}
                        style={{
                          fontSize: 11,
                          fill: "hsl(var(--foreground))",
                          fontWeight: 600,
                        }}
                        offset={5}
                      />
                    </Bar>
                    <ReferenceLine
                      y={100}
                      stroke="hsl(var(--destructive))"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      label={{ value: "Meta 100%", position: "right" }}
                      isFront
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Utilization by Date - Full Width */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-4 w-4" />% Utilización por Fecha
            </CardTitle>
            <CardDescription className="text-xs">
              Evolución mensual de la utilización
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 px-0 w-full">
            <ChartContainer config={chartConfig} className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={utilizationData.dateChartData}
                  margin={{ top: 20, right: 80, left: 70, bottom: 50 }}
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
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    domain={[0, 150]}
                    tickFormatter={(value) => `${value}%`}
                    tick={{ fontSize: 11 }}
                    label={{
                      value: "% Utilización",
                      angle: -90,
                      position: "insideLeft",
                      style: { textAnchor: "middle", fontSize: 12 },
                    }}
                  />
                  <ReferenceLine
                    y={100}
                    stroke="hsl(var(--destructive))"
                    strokeWidth={2.5}
                    strokeDasharray="5 5"
                    strokeOpacity={0.4}
                    label={{
                      value: "Meta 100%",
                      position: "right",
                      fontSize: 11,
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
                                  {data.month} {data.year}
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
                  <Line
                    type="linear"
                    dataKey="utilization"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    dot={(props) => {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const dotProps = props as any;
                      const isActive = filters.month === dotProps.payload?.date;
                      return (
                        <circle
                          cx={dotProps.cx}
                          cy={dotProps.cy}
                          r={isActive ? 7 : 5}
                          fill="hsl(var(--primary))"
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
                      r: 7,
                      fill: "hsl(var(--primary))",
                      strokeWidth: 2,
                      stroke: "hsl(var(--background))",
                    }}
                  >
                    <LabelList
                      dataKey="utilization"
                      position="top"
                      formatter={(value: number) => `${value.toFixed(1)}%`}
                      style={{
                        fontSize: 11,
                        fill: "hsl(var(--foreground))",
                        fontWeight: 600,
                      }}
                      offset={8}
                    />
                  </Line>
                </LineChart>
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
