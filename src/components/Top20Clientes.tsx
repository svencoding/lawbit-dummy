import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart3, Info, TrendingUp, Clock, AlertTriangle, UserX } from "lucide-react";
import ChartInfoModal from "@/components/ChartInfoModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import { getChartColor } from "@/lib/chartColors";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  LabelList,
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
} from "recharts";

interface ClientSummary {
  nombre: string;
  totalFacturado: number;
  totalCost?: number;
  totalFacturas: number;
  ultimaFactura: string | null;
  primeraFactura: string | null;
  facturasPagadas: number;
  facturasPendientes: number;
  horasTrabajadas: number;
}

interface ChartFilters {
  clientName: string | null;
  category: string | null;
  feeType: string | null;
}

export type TopNOption = number;

interface Top20ClientesProps {
  clients: ClientSummary[];
  getMaskedClientName: (name: string) => string;
  getRoundedTableNumber: (value: number | null | undefined) => number;
  formatDate: (dateString: string | null) => string;
  onClientClick?: (client: ClientSummary) => void;
  onCategoryClick?: (category: string | null) => void;
  onFeeTypeClick?: (feeType: string | null) => void;
  hoursByLevel?: Array<{ name: string; value: number }>;
  facturacionByFeeType?: Array<{ name: string; value: number }>;
  activeFilters?: ChartFilters;
  totalUnfilteredRevenue?: number;
  topN?: TopNOption;
  onTopNChange?: (value: TopNOption) => void;
  clientHealthData?: Array<{ name: string; value: number }>;
  clientHealthDetails?: Record<string, Array<{ name: string; daysSinceActivity: number | null; monthsActive: number; asuntosCount: number; score: number }>>;
  clientTenureData?: Array<{ name: string; value: number }>;
  clientTenureDetails?: Record<string, string[]>;
  seasonalityData?: Array<{ name: string; value: number }>;
}

const TOP_N_PRESETS = [5, 10, 20, 30];

type HealthClient = {
  name: string;
  daysSinceActivity: number | null;
  monthsActive: number;
  asuntosCount: number;
  score: number;
};

const HEALTH_CONFIG: Record<string, { icon: typeof TrendingUp; color: string; bgColor: string; label: string; metric: (c: HealthClient) => string }> = {
  Creciendo: {
    icon: TrendingUp,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
    label: "Top por actividad",
    metric: (c) => `${c.asuntosCount} asuntos · ${c.monthsActive} meses activo`,
  },
  Estable: {
    icon: Clock,
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    label: "Actividad reciente",
    metric: (c) => `${c.daysSinceActivity ?? "—"} días · ${c.asuntosCount} asuntos`,
  },
  "En Riesgo": {
    icon: AlertTriangle,
    color: "text-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    label: "Mayor inactividad",
    metric: (c) => `${c.daysSinceActivity ?? "—"} días sin actividad`,
  },
  Inactivo: {
    icon: UserX,
    color: "text-red-600",
    bgColor: "bg-red-50 dark:bg-red-950/30",
    label: "Sin actividad reciente",
    metric: (c) => c.daysSinceActivity != null ? `${c.daysSinceActivity} días sin actividad` : "Sin registro",
  },
};

const ClientHealthSection = ({
  healthData,
  healthDetails,
}: {
  healthData: Array<{ name: string; value: number }>;
  healthDetails?: Record<string, HealthClient[]>;
}) => {
  const [open, setOpen] = useState(false);
  const total = healthData.reduce((s, d) => s + d.value, 0);
  const sorted = [...healthData].sort((a, b) => b.value - a.value);

  return (
    <div className="bg-muted/30 rounded-lg p-4 border transition-all duration-300 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Estado de Clientes</h3>
        <button
          onClick={() => setOpen(true)}
          className="h-5 w-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center min-h-[200px]">
        <ChartContainer
          config={{ clientHealth: { label: "Estado de Clientes" } }}
          className="w-full h-full"
          style={{ aspectRatio: "auto" }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={healthData} cx="50%" cy="45%" outerRadius={65} dataKey="value">
                {healthData.map((_, index) => (
                  <Cell key={`health-${index}`} fill={getChartColor(index)} fillOpacity={0.85} />
                ))}
              </Pie>
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                iconSize={8}
                formatter={(value: string) => {
                  const item = healthData.find((d) => d.name === value);
                  const pct = item && total > 0 ? ((item.value / total) * 100).toFixed(0) : "0";
                  return <span className="text-xs text-foreground">{value}: {pct}%</span>;
                }}
                wrapperStyle={{ fontSize: "11px" }}
              />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium">{payload[0].name}</span>
                          <span className="text-sm text-muted-foreground">{payload[0].value} clientes</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Estado de Clientes</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Clasifica clientes según actividad reciente, frecuencia y diversidad de asuntos.
          </p>

          <div className="space-y-4">
            {sorted.map((cat) => {
              const config = HEALTH_CONFIG[cat.name];
              const clients = healthDetails?.[cat.name] || [];
              const top5 = clients.slice(0, 5);
              const pct = total > 0 ? ((cat.value / total) * 100).toFixed(1) : "0";
              if (!config) return null;
              const IconComp = config.icon;

              return (
                <div key={cat.name} className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`${config.bgColor} p-1.5 rounded-md`}>
                      <IconComp className={`h-3.5 w-3.5 ${config.color}`} />
                    </div>
                    <span className="text-sm font-medium flex-1">{cat.name}</span>
                    <span className="text-sm font-semibold tabular-nums">{cat.value}</span>
                    <span className="text-xs text-muted-foreground w-12 text-right tabular-nums">{pct}%</span>
                  </div>
                  {top5.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {config.label}
                      </p>
                      {top5.map((client, i) => (
                        <div key={client.name} className="flex items-center gap-2 py-0.5">
                          <span className="text-[10px] text-muted-foreground w-4 text-right tabular-nums">{i + 1}.</span>
                          <span className="text-xs flex-1 truncate">{client.name}</span>
                          <span className="text-[11px] text-muted-foreground tabular-nums">{config.metric(client)}</span>
                        </div>
                      ))}
                      {clients.length > 5 && (
                        <p className="text-[10px] text-muted-foreground pl-6">
                          +{clients.length - 5} más
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="border-t pt-3 mt-1 flex justify-between text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold">{total} clientes</span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Top20Clientes = ({
  clients,
  getMaskedClientName,
  getRoundedTableNumber,
  formatDate,
  onClientClick,
  onCategoryClick,
  onFeeTypeClick,
  hoursByLevel = [],
  facturacionByFeeType = [],
  activeFilters,
  totalUnfilteredRevenue = 0,
  topN = 20,
  onTopNChange,
  clientHealthData = [],
  clientHealthDetails,
  clientTenureData = [],
  clientTenureDetails,
  seasonalityData = [],
}: Top20ClientesProps) => {
  // Calculate total revenue from filtered clients
  const totalFilteredRevenue = clients.reduce(
    (sum, client) => sum + client.totalFacturado,
    0
  );

  // Sort by totalFacturado descending and take top N
  const topClients = [...clients]
    .sort((a, b) => b.totalFacturado - a.totalFacturado)
    .slice(0, topN);

  // Calculate top N revenue
  const topNRevenue = topClients.reduce(
    (sum, client) => sum + client.totalFacturado,
    0
  );

  // Calculate percentage based on filter state
  let revenuePercentage = 0;
  if (activeFilters?.clientName) {
    // If a client filter is active, show that client's percentage of total unfiltered revenue
    const filteredClient = clients.find(
      (c) => c.nombre === activeFilters.clientName
    );
    if (filteredClient && totalUnfilteredRevenue > 0) {
      revenuePercentage =
        (filteredClient.totalFacturado / totalUnfilteredRevenue) * 100;
    }
  } else {
    // Otherwise, show top 20 percentage of filtered (or unfiltered) revenue
    const denominator =
      totalUnfilteredRevenue > 0
        ? totalUnfilteredRevenue
        : totalFilteredRevenue;
    revenuePercentage =
      denominator > 0 ? (topNRevenue / denominator) * 100 : 0;
  }

  // Prepare chart data for horizontal bar chart (largest at top)
  const chartData = topClients.map((client, index) => ({
    name: getMaskedClientName(client.nombre),
    revenue: getRoundedTableNumber(client.totalFacturado),
    originalRevenue: client.totalFacturado,
    originalClient: client, // Store original client for click handler
    isActive: activeFilters?.clientName === client.nombre,
  }));

  if (topClients.length === 0) {
    return null;
  }

  const chartConfig = {
    revenue: {
      label: "Facturación",
      color: "hsl(var(--chart-1))",
    },
  };

  // Calculate heights: show up to 10 bars initially, make scrollable if more
  const barHeight = 25;
  const visibleBars = Math.min(10, chartData.length);
  const visibleHeight = visibleBars * barHeight + 50;
  const totalHeight = chartData.length * barHeight + 50;

  // Calculate net margin for each client
  // Net margin = Revenue - Cost (where cost comes from billable hours * hourly cost)
  const calculateNetMargin = (revenue: number, cost: number) => {
    const margin = revenue - cost;
    const marginPercent = revenue > 0 ? (margin / revenue) * 100 : 0;
    return { margin, marginPercent };
  };

  // Colors for pie charts - tones of primary color via CSS variables

  const pieChartConfig = {
    hoursByLevel: {
      label: "Horas por Nivel",
    },
    facturacionByFeeType: {
      label: "Facturación por Forma de Cobro",
    },
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-md bg-primary/10">
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-foreground flex items-center gap-2">
                Top {topN} Clientes
                {revenuePercentage > 0 && (
                  <span className="text-sm font-normal text-muted-foreground">
                    {revenuePercentage.toFixed(1)}% del total
                  </span>
                )}
              </CardTitle>
              <CardDescription className="mt-0.5">
                Clientes con mayor facturación
              </CardDescription>
            </div>
          </div>
          {onTopNChange && (
            <div className="flex items-center gap-1.5">
              {TOP_N_PRESETS.map((n) => (
                <button
                  key={n}
                  onClick={() => onTopNChange(n)}
                  className={`h-7 px-2.5 rounded-md text-xs font-medium transition-colors ${
                    topN === n
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  {n}
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={clients.length}
                placeholder="#"
                value={TOP_N_PRESETS.includes(topN) ? "" : topN}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (val > 0) onTopNChange(Math.min(val, clients.length));
                }}
                className="h-7 w-12 rounded-md border bg-background px-2 text-xs text-center focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {/* Horizontal Bar Chart at the Top */}
        <div className="w-full mb-4 pb-4 border-b transition-all duration-300">
          <div
            className="overflow-y-auto rounded-md p-2"
            style={{ maxHeight: `${visibleHeight}px` }}
          >
            <ChartContainer
              config={chartConfig}
              style={{
                height: `${totalHeight}px`,
                width: "100%",
                minWidth: "500px",
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <ChartTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-sm">
                            <div className="grid gap-2">
                              <div className="flex flex-col">
                                <span className="text-[0.70rem] uppercase text-muted-foreground">
                                  {payload[0].payload.name}
                                </span>
                                <span className="font-bold text-emerald-600">
                                  ${payload[0].value?.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="revenue"
                    radius={[0, 4, 4, 0]}
                    onClick={(data) => {
                      if (onClientClick && data?.originalClient) {
                        onClientClick(data.originalClient);
                      }
                    }}
                    style={{ cursor: onClientClick ? "pointer" : "default" }}
                  >
                    {chartData.map((entry: any, index: number) => {
                      const isActive = entry.isActive;
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill="hsl(var(--primary))"
                          fillOpacity={isActive ? 1 : 0.6}
                          stroke={isActive ? "hsl(var(--ring))" : "none"}
                          strokeWidth={isActive ? 2 : 0}
                        />
                      );
                    })}
                    <LabelList
                      dataKey="revenue"
                      position="right"
                      content={(props: any) => {
                        const { x, y, width, height, value, index } = props;
                        const isActive = chartData[index]?.isActive;
                        
                        return (
                          <text
                            x={x + width + 5}
                            y={y + height / 2}
                            fill={isActive ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
                            fontSize={isActive ? "12px" : "11px"}
                            fontWeight={isActive ? "600" : "400"}
                            textAnchor="start"
                            dominantBaseline="middle"
                          >
                            ${value?.toLocaleString()}
                          </text>
                        );
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </div>

        {/* Table on Left, Space for Charts on Right */}
        <div className="flex gap-4">
          {/* Compact Table on the Left */}
          <div className="w-[45%] flex-shrink-0 border-r pr-4">
            <div
              className="overflow-y-auto rounded-md"
              style={{ maxHeight: "600px" }}
            >
              <Table>
                <TableHeader>
                  <TableRow className="border-b">
                    <TableHead className="h-8 px-1 text-[10px] font-semibold w-[30px]">
                      #
                    </TableHead>
                    <TableHead className="h-8 px-1 text-[10px] font-semibold">
                      Nombre
                    </TableHead>
                    <TableHead className="h-8 px-1 text-[10px] font-semibold text-right">
                      Margen
                    </TableHead>
                    <TableHead className="h-8 px-1 text-[10px] font-semibold text-right">
                      %
                    </TableHead>
                    <TableHead className="h-8 px-1 text-[10px] font-semibold text-right">
                      Tarifa
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topClients.map((client, index) => {
                    const { margin, marginPercent } = calculateNetMargin(
                      client.totalFacturado,
                      client.totalCost || 0
                    );
                    const isNegative = margin < 0;
                    // Apply transformation but preserve negative sign
                    const roundedMargin = isNegative
                      ? -getRoundedTableNumber(Math.abs(margin))
                      : getRoundedTableNumber(margin);

                    // Calculate billing rate: revenue per hour
                    const billingRate =
                      client.horasTrabajadas > 0
                        ? client.totalFacturado / client.horasTrabajadas
                        : 0;
                    const roundedBillingRate =
                      getRoundedTableNumber(billingRate);

                    const isActive =
                      activeFilters?.clientName === client.nombre;
                    return (
                      <TableRow
                        key={client.nombre}
                        className={`border-b h-7 transition-all duration-200 ${
                          onClientClick
                            ? "cursor-pointer hover:bg-muted/50"
                            : ""
                        } ${isActive ? "bg-primary/15 border-primary/40 hover:bg-primary/20" : ""}`}
                        onClick={() => onClientClick?.(client)}
                      >
                        <TableCell className={`px-1 py-0.5 text-[11px] font-medium ${
                          isActive ? "text-primary font-semibold" : ""
                        }`}>
                          {index + 1}
                        </TableCell>
                        <TableCell className={`px-1 py-0.5 text-[11px] truncate max-w-[120px] ${
                          isActive ? "text-primary font-semibold" : ""
                        }`}>
                          {getMaskedClientName(client.nombre)}
                        </TableCell>
                        <TableCell className="px-1 py-0.5 text-[11px] text-right">
                          <span
                            className={`font-medium ${
                              isActive 
                                ? "text-primary font-semibold"
                                : isNegative 
                                  ? "text-red-600" 
                                  : "text-emerald-600"
                            }`}
                          >
                            ${roundedMargin.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="px-1 py-0.5 text-[11px] text-right">
                          <span
                            className={`font-medium ${
                              isActive 
                                ? "text-primary font-semibold"
                                : isNegative 
                                  ? "text-red-600" 
                                  : "text-emerald-600"
                            }`}
                          >
                            {marginPercent.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className={`px-1 py-0.5 text-[11px] text-right font-medium ${
                          isActive ? "text-primary font-semibold" : ""
                        }`}>
                          ${roundedBillingRate.toLocaleString()}/h
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Pie Charts on the Right */}
          <div className="flex-1 min-w-0 flex flex-col gap-6 pl-4" style={{ maxHeight: "600px" }}>
            {/* Horas por Nivel Pie Chart */}
            <div className="flex-1 bg-muted/30 rounded-lg p-4 border transition-all duration-300 min-h-0 flex flex-col">
              <ChartInfoModal title="Horas por Nivel" info="Distribución de horas trabajadas según el nivel profesional (Socio, Asociado Sr, Asociado, Otro)." data={hoursByLevel} unit="horas" />
              {hoursByLevel.length > 0 ? (
                <div className="flex-1 flex items-center justify-center min-h-[200px]">
                  <ChartContainer 
                    config={pieChartConfig} 
                    className="w-full h-full"
                    style={{ aspectRatio: 'auto' }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={hoursByLevel}
                          cx="50%"
                          cy="45%"
                          outerRadius={65}
                          fill="hsl(var(--chart-5))"
                          dataKey="value"
                        >
                          {hoursByLevel.map((_, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={getChartColor(index)}
                              />
                          ))}
                        </Pie>
                        <Legend
                          verticalAlign="bottom"
                          iconType="circle"
                          iconSize={8}
                          formatter={(value: string, entry: any) => {
                            const total = hoursByLevel.reduce((s, d) => s + d.value, 0);
                            const item = hoursByLevel.find((d) => d.name === value);
                            const pct = item && total > 0 ? ((item.value / total) * 100).toFixed(0) : "0";
                            return <span className="text-xs text-foreground">{value}: {pct}%</span>;
                          }}
                          wrapperStyle={{ fontSize: "11px" }}
                        />
                        <ChartTooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="rounded-lg border bg-background p-2 shadow-sm">
                                  <div className="flex flex-col gap-1">
                                    <span className="text-sm font-medium">
                                      {payload[0].name}
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                      {payload[0].value?.toLocaleString()} horas
                                    </span>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                  No hay datos disponibles
                </div>
              )}
            </div>

            {/* Facturación por Forma de Cobro Pie Chart */}
            <div className="flex-1 bg-muted/30 rounded-lg p-4 border transition-all duration-300 min-h-0 flex flex-col">
              <ChartInfoModal title="Facturación por Forma de Cobro" info="Distribución de facturación según el tipo de cobro del cliente (por hora, tarifa fija, etc.). Haz clic en una sección para filtrar." data={facturacionByFeeType} unit="$" />
              {facturacionByFeeType.length > 0 ? (
                <div className="flex-1 flex items-center justify-center min-h-[200px]">
                  <ChartContainer 
                    config={pieChartConfig} 
                    className="w-full h-full"
                    style={{ aspectRatio: 'auto' }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={facturacionByFeeType}
                          cx="50%"
                          cy="45%"
                          outerRadius={65}
                          fill="hsl(var(--chart-5))"
                          dataKey="value"
                          animationDuration={300}
                          animationBegin={0}
                          onClick={(data) => {
                            if (onFeeTypeClick && data?.name) {
                              onFeeTypeClick(data.name);
                            }
                          }}
                          style={{
                            cursor: onFeeTypeClick ? "pointer" : "default",
                          }}
                        >
                          {facturacionByFeeType.map((entry, index) => {
                            const isActive =
                              activeFilters?.feeType === entry.name;
                            return (
                              <Cell
                                key={`cell-${index}`}
                                fill={getChartColor(index)}
                                fillOpacity={isActive ? 1 : 0.85}
                                style={{
                                  cursor: onFeeTypeClick ? "pointer" : "default",
                                }}
                              />
                            );
                          })}
                        </Pie>
                        <Legend
                          verticalAlign="bottom"
                          iconType="circle"
                          iconSize={8}
                          formatter={(value: string) => {
                            const total = facturacionByFeeType.reduce((s, d) => s + d.value, 0);
                            const item = facturacionByFeeType.find((d) => d.name === value);
                            const pct = item && total > 0 ? ((item.value / total) * 100).toFixed(0) : "0";
                            return <span className="text-xs text-foreground">{value}: {pct}%</span>;
                          }}
                          wrapperStyle={{ fontSize: "11px" }}
                        />
                        <ChartTooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="rounded-lg border bg-background p-2 shadow-sm">
                                  <div className="flex flex-col gap-1">
                                    <span className="text-sm font-medium">
                                      {payload[0].name}
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                      ${payload[0].value?.toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                  No hay datos disponibles
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Client Health + Tenure */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {/* Client Health Score */}
          {clientHealthData.length > 0 && (
            <ClientHealthSection
              healthData={clientHealthData}
              healthDetails={clientHealthDetails}
            />
          )}

          {/* Client Tenure */}
          {clientTenureData.length > 0 && (
            <div className="bg-muted/30 rounded-lg p-4 border transition-all duration-300 flex flex-col">
              <ChartInfoModal title="Antigüedad de Clientes" info="Distribución de clientes según el tiempo desde su primera actividad registrada." data={clientTenureData} unit="clientes" details={clientTenureDetails} detailLabel="Clientes" />
              <div className="flex-1 flex items-center justify-center min-h-[200px]">
                <ChartContainer
                  config={{ clientTenure: { label: "Antigüedad" } }}
                  className="w-full h-full"
                  style={{ aspectRatio: "auto" }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={clientTenureData}
                        cx="50%"
                        cy="45%"
                        outerRadius={65}
                        dataKey="value"
                      >
                        {clientTenureData.map((_, index) => (
                          <Cell
                            key={`tenure-${index}`}
                            fill={getChartColor(index)}
                            fillOpacity={0.85}
                          />
                        ))}
                      </Pie>
                      <Legend
                        verticalAlign="bottom"
                        iconType="circle"
                        iconSize={8}
                        formatter={(value: string) => {
                          const total = clientTenureData.reduce((s, d) => s + d.value, 0);
                          const item = clientTenureData.find((d) => d.name === value);
                          const pct = item && total > 0 ? ((item.value / total) * 100).toFixed(0) : "0";
                          return <span className="text-xs text-foreground">{value}: {pct}%</span>;
                        }}
                        wrapperStyle={{ fontSize: "11px" }}
                      />
                      <ChartTooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="rounded-lg border bg-background p-2 shadow-sm">
                                <div className="flex flex-col gap-1">
                                  <span className="text-sm font-medium">
                                    {payload[0].name}
                                  </span>
                                  <span className="text-sm text-muted-foreground">
                                    {payload[0].value} clientes
                                  </span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </div>
          )}
        </div>

        {/* Row 3: Seasonality (full width) */}
        {seasonalityData.some((d) => d.value > 0) && (
          <div className="bg-muted/30 rounded-lg p-4 border transition-all duration-300 flex flex-col mt-4">
            <ChartInfoModal title="Estacionalidad de Facturación" info="Patrón mensual de facturación en el período seleccionado. Permite identificar meses de mayor y menor actividad." data={seasonalityData} unit="$" />
            <div className="min-h-[160px]">
              <ChartContainer
                config={{ seasonality: { label: "Facturación mensual" } }}
                className="w-full"
              >
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart
                    data={seasonalityData}
                    margin={{ top: 20, right: 10, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      width={55}
                      tickFormatter={(value) => {
                        const millions = value / 1000000;
                        return millions >= 1
                          ? `$${millions.toFixed(1)}M`
                          : `$${(value / 1000).toFixed(0)}K`;
                      }}
                    />
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="rounded-lg border bg-background p-2 shadow-sm">
                              <div className="flex flex-col gap-1">
                                <span className="text-sm font-medium">
                                  {payload[0].payload.name}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  ${Number(payload[0].value).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="value"
                      fill="hsl(var(--chart-5))"
                      radius={[4, 4, 0, 0]}
                    >
                      <LabelList
                        dataKey="value"
                        position="top"
                        formatter={(value: number) => {
                          if (value === 0) return "";
                          const millions = value / 1000000;
                          return millions >= 1
                            ? `$${millions.toFixed(1)}M`
                            : `$${(value / 1000).toFixed(0)}K`;
                        }}
                        style={{
                          fontSize: "9px",
                          fill: "hsl(var(--muted-foreground))",
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default Top20Clientes;
