export interface TimeEntry {
  id: number;
  date: string;
  duration: number;
  billable_duration: number;
  user_id: number;
  user_name: string;
  project_id: number;
  project_name: string;
  project_code: string;
  client_name: string;
  client_code: string;
  client_group_name: string | null;
  billable: boolean;
}

export interface UserCost {
  user_id: number;
  hourly_cost: number;
  effective_date: string;
}

export interface ProjectCost {
  project_id: number;
  project_name: string;
  project_code: string;
  client_name: string;
  total_cost: number;
  total_hours: number;
  billable_hours: number;
}

export interface UserProjectCost {
  user_id: number;
  user_name: string;
  total_cost: number;
  total_hours: number;
  project_count: number;
}

export interface ProfessionalProjectDetail {
  project_id: number;
  project_name: string;
  project_code: string;
  client_name: string;
  client_code: string;
  total_hours: number;
  total_cost: number;
  entries_count: number;
}

export interface ClientCost {
  client_name: string;
  client_code: string;
  client_group_name: string | null;
  total_cost: number;
  total_hours: number;
  billable_hours: number;
  project_count: number;
  industry: string | null;
  projects: Array<{
    project_id: number;
    project_name: string;
    project_code: string;
    cost: number;
    hours: number;
  }>;
}

export type ViewType = "clients" | "projects" | "professionals" | null;

// Budget / Strategic Planning types
export interface BudgetEntry {
  id: string;
  practice_area: string;
  year: number;
  month: number; // 1-12
  planned_revenue: number;
  planned_cost: number;
  target_utilization: number; // 0-100
}

export interface BudgetNote {
  practice_area: string;
  year: number;
  month: number;
  note: string;
}

export interface BudgetBreakdownRow {
  practice_area: string;
  professional_count: number;
  planned_revenue: number;
  actual_revenue: number;
  revenue_variance: number;
  revenue_pct: number;
  planned_cost: number;
  actual_cost: number;
  cost_variance: number;
  target_utilization: number;
  actual_utilization: number;
  profit_margin: number;
}

export interface BudgetTimelinePoint {
  month: string; // "2025-02"
  monthLabel: string; // "Feb"
  planned_revenue: number;
  actual_revenue: number;
  planned_cost: number;
  actual_cost: number;
  cumulative_planned_revenue: number;
  cumulative_actual_revenue: number;
}

/** @deprecated Use getChartColor() from @/lib/chartColors instead */
export { getChartColor as COLORS_FN } from "@/lib/chartColors";
import { getChartColor } from "@/lib/chartColors";
export const COLORS = Array.from({ length: 10 }, (_, i) => getChartColor(i));

export const chartConfig = {
  cost: {
    label: "Costo (Millones)",
    color: "hsl(var(--chart-2))",
  },
  hours: {
    label: "Horas",
    color: "hsl(var(--chart-4))",
  },
  projects: {
    label: "Proyectos",
    color: "hsl(var(--chart-6))",
  },
} as const;
