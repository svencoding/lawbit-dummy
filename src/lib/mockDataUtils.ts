import clientesData from "./mock/clientes.json";
import asuntosData from "./mock/asuntos.json";
import facturacionData from "./mock/facturacion.json";
import usuariosData from "./mock/usuarios.json";
import timeEntriesData from "./mock/time-entries.json";
import type {
  Asunto,
  Cliente,
  Payment,
  TimeEntry as RelationalTimeEntry,
  Usuario,
} from "./mock/types";
import type {
  ClientCost,
  ProfessionalProjectDetail,
  ProjectCost,
  TimeEntry,
  UserProjectCost,
} from "./types";
import { getAreaColor } from "./constants";
import { formatDateLocal } from "./utils";

// Use practice areas directly from mock data - no mapping needed
function mapPracticeArea(area: string | null): string {
  // Just return the area as-is from the mock data
  // The mock data uses: "Asuntos Internos", "Consultoría", "Corporativo", "Laboral", "Litigios", "Penal", "Procesal"
  return area || "";
}

// Type assertions
const clientes = clientesData as Cliente[];
const asuntos = asuntosData as Asunto[];
const facturacion = facturacionData as Payment[];
const usuarios = usuariosData as Usuario[];
const timeEntries = timeEntriesData as RelationalTimeEntry[];

// Helper function to normalize dates from "M/D/YYYY" to "YYYY-MM-DD"
function normalizeDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;

  // Handle ISO format dates
  if (dateStr.includes("-")) {
    return dateStr;
  }

  // Handle "M/D/YYYY" format
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const month = parts[0].padStart(2, "0");
    const day = parts[1].padStart(2, "0");
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }

  return dateStr;
}

// Helper function to compare dates by date only (ignoring time)
function compareDateOnly(date1: Date, date2: Date): number {
  const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
  return d1.getTime() - d2.getTime();
}

// Create lookup maps for efficient joins
const clientesMap = new Map<number, Cliente>();
const asuntosMap = new Map<number, Asunto>();
const usuariosMap = new Map<number, Usuario>();
const usuariosByCodeMap = new Map<string, Usuario>();

clientes.forEach((c) => clientesMap.set(c.id, c));
asuntos.forEach((a) => asuntosMap.set(a.id, a));
usuarios.forEach((u) => {
  usuariosMap.set(u.id, u);
  usuariosByCodeMap.set(u.code, u);
});

// Create a map for efficient lookup of original entries
const timeEntryMap = new Map<string, RelationalTimeEntry>();
timeEntries.forEach((entry) => {
  const key =
    `${entry.date}_${entry.cliente_id}_${entry.asunto_id}_${entry.user_name}`;
  timeEntryMap.set(key, entry);
});

// Transform relational time entries to the format expected by components
export function getTransformedTimeEntries(
  startDate?: Date,
  endDate?: Date,
): Array<TimeEntry & { originalEntry: RelationalTimeEntry }> {
  // Debug logging
  if (startDate || endDate) {
    console.log("🔍 Date Filter Debug:", {
      startDate: startDate ? formatDateLocal(startDate) : "none",
      endDate: endDate ? formatDateLocal(endDate) : "none",
      totalEntries: timeEntries.length,
    });

    // Sample first 5 dates to see what we're working with
    const sampleDates = timeEntries.slice(0, 5).map((e) => ({
      original: e.date,
      normalized: normalizeDate(e.date),
    }));
    console.log("📅 Sample dates from data:", sampleDates);
  }

  let filteredCount = 0;
  let passedCount = 0;

  const result = timeEntries
    .map((entry) => {
      const entryDate = normalizeDate(entry.date);
      if (!entryDate) return null;

      // Filter by date range if provided
      if (startDate || endDate) {
        const date = new Date(entryDate + "T00:00:00"); // Ensure consistent timezone
        let shouldInclude = true;

        if (startDate) {
          const start = new Date(
            startDate.getFullYear(),
            startDate.getMonth(),
            startDate.getDate(),
          );
          const comparison = compareDateOnly(date, start);
          if (comparison < 0) {
            shouldInclude = false;
            filteredCount++;
          }
        }
        if (endDate && shouldInclude) {
          const end = new Date(
            endDate.getFullYear(),
            endDate.getMonth(),
            endDate.getDate(),
          );
          const comparison = compareDateOnly(date, end);
          if (comparison > 0) {
            shouldInclude = false;
            filteredCount++;
          }
        }

        if (!shouldInclude) {
          // Log first few filtered entries for debugging
          if (filteredCount <= 3) {
            console.log(
              `❌ Filtered out: ${entryDate} (entry date: ${entry.date})`,
              {
                dateObj: date.toISOString(),
                startDate: startDate ? formatDateLocal(startDate) : null,
                endDate: endDate ? formatDateLocal(endDate) : null,
              },
            );
          }
          return null;
        }
        passedCount++;
      }

      const clienteId = parseInt(entry.cliente_id.toString(), 10);
      const asuntoId = parseInt(entry.asunto_id.toString(), 10);
      const cliente = clientesMap.get(clienteId);
      const asunto = asuntosMap.get(asuntoId);
      const usuario = usuariosByCodeMap.get(entry.user_name);

      if (!cliente || !asunto || !usuario) return null;

      // Handle both possible field names - check the actual structure
      const billableHours = (entry as any).billable_hours ??
        (entry as any).billable_hour ?? 0;
      const nonBillableHours = (entry as any).non_billable_hours ??
        (entry as any).non_billable ?? 0;
      const totalHours = entry.hours ?? (billableHours + nonBillableHours);

      return {
        id: entry.date + entry.cliente_id + entry.asunto_id + entry.user_name,
        date: entryDate,
        duration: totalHours,
        billable_duration: billableHours,
        user_id: usuario.id,
        user_name: usuario.name,
        project_id: asunto.id,
        project_name: asunto.title || `Asunto ${asunto.id}`,
        project_code: asunto.id.toString(),
        client_name: cliente.name || `Cliente ${cliente.id}`,
        client_code: cliente.id.toString(),
        client_group_name: cliente.client_manager,
        billable: asunto.billable === "SI",
        originalEntry: entry,
      } as TimeEntry & { originalEntry: RelationalTimeEntry };
    })
    .filter((
      entry,
    ): entry is TimeEntry & { originalEntry: RelationalTimeEntry } =>
      entry !== null
    );

  // Log summary after filtering
  if (startDate || endDate) {
    console.log("✅ Date Filter Summary:", {
      totalEntries: timeEntries.length,
      entriesPassedFilter: result.length,
      filteredOut: timeEntries.length - result.length,
      dateRange: {
        start: startDate ? formatDateLocal(startDate) : "none",
        end: endDate ? formatDateLocal(endDate) : "none",
      },
      samplePassedDates: result.slice(0, 5).map((e) => e.date),
    });
  }

  return result;
}

// Get client costs aggregated data
export function getClientCosts(
  startDate?: Date,
  endDate?: Date,
  clientName?: string | null,
  area?: string | null,
): ClientCost[] {
  let transformedEntries = getTransformedTimeEntries(startDate, endDate);

  // Filter by client if provided
  if (clientName) {
    transformedEntries = transformedEntries.filter(
      (entry) => entry.client_name === clientName,
    );
  }

  // Filter by area if provided (use area directly from mock data)
  if (area && area !== "all") {
    transformedEntries = transformedEntries.filter((entry) => {
      const asunto = asuntosMap.get(entry.project_id);
      return asunto && asunto.practice_area === area;
    });
  }

  const clientMap = new Map<string, ClientCost>();

  transformedEntries.forEach((entry) => {
    const key = entry.client_code;
    if (!clientMap.has(key)) {
      clientMap.set(key, {
        client_name: entry.client_name,
        client_code: entry.client_code,
        client_group_name: entry.client_group_name,
        total_cost: 0,
        total_hours: 0,
        billable_hours: 0,
        project_count: 0,
        projects: [],
      });
    }

    const client = clientMap.get(key)!;
    let project = client.projects.find((p) =>
      p.project_id === entry.project_id
    );

    if (!project) {
      project = {
        project_id: entry.project_id,
        project_name: entry.project_name,
        project_code: entry.project_code,
        cost: 0,
        hours: 0,
      };
      client.projects.push(project);
      client.project_count++;
    }

    // Use total_cost from original entry, or calculate from hours and hourly_cost
    const cost = entry.originalEntry.total_cost ??
      (entry.duration * (entry.originalEntry.hourly_cost || 0));

    project.cost += cost;
    project.hours += entry.duration;
    client.total_cost += cost;
    client.total_hours += entry.duration;
    client.billable_hours += entry.billable_duration;
  });

  return Array.from(clientMap.values());
}

// Get project costs aggregated data
export function getProjectCosts(
  startDate?: Date,
  endDate?: Date,
): ProjectCost[] {
  const transformedEntries = getTransformedTimeEntries(startDate, endDate);
  const projectMap = new Map<number, ProjectCost>();

  transformedEntries.forEach((entry) => {
    if (!projectMap.has(entry.project_id)) {
      projectMap.set(entry.project_id, {
        project_id: entry.project_id,
        project_name: entry.project_name,
        project_code: entry.project_code,
        client_name: entry.client_name,
        total_cost: 0,
        total_hours: 0,
        billable_hours: 0,
      });
    }

    const project = projectMap.get(entry.project_id)!;

    // Use total_cost from original entry, or calculate from hours and hourly_cost
    const cost = entry.originalEntry.total_cost ??
      (entry.duration * (entry.originalEntry.hourly_cost || 0));

    project.total_cost += cost;
    project.total_hours += entry.duration;
    project.billable_hours += entry.billable_duration;
  });

  return Array.from(projectMap.values());
}

// Get user costs
export function getUserCosts(): Array<{
  user_id: number;
  hourly_cost: number;
  effective_date: string;
}> {
  return usuarios.map((u) => ({
    user_id: u.id,
    hourly_cost: u.hourly_cost,
    effective_date: u.created_at || "2024-01-01",
  }));
}

// Get user project costs
export function getUserProjectCosts(
  startDate?: Date,
  endDate?: Date,
): UserProjectCost[] {
  const transformedEntries = getTransformedTimeEntries(startDate, endDate);
  const userMap = new Map<number, UserProjectCost>();
  const userProjectsMap = new Map<number, Set<number>>();

  transformedEntries.forEach((entry) => {
    if (!userMap.has(entry.user_id)) {
      userMap.set(entry.user_id, {
        user_id: entry.user_id,
        user_name: entry.user_name,
        total_cost: 0,
        total_hours: 0,
        project_count: 0,
      });
      userProjectsMap.set(entry.user_id, new Set());
    }

    const user = userMap.get(entry.user_id)!;
    const projectSet = userProjectsMap.get(entry.user_id)!;

    // Track unique projects
    projectSet.add(entry.project_id);
    user.project_count = projectSet.size;

    // Use total_cost from original entry, or calculate from hours and hourly_cost
    const cost = entry.originalEntry.total_cost ??
      (entry.duration * (entry.originalEntry.hourly_cost || 0));

    user.total_cost += cost;
    user.total_hours += entry.duration;
  });

  return Array.from(userMap.values());
}

// Get revenue by user (for top users chart)
export function getRevenueByUser(
  startDate?: Date,
  endDate?: Date,
  clientName?: string | null,
): Array<{
  user_id: number;
  user_name: string;
  user_code: string;
  revenue: number;
}> {
  let transformedEntries = getTransformedTimeEntries(startDate, endDate);

  // Filter by client if provided
  if (clientName) {
    transformedEntries = transformedEntries.filter(
      (entry) => entry.client_name === clientName,
    );
  }

  const userRevenueMap = new Map<number, {
    user_id: number;
    user_name: string;
    user_code: string;
    revenue: number;
  }>();

  transformedEntries.forEach((entry) => {
    const usuario = usuariosMap.get(entry.user_id);
    if (!usuario) return;

    if (!userRevenueMap.has(entry.user_id)) {
      userRevenueMap.set(entry.user_id, {
        user_id: entry.user_id,
        user_name: usuario.name,
        user_code: usuario.code,
        revenue: 0,
      });
    }

    const userRevenue = userRevenueMap.get(entry.user_id)!;
    // Calculate revenue: billable_duration * rate
    const revenue = entry.billable_duration * (usuario.rate || 0);
    userRevenue.revenue += revenue;
  });

  return Array.from(userRevenueMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5); // Top 5 users
}

// Get professional project details
export function getProfessionalProjectDetails(
  startDate?: Date,
  endDate?: Date,
): ProfessionalProjectDetail[] {
  const transformedEntries = getTransformedTimeEntries(startDate, endDate);
  const projectMap = new Map<number, ProfessionalProjectDetail>();

  transformedEntries.forEach((entry) => {
    if (!projectMap.has(entry.project_id)) {
      projectMap.set(entry.project_id, {
        project_id: entry.project_id,
        project_name: entry.project_name,
        project_code: entry.project_code,
        client_name: entry.client_name,
        client_code: entry.client_code,
        total_hours: 0,
        total_cost: 0,
        entries_count: 0,
      });
    }

    const project = projectMap.get(entry.project_id)!;

    // Use total_cost from original entry, or calculate from hours and hourly_cost
    const cost = entry.originalEntry.total_cost ??
      (entry.duration * (entry.originalEntry.hourly_cost || 0));

    project.total_hours += entry.duration;
    project.total_cost += cost;
    project.entries_count++;
  });

  return Array.from(projectMap.values());
}

// Get comprehensive user profile data
export function getUserProfileData(
  userCode: string,
  startDate?: Date,
  endDate?: Date,
): {
  user_id: number;
  user_name: string;
  user_code: string;
  total_hours: number;
  total_revenue: number;
  total_cost: number;
  projects: Array<{
    project_id: number;
    project_name: string;
    project_code: string;
    client_name: string;
    client_code: string;
    total_hours: number;
    total_cost: number;
    revenue: number;
  }>;
  clients: Array<{
    client_name: string;
    client_code: string;
    total_hours: number;
    total_cost: number;
    revenue: number;
    project_count: number;
  }>;
} | null {
  // Find user by code
  const usuario = Array.from(usuariosMap.values()).find(
    (u) => u.code === userCode,
  );
  if (!usuario) return null;

  let transformedEntries = getTransformedTimeEntries(startDate, endDate);

  // Filter entries for this user
  const userEntries = transformedEntries.filter(
    (entry) => entry.user_id === usuario.id,
  );

  if (userEntries.length === 0) {
    return {
      user_id: usuario.id,
      user_name: usuario.name,
      user_code: usuario.code,
      total_hours: 0,
      total_revenue: 0,
      total_cost: 0,
      projects: [],
      clients: [],
    };
  }

  // Calculate totals
  let total_hours = 0;
  let total_revenue = 0;
  let total_cost = 0;

  // Track projects
  const projectMap = new Map<
    number,
    {
      project_id: number;
      project_name: string;
      project_code: string;
      client_name: string;
      client_code: string;
      total_hours: number;
      total_cost: number;
      revenue: number;
    }
  >();

  // Track clients
  const clientMap = new Map<
    string,
    {
      client_name: string;
      client_code: string;
      total_hours: number;
      total_cost: number;
      revenue: number;
      project_ids: Set<number>;
    }
  >();

  userEntries.forEach((entry) => {
    // Calculate cost
    const cost = entry.originalEntry.total_cost ??
      entry.duration * (entry.originalEntry.hourly_cost || 0);

    // Calculate revenue (billable hours * rate)
    const revenue = entry.billable_duration * (usuario.rate || 0);

    total_hours += entry.duration;
    total_cost += cost;
    total_revenue += revenue;

    // Track project
    if (!projectMap.has(entry.project_id)) {
      projectMap.set(entry.project_id, {
        project_id: entry.project_id,
        project_name: entry.project_name,
        project_code: entry.project_code,
        client_name: entry.client_name,
        client_code: entry.client_code,
        total_hours: 0,
        total_cost: 0,
        revenue: 0,
      });
    }
    const project = projectMap.get(entry.project_id)!;
    project.total_hours += entry.duration;
    project.total_cost += cost;
    project.revenue += revenue;

    // Track client
    if (!clientMap.has(entry.client_code)) {
      clientMap.set(entry.client_code, {
        client_name: entry.client_name,
        client_code: entry.client_code,
        total_hours: 0,
        total_cost: 0,
        revenue: 0,
        project_ids: new Set(),
      });
    }
    const client = clientMap.get(entry.client_code)!;
    client.total_hours += entry.duration;
    client.total_cost += cost;
    client.revenue += revenue;
    client.project_ids.add(entry.project_id);
  });

  // Convert maps to arrays
  const projects = Array.from(projectMap.values()).sort(
    (a, b) => b.revenue - a.revenue,
  );
  const clients = Array.from(clientMap.values())
    .map((client) => ({
      client_name: client.client_name,
      client_code: client.client_code,
      total_hours: client.total_hours,
      total_cost: client.total_cost,
      revenue: client.revenue,
      project_count: client.project_ids.size,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    user_id: usuario.id,
    user_name: usuario.name,
    user_code: usuario.code,
    total_hours,
    total_revenue,
    total_cost,
    projects,
    clients,
  };
}

// Export raw data accessors
export function getClientes(): Cliente[] {
  return clientes;
}

export function getAsuntos(): Asunto[] {
  return asuntos;
}

export function getFacturacion(): Payment[] {
  return facturacion;
}

export function getUsuarios(): Usuario[] {
  return usuarios;
}

export function getRawTimeEntries(): RelationalTimeEntry[] {
  return timeEntries;
}

// Dashboard data transformation
export interface DashboardData {
  clientesUnicos: number;
  totalFacturado: number;
  metaFacturacion: number;
  totalHorasFacturables?: number;
  promedioDiasFacturacion: number;
  promedioDiasPago: number;
  facturacionPorArea: Array<{
    area: string;
    meta: number;
    facturacion: number;
    color: string;
  }>;
  areaSpecificData: Record<
    string,
    {
      clientesUnicos: number;
      totalFacturado: number;
      metaFacturacion: number;
      promedioDiasFacturacion: number;
      promedioDiasPago: number;
      statusChart: Array<{ name: string; value: number }>;
      formaCobroChart: Array<{ name: string; value: number }>;
    }
  >;
  revenueChart: Array<{ month: string; revenue: number }>;
  statusChart: Array<{ name: string; value: number }>;
  formaCobroChart: Array<{ name: string; value: number }>;
  areasChart: Array<{ name: string; value: number }>;
}

// Get dashboard data aggregated from relational data
export function getDashboardData(
  selectedArea: string = "all",
  startDate?: Date,
  endDate?: Date,
  clientName?: string | null,
): DashboardData {
  const transformedEntries = getTransformedTimeEntries(startDate, endDate);

  // Filter entries by area if needed (use area directly from mock data)
  let filteredEntries = selectedArea === "all"
    ? transformedEntries
    : transformedEntries.filter((entry) => {
      const asunto = asuntosMap.get(entry.project_id);
      return asunto && asunto.practice_area === selectedArea;
    });

  // Filter entries by client if needed
  if (clientName) {
    filteredEntries = filteredEntries.filter((entry) =>
      entry.client_name === clientName
    );
  }

  // Get unique clients
  const uniqueClients = new Set(filteredEntries.map((e) => e.client_code));

  // Calculate total billed from facturacion (payments)
  const filteredFacturacion = facturacion.filter((f) => {
    if (!f.month) return false;
    const paymentDate = normalizeDate(f.month);
    if (!paymentDate) return false;
    const date = new Date(paymentDate + "T00:00:00"); // Ensure consistent timezone
    if (startDate) {
      const start = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate(),
      );
      if (compareDateOnly(date, start) < 0) return false;
    }
    if (endDate) {
      const end = new Date(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate(),
      );
      if (compareDateOnly(date, end) > 0) return false;
    }

    if (selectedArea !== "all") {
      const asunto = asuntosMap.get(f.asunto_id || 0);
      if (!asunto || asunto.practice_area !== selectedArea) {
        return false;
      }
    }

    // Filter by client if needed
    if (clientName) {
      const clienteId = f.cliente_id;
      const cliente = clientesMap.get(clienteId);
      if (!cliente || cliente.name !== clientName) {
        return false;
      }
    }

    return true;
  });

  const totalFacturado = filteredFacturacion.reduce(
    (sum, f) => sum + (f.amount_charged || 0),
    0,
  );

  // Calculate total billable hours from filtered entries
  const totalHorasFacturables = filteredEntries.reduce(
    (sum, entry) => sum + (entry.billable_duration || 0),
    0,
  );

  // Calculate by practice area
  const areaDataMap = new Map<
    string,
    {
      clientes: Set<string>;
      facturacion: number;
      facturaciones: Payment[];
      timeEntries: Array<TimeEntry & { originalEntry: RelationalTimeEntry }>;
    }
  >();

  transformedEntries.forEach((entry) => {
    const asunto = asuntosMap.get(entry.project_id);
    if (!asunto || !asunto.practice_area) return;

    const area = asunto.practice_area; // Use area directly from mock data
    if (!areaDataMap.has(area)) {
      areaDataMap.set(area, {
        clientes: new Set(),
        facturacion: 0,
        facturaciones: [],
        timeEntries: [],
      });
    }

    const areaData = areaDataMap.get(area)!;
    areaData.clientes.add(entry.client_code);
    areaData.timeEntries.push(entry);
  });

  // Add facturacion to areas
  filteredFacturacion.forEach((f) => {
    const asunto = asuntosMap.get(f.asunto_id || 0);
    if (!asunto || !asunto.practice_area) return;

    const area = asunto.practice_area; // Use area directly from mock data
    const areaData = areaDataMap.get(area);
    if (areaData) {
      areaData.facturacion += f.amount_charged || 0;
      areaData.facturaciones.push(f);
    }
  });

  // Build facturacionPorArea
  const facturacionPorArea = Array.from(areaDataMap.entries()).map(
    ([area, data]) => ({
      area,
      meta: data.facturacion * 1.1, // Estimate meta as 110% of actual
      facturacion: data.facturacion,
      color: getAreaColor(area),
    }),
  );

  // Build area-specific data
  const areaSpecificData: Record<string, any> = {};
  areaDataMap.forEach((data, area) => {
    // Calculate status chart from facturaciones (simplified - would need actual status)
    const statusCounts = new Map<string, number>();
    data.facturaciones.forEach(() => {
      // Since we don't have status in Payment, estimate distribution
      const statuses = [
        "Pagado",
        "Facturado",
        "En revisión",
        "Pendiente",
        "Vencido",
      ];
      const weights = [0.5, 0.3, 0.1, 0.08, 0.02];
      const rand = Math.random();
      let cumulative = 0;
      for (let i = 0; i < statuses.length; i++) {
        cumulative += weights[i];
        if (rand < cumulative) {
          const status = statuses[i];
          statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
          break;
        }
      }
    });

    const statusChart = Array.from(statusCounts.entries()).map((
      [name, value],
    ) => ({
      name,
      value,
    }));

    // Calculate formaCobroChart from asuntos
    const formaCobroCounts = new Map<string, number>();
    data.timeEntries.forEach((entry) => {
      const asunto = asuntosMap.get(entry.project_id);
      if (asunto?.charge_type) {
        const chargeType = asunto.charge_type;
        formaCobroCounts.set(
          chargeType,
          (formaCobroCounts.get(chargeType) || 0) + 1,
        );
      }
    });

    const formaCobroChart = Array.from(formaCobroCounts.entries()).map(
      ([name, value]) => ({
        name,
        value,
      }),
    );

    areaSpecificData[area] = {
      clientesUnicos: data.clientes.size,
      totalFacturado: data.facturacion,
      metaFacturacion: data.facturacion * 1.1,
      promedioDiasFacturacion: 18, // Estimated
      promedioDiasPago: 32, // Estimated
      statusChart,
      formaCobroChart,
    };
  });

  // Build revenue chart by month
  const revenueByMonth = new Map<string, number>();
  filteredFacturacion.forEach((f) => {
    if (!f.month) return;
    const monthDate = normalizeDate(f.month);
    if (!monthDate) return;
    const date = new Date(monthDate);
    const monthKey = `${date.getFullYear()}-${
      String(date.getMonth() + 1).padStart(2, "0")
    }`;
    revenueByMonth.set(
      monthKey,
      (revenueByMonth.get(monthKey) || 0) + (f.amount_charged || 0),
    );
  });

  const revenueChart = Array.from(revenueByMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, revenue]) => ({ month, revenue }));

  // Build status chart (aggregate)
  const statusCounts = new Map<string, number>();
  filteredFacturacion.forEach(() => {
    const statuses = [
      "Pagado",
      "Facturado",
      "En revisión",
      "Pendiente",
      "Vencido",
    ];
    const weights = [0.5, 0.3, 0.1, 0.08, 0.02];
    const rand = Math.random();
    let cumulative = 0;
    for (let i = 0; i < statuses.length; i++) {
      cumulative += weights[i];
      if (rand < cumulative) {
        const status = statuses[i];
        statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
        break;
      }
    }
  });

  const statusChart = Array.from(statusCounts.entries()).map((
    [name, value],
  ) => ({
    name,
    value,
  }));

  // Build formaCobroChart (aggregate)
  const formaCobroCounts = new Map<string, number>();
  filteredEntries.forEach((entry) => {
    const asunto = asuntosMap.get(entry.project_id);
    if (asunto?.charge_type) {
      const chargeType = asunto.charge_type;
      formaCobroCounts.set(
        chargeType,
        (formaCobroCounts.get(chargeType) || 0) + 1,
      );
    }
  });

  const formaCobroChart = Array.from(formaCobroCounts.entries()).map(
    ([name, value]) => ({
      name,
      value,
    }),
  );

  // Build areasChart
  const areasChart = Array.from(areaDataMap.entries()).map(([area, data]) => ({
    name: area,
    value: data.clientes.size,
  }));

  return {
    clientesUnicos: uniqueClients.size,
    totalFacturado,
    metaFacturacion: totalFacturado * 1.1,
    totalHorasFacturables,
    promedioDiasFacturacion: 18,
    promedioDiasPago: 32,
    facturacionPorArea,
    areaSpecificData,
    revenueChart,
    statusChart,
    formaCobroChart,
    areasChart,
  };
}

// Pricing data transformation
export interface PricingData {
  avgHourlyRate: number;
  avgTotalBilled: number;
  avgHoursPerCase: number;
  totalCases: number;
  medianHourlyRate: number;
  seniorityLevels: Array<{
    level: string;
    label: string;
    avgHourlyRate: number;
    professionals: string[];
    color: string;
  }>;
}

export interface SeniorityLevelData {
  label: string;
  avgHourlyRate: number;
  monthlySalary: number;
  hourlyCost: number;
  color: string;
}

export interface PricingDataStructure {
  seniorityLevels: {
    junior: SeniorityLevelData;
    associate: SeniorityLevelData;
    senior: SeniorityLevelData;
    partner: SeniorityLevelData;
  };
  areaSpecificData: Record<string, PricingData>;
}

// Group professionals by seniority based on their actual category from usuarios.json
function groupProfessionalsBySeniority(
  professionalRates: Map<number, { name: string; rate: number }>,
): Array<{
  level: string;
  label: string;
  avgHourlyRate: number;
  professionals: string[];
  color: string;
}> {
  if (professionalRates.size === 0) return [];

  // Group professionals by their actual category from usuarios.json
  const categoryGroups = new Map<
    string,
    { professionals: string[]; rates: number[] }
  >();

  professionalRates.forEach((prof, userId) => {
    const usuario = usuariosMap.get(userId);
    if (!usuario) return;

    const category = usuario.category;
    if (!categoryGroups.has(category)) {
      categoryGroups.set(category, { professionals: [], rates: [] });
    }
    const group = categoryGroups.get(category)!;
    group.professionals.push(prof.name);
    group.rates.push(prof.rate);
  });

  // Map categories to seniority levels
  const categoryToLevel: Record<
    string,
    { level: string; label: string; color: string }
  > = {
    "Socio": {
      level: "partner",
      label: "Socio",
      color: "bg-orange-100 text-orange-800",
    },
    "Asociado Sr": {
      level: "senior",
      label: "Asociado Senior",
      color: "bg-yellow-100 text-yellow-800",
    },
    "Asociado": {
      level: "associate",
      label: "Asociado",
      color: "bg-green-100 text-green-800",
    },
    "Asociado Junior": {
      level: "junior",
      label: "Asociado Junior",
      color: "bg-blue-100 text-blue-800",
    },
  };

  const result: Array<{
    level: string;
    label: string;
    avgHourlyRate: number;
    professionals: string[];
    color: string;
  }> = [];

  // Process categories in order: Junior -> Associate -> Senior -> Partner
  const categoryOrder = ["Asociado Junior", "Asociado", "Asociado Sr", "Socio"];

  categoryOrder.forEach((category) => {
    const group = categoryGroups.get(category);
    if (group && group.professionals.length > 0) {
      const levelInfo = categoryToLevel[category];
      const avgRate = Math.round(
        group.rates.reduce((sum, r) => sum + r, 0) / group.rates.length,
      );
      result.push({
        level: levelInfo.level,
        label: levelInfo.label,
        avgHourlyRate: avgRate,
        professionals: group.professionals,
        color: levelInfo.color,
      });
    }
  });

  // If we have "Asociado" but no "Asociado Junior", estimate junior as 70% of associate
  const asociadoGroup = categoryGroups.get("Asociado");
  const juniorGroup = categoryGroups.get("Asociado Junior");
  if (asociadoGroup && !juniorGroup && asociadoGroup.professionals.length > 0) {
    const asociadoAvgRate = Math.round(
      asociadoGroup.rates.reduce((sum, r) => sum + r, 0) /
        asociadoGroup.rates.length,
    );
    // Add junior level at the beginning
    result.unshift({
      level: "junior",
      label: "Asociado Junior",
      avgHourlyRate: Math.round(asociadoAvgRate * 0.7),
      professionals: [],
      color: "bg-blue-100 text-blue-800",
    });
  }

  return result;
}

// Cache for pricing data to avoid recomputing expensive operations
let cachedFullPricingData: PricingDataStructure | null = null;
const cachedPricingDataByArea = new Map<string, PricingData>();
let cachedTransformedEntries:
  | Array<TimeEntry & { originalEntry: RelationalTimeEntry }>
  | null = null;

// Get pricing data for a specific area
export function getPricingData(area: string): PricingData {
  // Check cache first
  if (cachedPricingDataByArea.has(area)) {
    return cachedPricingDataByArea.get(area)!;
  }

  // Use cached transformed entries if available, otherwise compute
  const transformedEntries = cachedTransformedEntries ||
    getTransformedTimeEntries();
  if (!cachedTransformedEntries) {
    cachedTransformedEntries = transformedEntries;
  }

  // Filter entries by area (use area directly from mock data)
  const areaEntries = transformedEntries.filter((entry) => {
    const asunto = asuntosMap.get(entry.project_id);
    return asunto && asunto.practice_area === area;
  });

  if (areaEntries.length === 0) {
    const emptyResult: PricingData = {
      avgHourlyRate: 0,
      avgTotalBilled: 0,
      avgHoursPerCase: 0,
      totalCases: 0,
      medianHourlyRate: 0,
      seniorityLevels: [],
    };
    cachedPricingDataByArea.set(area, emptyResult);
    return emptyResult;
  }

  // Get unique cases (asuntos) for this area
  const uniqueCases = new Set(areaEntries.map((e) => e.project_id));

  // Calculate professional rates
  const professionalRates = new Map<
    number,
    { name: string; rate: number; totalBilled: number; hours: number }
  >();

  areaEntries.forEach((entry) => {
    if (!professionalRates.has(entry.user_id)) {
      const usuario = usuariosMap.get(entry.user_id);
      professionalRates.set(entry.user_id, {
        name: entry.user_name,
        rate: usuario?.rate || 0,
        totalBilled: 0,
        hours: 0,
      });
    }

    const prof = professionalRates.get(entry.user_id)!;
    prof.totalBilled += entry.originalEntry.production ||
      entry.originalEntry.total_cost || 0;
    prof.hours += entry.duration;
  });

  // Calculate average hourly rate
  const totalBilled = Array.from(professionalRates.values()).reduce(
    (sum, p) => sum + p.totalBilled,
    0,
  );
  const totalHours = Array.from(professionalRates.values()).reduce(
    (sum, p) => sum + p.hours,
    0,
  );
  const avgHourlyRate = totalHours > 0 ? totalBilled / totalHours : 0;

  // Calculate median hourly rate
  const rates = Array.from(professionalRates.values())
    .map((p) => p.rate)
    .sort((a, b) => a - b);
  const medianHourlyRate = rates.length > 0
    ? rates.length % 2 === 0
      ? (rates[rates.length / 2 - 1] + rates[rates.length / 2]) / 2
      : rates[Math.floor(rates.length / 2)]
    : 0;

  // Calculate average total billed per case
  const facturacionesByCase = new Map<number, number>();
  facturacion.forEach((f) => {
    const asunto = asuntosMap.get(f.asunto_id || 0);
    if (asunto && asunto.practice_area === area) {
      facturacionesByCase.set(
        f.asunto_id || 0,
        (facturacionesByCase.get(f.asunto_id || 0) || 0) +
          (f.amount_charged || 0),
      );
    }
  });

  const avgTotalBilled = facturacionesByCase.size > 0
    ? Array.from(facturacionesByCase.values()).reduce((sum, v) => sum + v, 0) /
      facturacionesByCase.size
    : 0;

  // Calculate average hours per case
  const hoursByCase = new Map<number, number>();
  areaEntries.forEach((entry) => {
    hoursByCase.set(
      entry.project_id,
      (hoursByCase.get(entry.project_id) || 0) + entry.duration,
    );
  });

  const avgHoursPerCase = hoursByCase.size > 0
    ? Array.from(hoursByCase.values()).reduce((sum, h) => sum + h, 0) /
      hoursByCase.size
    : 0;

  // Group professionals by seniority based on their actual categories
  const professionalRatesForGrouping = new Map<
    number,
    { name: string; rate: number }
  >();
  professionalRates.forEach((prof, userId) => {
    professionalRatesForGrouping.set(userId, {
      name: prof.name,
      rate: prof.rate,
    });
  });

  const seniorityLevels = groupProfessionalsBySeniority(
    professionalRatesForGrouping,
  );

  // Ensure we always show all 3 levels that exist in usuarios.json, even if no professionals in this area
  // Calculate averages for all categories from usuarios.json
  const categoryGroups = new Map<
    string,
    { rates: number[]; costs: number[] }
  >();
  usuarios.forEach((u) => {
    if (!categoryGroups.has(u.category)) {
      categoryGroups.set(u.category, { rates: [], costs: [] });
    }
    const group = categoryGroups.get(u.category)!;
    if (u.rate > 0) group.rates.push(u.rate);
    if (u.hourly_cost > 0) group.costs.push(u.hourly_cost);
  });

  const categoryAverages = new Map<
    string,
    { avgRate: number; avgCost: number }
  >();
  categoryGroups.forEach((group, category) => {
    const avgRate = group.rates.length > 0
      ? Math.round(
        group.rates.reduce((sum, r) => sum + r, 0) / group.rates.length,
      )
      : 0;
    const avgCost = group.costs.length > 0
      ? Math.round(
        group.costs.reduce((sum, c) => sum + c, 0) / group.costs.length,
      )
      : 0;
    categoryAverages.set(category, { avgRate, avgCost });
  });

  // Map categories to levels
  const categoryToLevel: Record<
    string,
    { level: string; label: string; color: string }
  > = {
    "Socio": {
      level: "partner",
      label: "Socio",
      color: "bg-orange-100 text-orange-800",
    },
    "Asociado Sr": {
      level: "senior",
      label: "Asociado Senior",
      color: "bg-yellow-100 text-yellow-800",
    },
    "Asociado": {
      level: "associate",
      label: "Asociado",
      color: "bg-green-100 text-green-800",
    },
    "Asociado Junior": {
      level: "junior",
      label: "Asociado Junior",
      color: "bg-blue-100 text-blue-800",
    },
  };

  // Build final list: use actual professionals if they exist, otherwise use average from all usuarios
  const categoryOrder = ["Asociado Junior", "Asociado", "Asociado Sr", "Socio"];
  const finalSeniorityLevels = categoryOrder
    .filter((category) => {
      const avg = categoryAverages.get(category);
      return avg && avg.avgRate > 0;
    })
    .map((category) => {
      const existingLevel = seniorityLevels.find(
        (l) => l.level === categoryToLevel[category].level,
      );
      if (existingLevel) {
        return existingLevel; // Use the one with actual professionals in this area
      }
      // Include the level even if no professionals in this area, using average from all usuarios
      const avg = categoryAverages.get(category)!;
      const levelInfo = categoryToLevel[category];
      return {
        level: levelInfo.level,
        label: levelInfo.label,
        avgHourlyRate: avg.avgRate,
        professionals: [],
        color: levelInfo.color,
      };
    });

  const result: PricingData = {
    avgHourlyRate: Math.round(avgHourlyRate),
    avgTotalBilled: Math.round(avgTotalBilled),
    avgHoursPerCase: Math.round(avgHoursPerCase * 10) / 10,
    totalCases: uniqueCases.size,
    medianHourlyRate: Math.round(medianHourlyRate),
    seniorityLevels: finalSeniorityLevels,
  };

  // Cache the result
  cachedPricingDataByArea.set(area, result);
  return result;
}

// Get full pricing data structure
export function getFullPricingData(): PricingDataStructure {
  // Return cached result if available
  if (cachedFullPricingData) {
    return cachedFullPricingData;
  }
  // Get all unique areas directly from mock data
  const areas = new Set<string>();
  asuntos.forEach((a) => {
    if (a.practice_area) {
      areas.add(a.practice_area); // Use area directly, no mapping
    }
  });

  // Build seniority levels from actual usuarios data
  // Group usuarios by category to calculate averages
  const categoryGroups = new Map<
    string,
    { rates: number[]; costs: number[] }
  >();

  usuarios.forEach((u) => {
    if (!categoryGroups.has(u.category)) {
      categoryGroups.set(u.category, { rates: [], costs: [] });
    }
    const group = categoryGroups.get(u.category)!;
    if (u.rate > 0) group.rates.push(u.rate);
    if (u.hourly_cost > 0) group.costs.push(u.hourly_cost);
  });

  // Calculate averages for each category
  const categoryAverages = new Map<
    string,
    { avgRate: number; avgCost: number }
  >();
  categoryGroups.forEach((group, category) => {
    const avgRate = group.rates.length > 0
      ? Math.round(
        group.rates.reduce((sum, r) => sum + r, 0) / group.rates.length,
      )
      : 0;
    const avgCost = group.costs.length > 0
      ? Math.round(
        group.costs.reduce((sum, c) => sum + c, 0) / group.costs.length,
      )
      : 0;
    categoryAverages.set(category, { avgRate, avgCost });
  });

  // Map categories to seniority levels based on actual data from usuarios.json
  // Only use data that exists - no hardcoded fallbacks
  const socioData = categoryAverages.get("Socio");
  const asociadoSrData = categoryAverages.get("Asociado Sr");
  const asociadoData = categoryAverages.get("Asociado");
  const juniorData = categoryAverages.get("Asociado Junior");

  // Calculate monthly salaries: hourly_cost * 160 hours/month (standard working hours)
  // Build seniority levels only from data that exists
  const seniorityLevels: Partial<PricingDataStructure["seniorityLevels"]> = {};

  // Junior: use actual data if exists, otherwise estimate from Asociado (70%)
  if (juniorData) {
    seniorityLevels.junior = {
      label: "Asociado Junior",
      avgHourlyRate: juniorData.avgRate,
      monthlySalary: Math.round(juniorData.avgCost * 160),
      hourlyCost: juniorData.avgCost,
      color: "bg-blue-100 text-blue-800",
    };
  } else if (asociadoData) {
    // Estimate junior as 70% of associate if no junior data exists
    seniorityLevels.junior = {
      label: "Asociado Junior",
      avgHourlyRate: Math.round(asociadoData.avgRate * 0.7),
      monthlySalary: Math.round(asociadoData.avgCost * 0.7 * 160),
      hourlyCost: Math.round(asociadoData.avgCost * 0.7),
      color: "bg-blue-100 text-blue-800",
    };
  }

  // Associate: use actual data
  if (asociadoData) {
    seniorityLevels.associate = {
      label: "Asociado",
      avgHourlyRate: asociadoData.avgRate,
      monthlySalary: Math.round(asociadoData.avgCost * 160),
      hourlyCost: asociadoData.avgCost,
      color: "bg-green-100 text-green-800",
    };
  }

  // Senior: use actual data
  if (asociadoSrData) {
    seniorityLevels.senior = {
      label: "Asociado Senior",
      avgHourlyRate: asociadoSrData.avgRate,
      monthlySalary: Math.round(asociadoSrData.avgCost * 160),
      hourlyCost: asociadoSrData.avgCost,
      color: "bg-yellow-100 text-yellow-800",
    };
  }

  // Partner: use actual data
  if (socioData) {
    seniorityLevels.partner = {
      label: "Socio",
      avgHourlyRate: socioData.avgRate,
      monthlySalary: Math.round(socioData.avgCost * 160),
      hourlyCost: socioData.avgCost,
      color: "bg-orange-100 text-orange-800",
    };
  }

  // Ensure we have all required levels (fill with empty defaults if missing)
  const finalSeniorityLevels: PricingDataStructure["seniorityLevels"] = {
    junior: seniorityLevels.junior || {
      label: "Asociado Junior",
      avgHourlyRate: 0,
      monthlySalary: 0,
      hourlyCost: 0,
      color: "bg-blue-100 text-blue-800",
    },
    associate: seniorityLevels.associate || {
      label: "Asociado",
      avgHourlyRate: 0,
      monthlySalary: 0,
      hourlyCost: 0,
      color: "bg-green-100 text-green-800",
    },
    senior: seniorityLevels.senior || {
      label: "Asociado Senior",
      avgHourlyRate: 0,
      monthlySalary: 0,
      hourlyCost: 0,
      color: "bg-yellow-100 text-yellow-800",
    },
    partner: seniorityLevels.partner || {
      label: "Socio",
      avgHourlyRate: 0,
      monthlySalary: 0,
      hourlyCost: 0,
      color: "bg-orange-100 text-orange-800",
    },
  };

  // Build area-specific data
  const areaSpecificData: Record<string, PricingData> = {};
  areas.forEach((area) => {
    areaSpecificData[area] = getPricingData(area);
  });

  const result: PricingDataStructure = {
    seniorityLevels: finalSeniorityLevels,
    areaSpecificData,
  };

  // Cache the result
  cachedFullPricingData = result;
  return result;
}
