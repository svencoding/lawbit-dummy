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
} from "lucide-react";
import {
  getClientCosts,
  getUsuarios,
  getUserProfileData,
} from "@/lib/mockDataUtils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import fotoSven from "@/assets/foto-sven.png";

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
      new Date(2023, 0, 1),
      new Date(2023, 11, 31)
    );
    return clients
      .map((client) => ({
        id: client.client_name,
        name: client.client_name,
        hours: client.total_hours,
        cost: client.total_cost,
        revenue: client.total_cost, // Using cost as revenue fallback
        projects: client.project_count,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, []);

  const lawyersData = useMemo(() => {
    const usuarios = getUsuarios();
    return usuarios
      .map((usuario) => {
        const profileData = getUserProfileData(
          usuario.code,
          new Date(2023, 0, 1),
          new Date(2023, 11, 31)
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
      ? getUserProfileData(entity1, new Date(2023, 0, 1), new Date(2023, 11, 31))
      : null;

  const entity2Details =
    mode === "lawyers" && entity2
      ? getUserProfileData(entity2, new Date(2023, 0, 1), new Date(2023, 11, 31))
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

  const MetricCard = ({
    label,
    value1,
    value2,
    format = "number",
    icon: Icon,
    onClick,
    clickable = false,
  }: {
    label: string;
    value1: number;
    value2: number;
    format?: "number" | "currency" | "percentage";
    icon: React.ComponentType<{ className?: string }>;
    onClick?: () => void;
    clickable?: boolean;
  }) => {
    const diff = getPercentageDiff(value1, value2);
    const isPositive = diff > 0;
    const isEqual = Math.abs(diff) < 0.1;

    const formatValue = (val: number) => {
      if (format === "currency") return formatCurrency(val);
      if (format === "percentage") return `${val.toFixed(1)}%`;
      return Math.round(val).toLocaleString();
    };

    return (
      <div
        className={`relative bg-muted/30 rounded-lg p-3 border border-border/50 ${
          clickable ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""
        }`}
        onClick={clickable ? onClick : undefined}
        onDoubleClick={clickable ? onClick : undefined}
      >
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            {label}
          </span>
          {clickable && (
            <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 items-center">
          <div className="text-right">
            <div className="text-lg font-bold text-primary">
              {formatValue(value1)}
            </div>
          </div>
          <div className="flex items-center justify-center">
            {isEqual ? (
              <Minus className="h-4 w-4 text-muted-foreground" />
            ) : isPositive ? (
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
            <span
              className={`text-xs font-medium ml-1 ${
                isEqual
                  ? "text-muted-foreground"
                  : isPositive
                  ? "text-emerald-600"
                  : "text-red-600"
              }`}
            >
              {isEqual ? "0%" : `${Math.abs(diff).toFixed(0)}%`}
            </span>
          </div>
          <div className="text-left">
            <div className="text-lg font-bold text-primary">
              {formatValue(value2)}
            </div>
          </div>
        </div>
        {/* Visual comparison bar */}
        <div className="mt-2 grid grid-cols-2 gap-1">
          <Progress
            value={(value1 / Math.max(value1, value2)) * 100}
            className="h-1.5"
          />
          <Progress
            value={(value2 / Math.max(value1, value2)) * 100}
            className="h-1.5"
          />
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
          />
          <MetricCard
            label="Costo Total"
            value1={selectedEntity1.cost}
            value2={selectedEntity2.cost}
            format="currency"
            icon={DollarSign}
          />
          <MetricCard
            label="Proyectos"
            value1={selectedEntity1.projects}
            value2={selectedEntity2.projects}
            format="number"
            icon={Briefcase}
            clickable
            onClick={() => setDetailView("projects")}
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
