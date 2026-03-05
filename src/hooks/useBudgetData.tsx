import { useState, useEffect, useMemo, useCallback } from "react";
import type {
  BudgetEntry,
  BudgetNote,
  BudgetBreakdownRow,
  BudgetTimelinePoint,
} from "@/lib/types";
import {
  getActualsByAreaAndMonth,
  getProfessionalCountByArea,
  getAllPracticeAreas,
} from "@/lib/mockDataUtils";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const STORAGE_KEY_ENTRIES = "lawbit-budget-entries";
const STORAGE_KEY_NOTES = "lawbit-budget-notes";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * Generate a default budget based on actuals × 1.1, distributed uniformly.
 */
function generateDefaultBudget(year: number): BudgetEntry[] {
  const actuals = getActualsByAreaAndMonth(year);
  const areas = getAllPracticeAreas();
  const entries: BudgetEntry[] = [];

  areas.forEach((area) => {
    const areaActuals = actuals.get(area);
    let totalRevenue = 0;
    let totalCost = 0;

    if (areaActuals) {
      areaActuals.forEach((v) => {
        totalRevenue += v.revenue;
        totalCost += v.cost;
      });
    }

    // Apply 1.1× growth factor (same pattern as getDashboardData meta)
    const annualRevenueTarget = Math.round(totalRevenue * 1.1);
    const annualCostCap = Math.round(totalCost * 1.1);
    const monthlyRevenue = Math.round(annualRevenueTarget / 12);
    const monthlyCost = Math.round(annualCostCap / 12);

    for (let month = 1; month <= 12; month++) {
      entries.push({
        id: generateId(),
        practice_area: area,
        year,
        month,
        planned_revenue: monthlyRevenue,
        planned_cost: monthlyCost,
        target_utilization: 75, // Industry standard for law firms
      });
    }
  });

  return entries;
}

export interface BudgetKPIs {
  totalPlannedRevenue: number;
  totalActualRevenue: number;
  totalPlannedCost: number;
  totalActualCost: number;
  costBudgetRemaining: number;
  overallVariancePct: number;
  targetUtilization: number;
  actualUtilization: number;
  profitMargin: number;
}

export function useBudgetData(year: number) {
  // Budget entries
  const [budgetEntries, setBudgetEntries] = useState<BudgetEntry[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_ENTRIES);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as BudgetEntry[];
        const forYear = parsed.filter((e) => e.year === year);
        if (forYear.length > 0) return parsed;
      } catch {}
    }
    return generateDefaultBudget(year);
  });

  // Notes
  const [notes, setNotes] = useState<BudgetNote[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_NOTES);
    if (saved) {
      try {
        return JSON.parse(saved) as BudgetNote[];
      } catch {}
    }
    return [];
  });

  // Persist entries
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(budgetEntries));
  }, [budgetEntries]);

  // Persist notes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(notes));
  }, [notes]);

  // When year changes, ensure we have entries for it
  useEffect(() => {
    const forYear = budgetEntries.filter((e) => e.year === year);
    if (forYear.length === 0) {
      const defaults = generateDefaultBudget(year);
      setBudgetEntries((prev) => [...prev, ...defaults]);
    }
  }, [year]);

  // Set a single note
  const setNote = useCallback(
    (practice_area: string, month: number, note: string) => {
      setNotes((prev) => {
        const idx = prev.findIndex(
          (n) =>
            n.practice_area === practice_area &&
            n.year === year &&
            n.month === month,
        );
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { practice_area, year, month, note };
          return updated;
        }
        return [...prev, { practice_area, year, month, note }];
      });
    },
    [year],
  );

  // Get note for an area+month
  const getNote = useCallback(
    (practice_area: string, month: number): string => {
      return (
        notes.find(
          (n) =>
            n.practice_area === practice_area &&
            n.year === year &&
            n.month === month,
        )?.note || ""
      );
    },
    [notes, year],
  );

  // Actuals
  const actuals = useMemo(() => getActualsByAreaAndMonth(year), [year]);
  const professionalCounts = useMemo(() => getProfessionalCountByArea(), []);
  const allAreas = useMemo(() => getAllPracticeAreas(), []);

  // Entries for current year
  const yearEntries = useMemo(
    () => budgetEntries.filter((e) => e.year === year),
    [budgetEntries, year],
  );

  // Timeline data
  const timelineData: BudgetTimelinePoint[] = useMemo(() => {
    const points: BudgetTimelinePoint[] = [];
    let cumPlanned = 0;
    let cumActual = 0;

    for (let m = 1; m <= 12; m++) {
      let plannedRev = 0;
      let actualRev = 0;
      let plannedCost = 0;
      let actualCost = 0;

      allAreas.forEach((area) => {
        const entry = yearEntries.find(
          (e) => e.practice_area === area && e.month === m,
        );
        if (entry) {
          plannedRev += entry.planned_revenue;
          plannedCost += entry.planned_cost;
        }

        const areaActuals = actuals.get(area);
        if (areaActuals) {
          const monthActuals = areaActuals.get(m);
          if (monthActuals) {
            actualRev += monthActuals.revenue;
            actualCost += monthActuals.cost;
          }
        }
      });

      cumPlanned += plannedRev;
      cumActual += actualRev;

      const date = new Date(year, m - 1, 1);
      points.push({
        month: `${year}-${String(m).padStart(2, "0")}`,
        monthLabel: format(date, "MMM", { locale: es }),
        planned_revenue: Math.round(plannedRev),
        actual_revenue: Math.round(actualRev),
        planned_cost: Math.round(plannedCost),
        actual_cost: Math.round(actualCost),
        cumulative_planned_revenue: Math.round(cumPlanned),
        cumulative_actual_revenue: Math.round(cumActual),
      });
    }

    return points;
  }, [yearEntries, actuals, allAreas, year]);

  // Breakdown by area
  const breakdownData: BudgetBreakdownRow[] = useMemo(() => {
    return allAreas
      .map((area) => {
        const areaEntries = yearEntries.filter(
          (e) => e.practice_area === area,
        );
        const plannedRevenue = areaEntries.reduce(
          (s, e) => s + e.planned_revenue,
          0,
        );
        const plannedCost = areaEntries.reduce(
          (s, e) => s + e.planned_cost,
          0,
        );
        const avgTargetUtil =
          areaEntries.length > 0
            ? areaEntries.reduce((s, e) => s + e.target_utilization, 0) /
              areaEntries.length
            : 75;

        let actualRevenue = 0;
        let actualCost = 0;
        let totalHours = 0;
        let billableHours = 0;

        const areaActuals = actuals.get(area);
        if (areaActuals) {
          areaActuals.forEach((v) => {
            actualRevenue += v.revenue;
            actualCost += v.cost;
            totalHours += v.total_hours;
            billableHours += v.billable_hours;
          });
        }

        const actualUtilization =
          totalHours > 0 ? (billableHours / totalHours) * 100 : 0;
        const profitMargin =
          actualRevenue > 0
            ? ((actualRevenue - actualCost) / actualRevenue) * 100
            : 0;

        return {
          practice_area: area,
          professional_count: professionalCounts.get(area) || 0,
          planned_revenue: Math.round(plannedRevenue),
          actual_revenue: Math.round(actualRevenue),
          revenue_variance: Math.round(actualRevenue - plannedRevenue),
          revenue_pct:
            plannedRevenue > 0
              ? Math.round((actualRevenue / plannedRevenue) * 1000) / 10
              : 0,
          planned_cost: Math.round(plannedCost),
          actual_cost: Math.round(actualCost),
          cost_variance: Math.round(actualCost - plannedCost),
          target_utilization: Math.round(avgTargetUtil * 10) / 10,
          actual_utilization: Math.round(actualUtilization * 10) / 10,
          profit_margin: Math.round(profitMargin * 10) / 10,
        };
      })
      .sort((a, b) => b.actual_revenue - a.actual_revenue);
  }, [yearEntries, actuals, allAreas, professionalCounts]);

  // KPIs
  const kpis: BudgetKPIs = useMemo(() => {
    const totalPlannedRevenue = breakdownData.reduce(
      (s, r) => s + r.planned_revenue,
      0,
    );
    const totalActualRevenue = breakdownData.reduce(
      (s, r) => s + r.actual_revenue,
      0,
    );
    const totalPlannedCost = breakdownData.reduce(
      (s, r) => s + r.planned_cost,
      0,
    );
    const totalActualCost = breakdownData.reduce(
      (s, r) => s + r.actual_cost,
      0,
    );

    const totalHours = breakdownData.reduce((s, r) => {
      const areaActuals = actuals.get(r.practice_area);
      let th = 0;
      if (areaActuals) areaActuals.forEach((v) => (th += v.total_hours));
      return s + th;
    }, 0);
    const totalBillable = breakdownData.reduce((s, r) => {
      const areaActuals = actuals.get(r.practice_area);
      let bh = 0;
      if (areaActuals) areaActuals.forEach((v) => (bh += v.billable_hours));
      return s + bh;
    }, 0);

    const avgTargetUtil =
      breakdownData.length > 0
        ? breakdownData.reduce((s, r) => s + r.target_utilization, 0) /
          breakdownData.length
        : 75;

    return {
      totalPlannedRevenue,
      totalActualRevenue,
      totalPlannedCost,
      totalActualCost,
      costBudgetRemaining: totalPlannedCost - totalActualCost,
      overallVariancePct:
        totalPlannedRevenue > 0
          ? Math.round(
              ((totalActualRevenue - totalPlannedRevenue) /
                totalPlannedRevenue) *
                1000,
            ) / 10
          : 0,
      targetUtilization: Math.round(avgTargetUtil * 10) / 10,
      actualUtilization:
        totalHours > 0
          ? Math.round((totalBillable / totalHours) * 1000) / 10
          : 0,
      profitMargin:
        totalActualRevenue > 0
          ? Math.round(
              ((totalActualRevenue - totalActualCost) / totalActualRevenue) *
                1000,
            ) / 10
          : 0,
    };
  }, [breakdownData, actuals]);

  // Update budget entries for a given area
  const updateBudgetForArea = useCallback(
    (
      area: string,
      monthlyData: Array<{
        month: number;
        planned_revenue: number;
        planned_cost: number;
        target_utilization: number;
      }>,
    ) => {
      setBudgetEntries((prev) => {
        const other = prev.filter(
          (e) => !(e.practice_area === area && e.year === year),
        );
        const newEntries = monthlyData.map((m) => ({
          id: generateId(),
          practice_area: area,
          year,
          month: m.month,
          planned_revenue: m.planned_revenue,
          planned_cost: m.planned_cost,
          target_utilization: m.target_utilization,
        }));
        return [...other, ...newEntries];
      });
    },
    [year],
  );

  // Set annual targets with uniform distribution
  const setAnnualTargets = useCallback(
    (
      area: string,
      annualRevenue: number,
      annualCost: number,
      utilization: number,
    ) => {
      const monthlyRev = Math.round(annualRevenue / 12);
      const monthlyCost = Math.round(annualCost / 12);
      const monthly = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        planned_revenue: monthlyRev,
        planned_cost: monthlyCost,
        target_utilization: utilization,
      }));
      updateBudgetForArea(area, monthly);
    },
    [updateBudgetForArea],
  );

  return {
    budgetEntries: yearEntries,
    setBudgetEntries,
    notes,
    setNote,
    getNote,
    timelineData,
    breakdownData,
    kpis,
    allAreas,
    professionalCounts,
    actuals,
    updateBudgetForArea,
    setAnnualTargets,
  };
}
