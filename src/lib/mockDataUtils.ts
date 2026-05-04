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
  formaCobro?: string | null,
  userCode?: string | null,
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

  // Filter by forma de cobro if provided
  if (formaCobro) {
    transformedEntries = transformedEntries.filter((entry) => {
      const asunto = asuntosMap.get(entry.project_id);
      return asunto && asunto.charge_type === formaCobro;
    });
  }

  // Filter by encargado (user code) if provided
  if (userCode) {
    transformedEntries = transformedEntries.filter((entry) => {
      const usuario = usuariosMap.get(entry.user_id);
      return usuario && usuario.code === userCode;
    });
  }

  const clientMap = new Map<string, ClientCost>();

  transformedEntries.forEach((entry) => {
    const key = entry.client_code;
    if (!clientMap.has(key)) {
      const cliente = clientesMap.get(parseInt(entry.client_code, 10));
      clientMap.set(key, {
        client_name: entry.client_name,
        client_code: entry.client_code,
        client_group_name: entry.client_group_name,
        industry: cliente?.industry ?? null,
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
    effective_date: u.created_at || "2025-01-01",
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
  formaCobro?: string | null,
  userCode?: string | null,
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

  // Filter by forma de cobro if provided
  if (formaCobro) {
    transformedEntries = transformedEntries.filter((entry) => {
      const asunto = asuntosMap.get(entry.project_id);
      return asunto && asunto.charge_type === formaCobro;
    });
  }

  // Filter by encargado (user code) if provided
  if (userCode) {
    transformedEntries = transformedEntries.filter((entry) => {
      const usuario = usuariosMap.get(entry.user_id);
      return usuario && usuario.code === userCode;
    });
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
  formaCobro?: string | null,
  userCode?: string | null,
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

  // Filter entries by forma de cobro if needed
  if (formaCobro) {
    filteredEntries = filteredEntries.filter((entry) => {
      const asunto = asuntosMap.get(entry.project_id);
      return asunto && asunto.charge_type === formaCobro;
    });
  }

  // Filter entries by encargado (user code) if needed
  if (userCode) {
    filteredEntries = filteredEntries.filter((entry) => {
      const usuario = usuariosMap.get(entry.user_id);
      return usuario && usuario.code === userCode;
    });
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

    // Filter by forma de cobro if needed
    if (formaCobro) {
      const asunto = asuntosMap.get(f.asunto_id || 0);
      if (!asunto || asunto.charge_type !== formaCobro) {
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

// Get client profitability data (facturacion vs costo) with project breakdown
export function getClientProfitability(
  startDate?: Date,
  endDate?: Date,
  clientName?: string | null,
  userName?: string | null,
): Array<{
  client_name: string;
  client_code: string;
  facturacion: number;
  costo_total: number;
  margen: number;
  margen_percent: number;
  projects: Array<{
    project_id: number;
    project_name: string;
    facturacion: number;
    costo_total: number;
    margen_percent: number;
  }>;
}> {
  let entries = getTransformedTimeEntries(startDate, endDate);

  if (clientName) {
    entries = entries.filter((e) => e.client_name === clientName);
  }

  if (userName) {
    entries = entries.filter((e) => e.user_name === userName);
  }

  // When filtering by professional, only include payments for projects they worked on
  const userProjectIds = userName
    ? new Set(entries.map((e) => e.project_id))
    : null;

  // Filter payments by date
  const filteredPayments = facturacion.filter((f) => {
    if (!f.month) return false;
    const paymentDate = normalizeDate(f.month);
    if (!paymentDate) return false;
    const date = new Date(paymentDate + "T00:00:00");
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

    // Filter by client name
    if (clientName) {
      if (!f.cliente_id) return false;
      const cliente = clientesMap.get(f.cliente_id);
      if (!cliente || cliente.name !== clientName) return false;
    }

    // Filter payments to only projects the professional worked on
    if (userProjectIds) {
      if (!f.asunto_id || !userProjectIds.has(f.asunto_id)) return false;
    }

    return true;
  });

  // Build client map
  const clientDataMap = new Map<
    string,
    {
      client_name: string;
      client_code: string;
      facturacion: number;
      costo_total: number;
      projectMap: Map<
        number,
        {
          project_id: number;
          project_name: string;
          facturacion: number;
          costo_total: number;
        }
      >;
    }
  >();

  // Add payment data (facturacion)
  filteredPayments.forEach((payment) => {
    if (!payment.cliente_id) return;
    const cliente = clientesMap.get(payment.cliente_id);
    if (!cliente) return;
    const clientCode = payment.cliente_id.toString();

    if (!clientDataMap.has(clientCode)) {
      clientDataMap.set(clientCode, {
        client_name: cliente.name || `Cliente ${cliente.id}`,
        client_code: clientCode,
        facturacion: 0,
        costo_total: 0,
        projectMap: new Map(),
      });
    }

    const client = clientDataMap.get(clientCode)!;
    client.facturacion += payment.amount_charged || 0;

    if (payment.asunto_id) {
      const asunto = asuntosMap.get(payment.asunto_id);
      if (!client.projectMap.has(payment.asunto_id)) {
        client.projectMap.set(payment.asunto_id, {
          project_id: payment.asunto_id,
          project_name: asunto?.title || `Asunto ${payment.asunto_id}`,
          facturacion: 0,
          costo_total: 0,
        });
      }
      const project = client.projectMap.get(payment.asunto_id)!;
      project.facturacion += payment.amount_charged || 0;
    }
  });

  // Add cost data from time entries
  entries.forEach((entry) => {
    const clientCode = entry.client_code;
    if (!clientDataMap.has(clientCode)) {
      clientDataMap.set(clientCode, {
        client_name: entry.client_name,
        client_code: clientCode,
        facturacion: 0,
        costo_total: 0,
        projectMap: new Map(),
      });
    }

    const client = clientDataMap.get(clientCode)!;
    const cost =
      entry.originalEntry.total_cost ??
      entry.duration * (entry.originalEntry.hourly_cost || 0);
    client.costo_total += cost;

    if (!client.projectMap.has(entry.project_id)) {
      client.projectMap.set(entry.project_id, {
        project_id: entry.project_id,
        project_name: entry.project_name,
        facturacion: 0,
        costo_total: 0,
      });
    }
    const project = client.projectMap.get(entry.project_id)!;
    project.costo_total += cost;
  });

  return Array.from(clientDataMap.values())
    .map((client) => {
      const margen = client.facturacion - client.costo_total;
      const margen_percent =
        client.facturacion > 0 ? (margen / client.facturacion) * 100 : 0;

      const projects = Array.from(client.projectMap.values())
        .map((project) => {
          const pMargen = project.facturacion - project.costo_total;
          const pMargenPercent =
            project.facturacion > 0
              ? (pMargen / project.facturacion) * 100
              : 0;
          return { ...project, margen_percent: pMargenPercent };
        })
        .sort((a, b) => b.facturacion - a.facturacion);

      return {
        client_name: client.client_name,
        client_code: client.client_code,
        facturacion: client.facturacion,
        costo_total: client.costo_total,
        margen,
        margen_percent,
        projects,
      };
    })
    .sort((a, b) => b.facturacion - a.facturacion);
}

// Get billable hours grouped by user category with individual user breakdown
export function getCategoryBillableHours(
  startDate?: Date,
  endDate?: Date,
  clientName?: string | null,
  userName?: string | null,
): Array<{
  category: string;
  billable_hours: number;
  users: Array<{ name: string; code: string; billable_hours: number }>;
}> {
  let entries = getTransformedTimeEntries(startDate, endDate);

  if (clientName) {
    entries = entries.filter((e) => e.client_name === clientName);
  }

  if (userName) {
    entries = entries.filter((e) => e.user_name === userName);
  }

  const categoryMap = new Map<
    string,
    {
      total: number;
      userMap: Map<
        number,
        { name: string; code: string; hours: number }
      >;
    }
  >();

  entries.forEach((entry) => {
    const usuario = usuariosMap.get(entry.user_id);
    if (!usuario) return;
    const category = usuario.category || "Sin categoría";

    if (!categoryMap.has(category)) {
      categoryMap.set(category, { total: 0, userMap: new Map() });
    }
    const cat = categoryMap.get(category)!;
    cat.total += entry.billable_duration;

    if (!cat.userMap.has(entry.user_id)) {
      cat.userMap.set(entry.user_id, {
        name: usuario.name,
        code: usuario.code,
        hours: 0,
      });
    }
    cat.userMap.get(entry.user_id)!.hours += entry.billable_duration;
  });

  const categoryOrder = [
    "Socio",
    "Asociado Sr",
    "Asociado",
    "Asociado Junior",
  ];

  return categoryOrder
    .map((category) => {
      const data = categoryMap.get(category);
      const users = data
        ? Array.from(data.userMap.values())
            .map((u) => ({
              name: u.name,
              code: u.code,
              billable_hours: u.hours,
            }))
            .sort((a, b) => b.billable_hours - a.billable_hours)
        : [];
      return {
        category,
        billable_hours: data?.total || 0,
        users,
      };
    })
    .filter((item) => item.billable_hours > 0);
}

// --- Historical Project Comparison ---

export interface HistoricalProject {
  asunto_id: number;
  title: string;
  client_name: string;
  practice_area: string;
  project_type: string | null;
  charge_type: string | null;
  amount: number;
  total_hours: number;
  billable_hours: number;
  total_cost: number;
  total_billed: number;
  avg_rate: number;
  profit_margin: number;
  start_date: string | null;
  end_date: string | null;
  duration_days: number;
  team: Array<{
    user_name: string;
    user_code: string;
    category: string;
    hours: number;
  }>;
  team_size: number;
}

export function getHistoricalProjectsByArea(
  area: string,
): HistoricalProject[] {
  const areaAsuntos = asuntos.filter(
    (a) => a.practice_area === area && a.billable === "SI",
  );

  const result: HistoricalProject[] = [];

  for (const asunto of areaAsuntos) {
    const entries = timeEntries.filter(
      (e) => parseInt(String(e.asunto_id), 10) === asunto.id,
    );

    if (entries.length === 0) continue;

    let totalHours = 0;
    let billableHours = 0;
    let totalCost = 0;
    const teamMap = new Map<
      string,
      { hours: number; code: string; category: string }
    >();
    let minDate: string | null = null;
    let maxDate: string | null = null;

    for (const entry of entries) {
      const hours = typeof entry.hours === "number" ? entry.hours : 0;
      const bh =
        typeof entry.billable_hour === "number" ? entry.billable_hour : 0;
      const cost = typeof entry.total_cost === "number" ? entry.total_cost : 0;
      totalHours += hours;
      billableHours += bh;
      totalCost += cost;

      const usuario = usuariosByCodeMap.get(entry.user_name);
      const existing = teamMap.get(entry.user_name);
      if (existing) {
        existing.hours += hours;
      } else {
        teamMap.set(entry.user_name, {
          hours,
          code: entry.user_name,
          category: usuario?.category || "Asociado",
        });
      }

      const normalized = normalizeDate(entry.date);
      if (normalized) {
        if (!minDate || normalized < minDate) minDate = normalized;
        if (!maxDate || normalized > maxDate) maxDate = normalized;
      }
    }

    const totalBilled = facturacion
      .filter((f) => f.asunto_id === asunto.id)
      .reduce((sum, f) => sum + (f.amount_charged || 0), 0);

    const avgRate = billableHours > 0 ? totalBilled / billableHours : 0;
    const profitMargin =
      totalBilled > 0 ? ((totalBilled - totalCost) / totalBilled) * 100 : 0;

    const durationDays =
      minDate && maxDate
        ? Math.max(
            1,
            Math.ceil(
              (new Date(maxDate).getTime() - new Date(minDate).getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          )
        : 0;

    const team = Array.from(teamMap.entries())
      .map(([, data]) => ({
        user_name: usuariosByCodeMap.get(data.code)?.name || data.code,
        user_code: data.code,
        category: data.category,
        hours: Math.round(data.hours * 10) / 10,
      }))
      .sort((a, b) => b.hours - a.hours);

    const cliente = clientesMap.get(asunto.cliente_id || 0);

    result.push({
      asunto_id: asunto.id,
      title: asunto.title || `Asunto ${asunto.id}`,
      client_name: cliente?.name || asunto.cliente_id?.toString() || "—",
      practice_area: area,
      project_type: asunto.project_type || null,
      charge_type: asunto.charge_type || null,
      amount: asunto.amount || 0,
      total_hours: Math.round(totalHours * 10) / 10,
      billable_hours: Math.round(billableHours * 10) / 10,
      total_cost: Math.round(totalCost),
      total_billed: Math.round(totalBilled),
      avg_rate: Math.round(avgRate),
      profit_margin: Math.round(profitMargin * 10) / 10,
      start_date: minDate,
      end_date: maxDate,
      duration_days: durationDays,
      team,
      team_size: team.length,
    });
  }

  return result.sort((a, b) => b.total_billed - a.total_billed);
}

// --- Budget / Strategic Planning utilities ---

export interface AreaMonthActuals {
  revenue: number;
  cost: number;
  total_hours: number;
  billable_hours: number;
}

/**
 * Get actual revenue, cost, and hours grouped by practice area and month for a given year.
 */
export function getActualsByAreaAndMonth(
  year: number,
): Map<string, Map<number, AreaMonthActuals>> {
  const result = new Map<string, Map<number, AreaMonthActuals>>();

  const ensureBucket = (area: string, month: number) => {
    if (!result.has(area)) result.set(area, new Map());
    const areaMap = result.get(area)!;
    if (!areaMap.has(month))
      areaMap.set(month, { revenue: 0, cost: 0, total_hours: 0, billable_hours: 0 });
    return areaMap.get(month)!;
  };

  // Revenue from facturacion
  facturacion.forEach((f) => {
    if (!f.month || !f.asunto_id) return;
    const dateStr = normalizeDate(f.month);
    if (!dateStr) return;
    const date = new Date(dateStr + "T00:00:00");
    if (date.getFullYear() !== year) return;

    const asunto = asuntosMap.get(f.asunto_id);
    if (!asunto?.practice_area) return;

    const bucket = ensureBucket(asunto.practice_area, date.getMonth() + 1);
    bucket.revenue += f.amount_charged || 0;
  });

  // Cost + hours from time entries
  timeEntries.forEach((entry) => {
    const dateStr = normalizeDate(entry.date);
    if (!dateStr) return;
    const date = new Date(dateStr + "T00:00:00");
    if (date.getFullYear() !== year) return;

    const asuntoId = parseInt(String(entry.asunto_id), 10);
    const asunto = asuntosMap.get(asuntoId);
    if (!asunto?.practice_area) return;

    const hours = typeof entry.hours === "number" ? entry.hours : 0;
    const bh = typeof entry.billable_hour === "number" ? entry.billable_hour : 0;
    const cost = typeof entry.total_cost === "number" ? entry.total_cost : 0;

    const bucket = ensureBucket(asunto.practice_area, date.getMonth() + 1);
    bucket.cost += cost;
    bucket.total_hours += hours;
    bucket.billable_hours += bh;
  });

  return result;
}

/**
 * Count professionals per practice area from usuarios.
 */
export function getProfessionalCountByArea(): Map<string, number> {
  const counts = new Map<string, number>();
  usuarios.forEach((u) => {
    if (u.practice_area) {
      counts.set(u.practice_area, (counts.get(u.practice_area) || 0) + 1);
    }
  });
  return counts;
}

/**
 * Get all unique practice areas present in the mock data.
 */
export function getAllPracticeAreas(): string[] {
  const areas = new Set<string>();
  asuntos.forEach((a) => {
    if (a.practice_area) areas.add(a.practice_area);
  });
  return Array.from(areas).sort();
}

export interface BudgetVsActualTeamRow {
  level: string;
  label: string;
  budgetedHours: number;
  actualHours: number;
  budgetedRate: number;
  actualRate: number;
  actualCost: number;
  budgetedCost: number;
}

export interface BudgetVsActualRow {
  asuntoId: number;
  displayId: string;
  project: string;
  area: string;
  date: string;
  budgetedPrice: number;
  actualPrice: number;
  budgetedHours: number;
  actualHours: number;
  status: "completed" | "in_progress";
  budgetedRate: number;
  actualRate: number;
  team: BudgetVsActualTeamRow[];
  lastActivity: number;
}

const PRACTICE_AREA_TITLES = new Set([
  "Asuntos Internos",
  "Consultoría",
  "Corporativo",
  "Laboral",
  "Litigios",
  "Penal",
  "Procesal",
]);

function buildProjectLabel(asunto: Asunto, clienteName: string | null | undefined): string {
  const title = asunto.title?.trim();
  if (title && !PRACTICE_AREA_TITLES.has(title)) return title;
  const fallback = asunto.project_type || asunto.practice_area || "Asunto";
  return `${fallback} – ${clienteName || `Cliente ${asunto.cliente_id ?? ""}`}`;
}

const CATEGORY_TO_LEVEL: Record<string, { level: string; label: string; order: number }> = {
  "Socio": { level: "partner", label: "Socio", order: 0 },
  "Asociado Sr": { level: "senior", label: "Asociado Senior", order: 1 },
  "Asociado": { level: "associate", label: "Asociado", order: 2 },
};

/**
 * Build budgeted-vs-actual rows from real asuntos.
 * - budgetedPrice  = asunto.amount (real quoted contract value)
 * - actualPrice    = sum of payments for the asunto, falling back to actual cost
 * - actualHours    = sum of time entries
 * - budgetedHours  = budgetedPrice / blended actual rate
 * - status         = "completed" if billed >= 85% of amount, else "in_progress"
 * - team breakdown = real time entries aggregated by usuario.category;
 *                    budgeted hours per level distributed proportionally
 */
export function getBudgetVsActualComparison(limit = 10): BudgetVsActualRow[] {
  const entries = getTransformedTimeEntries();
  const payments = getFacturacion();
  const users = getUsuarios();
  const clientsById = new Map(getClientes().map((c) => [c.id, c]));

  const usersById = new Map(users.map((u) => [u.id, u]));
  const avgRateByCategory = new Map<string, number>();
  const grouped = new Map<string, { rateSum: number; n: number }>();
  users.forEach((u) => {
    const g = grouped.get(u.category) || { rateSum: 0, n: 0 };
    g.rateSum += u.rate || 0;
    g.n += 1;
    grouped.set(u.category, g);
  });
  grouped.forEach((g, cat) => avgRateByCategory.set(cat, g.n > 0 ? g.rateSum / g.n : 0));

  const paymentsByAsunto = new Map<number, number>();
  payments.forEach((p) => {
    if (p.asunto_id == null) return;
    paymentsByAsunto.set(p.asunto_id, (paymentsByAsunto.get(p.asunto_id) || 0) + (p.amount_charged || 0));
  });

  type Acc = {
    totalHours: number;
    totalCost: number;
    lastEntry: number;
    byCategory: Map<string, { hours: number; cost: number }>;
  };
  const accByAsunto = new Map<number, Acc>();
  let globalMaxEntry = 0;
  entries.forEach((e) => {
    const u = usersById.get(e.user_id);
    if (!u) return;
    const cost = e.originalEntry.total_cost ?? (e.duration * (e.originalEntry.hourly_cost || 0));
    const ts = e.date ? new Date(e.date).getTime() : 0;
    if (ts > globalMaxEntry) globalMaxEntry = ts;
    let acc = accByAsunto.get(e.project_id);
    if (!acc) {
      acc = { totalHours: 0, totalCost: 0, lastEntry: 0, byCategory: new Map() };
      accByAsunto.set(e.project_id, acc);
    }
    acc.totalHours += e.duration;
    acc.totalCost += cost;
    if (ts > acc.lastEntry) acc.lastEntry = ts;
    const c = acc.byCategory.get(u.category) || { hours: 0, cost: 0 };
    c.hours += e.duration;
    c.cost += cost;
    acc.byCategory.set(u.category, c);
  });

  const rows: BudgetVsActualRow[] = [];
  for (const a of getAsuntos()) {
    const amount = a.amount || 0;
    if (amount < 1000) continue;
    const acc = accByAsunto.get(a.id);
    if (!acc || acc.totalHours <= 0) continue;

    const billed = paymentsByAsunto.get(a.id) || 0;
    const actualPrice = billed > 0 ? billed : acc.totalCost;
    const actualHours = acc.totalHours;
    const blendedActualRate = actualHours > 0 ? acc.totalCost / actualHours : 0;
    const budgetedRate = blendedActualRate > 0 ? blendedActualRate : 1500;
    const budgetedHours = Math.max(1, Math.round(amount / budgetedRate));
    const idleDays = globalMaxEntry > 0 && acc.lastEntry > 0
      ? (globalMaxEntry - acc.lastEntry) / (1000 * 60 * 60 * 24)
      : 0;
    const status: "completed" | "in_progress" =
      billed >= amount * 0.5 || idleDays >= 45 ? "completed" : "in_progress";

    const cliente = a.cliente_id != null ? clientsById.get(a.cliente_id) : null;
    const projectLabel = buildProjectLabel(a, cliente?.name);

    const team: BudgetVsActualTeamRow[] = [];
    Object.entries(CATEGORY_TO_LEVEL).forEach(([cat, info]) => {
      const c = acc.byCategory.get(cat);
      if (!c || c.hours <= 0) return;
      const proportion = c.hours / actualHours;
      const tBudgetedHours = Math.round(budgetedHours * proportion);
      const actualRate = c.hours > 0 ? c.cost / c.hours : 0;
      const tBudgetedRate = avgRateByCategory.get(cat) || actualRate;
      team.push({
        level: info.level,
        label: info.label,
        budgetedHours: tBudgetedHours,
        actualHours: Math.round(c.hours),
        budgetedRate: Math.round(tBudgetedRate),
        actualRate: Math.round(actualRate),
        actualCost: Math.round(c.cost),
        budgetedCost: Math.round(tBudgetedHours * tBudgetedRate),
      });
    });
    team.sort((x, y) => {
      const ox = Object.values(CATEGORY_TO_LEVEL).find((v) => v.level === x.level)?.order ?? 99;
      const oy = Object.values(CATEGORY_TO_LEVEL).find((v) => v.level === y.level)?.order ?? 99;
      return ox - oy;
    });

    rows.push({
      asuntoId: a.id,
      displayId: `AS-${a.id}`,
      project: projectLabel,
      area: a.practice_area || "—",
      date: normalizeDate(a.created_date || "") || a.created_date || "",
      budgetedPrice: Math.round(amount),
      actualPrice: Math.round(actualPrice),
      budgetedHours,
      actualHours: Math.round(actualHours),
      status,
      budgetedRate: Math.round(budgetedRate),
      actualRate: Math.round(blendedActualRate),
      team,
      lastActivity: acc.lastEntry,
    });
  }

  rows.sort((a, b) => {
    if (b.lastActivity !== a.lastActivity) return b.lastActivity - a.lastActivity;
    return b.budgetedPrice - a.budgetedPrice;
  });
  return rows.slice(0, limit);
}

/**
 * Build the same budget-vs-actual breakdown for a single asunto.
 * Returns null if the asunto has no quoted amount or no time entries.
 */
export function getBudgetVsActualForAsunto(asuntoId: number): BudgetVsActualRow | null {
  const asunto = getAsuntos().find((a) => a.id === asuntoId);
  if (!asunto) return null;
  const amount = asunto.amount || 0;
  if (amount <= 0) return null;

  const entries = getTransformedTimeEntries().filter((e) => e.project_id === asuntoId);
  if (entries.length === 0) return null;

  const users = getUsuarios();
  const usersById = new Map(users.map((u) => [u.id, u]));
  const avgRateByCategory = new Map<string, number>();
  const grouped = new Map<string, { rateSum: number; n: number }>();
  users.forEach((u) => {
    const g = grouped.get(u.category) || { rateSum: 0, n: 0 };
    g.rateSum += u.rate || 0;
    g.n += 1;
    grouped.set(u.category, g);
  });
  grouped.forEach((g, cat) => avgRateByCategory.set(cat, g.n > 0 ? g.rateSum / g.n : 0));

  let totalHours = 0;
  let totalCost = 0;
  let lastEntry = 0;
  const byCategory = new Map<string, { hours: number; cost: number }>();
  // Find global max entry timestamp so idle-day status is consistent with the comparison list
  let globalMaxEntry = 0;
  getTransformedTimeEntries().forEach((e) => {
    const ts = e.date ? new Date(e.date).getTime() : 0;
    if (ts > globalMaxEntry) globalMaxEntry = ts;
  });
  entries.forEach((e) => {
    const u = usersById.get(e.user_id);
    if (!u) return;
    const cost = e.originalEntry.total_cost ?? (e.duration * (e.originalEntry.hourly_cost || 0));
    totalHours += e.duration;
    totalCost += cost;
    const ts = e.date ? new Date(e.date).getTime() : 0;
    if (ts > lastEntry) lastEntry = ts;
    const c = byCategory.get(u.category) || { hours: 0, cost: 0 };
    c.hours += e.duration;
    c.cost += cost;
    byCategory.set(u.category, c);
  });
  if (totalHours <= 0) return null;

  const billed = getFacturacion()
    .filter((p) => p.asunto_id === asuntoId)
    .reduce((s, p) => s + (p.amount_charged || 0), 0);

  const actualPrice = billed > 0 ? billed : totalCost;
  const blendedActualRate = totalCost / totalHours;
  const budgetedRate = blendedActualRate > 0 ? blendedActualRate : 1500;
  const budgetedHours = Math.max(1, Math.round(amount / budgetedRate));
  const idleDays = globalMaxEntry > 0 && lastEntry > 0
    ? (globalMaxEntry - lastEntry) / (1000 * 60 * 60 * 24)
    : 0;
  const status: "completed" | "in_progress" =
    billed >= amount * 0.5 || idleDays >= 45 ? "completed" : "in_progress";

  const clientes = getClientes();
  const cliente = asunto.cliente_id != null ? clientes.find((c) => c.id === asunto.cliente_id) : null;

  const team: BudgetVsActualTeamRow[] = [];
  Object.entries(CATEGORY_TO_LEVEL).forEach(([cat, info]) => {
    const c = byCategory.get(cat);
    if (!c || c.hours <= 0) return;
    const proportion = c.hours / totalHours;
    const tBudgetedHours = Math.round(budgetedHours * proportion);
    const actualRate = c.hours > 0 ? c.cost / c.hours : 0;
    const tBudgetedRate = avgRateByCategory.get(cat) || actualRate;
    team.push({
      level: info.level,
      label: info.label,
      budgetedHours: tBudgetedHours,
      actualHours: Math.round(c.hours),
      budgetedRate: Math.round(tBudgetedRate),
      actualRate: Math.round(actualRate),
      actualCost: Math.round(c.cost),
      budgetedCost: Math.round(tBudgetedHours * tBudgetedRate),
    });
  });
  team.sort((x, y) => {
    const ox = Object.values(CATEGORY_TO_LEVEL).find((v) => v.level === x.level)?.order ?? 99;
    const oy = Object.values(CATEGORY_TO_LEVEL).find((v) => v.level === y.level)?.order ?? 99;
    return ox - oy;
  });

  return {
    asuntoId: asunto.id,
    displayId: `AS-${asunto.id}`,
    project: buildProjectLabel(asunto, cliente?.name),
    area: asunto.practice_area || "—",
    date: normalizeDate(asunto.created_date || "") || asunto.created_date || "",
    budgetedPrice: Math.round(amount),
    actualPrice: Math.round(actualPrice),
    budgetedHours,
    actualHours: Math.round(totalHours),
    status,
    budgetedRate: Math.round(budgetedRate),
    actualRate: Math.round(blendedActualRate),
    team,
    lastActivity: lastEntry,
  };
}

// ============================================================================
// Task type distribution per asunto
// ============================================================================

export interface TaskTypeRow {
  taskType: string;
  hours: number;
  pct: number;
  costUsd: number;
  signal: "muy_alto" | "alto" | "normal" | "bajo";
}

const TASK_TYPES: { name: string; weight: number }[] = [
  { name: "Revisión documental, IRL, VDR", weight: 45.4 },
  { name: "Coordinación interna", weight: 20.0 },
  { name: "Redacción / Reportes", weight: 15.5 },
  { name: "Reuniones", weight: 14.5 },
  { name: "Gestión cliente", weight: 2.0 },
  { name: "Otros", weight: 1.4 },
  { name: "Llamadas", weight: 0.9 },
  { name: "Supervisión", weight: 0.3 },
];

const TASK_COST_RATE_USD = 160;

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function pickTaskType(seed: string): string {
  const total = TASK_TYPES.reduce((s, t) => s + t.weight, 0);
  const r = (hashString(seed) % 10000) / 10000 * total;
  let acc = 0;
  for (const t of TASK_TYPES) {
    acc += t.weight;
    if (r < acc) return t.name;
  }
  return TASK_TYPES[TASK_TYPES.length - 1].name;
}

function classifySignal(pct: number, taskType: string): TaskTypeRow["signal"] {
  // Industry benchmarks: review-type and meetings should stay moderate
  const isReviewOrMeeting =
    taskType === "Revisión documental, IRL, VDR" ||
    taskType === "Reuniones" ||
    taskType === "Coordinación interna";
  if (isReviewOrMeeting) {
    if (pct >= 30) return "muy_alto";
    if (pct >= 15) return "alto";
    if (pct >= 3) return "normal";
    return "bajo";
  }
  if (pct >= 25) return "alto";
  if (pct >= 3) return "normal";
  return "bajo";
}

export function getTaskDistributionForAsunto(asuntoId: number): TaskTypeRow[] {
  const entries = getTransformedTimeEntries().filter((e) => e.project_id === asuntoId);
  if (entries.length === 0) return [];

  const map = new Map<string, number>();
  TASK_TYPES.forEach((t) => map.set(t.name, 0));

  entries.forEach((e) => {
    const seed = `${e.date}|${e.user_id}|${e.project_id}|${e.duration}`;
    const taskType = pickTaskType(seed);
    map.set(taskType, (map.get(taskType) || 0) + e.duration);
  });

  const totalHours = Array.from(map.values()).reduce((s, h) => s + h, 0);
  const rows: TaskTypeRow[] = TASK_TYPES.map((t) => {
    const hours = map.get(t.name) || 0;
    const pct = totalHours > 0 ? (hours / totalHours) * 100 : 0;
    return {
      taskType: t.name,
      hours,
      pct,
      costUsd: hours * TASK_COST_RATE_USD,
      signal: classifySignal(pct, t.name),
    };
  });

  rows.sort((a, b) => b.hours - a.hours);
  return rows.filter((r) => r.hours > 0);
}

export interface TaskTypeBreakdownRow {
  user_id: number;
  user_name: string;
  category: string;
  rate: number;
  hours: number;
  costUsd: number;
  pct: number;
}

export function getTaskTypeBreakdownForAsunto(
  asuntoId: number,
  taskType: string,
): TaskTypeBreakdownRow[] {
  const entries = getTransformedTimeEntries().filter((e) => e.project_id === asuntoId);
  if (entries.length === 0) return [];
  const usuarios = getUsuarios();

  const map = new Map<number, { hours: number; cost: number }>();
  entries.forEach((e) => {
    const seed = `${e.date}|${e.user_id}|${e.project_id}|${e.duration}`;
    if (pickTaskType(seed) !== taskType) return;
    const cost =
      e.originalEntry.total_cost ?? e.duration * (e.originalEntry.hourly_cost || 0);
    const cur = map.get(e.user_id) || { hours: 0, cost: 0 };
    cur.hours += e.duration;
    cur.cost += cost;
    map.set(e.user_id, cur);
  });

  const totalHours = Array.from(map.values()).reduce((s, v) => s + v.hours, 0);
  const rows: TaskTypeBreakdownRow[] = [];
  map.forEach((v, user_id) => {
    const u = usuarios.find((x) => x.id === user_id);
    const blendedCost = v.hours > 0 ? v.cost : v.hours * TASK_COST_RATE_USD;
    rows.push({
      user_id,
      user_name: u?.name || `Usuario ${user_id}`,
      category: u?.category || "—",
      rate: u?.rate || 0,
      hours: v.hours,
      costUsd: blendedCost,
      pct: totalHours > 0 ? (v.hours / totalHours) * 100 : 0,
    });
  });
  rows.sort((a, b) => b.hours - a.hours);
  return rows;
}
