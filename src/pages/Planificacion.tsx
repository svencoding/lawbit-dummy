import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Activity,
  ChevronDown,
  ChevronRight,
  PenLine,
  MessageSquare,
  X,
  AlertTriangle,
  Fuel,
  Crosshair,
} from "lucide-react";
import {
  ComposedChart,
  BarChart,
  Bar,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from "recharts";
import { getChartColor } from "@/lib/chartColors";
import { getAreaColor } from "@/lib/constants";
import { useBudgetData } from "@/hooks/useBudgetData";
import { BudgetEntryDialog } from "@/components/BudgetEntryDialog";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type SortField =
  | "practice_area"
  | "professional_count"
  | "planned_revenue"
  | "actual_revenue"
  | "revenue_variance"
  | "revenue_pct"
  | "planned_cost"
  | "actual_cost"
  | "target_utilization"
  | "actual_utilization"
  | "profit_margin";

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toLocaleString()}`;
}

function formatCurrencyFull(value: number): string {
  return `$${value.toLocaleString()}`;
}

export default function Planificacion() {
  const [year, setYear] = useState(2025);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedArea, setExpandedArea] = useState<string | null>(null);
  const [chartArea, setChartArea] = useState<string | null>(null);
  const [chartView, setChartView] = useState<"general" | "areas">("general");
  const [sortField, setSortField] = useState<SortField>("actual_revenue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const {
    budgetEntries,
    timelineData,
    breakdownData,
    kpis,
    allAreas,
    professionalCounts,
    actuals,
    monthsElapsed,
    updateBudgetForArea,
    setAnnualTargets,
    setNote,
    getNote,
  } = useBudgetData(year);

  // Sort breakdown
  const sortedBreakdown = useMemo(() => {
    return [...breakdownData].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return sortDir === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [breakdownData, sortField, sortDir]);

  // Collect notes per month for chart dots
  const chartNotes = useMemo(() => {
    const notesMap = new Map<number, string[]>();
    for (let m = 1; m <= 12; m++) {
      const areas = chartArea ? [chartArea] : allAreas;
      const monthNotes: string[] = [];
      areas.forEach((area) => {
        const note = getNote(area, m);
        if (note) {
          monthNotes.push(chartArea ? note : `${area}: ${note}`);
        }
      });
      if (monthNotes.length > 0) {
        notesMap.set(m, monthNotes);
      }
    }
    return notesMap;
  }, [chartArea, allAreas, getNote, year]);

  // Chart data: filtered by chartArea when set, otherwise use full timelineData
  const chartData = useMemo(() => {
    const buildPoint = (base: {
      month: string;
      monthLabel: string;
      planned_revenue: number;
      actual_revenue: number;
      planned_cost: number;
      actual_cost: number;
      cumulative_planned_revenue: number;
      cumulative_actual_revenue: number;
    }, monthNum: number) => {
      const notes = chartNotes.get(monthNum);
      return {
        ...base,
        noteY: notes ? base.actual_revenue : null,
        noteText: notes ? notes.join("\n") : null,
      };
    };

    if (!chartArea) {
      return timelineData.map((pt, i) => buildPoint(pt, i + 1));
    }

    // Build area-specific timeline
    const areaEntries = budgetEntries.filter((e) => e.practice_area === chartArea);
    const areaActuals = actuals.get(chartArea);
    let cumPlanned = 0;
    let cumActual = 0;

    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const entry = areaEntries.find((e) => e.month === m);
      const monthActuals = areaActuals?.get(m);

      const plannedRev = entry?.planned_revenue || 0;
      const actualRev = monthActuals?.revenue || 0;
      cumPlanned += plannedRev;
      cumActual += actualRev;

      const date = new Date(year, i, 1);
      return buildPoint({
        month: `${year}-${String(m).padStart(2, "0")}`,
        monthLabel: format(date, "MMM", { locale: es }),
        planned_revenue: Math.round(plannedRev),
        actual_revenue: Math.round(actualRev),
        planned_cost: Math.round(entry?.planned_cost || 0),
        actual_cost: Math.round(monthActuals?.cost || 0),
        cumulative_planned_revenue: Math.round(cumPlanned),
        cumulative_actual_revenue: Math.round(cumActual),
      }, m);
    });
  }, [chartArea, timelineData, budgetEntries, actuals, year, chartNotes]);

  // Area comparison view data: one entry per area with planned vs actual
  const areaChartData = useMemo(() => {
    return allAreas.map((area) => {
      const areaEntries = budgetEntries.filter((e) => e.practice_area === area);
      const areaActualsMap = actuals.get(area);
      let totalPlanned = 0;
      let totalActual = 0;
      areaEntries.forEach((e) => (totalPlanned += e.planned_revenue || 0));
      if (areaActualsMap) areaActualsMap.forEach((v) => (totalActual += v.revenue));
      return {
        area,
        planned_revenue: Math.round(totalPlanned),
        actual_revenue: Math.round(totalActual),
      };
    });
  }, [actuals, allAreas, budgetEntries]);

  // Accumulated totals for right-side chart
  const accumulatedData = useMemo(() => {
    if (chartView === "areas") {
      const totalPlanned = areaChartData.reduce((s, p) => s + p.planned_revenue, 0);
      const totalActual = areaChartData.reduce((s, p) => s + p.actual_revenue, 0);
      return [{ label: "Total", planned_revenue: totalPlanned, actual_revenue: totalActual }];
    }
    // General view
    const totalPlanned = chartData.reduce((s, p) => s + p.planned_revenue, 0);
    const totalActual = chartData.reduce((s, p) => s + p.actual_revenue, 0);
    return [{ label: "Total", planned_revenue: totalPlanned, actual_revenue: totalActual }];
  }, [chartView, chartData, areaChartData]);

  // --- Forecast: year-end projection based on YTD run rate ---
  const forecastData = useMemo(() => {
    // Find the last month with actual data
    const monthsWithData = timelineData.filter((p) => p.actual_revenue > 0).length;
    if (monthsWithData === 0) return [];

    return breakdownData.map((row) => {
      const areaActuals = actuals.get(row.practice_area);
      let monthsActive = 0;
      let ytdRevenue = 0;
      let ytdCost = 0;
      if (areaActuals) {
        areaActuals.forEach((v) => {
          if (v.revenue > 0 || v.cost > 0) {
            monthsActive++;
            ytdRevenue += v.revenue;
            ytdCost += v.cost;
          }
        });
      }
      if (monthsActive === 0) monthsActive = 1;

      const monthlyRunRate = ytdRevenue / monthsActive;
      const projectedRevenue = Math.round(monthlyRunRate * 12);
      const gap = projectedRevenue - row.planned_revenue;
      const gapPct = row.planned_revenue > 0
        ? Math.round((gap / row.planned_revenue) * 1000) / 10
        : 0;

      const costRunRate = ytdCost / monthsActive;
      const projectedCost = Math.round(costRunRate * 12);

      return {
        area: row.practice_area,
        planned: row.planned_revenue,
        projected: projectedRevenue,
        gap,
        gapPct,
        monthlyRunRate: Math.round(monthlyRunRate),
        projectedCost,
        plannedCost: row.planned_cost,
      };
    }).sort((a, b) => a.gapPct - b.gapPct); // worst gaps first
  }, [breakdownData, actuals, timelineData]);

  // --- Budget Burn Rate per area ---
  const burnRateData = useMemo(() => {
    const monthsWithData = timelineData.filter((p) => p.actual_cost > 0).length;
    const monthsPassed = Math.max(monthsWithData, 1);
    const expectedPct = Math.round((monthsPassed / 12) * 100);

    return breakdownData.map((row) => {
      const consumedPct = row.planned_cost > 0
        ? Math.round((row.actual_cost / row.planned_cost) * 1000) / 10
        : 0;
      // Pace: >110% of expected = overspending, <90% = underspending
      const pace = consumedPct / expectedPct;
      const status: "ok" | "warning" | "danger" =
        pace > 1.15 ? "danger" : pace > 1.0 ? "warning" : "ok";

      return {
        area: row.practice_area,
        consumed: row.actual_cost,
        budget: row.planned_cost,
        consumedPct,
        expectedPct,
        status,
      };
    }).sort((a, b) => b.consumedPct - a.consumedPct);
  }, [breakdownData, timelineData]);

  // --- Alertas de Desviación ---
  const alerts = useMemo(() => {
    const items: Array<{
      area: string;
      type: "revenue_low" | "revenue_high" | "cost_over" | "util_low";
      message: string;
      severity: "warning" | "danger";
      value: string;
    }> = [];

    // The plan is annual but actuals are year-to-date, so compare against the
    // pro-rated plan (annual × fraction of the year elapsed) to judge pace.
    const elapsedFrac = monthsElapsed / 12;

    breakdownData.forEach((row) => {
      // Revenue running behind the expected pace
      const expectedRevenue = row.planned_revenue * elapsedFrac;
      if (expectedRevenue > 0) {
        const revenuePace = Math.round((row.actual_revenue / expectedRevenue) * 100);
        if (revenuePace < 85) {
          items.push({
            area: row.practice_area,
            type: "revenue_low",
            message: `Ingresos ${Math.round(100 - revenuePace)}% bajo el ritmo esperado`,
            severity: revenuePace < 70 ? "danger" : "warning",
            value: `${revenuePace}% del plan a la fecha`,
          });
        }
      }
      // Cost overspending vs the expected pace
      const expectedCost = row.planned_cost * elapsedFrac;
      if (expectedCost > 0 && row.actual_cost > expectedCost * 1.15) {
        const overPct = Math.round(((row.actual_cost - expectedCost) / expectedCost) * 100);
        items.push({
          area: row.practice_area,
          type: "cost_over",
          message: `Costos ${overPct}% sobre el ritmo esperado`,
          severity: overPct > 30 ? "danger" : "warning",
          value: formatCurrency(row.actual_cost - expectedCost) + " sobre lo esperado",
        });
      }
      // Utilization significantly below target
      if (row.actual_utilization > 0 && row.actual_utilization < row.target_utilization * 0.8) {
        items.push({
          area: row.practice_area,
          type: "util_low",
          message: `Utilización ${Math.round(row.target_utilization - row.actual_utilization)}pp bajo meta`,
          severity: row.actual_utilization < row.target_utilization * 0.65 ? "danger" : "warning",
          value: `${row.actual_utilization}% vs ${row.target_utilization}% meta`,
        });
      }
    });

    // Sort: danger first, then warning
    return items.sort((a, b) => (a.severity === "danger" ? 0 : 1) - (b.severity === "danger" ? 0 : 1));
  }, [breakdownData, monthsElapsed]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "practice_area" ? "asc" : "desc");
    }
  };

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? " ↑" : " ↓";
  };

  // Monthly detail for expanded area
  const getMonthlyDetail = (area: string) => {
    const areaEntries = budgetEntries.filter((e) => e.practice_area === area);
    const areaActuals = actuals.get(area);

    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const entry = areaEntries.find((e) => e.month === month);
      const monthActuals = areaActuals?.get(month);
      const date = new Date(year, i, 1);

      return {
        month,
        monthLabel: format(date, "MMMM", { locale: es }),
        planned_revenue: entry?.planned_revenue || 0,
        actual_revenue: monthActuals?.revenue || 0,
        planned_cost: entry?.planned_cost || 0,
        actual_cost: monthActuals?.cost || 0,
        target_utilization: entry?.target_utilization || 75,
        actual_utilization:
          monthActuals && monthActuals.total_hours > 0
            ? (monthActuals.billable_hours / monthActuals.total_hours) * 100
            : 0,
      };
    });
  };

  // KPI card configs
  const kpiCards = [
    {
      title: "Ingresos Planificados",
      value: formatCurrency(kpis.totalPlannedRevenue),
      icon: Target,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      title: "Ingresos Reales",
      value: formatCurrency(kpis.totalActualRevenue),
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950/30",
    },
    {
      title: "Margen de Rentabilidad",
      value: `${kpis.profitMargin}%`,
      icon: TrendingUp,
      color:
        kpis.profitMargin >= 0 ? "text-emerald-600" : "text-red-600",
      bgColor:
        kpis.profitMargin >= 0
          ? "bg-emerald-50 dark:bg-emerald-950/30"
          : "bg-red-50 dark:bg-red-950/30",
    },
    {
      title: "Presupuesto Costos Restante",
      value: formatCurrency(kpis.costBudgetRemaining),
      icon: kpis.costBudgetRemaining >= 0 ? TrendingUp : TrendingDown,
      color:
        kpis.costBudgetRemaining >= 0 ? "text-teal-600" : "text-red-600",
      bgColor:
        kpis.costBudgetRemaining >= 0
          ? "bg-teal-50 dark:bg-teal-950/30"
          : "bg-red-50 dark:bg-red-950/30",
    },
    {
      title: "Utilización (Meta vs Real)",
      value: `${kpis.actualUtilization}% / ${kpis.targetUtilization}%`,
      icon: Activity,
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950/30",
    },
    {
      title: "Varianza General",
      value: `${kpis.overallVariancePct > 0 ? "+" : ""}${kpis.overallVariancePct}%`,
      icon: Percent,
      color:
        kpis.overallVariancePct >= 0 ? "text-green-600" : "text-red-600",
      bgColor:
        kpis.overallVariancePct >= 0
          ? "bg-green-50 dark:bg-green-950/30"
          : "bg-red-50 dark:bg-red-950/30",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              Planificación Estratégica
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Presupuesto y seguimiento de metas por área de práctica
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={year.toString()}
              onValueChange={(v) => setYear(parseInt(v))}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setDialogOpen(true)}>
              <PenLine className="h-4 w-4 mr-2" />
              Editar Presupuesto
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {kpiCards.map((kpi) => (
            <Card key={kpi.title} className="border-border/50 hover:shadow-md transition-shadow">
              <CardContent className="p-3 flex items-center gap-3">
                <div
                  className={`${kpi.bgColor} p-2 rounded-lg flex-shrink-0`}
                >
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground truncate">
                    {kpi.title}
                  </p>
                  <div className="text-lg font-bold">{kpi.value}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Forecast + Burn Rate + Alerts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Forecast / Proyección */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="bg-blue-50 dark:bg-blue-950/30 p-1.5 rounded-md">
                  <Crosshair className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <CardTitle className="text-sm font-medium">Proyección a Fin de Año</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-2 max-h-[280px] overflow-y-auto">
              {forecastData.map((row) => {
                const isOver = row.gapPct >= 0;
                return (
                  <div key={row.area} className="flex items-center gap-2 py-1 border-b border-border/30 last:border-0">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getAreaColor(row.area) }}
                    />
                    <span className="text-xs flex-1 truncate">{row.area}</span>
                    <div className="text-right">
                      <span className={`text-xs font-semibold tabular-nums ${isOver ? "text-green-600" : "text-red-600"}`}>
                        {isOver ? "+" : ""}{row.gapPct}%
                      </span>
                      <p className="text-[10px] text-muted-foreground tabular-nums">
                        {formatCurrency(row.projected)} proy.
                      </p>
                    </div>
                  </div>
                );
              })}
              {forecastData.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Sin datos suficientes</p>
              )}
            </CardContent>
          </Card>

          {/* Budget Burn Rate */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="bg-amber-50 dark:bg-amber-950/30 p-1.5 rounded-md">
                  <Fuel className="h-3.5 w-3.5 text-amber-600" />
                </div>
                <CardTitle className="text-sm font-medium">Consumo de Presupuesto (Costos)</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-2.5 max-h-[280px] overflow-y-auto">
              {burnRateData.map((row) => (
                <div key={row.area}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getAreaColor(row.area) }}
                      />
                      <span className="text-xs truncate">{row.area}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-semibold tabular-nums ${
                        row.status === "danger" ? "text-red-600" : row.status === "warning" ? "text-amber-600" : "text-green-600"
                      }`}>
                        {row.consumedPct}%
                      </span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        / {row.expectedPct}% esperado
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden relative">
                    {/* Expected marker */}
                    <div
                      className="absolute top-0 bottom-0 w-px bg-foreground/30 z-10"
                      style={{ left: `${Math.min(row.expectedPct, 100)}%` }}
                    />
                    <div
                      className={`h-full rounded-full transition-all ${
                        row.status === "danger" ? "bg-red-500" : row.status === "warning" ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(row.consumedPct, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Alertas de Desviación */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="bg-red-50 dark:bg-red-950/30 p-1.5 rounded-md">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                </div>
                <CardTitle className="text-sm font-medium">Alertas de Desviación</CardTitle>
                {alerts.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                    {alerts.length}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0 max-h-[280px] overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="bg-green-50 dark:bg-green-950/30 p-2 rounded-full mb-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  </div>
                  <p className="text-xs text-muted-foreground">Todo dentro de rangos normales</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map((alert, i) => (
                    <div
                      key={`${alert.area}-${alert.type}-${i}`}
                      className={`rounded-lg p-2.5 border ${
                        alert.severity === "danger"
                          ? "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30"
                          : "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${
                          alert.severity === "danger" ? "text-red-500" : "text-amber-500"
                        }`} />
                        <div className="min-w-0">
                          <p className="text-xs font-medium">{alert.area}</p>
                          <p className="text-[11px] text-muted-foreground">{alert.message}</p>
                          <p className={`text-[10px] font-medium mt-0.5 ${
                            alert.severity === "danger" ? "text-red-600" : "text-amber-600"
                          }`}>
                            {alert.value}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Monthly Timeline Chart */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">
                  Progreso Mensual
                </CardTitle>
                {chartArea && (
                  <Badge
                    variant="secondary"
                    className="text-xs font-normal cursor-pointer hover:bg-destructive/10"
                    onClick={() => setChartArea(null)}
                  >
                    {chartArea}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {chartArea && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setChartArea(null)}
                  >
                    Ver todas las áreas
                  </Button>
                )}
                <div className="flex bg-muted rounded-lg p-0.5">
                  <button
                    onClick={() => setChartView("general")}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      chartView === "general"
                        ? "bg-background text-foreground shadow-sm font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    General
                  </button>
                  <button
                    onClick={() => { setChartView("areas"); setChartArea(null); }}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      chartView === "areas"
                        ? "bg-background text-foreground shadow-sm font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Por Área
                  </button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex gap-0">
              {/* Main monthly chart — 82% */}
              <div style={{ flex: "0 0 82%" }}>
                <ResponsiveContainer width="100%" height={370}>
                  {chartView === "general" ? (
                    <ComposedChart data={chartData} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) =>
                          v >= 1_000_000
                            ? `${(v / 1_000_000).toFixed(1)}M`
                            : v >= 1_000
                              ? `${(v / 1_000).toFixed(0)}K`
                              : v.toString()
                        }
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const noteEntry = payload.find((p: any) => p.dataKey === "noteY" && p.value != null);
                          return (
                            <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm max-w-xs">
                              <p className="font-medium mb-1">Mes: {label}</p>
                              {payload
                                .filter((p: any) => p.dataKey !== "noteY" && p.value != null)
                                .map((p: any, i: number) => (
                                  <p key={i} className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: p.color }} />
                                    <span className="text-muted-foreground">{p.name}:</span>
                                    <span className="font-medium">{formatCurrencyFull(p.value)}</span>
                                  </p>
                                ))}
                              {noteEntry && (
                                <div className="mt-2 pt-2 border-t border-border">
                                  <div className="flex items-center gap-1 text-xs font-medium text-amber-600 mb-1">
                                    <MessageSquare className="h-3 w-3" />
                                    Notas
                                  </div>
                                  {(noteEntry.payload?.noteText as string)?.split("\n").map((line: string, i: number) => (
                                    <p key={i} className="text-xs text-muted-foreground">{line}</p>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        }}
                      />
                      <Legend />
                      <Bar
                        dataKey="planned_revenue"
                        name="Planificado"
                        fill={getChartColor(4)}
                        opacity={0.4}
                        radius={[2, 2, 0, 0]}
                      />
                      <Bar
                        dataKey="actual_revenue"
                        name="Real"
                        radius={[2, 2, 0, 0]}
                        label={(props: any) => {
                          const pt = chartData[props.index];
                          if (!pt || pt.actual_revenue === 0) return null;
                          const isUp = pt.actual_revenue >= pt.planned_revenue;
                          return (
                            <text
                              x={props.x + props.width / 2}
                              y={props.y - 4}
                              textAnchor="middle"
                              fontSize={8}
                              fill={isUp ? "#16a34a" : "#dc2626"}
                            >
                              {isUp ? "▲" : "▼"}
                            </text>
                          );
                        }}
                      >
                        {chartData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={
                              entry.actual_revenue === 0
                                ? getChartColor(0)
                                : entry.actual_revenue >= entry.planned_revenue
                                  ? getChartColor(0)
                                  : "#f87171"
                            }
                          />
                        ))}
                      </Bar>
                      <Scatter
                        dataKey="noteY"
                        name="noteY"
                        fill="#f59e0b"
                        legendType="none"
                        shape={(props: any) => {
                          if (props.noteY == null) return null;
                          return (
                            <circle
                              cx={props.cx}
                              cy={props.cy}
                              r={6}
                              fill="#f59e0b"
                              stroke="#fff"
                              strokeWidth={2}
                              style={{ cursor: "pointer" }}
                            />
                          );
                        }}
                      />
                    </ComposedChart>
                  ) : (
                    <BarChart data={areaChartData} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="area" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) =>
                          v >= 1_000_000
                            ? `${(v / 1_000_000).toFixed(1)}M`
                            : v >= 1_000
                              ? `${(v / 1_000).toFixed(0)}K`
                              : v.toString()
                        }
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          return (
                            <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm max-w-xs">
                              <p className="font-medium mb-1">{label}</p>
                              {payload
                                .filter((p: any) => p.value != null)
                                .map((p: any, i: number) => (
                                  <p key={i} className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: p.color }} />
                                    <span className="text-muted-foreground">{p.name}:</span>
                                    <span className="font-medium">{formatCurrencyFull(p.value)}</span>
                                  </p>
                                ))}
                            </div>
                          );
                        }}
                      />
                      <Legend />
                      <Bar
                        dataKey="planned_revenue"
                        name="Planificado"
                        fill={getChartColor(4)}
                        opacity={0.4}
                        radius={[2, 2, 0, 0]}
                      />
                      <Bar
                        dataKey="actual_revenue"
                        name="Real"
                        radius={[2, 2, 0, 0]}
                      >
                        {areaChartData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={
                              entry.actual_revenue >= entry.planned_revenue
                                ? getChartColor(0)
                                : "#f87171"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>

              {/* Accumulated totals — 18% */}
              <div style={{ flex: "0 0 18%" }}>
                <ResponsiveContainer width="100%" height={370}>
                  {chartView === "general" ? (
                    <BarChart data={accumulatedData} barCategoryGap="30%">
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) =>
                          v >= 1_000_000
                            ? `${(v / 1_000_000).toFixed(1)}M`
                            : v >= 1_000
                              ? `${(v / 1_000).toFixed(0)}K`
                              : v.toString()
                        }
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          return (
                            <div className="bg-popover border border-border rounded-lg shadow-lg p-2 text-xs max-w-[200px]">
                              <p className="font-medium mb-1">Acumulado Anual</p>
                              {payload
                                .filter((p: any) => p.value != null)
                                .map((p: any, i: number) => (
                                  <p key={i} className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color }} />
                                    <span className="text-muted-foreground">{p.name}:</span>
                                    <span className="font-medium">{formatCurrencyFull(p.value)}</span>
                                  </p>
                                ))}
                            </div>
                          );
                        }}
                      />
                      <Bar
                        dataKey="planned_revenue"
                        name="Planificado"
                        fill={getChartColor(4)}
                        opacity={0.4}
                        radius={[2, 2, 0, 0]}
                      />
                      <Bar
                        dataKey="actual_revenue"
                        name="Real"
                        fill={getChartColor(0)}
                        radius={[2, 2, 0, 0]}
                      />
                    </BarChart>
                  ) : (
                    <BarChart data={accumulatedData} barCategoryGap="30%">
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) =>
                          v >= 1_000_000
                            ? `${(v / 1_000_000).toFixed(1)}M`
                            : v >= 1_000
                              ? `${(v / 1_000).toFixed(0)}K`
                              : v.toString()
                        }
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          return (
                            <div className="bg-popover border border-border rounded-lg shadow-lg p-2 text-xs max-w-[200px]">
                              <p className="font-medium mb-1">Acumulado Anual</p>
                              {payload
                                .filter((p: any) => p.value != null)
                                .map((p: any, i: number) => (
                                  <p key={i} className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color }} />
                                    <span className="text-muted-foreground">{p.name}:</span>
                                    <span className="font-medium">{formatCurrencyFull(p.value)}</span>
                                  </p>
                                ))}
                            </div>
                          );
                        }}
                      />
                      <Bar
                        dataKey="planned_revenue"
                        name="Planificado"
                        fill={getChartColor(4)}
                        opacity={0.4}
                        radius={[2, 2, 0, 0]}
                      />
                      <Bar
                        dataKey="actual_revenue"
                        name="Real"
                        fill={getChartColor(0)}
                        radius={[2, 2, 0, 0]}
                      />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Breakdown Table */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Desglose por Área de Práctica
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="text-xs cursor-pointer hover:text-foreground"
                      onClick={() => handleSort("practice_area")}
                    >
                      Área{sortIndicator("practice_area")}
                    </TableHead>
                    <TableHead
                      className="text-xs text-center cursor-pointer hover:text-foreground"
                      onClick={() => handleSort("professional_count")}
                    >
                      Prof.{sortIndicator("professional_count")}
                    </TableHead>
                    <TableHead
                      className="text-xs text-right cursor-pointer hover:text-foreground"
                      onClick={() => handleSort("planned_revenue")}
                    >
                      Ingreso Plan{sortIndicator("planned_revenue")}
                    </TableHead>
                    <TableHead
                      className="text-xs text-right cursor-pointer hover:text-foreground"
                      onClick={() => handleSort("actual_revenue")}
                    >
                      Ingreso Real{sortIndicator("actual_revenue")}
                    </TableHead>
                    <TableHead
                      className="text-xs text-right cursor-pointer hover:text-foreground"
                      onClick={() => handleSort("revenue_variance")}
                    >
                      Varianza{sortIndicator("revenue_variance")}
                    </TableHead>
                    <TableHead
                      className="text-xs text-center cursor-pointer hover:text-foreground"
                      onClick={() => handleSort("revenue_pct")}
                    >
                      Avance{sortIndicator("revenue_pct")}
                    </TableHead>
                    <TableHead
                      className="text-xs text-right cursor-pointer hover:text-foreground"
                      onClick={() => handleSort("planned_cost")}
                    >
                      Costo Plan{sortIndicator("planned_cost")}
                    </TableHead>
                    <TableHead
                      className="text-xs text-right cursor-pointer hover:text-foreground"
                      onClick={() => handleSort("actual_cost")}
                    >
                      Costo Real{sortIndicator("actual_cost")}
                    </TableHead>
                    <TableHead
                      className="text-xs text-center cursor-pointer hover:text-foreground"
                      onClick={() => handleSort("target_utilization")}
                    >
                      Util. Meta{sortIndicator("target_utilization")}
                    </TableHead>
                    <TableHead
                      className="text-xs text-center cursor-pointer hover:text-foreground"
                      onClick={() => handleSort("actual_utilization")}
                    >
                      Util. Real{sortIndicator("actual_utilization")}
                    </TableHead>
                    <TableHead
                      className="text-xs text-center cursor-pointer hover:text-foreground"
                      onClick={() => handleSort("profit_margin")}
                    >
                      Margen{sortIndicator("profit_margin")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedBreakdown.map((row) => {
                    const isExpanded = expandedArea === row.practice_area;
                    const monthlyDetail = isExpanded
                      ? getMonthlyDetail(row.practice_area)
                      : [];

                    return (
                      <>
                        <TableRow
                          key={row.practice_area}
                          className={`cursor-pointer hover:bg-muted/50 ${
                            chartArea === row.practice_area
                              ? "bg-muted/40"
                              : ""
                          }`}
                          onClick={() => {
                            const newArea = isExpanded ? null : row.practice_area;
                            setExpandedArea(newArea);
                            setChartArea(newArea);
                          }}
                        >
                          <TableCell className="text-sm font-medium">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              <div
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{
                                  backgroundColor: getAreaColor(
                                    row.practice_area,
                                  ),
                                }}
                              />
                              {row.practice_area}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-center text-muted-foreground">
                            {row.professional_count}
                          </TableCell>
                          <TableCell className="text-sm text-right">
                            {formatCurrency(row.planned_revenue)}
                          </TableCell>
                          <TableCell className="text-sm text-right font-medium">
                            {formatCurrency(row.actual_revenue)}
                          </TableCell>
                          <TableCell
                            className={`text-sm text-right font-medium ${
                              row.revenue_variance >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {row.revenue_variance >= 0 ? "+" : ""}
                            {formatCurrency(row.revenue_variance)}
                          </TableCell>
                          <TableCell className="text-center">
                            {(() => {
                              // Color by pace: progress vs the % of the year elapsed,
                              // not a fixed threshold (17% mid-year is on pace, not "red").
                              const expectedProgress = (monthsElapsed / 12) * 100;
                              const paceColor =
                                row.revenue_pct >= expectedProgress * 0.95
                                  ? "bg-green-500"
                                  : row.revenue_pct >= expectedProgress * 0.7
                                    ? "bg-yellow-500"
                                    : "bg-red-500";
                              return (
                                <div className="flex items-center gap-2 justify-center">
                                  <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${paceColor}`}
                                      style={{
                                        width: `${Math.min(row.revenue_pct, 100)}%`,
                                      }}
                                    />
                                  </div>
                                  <span className="text-xs text-muted-foreground w-10">
                                    {row.revenue_pct}%
                                  </span>
                                </div>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="text-sm text-right">
                            {formatCurrency(row.planned_cost)}
                          </TableCell>
                          <TableCell
                            className={`text-sm text-right ${
                              row.cost_variance > 0
                                ? "text-red-600"
                                : "text-green-600"
                            }`}
                          >
                            {formatCurrency(row.actual_cost)}
                          </TableCell>
                          <TableCell className="text-sm text-center text-muted-foreground">
                            {row.target_utilization}%
                          </TableCell>
                          <TableCell
                            className={`text-sm text-center font-medium ${
                              row.actual_utilization >= row.target_utilization
                                ? "text-green-600"
                                : "text-amber-600"
                            }`}
                          >
                            {row.actual_utilization}%
                          </TableCell>
                          <TableCell
                            className={`text-sm text-center font-medium ${
                              row.profit_margin >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {row.profit_margin}%
                          </TableCell>
                        </TableRow>

                        {/* Expanded monthly detail */}
                        {isExpanded && (
                          <TableRow key={`${row.practice_area}-detail`}>
                            <TableCell colSpan={11} className="p-0 bg-muted/30">
                              <div className="p-4">
                                <h4 className="text-sm font-medium mb-3">
                                  Detalle Mensual — {row.practice_area}
                                </h4>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="text-xs">
                                        Mes
                                      </TableHead>
                                      <TableHead className="text-xs text-right">
                                        Ingreso Plan
                                      </TableHead>
                                      <TableHead className="text-xs text-right">
                                        Ingreso Real
                                      </TableHead>
                                      <TableHead className="text-xs text-right">
                                        Costo Plan
                                      </TableHead>
                                      <TableHead className="text-xs text-right">
                                        Costo Real
                                      </TableHead>
                                      <TableHead className="text-xs text-center">
                                        Util. Meta
                                      </TableHead>
                                      <TableHead className="text-xs text-center">
                                        Util. Real
                                      </TableHead>
                                      <TableHead className="text-xs">
                                        Nota
                                      </TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {monthlyDetail.map((md) => (
                                      <TableRow key={md.month}>
                                        <TableCell className="text-sm capitalize">
                                          {md.monthLabel}
                                        </TableCell>
                                        <TableCell className="text-sm text-right">
                                          {formatCurrencyFull(
                                            md.planned_revenue,
                                          )}
                                        </TableCell>
                                        <TableCell className="text-sm text-right font-medium">
                                          {formatCurrencyFull(
                                            md.actual_revenue,
                                          )}
                                        </TableCell>
                                        <TableCell className="text-sm text-right">
                                          {formatCurrencyFull(
                                            md.planned_cost,
                                          )}
                                        </TableCell>
                                        <TableCell
                                          className={`text-sm text-right ${
                                            md.actual_cost > md.planned_cost
                                              ? "text-red-600"
                                              : ""
                                          }`}
                                        >
                                          {formatCurrencyFull(md.actual_cost)}
                                        </TableCell>
                                        <TableCell className="text-sm text-center text-muted-foreground">
                                          {md.target_utilization}%
                                        </TableCell>
                                        <TableCell
                                          className={`text-sm text-center ${
                                            md.actual_utilization >=
                                            md.target_utilization
                                              ? "text-green-600"
                                              : "text-amber-600"
                                          }`}
                                        >
                                          {Math.round(
                                            md.actual_utilization * 10,
                                          ) / 10}
                                          %
                                        </TableCell>
                                        <TableCell className="min-w-[200px]">
                                          <NoteInput
                                            value={getNote(
                                              row.practice_area,
                                              md.month,
                                            )}
                                            onChange={(v) =>
                                              setNote(
                                                row.practice_area,
                                                md.month,
                                                v,
                                              )
                                            }
                                          />
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <BudgetEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        year={year}
        allAreas={allAreas}
        professionalCounts={professionalCounts}
        budgetEntries={budgetEntries}
        onSaveAnnual={setAnnualTargets}
        onSaveMonthly={updateBudgetForArea}
      />
    </DashboardLayout>
  );
}

/** Inline editable note field */
function NoteInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing && !value) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setDraft(value);
          setEditing(true);
        }}
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        <MessageSquare className="h-3 w-3" />
        Agregar nota
      </button>
    );
  }

  if (!editing) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setDraft(value);
          setEditing(true);
        }}
        className="text-xs text-left hover:text-foreground max-w-[200px] truncate"
      >
        {value}
      </button>
    );
  }

  return (
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        onChange(draft);
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          onChange(draft);
          setEditing(false);
        }
        if (e.key === "Escape") {
          setEditing(false);
        }
      }}
      onClick={(e) => e.stopPropagation()}
      className="h-7 text-xs"
      autoFocus
      placeholder="Escribe una nota..."
    />
  );
}
