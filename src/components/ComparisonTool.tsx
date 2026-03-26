import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Users,
  Scale,
  FolderKanban,
  DollarSign,
  Clock,
  BarChart3,
  TrendingUp,
  Target,
  Percent,
  Plus,
  X,
  Check,
  ChevronsUpDown,
  Zap,
} from "lucide-react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  getClientCosts,
  getProjectCosts,
  getUsuarios,
  getUserProfileData,
  getTransformedTimeEntries,
} from "@/lib/mockDataUtils";
import { cn } from "@/lib/utils";
import facturacionData from "@/lib/mock/facturacion.json";
import clientesData from "@/lib/mock/clientes.json";
import asuntosData from "@/lib/mock/asuntos.json";
import type { Payment, Cliente, Asunto } from "@/lib/mock/types";

type ComparisonMode = "clients" | "lawyers" | "projects";

const ENTITY_COLORS = [
  "hsl(210, 55%, 45%)",
  "hsl(340, 55%, 50%)",
  "hsl(160, 55%, 40%)",
  "hsl(25, 70%, 50%)",
];

const ENTITY_BG_COLORS = [
  "bg-blue-500/10 border-blue-500/30",
  "bg-pink-500/10 border-pink-500/30",
  "bg-emerald-500/10 border-emerald-500/30",
  "bg-amber-500/10 border-amber-500/30",
];

const ENTITY_TEXT_COLORS = [
  "text-blue-600 dark:text-blue-400",
  "text-pink-600 dark:text-pink-400",
  "text-emerald-600 dark:text-emerald-400",
  "text-amber-600 dark:text-amber-400",
];

const ENTITY_DOT_COLORS = [
  "bg-blue-500",
  "bg-pink-500",
  "bg-emerald-500",
  "bg-amber-500",
];

const MAX_ENTITIES = 4;
const MIN_ENTITIES = 2;

const ComparisonTool = () => {
  const [mode, setMode] = useState<ComparisonMode>("clients");
  const [selectedIds, setSelectedIds] = useState<string[]>(["", ""]);
  const [openPopovers, setOpenPopovers] = useState<boolean[]>([false, false]);

  // Get data based on mode
  const clientsCompData = useMemo(() => {
    const clients = getClientCosts(new Date(2025, 0, 1), new Date(2025, 11, 31));
    const facturacion = facturacionData as Payment[];
    const clientes = clientesData as Cliente[];

    const clienteIdToNameMap = new Map<number, string>();
    clientes.forEach((c) => {
      if (c.name) clienteIdToNameMap.set(c.id, c.name);
    });

    const clientRevenueMap = new Map<string, number>();
    facturacion.forEach((payment) => {
      if (!payment.month || !payment.cliente_id) return;
      const date = new Date(payment.month + "T00:00:00");
      if (date < new Date(2025, 0, 1) || date > new Date(2025, 11, 31)) return;
      const clientName = clienteIdToNameMap.get(payment.cliente_id);
      if (!clientName) return;
      clientRevenueMap.set(clientName, (clientRevenueMap.get(clientName) || 0) + (payment.amount_charged || 0));
    });

    return clients
      .map((client) => {
        const revenue = clientRevenueMap.get(client.client_name) || client.total_cost;
        const billableHours = client.billable_hours ?? 0;
        const nonBillableHours = client.total_hours - billableHours;
        const margin = revenue > 0 ? ((revenue - client.total_cost) / revenue) * 100 : 0;
        const rate = billableHours > 0 ? revenue / billableHours : 0;
        return {
          id: client.client_name,
          name: client.client_name,
          hours: client.total_hours,
          billableHours,
          nonBillableHours,
          cost: client.total_cost,
          revenue,
          margin,
          rate,
          projects: client.project_count,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, []);

  const lawyersCompData = useMemo(() => {
    const usuarios = getUsuarios();
    const allEntries = getTransformedTimeEntries(new Date(2025, 0, 1), new Date(2025, 11, 31));
    return usuarios
      .map((usuario) => {
        const profileData = getUserProfileData(usuario.code, new Date(2025, 0, 1), new Date(2025, 11, 31));
        // Compute billable/non-billable from raw entries
        const userEntries = allEntries.filter((e) => e.user_id === usuario.id);
        const billableHours = userEntries.reduce((sum, e) => sum + (e.billable_duration || 0), 0);
        const totalHours = profileData?.total_hours || 0;
        const nonBillableHours = totalHours - billableHours;
        return {
          id: usuario.code,
          name: usuario.name,
          code: usuario.code,
          category: usuario.category,
          practiceArea: usuario.practice_area,
          hours: totalHours,
          billableHours,
          nonBillableHours,
          revenue: profileData?.total_revenue || 0,
          cost: profileData?.total_cost || 0,
          projects: profileData?.projects.length || 0,
          clients: profileData?.clients.length || 0,
          utilization: totalHours > 0 ? (billableHours / totalHours) * 100 : 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, []);

  const projectsCompData = useMemo(() => {
    const projects = getProjectCosts(new Date(2025, 0, 1), new Date(2025, 11, 31));
    const facturacion = facturacionData as Payment[];
    const asuntos = asuntosData as Asunto[];

    const asuntoMap = new Map<number, Asunto>();
    asuntos.forEach((a) => asuntoMap.set(a.id, a));

    const projectRevenueMap = new Map<number, number>();
    facturacion.forEach((payment) => {
      if (!payment.month || !payment.asunto_id) return;
      const date = new Date(payment.month + "T00:00:00");
      if (date < new Date(2025, 0, 1) || date > new Date(2025, 11, 31)) return;
      projectRevenueMap.set(payment.asunto_id, (projectRevenueMap.get(payment.asunto_id) || 0) + (payment.amount_charged || 0));
    });

    return projects
      .map((project) => {
        const revenue = projectRevenueMap.get(project.project_id) || project.total_cost;
        const billableHours = project.billable_hours ?? 0;
        const nonBillableHours = project.total_hours - billableHours;
        const margin = revenue > 0 ? ((revenue - project.total_cost) / revenue) * 100 : 0;
        const rate = billableHours > 0 ? revenue / billableHours : 0;
        const asunto = asuntoMap.get(project.project_id);
        return {
          id: project.project_id.toString(),
          name: project.project_name,
          clientName: project.client_name,
          practiceArea: asunto?.practice_area || null,
          projectType: asunto?.project_type || null,
          hours: project.total_hours,
          billableHours,
          nonBillableHours,
          cost: project.total_cost,
          revenue,
          margin,
          rate,
          projects: 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, []);

  const entities = mode === "clients" ? clientsCompData : mode === "lawyers" ? lawyersCompData : projectsCompData;

  // Pre-select top 2 entities when mode changes or on first load
  const effectiveIds = useMemo(() => {
    const ids = [...selectedIds];
    let changed = false;
    for (let i = 0; i < ids.length; i++) {
      if (!ids[i] && entities.length > i) {
        ids[i] = entities[i].id;
        changed = true;
      }
    }
    if (changed) return ids;
    return selectedIds;
  }, [selectedIds, entities]);

  // Sync effective IDs back
  if (effectiveIds !== selectedIds && effectiveIds.some((id, i) => id !== selectedIds[i])) {
    setSelectedIds(effectiveIds);
  }

  const selectedEntities = effectiveIds.map((id) => entities.find((e) => e.id === id) || null);

  const addEntity = () => {
    if (selectedIds.length < MAX_ENTITIES) {
      // Find next unused entity
      const usedIds = new Set(selectedIds);
      const nextEntity = entities.find((e) => !usedIds.has(e.id));
      setSelectedIds([...selectedIds, nextEntity?.id || ""]);
      setOpenPopovers([...openPopovers, false]);
    }
  };

  const removeEntity = (index: number) => {
    if (selectedIds.length > MIN_ENTITIES) {
      setSelectedIds(selectedIds.filter((_, i) => i !== index));
      setOpenPopovers(openPopovers.filter((_, i) => i !== index));
    }
  };

  const setEntityId = (index: number, id: string) => {
    const next = [...selectedIds];
    next[index] = id;
    setSelectedIds(next);
  };

  const setPopoverOpen = (index: number, open: boolean) => {
    const next = [...openPopovers];
    next[index] = open;
    setOpenPopovers(next);
  };

  // Format helpers
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      const millions = value / 1000000;
      return `$${millions % 1 === 0 ? millions : millions.toFixed(1)}M`;
    }
    if (value >= 1000) {
      const thousands = value / 1000;
      return `$${thousands % 1 === 0 ? thousands : thousands.toFixed(0)}k`;
    }
    return `$${Math.round(value)}`;
  };

  const formatNumber = (value: number) => Math.round(value).toLocaleString();

  // Metrics definition per mode
  const getMetrics = () => {
    const base = [
      { key: "hours", label: "Horas Totales", format: "number" as const, icon: Clock },
      { key: "revenue", label: "Facturación", format: "currency" as const, icon: DollarSign },
      { key: "cost", label: "Costo Total", format: "currency" as const, icon: BarChart3 },
    ];
    if (mode === "clients" || mode === "projects") {
      base.push(
        { key: "margin", label: "Margen", format: "percentage" as const, icon: Percent },
        { key: "rate", label: "Tarifa Prom.", format: "rate" as const, icon: Target },
      );
    }
    if (mode !== "projects") {
      base.push({ key: "projects", label: "Proyectos", format: "number" as const, icon: FolderKanban });
    }
    if (mode === "lawyers") {
      base.push(
        { key: "utilization", label: "Utilización", format: "percentage" as const, icon: Zap },
        { key: "clients", label: "Clientes", format: "number" as const, icon: Users },
      );
    }
    return base;
  };

  const metrics = getMetrics();

  const formatMetricValue = (value: number, format: string) => {
    if (format === "currency") return formatCurrency(value);
    if (format === "percentage") return `${value.toFixed(1)}%`;
    if (format === "rate") return value >= 1000 ? `$${(value / 1000).toFixed(1)}k/h` : `$${Math.round(value)}/h`;
    return formatNumber(value);
  };

  // Radar chart data
  const radarData = useMemo(() => {
    const validEntities = selectedEntities.filter(Boolean);
    if (validEntities.length < 2) return [];

    const radarMetrics = metrics.filter((m) => ["hours", "revenue", "cost", "margin", "projects", "utilization", "clients"].includes(m.key));

    return radarMetrics.map((metric) => {
      const values = validEntities.map((e) => (e as any)?.[metric.key] || 0);
      const maxVal = Math.max(...values, 1);
      const entry: any = { metric: metric.label };
      validEntities.forEach((e, i) => {
        entry[`entity${i}`] = ((values[i] / maxVal) * 100);
      });
      return entry;
    });
  }, [selectedEntities, metrics]);

  // Revenue vs Cost chart data — one row per metric, each entity as its own key
  const revCostData = useMemo(() => {
    const validEntities = selectedEntities.filter(Boolean);
    if (validEntities.length < 2) return [];

    const revenue: any = { metric: "Facturación" };
    const cost: any = { metric: "Costo" };
    const margin: any = { metric: "Margen %" };
    validEntities.forEach((e, i) => {
      revenue[`e${i}`] = (e as any)?.revenue || 0;
      cost[`e${i}`] = e!.cost;
      margin[`e${i}`] = (e as any)?.margin || 0;
    });
    return [revenue, cost];
  }, [selectedEntities]);

  // Hours chart data — one row per entity with billable / non-billable
  const hoursData = useMemo(() => {
    const validEntities = selectedEntities.filter(Boolean);
    if (validEntities.length < 2) return [];

    return validEntities.map((e, i) => {
      const billable = (e as any).billableHours ?? 0;
      const nonBillable = (e as any).nonBillableHours ?? Math.max(0, e!.hours - billable);
      const pctBillable = e!.hours > 0 ? (billable / e!.hours) * 100 : 0;
      return {
        name: e!.name.length > 18 ? e!.name.substring(0, 18) + "…" : e!.name,
        fullName: e!.name,
        billable,
        nonBillable,
        total: e!.hours,
        pctBillable,
        color: ENTITY_COLORS[i],
        dotColor: ENTITY_DOT_COLORS[i],
        idx: i,
      };
    });
  }, [selectedEntities]);

  const validCount = selectedEntities.filter(Boolean).length;

  // Chart configs
  const radarChartConfig: ChartConfig = {};
  selectedEntities.forEach((e, i) => {
    if (e) {
      radarChartConfig[`entity${i}`] = {
        label: e.name,
        color: ENTITY_COLORS[i],
      };
    }
  });

  const revCostChartConfig: ChartConfig = {};
  selectedEntities.forEach((e, i) => {
    if (e) {
      revCostChartConfig[`e${i}`] = { label: e.name, color: ENTITY_COLORS[i] };
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Comparación</h1>
        <p className="text-muted-foreground">
          Compara métricas de rendimiento entre clientes, abogados o asuntos
        </p>
      </div>

      {/* Mode Selector */}
      <Tabs
        value={mode}
        onValueChange={(v) => {
          setMode(v as ComparisonMode);
          setSelectedIds(["", ""]);
          setOpenPopovers([false, false]);
        }}
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="clients">
            <Users className="h-4 w-4 mr-2" />
            Clientes
          </TabsTrigger>
          <TabsTrigger value="lawyers">
            <Scale className="h-4 w-4 mr-2" />
            Abogados
          </TabsTrigger>
          <TabsTrigger value="projects">
            <FolderKanban className="h-4 w-4 mr-2" />
            Asuntos
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Entity Selectors */}
      <div className="flex flex-wrap gap-3 items-end">
        {selectedIds.map((entityId, index) => (
          <div key={index} className={`flex-1 min-w-[200px] max-w-[300px]`}>
            <div className="flex items-center gap-2 mb-1.5">
              <div className={`h-2.5 w-2.5 rounded-full ${ENTITY_DOT_COLORS[index]}`} />
              <label className="text-xs font-medium text-muted-foreground">
                {mode === "clients" ? "Cliente" : mode === "lawyers" ? "Abogado" : "Asunto"} {index + 1}
              </label>
              {selectedIds.length > MIN_ENTITIES && (
                <button
                  onClick={() => removeEntity(index)}
                  className="ml-auto text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Popover open={openPopovers[index]} onOpenChange={(o) => setPopoverOpen(index, o)}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className={cn(
                    "w-full justify-between h-9 text-sm",
                    entityId && `border-l-2`,
                  )}
                  style={entityId ? { borderLeftColor: ENTITY_COLORS[index] } : undefined}
                >
                  <span className="truncate">
                    {entityId
                      ? entities.find((e) => e.id === entityId)?.name
                      : "Seleccionar..."}
                  </span>
                  <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0">
                <Command>
                  <CommandInput placeholder="Buscar..." />
                  <CommandList className="max-h-[250px]">
                    <CommandEmpty>Sin resultados.</CommandEmpty>
                    <CommandGroup>
                      {entities.map((entity) => {
                        const usedByOther = selectedIds.some((id, i) => i !== index && id === entity.id);
                        return (
                          <CommandItem
                            key={entity.id}
                            value={entity.name}
                            disabled={usedByOther}
                            onSelect={() => {
                              setEntityId(index, entity.id);
                              setPopoverOpen(index, false);
                            }}
                            className={usedByOther ? "opacity-40" : ""}
                          >
                            <Check
                              className={cn("mr-2 h-3.5 w-3.5", entityId === entity.id ? "opacity-100" : "opacity-0")}
                            />
                            <span className="truncate">{entity.name}</span>
                            {mode === "lawyers" && "category" in entity && entity.category && (
                              <span className="text-muted-foreground ml-2 text-xs">
                                {String(entity.category)}
                              </span>
                            )}
                            {mode === "projects" && "clientName" in entity && (
                              <span className="text-muted-foreground ml-2 text-xs truncate">
                                {String((entity as any).clientName)}
                              </span>
                            )}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        ))}
        {selectedIds.length < MAX_ENTITIES && (
          <Button
            variant="outline"
            size="sm"
            onClick={addEntity}
            className="h-9 gap-1.5 text-muted-foreground mb-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar
          </Button>
        )}
      </div>

      {/* Charts Section */}
      {validCount >= 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Radar Chart */}
          <Card className="border-border/50">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <Target className="h-4 w-4 text-primary" />
                </div>
                <h3 className="font-semibold text-sm">Perfil Comparativo</h3>
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                    <PolarGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <PolarAngleAxis
                      dataKey="metric"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 100]}
                      tick={false}
                      axisLine={false}
                    />
                    {selectedEntities.map((e, i) =>
                      e ? (
                        <Radar
                          key={i}
                          name={e.name}
                          dataKey={`entity${i}`}
                          stroke={ENTITY_COLORS[i]}
                          fill={ENTITY_COLORS[i]}
                          fillOpacity={0.12}
                          strokeWidth={2}
                        />
                      ) : null,
                    )}
                    <Legend
                      wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value: number) => `${value.toFixed(0)}%`}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Bar Chart - Revenue & Cost grouped by metric */}
          <Card className="border-border/50">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <BarChart3 className="h-4 w-4 text-primary" />
                </div>
                <h3 className="font-semibold text-sm">Facturación vs Costo</h3>
              </div>
              <ChartContainer config={revCostChartConfig} className="h-[300px] w-full">
                <BarChart data={revCostData} margin={{ left: 10, right: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="metric" tick={{ fontSize: 12, fontWeight: 500 }} />
                  <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => formatCurrency(Number(value))}
                      />
                    }
                  />
                  {selectedEntities.map((e, i) =>
                    e ? (
                      <Bar
                        key={i}
                        dataKey={`e${i}`}
                        name={e.name}
                        fill={ENTITY_COLORS[i]}
                        radius={[4, 4, 0, 0]}
                        barSize={validCount <= 2 ? 40 : validCount === 3 ? 28 : 22}
                      />
                    ) : null,
                  )}
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Metric Cards Grid */}
      {validCount >= 2 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((metric) => {
            const values = selectedEntities.map((e) => (e ? (e as any)[metric.key] || 0 : 0));
            const maxVal = Math.max(...values, 1);

            return (
              <Card key={metric.key} className="border-border/50">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded-md bg-muted">
                      <metric.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {metric.label}
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {selectedEntities.map((entity, i) => {
                      if (!entity) return null;
                      const value = (entity as any)[metric.key] || 0;
                      const barWidth = (value / maxVal) * 100;
                      const isMax = value === maxVal && values.filter((v) => v === maxVal).length === 1;
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <div className={`h-2 w-2 rounded-full ${ENTITY_DOT_COLORS[i]}`} />
                              <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                                {entity.name}
                              </span>
                            </div>
                            <span className={cn("text-sm font-semibold tabular-nums", isMax && ENTITY_TEXT_COLORS[i])}>
                              {formatMetricValue(value, metric.format)}
                            </span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${barWidth}%`,
                                backgroundColor: ENTITY_COLORS[i],
                                opacity: isMax ? 1 : 0.5,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Hours Breakdown - visual bars per entity */}
      {validCount >= 2 && (
        <Card className="border-border/50">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-md bg-primary/10">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-semibold text-sm">Distribución de Horas</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4 ml-9">
              Horas facturables vs no facturables por cada entidad
            </p>
            <div className="space-y-4">
              {hoursData.map((row) => (
                <div key={row.idx}>
                  {/* Entity label row */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${row.dotColor}`} />
                      <span className="text-sm font-medium">{row.fullName}</span>
                    </div>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {formatNumber(row.total)} hrs totales
                    </span>
                  </div>
                  {/* Stacked bar */}
                  <div className="flex h-7 rounded-md overflow-hidden bg-muted/40">
                    {row.billable > 0 && (
                      <div
                        className="h-full flex items-center justify-center text-[11px] font-medium text-white transition-all duration-500"
                        style={{
                          width: `${row.pctBillable}%`,
                          backgroundColor: row.color,
                          minWidth: row.pctBillable > 5 ? undefined : "24px",
                        }}
                      >
                        {row.pctBillable > 15 && `${formatNumber(row.billable)} hrs`}
                      </div>
                    )}
                    {row.nonBillable > 0 && (
                      <div
                        className="h-full flex items-center justify-center text-[11px] font-medium text-muted-foreground transition-all duration-500"
                        style={{
                          width: `${100 - row.pctBillable}%`,
                          backgroundColor: "hsl(var(--muted))",
                          minWidth: (100 - row.pctBillable) > 5 ? undefined : "24px",
                        }}
                      >
                        {(100 - row.pctBillable) > 15 && `${formatNumber(row.nonBillable)} hrs`}
                      </div>
                    )}
                  </div>
                  {/* Labels below */}
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-sm" style={{ backgroundColor: row.color }} />
                      <span className="text-[11px] text-muted-foreground">
                        Facturable ({row.pctBillable.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-sm bg-muted" />
                      <span className="text-[11px] text-muted-foreground">
                        No facturable ({(100 - row.pctBillable).toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Table */}
      {validCount >= 2 && (
        <Card className="border-border/50">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-md bg-primary/10">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-semibold text-sm">Resumen Comparativo</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Métrica
                    </th>
                    {selectedEntities.map((e, i) =>
                      e ? (
                        <th key={i} className="text-right py-2 px-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <div className={`h-2 w-2 rounded-full ${ENTITY_DOT_COLORS[i]}`} />
                            <span className="text-xs font-medium truncate max-w-[100px]">
                              {e.name}
                            </span>
                          </div>
                        </th>
                      ) : null,
                    )}
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((metric, mi) => {
                    const values = selectedEntities.map((e) => (e ? (e as any)[metric.key] || 0 : 0));
                    const maxIdx = values.indexOf(Math.max(...values));
                    return (
                      <tr key={metric.key} className={mi % 2 === 0 ? "bg-muted/20" : ""}>
                        <td className="py-2.5 px-3 text-muted-foreground flex items-center gap-2">
                          <metric.icon className="h-3.5 w-3.5" />
                          {metric.label}
                        </td>
                        {selectedEntities.map((e, i) =>
                          e ? (
                            <td
                              key={i}
                              className={cn(
                                "text-right py-2.5 px-3 tabular-nums font-medium",
                                i === maxIdx && "font-bold",
                              )}
                            >
                              <span className={i === maxIdx ? ENTITY_TEXT_COLORS[i] : ""}>
                                {formatMetricValue((e as any)[metric.key] || 0, metric.format)}
                              </span>
                              {i === maxIdx && values.filter((v) => v === values[maxIdx]).length === 1 && (
                                <Badge variant="outline" className="ml-2 text-[10px] py-0 px-1">
                                  Mejor
                                </Badge>
                              )}
                            </td>
                          ) : null,
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ComparisonTool;
