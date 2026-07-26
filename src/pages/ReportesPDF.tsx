import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Download,
  Clock,
  DollarSign,
  Users,
  Briefcase,
  Activity,
  CalendarIcon,
  Loader2,
  Building2,
  User,
  BarChart3,
  Target,
  Eye,
  TrendingUp,
  Percent,
  Scale,
  FileText,
  CalendarClock,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell,
  LabelList,
  AreaChart,
  Area,
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie,
} from "recharts";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import {
  getUserProfileData,
  getUsuarios,
  getRawTimeEntries,
  getDashboardData,
  getClientCosts,
  getRevenueByUser,
  getTransformedTimeEntries,
  getClientProfitability,
  getCategoryBillableHours,
  getProjectCosts,
} from "@/lib/mockDataUtils";
import type {
  TimeEntry as RelationalTimeEntry,
  Usuario,
} from "@/lib/mock/types";

const USE_MOCK_DATA = true;

// ===================== HELPERS =====================

function normalizeDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  if (dateStr.includes("-")) return new Date(dateStr + "T00:00:00");
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    return new Date(
      parseInt(parts[2], 10),
      parseInt(parts[0], 10) - 1,
      parseInt(parts[1], 10),
    );
  }
  return null;
}

function getWorkingDaysInMonth(): number {
  return 20;
}

function getBillableHours(entry: RelationalTimeEntry): number {
  return entry.billable_hours ?? 0;
}

function formatCurrency(value: number): string {
  if (value === 0) return "$0";
  if (Math.abs(value) >= 1_000_000) {
    const m = value / 1_000_000;
    return m % 1 === 0 ? `$${m}M` : `$${m.toFixed(1)}M`;
  }
  return `$${Math.round(value).toLocaleString()}`;
}

function formatDelta(
  current: number,
  previous: number,
): { percent: number; direction: "up" | "down" | "neutral" } {
  if (previous === 0) return { percent: 0, direction: "neutral" };
  const diff = current - previous;
  const percent = (diff / Math.abs(previous)) * 100;
  const dir = diff > 0.5 ? "up" : diff < -0.5 ? "down" : "neutral";
  return { percent, direction: dir };
}

// Validated chart palette (navy/gold brand — passes CVD + contrast checks)
const CHART_NAVY = "#2f5f96";
const CHART_GOLD = "#b8860b";
const CHART_TRACK = "#e8edf3";
const CHART_MUTED = "#94a3b8";

/** Random pick — makes the AI phrasing vary on every generation/download. */
function pick<T>(...opts: T[]): T {
  return opts[Math.floor(Math.random() * opts.length)];
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabelLong(key: string): string {
  const [y, mo] = key.split("-").map(Number);
  return format(new Date(y, mo - 1, 1), "MMMM yyyy", { locale: es });
}

function monthLabelShort(key: string): string {
  const [y, mo] = key.split("-").map(Number);
  return format(new Date(y, mo - 1, 1), "MMM", { locale: es });
}

// ===================== TYPES =====================

interface PeriodMetrics {
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  utilizationRate: number;
  totalRevenue: number;
  totalCost: number;
}

/** Benchmark of a professional against the rest of the firm. */
interface PeerBenchmark {
  userMonthlyAvg: number;
  firmMonthlyAvg: number;
  pctVsFirm: number;
  rank: number;
  totalPeers: number;
  recentTrendPct: number | null;
  bestMonth: { label: string; hours: number } | null;
  monthly: Array<{ month: string; user: number; firm: number }>;
}

/** Firm-wide professional stats used for gerencial insights. */
interface FirmProStats {
  firmMonthlyAvg: number;
  belowAvg: Array<{ name: string; pct: number }>;
  topPerformer: { name: string; pct: number } | null;
}

interface IndividualReportData extends PeriodMetrics {
  usuario: Usuario;
  benchmark: PeerBenchmark;
  clients: Array<{
    clientName: string;
    hours: number;
    revenue: number;
    projectCount: number;
  }>;
  projects: Array<{
    projectName: string;
    clientName: string;
    hours: number;
    revenue: number;
  }>;
  prevPeriod: PeriodMetrics | null;
}

interface GerencialReportData {
  clientesUnicos: number;
  totalFacturado: number;
  totalHorasFacturables: number;
  metaFacturacion: number;
  totalHours: number;
  utilizationRate: number;
  avgMarginPercent: number;
  totalCost: number;
  totalProjects: number;
  topClients: Array<{
    name: string;
    hours: number;
    revenue: number;
    projects: number;
    margin?: number;
  }>;
  topProfessionals: Array<{
    name: string;
    code: string;
    revenue: number;
    hours?: number;
    category?: string;
  }>;
  areaBreakdown: Array<{
    area: string;
    facturacion: number;
    meta: number;
  }>;
  topProjects: Array<{
    name: string;
    clientName: string;
    hours: number;
    revenue: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    billableHours: number;
    userCount: number;
  }>;
  monthlyRevenue: Array<{
    month: string;
    revenue: number;
  }>;
  clientProfitability: Array<{
    name: string;
    facturacion: number;
    costo: number;
    margin: number;
  }>;
  proStats: FirmProStats;
  prevPeriod: {
    totalFacturado: number;
    totalHorasFacturables: number;
    clientesUnicos: number;
  } | null;
}

// ===================== DATA FUNCTIONS =====================

function computeIndividualMetrics(
  userCode: string,
  usuario: Usuario,
  start?: Date,
  end?: Date,
): PeriodMetrics | null {
  const profileData = getUserProfileData(userCode, start, end);
  if (!profileData) return null;

  const timeEntries = getRawTimeEntries();
  let filtered = timeEntries.filter((e) => e.user_name === userCode);
  if (start || end) {
    filtered = filtered.filter((entry) => {
      const d = normalizeDate(entry.date);
      if (!d) return false;
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
  }

  let billableHrs = 0;
  let nonBillableHrs = 0;
  const months = new Set<string>();

  filtered.forEach((entry) => {
    const d = normalizeDate(entry.date);
    if (!d) return;
    months.add(`${d.getFullYear()}-${d.getMonth()}`);
    const b = getBillableHours(entry) / 60;
    billableHrs += b;
    nonBillableHrs += (entry.hours || 0) - b;
  });

  let expected = 0;
  months.forEach(() => {
    expected += usuario.daily_goal * getWorkingDaysInMonth();
  });

  return {
    totalHours: profileData.total_hours,
    billableHours: billableHrs,
    nonBillableHours:
      nonBillableHrs > 0
        ? nonBillableHrs
        : profileData.total_hours - billableHrs,
    utilizationRate: expected > 0 ? (billableHrs / expected) * 100 : 0,
    totalRevenue: profileData.total_revenue,
    totalCost: profileData.total_cost,
  };
}

function getPreviousPeriodRange(
  start?: Date,
  end?: Date,
): { prevStart: Date; prevEnd: Date } | null {
  if (!start || !end) return null;
  const dur = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - dur);
  return { prevStart, prevEnd };
}

/** Buckets billable hours per user per month within an optional date range. */
function bucketBillableByUserMonth(
  start?: Date,
  end?: Date,
): { byUser: Map<string, Map<string, number>>; months: string[] } {
  const byUser = new Map<string, Map<string, number>>();
  getRawTimeEntries().forEach((e) => {
    const d = normalizeDate(e.date);
    if (!d) return;
    if (start && d < start) return;
    if (end && d > end) return;
    const k = monthKey(d);
    let map = byUser.get(e.user_name);
    if (!map) {
      map = new Map();
      byUser.set(e.user_name, map);
    }
    map.set(k, (map.get(k) || 0) + getBillableHours(e) / 60);
  });
  const months = new Set<string>();
  byUser.forEach((m) => m.forEach((_, k) => months.add(k)));
  return { byUser, months: [...months].sort() };
}

function computePeerBenchmark(
  userCode: string,
  start?: Date,
  end?: Date,
): PeerBenchmark {
  const { byUser, months } = bucketBillableByUserMonth(start, end);

  // Firm average billable hours per active professional, per month
  const firmPerMonth = months.map((k) => {
    let total = 0;
    let n = 0;
    byUser.forEach((m) => {
      const v = m.get(k);
      if (v && v > 0) {
        total += v;
        n++;
      }
    });
    return { k, avg: n > 0 ? total / n : 0 };
  });

  const userMap = byUser.get(userCode) || new Map<string, number>();
  const activeUserMonths = [...userMap.values()].filter((v) => v > 0);
  const userMonthlyAvg =
    activeUserMonths.length > 0
      ? activeUserMonths.reduce((a, b) => a + b, 0) / activeUserMonths.length
      : 0;
  const firmMonthlyAvg =
    firmPerMonth.length > 0
      ? firmPerMonth.reduce((s, f) => s + f.avg, 0) / firmPerMonth.length
      : 0;

  const totals = [...byUser.entries()]
    .map(([u, m]) => ({
      u,
      t: [...m.values()].reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.t - a.t);
  const rank = totals.findIndex((t) => t.u === userCode) + 1;

  // Last 3 months vs prior 3 months (user's own pace)
  let recentTrendPct: number | null = null;
  if (months.length >= 4) {
    const recent = months.slice(-3).map((k) => userMap.get(k) || 0);
    const prior = months.slice(-6, -3).map((k) => userMap.get(k) || 0);
    const rAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const pAvg =
      prior.length > 0 ? prior.reduce((a, b) => a + b, 0) / prior.length : 0;
    if (pAvg > 0) recentTrendPct = ((rAvg - pAvg) / pAvg) * 100;
  }

  let bestMonth: PeerBenchmark["bestMonth"] = null;
  userMap.forEach((v, k) => {
    if (!bestMonth || v > bestMonth.hours)
      bestMonth = { label: monthLabelLong(k), hours: v };
  });

  const monthly = months.slice(-12).map((k) => ({
    month: monthLabelShort(k),
    user: Math.round((userMap.get(k) || 0) * 10) / 10,
    firm:
      Math.round((firmPerMonth.find((f) => f.k === k)?.avg || 0) * 10) / 10,
  }));

  return {
    userMonthlyAvg,
    firmMonthlyAvg,
    pctVsFirm:
      firmMonthlyAvg > 0
        ? ((userMonthlyAvg - firmMonthlyAvg) / firmMonthlyAvg) * 100
        : 0,
    rank,
    totalPeers: totals.length,
    recentTrendPct,
    bestMonth,
    monthly,
  };
}

function computeFirmProStats(start?: Date, end?: Date): FirmProStats {
  const { byUser, months } = bucketBillableByUserMonth(start, end);
  const usuarioMap = new Map(getUsuarios().map((u) => [u.code, u]));

  const perUserAvg: Array<{ name: string; avg: number }> = [];
  byUser.forEach((m, code) => {
    const vals = [...m.values()].filter((v) => v > 0);
    if (vals.length === 0) return;
    perUserAvg.push({
      name: usuarioMap.get(code)?.name || code,
      avg: vals.reduce((a, b) => a + b, 0) / vals.length,
    });
  });

  const firmMonthlyAvg =
    perUserAvg.length > 0
      ? perUserAvg.reduce((s, u) => s + u.avg, 0) / perUserAvg.length
      : 0;

  const belowAvg = perUserAvg
    .filter((u) => firmMonthlyAvg > 0 && u.avg < firmMonthlyAvg * 0.8)
    .map((u) => ({
      name: u.name,
      pct: ((firmMonthlyAvg - u.avg) / firmMonthlyAvg) * 100,
    }))
    .sort((a, b) => b.pct - a.pct);

  const top = [...perUserAvg].sort((a, b) => b.avg - a.avg)[0];
  const topPerformer =
    top && firmMonthlyAvg > 0
      ? {
          name: top.name,
          pct: ((top.avg - firmMonthlyAvg) / firmMonthlyAvg) * 100,
        }
      : null;

  void months;
  return { firmMonthlyAvg, belowAvg, topPerformer };
}

function computeGerencialData(
  start?: Date,
  end?: Date,
): GerencialReportData {
  const dashboard = getDashboardData("all", start, end);
  const clients = getClientCosts(start, end);
  const topPros = getRevenueByUser(start, end);
  const profitability = getClientProfitability(start, end);
  const categoryHours = getCategoryBillableHours(start, end);
  const projectCosts = getProjectCosts(start, end);
  const allEntries = getTransformedTimeEntries(start, end);

  // Total hours (all time entries)
  const totalHours = allEntries.reduce((sum, e) => sum + e.duration, 0);
  const totalBillableHours = dashboard.totalHorasFacturables || 0;
  const utilizationRate = totalHours > 0 ? (totalBillableHours / totalHours) * 100 : 0;

  // Average margin from profitability data
  const totalFacturacion = profitability.reduce((s, c) => s + c.facturacion, 0);
  const totalCost = profitability.reduce((s, c) => s + c.costo_total, 0);
  const avgMarginPercent = totalFacturacion > 0
    ? ((totalFacturacion - totalCost) / totalFacturacion) * 100
    : 0;

  // Total unique projects
  const totalProjects = new Set(allEntries.map((e) => e.project_id)).size;

  const topClients = clients
    .sort((a, b) => b.billable_hours - a.billable_hours)
    .slice(0, 10)
    .map((c) => {
      const prof = profitability.find((p) => p.client_code === c.client_code);
      return {
        name: c.client_name,
        hours: c.total_hours,
        revenue: c.billable_hours * 500,
        projects: c.project_count,
        margin: prof?.margen_percent,
      };
    });

  // Top projects by revenue
  const topProjects = projectCosts
    .sort((a, b) => (b.billable_hours * 500) - (a.billable_hours * 500))
    .slice(0, 8)
    .map((p) => ({
      name: p.project_name,
      clientName: p.client_name,
      hours: p.total_hours,
      revenue: p.billable_hours * 500,
    }));

  // Category breakdown
  const categoryBreakdown = categoryHours.map((c) => ({
    category: c.category,
    billableHours: c.billable_hours,
    userCount: c.users.length,
  }));

  // Monthly revenue from dashboard
  const monthlyRevenue = dashboard.revenueChart.map((r) => ({
    month: r.month,
    revenue: r.revenue,
  }));

  // Client profitability (top 8)
  const clientProfitability = profitability
    .filter((c) => c.facturacion > 0)
    .slice(0, 8)
    .map((c) => ({
      name: c.client_name,
      facturacion: c.facturacion,
      costo: c.costo_total,
      margin: c.margen_percent,
    }));

  let prevPeriod: GerencialReportData["prevPeriod"] = null;
  const prev = getPreviousPeriodRange(start, end);
  if (prev) {
    const prevDash = getDashboardData("all", prev.prevStart, prev.prevEnd);
    prevPeriod = {
      totalFacturado: prevDash.totalFacturado,
      totalHorasFacturables: prevDash.totalHorasFacturables || 0,
      clientesUnicos: prevDash.clientesUnicos,
    };
  }

  // Get usuarios for category info on professionals
  const allUsuarios = getUsuarios();
  const usuarioMap = new Map(allUsuarios.map((u) => [u.code, u]));

  return {
    clientesUnicos: dashboard.clientesUnicos,
    totalFacturado: dashboard.totalFacturado,
    totalHorasFacturables: totalBillableHours,
    metaFacturacion: dashboard.metaFacturacion,
    totalHours,
    utilizationRate,
    avgMarginPercent,
    totalCost,
    totalProjects,
    topClients,
    topProfessionals: topPros.map((p) => {
      const usr = usuarioMap.get(p.user_code);
      return {
        name: p.user_name,
        code: p.user_code,
        revenue: p.revenue,
        hours: allEntries.filter((e) => e.user_id === p.user_id).reduce((s, e) => s + e.duration, 0),
        category: usr?.category,
      };
    }),
    areaBreakdown: dashboard.facturacionPorArea.map((a) => ({
      area: a.area,
      facturacion: a.facturacion,
      meta: a.meta,
    })),
    topProjects,
    categoryBreakdown,
    monthlyRevenue,
    clientProfitability,
    proStats: computeFirmProStats(start, end),
    prevPeriod,
  };
}

// ===================== AI INSIGHTS =====================

interface Insight {
  text: string;
  tone: "positive" | "warning" | "neutral";
}

/** Extra analytics derived from the gerencial dataset (used in both preview + PDF). */
interface GerencialAnalytics {
  metaAttainment: number;
  clientConcentration: number; // % of billable hours from top 3 clients
  revenueMomentum: number; // % change last month vs first month
  topArea: { area: string; facturacion: number } | null;
  billableRatio: number;
  avgRevenuePerClient: number;
}

function computeGerencialAnalytics(data: GerencialReportData): GerencialAnalytics {
  const totalClientHours = data.topClients.reduce((s, c) => s + c.hours, 0);
  const top3Hours = data.topClients.slice(0, 3).reduce((s, c) => s + c.hours, 0);
  const clientConcentration = totalClientHours > 0 ? (top3Hours / totalClientHours) * 100 : 0;

  const months = data.monthlyRevenue;
  let revenueMomentum = 0;
  if (months.length >= 2) {
    const first = months[0].revenue;
    const last = months[months.length - 1].revenue;
    if (first > 0) revenueMomentum = ((last - first) / first) * 100;
  }

  const topArea =
    data.areaBreakdown.length > 0
      ? [...data.areaBreakdown].sort((a, b) => b.facturacion - a.facturacion)[0]
      : null;

  return {
    metaAttainment:
      data.metaFacturacion > 0 ? (data.totalFacturado / data.metaFacturacion) * 100 : 0,
    clientConcentration,
    revenueMomentum,
    topArea: topArea ? { area: topArea.area, facturacion: topArea.facturacion } : null,
    billableRatio: data.totalHours > 0 ? (data.totalHorasFacturables / data.totalHours) * 100 : 0,
    avgRevenuePerClient:
      data.clientesUnicos > 0 ? data.totalFacturado / data.clientesUnicos : 0,
  };
}

/** Executive summary paragraph — regenerated (with fresh phrasing) on every download. */
function generateGerencialSummary(data: GerencialReportData): string {
  const a = computeGerencialAnalytics(data);
  const parts: string[] = [];

  parts.push(
    pick(
      `Durante el periodo analizado, la firma facturó ${formatCurrency(data.totalFacturado)} a través de ${data.clientesUnicos} clientes activos y ${data.totalProjects} proyectos en curso.`,
      `El periodo cierra con una facturación de ${formatCurrency(data.totalFacturado)}, distribuida entre ${data.clientesUnicos} clientes y ${data.totalProjects} proyectos activos.`,
      `La operación del periodo generó ${formatCurrency(data.totalFacturado)} en facturación, con una base de ${data.clientesUnicos} clientes activos y ${data.totalProjects} proyectos abiertos.`,
    ),
  );

  if (data.metaFacturacion > 0) {
    parts.push(
      a.metaAttainment >= 100
        ? pick(
            `Con un cumplimiento del ${a.metaAttainment.toFixed(0)}% de la meta, el desempeño comercial se sitúa por encima de lo planificado.`,
            `El objetivo de facturación quedó superado (${a.metaAttainment.toFixed(0)}% de cumplimiento), una señal clara de tracción comercial.`,
          )
        : pick(
            `El cumplimiento de la meta se ubica en ${a.metaAttainment.toFixed(0)}%, con una brecha de ${formatCurrency(data.metaFacturacion - data.totalFacturado)} aún por cerrar.`,
            `Restan ${formatCurrency(data.metaFacturacion - data.totalFacturado)} para alcanzar la meta del periodo (avance del ${a.metaAttainment.toFixed(0)}%).`,
          ),
    );
  }

  parts.push(
    data.avgMarginPercent >= 30
      ? pick(
          `La rentabilidad se mantiene sana, con un margen promedio de ${data.avgMarginPercent.toFixed(1)}% sobre los costos de operación.`,
          `El margen promedio de ${data.avgMarginPercent.toFixed(1)}% confirma una estructura de costos bien controlada.`,
        )
      : pick(
          `El margen promedio de ${data.avgMarginPercent.toFixed(1)}% sugiere revisar tarifas y mezcla de proyectos para proteger la rentabilidad.`,
          `Con un margen promedio de ${data.avgMarginPercent.toFixed(1)}%, hay espacio para optimizar la relación entre tarifas y costos.`,
        ),
  );

  return parts.join(" ");
}

function generateGerencialInsights(data: GerencialReportData): Insight[] {
  const a = computeGerencialAnalytics(data);
  const out: Insight[] = [];

  // Goal attainment
  if (data.metaFacturacion > 0) {
    if (a.metaAttainment >= 100) {
      out.push({
        tone: "positive",
        text: pick(
          `La firma superó su meta de facturación, alcanzando el ${a.metaAttainment.toFixed(0)}% del objetivo (${formatCurrency(data.totalFacturado)} frente a una meta de ${formatCurrency(data.metaFacturacion)}).`,
          `Meta cumplida y superada: la facturación llegó al ${a.metaAttainment.toFixed(0)}% del objetivo, con ${formatCurrency(data.totalFacturado)} generados contra una meta de ${formatCurrency(data.metaFacturacion)}.`,
        ),
      });
    } else if (a.metaAttainment >= 80) {
      out.push({
        tone: "neutral",
        text: pick(
          `La facturación alcanzó el ${a.metaAttainment.toFixed(0)}% de la meta; un cierre adicional de ${formatCurrency(data.metaFacturacion - data.totalFacturado)} completaría el objetivo del periodo.`,
          `Con un ${a.metaAttainment.toFixed(0)}% de avance sobre la meta, bastaría cerrar ${formatCurrency(data.metaFacturacion - data.totalFacturado)} adicionales para completar el objetivo.`,
        ),
      });
    } else {
      out.push({
        tone: "warning",
        text: pick(
          `La facturación se ubicó en ${a.metaAttainment.toFixed(0)}% de la meta, ${formatCurrency(data.metaFacturacion - data.totalFacturado)} por debajo del objetivo. Conviene revisar la asignación de horas facturables.`,
          `El avance sobre la meta es de solo ${a.metaAttainment.toFixed(0)}%: faltan ${formatCurrency(data.metaFacturacion - data.totalFacturado)}. Priorizar el trabajo facturable ayudaría a cerrar la brecha.`,
        ),
      });
    }
  }

  // Monthly momentum — last month vs previous month
  if (data.monthlyRevenue.length >= 2) {
    const last = data.monthlyRevenue[data.monthlyRevenue.length - 1];
    const prev = data.monthlyRevenue[data.monthlyRevenue.length - 2];
    if (prev.revenue > 0) {
      const mom = ((last.revenue - prev.revenue) / prev.revenue) * 100;
      if (mom <= -15) {
        out.push({
          tone: "warning",
          text: pick(
            `El último mes muestra una desaceleración: los ingresos cayeron ${Math.abs(mom).toFixed(0)}% respecto al mes anterior (${formatCurrency(last.revenue)} vs ${formatCurrency(prev.revenue)}). Vale la pena anticipar el pipeline del próximo mes.`,
            `Los ingresos del último mes (${formatCurrency(last.revenue)}) retrocedieron ${Math.abs(mom).toFixed(0)}% frente al mes previo, una señal temprana que conviene monitorear de cerca.`,
          ),
        });
      } else if (mom >= 15) {
        out.push({
          tone: "positive",
          text: pick(
            `El cierre del periodo llega con impulso: el último mes creció ${mom.toFixed(0)}% frente al anterior, alcanzando ${formatCurrency(last.revenue)}.`,
            `Los ingresos aceleraron un ${mom.toFixed(0)}% en el último mes (${formatCurrency(last.revenue)}), el mejor ritmo reciente de la firma.`,
          ),
        });
      }
    }
  }

  // Professionals below firm average — the "people analytics" insight
  if (data.proStats.belowAvg.length > 0) {
    const worst = data.proStats.belowAvg[0];
    const n = data.proStats.belowAvg.length;
    out.push({
      tone: "warning",
      text: pick(
        `${n === 1 ? "Un profesional registra" : `${n} profesionales registran`} horas facturables por debajo del promedio de la firma (${Math.round(data.proStats.firmMonthlyAvg)}h/mes); el caso más marcado es ${worst.name}, un ${worst.pct.toFixed(0)}% bajo el promedio en los últimos meses.`,
        `${worst.name} ha venido trabajando un ${worst.pct.toFixed(0)}% menos que el promedio de la firma en los últimos meses${n > 1 ? `, y otros ${n - 1} profesionales muestran un patrón similar` : ""}. Una conversación de carga de trabajo podría destrabar capacidad.`,
      ),
    });
  } else if (data.proStats.topPerformer) {
    out.push({
      tone: "positive",
      text: `El equipo trabaja de forma pareja: ningún profesional está significativamente por debajo del promedio de ${Math.round(data.proStats.firmMonthlyAvg)}h facturables mensuales, y ${data.proStats.topPerformer.name} lidera con un ${data.proStats.topPerformer.pct.toFixed(0)}% sobre el promedio.`,
    });
  }

  // Growth vs previous period
  if (data.prevPeriod && data.prevPeriod.totalFacturado > 0) {
    const d = formatDelta(data.totalFacturado, data.prevPeriod.totalFacturado);
    if (d.direction === "up") {
      out.push({
        tone: "positive",
        text: pick(
          `Los ingresos crecieron ${Math.abs(d.percent).toFixed(1)}% respecto al periodo anterior${data.topClients[0] ? `, con ${data.topClients[0].name} como principal motor de actividad` : ""}.`,
          `Comparado con el periodo anterior, la facturación avanzó ${Math.abs(d.percent).toFixed(1)}%${data.topClients[0] ? `; ${data.topClients[0].name} concentró buena parte de ese crecimiento` : ""}.`,
        ),
      });
    } else if (d.direction === "down") {
      out.push({
        tone: "warning",
        text: pick(
          `Los ingresos cayeron ${Math.abs(d.percent).toFixed(1)}% frente al periodo anterior. Se sugiere analizar los clientes con menor actividad para revertir la tendencia.`,
          `Frente al periodo previo, la facturación retrocedió ${Math.abs(d.percent).toFixed(1)}%; revisar la actividad de los clientes menos dinámicos ayudaría a explicar la caída.`,
        ),
      });
    }
  }

  // Client concentration / risk
  if (data.topClients.length >= 3) {
    if (a.clientConcentration >= 60) {
      out.push({
        tone: "warning",
        text: pick(
          `Existe una alta concentración de cartera: los 3 clientes principales representan el ${a.clientConcentration.toFixed(0)}% de las horas facturables. Diversificar la base de clientes reduciría el riesgo de dependencia.`,
          `Los 3 clientes más grandes absorben el ${a.clientConcentration.toFixed(0)}% de las horas facturables — un nivel de dependencia que expone los ingresos a la salida de un solo cliente.`,
        ),
      });
    } else {
      out.push({
        tone: "positive",
        text: pick(
          `La cartera está sanamente distribuida: los 3 clientes principales concentran solo el ${a.clientConcentration.toFixed(0)}% de las horas facturables.`,
          `El riesgo de concentración es bajo: los 3 mayores clientes suman apenas el ${a.clientConcentration.toFixed(0)}% de las horas facturables, con el resto bien repartido.`,
        ),
      });
    }
  }

  // Margin health
  if (data.avgMarginPercent >= 40) {
    out.push({
      tone: "positive",
      text: pick(
        `El margen promedio de ${data.avgMarginPercent.toFixed(1)}% supera el estándar del sector legal (~35%), lo que refleja una operación eficiente en costos.`,
        `Con ${data.avgMarginPercent.toFixed(1)}% de margen promedio, la firma opera por encima del benchmark del sector legal (~35%).`,
      ),
    });
  } else if (data.avgMarginPercent > 0 && data.avgMarginPercent < 20) {
    out.push({
      tone: "warning",
      text: pick(
        `El margen promedio de ${data.avgMarginPercent.toFixed(1)}% es ajustado; revisar tarifas por hora y la mezcla de proyectos podría mejorar la rentabilidad.`,
        `La rentabilidad opera con poco colchón (${data.avgMarginPercent.toFixed(1)}% de margen promedio); un ajuste de tarifas o de mezcla de trabajo daría más holgura.`,
      ),
    });
  }

  // Utilization
  if (data.utilizationRate > 0 && data.utilizationRate < 60) {
    out.push({
      tone: "warning",
      text: pick(
        `La utilización de ${data.utilizationRate.toFixed(1)}% indica capacidad ociosa. Reorientar horas no facturables hacia trabajo facturable elevaría los ingresos sin sumar personal.`,
        `Con una utilización de ${data.utilizationRate.toFixed(1)}%, la firma tiene capacidad instalada sin monetizar: convertir parte de las horas internas en facturables elevaría ingresos sin contratar.`,
      ),
    });
  } else if (data.utilizationRate >= 80) {
    out.push({
      tone: "positive",
      text: `La utilización de ${data.utilizationRate.toFixed(1)}% es sólida y muestra que el equipo sostiene una alta proporción de horas facturables.`,
    });
  }

  // Top practice area
  if (a.topArea && a.topArea.facturacion > 0) {
    out.push({
      tone: "neutral",
      text: pick(
        `El área de ${a.topArea.area} lidera la facturación con ${formatCurrency(a.topArea.facturacion)}, posicionándose como la práctica más rentable del periodo.`,
        `${a.topArea.area} se consolida como el motor de la firma: aporta ${formatCurrency(a.topArea.facturacion)} de facturación, más que cualquier otra práctica.`,
      ),
    });
  }

  return out.slice(0, 6);
}

/** Executive summary paragraph for the individual report. */
function generateIndividualSummary(data: IndividualReportData): string {
  const firstName = data.usuario.name.split(" ")[0];
  const b = data.benchmark;
  const parts: string[] = [];

  parts.push(
    pick(
      `${firstName} registró ${Math.round(data.totalHours)}h en el periodo, de las cuales ${data.billableHours.toFixed(0)}h fueron facturables, generando ${formatCurrency(data.totalRevenue)} en ingresos para la firma.`,
      `Durante el periodo, ${firstName} acumuló ${Math.round(data.totalHours)}h de trabajo (${data.billableHours.toFixed(0)}h facturables) con una contribución de ${formatCurrency(data.totalRevenue)} en ingresos.`,
    ),
  );

  if (b.firmMonthlyAvg > 0) {
    if (b.pctVsFirm <= -10) {
      parts.push(
        pick(
          `Su ritmo promedio de ${Math.round(b.userMonthlyAvg)}h facturables al mes se ubica un ${Math.abs(b.pctVsFirm).toFixed(0)}% por debajo del promedio de la firma (${Math.round(b.firmMonthlyAvg)}h), un punto a conversar en la próxima revisión.`,
          `En los últimos meses ha trabajado por debajo del promedio de sus pares: ${Math.round(b.userMonthlyAvg)}h facturables mensuales frente a las ${Math.round(b.firmMonthlyAvg)}h del promedio de la firma (${Math.abs(b.pctVsFirm).toFixed(0)}% menos).`,
        ),
      );
    } else if (b.pctVsFirm >= 10) {
      parts.push(
        pick(
          `Su promedio de ${Math.round(b.userMonthlyAvg)}h facturables mensuales supera en ${b.pctVsFirm.toFixed(0)}% al promedio de la firma, ubicándolo entre los perfiles de mayor carga.`,
          `Mantiene un ritmo superior al de sus pares: ${Math.round(b.userMonthlyAvg)}h facturables al mes, un ${b.pctVsFirm.toFixed(0)}% sobre el promedio de la firma.`,
        ),
      );
    } else {
      parts.push(
        `Su ritmo mensual de ${Math.round(b.userMonthlyAvg)}h facturables está en línea con el promedio de la firma (${Math.round(b.firmMonthlyAvg)}h).`,
      );
    }
  }

  return parts.join(" ");
}

function generateIndividualInsights(data: IndividualReportData): Insight[] {
  const out: Insight[] = [];
  const billableRatio = data.totalHours > 0 ? (data.billableHours / data.totalHours) * 100 : 0;
  const firstName = data.usuario.name.split(" ")[0];
  const b = data.benchmark;

  // Peer comparison — the headline people-analytics insight
  if (b.firmMonthlyAvg > 0) {
    if (b.pctVsFirm <= -12) {
      out.push({
        tone: "warning",
        text: pick(
          `${firstName} ha estado trabajando un ${Math.abs(b.pctVsFirm).toFixed(0)}% menos que el promedio de la firma en los últimos meses (${Math.round(b.userMonthlyAvg)}h facturables/mes vs ${Math.round(b.firmMonthlyAvg)}h del promedio).`,
          `El ritmo de ${firstName} está por debajo de sus pares: promedia ${Math.round(b.userMonthlyAvg)}h facturables al mes, un ${Math.abs(b.pctVsFirm).toFixed(0)}% menos que el promedio de la firma. Puede indicar baja asignación de trabajo más que bajo desempeño.`,
        ),
      });
    } else if (b.pctVsFirm >= 12) {
      out.push({
        tone: "positive",
        text: pick(
          `${firstName} sostiene un ritmo un ${b.pctVsFirm.toFixed(0)}% superior al promedio de la firma (${Math.round(b.userMonthlyAvg)}h facturables/mes vs ${Math.round(b.firmMonthlyAvg)}h) — conviene vigilar señales de sobrecarga.`,
          `Con ${Math.round(b.userMonthlyAvg)}h facturables mensuales, ${firstName} trabaja un ${b.pctVsFirm.toFixed(0)}% por encima del promedio de sus pares, uno de los ritmos más altos de la firma.`,
        ),
      });
    } else {
      out.push({
        tone: "neutral",
        text: `El ritmo de ${firstName} (${Math.round(b.userMonthlyAvg)}h facturables/mes) está alineado con el promedio de la firma de ${Math.round(b.firmMonthlyAvg)}h mensuales.`,
      });
    }
  }

  // Own-pace trend: last 3 months vs prior 3
  if (b.recentTrendPct != null) {
    if (b.recentTrendPct <= -15) {
      out.push({
        tone: "warning",
        text: pick(
          `Su actividad viene desacelerando: en los últimos 3 meses registró un ${Math.abs(b.recentTrendPct).toFixed(0)}% menos de horas facturables que en el trimestre anterior.`,
          `Se observa una caída de ritmo del ${Math.abs(b.recentTrendPct).toFixed(0)}% en el último trimestre frente al anterior — un patrón que vale la pena conversar antes de que se consolide.`,
        ),
      });
    } else if (b.recentTrendPct >= 15) {
      out.push({
        tone: "positive",
        text: pick(
          `Su actividad va en ascenso: las horas facturables de los últimos 3 meses crecieron ${b.recentTrendPct.toFixed(0)}% frente al trimestre anterior.`,
          `El último trimestre marca su mejor racha reciente, con un ${b.recentTrendPct.toFixed(0)}% más de horas facturables que el trimestre previo.`,
        ),
      });
    }
  }

  // Ranking within the firm
  if (b.totalPeers >= 3 && b.rank > 0) {
    const topThird = b.rank <= Math.ceil(b.totalPeers / 3);
    out.push({
      tone: topThird ? "positive" : "neutral",
      text: pick(
        `Se ubica en la posición ${b.rank} de ${b.totalPeers} profesionales por horas facturables acumuladas${topThird ? ", dentro del tercio superior de la firma" : ""}.`,
        `En el ranking interno de horas facturables ocupa el puesto ${b.rank} de ${b.totalPeers}${topThird ? " — parte del grupo que sostiene la producción de la firma" : ""}.`,
      ),
    });
  }

  // Utilization
  if (data.utilizationRate >= 100) {
    out.push({
      tone: "positive",
      text: pick(
        `${firstName} superó su meta de utilización alcanzando ${data.utilizationRate.toFixed(0)}%, un desempeño sobresaliente para el periodo.`,
        `La utilización de ${data.utilizationRate.toFixed(0)}% supera la meta personal — un periodo de alto rendimiento para ${firstName}.`,
      ),
    });
  } else if (data.utilizationRate > 0 && data.utilizationRate < 70) {
    out.push({
      tone: "warning",
      text: pick(
        `La utilización de ${data.utilizationRate.toFixed(0)}% está por debajo del objetivo; incrementar las horas facturables mejoraría la contribución a la firma.`,
        `Con ${data.utilizationRate.toFixed(0)}% de utilización, existe margen para convertir más horas registradas en trabajo facturable.`,
      ),
    });
  }

  // Billable ratio
  out.push({
    tone: billableRatio >= 70 ? "positive" : "neutral",
    text: `El ${billableRatio.toFixed(0)}% de las horas registradas fueron facturables (${data.billableHours.toFixed(0)}h de ${Math.round(data.totalHours)}h totales).`,
  });

  // Client concentration
  if (data.clients.length > 0) {
    const totalH = data.clients.reduce((s, c) => s + c.hours, 0);
    const top = data.clients[0];
    if (totalH > 0 && top) {
      const share = (top.hours / totalH) * 100;
      out.push({
        tone: share >= 50 ? "warning" : "neutral",
        text: `${top.clientName} concentra el ${share.toFixed(0)}% del tiempo dedicado${share >= 50 ? ", una dependencia que conviene equilibrar con otros clientes" : ", siendo el cliente más relevante de la cartera"}.`,
      });
    }
  }

  // Best month flair
  if (b.bestMonth && b.bestMonth.hours > 0) {
    out.push({
      tone: "neutral",
      text: pick(
        `Su mejor mes fue ${b.bestMonth.label}, con ${Math.round(b.bestMonth.hours)}h facturables — un buen punto de referencia de su capacidad máxima.`,
        `El pico de actividad se dio en ${b.bestMonth.label} (${Math.round(b.bestMonth.hours)}h facturables), útil como referencia de capacidad para la planificación.`,
      ),
    });
  }

  // Period-over-period
  if (data.prevPeriod) {
    const d = formatDelta(data.billableHours, data.prevPeriod.billableHours);
    if (d.direction === "up") {
      out.push({
        tone: "positive",
        text: `Las horas facturables crecieron ${Math.abs(d.percent).toFixed(1)}% respecto al periodo anterior.`,
      });
    } else if (d.direction === "down") {
      out.push({
        tone: "warning",
        text: `Las horas facturables disminuyeron ${Math.abs(d.percent).toFixed(1)}% respecto al periodo anterior.`,
      });
    }
  }

  return out.slice(0, 6);
}

// ===================== SUB-COMPONENTS =====================

/* SchedulePanel removed — feature not yet implemented */

/** Renders the AI insights block in the on-screen preview. */
function AIInsightsPanel({
  insights,
  summary,
}: {
  insights: Insight[];
  summary?: string;
}) {
  if (insights.length === 0 && !summary) return null;
  const toneStyles: Record<Insight["tone"], string> = {
    positive: "bg-emerald-500",
    warning: "bg-amber-500",
    neutral: "bg-slate-400",
  };
  return (
    <div className="rounded-xl overflow-hidden border border-[hsl(210,40%,88%)] shadow-sm">
      <div className="flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-[hsl(210,55%,16%)] to-[hsl(210,52%,26%)]">
        <div className="h-7 w-7 rounded-lg bg-[hsl(43,74%,52%)]/20 ring-1 ring-[hsl(43,74%,52%)]/50 flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-[hsl(43,80%,62%)]" />
        </div>
        <h4 className="text-sm font-semibold text-white tracking-wide">
          Análisis Inteligente
        </h4>
        <span className="ml-auto text-[9px] font-bold uppercase tracking-[0.14em] text-[hsl(43,80%,65%)] border border-[hsl(43,74%,52%)]/50 px-2 py-0.5 rounded-full">
          Generado por IA
        </span>
      </div>
      <div className="bg-gradient-to-br from-white to-[hsl(210,40%,97%)] p-4 space-y-3">
        {summary && (
          <p className="text-xs leading-relaxed text-slate-700 border-l-2 border-[hsl(43,74%,52%)] pl-3 italic">
            {summary}
          </p>
        )}
        <ul className="space-y-2.5">
          {insights.map((ins, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span
                className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${toneStyles[ins.tone]}`}
              />
              <span className="text-xs leading-relaxed text-slate-700">{ins.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Navy letterhead used at the top of both preview dialogs. */
function PreviewLetterhead({
  title,
  firmName,
  periodLabel,
}: {
  title: string;
  firmName: string;
  periodLabel: string;
}) {
  return (
    <div className="rounded-xl overflow-hidden border border-border/60 shadow-sm">
      <div className="bg-gradient-to-r from-[hsl(210,55%,14%)] via-[hsl(210,55%,19%)] to-[hsl(210,50%,26%)] px-5 py-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(43,74%,58%)]">
            {title}
          </p>
          <p className="text-white font-bold text-lg truncate">
            {firmName || "Tu Firma Legal"}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-white/70 text-xs">{periodLabel}</p>
          <p className="text-white/50 text-[11px]">
            {format(new Date(), "d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
      </div>
      <div className="h-1 bg-gradient-to-r from-[hsl(43,74%,52%)] via-[hsl(43,74%,45%)] to-[hsl(43,60%,38%)]" />
    </div>
  );
}

/** Delta badge for KPI cards */
function DeltaBadge({
  delta,
  hasPeriod,
}: {
  delta: { percent: number; direction: "up" | "down" | "neutral" } | null;
  hasPeriod: boolean;
}) {
  if (delta && delta.direction !== "neutral") {
    const isUp = delta.direction === "up";
    return (
      <div
        className={`inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
          isUp
            ? "text-emerald-700 bg-emerald-50"
            : "text-red-600 bg-red-50"
        }`}
      >
        <span>{isUp ? "↑" : "↓"}</span>
        <span>{Math.abs(delta.percent).toFixed(1)}%</span>
      </div>
    );
  }
  if (delta && delta.direction === "neutral") {
    return (
      <div className="inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 rounded-full text-[11px] font-medium text-muted-foreground bg-muted/50 whitespace-nowrap">
        <span>—</span>
        <span>Sin cambio</span>
      </div>
    );
  }
  if (hasPeriod) {
    return (
      <p className="text-[11px] text-muted-foreground mt-1.5">Sin datos ant.</p>
    );
  }
  return null;
}

// ===================== PERIOD SELECTOR =====================

function PeriodSelector({
  periodPreset,
  setPeriodPreset,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}: {
  periodPreset: string;
  setPeriodPreset: (v: string) => void;
  startDate?: Date;
  setStartDate: (d: Date | undefined) => void;
  endDate?: Date;
  setEndDate: (d: Date | undefined) => void;
}) {
  const handlePreset = (preset: string) => {
    setPeriodPreset(preset);
    const now = new Date();
    switch (preset) {
      case "last-week": {
        const s = new Date(now);
        s.setDate(now.getDate() - 7);
        setStartDate(s);
        setEndDate(now);
        break;
      }
      case "last-month": {
        setStartDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
        setEndDate(new Date(now.getFullYear(), now.getMonth(), 0));
        break;
      }
      case "last-quarter": {
        const s = new Date(now);
        s.setMonth(now.getMonth() - 3);
        setStartDate(s);
        setEndDate(now);
        break;
      }
      case "year-to-date": {
        setStartDate(new Date(now.getFullYear(), 0, 1));
        setEndDate(now);
        break;
      }
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
      <div className="min-w-[200px]">
        <label className="text-sm font-medium text-muted-foreground mb-2 block">
          Periodo
        </label>
        <Select value={periodPreset} onValueChange={handlePreset}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar periodo..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="last-week">Ultima semana</SelectItem>
            <SelectItem value="last-month">Ultimo mes</SelectItem>
            <SelectItem value="last-quarter">Ultimo trimestre</SelectItem>
            <SelectItem value="year-to-date">Ano en curso</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {periodPreset === "custom" && (
        <>
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Desde
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`justify-start text-left font-normal ${!startDate && "text-muted-foreground"}`}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "dd/MM/yyyy") : "Fecha inicio"}
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
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Hasta
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`justify-start text-left font-normal ${!endDate && "text-muted-foreground"}`}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "dd/MM/yyyy") : "Fecha fin"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                  locale={es}
                  disabled={(date) => (startDate ? date < startDate : false)}
                />
              </PopoverContent>
            </Popover>
          </div>
        </>
      )}
    </div>
  );
}

// ===================== PREVIEW DIALOG CONTENT =====================

function GerencialPreviewContent({
  gerData,
  gerStats,
  hasPeriodGer,
  firmName,
  periodLabel,
}: {
  gerData: GerencialReportData;
  gerStats: Array<{
    title: string;
    value: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bg: string;
    delta: { percent: number; direction: "up" | "down" | "neutral" } | null;
  }>;
  hasPeriodGer: boolean;
  firmName: string;
  periodLabel: string;
}) {
  const analytics = computeGerencialAnalytics(gerData);
  const insights = useMemo(() => generateGerencialInsights(gerData), [gerData]);
  const summary = useMemo(() => generateGerencialSummary(gerData), [gerData]);
  const areaData = useMemo(
    () =>
      [...gerData.areaBreakdown]
        .filter((a) => a.facturacion > 0)
        .sort((a, b) => b.facturacion - a.facturacion),
    [gerData.areaBreakdown],
  );
  const categoryData = useMemo(
    () =>
      [...gerData.categoryBreakdown].sort(
        (a, b) => b.billableHours - a.billableHours,
      ),
    [gerData.categoryBreakdown],
  );

  return (
    <div className="space-y-6">
      <PreviewLetterhead
        title="Reporte Gerencial"
        firmName={firmName}
        periodLabel={periodLabel}
      />
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {gerStats.map((stat) => (
          <Card key={stat.title} className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`${stat.bg} p-1.5 rounded-lg`}>
                <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-3 pb-3">
              <div className="text-xl font-bold text-foreground">
                {stat.value}
              </div>
              <DeltaBadge delta={stat.delta} hasPeriod={hasPeriodGer} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Secondary Insights Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-muted/40 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Percent className="h-3 w-3" />
            Utilizacion
          </div>
          <div className="text-lg font-bold text-foreground">
            {gerData.utilizationRate.toFixed(1)}%
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 mt-1.5">
            <div
              className={`h-1.5 rounded-full ${gerData.utilizationRate >= 80 ? "bg-emerald-500" : gerData.utilizationRate >= 60 ? "bg-amber-500" : "bg-red-500"}`}
              style={{ width: `${Math.min(gerData.utilizationRate, 100)}%` }}
            />
          </div>
        </div>
        <div className="bg-muted/40 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Scale className="h-3 w-3" />
            Margen Promedio
          </div>
          <div className={`text-lg font-bold ${gerData.avgMarginPercent >= 30 ? "text-emerald-600" : gerData.avgMarginPercent >= 15 ? "text-amber-600" : "text-red-600"}`}>
            {gerData.avgMarginPercent.toFixed(1)}%
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Facturacion vs costo</p>
        </div>
        <div className="bg-muted/40 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Clock className="h-3 w-3" />
            Horas Totales
          </div>
          <div className="text-lg font-bold text-foreground">
            {Math.round(gerData.totalHours).toLocaleString()}h
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {Math.round(gerData.totalHorasFacturables).toLocaleString()}h facturables
          </p>
        </div>
        <div className="bg-muted/40 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <FileText className="h-3 w-3" />
            Proyectos Activos
          </div>
          <div className="text-lg font-bold text-foreground">
            {gerData.totalProjects}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {gerData.clientesUnicos} clientes
          </p>
        </div>
      </div>

      {/* Derived analytics — key ratios */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border/50 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Target className="h-3 w-3" />
            Cumplimiento de Meta
          </div>
          <div className={`text-lg font-bold ${analytics.metaAttainment >= 100 ? "text-emerald-600" : "text-amber-600"}`}>
            {gerData.metaFacturacion > 0 ? `${analytics.metaAttainment.toFixed(0)}%` : "—"}
          </div>
        </div>
        <div className="rounded-lg border border-border/50 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Users className="h-3 w-3" />
            Concentración Top 3
          </div>
          <div className={`text-lg font-bold ${analytics.clientConcentration >= 60 ? "text-red-600" : "text-emerald-600"}`}>
            {analytics.clientConcentration.toFixed(0)}%
          </div>
        </div>
        <div className="rounded-lg border border-border/50 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <DollarSign className="h-3 w-3" />
            Ingreso / Cliente
          </div>
          <div className="text-lg font-bold text-foreground">
            {formatCurrency(analytics.avgRevenuePerClient)}
          </div>
        </div>
        <div className="rounded-lg border border-border/50 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <TrendingUp className="h-3 w-3" />
            Momentum Ingresos
          </div>
          <div className={`text-lg font-bold ${analytics.revenueMomentum >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {gerData.monthlyRevenue.length >= 2
              ? `${analytics.revenueMomentum >= 0 ? "+" : ""}${analytics.revenueMomentum.toFixed(0)}%`
              : "—"}
          </div>
        </div>
      </div>

      {/* AI Insights */}
      <AIInsightsPanel insights={insights} summary={summary} />

      {/* Monthly Revenue Trend */}
      {gerData.monthlyRevenue.length > 1 && (
        <div>
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Evolución Mensual de Ingresos
          </h4>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart
              data={gerData.monthlyRevenue}
              margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_NAVY} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={CHART_NAVY} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="month"
                tickFormatter={(v: string) => v.split("-")[1] || v}
                tick={{ fontSize: 10, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => formatCurrency(v)}
                tick={{ fontSize: 10, fill: "#64748b" }}
                width={56}
                axisLine={false}
                tickLine={false}
              />
              <RechartsTooltip
                formatter={(v: number) => [formatCurrency(v), "Ingresos"]}
                labelStyle={{ fontSize: 11, fontWeight: 600 }}
                contentStyle={{ fontSize: 11, borderRadius: 8 }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke={CHART_NAVY}
                strokeWidth={2}
                fill="url(#revGrad)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Revenue by Practice Area — facturación vs meta */}
      {areaData.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Facturación por Área
          </h4>
          <ResponsiveContainer
            width="100%"
            height={Math.max(areaData.length * 52, 140)}
          >
            <BarChart
              data={areaData}
              layout="vertical"
              margin={{ top: 0, right: 64, left: 8, bottom: 0 }}
              barCategoryGap="24%"
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="area"
                width={140}
                tick={{ fontSize: 11, fill: "#334155" }}
                axisLine={false}
                tickLine={false}
              />
              <RechartsTooltip
                formatter={(v: number, name: string) => [formatCurrency(v), name]}
                contentStyle={{ fontSize: 11, borderRadius: 8 }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                iconType="circle"
                iconSize={8}
              />
              <Bar
                dataKey="facturacion"
                name="Facturación"
                fill={CHART_NAVY}
                radius={[0, 4, 4, 0]}
                barSize={12}
              >
                <LabelList
                  dataKey="facturacion"
                  position="right"
                  formatter={(v: number) => formatCurrency(v)}
                  style={{ fontSize: 10, fill: "#475569", fontWeight: 600 }}
                />
              </Bar>
              <Bar
                dataKey="meta"
                name="Meta"
                fill={CHART_GOLD}
                radius={[0, 4, 4, 0]}
                barSize={12}
              >
                <LabelList
                  dataKey="meta"
                  position="right"
                  formatter={(v: number) => formatCurrency(v)}
                  style={{ fontSize: 10, fill: "#475569" }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Clients with margin */}
      <div>
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <Users className="h-4 w-4" /> Top Clientes
        </h4>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Horas</TableHead>
              <TableHead className="text-right">Proyectos</TableHead>
              <TableHead className="text-right">Margen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gerData.topClients.slice(0, 7).map((c) => (
              <TableRow key={c.name}>
                <TableCell className="font-medium text-sm">{c.name}</TableCell>
                <TableCell className="text-right text-sm">{Math.round(c.hours)}h</TableCell>
                <TableCell className="text-right text-sm">{c.projects}</TableCell>
                <TableCell className="text-right text-sm">
                  {c.margin != null ? (
                    <span className={`font-medium ${c.margin >= 30 ? "text-emerald-600" : c.margin >= 0 ? "text-amber-600" : "text-red-600"}`}>
                      {c.margin.toFixed(0)}%
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Client Profitability */}
      {gerData.clientProfitability.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Rentabilidad por Cliente
          </h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Facturado</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead className="text-right">Margen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gerData.clientProfitability.slice(0, 6).map((c) => (
                <TableRow key={c.name}>
                  <TableCell className="font-medium text-sm">{c.name}</TableCell>
                  <TableCell className="text-right text-sm text-emerald-600 font-medium">
                    {formatCurrency(c.facturacion)}
                  </TableCell>
                  <TableCell className="text-right text-sm text-red-500">
                    {formatCurrency(c.costo)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    <span className={`font-semibold ${c.margin >= 30 ? "text-emerald-600" : c.margin >= 0 ? "text-amber-600" : "text-red-600"}`}>
                      {c.margin.toFixed(1)}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Two-column: Professionals + Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Professionals */}
        <div>
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Briefcase className="h-4 w-4" /> Top Profesionales
          </h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Profesional</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gerData.topProfessionals.slice(0, 5).map((p) => (
                <TableRow key={p.code}>
                  <TableCell>
                    <div className="font-medium text-sm">{p.name}</div>
                    {p.category && (
                      <div className="text-[10px] text-muted-foreground">{p.category}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm text-emerald-600 font-medium">
                    {formatCurrency(p.revenue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Hours by Seniority */}
        {categoryData.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Activity className="h-4 w-4" /> Horas por Categoría
            </h4>
            <ResponsiveContainer
              width="100%"
              height={Math.max(categoryData.length * 40, 120)}
            >
              <BarChart
                data={categoryData}
                layout="vertical"
                margin={{ top: 0, right: 56, left: 4, bottom: 0 }}
                barCategoryGap="30%"
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="category"
                  width={104}
                  tick={{ fontSize: 11, fill: "#334155" }}
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip
                  formatter={(v: number, _n: string, entry) => [
                    `${Math.round(v).toLocaleString()}h · ${(entry?.payload as { userCount?: number })?.userCount ?? 0} prof.`,
                    "Horas facturables",
                  ]}
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                />
                <Bar
                  dataKey="billableHours"
                  fill={CHART_NAVY}
                  radius={[0, 4, 4, 0]}
                  barSize={14}
                >
                  <LabelList
                    dataKey="billableHours"
                    position="right"
                    formatter={(v: number) => `${Math.round(v).toLocaleString()}h`}
                    style={{ fontSize: 10, fill: "#475569", fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Top Projects */}
      {gerData.topProjects.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4" /> Top Proyectos
          </h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proyecto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Horas</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gerData.topProjects.slice(0, 6).map((p, i) => (
                <TableRow key={`${p.name}-${i}`}>
                  <TableCell className="font-medium text-sm max-w-[180px] truncate">{p.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[140px] truncate">{p.clientName}</TableCell>
                  <TableCell className="text-right text-sm">{Math.round(p.hours)}h</TableCell>
                  <TableCell className="text-right text-sm text-emerald-600 font-medium">
                    {formatCurrency(p.revenue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

    </div>
  );
}

function IndividualPreviewContent({
  indData,
  indStats,
  hasPeriodInd,
  firmName,
  periodLabel,
}: {
  indData: IndividualReportData;
  indStats: Array<{
    title: string;
    value: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bg: string;
    delta: { percent: number; direction: "up" | "down" | "neutral" } | null;
  }>;
  hasPeriodInd: boolean;
  firmName: string;
  periodLabel: string;
}) {
  const insights = useMemo(() => generateIndividualInsights(indData), [indData]);
  const summary = useMemo(() => generateIndividualSummary(indData), [indData]);
  const b = indData.benchmark;
  const nonBillable = Math.max(indData.totalHours - indData.billableHours, 0);
  const billablePct =
    indData.totalHours > 0
      ? (indData.billableHours / indData.totalHours) * 100
      : 0;
  const donutData = [
    { name: "Facturables", value: Math.round(indData.billableHours) },
    { name: "No facturables", value: Math.round(nonBillable) },
  ];
  const firstName = indData.usuario.name.split(" ")[0];

  return (
    <div className="space-y-6">
      <PreviewLetterhead
        title="Reporte de Productividad"
        firmName={firmName}
        periodLabel={periodLabel}
      />

      {/* Professional header */}
      <div className="flex items-center gap-3.5 p-4 rounded-xl border border-border/60 bg-gradient-to-r from-[hsl(210,40%,97%)] to-white">
        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[hsl(210,55%,20%)] to-[hsl(210,50%,32%)] ring-2 ring-[hsl(43,74%,52%)]/40 flex items-center justify-center flex-shrink-0">
          <span className="text-base font-bold text-white">
            {indData.usuario.name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .substring(0, 2)
              .toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-foreground truncate">{indData.usuario.name}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">{indData.usuario.category}</Badge>
            <span className="text-xs text-muted-foreground">{indData.usuario.practice_area}</span>
          </div>
        </div>
        {b.totalPeers >= 3 && b.rank > 0 && (
          <div className="ml-auto text-right shrink-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Ranking firma
            </p>
            <p className="text-lg font-bold text-foreground">
              #{b.rank}
              <span className="text-xs font-medium text-muted-foreground">
                {" "}de {b.totalPeers}
              </span>
            </p>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {indStats.map((stat) => (
          <Card key={stat.title} className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`${stat.bg} p-1.5 rounded-lg`}>
                <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-3 pb-3">
              <div className="text-xl font-bold text-foreground">{stat.value}</div>
              <DeltaBadge delta={stat.delta} hasPeriod={hasPeriodInd} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Insights */}
      <AIInsightsPanel insights={insights} summary={summary} />

      {/* Charts: donut + pace vs firm */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4" /> Composición de Horas
          </h4>
          <div className="relative">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={72}
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={2}
                  strokeWidth={2}
                  stroke="#fff"
                >
                  <Cell fill={CHART_NAVY} />
                  <Cell fill="#cbd5e1" />
                </Pie>
                <RechartsTooltip
                  formatter={(v: number, name: string) => [`${v.toLocaleString()}h`, name]}
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-foreground">
                {billablePct.toFixed(0)}%
              </span>
              <span className="text-[10px] text-muted-foreground">facturable</span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: CHART_NAVY }} />
              Facturables
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-slate-300" />
              No facturables
            </span>
          </div>
        </div>

        {b.monthly.length > 1 && (
          <div className="lg:col-span-3">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Ritmo Mensual vs Promedio de la Firma
            </h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart
                data={b.monthly}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  width={36}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `${v}h`}
                />
                <RechartsTooltip
                  formatter={(v: number, name: string) => [`${v}h`, name]}
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="plainline" />
                <Line
                  type="monotone"
                  dataKey="user"
                  name={firstName}
                  stroke={CHART_NAVY}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
                />
                <Line
                  type="monotone"
                  dataKey="firm"
                  name="Promedio firma"
                  stroke={CHART_GOLD}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Client breakdown */}
      {indData.clients.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Users className="h-4 w-4" /> Desglose por Cliente
          </h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Horas</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {indData.clients.slice(0, 8).map((c) => (
                <TableRow key={c.clientName}>
                  <TableCell className="font-medium text-sm">{c.clientName}</TableCell>
                  <TableCell className="text-right text-sm">{Math.round(c.hours)}h</TableCell>
                  <TableCell className="text-right text-sm text-emerald-600 font-medium">
                    {formatCurrency(c.revenue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ===================== PDF GENERATION =====================

function generateIndividualPDF(
  data: IndividualReportData,
  firmName: string,
  logoUrl: string,
  startDate?: Date,
  endDate?: Date,
) {
  return generatePDFDoc({
    type: "individual",
    individual: data,
    firmName,
    logoUrl,
    startDate,
    endDate,
  });
}

function generateGerencialPDF(
  data: GerencialReportData,
  firmName: string,
  logoUrl: string,
  startDate?: Date,
  endDate?: Date,
) {
  return generatePDFDoc({
    type: "gerencial",
    gerencial: data,
    firmName,
    logoUrl,
    startDate,
    endDate,
  });
}

async function generatePDFDoc(opts: {
  type: "individual" | "gerencial";
  individual?: IndividualReportData;
  gerencial?: GerencialReportData;
  firmName: string;
  logoUrl: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 18;
  let y = 0;

  // Brand palette — deep navy + gold (matches the app's legal identity)
  const navy = { r: 21, g: 42, b: 66 }; // headings / header band
  const navyDeep = { r: 13, g: 26, b: 42 }; // header band base
  const gold = { r: 197, g: 154, b: 54 }; // decorative gold accent
  const chartNavy = { r: 47, g: 95, b: 150 }; // validated data-mark blue
  const chartGold = { r: 184, g: 134, b: 11 }; // validated data-mark gold
  const chartTrack = { r: 233, g: 238, b: 244 };
  const ink = { r: 15, g: 23, b: 42 }; // slate-900 headings
  const lightBg = { r: 247, g: 249, b: 252 };
  const midGray = { r: 100, g: 116, b: 139 }; // slate-500
  const hairline = { r: 226, g: 232, b: 240 }; // slate-200

  const today = new Date();
  const dateStr = today.toLocaleDateString("es-CL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // ── HEADER — full navy band with gold rule ──
  const headerH = 34;
  doc.setFillColor(navyDeep.r, navyDeep.g, navyDeep.b);
  doc.rect(0, 0, pw, headerH, "F");
  // subtle inner panel for depth
  doc.setFillColor(navy.r, navy.g, navy.b);
  doc.rect(0, 0, pw, headerH - 10, "F");
  // gold rule under the band
  doc.setFillColor(gold.r, gold.g, gold.b);
  doc.rect(0, headerH, pw, 1.1, "F");

  // Eyebrow
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(gold.r, gold.g, gold.b);
  doc.text("INTELIGENCIA DE LA FIRMA  ·  CONFIDENCIAL", m, 11, {
    charSpace: 0.7,
  });

  // Title
  const title =
    opts.type === "gerencial"
      ? "Reporte Gerencial"
      : "Reporte de Productividad";
  doc.setFontSize(19);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(title, m, 21);

  // Firm + date + period line
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(168, 185, 202);
  const metaBits = [opts.firmName || "", dateStr];
  if (opts.startDate && opts.endDate) {
    metaBits.push(
      `Periodo: ${format(opts.startDate, "dd MMM yyyy", { locale: es })} — ${format(opts.endDate, "dd MMM yyyy", { locale: es })}`,
    );
  }
  doc.text(metaBits.filter(Boolean).join("   ·   "), m, 29);

  // Logo — white chip at top-right inside the band
  if (opts.logoUrl) {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("fail"));
        img.src = opts.logoUrl;
      });
      const chipW = 32;
      const chipH = 20;
      const chipX = pw - m - chipW;
      const chipY = 6;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(chipX, chipY, chipW, chipH, 2, 2, "F");
      const ratio = img.width / img.height;
      let logoW = chipW - 6;
      let logoH = logoW / ratio;
      if (logoH > chipH - 6) {
        logoH = chipH - 6;
        logoW = logoH * ratio;
      }
      doc.addImage(
        img,
        "PNG",
        chipX + (chipW - logoW) / 2,
        chipY + (chipH - logoH) / 2,
        logoW,
        logoH,
      );
    } catch {
      /* skip */
    }
  }

  y = headerH + 12;

  const tableWidth = pw - 2 * m;

  function drawTable(
    tTitle: string,
    headers: string[],
    colX: number[],
    rows: string[][],
  ) {
    if (y > ph - 50) {
      doc.addPage();
      y = m;
    }
    drawSectionTitle(tTitle);

    doc.setFillColor(navy.r, navy.g, navy.b);
    doc.roundedRect(m, y - 4, tableWidth, 9, 1.5, 1.5, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    headers.forEach((h, i) => doc.text(h, m + colX[i], y + 1));
    y += 8;

    doc.setFont("helvetica", "normal");
    rows.forEach((row, idx) => {
      if (y > ph - 15) {
        doc.addPage();
        y = m;
      }
      if (idx % 2 === 0) {
        doc.setFillColor(lightBg.r, lightBg.g, lightBg.b);
        doc.rect(m, y - 3.5, tableWidth, 6.5, "F");
      }
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(8);
      row.forEach((cell, i) => doc.text(cell, m + colX[i], y + 1));
      y += 6.5;
    });
    y += 8;
  }

  function drawKPIBoxes(
    kpis: Array<{
      label: string;
      value: string;
      delta?: { percent: number; direction: string } | null;
      sublabel?: string;
    }>,
  ) {
    const gap = 4;
    const boxW = (pw - 2 * m - gap * (kpis.length - 1)) / kpis.length;
    const hasFooter = kpis.some(
      (k) => (k.delta && k.delta.direction !== "neutral") || k.sublabel,
    );
    const boxH = hasFooter ? 25 : 20;
    if (y + boxH > ph - 16) {
      doc.addPage();
      y = m;
    }
    const padX = 4.5;

    kpis.forEach((kpi, idx) => {
      const x = m + idx * (boxW + gap);
      // card
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(hairline.r, hairline.g, hairline.b);
      doc.setLineWidth(0.25);
      doc.roundedRect(x, y, boxW, boxH, 1.8, 1.8, "FD");
      // gold tick above the label — same motif as section titles
      doc.setFillColor(gold.r, gold.g, gold.b);
      doc.rect(x + padX, y + 4.2, 5, 0.8, "F");
      // label — small caps, left-aligned
      doc.setFontSize(5.8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(midGray.r, midGray.g, midGray.b);
      doc.text(kpi.label.toUpperCase(), x + padX, y + 8.6, { charSpace: 0.35 });
      // value — bold navy, left-aligned
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(navy.r, navy.g, navy.b);
      doc.text(kpi.value, x + padX, y + 15.4);

      // footer: delta pill or muted sublabel
      if (kpi.delta && kpi.delta.direction !== "neutral") {
        const isUp = kpi.delta.direction === "up";
        const clr = isUp
          ? { r: 5, g: 122, b: 85 }
          : { r: 190, g: 60, b: 45 };
        const pctText = `${isUp ? "+" : "-"}${Math.abs(kpi.delta.percent).toFixed(1)}%  vs periodo ant.`;
        doc.setFontSize(6);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(clr.r, clr.g, clr.b);
        doc.text(pctText, x + padX, y + 21);
      } else if (kpi.sublabel) {
        doc.setFontSize(6);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(midGray.r, midGray.g, midGray.b);
        doc.text(kpi.sublabel, x + padX, y + 21);
      }
    });
    y += boxH + 6;
  }

  function drawSectionTitle(tTitle: string) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(navy.r, navy.g, navy.b);
    doc.text(tTitle, m, y);
    // small gold tick under the title
    doc.setFillColor(gold.r, gold.g, gold.b);
    doc.rect(m, y + 1.4, 9, 0.9, "F");
    y += 8;
  }

  /** Horizontal bar chart with value labels (navy bars, gold highlight for #1). */
  function drawBarChartH(
    tTitle: string,
    items: Array<{ label: string; value: number; highlight?: boolean }>,
    fmt: (n: number) => string,
  ) {
    if (items.length === 0) return;
    const rowH = 8.4;
    const labelW = 54;
    const valW = 24;
    const chartW = tableWidth - labelW - valW;
    const needed = 12 + items.length * rowH + 6;
    if (y + needed > ph - 16) {
      doc.addPage();
      y = m;
    }
    drawSectionTitle(tTitle);
    const maxV = Math.max(...items.map((i) => i.value), 1);
    items.forEach((it, idx) => {
      const by = y + idx * rowH;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      const lbl =
        it.label.length > 30 ? it.label.substring(0, 27) + "..." : it.label;
      doc.text(lbl, m, by + 3.6);
      // track
      doc.setFillColor(chartTrack.r, chartTrack.g, chartTrack.b);
      doc.roundedRect(m + labelW, by, chartW, 4.8, 1.3, 1.3, "F");
      // bar
      const w = Math.max((it.value / maxV) * chartW, 1.6);
      const c = it.highlight ? chartGold : chartNavy;
      doc.setFillColor(c.r, c.g, c.b);
      doc.roundedRect(m + labelW, by, w, 4.8, 1.3, 1.3, "F");
      // value
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(midGray.r, midGray.g, midGray.b);
      doc.text(fmt(it.value), m + labelW + chartW + 2.5, by + 3.6);
    });
    y += items.length * rowH + 10;
  }

  /** Column chart (e.g. monthly series) with optional dashed reference line. */
  function drawColumnChart(
    tTitle: string,
    points: Array<{ label: string; value: number }>,
    fmt: (n: number) => string,
    ref?: { value: number; label: string },
  ) {
    if (points.length < 2) return;
    const chartH = 36;
    if (y + chartH + 26 > ph - 16) {
      doc.addPage();
      y = m;
    }
    drawSectionTitle(tTitle);
    const maxV = Math.max(...points.map((p) => p.value), ref?.value || 0, 1);
    const gap = 2.2;
    let colW = (tableWidth - gap * (points.length - 1)) / points.length;
    colW = Math.min(colW, 16);
    const totalW = colW * points.length + gap * (points.length - 1);
    const x0 = m;
    const baseY = y + chartH;
    const maxIdx = points.reduce(
      (best, p, i) => (p.value > points[best].value ? i : best),
      0,
    );

    // baseline
    doc.setDrawColor(hairline.r, hairline.g, hairline.b);
    doc.setLineWidth(0.3);
    doc.line(m, baseY, m + tableWidth, baseY);

    points.forEach((p, i) => {
      const h = Math.max((p.value / maxV) * (chartH - 8), 0.8);
      const x = x0 + i * (colW + gap);
      const isLast = i === points.length - 1;
      const c = isLast ? chartGold : chartNavy;
      doc.setFillColor(c.r, c.g, c.b);
      doc.roundedRect(x, baseY - h, colW, h, 1, 1, "F");
      // month label
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(midGray.r, midGray.g, midGray.b);
      doc.text(p.label, x + colW / 2, baseY + 3.6, { align: "center" });
      // value labels on peak + last column only (selective direct labels)
      if (i === maxIdx || isLast) {
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(ink.r, ink.g, ink.b);
        doc.text(fmt(p.value), x + colW / 2, baseY - h - 1.6, {
          align: "center",
        });
      }
    });

    // dashed reference line (e.g. firm average)
    if (ref && ref.value > 0) {
      const ry = baseY - (ref.value / maxV) * (chartH - 8);
      doc.setDrawColor(chartGold.r, chartGold.g, chartGold.b);
      doc.setLineWidth(0.5);
      doc.setLineDashPattern([1.6, 1.3], 0);
      doc.line(x0, ry, x0 + totalW, ry);
      doc.setLineDashPattern([], 0);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(chartGold.r, chartGold.g, chartGold.b);
      doc.text(ref.label, x0 + totalW + 2, ry + 1, { align: "left" });
    }

    y += chartH + 16;
  }

  function drawInsights(insights: Insight[], summary?: string) {
    if (insights.length === 0 && !summary) return;
    if (y > ph - 45) {
      doc.addPage();
      y = m;
    }

    // Section heading + "GENERADO POR IA" badge
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(ink.r, ink.g, ink.b);
    const heading = "Analisis Inteligente";
    doc.text(heading, m, y);
    const headingW = doc.getTextWidth(heading);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    const badge = "GENERADO POR IA";
    const badgeW = doc.getTextWidth(badge) + 5;
    doc.setFillColor(navy.r, navy.g, navy.b);
    doc.roundedRect(m + headingW + 4, y - 3.4, badgeW, 5, 1, 1, "F");
    doc.setTextColor(gold.r, gold.g, gold.b);
    doc.text(badge, m + headingW + 4 + badgeW / 2, y + 0.2, { align: "center" });
    y += 6;

    // Pre-measure wrapped lines to size the container
    const textW = tableWidth - 16;
    const lineH = 4.4;
    const blockGap = 3.2;
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "italic");
    const summaryLines = summary
      ? (doc.splitTextToSize(summary, textW) as string[])
      : [];
    const blocks = insights.map((ins) => {
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      return { ins, lines: doc.splitTextToSize(ins.text, textW) as string[] };
    });
    let contentH = 6;
    if (summaryLines.length > 0)
      contentH += summaryLines.length * lineH + blockGap + 2;
    blocks.forEach((b) => {
      contentH += b.lines.length * lineH + blockGap;
    });
    contentH += 1;

    if (y + contentH > ph - 16) {
      doc.addPage();
      y = m;
    }

    // Container
    doc.setFillColor(lightBg.r, lightBg.g, lightBg.b);
    doc.setDrawColor(hairline.r, hairline.g, hairline.b);
    doc.roundedRect(m, y, tableWidth, contentH, 2.5, 2.5, "FD");
    doc.setFillColor(gold.r, gold.g, gold.b);
    doc.rect(m, y, 1.5, contentH, "F");

    let iy = y + 7;

    // Executive summary paragraph (italic, before the bullet insights)
    if (summaryLines.length > 0) {
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(navy.r, navy.g, navy.b);
      summaryLines.forEach((ln, i) => {
        doc.text(ln, m + 6, iy + i * lineH);
      });
      iy += summaryLines.length * lineH + blockGap;
      doc.setDrawColor(hairline.r, hairline.g, hairline.b);
      doc.setLineWidth(0.25);
      doc.line(m + 6, iy - 2.2, m + tableWidth - 6, iy - 2.2);
      iy += 2;
    }

    blocks.forEach(({ ins, lines }) => {
      const tone =
        ins.tone === "positive"
          ? { r: 16, g: 185, b: 129 }
          : ins.tone === "warning"
            ? { r: 217, g: 119, b: 6 }
            : { r: 100, g: 116, b: 139 };
      doc.setFillColor(tone.r, tone.g, tone.b);
      doc.circle(m + 6, iy - 1.4, 1.1, "F");
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      lines.forEach((ln, i) => {
        doc.text(ln, m + 10, iy + i * lineH);
      });
      iy += lines.length * lineH + blockGap;
    });
    y += contentH + 12;
  }

  // ── TYPE-SPECIFIC CONTENT ──
  if (opts.type === "individual" && opts.individual) {
    const data = opts.individual;

    // Professional card
    doc.setFillColor(lightBg.r, lightBg.g, lightBg.b);
    doc.setDrawColor(220, 225, 235);
    doc.roundedRect(m, y, pw - 2 * m, 28, 3, 3, "FD");
    const cX = m + 14;
    const cY = y + 14;
    doc.setFillColor(navy.r, navy.g, navy.b);
    doc.circle(cX, cY, 9, "F");
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    const initials = data.usuario.name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
    doc.text(initials, cX, cY + 1.5, { align: "center" });
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(navy.r, navy.g, navy.b);
    doc.text(data.usuario.name, m + 28, y + 10);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(midGray.r, midGray.g, midGray.b);
    doc.text(
      `${data.usuario.category}  ·  ${data.usuario.practice_area}  ·  $${data.usuario.rate.toLocaleString()}/h`,
      m + 28,
      y + 18,
    );
    y += 35;

    const prev = data.prevPeriod;
    const bench = data.benchmark;
    drawKPIBoxes([
      {
        label: "Horas Totales",
        value: `${Math.round(data.totalHours).toLocaleString()}h`,
        delta: prev ? formatDelta(data.totalHours, prev.totalHours) : null,
        sublabel: `${data.billableHours.toFixed(0)}h facturables`,
      },
      {
        label: "Horas Facturables",
        value: `${data.billableHours.toFixed(1)}h`,
        delta: prev ? formatDelta(data.billableHours, prev.billableHours) : null,
        sublabel:
          bench.firmMonthlyAvg > 0
            ? `prom. firma: ${Math.round(bench.firmMonthlyAvg)}h/mes`
            : undefined,
      },
      {
        label: "Utilizacion",
        value: `${data.utilizationRate.toFixed(1)}%`,
        delta: prev ? formatDelta(data.utilizationRate, prev.utilizationRate) : null,
        sublabel: "sobre meta personal",
      },
      {
        label: "Ingresos",
        value: formatCurrency(data.totalRevenue),
        delta: prev ? formatDelta(data.totalRevenue, prev.totalRevenue) : null,
        sublabel:
          bench.totalPeers >= 3 && bench.rank > 0
            ? `puesto ${bench.rank} de ${bench.totalPeers}`
            : undefined,
      },
    ]);

    drawInsights(
      generateIndividualInsights(data),
      generateIndividualSummary(data),
    );

    // Monthly pace vs firm average
    if (data.benchmark.monthly.length >= 2) {
      drawColumnChart(
        "Horas Facturables por Mes",
        data.benchmark.monthly.map((mo) => ({
          label: mo.month,
          value: mo.user,
        })),
        (n) => `${Math.round(n)}h`,
        data.benchmark.firmMonthlyAvg > 0
          ? {
              value: data.benchmark.firmMonthlyAvg,
              label: "Prom. firma",
            }
          : undefined,
      );
    }

    drawTable(
      "Desglose por Cliente",
      ["Cliente", "Horas", "Proyectos", "Ingresos"],
      [3, 90, 115, 142],
      data.clients.map((c) => [
        c.clientName.length > 40 ? c.clientName.substring(0, 37) + "..." : c.clientName,
        `${Math.round(c.hours)}h`,
        c.projectCount.toString(),
        formatCurrency(c.revenue),
      ]),
    );

    drawTable(
      "Desglose por Proyecto",
      ["Proyecto", "Cliente", "Horas", "Ingresos"],
      [3, 68, 128, 150],
      data.projects.slice(0, 25).map((p) => [
        p.projectName.length > 30 ? p.projectName.substring(0, 27) + "..." : p.projectName,
        p.clientName.length > 28 ? p.clientName.substring(0, 25) + "..." : p.clientName,
        `${Math.round(p.hours)}h`,
        formatCurrency(p.revenue),
      ]),
    );
  } else if (opts.type === "gerencial" && opts.gerencial) {
    const data = opts.gerencial;
    const prev = data.prevPeriod;

    // Primary KPIs
    const analytics = computeGerencialAnalytics(data);
    drawKPIBoxes([
      {
        label: "Total Facturado",
        value: formatCurrency(data.totalFacturado),
        delta: prev ? formatDelta(data.totalFacturado, prev.totalFacturado) : null,
        sublabel:
          data.metaFacturacion > 0
            ? `${analytics.metaAttainment.toFixed(0)}% de la meta`
            : undefined,
      },
      {
        label: "Horas Facturables",
        value: `${Math.round(data.totalHorasFacturables).toLocaleString()}h`,
        delta: prev
          ? formatDelta(data.totalHorasFacturables, prev.totalHorasFacturables)
          : null,
        sublabel: `de ${Math.round(data.totalHours).toLocaleString()}h registradas`,
      },
      {
        label: "Clientes Activos",
        value: data.clientesUnicos.toString(),
        delta: prev ? formatDelta(data.clientesUnicos, prev.clientesUnicos) : null,
        sublabel: `${data.totalProjects} proyectos activos`,
      },
      {
        label: "Meta Facturacion",
        value: formatCurrency(data.metaFacturacion),
        sublabel:
          data.metaFacturacion > data.totalFacturado
            ? `faltan ${formatCurrency(data.metaFacturacion - data.totalFacturado)}`
            : "meta superada",
      },
    ]);

    // Secondary KPIs
    drawKPIBoxes([
      {
        label: "Utilizacion",
        value: `${data.utilizationRate.toFixed(1)}%`,
        sublabel: "horas facturables / totales",
      },
      {
        label: "Margen Promedio",
        value: `${data.avgMarginPercent.toFixed(1)}%`,
        sublabel: "facturacion vs costo",
      },
      {
        label: "Ingreso / Cliente",
        value: formatCurrency(analytics.avgRevenuePerClient),
        sublabel: "promedio por cliente activo",
      },
      {
        label: "Momentum Ingresos",
        value:
          data.monthlyRevenue.length >= 2
            ? `${analytics.revenueMomentum >= 0 ? "+" : ""}${analytics.revenueMomentum.toFixed(0)}%`
            : "—",
        sublabel: "primer vs ultimo mes",
      },
    ]);

    // Derived analytics — key ratios beyond headline KPIs
    drawKPIBoxes([
      {
        label: "Cumplim. de Meta",
        value: data.metaFacturacion > 0 ? `${analytics.metaAttainment.toFixed(0)}%` : "—",
        sublabel: "sobre meta de facturacion",
      },
      {
        label: "Concentr. Top 3",
        value: `${analytics.clientConcentration.toFixed(0)}%`,
        sublabel:
          analytics.clientConcentration >= 60
            ? "riesgo de dependencia"
            : "cartera diversificada",
      },
      {
        label: "Prom. Facturable / Prof.",
        value:
          data.proStats.firmMonthlyAvg > 0
            ? `${Math.round(data.proStats.firmMonthlyAvg)}h/mes`
            : "—",
        sublabel:
          data.proStats.belowAvg.length > 0
            ? `${data.proStats.belowAvg.length} prof. bajo promedio`
            : "equipo parejo",
      },
      {
        label: "Proyectos Activos",
        value: data.totalProjects.toString(),
        sublabel: `${data.clientesUnicos} clientes`,
      },
    ]);

    drawInsights(
      generateGerencialInsights(data),
      generateGerencialSummary(data),
    );

    // Monthly revenue trend
    if (data.monthlyRevenue.length >= 2) {
      drawColumnChart(
        "Evolucion Mensual de Ingresos",
        data.monthlyRevenue.map((mo) => ({
          label: mo.month.split("-")[1] || mo.month,
          value: mo.revenue,
        })),
        formatCurrency,
      );
    }

    // Revenue by practice area — gold highlight on the leading area
    drawBarChartH(
      "Facturacion por Area de Practica",
      data.areaBreakdown
        .filter((a) => a.facturacion > 0)
        .sort((a, b) => b.facturacion - a.facturacion)
        .map((a, i) => ({
          label: a.area,
          value: a.facturacion,
          highlight: i === 0,
        })),
      formatCurrency,
    );

    // Top Clients with margin
    drawTable(
      "Top Clientes",
      ["Cliente", "Horas", "Proyectos", "Margen"],
      [3, 95, 125, 155],
      data.topClients.map((c) => [
        c.name.length > 42 ? c.name.substring(0, 39) + "..." : c.name,
        `${Math.round(c.hours)}h`,
        c.projects.toString(),
        c.margin != null ? `${c.margin.toFixed(0)}%` : "—",
      ]),
    );

    // Client Profitability
    if (data.clientProfitability.length > 0) {
      drawTable(
        "Rentabilidad por Cliente",
        ["Cliente", "Facturado", "Costo", "Margen"],
        [3, 85, 120, 155],
        data.clientProfitability.map((c) => [
          c.name.length > 38 ? c.name.substring(0, 35) + "..." : c.name,
          formatCurrency(c.facturacion),
          formatCurrency(c.costo),
          `${c.margin.toFixed(1)}%`,
        ]),
      );
    }

    // Top Professionals
    drawTable(
      "Top Profesionales por Ingresos",
      ["Profesional", "Categoria", "Ingresos"],
      [3, 75, 130],
      data.topProfessionals.map((p) => [
        p.name,
        p.category || p.code,
        formatCurrency(p.revenue),
      ]),
    );

    // Hours by Category — horizontal bars
    drawBarChartH(
      "Horas Facturables por Categoria",
      [...data.categoryBreakdown]
        .sort((a, b) => b.billableHours - a.billableHours)
        .map((c) => ({
          label: `${c.category} (${c.userCount} prof.)`,
          value: c.billableHours,
        })),
      (n) => `${Math.round(n).toLocaleString()}h`,
    );

    // Top Projects
    if (data.topProjects.length > 0) {
      drawTable(
        "Top Proyectos por Ingresos",
        ["Proyecto", "Cliente", "Horas", "Ingresos"],
        [3, 68, 128, 150],
        data.topProjects.slice(0, 10).map((p) => [
          p.name.length > 30 ? p.name.substring(0, 27) + "..." : p.name,
          p.clientName.length > 28 ? p.clientName.substring(0, 25) + "..." : p.clientName,
          `${Math.round(p.hours)}h`,
          formatCurrency(p.revenue),
        ]),
      );
    }
  }

  // Footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(navy.r, navy.g, navy.b);
    doc.rect(0, ph - 4, pw, 4, "F");
    doc.setFillColor(gold.r, gold.g, gold.b);
    doc.rect(0, ph - 5.5, pw, 1.5, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(midGray.r, midGray.g, midGray.b);
    doc.text(`${opts.firmName || "Organizacion"} · ${dateStr}`, m, ph - 8);
    doc.text(`Pagina ${i} de ${pageCount}`, pw - m, ph - 8, {
      align: "right",
    });
  }

  const prefix = opts.type === "gerencial" ? "Gerencial" : `Individual_${opts.individual?.usuario.code}`;
  doc.save(`Reporte_${prefix}_${today.toISOString().split("T")[0]}.pdf`);
}

// ===================== MAIN COMPONENT =====================

const ReportesPDF = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Shared
  const [firmName, setFirmName] = useState(
    () => sessionStorage.getItem("firmName") || "",
  );
  const [logoUrl, setLogoUrl] = useState(
    () => sessionStorage.getItem("logoUrl") || "",
  );
  const usuarios = useMemo(() => getUsuarios(), []);

  // Individual
  const [selectedProfessional, setSelectedProfessional] = useState("");
  const [indPeriod, setIndPeriod] = useState("");
  const [indStart, setIndStart] = useState<Date | undefined>();
  const [indEnd, setIndEnd] = useState<Date | undefined>();
  const [indData, setIndData] = useState<IndividualReportData | null>(null);
  const [indLoading, setIndLoading] = useState(false);
  const [indExporting, setIndExporting] = useState(false);
  const [indPreviewOpen, setIndPreviewOpen] = useState(false);
  const [indScheduleEnabled, setIndScheduleEnabled] = useState(false);
  const [indScheduleFreq, setIndScheduleFreq] = useState("weekly");
  const [indScheduleDay, setIndScheduleDay] = useState("monday");
  const [indScheduleHour, setIndScheduleHour] = useState("09:00");

  // Gerencial
  const [gerPeriod, setGerPeriod] = useState("");
  const [gerStart, setGerStart] = useState<Date | undefined>();
  const [gerEnd, setGerEnd] = useState<Date | undefined>();
  const [gerData, setGerData] = useState<GerencialReportData | null>(null);
  const [gerLoading, setGerLoading] = useState(false);
  const [gerExporting, setGerExporting] = useState(false);
  const [gerPreviewOpen, setGerPreviewOpen] = useState(false);
  const [gerScheduleEnabled, setGerScheduleEnabled] = useState(false);
  const [gerScheduleFreq, setGerScheduleFreq] = useState("weekly");
  const [gerScheduleDay, setGerScheduleDay] = useState("monday");
  const [gerScheduleHour, setGerScheduleHour] = useState("09:00");

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    const fetchProfile = async () => {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      if (u) {
        const { data: p } = await supabase
          .from("profiles")
          .select("firm_name, firm_logo")
          .eq("id", u.id)
          .single();
        if (p?.firm_name) {
          setFirmName(p.firm_name);
          sessionStorage.setItem("firmName", p.firm_name);
        }
        if (p?.firm_logo) {
          setLogoUrl(p.firm_logo);
          sessionStorage.setItem("logoUrl", p.firm_logo);
        }
      }
    };
    if (
      !sessionStorage.getItem("logoUrl") ||
      !sessionStorage.getItem("firmName")
    )
      fetchProfile();
  }, []);

  // Individual data
  useEffect(() => {
    if (!selectedProfessional) {
      setIndData(null);
      return;
    }
    setIndLoading(true);
    const t = setTimeout(() => {
      if (USE_MOCK_DATA) {
        const usuario = usuarios.find((u) => u.code === selectedProfessional);
        if (!usuario) {
          setIndData(null);
          setIndLoading(false);
          return;
        }
        const profileData = getUserProfileData(selectedProfessional, indStart, indEnd);
        const metrics = computeIndividualMetrics(selectedProfessional, usuario, indStart, indEnd);
        if (!profileData || !metrics) {
          setIndData(null);
          setIndLoading(false);
          return;
        }
        let prevPeriod: PeriodMetrics | null = null;
        const prev = getPreviousPeriodRange(indStart, indEnd);
        if (prev) {
          prevPeriod = computeIndividualMetrics(
            selectedProfessional,
            usuario,
            prev.prevStart,
            prev.prevEnd,
          );
        }
        setIndData({
          ...metrics,
          usuario,
          benchmark: computePeerBenchmark(selectedProfessional, indStart, indEnd),
          clients: profileData.clients.map((c) => ({
            clientName: c.client_name,
            hours: c.total_hours,
            revenue: c.revenue,
            projectCount: c.project_count,
          })),
          projects: profileData.projects.map((p) => ({
            projectName: p.project_name,
            clientName: p.client_name,
            hours: p.total_hours,
            revenue: p.revenue,
          })),
          prevPeriod,
        });
      }
      setIndLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [selectedProfessional, indStart, indEnd, usuarios]);

  // Gerencial data
  useEffect(() => {
    setGerLoading(true);
    const t = setTimeout(() => {
      if (USE_MOCK_DATA) {
        setGerData(computeGerencialData(gerStart, gerEnd));
      }
      setGerLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [gerStart, gerEnd]);

  const handleIndPDF = useCallback(async () => {
    if (!indData) return;
    setIndExporting(true);
    try {
      await generateIndividualPDF(indData, firmName, logoUrl, indStart, indEnd);
    } finally {
      setIndExporting(false);
    }
  }, [indData, firmName, logoUrl, indStart, indEnd]);

  const handleGerPDF = useCallback(async () => {
    if (!gerData) return;
    setGerExporting(true);
    try {
      await generateGerencialPDF(gerData, firmName, logoUrl, gerStart, gerEnd);
    } finally {
      setGerExporting(false);
    }
  }, [gerData, firmName, logoUrl, gerStart, gerEnd]);

  // ==================== RENDER ====================

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) return null;

  // Build KPI stats for individual
  const indPrev = indData?.prevPeriod;
  const indStats = indData
    ? [
        {
          title: "Horas Totales",
          value: `${Math.round(indData.totalHours).toLocaleString()}h`,
          icon: Clock,
          color: "text-blue-600",
          bg: "bg-blue-100",
          delta: indPrev ? formatDelta(indData.totalHours, indPrev.totalHours) : null,
        },
        {
          title: "Horas Facturables",
          value: `${indData.billableHours.toFixed(1)}h`,
          icon: Clock,
          color: "text-emerald-600",
          bg: "bg-emerald-100",
          delta: indPrev
            ? formatDelta(indData.billableHours, indPrev.billableHours)
            : null,
        },
        {
          title: "Utilizacion",
          value: `${indData.utilizationRate.toFixed(1)}%`,
          icon: Activity,
          color:
            indData.utilizationRate >= 100
              ? "text-emerald-600"
              : indData.utilizationRate >= 85
                ? "text-amber-600"
                : "text-red-600",
          bg:
            indData.utilizationRate >= 100
              ? "bg-emerald-100"
              : indData.utilizationRate >= 85
                ? "bg-amber-100"
                : "bg-red-100",
          delta: indPrev
            ? formatDelta(indData.utilizationRate, indPrev.utilizationRate)
            : null,
        },
        {
          title: "Ingresos",
          value: formatCurrency(indData.totalRevenue),
          icon: DollarSign,
          color: "text-emerald-600",
          bg: "bg-emerald-100",
          delta: indPrev
            ? formatDelta(indData.totalRevenue, indPrev.totalRevenue)
            : null,
        },
      ]
    : [];

  // Build KPI stats for gerencial
  const gerPrev = gerData?.prevPeriod;
  const gerStats = gerData
    ? [
        {
          title: "Total Facturado",
          value: formatCurrency(gerData.totalFacturado),
          icon: DollarSign,
          color: "text-emerald-600",
          bg: "bg-emerald-100",
          delta: gerPrev
            ? formatDelta(gerData.totalFacturado, gerPrev.totalFacturado)
            : null,
        },
        {
          title: "Horas Facturables",
          value: `${Math.round(gerData.totalHorasFacturables).toLocaleString()}h`,
          icon: Clock,
          color: "text-blue-600",
          bg: "bg-blue-100",
          delta: gerPrev
            ? formatDelta(
                gerData.totalHorasFacturables,
                gerPrev.totalHorasFacturables,
              )
            : null,
        },
        {
          title: "Clientes Activos",
          value: gerData.clientesUnicos.toString(),
          icon: Users,
          color: "text-purple-600",
          bg: "bg-purple-100",
          delta: gerPrev
            ? formatDelta(gerData.clientesUnicos, gerPrev.clientesUnicos)
            : null,
        },
        {
          title: "Meta Facturacion",
          value: formatCurrency(gerData.metaFacturacion),
          icon: Target,
          color: "text-amber-600",
          bg: "bg-amber-100",
          delta: null,
        },
      ]
    : [];

  const hasPeriodInd = !!(indStart && indEnd);
  const hasPeriodGer = !!(gerStart && gerEnd);

  const gerPeriodLabel = hasPeriodGer && gerStart && gerEnd
    ? `${format(gerStart, "dd MMM", { locale: es })} — ${format(gerEnd, "dd MMM yyyy", { locale: es })}`
    : "Todo el periodo";
  const indPeriodLabel = hasPeriodInd && indStart && indEnd
    ? `${format(indStart, "dd MMM", { locale: es })} — ${format(indEnd, "dd MMM yyyy", { locale: es })}`
    : "Todo el periodo";

  return (
    <DashboardLayout>
      <div className="space-y-6 w-full min-w-0 max-w-full">
        {/* Page hero */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(210,58%,13%)] via-[hsl(210,55%,19%)] to-[hsl(210,48%,28%)] px-6 py-7 sm:px-8 shadow-[0_10px_30px_-10px_hsl(210,55%,23%,0.45)]">
          {/* decorative geometry */}
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border border-white/[0.07]" />
          <div className="pointer-events-none absolute -right-8 -top-12 h-48 w-48 rounded-full border border-[hsl(43,74%,52%)]/20" />
          <div className="pointer-events-none absolute right-24 top-6 h-1.5 w-1.5 rounded-full bg-[hsl(43,74%,52%)]/70" />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[hsl(43,74%,58%)]">
                Inteligencia de la Firma
              </p>
              <h1 className="mt-1.5 text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Centro de Reportes
              </h1>
              <p className="mt-1.5 text-sm text-white/65 max-w-xl">
                Reportes ejecutivos con análisis generado por IA — benchmarks entre
                profesionales, tendencias y alertas, listos para presentar.
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-2.5 rounded-xl border border-[hsl(43,74%,52%)]/30 bg-white/[0.06] px-4 py-3 backdrop-blur-sm">
              <div className="h-9 w-9 rounded-lg bg-[hsl(43,74%,52%)]/15 ring-1 ring-[hsl(43,74%,52%)]/50 flex items-center justify-center">
                <Sparkles className="h-[18px] w-[18px] text-[hsl(43,80%,62%)]" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Insights de IA</p>
                <p className="text-[11px] text-white/60">
                  Nuevos en cada descarga
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ================== GERENCIAL CARD ================== */}
        <Card className="border-border/50 overflow-hidden">
          <CardContent className="p-0">
            {/* Main row */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 p-5">
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-[hsl(210,58%,16%)] to-[hsl(210,48%,32%)] ring-1 ring-[hsl(43,74%,52%)]/40 flex items-center justify-center shrink-0 shadow-md">
                <Building2 className="h-7 w-7 text-[hsl(43,74%,62%)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-semibold text-foreground">Reporte Gerencial</h3>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(43,74%,52%)]/10 border border-[hsl(43,74%,52%)]/30 px-2 py-0.5 text-[10px] font-semibold text-[hsl(43,65%,32%)]">
                    <Sparkles className="h-3 w-3" /> Insights IA
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Resumen ejecutivo con facturación, rentabilidad y benchmarks del equipo
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{gerPeriodLabel}</span>
                      <span className="sm:hidden">Periodo</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-4" align="end">
                    <div className="space-y-3">
                      <p className="text-sm font-medium">Seleccionar periodo</p>
                      <PeriodSelector
                        periodPreset={gerPeriod}
                        setPeriodPreset={setGerPeriod}
                        startDate={gerStart}
                        setStartDate={setGerStart}
                        endDate={gerEnd}
                        setEndDate={setGerEnd}
                      />
                    </div>
                  </PopoverContent>
                </Popover>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => setGerPreviewOpen(true)}
                  disabled={!gerData || gerLoading}
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Vista Previa</span>
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 text-xs bg-primary hover:bg-primary/90"
                  onClick={handleGerPDF}
                  disabled={!gerData || gerExporting}
                >
                  {gerExporting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  <span>{gerExporting ? "Generando..." : "Descargar PDF"}</span>
                </Button>
              </div>
            </div>
            {/* Schedule strip */}
            <div className="border-t border-border/50 bg-muted/30 px-5 py-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2.5">
                  <Switch
                    checked={gerScheduleEnabled}
                    onCheckedChange={setGerScheduleEnabled}
                    className="scale-90"
                  />
                  <div className="flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      Programacion {gerScheduleEnabled ? "activada" : "desactivada"}
                    </span>
                  </div>
                </div>
                {gerScheduleEnabled && (
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="text-muted-foreground">Enviar cada</span>
                    <Select value={gerScheduleFreq} onValueChange={setGerScheduleFreq}>
                      <SelectTrigger className="h-7 w-[110px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Semana</SelectItem>
                        <SelectItem value="biweekly">Quincena</SelectItem>
                        <SelectItem value="monthly">Mes</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-muted-foreground">el</span>
                    <Select value={gerScheduleDay} onValueChange={setGerScheduleDay}>
                      <SelectTrigger className="h-7 w-[110px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monday">Lunes</SelectItem>
                        <SelectItem value="tuesday">Martes</SelectItem>
                        <SelectItem value="wednesday">Miercoles</SelectItem>
                        <SelectItem value="thursday">Jueves</SelectItem>
                        <SelectItem value="friday">Viernes</SelectItem>
                        <SelectItem value="1">Dia 1</SelectItem>
                        <SelectItem value="15">Dia 15</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-muted-foreground">a las</span>
                    <Select value={gerScheduleHour} onValueChange={setGerScheduleHour}>
                      <SelectTrigger className="h-7 w-[80px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["07:00","08:00","09:00","10:00","11:00","12:00","14:00","16:00","18:00"].map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ================== INDIVIDUAL CARD ================== */}
        <Card className="border-border/50 overflow-hidden">
          <CardContent className="p-0">
            {/* Main row */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 p-5">
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-[hsl(210,30%,30%)] to-[hsl(210,25%,48%)] ring-1 ring-white/20 flex items-center justify-center shrink-0 shadow-md">
                <User className="h-7 w-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-semibold text-foreground">Reporte Individual</h3>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(43,74%,52%)]/10 border border-[hsl(43,74%,52%)]/30 px-2 py-0.5 text-[10px] font-semibold text-[hsl(43,65%,32%)]">
                    <Sparkles className="h-3 w-3" /> Insights IA
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Productividad por profesional comparada con el promedio de la firma
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <Select
                  value={selectedProfessional}
                  onValueChange={setSelectedProfessional}
                >
                  <SelectTrigger className="h-8 text-xs w-[180px]">
                    <SelectValue placeholder="Profesional..." />
                  </SelectTrigger>
                  <SelectContent>
                    {usuarios.map((u) => (
                      <SelectItem key={u.code} value={u.code}>
                        {u.name} ({u.category})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{indPeriodLabel}</span>
                      <span className="sm:hidden">Periodo</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-4" align="end">
                    <div className="space-y-3">
                      <p className="text-sm font-medium">Seleccionar periodo</p>
                      <PeriodSelector
                        periodPreset={indPeriod}
                        setPeriodPreset={setIndPeriod}
                        startDate={indStart}
                        setStartDate={setIndStart}
                        endDate={indEnd}
                        setEndDate={setIndEnd}
                      />
                    </div>
                  </PopoverContent>
                </Popover>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => setIndPreviewOpen(true)}
                  disabled={!indData || indLoading}
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Vista Previa</span>
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 text-xs bg-primary hover:bg-primary/90"
                  onClick={handleIndPDF}
                  disabled={!indData || indExporting}
                >
                  {indExporting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  <span>{indExporting ? "Generando..." : "Descargar PDF"}</span>
                </Button>
              </div>
            </div>
            {/* Schedule strip */}
            <div className="border-t border-border/50 bg-muted/30 px-5 py-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2.5">
                  <Switch
                    checked={indScheduleEnabled}
                    onCheckedChange={setIndScheduleEnabled}
                    className="scale-90"
                  />
                  <div className="flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      Programacion {indScheduleEnabled ? "activada" : "desactivada"}
                    </span>
                  </div>
                </div>
                {indScheduleEnabled && (
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="text-muted-foreground">Enviar cada</span>
                    <Select value={indScheduleFreq} onValueChange={setIndScheduleFreq}>
                      <SelectTrigger className="h-7 w-[110px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Semana</SelectItem>
                        <SelectItem value="biweekly">Quincena</SelectItem>
                        <SelectItem value="monthly">Mes</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-muted-foreground">el</span>
                    <Select value={indScheduleDay} onValueChange={setIndScheduleDay}>
                      <SelectTrigger className="h-7 w-[110px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monday">Lunes</SelectItem>
                        <SelectItem value="tuesday">Martes</SelectItem>
                        <SelectItem value="wednesday">Miercoles</SelectItem>
                        <SelectItem value="thursday">Jueves</SelectItem>
                        <SelectItem value="friday">Viernes</SelectItem>
                        <SelectItem value="1">Dia 1</SelectItem>
                        <SelectItem value="15">Dia 15</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-muted-foreground">a las</span>
                    <Select value={indScheduleHour} onValueChange={setIndScheduleHour}>
                      <SelectTrigger className="h-7 w-[80px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["07:00","08:00","09:00","10:00","11:00","12:00","14:00","16:00","18:00"].map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ================== REPORTES PERSONALIZADOS CARD ================== */}
        <Card className="border-border/50 overflow-hidden">
          <CardContent className="p-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 p-5">
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-[hsl(43,74%,42%)] to-[hsl(36,70%,38%)] ring-1 ring-[hsl(43,74%,70%)]/50 flex items-center justify-center shrink-0 shadow-md">
                <Sparkles className="h-7 w-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-foreground">Reportes Personalizados</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Reportes a medida con metricas, diseno y formato adaptados a tu firma
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs shrink-0"
                onClick={() => window.open("mailto:contacto@lawbit.io?subject=Reportes%20Personalizados&body=Hola%2C%20me%20interesa%20conocer%20m%C3%A1s%20sobre%20los%20reportes%20personalizados.", "_blank")}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Contactar a Lawbit
              </Button>
            </div>
            {/* Feature preview strip */}
            <div className="border-t border-border/50 bg-muted/30 px-5 py-3">
              <div className="flex items-center gap-6 text-xs text-muted-foreground overflow-x-auto">
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Branding de tu firma
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  KPIs personalizados
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Formato y diseno a medida
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Integracion con tus sistemas
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ================== GERENCIAL PREVIEW DIALOG ================== */}
        <Dialog open={gerPreviewOpen} onOpenChange={setGerPreviewOpen}>
          <DialogContent className="max-w-5xl max-h-[88vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Vista Previa — Reporte Gerencial
              </DialogTitle>
              <DialogDescription>
                Asi se vera el contenido del reporte PDF
              </DialogDescription>
            </DialogHeader>
            {gerData && (
              <GerencialPreviewContent
                gerData={gerData}
                gerStats={gerStats}
                hasPeriodGer={hasPeriodGer}
                firmName={firmName}
                periodLabel={gerPeriodLabel}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* ================== INDIVIDUAL PREVIEW DIALOG ================== */}
        <Dialog open={indPreviewOpen} onOpenChange={setIndPreviewOpen}>
          <DialogContent className="max-w-5xl max-h-[88vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Vista Previa — Reporte Individual
              </DialogTitle>
              <DialogDescription>
                Asi se vera el contenido del reporte PDF
              </DialogDescription>
            </DialogHeader>
            {indData ? (
              <IndividualPreviewContent
                indData={indData}
                indStats={indStats}
                hasPeriodInd={hasPeriodInd}
                firmName={firmName}
                periodLabel={indPeriodLabel}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <User className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  Selecciona un profesional para ver la vista previa
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default ReportesPDF;
