import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  UserCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  Briefcase,
  Activity,
  ArrowRight,
  Minus,
  Check,
  ChevronsUpDown,
  ExternalLink,
  Percent,
} from "lucide-react";
import {
  getClientCosts,
  getUsuarios,
  getUserProfileData,
} from "@/lib/mockDataUtils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import fotoSven from "@/assets/foto-sven.png";
import facturacionData from "@/lib/mock/facturacion.json";
import clientesData from "@/lib/mock/clientes.json";
import type { Payment, Cliente } from "@/lib/mock/types";

type ComparisonMode = "clients" | "lawyers";

type DetailView = "projects" | "clients" | null;

const ComparisonTool = () => {
  const [mode, setMode] = useState<ComparisonMode>("clients");
  const [entity1, setEntity1] = useState<string>("");
  const [entity2, setEntity2] = useState<string>("");
  const [open1, setOpen1] = useState(false);
  const [open2, setOpen2] = useState(false);
  const [detailView, setDetailView] = useState<DetailView>(null);

  // Get data based on mode
  const clientsData = useMemo(() => {
    const clients = getClientCosts(
      new Date(2025, 0, 1),
      new Date(2025, 11, 31)
    );
    const facturacion = facturacionData as Payment[];
    const clientes = clientesData as Cliente[];
    
    // Create a map of cliente_id to client name
    const clienteIdToNameMap = new Map<number, string>();
    clientes.forEach((cliente) => {
      if (cliente.name) {
        clienteIdToNameMap.set(cliente.id, cliente.name);
      }
    });
    
    // Calculate revenue from facturacion for each client
    const clientRevenueMap = new Map<string, number>();
    facturacion.forEach((payment) => {
      if (!payment.month || !payment.cliente_id) return;
      
      const paymentDate = payment.month;
      const date = new Date(paymentDate + "T00:00:00");
      
      // Filter by date range
      const startDate = new Date(2025, 0, 1);
      const endDate = new Date(2025, 11, 31);
      
      if (date < startDate || date > endDate) return;
      
      const clientName = clienteIdToNameMap.get(payment.cliente_id);
      if (!clientName) return;
      
      const revenue = payment.amount_charged || 0;
      clientRevenueMap.set(
        clientName,
        (clientRevenueMap.get(clientName) || 0) + revenue
      );
    });
    
    return clients
      .map((client) => {
        const revenue = clientRevenueMap.get(client.client_name) || client.total_cost;
        const billableHours = client.billable_hours || client.total_hours;
        const margin = revenue > 0 ? ((revenue - client.total_cost) / revenue) * 100 : 0;
        const rate = billableHours > 0 ? revenue / billableHours : 0;
        
        return {
          id: client.client_name,
          name: client.client_name,
          hours: client.total_hours,
          billableHours: billableHours,
          cost: client.total_cost,
          revenue: revenue,
          margin: margin,
          rate: rate,
          projects: client.project_count,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, []);

  const lawyersData = useMemo(() => {
    const usuarios = getUsuarios();
    return usuarios
      .map((usuario) => {
        const profileData = getUserProfileData(
          usuario.code,
          new Date(2025, 0, 1),
          new Date(2025, 11, 31)
        );
        return {
          id: usuario.code,
          name: usuario.name,
          code: usuario.code,
          category: usuario.category,
          practiceArea: usuario.practice_area,
          hours: profileData?.total_hours || 0,
          revenue: profileData?.total_revenue || 0,
          cost: profileData?.total_cost || 0,
          projects: profileData?.projects.length || 0,
          clients: profileData?.clients.length || 0,
          // Calculate utilization (simplified)
          utilization: 85 + Math.random() * 30, // Mock utilization
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, []);

  const entities = mode === "clients" ? clientsData : lawyersData;

  // Get selected entities data
  const selectedEntity1 =
    mode === "clients"
      ? clientsData.find((c) => c.id === entity1)
      : lawyersData.find((l) => l.id === entity1);

  const selectedEntity2 =
    mode === "clients"
      ? clientsData.find((c) => c.id === entity2)
      : lawyersData.find((l) => l.id === entity2);

  // Get detailed profile data for lawyers
  const entity1Details =
    mode === "lawyers" && entity1
      ? getUserProfileData(entity1, new Date(2025, 0, 1), new Date(2025, 11, 31))
      : null;

  const entity2Details =
    mode === "lawyers" && entity2
      ? getUserProfileData(entity2, new Date(2025, 0, 1), new Date(2025, 11, 31))
      : null;

  // Calculate comparison metrics
  const getPercentageDiff = (val1: number, val2: number) => {
    if (val2 === 0) return val1 > 0 ? 100 : 0;
    return ((val1 - val2) / val2) * 100;
  };

  const formatCurrency = (value: number) => {
    const millions = value / 1000000;
    return millions % 1 === 0 ? `$${millions}M` : `$${millions.toFixed(1)}M`;
  };

  const formatRate = (value: number) => {
    // Format as hourly rate: $X/h or $X.XX/h
    if (value >= 1000) {
      const thousands = value / 1000;
      return thousands % 1 === 0 ? `$${thousands}k/h` : `$${thousands.toFixed(1)}k/h`;
    }
    return `$${Math.round(value)}/h`;
  };

  const MetricCard = ({
    label,
    value1,
    value2,
    format = "number",
    icon: Icon,
    onClick,
    clickable = false,
    entity1Name,
    entity2Name,
  }: {
    label: string;
    value1: number;
    value2: number;
    format?: "number" | "currency" | "percentage" | "rate";
    icon: React.ComponentType<{ className?: string }>;
    onClick?: () => void;
    clickable?: boolean;
    entity1Name?: string;
    entity2Name?: string;
  }) => {
    // For percentage format, calculate difference as percentage points, not percentage of percentage
    const diff = format === "percentage" 
      ? value1 - value2  // Direct difference in percentage points
      : getPercentageDiff(value1, value2);
    const isPositive = diff > 0;
    const isEqual = Math.abs(diff) < 0.1;

    const formatValue = (val: number) => {
      if (format === "currency") return formatCurrency(val);
      if (format === "percentage") return `${val.toFixed(1)}%`;
      if (format === "rate") return formatRate(val);
      return Math.round(val).toLocaleString();
    };

    const getDiffLabel = () => {
      if (isEqual) return "Igual";
      
      if (format === "percentage") {
        // For percentages, show difference in percentage points
        const absDiff = Math.abs(diff);
        if (isPositive) {
          return `${absDiff.toFixed(1)} puntos porcentuales más que ${entity2Name || "el otro"}`;
        } else {
          return `${absDiff.toFixed(1)} puntos porcentuales menos que ${entity2Name || "el otro"}`;
        }
      }
      
      // For other formats, use percentage difference
      if (isPositive) {
        return `${Math.abs(diff).toFixed(0)}% más que ${entity2Name || "el otro"}`;
      } else {
        return `${Math.abs(diff).toFixed(0)}% menos que ${entity2Name || "el otro"}`;
      }
    };

    return (
      <div
        className={`relative bg-muted/30 rounded-lg p-4 border border-border/50 ${
          clickable ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""
        }`}
        onClick={clickable ? onClick : undefined}
        onDoubleClick={clickable ? onClick : undefined}
      >
        <div className="flex items-center gap-2 mb-3">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            {label}
          </span>
          {clickable && (
            <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />
          )}
        </div>
        <div className="grid grid-cols-3 gap-3 items-center mb-3">
          <div className="text-right">
            <div className="text-xl font-bold text-primary">
              {formatValue(value1)}
            </div>
            {entity1Name && (
              <div className="text-xs text-muted-foreground mt-1">
                {entity1Name}
              </div>
            )}
          </div>
          <div className="flex flex-col items-center justify-center">
            <div className="flex items-center gap-1 mb-1">
              {isEqual ? (
                <Minus className="h-4 w-4 text-muted-foreground" />
              ) : isPositive ? (
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <span
                className={`text-sm font-semibold ${
                  isEqual
                    ? "text-muted-foreground"
                    : isPositive
                    ? "text-emerald-600"
                    : "text-red-600"
                }`}
              >
                {isEqual 
                  ? (format === "percentage" ? "0 pp" : "0%")
                  : format === "percentage"
                  ? `${Math.abs(diff).toFixed(1)} pp`
                  : `${Math.abs(diff).toFixed(0)}%`}
              </span>
            </div>
            <div className="text-xs text-muted-foreground text-center px-2">
              {getDiffLabel()}
            </div>
          </div>
          <div className="text-left">
            <div className="text-xl font-bold text-primary">
              {formatValue(value2)}
            </div>
            {entity2Name && (
              <div className="text-xs text-muted-foreground mt-1">
                {entity2Name}
              </div>
            )}
          </div>
        </div>
        {/* Visual comparison bar */}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <div className="text-xs text-muted-foreground mb-1 text-right">
              {entity1Name || "Cliente 1"}
            </div>
            <Progress
              value={(value1 / Math.max(value1, value2, 1)) * 100}
              className="h-2"
            />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1 text-left">
              {entity2Name || "Cliente 2"}
            </div>
            <Progress
              value={(value2 / Math.max(value1, value2, 1)) * 100}
              className="h-2"
            />
          </div>
        </div>
      </div>
    );
  };

  const ComparisonView = () => {
    if (!selectedEntity1 || !selectedEntity2) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="bg-muted/30 rounded-full p-6 mb-4">
            {mode === "clients" ? (
              <Users className="h-12 w-12 text-muted-foreground" />
            ) : (
              <UserCircle className="h-12 w-12 text-muted-foreground" />
            )}
          </div>
          <p className="text-sm text-muted-foreground max-w-sm">
            Selecciona dos {mode === "clients" ? "clientes" : "abogados"} para
            comparar sus métricas
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Headers */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="flex flex-col items-end">
            {mode === "lawyers" && (
              <Avatar className="h-12 w-12 mb-2">
                <AvatarImage src={fotoSven} alt={selectedEntity1.name} />
                <AvatarFallback>{selectedEntity1.name.charAt(0)}</AvatarFallback>
              </Avatar>
            )}
            <h3 className="font-bold text-lg text-right">
              {selectedEntity1.name}
            </h3>
            {mode === "lawyers" && "category" in selectedEntity1 && selectedEntity1.category && (
              <Badge variant="outline" className="mt-1">
                {String(selectedEntity1.category)}
              </Badge>
            )}
          </div>
          <div className="flex items-center justify-center">
            <div className="bg-primary/10 rounded-full p-2">
              <ArrowRight className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div className="flex flex-col items-start">
            {mode === "lawyers" && (
              <Avatar className="h-12 w-12 mb-2">
                <AvatarImage src={fotoSven} alt={selectedEntity2.name} />
                <AvatarFallback>{selectedEntity2.name.charAt(0)}</AvatarFallback>
              </Avatar>
            )}
            <h3 className="font-bold text-lg text-left">
              {selectedEntity2.name}
            </h3>
            {mode === "lawyers" && "category" in selectedEntity2 && selectedEntity2.category && (
              <Badge variant="outline" className="mt-1">
                {String(selectedEntity2.category)}
              </Badge>
            )}
          </div>
        </div>

        {/* Metrics */}
        <div className="space-y-3">
          <MetricCard
            label="Total de Horas"
            value1={selectedEntity1.hours}
            value2={selectedEntity2.hours}
            format="number"
            icon={Clock}
            entity1Name={selectedEntity1.name}
            entity2Name={selectedEntity2.name}
          />
          <MetricCard
            label={mode === "clients" ? "Facturación" : "Ingresos"}
            value1={
              mode === "clients"
                ? selectedEntity1.revenue
                : "revenue" in selectedEntity1
                ? Number(selectedEntity1.revenue)
                : 0
            }
            value2={
              mode === "clients"
                ? selectedEntity2.revenue
                : "revenue" in selectedEntity2
                ? Number(selectedEntity2.revenue)
                : 0
            }
            format="currency"
            icon={DollarSign}
            entity1Name={selectedEntity1.name}
            entity2Name={selectedEntity2.name}
          />
          <MetricCard
            label="Costo Total"
            value1={selectedEntity1.cost}
            value2={selectedEntity2.cost}
            format="currency"
            icon={DollarSign}
            entity1Name={selectedEntity1.name}
            entity2Name={selectedEntity2.name}
          />
          {mode === "clients" &&
            "margin" in selectedEntity1 &&
            "margin" in selectedEntity2 && (
              <MetricCard
                label="Margen"
                value1={Number(selectedEntity1.margin)}
                value2={Number(selectedEntity2.margin)}
                format="percentage"
                icon={Percent}
                entity1Name={selectedEntity1.name}
                entity2Name={selectedEntity2.name}
              />
            )}
          {mode === "clients" &&
            "rate" in selectedEntity1 &&
            "rate" in selectedEntity2 && (
              <MetricCard
                label="Tarifa Promedio"
                value1={Number(selectedEntity1.rate)}
                value2={Number(selectedEntity2.rate)}
                format="rate"
                icon={Clock}
                entity1Name={selectedEntity1.name}
                entity2Name={selectedEntity2.name}
              />
            )}
          <MetricCard
            label="Proyectos"
            value1={selectedEntity1.projects}
            value2={selectedEntity2.projects}
            format="number"
            icon={Briefcase}
            clickable
            onClick={() => setDetailView("projects")}
            entity1Name={selectedEntity1.name}
            entity2Name={selectedEntity2.name}
          />
          {mode === "lawyers" &&
            "utilization" in selectedEntity1 &&
            "utilization" in selectedEntity2 && (
              <MetricCard
                label="% Utilización"
                value1={Number(selectedEntity1.utilization)}
                value2={Number(selectedEntity2.utilization)}
                format="percentage"
                icon={Activity}
                entity1Name={selectedEntity1.name}
                entity2Name={selectedEntity2.name}
              />
            )}
          {mode === "lawyers" &&
            "clients" in selectedEntity1 &&
            "clients" in selectedEntity2 && (
              <MetricCard
                label="Clientes Atendidos"
                value1={Number(selectedEntity1.clients)}
                value2={Number(selectedEntity2.clients)}
                format="number"
                icon={Users}
                clickable
                onClick={() => setDetailView("clients")}
                entity1Name={selectedEntity1.name}
                entity2Name={selectedEntity2.name}
              />
            )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Comparación
        </h1>
        <p className="text-muted-foreground">
          Compara métricas de rendimiento entre clientes o abogados
        </p>
      </div>

      <Card className="border-border/50">
        <CardContent className="pt-6 space-y-6">
        {/* Mode Selector */}
        <Tabs
          value={mode}
          onValueChange={(v) => {
            setMode(v as ComparisonMode);
            setEntity1("");
            setEntity2("");
            setOpen1(false);
            setOpen2(false);
          }}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="clients">
              <Users className="h-4 w-4 mr-2" />
              Clientes
            </TabsTrigger>
            <TabsTrigger value="lawyers">
              <UserCircle className="h-4 w-4 mr-2" />
              Abogados
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Entity Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              {mode === "clients" ? "Cliente" : "Abogado"} #1
            </label>
            <Popover open={open1} onOpenChange={setOpen1}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open1}
                  className="w-full justify-between"
                >
                  {entity1
                    ? entities.find((entity) => entity.id === entity1)?.name
                    : `Seleccionar ${mode === "clients" ? "cliente" : "abogado"}...`}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0">
                <Command>
                  <CommandInput placeholder="Buscar..." />
                  <CommandList className="max-h-[300px]">
                    <CommandEmpty>No se encontraron resultados.</CommandEmpty>
                    <CommandGroup>
                      {entities.map((entity) => (
                        <CommandItem
                          key={entity.id}
                          value={entity.name}
                          onSelect={() => {
                            setEntity1(entity.id);
                            setOpen1(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              entity1 === entity.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {entity.name}
                          {mode === "lawyers" && "category" in entity && entity.category && (
                            <span className="text-muted-foreground ml-2 text-xs">
                              • {String(entity.category)}
                            </span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              {mode === "clients" ? "Cliente" : "Abogado"} #2
            </label>
            <Popover open={open2} onOpenChange={setOpen2}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open2}
                  className="w-full justify-between"
                >
                  {entity2
                    ? entities.find((entity) => entity.id === entity2)?.name
                    : `Seleccionar ${mode === "clients" ? "cliente" : "abogado"}...`}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0">
                <Command>
                  <CommandInput placeholder="Buscar..." />
                  <CommandList className="max-h-[300px]">
                    <CommandEmpty>No se encontraron resultados.</CommandEmpty>
                    <CommandGroup>
                      {entities.map((entity) => (
                        <CommandItem
                          key={entity.id}
                          value={entity.name}
                          onSelect={() => {
                            setEntity2(entity.id);
                            setOpen2(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              entity2 === entity.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {entity.name}
                          {mode === "lawyers" && "category" in entity && entity.category && (
                            <span className="text-muted-foreground ml-2 text-xs">
                              • {String(entity.category)}
                            </span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Comparison View */}
        <ComparisonView />

        {/* Detail Dialogs */}
        {mode === "lawyers" && selectedEntity1 && selectedEntity2 && (
          <>
            {/* Projects Detail Dialog */}
            <Dialog open={detailView === "projects"} onOpenChange={(open) => !open && setDetailView(null)}>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Comparación de Proyectos</DialogTitle>
                  <DialogDescription>
                    Desglose detallado de proyectos para {selectedEntity1.name} y {selectedEntity2.name}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4">
                  {/* Entity 1 Projects */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      {selectedEntity1.name}
                      <Badge variant="outline">{entity1Details?.projects.length || 0} proyectos</Badge>
                    </h3>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Proyecto</TableHead>
                            <TableHead className="text-xs text-right">Horas</TableHead>
                            <TableHead className="text-xs text-right">Ingresos</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {entity1Details?.projects.slice(0, 10).map((project) => (
                            <TableRow key={project.project_id}>
                              <TableCell className="text-xs font-medium">
                                {project.project_name}
                              </TableCell>
                              <TableCell className="text-xs text-right">
                                {Math.round(project.total_hours)}
                              </TableCell>
                              <TableCell className="text-xs text-right text-emerald-600">
                                {formatCurrency(project.revenue)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {(entity1Details?.projects.length || 0) > 10 && (
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        Mostrando 10 de {entity1Details?.projects.length} proyectos
                      </p>
                    )}
                  </div>

                  {/* Entity 2 Projects */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      {selectedEntity2.name}
                      <Badge variant="outline">{entity2Details?.projects.length || 0} proyectos</Badge>
                    </h3>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Proyecto</TableHead>
                            <TableHead className="text-xs text-right">Horas</TableHead>
                            <TableHead className="text-xs text-right">Ingresos</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {entity2Details?.projects.slice(0, 10).map((project) => (
                            <TableRow key={project.project_id}>
                              <TableCell className="text-xs font-medium">
                                {project.project_name}
                              </TableCell>
                              <TableCell className="text-xs text-right">
                                {Math.round(project.total_hours)}
                              </TableCell>
                              <TableCell className="text-xs text-right text-emerald-600">
                                {formatCurrency(project.revenue)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {(entity2Details?.projects.length || 0) > 10 && (
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        Mostrando 10 de {entity2Details?.projects.length} proyectos
                      </p>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Clients Detail Dialog */}
            <Dialog open={detailView === "clients"} onOpenChange={(open) => !open && setDetailView(null)}>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Comparación de Clientes</DialogTitle>
                  <DialogDescription>
                    Desglose detallado de clientes atendidos por {selectedEntity1.name} y {selectedEntity2.name}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4">
                  {/* Entity 1 Clients */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      {selectedEntity1.name}
                      <Badge variant="outline">{entity1Details?.clients.length || 0} clientes</Badge>
                    </h3>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Cliente</TableHead>
                            <TableHead className="text-xs text-right">Horas</TableHead>
                            <TableHead className="text-xs text-right">Ingresos</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {entity1Details?.clients.slice(0, 10).map((client) => (
                            <TableRow key={client.client_code}>
                              <TableCell className="text-xs font-medium">
                                {client.client_name}
                              </TableCell>
                              <TableCell className="text-xs text-right">
                                {Math.round(client.total_hours)}
                              </TableCell>
                              <TableCell className="text-xs text-right text-emerald-600">
                                {formatCurrency(client.revenue)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {(entity1Details?.clients.length || 0) > 10 && (
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        Mostrando 10 de {entity1Details?.clients.length} clientes
                      </p>
                    )}
                  </div>

                  {/* Entity 2 Clients */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      {selectedEntity2.name}
                      <Badge variant="outline">{entity2Details?.clients.length || 0} clientes</Badge>
                    </h3>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Cliente</TableHead>
                            <TableHead className="text-xs text-right">Horas</TableHead>
                            <TableHead className="text-xs text-right">Ingresos</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {entity2Details?.clients.slice(0, 10).map((client) => (
                            <TableRow key={client.client_code}>
                              <TableCell className="text-xs font-medium">
                                {client.client_name}
                              </TableCell>
                              <TableCell className="text-xs text-right">
                                {Math.round(client.total_hours)}
                              </TableCell>
                              <TableCell className="text-xs text-right text-emerald-600">
                                {formatCurrency(client.revenue)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {(entity2Details?.clients.length || 0) > 10 && (
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        Mostrando 10 de {entity2Details?.clients.length} clientes
                      </p>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </CardContent>
    </Card>
    </div>
  );
};

export default ComparisonTool;
