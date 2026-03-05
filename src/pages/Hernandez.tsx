import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon, X, Plus, Minus, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import {
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell as TCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
// import resumenData from "@/Resumen_Agrupado.json";

// --- Data types & processing (reads from Resumen_Agrupado.json) ---

interface ResumenRecord {
  Usuario: string;
  "Categoría del usuario": string;
  "Categoría 2": string;
  "ID Cliente": number;
  Cliente: string;
  "Codigo Asunto": number;
  Asunto: string;
  "Horas Facturables": number;
  Mes: string;
  "Costo Total": number;
  "Total RACUSD": number;
  "Facturación Asunto": number;
  "Producción RAC": number;
}

const VALID_CATEGORIES = new Set([
  "1) Equity 1",
  "2) Equity 2",
  "3) Non-equity",
  "4) Consultores-Principales",
  "5) Senior",
  "6) Asociados-Contratados",
]);

// Ajuste de datos: facturación baja 16% (×0.84), costos totales suben 10% (×1.10)
const rawData = ([] as ResumenRecord[])
  .filter((r) => r.Cliente !== "VARIOS")
  .map((r) => ({
    ...r,
    "Facturación Asunto": (r["Facturación Asunto"] || 0) * 0.84,
    "Producción RAC": (r["Producción RAC"] || 0) * 0.84,
    "Costo Total": (r["Costo Total"] || 0) * 1.1,
  }));

function filterByDateRange(
  data: ResumenRecord[],
  startDate?: Date,
  endDate?: Date,
) {
  return data.filter((r) => {
    if (!r.Mes) return false;
    const [year, month] = r.Mes.split("-").map(Number);
    if (startDate) {
      const startPeriod = startDate.getFullYear() * 12 + startDate.getMonth();
      const recordPeriod = year * 12 + (month - 1);
      if (recordPeriod < startPeriod) return false;
    }
    if (endDate) {
      const endPeriod = endDate.getFullYear() * 12 + endDate.getMonth();
      const recordPeriod = year * 12 + (month - 1);
      if (recordPeriod > endPeriod) return false;
    }
    return true;
  });
}

function getClientProfitability(
  startDate?: Date,
  endDate?: Date,
  clientName?: string | null,
  userName?: string | null,
  projectId?: number | null,
) {
  let filtered = filterByDateRange(rawData, startDate, endDate);
  if (clientName) filtered = filtered.filter((r) => r.Cliente === clientName);
  if (userName) filtered = filtered.filter((r) => r.Usuario === userName);
  if (projectId != null)
    filtered = filtered.filter(
      (r) => Math.round(r["Codigo Asunto"] ?? 0) === projectId,
    );

  const clientMap = new Map<
    string,
    {
      client_name: string;
      client_code: string;
      produccion_rac: number;
      costo_total: number;
      projectMap: Map<
        number,
        {
          project_id: number;
          project_name: string;
          facturacion_asunto: number;
          produccion_rac: number;
          costo_total: number;
        }
      >;
    }
  >();

  for (const r of filtered) {
    const code = String(Math.round(r["ID Cliente"] ?? 0));
    let client = clientMap.get(code);
    if (!client) {
      client = {
        client_name: r.Cliente,
        client_code: code,
        produccion_rac: 0,
        costo_total: 0,
        projectMap: new Map(),
      };
      clientMap.set(code, client);
    }
    client.produccion_rac += r["Producción RAC"] || 0;
    client.costo_total += r["Costo Total"] || 0;

    const projectId = Math.round(r["Codigo Asunto"] ?? 0);
    let project = client.projectMap.get(projectId);
    if (!project) {
      project = {
        project_id: projectId,
        project_name: r.Asunto || `Asunto ${projectId}`,
        facturacion_asunto: r["Facturación Asunto"] || 0,
        produccion_rac: 0,
        costo_total: 0,
      };
      client.projectMap.set(projectId, project);
    }
    project.produccion_rac += r["Producción RAC"] || 0;
    project.costo_total += r["Costo Total"] || 0;
  }

  return Array.from(clientMap.values())
    .map((c) => {
      const projects = Array.from(c.projectMap.values())
        .map((p) => {
          const facturacion = p.facturacion_asunto + p.produccion_rac;
          const pm = facturacion - p.costo_total;
          return {
            project_id: p.project_id,
            project_name: p.project_name,
            facturacion,
            costo_total: p.costo_total,
            margen_percent: facturacion > 0 ? (pm / facturacion) * 100 : 0,
          };
        })
        .sort((a, b) => b.facturacion - a.facturacion);
      const facturacion = projects.reduce((s, p) => s + p.facturacion, 0);
      const margen = facturacion - c.costo_total;
      const margen_percent = facturacion > 0 ? (margen / facturacion) * 100 : 0;
      return {
        client_name: c.client_name,
        client_code: c.client_code,
        facturacion,
        costo_total: c.costo_total,
        margen,
        margen_percent,
        projects,
      };
    })
    .sort((a, b) => b.facturacion - a.facturacion);
}

function getCategoryBillableHours(
  startDate?: Date,
  endDate?: Date,
  clientName?: string | null,
  projectId?: number | null,
) {
  let filtered = filterByDateRange(rawData, startDate, endDate);
  if (clientName) filtered = filtered.filter((r) => r.Cliente === clientName);
  if (projectId != null)
    filtered = filtered.filter(
      (r) => Math.round(r["Codigo Asunto"] ?? 0) === projectId,
    );

  const categoryMap = new Map<
    string,
    {
      category: string;
      billable_hours: number;
      userMap: Map<
        string,
        { name: string; code: string; billable_hours: number }
      >;
    }
  >();

  for (const r of filtered) {
    const cat = r["Categoría 2"];
    if (!cat || !VALID_CATEGORIES.has(cat)) continue;

    let category = categoryMap.get(cat);
    if (!category) {
      category = { category: cat, billable_hours: 0, userMap: new Map() };
      categoryMap.set(cat, category);
    }
    const hours = r["Horas Facturables"] || 0;
    category.billable_hours += hours;

    const uName = r.Usuario;
    let u = category.userMap.get(uName);
    if (!u) {
      u = { name: uName, code: uName, billable_hours: 0 };
      category.userMap.set(uName, u);
    }
    u.billable_hours += hours;
  }

  return Array.from(categoryMap.values())
    .filter((c) => c.billable_hours > 0)
    .map((c) => ({
      category: c.category.replace(/^\d+\)\s*/, ""),
      _order: c.category,
      billable_hours: c.billable_hours,
      users: Array.from(c.userMap.values()).sort(
        (a, b) => b.billable_hours - a.billable_hours,
      ),
    }))
    .sort((a, b) => a._order.localeCompare(b._order));
}

// --- Component ---

const Hernandez = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [dataLoading, setDataLoading] = useState(true);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<
    string | null
  >(null);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>(
    new Date(2025, 0, 1),
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    new Date(2025, 11, 31),
  );

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  // All clients (always unfiltered, for the table)
  const allClientsData = useMemo(() => {
    return getClientProfitability(startDate, endDate);
  }, [startDate, endDate]);

  // Resolve selected client name from code
  const selectedClientName = useMemo(() => {
    if (!selectedClient) return null;
    const found = allClientsData.find((c) => c.client_code === selectedClient);
    return found?.client_name ?? null;
  }, [selectedClient, allClientsData]);

  // Resolve selected project name from allClientsData
  const selectedProjectName = useMemo(() => {
    if (selectedProject == null) return null;
    for (const c of allClientsData) {
      const found = c.projects.find((p) => p.project_id === selectedProject);
      if (found) return found.project_name;
    }
    return null;
  }, [selectedProject, allClientsData]);

  // Filtered data for KPIs, chart, categories (reacts to selectedClient + selectedProfessional + selectedProject)
  const filteredClientsData = useMemo(() => {
    return getClientProfitability(
      startDate,
      endDate,
      selectedClientName,
      selectedProfessional,
      selectedProject,
    );
  }, [
    startDate,
    endDate,
    selectedClientName,
    selectedProfessional,
    selectedProject,
  ]);

  const categoryHours = useMemo(() => {
    return getCategoryBillableHours(
      startDate,
      endDate,
      selectedClientName,
      selectedProject,
    );
  }, [startDate, endDate, selectedClientName, selectedProject]);

  // Simulate loading
  useEffect(() => {
    if (user) {
      setDataLoading(true);
      const timer = setTimeout(() => setDataLoading(false), 400);
      return () => clearTimeout(timer);
    }
  }, [user, startDate, endDate]);

  // Totals (from filtered data)
  const totals = useMemo(() => {
    const facturacion = filteredClientsData.reduce(
      (s, c) => s + c.facturacion,
      0,
    );
    const costo = filteredClientsData.reduce((s, c) => s + c.costo_total, 0);
    const margen = facturacion - costo;
    const margenPercent = facturacion > 0 ? (margen / facturacion) * 100 : 0;
    return { facturacion, costo, margen, margenPercent };
  }, [filteredClientsData]);

  const totalCategoryHours = useMemo(() => {
    return categoryHours.reduce((s, c) => s + c.billable_hours, 0);
  }, [categoryHours]);

  // Chart data: single row with facturacion + costo as separate bars
  const chartTotalsData = useMemo(() => {
    return [
      {
        name: "Total",
        facturacion: Math.round(totals.facturacion),
        costo: Math.round(totals.costo),
        margen_pct: Math.round(totals.margenPercent * 10) / 10,
      },
    ];
  }, [totals]);

  if (loading || dataLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-[400px]" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) return null;

  const formatCurrency = (value: number) =>
    `$${Math.round(value).toLocaleString()}`;

  const formatMargin = (value: number) => {
    const formatted = value.toFixed(1);
    return `${formatted} %`;
  };

  const handleClientRowClick = (clientCode: string) => {
    // Toggle filter: if already selected, deselect
    setSelectedClient((prev) => (prev === clientCode ? null : clientCode));
  };

  const handleExpandClick = (e: React.MouseEvent, clientCode: string) => {
    e.stopPropagation(); // Don't trigger filter
    setExpandedClient((prev) => (prev === clientCode ? null : clientCode));
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 w-full min-w-0 max-w-full overflow-x-hidden">
        {/* Header */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Resumen Clientes
              </h1>
              <p className="text-muted-foreground">
                Rentabilidad por cliente y desglose por proyecto
              </p>
            </div>
          </div>

          {/* Date Filters - commented out for now
          <div className="flex flex-wrap gap-3 items-center">
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              Filtrar por fecha:
            </span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`justify-start text-left font-normal ${
                    !startDate && "text-muted-foreground"
                  }`}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                  {startDate ? (
                    <span className="truncate">
                      {format(startDate, "dd/MM/yyyy")}
                    </span>
                  ) : (
                    <span>Fecha inicio</span>
                  )}
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
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`justify-start text-left font-normal ${
                    !endDate && "text-muted-foreground"
                  }`}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                  {endDate ? (
                    <span className="truncate">
                      {format(endDate, "dd/MM/yyyy")}
                    </span>
                  ) : (
                    <span>Fecha fin</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                  locale={es}
                  disabled={(date) =>
                    startDate ? date < startDate : false
                  }
                />
              </PopoverContent>
            </Popover>
            {(startDate || endDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStartDate(undefined);
                  setEndDate(undefined);
                }}
                className="h-9 px-2"
              >
                <X className="h-4 w-4 mr-1" />
                Limpiar fechas
              </Button>
            )}
          </div>
          */}
        </div>

        {/* Active Filters */}
        {(selectedClient ||
          selectedProfessional ||
          selectedProject != null) && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground">
              Filtros activos:
            </span>
            {selectedClient && selectedClientName && (
              <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-sm">
                <span>Cliente: {selectedClientName}</span>
                <button
                  onClick={() => setSelectedClient(null)}
                  className="ml-1 hover:bg-primary/20 rounded p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {selectedProfessional && (
              <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-sm">
                <span>Profesional: {selectedProfessional}</span>
                <button
                  onClick={() => setSelectedProfessional(null)}
                  className="ml-1 hover:bg-primary/20 rounded p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {selectedProject != null && selectedProjectName && (
              <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-sm">
                <span>Proyecto: {selectedProjectName}</span>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="ml-1 hover:bg-primary/20 rounded p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedClient(null);
                setSelectedProfessional(null);
                setSelectedProject(null);
              }}
              className="h-8 text-xs"
            >
              Limpiar filtros
            </Button>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-border/50 border-l-[3px] border-l-blue-500/70 bg-gradient-to-br from-blue-50/40 to-transparent dark:from-blue-950/20 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Facturación
              </p>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(totals.facturacion)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/50 border-l-[3px] border-l-emerald-500/70 bg-gradient-to-br from-emerald-50/40 to-transparent dark:from-emerald-950/20 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Costo Total
              </p>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(totals.costo)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/50 border-l-[3px] border-l-orange-500/70 bg-gradient-to-br from-orange-50/40 to-transparent dark:from-orange-950/20 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Margen
              </p>
              <p
                className={`text-2xl font-bold ${totals.margen < 0 ? "text-red-600" : "text-foreground"}`}
              >
                {formatCurrency(totals.margen)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/50 border-l-[3px] border-l-violet-500/70 bg-gradient-to-br from-violet-50/40 to-transparent dark:from-violet-950/20 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                % Margen
              </p>
              <p
                className={`text-2xl font-bold ${totals.margenPercent < 0 ? "text-red-600" : "text-foreground"}`}
              >
                {formatMargin(totals.margenPercent)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content: Client Table + Right Sidebar */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Client Table */}
          <Card className="flex-1 border-border/50 w-full min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-foreground text-base">
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div
                className="overflow-y-auto rounded-md"
                style={{ maxHeight: "500px" }}
              >
                <Table>
                  <TableHeader>
                    <TableRow className="border-b">
                      <TableHead className="h-8 px-1 text-[10px] font-semibold w-[28px]" />
                      <TableHead className="h-8 px-1 text-[10px] font-semibold">
                        Cliente
                      </TableHead>
                      <TableHead className="h-8 px-1 text-[10px] font-semibold text-right">
                        Facturación
                      </TableHead>
                      <TableHead className="h-8 px-1 text-[10px] font-semibold text-right">
                        Costo Total
                      </TableHead>
                      <TableHead className="h-8 px-1 text-[10px] font-semibold text-right">
                        % Margen
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allClientsData.map((client) => {
                      const isExpanded = expandedClient === client.client_code;
                      const isSelected = selectedClient === client.client_code;
                      return (
                        <>
                          <TableRow
                            key={client.client_code}
                            className={`border-b h-7 cursor-pointer transition-all duration-150 ${
                              isSelected
                                ? "bg-primary/15 font-semibold"
                                : "hover:bg-muted/50"
                            }`}
                            onClick={() =>
                              handleClientRowClick(client.client_code)
                            }
                          >
                            <TCell className="px-1 py-0.5 w-[28px]">
                              <button
                                onClick={(e) =>
                                  handleExpandClick(e, client.client_code)
                                }
                                className={`flex items-center justify-center w-4 h-4 rounded border transition-colors ${
                                  isExpanded
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-muted-foreground/40 text-muted-foreground hover:border-primary hover:text-primary"
                                }`}
                              >
                                {isExpanded ? (
                                  <Minus className="h-2.5 w-2.5" />
                                ) : (
                                  <Plus className="h-2.5 w-2.5" />
                                )}
                              </button>
                            </TCell>
                            <TCell className="px-1 py-0.5 text-[11px] truncate max-w-[250px]">
                              {client.client_name}
                            </TCell>
                            <TCell
                              className={`px-1 py-0.5 text-[11px] text-right font-medium ${client.facturacion < 0 ? "text-red-600" : ""}`}
                            >
                              {Math.round(client.facturacion).toLocaleString()}
                            </TCell>
                            <TCell
                              className={`px-1 py-0.5 text-[11px] text-right font-medium ${client.costo_total < 0 ? "text-red-600" : ""}`}
                            >
                              {Math.round(client.costo_total).toLocaleString()}
                            </TCell>
                            <TCell
                              className={`px-1 py-0.5 text-[11px] text-right font-medium ${
                                client.margen_percent < 0 ? "text-red-600" : ""
                              }`}
                            >
                              {client.margen_percent.toFixed(1)} %
                            </TCell>
                          </TableRow>
                          {isExpanded &&
                            client.projects.map((project) => (
                              <TableRow
                                key={`${client.client_code}-${project.project_id}`}
                                className={`border-b h-7 cursor-pointer transition-all duration-150 ${
                                  selectedProject === project.project_id
                                    ? "bg-primary/15 font-semibold"
                                    : "bg-muted/30 hover:bg-muted/50"
                                }`}
                                onClick={() =>
                                  setSelectedProject((prev) =>
                                    prev === project.project_id
                                      ? null
                                      : project.project_id,
                                  )
                                }
                              >
                                <TCell className="px-1 py-0.5 text-[10px]" />
                                <TCell className="px-1 py-0.5 text-[10px] pl-6 truncate max-w-[250px] text-muted-foreground">
                                  {project.project_name}
                                </TCell>
                                <TCell
                                  className={`px-1 py-0.5 text-[10px] text-right ${project.facturacion < 0 ? "text-red-500" : "text-muted-foreground"}`}
                                >
                                  {Math.round(
                                    project.facturacion,
                                  ).toLocaleString()}
                                </TCell>
                                <TCell
                                  className={`px-1 py-0.5 text-[10px] text-right ${project.costo_total < 0 ? "text-red-500" : "text-muted-foreground"}`}
                                >
                                  {Math.round(
                                    project.costo_total,
                                  ).toLocaleString()}
                                </TCell>
                                <TCell
                                  className={`px-1 py-0.5 text-[10px] text-right ${
                                    project.margen_percent < 0
                                      ? "text-red-500"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {project.margen_percent.toFixed(1)} %
                                </TCell>
                              </TableRow>
                            ))}
                        </>
                      );
                    })}
                    {/* Total Row */}
                    <TableRow className="border-t-2 h-8 font-bold bg-muted/20">
                      <TCell className="px-1 py-1 text-[11px]" />
                      <TCell className="px-1 py-1 text-[11px] font-bold">
                        Total
                      </TCell>
                      <TCell className="px-1 py-1 text-[11px] text-right font-bold">
                        {Math.round(
                          allClientsData.reduce((s, c) => s + c.facturacion, 0),
                        ).toLocaleString()}
                      </TCell>
                      <TCell className="px-1 py-1 text-[11px] text-right font-bold">
                        {Math.round(
                          allClientsData.reduce((s, c) => s + c.costo_total, 0),
                        ).toLocaleString()}
                      </TCell>
                      <TCell className="px-1 py-1 text-[11px] text-right font-bold">
                        {(() => {
                          const f = allClientsData.reduce(
                            (s, c) => s + c.facturacion,
                            0,
                          );
                          const co = allClientsData.reduce(
                            (s, c) => s + c.costo_total,
                            0,
                          );
                          const pct = f > 0 ? ((f - co) / f) * 100 : 0;
                          return (
                            <span className={pct < 0 ? "text-red-600" : ""}>
                              {pct.toFixed(1)} %
                            </span>
                          );
                        })()}
                      </TCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Right Sidebar: Category + Chart */}
          <div className="w-full lg:w-[400px] lg:flex-shrink-0 flex flex-col gap-4">
            {/* Category Breakdown (expandable) */}
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-foreground text-base">
                  Categoría
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b">
                      <TableHead className="h-7 px-1 text-[10px] font-semibold w-[20px]" />
                      <TableHead className="h-7 px-1 text-[10px] font-semibold">
                        Categoría
                      </TableHead>
                      <TableHead className="h-7 px-1 text-[10px] font-semibold text-right">
                        Horas Facturables
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryHours.map((cat, index) => {
                      const isCatExpanded = expandedCategory === cat.category;
                      return (
                        <>
                          <TableRow
                            key={cat.category}
                            className={`border-b h-7 cursor-pointer transition-all duration-150 ${
                              isCatExpanded
                                ? "bg-primary/10 font-semibold"
                                : "hover:bg-muted/50"
                            }`}
                            onClick={() =>
                              setExpandedCategory(
                                isCatExpanded ? null : cat.category,
                              )
                            }
                          >
                            <TCell className="px-1 py-0.5 w-[20px]">
                              <button
                                className={`flex items-center justify-center w-4 h-4 rounded border transition-colors ${
                                  isCatExpanded
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-muted-foreground/40 text-muted-foreground hover:border-primary hover:text-primary"
                                }`}
                              >
                                {isCatExpanded ? (
                                  <Minus className="h-2.5 w-2.5" />
                                ) : (
                                  <Plus className="h-2.5 w-2.5" />
                                )}
                              </button>
                            </TCell>
                            <TCell className="px-1 py-0.5 text-[11px]">
                              {index + 1}) {cat.category}
                            </TCell>
                            <TCell className="px-1 py-0.5 text-[11px] text-right font-medium">
                              {Math.round(cat.billable_hours).toLocaleString()}
                            </TCell>
                          </TableRow>
                          {isCatExpanded &&
                            cat.users.map((u) => (
                              <TableRow
                                key={`${cat.category}-${u.name}`}
                                className={`border-b h-7 cursor-pointer transition-all duration-150 ${
                                  selectedProfessional === u.name
                                    ? "bg-primary/15 font-semibold"
                                    : "bg-muted/30 hover:bg-muted/50"
                                }`}
                                onClick={() =>
                                  setSelectedProfessional((prev) =>
                                    prev === u.name ? null : u.name,
                                  )
                                }
                              >
                                <TCell className="px-1 py-0.5 text-[10px]" />
                                <TCell className="px-1 py-0.5 text-[10px] pl-6 text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    {u.name}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/user/${u.code}`);
                                      }}
                                      className="text-muted-foreground/50 hover:text-primary transition-colors"
                                      title="Ver perfil"
                                    >
                                      <Info className="h-3 w-3" />
                                    </button>
                                  </span>
                                </TCell>
                                <TCell className="px-1 py-0.5 text-[10px] text-right text-muted-foreground">
                                  {Math.round(
                                    u.billable_hours,
                                  ).toLocaleString()}
                                </TCell>
                              </TableRow>
                            ))}
                        </>
                      );
                    })}
                    <TableRow className="border-t-2 h-8 font-bold bg-muted/20">
                      <TCell className="px-1 py-1 text-[11px]" />
                      <TCell className="px-1 py-1 text-[11px] font-bold">
                        Total
                      </TCell>
                      <TCell className="px-1 py-1 text-[11px] text-right font-bold">
                        {Math.round(totalCategoryHours).toLocaleString()}
                      </TCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Facturación vs Costo Total Chart */}
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-foreground text-sm">
                  Facturación, Costo Total, y % Margen
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-2">
                <ChartContainer
                  config={{
                    facturacion: { label: "Facturación" },
                    costo: { label: "Costo Total" },
                  }}
                >
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart
                      data={chartTotalsData}
                      margin={{
                        top: 10,
                        right: 50,
                        left: 0,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis
                        yAxisId="left"
                        tick={{ fontSize: 9 }}
                        width={55}
                        tickFormatter={(value) => {
                          const millions = value / 1000000;
                          return millions % 1 === 0
                            ? `$${millions}M`
                            : `$${millions.toFixed(1)}M`;
                        }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 9 }}
                        width={40}
                        domain={[0, 100]}
                        tickFormatter={(value) => `${value}%`}
                      />
                      <ChartTooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const d = payload[0]?.payload;
                            return (
                              <div className="rounded-lg border bg-background p-2 shadow-sm text-xs space-y-1">
                                <p>
                                  <span className="font-medium">
                                    Facturación:
                                  </span>{" "}
                                  ${Number(d?.facturacion).toLocaleString()}
                                </p>
                                <p>
                                  <span className="font-medium">
                                    Costo Total:
                                  </span>{" "}
                                  ${Number(d?.costo).toLocaleString()}
                                </p>
                                <p>
                                  <span
                                    className="font-medium"
                                    style={{ color: "hsl(25 95% 53%)" }}
                                  >
                                    Margen:
                                  </span>{" "}
                                  {d?.margen_pct}%
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="facturacion"
                        fill="hsl(var(--chart-4))"
                        radius={[4, 4, 0, 0]}
                        barSize={60}
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="costo"
                        fill="hsl(var(--chart-7))"
                        radius={[4, 4, 0, 0]}
                        barSize={60}
                      />
                      <ReferenceLine
                        yAxisId="right"
                        y={Math.round(totals.margenPercent * 10) / 10}
                        stroke="hsl(25 95% 53%)"
                        strokeWidth={2}
                        strokeDasharray="6 3"
                        label={{
                          value: `${totals.margenPercent.toFixed(1)}%`,
                          position: "right",
                          fontSize: 11,
                          fontWeight: 600,
                          fill: "hsl(25 95% 53%)",
                          dx: -40,
                          dy: -12,
                        }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartContainer>
                <div className="flex justify-center gap-4 mt-1 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{ background: "hsl(var(--chart-4))" }}
                    />
                    Facturación
                  </div>
                  <div className="flex items-center gap-1">
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{ background: "hsl(var(--chart-7))" }}
                    />
                    Costo Total
                  </div>
                  <div className="flex items-center gap-1">
                    <div
                      className="w-3 h-0 rounded-sm"
                      style={{ borderTop: "2px dashed hsl(25 95% 53%)" }}
                    />
                    Margen %
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Hernandez;
