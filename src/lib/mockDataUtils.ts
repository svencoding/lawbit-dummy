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

// Map new practice areas to old format for compatibility
function mapPracticeArea(area: string | null): string {
  if (!area) return "CORPORATIVO";

  const mapping: Record<string, string> = {
    "Corporativo": "CORPORATIVO",
    "Laboral": "DERECHO LABORAL",
    "Litigios": "LITIGIO",
    "Penal": "DERECHO PENAL",
    "Consultoría": "CORPORATIVO", // Default mapping
    "Asuntos Internos": "CORPORATIVO", // Default mapping
    "Procesal": "LITIGIO", // Default mapping
  };

  return mapping[area] || "CORPORATIVO";
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
  return timeEntries
    .map((entry) => {
      const entryDate = normalizeDate(entry.date);
      if (!entryDate) return null;

      // Filter by date range if provided
      if (startDate || endDate) {
        const date = new Date(entryDate);
        if (startDate && date < startDate) return null;
        if (endDate && date > endDate) return null;
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
}

// Get client costs aggregated data
export function getClientCosts(
  startDate?: Date,
  endDate?: Date,
): ClientCost[] {
  const transformedEntries = getTransformedTimeEntries(startDate, endDate);
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
): DashboardData {
  const transformedEntries = getTransformedTimeEntries(startDate, endDate);

  // Filter entries by area if needed
  const filteredEntries = selectedArea === "all"
    ? transformedEntries
    : transformedEntries.filter((entry) => {
      const asunto = asuntosMap.get(entry.project_id);
      return asunto && mapPracticeArea(asunto.practice_area) === selectedArea;
    });

  // Get unique clients
  const uniqueClients = new Set(filteredEntries.map((e) => e.client_code));

  // Calculate total billed from facturacion (payments)
  const filteredFacturacion = facturacion.filter((f) => {
    if (!f.month) return false;
    const paymentDate = normalizeDate(f.month);
    if (!paymentDate) return false;
    const date = new Date(paymentDate);
    if (startDate && date < startDate) return false;
    if (endDate && date > endDate) return false;

    if (selectedArea !== "all") {
      const asunto = asuntosMap.get(f.asunto_id || 0);
      return asunto && mapPracticeArea(asunto.practice_area) === selectedArea;
    }
    return true;
  });

  const totalFacturado = filteredFacturacion.reduce(
    (sum, f) => sum + (f.amount_charged || 0),
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

    const area = mapPracticeArea(asunto.practice_area);
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

    const area = mapPracticeArea(asunto.practice_area);
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

// Group professionals by seniority based on their rates
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

  const rates = Array.from(professionalRates.values()).map((p) => p.rate);
  rates.sort((a, b) => a - b);
  const minRate = rates[0];
  const maxRate = rates[rates.length - 1];
  const range = maxRate - minRate;

  const levels = [
    {
      level: "junior",
      label: "Asociado Junior",
      color: "bg-blue-100 text-blue-800",
    },
    {
      level: "associate",
      label: "Asociado",
      color: "bg-green-100 text-green-800",
    },
    {
      level: "senior",
      label: "Asociado Senior",
      color: "bg-yellow-100 text-yellow-800",
    },
    {
      level: "partner",
      label: "Socio",
      color: "bg-orange-100 text-orange-800",
    },
  ];

  const numProfessionals = professionalRates.size;
  let activeLevels = levels;
  if (numProfessionals <= 2) {
    activeLevels = [levels[0], levels[levels.length - 1]];
  } else if (numProfessionals <= 4) {
    activeLevels = [
      levels[0],
      levels[Math.floor(levels.length / 2)],
      levels[levels.length - 1],
    ];
  }

  const result: Array<{
    level: string;
    label: string;
    avgHourlyRate: number;
    professionals: string[];
    color: string;
  }> = [];
  const numLevels = activeLevels.length;

  for (let i = 0; i < numLevels; i++) {
    const percentileStart = i / numLevels;
    const percentileEnd = (i + 1) / numLevels;

    const rateStart = minRate + range * percentileStart;
    const rateEnd = minRate + range * percentileEnd;

    const professionals: string[] = [];
    let totalRate = 0;
    let count = 0;

    professionalRates.forEach((prof) => {
      if (
        prof.rate >= rateStart &&
        (i === numLevels - 1 ? prof.rate <= rateEnd : prof.rate < rateEnd)
      ) {
        professionals.push(prof.name);
        totalRate += prof.rate;
        count++;
      }
    });

    if (count > 0) {
      result.push({
        level: activeLevels[i].level,
        label: activeLevels[i].label,
        avgHourlyRate: Math.round(totalRate / count),
        professionals,
        color: activeLevels[i].color,
      });
    }
  }

  return result;
}

// Get pricing data for a specific area
export function getPricingData(area: string): PricingData {
  const transformedEntries = getTransformedTimeEntries();

  // Filter entries by area
  const areaEntries = transformedEntries.filter((entry) => {
    const asunto = asuntosMap.get(entry.project_id);
    return asunto && mapPracticeArea(asunto.practice_area) === area;
  });

  if (areaEntries.length === 0) {
    return {
      avgHourlyRate: 0,
      avgTotalBilled: 0,
      avgHoursPerCase: 0,
      totalCases: 0,
      medianHourlyRate: 0,
      seniorityLevels: [],
    };
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
    if (asunto && mapPracticeArea(asunto.practice_area) === area) {
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

  // Group professionals by seniority
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

  return {
    avgHourlyRate: Math.round(avgHourlyRate),
    avgTotalBilled: Math.round(avgTotalBilled),
    avgHoursPerCase: Math.round(avgHoursPerCase * 10) / 10,
    totalCases: uniqueCases.size,
    medianHourlyRate: Math.round(medianHourlyRate),
    seniorityLevels,
  };
}

// Get full pricing data structure
export function getFullPricingData(): PricingDataStructure {
  // Get all unique areas
  const areas = new Set<string>();
  asuntos.forEach((a) => {
    if (a.practice_area) {
      areas.add(mapPracticeArea(a.practice_area));
    }
  });

  // Build seniority levels from usuarios
  const seniorityLevels: PricingDataStructure["seniorityLevels"] = {
    junior: {
      label: "Asociado Junior",
      avgHourlyRate: 125,
      monthlySalary: 4500,
      hourlyCost: 28,
      color: "bg-blue-100 text-blue-800",
    },
    associate: {
      label: "Asociado",
      avgHourlyRate: 250,
      monthlySalary: 8000,
      hourlyCost: 50,
      color: "bg-green-100 text-green-800",
    },
    senior: {
      label: "Asociado Senior",
      avgHourlyRate: 500,
      monthlySalary: 15000,
      hourlyCost: 94,
      color: "bg-yellow-100 text-yellow-800",
    },
    partner: {
      label: "Socio",
      avgHourlyRate: 850,
      monthlySalary: 25000,
      hourlyCost: 156,
      color: "bg-orange-100 text-orange-800",
    },
  };

  // Calculate average rates from actual data
  const rates = usuarios.map((u) => u.rate).filter((r) => r > 0);
  if (rates.length > 0) {
    rates.sort((a, b) => a - b);
    const quartiles = [
      rates[Math.floor(rates.length * 0.25)],
      rates[Math.floor(rates.length * 0.5)],
      rates[Math.floor(rates.length * 0.75)],
    ];

    seniorityLevels.junior.avgHourlyRate = Math.round(quartiles[0] || 125);
    seniorityLevels.associate.avgHourlyRate = Math.round(
      (quartiles[0] + quartiles[1]) / 2 || 250,
    );
    seniorityLevels.senior.avgHourlyRate = Math.round(
      (quartiles[1] + quartiles[2]) / 2 || 500,
    );
    seniorityLevels.partner.avgHourlyRate = Math.round(
      quartiles[2] || 850,
    );
  }

  // Build area-specific data
  const areaSpecificData: Record<string, PricingData> = {};
  areas.forEach((area) => {
    areaSpecificData[area] = getPricingData(area);
  });

  return {
    seniorityLevels,
    areaSpecificData,
  };
}
