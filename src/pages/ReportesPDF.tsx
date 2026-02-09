import { useEffect, useState, useMemo, useCallback } from "react";
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
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Download,
  Clock,
  DollarSign,
  Users,
  Briefcase,
  Activity,
  CalendarIcon,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Mail,
  Send,
  X,
  Building2,
  User,
  BarChart3,
  Target,
  Eye,
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
  const entryAny = entry as RelationalTimeEntry & { billable_hours?: number };
  return entryAny.billable_hours ?? entry.billable_hour ?? 0;
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
  topClients: Array<{
    name: string;
    hours: number;
    revenue: number;
    projects: number;
  }>;
  topProfessionals: Array<{
    name: string;
    code: string;
    revenue: number;
  }>;
  areaBreakdown: Array<{
    area: string;
    facturacion: number;
    meta: number;
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

  const topClients = clients
    .sort((a, b) => b.billable_hours - a.billable_hours)
    .slice(0, 10)
    .map((c) => ({
      name: c.client_name,
      hours: c.total_hours,
      revenue: c.billable_hours * 500,
      projects: c.project_count,
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

  return {
    clientesUnicos: dashboard.clientesUnicos,
    totalFacturado: dashboard.totalFacturado,
    totalHorasFacturables: dashboard.totalHorasFacturables || 0,
    metaFacturacion: dashboard.metaFacturacion,
    topClients,
    topProfessionals: topPros.map((p) => ({
      name: p.user_name,
      code: p.user_code,
      revenue: p.revenue,
    })),
    areaBreakdown: dashboard.facturacionPorArea.map((a) => ({
      area: a.area,
      facturacion: a.facturacion,
      meta: a.meta,
    })),
    prevPeriod,
  };
}

// ===================== SUB-COMPONENTS =====================

/** Scheduling + Recipients panel (always visible) */
function SchedulePanel({
  emails,
  setEmails,
  emailInput,
  setEmailInput,
}: {
  emails: string[];
  setEmails: (e: string[]) => void;
  emailInput: string;
  setEmailInput: (v: string) => void;
}) {
  const [frequency, setFrequency] = useState("");
  const [day, setDay] = useState("");
  const [hour, setHour] = useState("");

  const addEmail = () => {
    const trimmed = emailInput.trim();
    if (trimmed && trimmed.includes("@") && !emails.includes(trimmed)) {
      setEmails([...emails, trimmed]);
      setEmailInput("");
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Send className="h-4 w-4" />
          Programar Envio Automatico
        </CardTitle>
        <CardDescription>
          Configura el envio recurrente de este reporte por email
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Frequency / Day / Hour */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Frecuencia
            </label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="biweekly">Quincenal</SelectItem>
                <SelectItem value="monthly">Mensual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Dia de envio
            </label>
            <Select value={day} onValueChange={setDay}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monday">Lunes</SelectItem>
                <SelectItem value="tuesday">Martes</SelectItem>
                <SelectItem value="wednesday">Miercoles</SelectItem>
                <SelectItem value="thursday">Jueves</SelectItem>
                <SelectItem value="friday">Viernes</SelectItem>
                <SelectItem value="1">Dia 1 del mes</SelectItem>
                <SelectItem value="15">Dia 15 del mes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Hora de envio
            </label>
            <Select value={hour} onValueChange={setHour}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                {[
                  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00",
                  "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
                  "18:00",
                ].map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Email recipients */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            <Mail className="h-3.5 w-3.5 inline mr-1" />
            Destinatarios
          </label>
          <div className="flex gap-2">
            <Input
              placeholder="correo@ejemplo.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addEmail();
                }
              }}
              className="flex-1"
            />
            <Button variant="outline" size="sm" onClick={addEmail}>
              Agregar
            </Button>
          </div>
          {emails.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {emails.map((email) => (
                <Badge
                  key={email}
                  variant="secondary"
                  className="gap-1 pr-1"
                >
                  {email}
                  <button
                    onClick={() =>
                      setEmails(emails.filter((e) => e !== email))
                    }
                    className="ml-1 hover:bg-muted rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          {emails.length === 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Agrega los correos de los destinatarios que recibiran el reporte
            </p>
          )}
        </div>

        <Button disabled className="w-full sm:w-auto">
          <Send className="mr-2 h-4 w-4" />
          Programar Envio
        </Button>
      </CardContent>
    </Card>
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
    return (
      <div
        className={`flex items-center gap-1 mt-1 text-xs font-medium ${
          delta.direction === "up" ? "text-emerald-600" : "text-red-500"
        }`}
      >
        {delta.direction === "up" ? (
          <TrendingUp className="h-3 w-3" />
        ) : (
          <TrendingDown className="h-3 w-3" />
        )}
        <span>{Math.abs(delta.percent).toFixed(1)}% vs periodo anterior</span>
      </div>
    );
  }
  if (delta && delta.direction === "neutral") {
    return (
      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        <span>Sin cambio</span>
      </div>
    );
  }
  if (hasPeriod) {
    return (
      <p className="text-xs text-muted-foreground mt-1">Sin datos anteriores</p>
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
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {gerStats.map((stat) => (
          <Card
            key={stat.title}
            className="border-border/50"
          >
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

      {/* Top Clients */}
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {gerData.topClients.slice(0, 5).map((c) => (
              <TableRow key={c.name}>
                <TableCell className="font-medium text-sm">{c.name}</TableCell>
                <TableCell className="text-right text-sm">{Math.round(c.hours)}h</TableCell>
                <TableCell className="text-right text-sm">{c.projects}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

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
                <TableCell className="font-medium text-sm">{p.name}</TableCell>
                <TableCell className="text-right text-sm text-emerald-600 font-medium">
                  {formatCurrency(p.revenue)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
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

  const navy = { r: 26, g: 54, b: 93 };
  const gold = { r: 196, g: 164, b: 75 };
  const lightBg = { r: 248, g: 249, b: 252 };
  const midGray = { r: 120, g: 120, b: 120 };

  // Top accent
  doc.setFillColor(navy.r, navy.g, navy.b);
  doc.rect(0, 0, pw, 4, "F");
  doc.setFillColor(gold.r, gold.g, gold.b);
  doc.rect(0, 4, pw, 1.5, "F");
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
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(clr.r, clr.g, clr.b);
        doc.text(
          `${isUp ? "▲" : "▼"} ${Math.abs(kpi.delta.percent).toFixed(1)}% vs ant.`,
          x + boxW / 2,
          y + 27,
          { align: "center" },
        );
      }
    });
    y += boxH + 14;
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

    drawTable(
      "Top Clientes",
      ["Cliente", "Horas", "Proyectos"],
      [3, 110, 145],
      data.topClients.map((c) => [
        c.name.length > 50 ? c.name.substring(0, 47) + "..." : c.name,
        `${Math.round(c.hours)}h`,
        c.projects.toString(),
      ]),
    );

    drawTable(
      "Top Profesionales por Ingresos",
      ["Profesional", "Codigo", "Ingresos"],
      [3, 80, 120],
      data.topProfessionals.map((p) => [p.name, p.code, formatCurrency(p.revenue)]),
    );

    if (data.areaBreakdown.length > 0) {
      drawTable(
        "Facturacion por Area de Practica",
        ["Area", "Facturado", "Meta"],
        [3, 100, 145],
        data.areaBreakdown
          .filter((a) => a.facturacion > 0)
          .map((a) => [
            a.area.length > 40 ? a.area.substring(0, 37) + "..." : a.area,
            formatCurrency(a.facturacion),
            formatCurrency(a.meta),
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

  // Individual tab
  const [selectedProfessional, setSelectedProfessional] = useState("");
  const [indPeriod, setIndPeriod] = useState("");
  const [indStart, setIndStart] = useState<Date | undefined>();
  const [indEnd, setIndEnd] = useState<Date | undefined>();
  const [indData, setIndData] = useState<IndividualReportData | null>(null);
  const [indLoading, setIndLoading] = useState(false);
  const [indExporting, setIndExporting] = useState(false);
  const [indEmails, setIndEmails] = useState<string[]>([]);
  const [indEmailInput, setIndEmailInput] = useState("");
  const [indPreviewOpen, setIndPreviewOpen] = useState(false);

  // Gerencial tab
  const [gerPeriod, setGerPeriod] = useState("");
  const [gerStart, setGerStart] = useState<Date | undefined>();
  const [gerEnd, setGerEnd] = useState<Date | undefined>();
  const [gerData, setGerData] = useState<GerencialReportData | null>(null);
  const [gerLoading, setGerLoading] = useState(false);
  const [gerExporting, setGerExporting] = useState(false);
  const [gerEmails, setGerEmails] = useState<string[]>([]);
  const [gerEmailInput, setGerEmailInput] = useState("");
  const [gerPreviewOpen, setGerPreviewOpen] = useState(false);

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
          <Skeleton className="h-10 w-96" />
          <Skeleton className="h-40" />
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

  return (
    <DashboardLayout>
      <div className="space-y-6 w-full min-w-0 max-w-full">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reportes PDF</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Genera, descarga y programa reportes de la firma
          </p>
        </div>

        <Tabs defaultValue="gerencial" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="gerencial" className="gap-2">
              <Building2 className="h-4 w-4" />
              Reporte Gerencial
            </TabsTrigger>
            <TabsTrigger value="individual" className="gap-2">
              <User className="h-4 w-4" />
              Reporte Individual
            </TabsTrigger>
          </TabsList>

          {/* ================== GERENCIAL TAB ================== */}
          <TabsContent value="gerencial" className="space-y-6 mt-6">
            {/* Controls */}
            <Card className="border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Reporte Gerencial
                </CardTitle>
                <CardDescription>
                  Resumen ejecutivo de facturacion, clientes y desempeno de la
                  firma
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <PeriodSelector
                  periodPreset={gerPeriod}
                  setPeriodPreset={setGerPeriod}
                  startDate={gerStart}
                  setStartDate={setGerStart}
                  endDate={gerEnd}
                  setEndDate={setGerEnd}
                />
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setGerPreviewOpen(true)}
                    disabled={!gerData || gerLoading}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Vista Previa
                  </Button>
                  <Button
                    onClick={handleGerPDF}
                    disabled={!gerData || gerExporting}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {gerExporting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generando...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Descargar PDF
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Schedule + Recipients */}
            <SchedulePanel
              emails={gerEmails}
              setEmails={setGerEmails}
              emailInput={gerEmailInput}
              setEmailInput={setGerEmailInput}
            />

            {/* Gerencial Preview Dialog */}
            <Dialog open={gerPreviewOpen} onOpenChange={setGerPreviewOpen}>
              <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
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
          </TabsContent>

          {/* ================== INDIVIDUAL TAB ================== */}
          <TabsContent value="individual" className="space-y-6 mt-6">
            {/* Controls */}
            <Card className="border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Reporte Individual
                </CardTitle>
                <CardDescription>
                  Reporte detallado de productividad por profesional
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                  <div className="min-w-[220px]">
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Profesional
                    </label>
                    <Select
                      value={selectedProfessional}
                      onValueChange={setSelectedProfessional}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar profesional..." />
                      </SelectTrigger>
                      <SelectContent>
                        {usuarios.map((u) => (
                          <SelectItem key={u.code} value={u.code}>
                            {u.name} ({u.category})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <PeriodSelector
                    periodPreset={indPeriod}
                    setPeriodPreset={setIndPeriod}
                    startDate={indStart}
                    setStartDate={setIndStart}
                    endDate={indEnd}
                    setEndDate={setIndEnd}
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setIndPreviewOpen(true)}
                    disabled={!indData || indLoading}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Vista Previa
                  </Button>
                  <Button
                    onClick={handleIndPDF}
                    disabled={!indData || indExporting}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {indExporting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generando...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Descargar PDF
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Schedule + Recipients */}
            <SchedulePanel
              emails={indEmails}
              setEmails={setIndEmails}
              emailInput={indEmailInput}
              setEmailInput={setIndEmailInput}
            />

            {/* Individual Preview Dialog */}
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
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default ReportesPDF;
