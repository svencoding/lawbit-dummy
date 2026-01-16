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
  projects: Array<{
    project_id: number;
    project_name: string;
    project_code: string;
    cost: number;
    hours: number;
  }>;
}

export type ViewType = "clients" | "projects" | "professionals" | null;

export const COLORS = [
  "hsl(210, 55%, 50%)",
  "hsl(43, 74%, 52%)",
  "hsl(142, 71%, 45%)",
  "hsl(280, 65%, 60%)",
  "hsl(12, 76%, 61%)",
  "hsl(200, 70%, 55%)",
  "hsl(30, 80%, 55%)",
  "hsl(160, 60%, 50%)",
  "hsl(320, 70%, 65%)",
  "hsl(15, 75%, 58%)",
];

export const chartConfig = {
  cost: {
    label: "Costo (Millones)",
    color: "hsl(var(--chart-1))",
  },
  hours: {
    label: "Horas",
    color: "hsl(var(--chart-2))",
  },
  projects: {
    label: "Proyectos",
    color: "hsl(var(--chart-3))",
  },
} as const;
