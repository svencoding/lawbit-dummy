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

// ===================== TYPES =====================

interface PeriodMetrics {
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  utilizationRate: number;
  totalRevenue: number;
  totalCost: number;
}

interface IndividualReportData extends PeriodMetrics {
  usuario: Usuario;
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

function generateGerencialInsights(data: GerencialReportData): Insight[] {
  const a = computeGerencialAnalytics(data);
  const out: Insight[] = [];

  // Goal attainment
  if (data.metaFacturacion > 0) {
    if (a.metaAttainment >= 100) {
      out.push({
        tone: "positive",
        text: `La firma superó su meta de facturación, alcanzando el ${a.metaAttainment.toFixed(0)}% del objetivo (${formatCurrency(data.totalFacturado)} frente a una meta de ${formatCurrency(data.metaFacturacion)}).`,
      });
    } else if (a.metaAttainment >= 80) {
      out.push({
        tone: "neutral",
        text: `La facturación alcanzó el ${a.metaAttainment.toFixed(0)}% de la meta; un cierre adicional de ${formatCurrency(data.metaFacturacion - data.totalFacturado)} completaría el objetivo del periodo.`,
      });
    } else {
      out.push({
        tone: "warning",
        text: `La facturación se ubicó en ${a.metaAttainment.toFixed(0)}% de la meta, ${formatCurrency(data.metaFacturacion - data.totalFacturado)} por debajo del objetivo. Conviene revisar la asignación de horas facturables.`,
      });
    }
  }

  // Growth vs previous period
  if (data.prevPeriod && data.prevPeriod.totalFacturado > 0) {
    const d = formatDelta(data.totalFacturado, data.prevPeriod.totalFacturado);
    if (d.direction === "up") {
      out.push({
        tone: "positive",
        text: `Los ingresos crecieron ${Math.abs(d.percent).toFixed(1)}% respecto al periodo anterior${data.topClients[0] ? `, con ${data.topClients[0].name} como principal motor de actividad` : ""}.`,
      });
    } else if (d.direction === "down") {
      out.push({
        tone: "warning",
        text: `Los ingresos cayeron ${Math.abs(d.percent).toFixed(1)}% frente al periodo anterior. Se sugiere analizar los clientes con menor actividad para revertir la tendencia.`,
      });
    }
  }

  // Client concentration / risk
  if (data.topClients.length >= 3) {
    if (a.clientConcentration >= 60) {
      out.push({
        tone: "warning",
        text: `Existe una alta concentración de cartera: los 3 clientes principales representan el ${a.clientConcentration.toFixed(0)}% de las horas facturables. Diversificar la base de clientes reduciría el riesgo de dependencia.`,
      });
    } else {
      out.push({
        tone: "positive",
        text: `La cartera está sanamente distribuida: los 3 clientes principales concentran solo el ${a.clientConcentration.toFixed(0)}% de las horas facturables.`,
      });
    }
  }

  // Margin health
  if (data.avgMarginPercent >= 40) {
    out.push({
      tone: "positive",
      text: `El margen promedio de ${data.avgMarginPercent.toFixed(1)}% supera el estándar del sector legal (~35%), lo que refleja una operación eficiente en costos.`,
    });
  } else if (data.avgMarginPercent > 0 && data.avgMarginPercent < 20) {
    out.push({
      tone: "warning",
      text: `El margen promedio de ${data.avgMarginPercent.toFixed(1)}% es ajustado; revisar tarifas por hora y la mezcla de proyectos podría mejorar la rentabilidad.`,
    });
  }

  // Utilization
  if (data.utilizationRate > 0 && data.utilizationRate < 60) {
    out.push({
      tone: "warning",
      text: `La utilización de ${data.utilizationRate.toFixed(1)}% indica capacidad ociosa. Reorientar horas no facturables hacia trabajo facturable elevaría los ingresos sin sumar personal.`,
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
      text: `El área de ${a.topArea.area} lidera la facturación con ${formatCurrency(a.topArea.facturacion)}, posicionándose como la práctica más rentable del periodo.`,
    });
  }

  return out.slice(0, 5);
}

function generateIndividualInsights(data: IndividualReportData): Insight[] {
  const out: Insight[] = [];
  const billableRatio = data.totalHours > 0 ? (data.billableHours / data.totalHours) * 100 : 0;
  const firstName = data.usuario.name.split(" ")[0];

  if (data.utilizationRate >= 100) {
    out.push({
      tone: "positive",
      text: `${firstName} superó su meta de utilización alcanzando ${data.utilizationRate.toFixed(0)}%, un desempeño sobresaliente para el periodo.`,
    });
  } else if (data.utilizationRate > 0 && data.utilizationRate < 70) {
    out.push({
      tone: "warning",
      text: `La utilización de ${data.utilizationRate.toFixed(0)}% está por debajo del objetivo; incrementar las horas facturables mejoraría la contribución a la firma.`,
    });
  } else {
    out.push({
      tone: "neutral",
      text: `La utilización se ubicó en ${data.utilizationRate.toFixed(0)}%, dentro del rango esperado para su categoría.`,
    });
  }

  out.push({
    tone: billableRatio >= 70 ? "positive" : "neutral",
    text: `El ${billableRatio.toFixed(0)}% de las horas registradas fueron facturables (${data.billableHours.toFixed(0)}h de ${Math.round(data.totalHours)}h totales).`,
  });

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

  return out.slice(0, 4);
}

// ===================== SUB-COMPONENTS =====================

/* SchedulePanel removed — feature not yet implemented */

/** Renders the AI insights block in the on-screen preview. */
function AIInsightsPanel({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;
  const toneStyles: Record<Insight["tone"], string> = {
    positive: "bg-emerald-500",
    warning: "bg-orange-500",
    neutral: "bg-slate-400",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50/40 p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-sm">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <h4 className="text-sm font-semibold text-slate-800">Análisis Inteligente</h4>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
          Generado por IA
        </span>
      </div>
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
}) {
  const maxAreaRevenue = Math.max(...gerData.areaBreakdown.map((a) => a.facturacion), 1);
  const maxCategoryHours = Math.max(...gerData.categoryBreakdown.map((c) => c.billableHours), 1);
  const analytics = computeGerencialAnalytics(gerData);
  const insights = generateGerencialInsights(gerData);

  return (
    <div className="space-y-6">
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
      <AIInsightsPanel insights={insights} />

      {/* Revenue by Practice Area */}
      {gerData.areaBreakdown.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Facturacion por Area
          </h4>
          <div className="space-y-2.5">
            {gerData.areaBreakdown
              .sort((a, b) => b.facturacion - a.facturacion)
              .map((area) => (
                <div key={area.area}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-foreground">{area.area}</span>
                    <span className="text-muted-foreground font-medium">
                      {formatCurrency(area.facturacion)}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-primary/80 transition-all"
                      style={{ width: `${(area.facturacion / maxAreaRevenue) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
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
        {gerData.categoryBreakdown.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4" /> Horas por Categoria
            </h4>
            <div className="space-y-3">
              {gerData.categoryBreakdown.map((cat) => (
                <div key={cat.category}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-foreground">{cat.category}</span>
                    <span className="text-muted-foreground">
                      {Math.round(cat.billableHours).toLocaleString()}h · {cat.userCount} prof.
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-blue-500/80 transition-all"
                      style={{ width: `${(cat.billableHours / maxCategoryHours) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
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

      {/* Monthly Revenue Trend */}
      {gerData.monthlyRevenue.length > 1 && (
        <div>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Tendencia Mensual de Ingresos
          </h4>
          <div className="flex items-end gap-1 h-24">
            {(() => {
              const maxRev = Math.max(...gerData.monthlyRevenue.map((m) => m.revenue), 1);
              return gerData.monthlyRevenue.map((m, i) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t transition-all ${i === gerData.monthlyRevenue.length - 1 ? "bg-primary" : "bg-primary/40"}`}
                    style={{ height: `${Math.max((m.revenue / maxRev) * 80, 4)}px` }}
                    title={`${m.month}: ${formatCurrency(m.revenue)}`}
                  />
                  <span className="text-[9px] text-muted-foreground leading-none">
                    {m.month.split("-")[1]}
                  </span>
                </div>
              ));
            })()}
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
            <span>{gerData.monthlyRevenue[0]?.month}</span>
            <span>{gerData.monthlyRevenue[gerData.monthlyRevenue.length - 1]?.month}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function IndividualPreviewContent({
  indData,
  indStats,
  hasPeriodInd,
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
}) {
  return (
    <div className="space-y-6">
      {/* Professional header */}
      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <span className="text-lg font-bold text-primary">
            {indData.usuario.name.charAt(0)}
          </span>
        </div>
        <div>
          <h3 className="font-bold text-foreground">{indData.usuario.name}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">{indData.usuario.category}</Badge>
            <span className="text-xs text-muted-foreground">{indData.usuario.practice_area}</span>
          </div>
        </div>
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
      <AIInsightsPanel insights={generateIndividualInsights(indData)} />

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

  // Professional corporate palette — deep navy + a single clean blue accent.
  // (Replaces the previous navy + tan/gold scheme.)
  const navy = { r: 22, g: 35, b: 56 }; // primary — deep navy
  const gold = { r: 45, g: 106, b: 197 }; // accent — clean blue (kept name for existing refs)
  const accent = gold;
  const ink = { r: 15, g: 23, b: 42 }; // slate-900 headings
  const lightBg = { r: 247, g: 249, b: 252 };
  const midGray = { r: 100, g: 116, b: 139 }; // slate-500
  const hairline = { r: 226, g: 232, b: 240 }; // slate-200

  // Top accent — slim navy band with a thin accent line beneath
  doc.setFillColor(navy.r, navy.g, navy.b);
  doc.rect(0, 0, pw, 3, "F");
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.rect(0, 3, pw, 0.8, "F");
  y = 14;

  // Logo — constrained to max 22mm wide, 14mm tall so it doesn't crowd the title
  let logoW = 0;
  let logoH = 0;
  if (opts.logoUrl) {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("fail"));
        img.src = opts.logoUrl;
      });
      const ratio = img.width / img.height;
      const maxW = 22;
      const maxH = 14;
      logoW = maxW;
      logoH = logoW / ratio;
      if (logoH > maxH) {
        logoH = maxH;
        logoW = logoH * ratio;
      }
      // Place logo at top-right corner of the header area
      doc.addImage(img, "PNG", pw - m - logoW, y, logoW, logoH);
    } catch {
      /* skip */
    }
  }

  // Title (left side, independent of logo)
  const title =
    opts.type === "gerencial"
      ? "Reporte Gerencial"
      : "Reporte de Productividad";
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(navy.r, navy.g, navy.b);
  doc.text(title, m, y + 6);

  if (opts.firmName) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(midGray.r, midGray.g, midGray.b);
    doc.text(opts.firmName, m, y + 13);
  }

  const today = new Date();
  const dateStr = today.toLocaleDateString("es-CL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Date info below firm name
  doc.setFontSize(9);
  doc.setTextColor(midGray.r, midGray.g, midGray.b);
  let dateY = y + 19;
  doc.text(dateStr, m, dateY);
  if (opts.startDate && opts.endDate) {
    dateY += 5;
    doc.text(
      `${format(opts.startDate, "dd MMM yyyy", { locale: es })} — ${format(opts.endDate, "dd MMM yyyy", { locale: es })}`,
      m,
      dateY,
    );
  }

  // Move y past both the logo and the text block
  y = Math.max(y + logoH, dateY) + 8;

  doc.setDrawColor(navy.r, navy.g, navy.b);
  doc.setLineWidth(0.4);
  doc.line(m, y, pw - m, y);
  y += 10;

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
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(navy.r, navy.g, navy.b);
    doc.text(tTitle, m, y);
    y += 7;

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
      accent: { r: number; g: number; b: number };
    }>,
  ) {
    const gap = 5;
    const boxW = (pw - 2 * m - gap * (kpis.length - 1)) / kpis.length;
    const boxH = 32;

    kpis.forEach((kpi, idx) => {
      const x = m + idx * (boxW + gap);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(230, 232, 240);
      doc.roundedRect(x, y, boxW, boxH, 2, 2, "FD");
      doc.setFillColor(kpi.accent.r, kpi.accent.g, kpi.accent.b);
      doc.rect(x + 0.5, y + 0.5, boxW - 1, 2, "F");

      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(midGray.r, midGray.g, midGray.b);
      doc.text(kpi.label, x + boxW / 2, y + 11, { align: "center" });

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(navy.r, navy.g, navy.b);
      doc.text(kpi.value, x + boxW / 2, y + 20, { align: "center" });

      if (kpi.delta && kpi.delta.direction !== "neutral") {
        const isUp = kpi.delta.direction === "up";
        const clr = isUp
          ? { r: 16, g: 185, b: 129 }
          : { r: 239, g: 68, b: 68 };
        const pctText = `${isUp ? "+" : "-"}${Math.abs(kpi.delta.percent).toFixed(1)}%`;
        // Draw a small colored pill background
        const pillW = doc.getTextWidth(pctText) * 0.75 + 6;
        const pillX = x + (boxW - pillW) / 2;
        doc.setFillColor(
          isUp ? 236 : 254,
          isUp ? 253 : 226,
          isUp ? 245 : 226,
        );
        doc.roundedRect(pillX, y + 23, pillW, 5.5, 1.5, 1.5, "F");
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(clr.r, clr.g, clr.b);
        doc.text(pctText, x + boxW / 2, y + 27, { align: "center" });
      }
    });
    y += boxH + 14;
  }

  function drawInsights(insights: Insight[]) {
    if (insights.length === 0) return;
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
    doc.setFillColor(accent.r, accent.g, accent.b);
    doc.roundedRect(m + headingW + 4, y - 3.4, badgeW, 5, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.text(badge, m + headingW + 4 + badgeW / 2, y + 0.2, { align: "center" });
    y += 6;

    // Pre-measure wrapped lines to size the container
    const textW = tableWidth - 16;
    const lineH = 4.4;
    const blockGap = 3.2;
    const blocks = insights.map((ins) => {
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      return { ins, lines: doc.splitTextToSize(ins.text, textW) as string[] };
    });
    let contentH = 6;
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
    doc.setFillColor(accent.r, accent.g, accent.b);
    doc.rect(m, y, 1.5, contentH, "F");

    let iy = y + 7;
    blocks.forEach(({ ins, lines }) => {
      const tone =
        ins.tone === "positive"
          ? { r: 16, g: 185, b: 129 }
          : ins.tone === "warning"
            ? { r: 234, g: 88, b: 12 }
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
    drawKPIBoxes([
      {
        label: "Horas Totales",
        value: `${Math.round(data.totalHours).toLocaleString()}h`,
        delta: prev ? formatDelta(data.totalHours, prev.totalHours) : null,
        accent: { r: 59, g: 130, b: 246 },
      },
      {
        label: "Horas Facturables",
        value: `${data.billableHours.toFixed(1)}h`,
        delta: prev ? formatDelta(data.billableHours, prev.billableHours) : null,
        accent: { r: 16, g: 185, b: 129 },
      },
      {
        label: "Utilizacion",
        value: `${data.utilizationRate.toFixed(1)}%`,
        delta: prev ? formatDelta(data.utilizationRate, prev.utilizationRate) : null,
        accent:
          data.utilizationRate >= 100
            ? { r: 16, g: 185, b: 129 }
            : { r: 245, g: 158, b: 11 },
      },
      {
        label: "Ingresos",
        value: formatCurrency(data.totalRevenue),
        delta: prev ? formatDelta(data.totalRevenue, prev.totalRevenue) : null,
        accent: { r: 16, g: 185, b: 129 },
      },
    ]);

    drawInsights(generateIndividualInsights(data));

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
    drawKPIBoxes([
      {
        label: "Total Facturado",
        value: formatCurrency(data.totalFacturado),
        delta: prev ? formatDelta(data.totalFacturado, prev.totalFacturado) : null,
        accent: { r: 16, g: 185, b: 129 },
      },
      {
        label: "Horas Facturables",
        value: `${Math.round(data.totalHorasFacturables).toLocaleString()}h`,
        delta: prev
          ? formatDelta(data.totalHorasFacturables, prev.totalHorasFacturables)
          : null,
        accent: { r: 59, g: 130, b: 246 },
      },
      {
        label: "Clientes Activos",
        value: data.clientesUnicos.toString(),
        delta: prev ? formatDelta(data.clientesUnicos, prev.clientesUnicos) : null,
        accent: { r: 168, g: 85, b: 247 },
      },
      {
        label: "Meta Facturacion",
        value: formatCurrency(data.metaFacturacion),
        accent: { r: 245, g: 158, b: 11 },
      },
    ]);

    // Secondary KPIs
    drawKPIBoxes([
      {
        label: "Utilizacion",
        value: `${data.utilizationRate.toFixed(1)}%`,
        accent: data.utilizationRate >= 80
          ? { r: 16, g: 185, b: 129 }
          : { r: 245, g: 158, b: 11 },
      },
      {
        label: "Margen Promedio",
        value: `${data.avgMarginPercent.toFixed(1)}%`,
        accent: data.avgMarginPercent >= 30
          ? { r: 16, g: 185, b: 129 }
          : { r: 239, g: 68, b: 68 },
      },
      {
        label: "Horas Totales",
        value: `${Math.round(data.totalHours).toLocaleString()}h`,
        accent: { r: 59, g: 130, b: 246 },
      },
      {
        label: "Proyectos Activos",
        value: data.totalProjects.toString(),
        accent: { r: 168, g: 85, b: 247 },
      },
    ]);

    // Derived analytics — key ratios beyond headline KPIs
    const analytics = computeGerencialAnalytics(data);
    drawKPIBoxes([
      {
        label: "Cumplim. de Meta",
        value: data.metaFacturacion > 0 ? `${analytics.metaAttainment.toFixed(0)}%` : "—",
        accent: analytics.metaAttainment >= 100
          ? { r: 16, g: 185, b: 129 }
          : { r: 245, g: 158, b: 11 },
      },
      {
        label: "Concentr. Top 3",
        value: `${analytics.clientConcentration.toFixed(0)}%`,
        accent: analytics.clientConcentration >= 60
          ? { r: 239, g: 68, b: 68 }
          : { r: 16, g: 185, b: 129 },
      },
      {
        label: "Ingreso / Cliente",
        value: formatCurrency(analytics.avgRevenuePerClient),
        accent: { r: 45, g: 106, b: 197 },
      },
      {
        label: "Momentum Ingresos",
        value: data.monthlyRevenue.length >= 2
          ? `${analytics.revenueMomentum >= 0 ? "+" : ""}${analytics.revenueMomentum.toFixed(0)}%`
          : "—",
        accent: analytics.revenueMomentum >= 0
          ? { r: 16, g: 185, b: 129 }
          : { r: 239, g: 68, b: 68 },
      },
    ]);

    drawInsights(generateGerencialInsights(data));

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

    // Area Breakdown
    if (data.areaBreakdown.length > 0) {
      drawTable(
        "Facturacion por Area de Practica",
        ["Area", "Facturado", "Meta"],
        [3, 100, 145],
        data.areaBreakdown
          .filter((a) => a.facturacion > 0)
          .sort((a, b) => b.facturacion - a.facturacion)
          .map((a) => [
            a.area.length > 40 ? a.area.substring(0, 37) + "..." : a.area,
            formatCurrency(a.facturacion),
            formatCurrency(a.meta),
          ]),
      );
    }

    // Hours by Category
    if (data.categoryBreakdown.length > 0) {
      drawTable(
        "Horas Facturables por Categoria",
        ["Categoria", "Horas", "Profesionales"],
        [3, 100, 145],
        data.categoryBreakdown.map((c) => [
          c.category,
          `${Math.round(c.billableHours).toLocaleString()}h`,
          c.userCount.toString(),
        ]),
      );
    }

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
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reportes PDF</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Genera y descarga reportes de la firma
          </p>
        </div>

        {/* ================== GERENCIAL CARD ================== */}
        <Card className="border-border/50 overflow-hidden">
          <CardContent className="p-0">
            {/* Main row */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 p-5">
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-md">
                <Building2 className="h-7 w-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-foreground">Reporte Gerencial</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Resumen ejecutivo de facturacion, clientes y desempeno de la firma
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
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 shadow-md">
                <User className="h-7 w-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-foreground">Reporte Individual</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Reporte detallado de productividad por profesional
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
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0 shadow-md">
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
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
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
              />
            )}
          </DialogContent>
        </Dialog>

        {/* ================== INDIVIDUAL PREVIEW DIALOG ================== */}
        <Dialog open={indPreviewOpen} onOpenChange={setIndPreviewOpen}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
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
