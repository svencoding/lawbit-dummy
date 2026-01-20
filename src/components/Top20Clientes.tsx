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
import { Trophy } from "lucide-react";
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
}

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
}: Top20ClientesProps) => {
  // Debug: Log data to console
  console.log('Top20Clientes data:', {
    hoursByLevel: hoursByLevel.length,
    facturacionByFeeType: facturacionByFeeType.length,
    hoursByLevelData: hoursByLevel,
    facturacionByFeeTypeData: facturacionByFeeType,
  });
  // Calculate total revenue from filtered clients
  const totalFilteredRevenue = clients.reduce(
    (sum, client) => sum + client.totalFacturado,
    0
  );

  // Sort by totalFacturado descending and take top 20
  const top20Clients = [...clients]
    .sort((a, b) => b.totalFacturado - a.totalFacturado)
    .slice(0, 20);

  // Calculate top 20 revenue
  const top20Revenue = top20Clients.reduce(
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
      denominator > 0 ? (top20Revenue / denominator) * 100 : 0;
  }

  // Prepare chart data for horizontal bar chart (largest at top)
  const chartData = top20Clients.map((client, index) => ({
    name: getMaskedClientName(client.nombre),
    revenue: getRoundedTableNumber(client.totalFacturado),
    originalRevenue: client.totalFacturado,
    originalClient: client, // Store original client for click handler
    isActive: activeFilters?.clientName === client.nombre,
  }));

  if (top20Clients.length === 0) {
    return null;
  }

  const chartConfig = {
    revenue: {
      label: "Facturación",
      color: "hsl(var(--chart-1))",
    },
  };

  // Calculate heights: show 10 bars initially, make scrollable for all 20
  const barHeight = 25; // Reduced bar height
  const visibleBars = 10;
  const visibleHeight = visibleBars * barHeight + 50; // +50 for margins and padding
  const totalHeight = chartData.length * barHeight + 50;

  // Calculate net margin for each client
  // Net margin = Revenue - Cost (where cost comes from billable hours * hourly cost)
  const calculateNetMargin = (revenue: number, cost: number) => {
    const margin = revenue - cost;
    const marginPercent = revenue > 0 ? (margin / revenue) * 100 : 0;
    return { margin, marginPercent };
  };

  // Colors for pie charts - tones of primary color
  // Creating variations by adjusting lightness: darker to lighter tones
  const PRIMARY_COLORS = [
    "hsl(210 55% 23%)", // Base primary (darkest)
    "hsl(210 55% 35%)", // Medium-dark
    "hsl(210 55% 47%)", // Medium
    "hsl(210 55% 59%)", // Medium-light
    "hsl(210 55% 71%)", // Light
  ];

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
      <CardHeader>
        <div className="flex items-center gap-2 flex-wrap">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <CardTitle className="text-foreground">
            Top 20 Clientes
            {revenuePercentage > 0 && (
              <span className="ml-2 text-lg font-normal text-muted-foreground">
                ({revenuePercentage.toFixed(1)}%)
              </span>
            )}
          </CardTitle>
        </div>
        <CardDescription>
          Los 20 clientes con mayor facturación total
        </CardDescription>
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
                  {top20Clients.map((client, index) => {
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
              <h3 className="text-sm font-semibold mb-3 text-foreground">
                Horas por Nivel
              </h3>
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
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) =>
                            `${name}: ${(percent * 100).toFixed(0)}%`
                          }
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {hoursByLevel.map((entry, index) => {
                            const baseColor =
                              PRIMARY_COLORS[index % PRIMARY_COLORS.length];
                            return (
                              <Cell
                                key={`cell-${index}`}
                                fill={baseColor}
                              />
                            );
                          })}
                        </Pie>
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
              <h3 className="text-sm font-semibold mb-3 text-foreground">
                Facturación por Forma de Cobro
              </h3>
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
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) =>
                            `${name}: ${(percent * 100).toFixed(0)}%`
                          }
                          outerRadius={80}
                          fill="#8884d8"
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
                            const baseColor =
                              PRIMARY_COLORS[index % PRIMARY_COLORS.length];
                            // Make active slice brighter/more opaque
                            const fillColor = isActive
                              ? baseColor.replace(
                                  /hsl\(([^)]+)\)/,
                                  (match, content) => {
                                    // Increase opacity/brightness for active
                                    return `hsl(${content.replace(
                                      /\d+%\)/,
                                      "75%)"
                                    )}`;
                                  }
                                )
                              : baseColor;
                            return (
                              <Cell
                                key={`cell-${index}`}
                                fill={fillColor}
                                style={{
                                  cursor: onFeeTypeClick ? "pointer" : "default",
                                }}
                              />
                            );
                          })}
                        </Pie>
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
      </CardContent>
    </Card>
  );
};

export default Top20Clientes;
