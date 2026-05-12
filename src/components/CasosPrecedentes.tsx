import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import {
  Briefcase,
  Users,
  Clock,
  DollarSign,
  TrendingUp,
  Calendar,
  Zap,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Scale,
  Layers,
  Pencil,
  Search,
  AlertTriangle,
} from "lucide-react";
import {
  getHistoricalProjectsByArea,
  type HistoricalProject,
} from "@/lib/mockDataUtils";

interface CasosPrecedentesProps {
  selectedArea: string;
  currentEstimate: {
    totalPrice: number;
    totalHours: number;
    avgRate: number;
    billingMethod: string;
    complexityFactor: number;
  };
  onApplyProject: (project: HistoricalProject) => void;
  onCombineAndApply?: (combined: { totalHours: number; totalPrice: number; avgRate: number }) => void;
}

type SortField =
  | "total_billed"
  | "total_hours"
  | "avg_rate"
  | "profit_margin"
  | "team_size"
  | "duration_days";

const chargeTypeLabels: Record<string, string> = {
  TASA: "Tarifa Horaria",
  HITOS: "Hitos",
};

const projectTypeColors: Record<string, string> = {
  Asesoría: "bg-blue-100 text-blue-800",
  Juicio: "bg-red-100 text-red-800",
  Proyecto: "bg-purple-100 text-purple-800",
  Contrato: "bg-green-100 text-green-800",
  Informe: "bg-amber-100 text-amber-800",
  Arbitraje: "bg-orange-100 text-orange-800",
};

export default function CasosPrecedentes({
  selectedArea,
  currentEstimate,
  onApplyProject,
  onCombineAndApply,
}: CasosPrecedentesProps) {
  const [projectTypeFilter, setProjectTypeFilter] = useState<string>("all");
  const [chargeTypeFilter, setChargeTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showComparison, setShowComparison] = useState(false);
  const [sortField, setSortField] = useState<SortField>("total_billed");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [editingEstimate, setEditingEstimate] = useState(false);
  const [editedHours, setEditedHours] = useState<number>(currentEstimate.totalHours);
  const [editedPrice, setEditedPrice] = useState<number>(currentEstimate.totalPrice);

  const allProjects = useMemo(
    () => getHistoricalProjectsByArea(selectedArea),
    [selectedArea],
  );

  const projectTypes = useMemo(() => {
    const types = new Set<string>();
    allProjects.forEach((p) => {
      if (p.project_type) types.add(p.project_type);
    });
    return Array.from(types).sort();
  }, [allProjects]);

  const chargeTypes = useMemo(() => {
    const types = new Set<string>();
    allProjects.forEach((p) => {
      if (p.charge_type) types.add(p.charge_type);
    });
    return Array.from(types).sort();
  }, [allProjects]);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allProjects
      .filter(
        (p) =>
          projectTypeFilter === "all" || p.project_type === projectTypeFilter,
      )
      .filter(
        (p) =>
          chargeTypeFilter === "all" || p.charge_type === chargeTypeFilter,
      )
      .filter((p) => {
        if (!q) return true;
        return (
          (p.title?.toLowerCase().includes(q) ?? false) ||
          (p.client_name?.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) => {
        const aVal = a[sortField] as number;
        const bVal = b[sortField] as number;
        return sortDirection === "desc" ? bVal - aVal : aVal - bVal;
      });
  }, [
    allProjects,
    projectTypeFilter,
    chargeTypeFilter,
    searchQuery,
    sortField,
    sortDirection,
  ]);

  const summaryStats = useMemo(() => {
    if (filteredProjects.length === 0)
      return { count: 0, avgHours: 0, avgBilled: 0, avgMargin: 0 };
    const count = filteredProjects.length;
    const avgHours =
      filteredProjects.reduce((s, p) => s + p.total_hours, 0) / count;
    const avgBilled =
      filteredProjects.reduce((s, p) => s + p.total_billed, 0) / count;
    const avgMargin =
      filteredProjects.reduce((s, p) => s + p.profit_margin, 0) / count;
    return { count, avgHours: Math.round(avgHours), avgBilled: Math.round(avgBilled), avgMargin: Math.round(avgMargin * 10) / 10 };
  }, [filteredProjects]);

  const selectedProjects = useMemo(
    () => filteredProjects.filter((p) => selectedIds.has(p.asunto_id)),
    [filteredProjects, selectedIds],
  );

  const combinedStats = useMemo(() => {
    if (selectedProjects.length === 0) return null;
    const count = selectedProjects.length;
    const totalHours = Math.round(selectedProjects.reduce((s, p) => s + p.total_hours, 0) / count);
    const totalPrice = Math.round(selectedProjects.reduce((s, p) => s + p.total_billed, 0) / count);
    const avgRate = totalHours > 0 ? Math.round(totalPrice / totalHours) : 0;
    return { totalHours, totalPrice, avgRate };
  }, [selectedProjects]);

  const toggleSelection = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 3) {
        next.add(id);
      }
      return next;
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field)
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDirection === "desc" ? (
      <ArrowDown className="h-3 w-3 ml-1" />
    ) : (
      <ArrowUp className="h-3 w-3 ml-1" />
    );
  };

  if (allProjects.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="bg-muted/30 rounded-full p-6 mb-4 mx-auto w-fit">
            <Briefcase className="h-12 w-12 text-muted-foreground" />
          </div>
          <p className="text-base font-medium text-muted-foreground mb-1">
            Sin casos precedentes
          </p>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            No se encontraron asuntos históricos con registro de horas en el
            área de {selectedArea}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Casos Precedentes — {selectedArea}
          </CardTitle>
          <CardDescription>
            Asuntos históricos comparables para fundamentar su cotización
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-[260px]">
              <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por asunto o cliente..."
                className="pl-8"
              />
            </div>
            <Select
              value={projectTypeFilter}
              onValueChange={setProjectTypeFilter}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo de asunto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {projectTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={chargeTypeFilter}
              onValueChange={setChargeTypeFilter}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Modalidad de cobro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las modalidades</SelectItem>
                {chargeTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {chargeTypeLabels[t] || t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex-1" />
            {selectedIds.size > 0 && (
              <Button
                onClick={() => setShowComparison(true)}
                className="gap-2"
              >
                <Scale className="h-4 w-4" />
                Comparar ({selectedIds.size})
              </Button>
            )}
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-muted/50 rounded-lg border text-center">
              <p className="text-2xl font-bold">{summaryStats.count}</p>
              <p className="text-xs text-muted-foreground">
                Casos Encontrados
              </p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border text-center">
              <p className="text-2xl font-bold">{summaryStats.avgHours}h</p>
              <p className="text-xs text-muted-foreground">Horas Promedio</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border text-center">
              <p className="text-2xl font-bold">
                ${summaryStats.avgBilled.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                Facturación Promedio
              </p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border text-center">
              <p className="text-2xl font-bold">{summaryStats.avgMargin}%</p>
              <p className="text-xs text-muted-foreground">Margen Promedio</p>
            </div>
          </div>

          {/* Projects Table */}
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Asunto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cobro</TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort("total_hours")}
                  >
                    <div className="flex items-center justify-end">
                      Horas
                      <SortIcon field="total_hours" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort("total_billed")}
                  >
                    <div className="flex items-center justify-end">
                      Facturado
                      <SortIcon field="total_billed" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort("avg_rate")}
                  >
                    <div className="flex items-center justify-end">
                      Tarifa
                      <SortIcon field="avg_rate" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort("profit_margin")}
                  >
                    <div className="flex items-center justify-end">
                      Margen
                      <SortIcon field="profit_margin" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort("team_size")}
                  >
                    <div className="flex items-center justify-end">
                      Equipo
                      <SortIcon field="team_size" />
                    </div>
                  </TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map((project) => (
                  <TableRow
                    key={project.asunto_id}
                    className={
                      selectedIds.has(project.asunto_id)
                        ? "bg-primary/5"
                        : undefined
                    }
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(project.asunto_id)}
                        disabled={
                          !selectedIds.has(project.asunto_id) &&
                          selectedIds.size >= 3
                        }
                        onCheckedChange={() =>
                          toggleSelection(project.asunto_id)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{project.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {project.client_name}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {project.project_type && (
                        <Badge
                          variant="secondary"
                          className={
                            projectTypeColors[project.project_type] || ""
                          }
                        >
                          {project.project_type}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {project.charge_type && (
                        <span className="text-xs text-muted-foreground">
                          {chargeTypeLabels[project.charge_type] ||
                            project.charge_type}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {project.total_hours}h
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${project.total_billed.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      ${project.avg_rate.toLocaleString()}/h
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`text-sm font-medium ${
                          project.profit_margin >= 30
                            ? "text-green-600"
                            : project.profit_margin >= 0
                              ? "text-yellow-600"
                              : "text-red-600"
                        }`}
                      >
                        {project.profit_margin}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-sm cursor-help">
                            {project.team_size}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="space-y-1 text-xs">
                            {project.team.map((m) => (
                              <p key={m.user_code}>
                                {m.user_name} ({m.category}) — {m.hours}h
                              </p>
                            ))}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs"
                        onClick={() => onApplyProject(project)}
                      >
                        <Zap className="h-3 w-3" />
                        Aplicar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredProjects.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No se encontraron casos con los filtros seleccionados
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
              <p className="text-sm text-muted-foreground">
                {selectedIds.size} caso(s) seleccionado(s) para comparación
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Limpiar
                </Button>
                <Button size="sm" onClick={() => setShowComparison(true)}>
                  <Scale className="h-4 w-4 mr-1" />
                  Comparar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comparison Dialog */}
      <Dialog open={showComparison} onOpenChange={setShowComparison}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Comparación de Asuntos
            </DialogTitle>
            <DialogDescription>
              Análisis comparativo entre su estimación actual y los casos
              precedentes seleccionados
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            {/* Column headers */}
            <div
              className="grid gap-4 mb-4"
              style={{
                gridTemplateColumns: `180px repeat(${selectedProjects.length + 1}, 1fr)`,
              }}
            >
              <div />
              <div className="p-3 bg-primary/10 rounded-lg border-2 border-primary/30 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <p className="text-xs text-muted-foreground">
                    Estimación Actual
                  </p>
                  <button
                    onClick={() => {
                      if (!editingEstimate) {
                        setEditedHours(currentEstimate.totalHours);
                        setEditedPrice(currentEstimate.totalPrice);
                      }
                      setEditingEstimate(!editingEstimate);
                    }}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>
                {editingEstimate ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 justify-center">
                      <span className="text-xs text-muted-foreground">$</span>
                      <Input
                        type="number"
                        value={editedPrice}
                        onChange={(e) => setEditedPrice(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-24 h-6 text-xs font-bold text-center"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="font-bold text-primary">
                    ${(editingEstimate ? editedPrice : currentEstimate.totalPrice).toLocaleString()}
                  </p>
                )}
              </div>
              {selectedProjects.map((p) => (
                <div
                  key={p.asunto_id}
                  className="p-3 bg-muted/50 rounded-lg border text-center"
                >
                  <p className="text-xs text-muted-foreground mb-1 truncate">
                    {p.title}
                  </p>
                  <p className="font-bold">
                    ${p.total_billed.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {p.client_name}
                  </p>
                </div>
              ))}
            </div>

            <Separator className="my-4" />

            {/* Metric rows */}
            <div className="space-y-3">
              <ComparisonRow
                label="Horas Totales"
                icon={<Clock className="h-4 w-4" />}
                currentValue={editingEstimate ? undefined : `${currentEstimate.totalHours}h`}
                currentNumeric={editingEstimate ? editedHours : currentEstimate.totalHours}
                projects={selectedProjects}
                getValue={(p) => `${p.total_hours}h`}
                getNumeric={(p) => p.total_hours}
                editMode={editingEstimate}
                editValue={editedHours}
                onEditChange={(v) => setEditedHours(v)}
                editSuffix="h"
              />
              <ComparisonRow
                label="Facturación"
                icon={<DollarSign className="h-4 w-4" />}
                currentValue={editingEstimate ? undefined : `$${currentEstimate.totalPrice.toLocaleString()}`}
                currentNumeric={editingEstimate ? editedPrice : currentEstimate.totalPrice}
                projects={selectedProjects}
                getValue={(p) => `$${p.total_billed.toLocaleString()}`}
                getNumeric={(p) => p.total_billed}
                editMode={editingEstimate}
                editValue={editedPrice}
                onEditChange={(v) => setEditedPrice(v)}
                editPrefix="$"
              />
              <ComparisonRow
                label="Tarifa Promedio"
                icon={<TrendingUp className="h-4 w-4" />}
                currentValue={
                  (editingEstimate ? editedHours : currentEstimate.totalHours) > 0
                    ? `$${Math.round((editingEstimate ? editedPrice : currentEstimate.totalPrice) / (editingEstimate ? editedHours : currentEstimate.totalHours)).toLocaleString()}/h`
                    : "—"
                }
                currentNumeric={
                  (editingEstimate ? editedHours : currentEstimate.totalHours) > 0
                    ? (editingEstimate ? editedPrice : currentEstimate.totalPrice) / (editingEstimate ? editedHours : currentEstimate.totalHours)
                    : 0
                }
                projects={selectedProjects}
                getValue={(p) => `$${p.avg_rate.toLocaleString()}/h`}
                getNumeric={(p) => p.avg_rate}
              />
              <ComparisonRow
                label="Margen"
                icon={<TrendingUp className="h-4 w-4" />}
                currentValue="—"
                currentNumeric={0}
                projects={selectedProjects}
                getValue={(p) => `${p.profit_margin}%`}
                getNumeric={(p) => p.profit_margin}
                colorByValue
              />
              <ComparisonRow
                label="Equipo"
                icon={<Users className="h-4 w-4" />}
                currentValue="—"
                currentNumeric={0}
                projects={selectedProjects}
                getValue={(p) =>
                  `${p.team_size} prof.`
                }
                getNumeric={(p) => p.team_size}
              />
              <ComparisonRow
                label="Duración"
                icon={<Calendar className="h-4 w-4" />}
                currentValue="—"
                currentNumeric={0}
                projects={selectedProjects}
                getValue={(p) =>
                  p.duration_days > 0 ? `${p.duration_days} días` : "—"
                }
                getNumeric={(p) => p.duration_days}
              />
              {(() => {
                // Factor de Complejidad — same scale as the Pricing form (~0.5–1.5x).
                // Current estimate uses the user-selected factor directly. Historical
                // projects don't store one, so we infer it from realized signals:
                // team size (coordination) + non-billable ratio (rework / write-off).
                const inferFactor = (p: HistoricalProject) => {
                  const nonBillableRatio =
                    p.total_hours > 0
                      ? Math.max(0, p.total_hours - p.billable_hours) / p.total_hours
                      : 0;
                  const raw =
                    1.0 +
                    Math.max(0, p.team_size - 1) * 0.05 +
                    (nonBillableRatio - 0.2) * 0.5;
                  return Math.min(1.5, Math.max(0.5, raw));
                };
                const factorLabel = (f: number) => {
                  if (f <= 0.7) return "Muy Baja";
                  if (f <= 0.9) return "Baja";
                  if (f <= 1.1) return "Media";
                  if (f <= 1.3) return "Alta";
                  return "Muy Alta";
                };
                return (
                  <ComparisonRow
                    label="Factor de Complejidad"
                    icon={<AlertTriangle className="h-4 w-4" />}
                    currentValue={`${factorLabel(currentEstimate.complexityFactor)} · ${currentEstimate.complexityFactor.toFixed(1)}x`}
                    currentNumeric={currentEstimate.complexityFactor}
                    projects={selectedProjects}
                    getValue={(p) => {
                      const f = inferFactor(p);
                      return `${factorLabel(f)} · ${f.toFixed(2)}x`;
                    }}
                    getNumeric={(p) => inferFactor(p)}
                  />
                );
              })()}
            </div>

            <Separator className="my-4" />

            {/* Team breakdown per project */}
            <div>
              <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Composición del Equipo
              </p>
              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns: `180px repeat(${selectedProjects.length + 1}, 1fr)`,
                }}
              >
                <div />
                <div className="text-center text-xs text-muted-foreground">
                  —
                </div>
                {selectedProjects.map((p) => (
                  <div key={p.asunto_id} className="space-y-1">
                    {p.team.map((m) => (
                      <div
                        key={m.user_code}
                        className="flex items-center justify-between text-xs p-1.5 bg-muted/30 rounded"
                      >
                        <span className="truncate">{m.user_name}</span>
                        <Badge variant="outline" className="text-[10px] ml-1">
                          {m.hours}h
                        </Badge>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <Separator className="my-4" />

            {/* Apply buttons */}
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: `180px repeat(${selectedProjects.length + 1}, 1fr)`,
              }}
            >
              <div />
              {editingEstimate ? (
                <Button
                  size="sm"
                  className="w-full gap-1"
                  onClick={() => {
                    if (onCombineAndApply) {
                      onCombineAndApply({
                        totalHours: editedHours,
                        totalPrice: editedPrice,
                        avgRate: editedHours > 0 ? Math.round(editedPrice / editedHours) : 0,
                      });
                    }
                    setEditingEstimate(false);
                    setShowComparison(false);
                  }}
                >
                  <Zap className="h-3 w-3" />
                  Aplicar Editado
                </Button>
              ) : (
                <div />
              )}
              {selectedProjects.map((p) => (
                <Button
                  key={p.asunto_id}
                  variant="outline"
                  size="sm"
                  className="w-full gap-1"
                  onClick={() => {
                    onApplyProject(p);
                    setShowComparison(false);
                  }}
                >
                  <Zap className="h-3 w-3" />
                  Aplicar
                </Button>
              ))}
            </div>

            {/* Combine and Apply */}
            {selectedProjects.length >= 2 && combinedStats && onCombineAndApply && (
              <>
                <Separator className="my-4" />
                <div className="p-4 bg-muted/30 rounded-lg border space-y-3">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Combinar Seleccionados (Promedio de {selectedProjects.length} casos)
                  </p>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-lg font-bold">{combinedStats.totalHours}h</p>
                      <p className="text-xs text-muted-foreground">Horas</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">${combinedStats.totalPrice.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Facturación</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">${combinedStats.avgRate.toLocaleString()}/h</p>
                      <p className="text-xs text-muted-foreground">Tarifa Promedio</p>
                    </div>
                  </div>
                  <Button
                    className="w-full gap-2"
                    onClick={() => {
                      onCombineAndApply(combinedStats);
                      setShowComparison(false);
                    }}
                  >
                    <Layers className="h-4 w-4" />
                    Combinar y Aplicar
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* Comparison row sub-component */
function ComparisonRow({
  label,
  icon,
  currentValue,
  currentNumeric,
  projects,
  getValue,
  getNumeric,
  colorByValue,
  editMode,
  editValue,
  onEditChange,
  editPrefix,
  editSuffix,
}: {
  label: string;
  icon: React.ReactNode;
  currentValue?: string;
  currentNumeric: number;
  projects: HistoricalProject[];
  getValue: (p: HistoricalProject) => string;
  getNumeric: (p: HistoricalProject) => number;
  colorByValue?: boolean;
  editMode?: boolean;
  editValue?: number;
  onEditChange?: (value: number) => void;
  editPrefix?: string;
  editSuffix?: string;
}) {
  const allValues = [
    currentNumeric,
    ...projects.map((p) => getNumeric(p)),
  ].filter((v) => v > 0);
  const maxVal = allValues.length > 0 ? Math.max(...allValues) : 1;

  const barColor = (val: number) => {
    if (!colorByValue) return "bg-primary/60";
    if (val >= 30) return "bg-green-500";
    if (val >= 0) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div
      className="grid gap-4 items-center"
      style={{
        gridTemplateColumns: `180px repeat(${projects.length + 1}, 1fr)`,
      }}
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="space-y-1">
        {editMode && onEditChange ? (
          <div className="flex items-center gap-1 justify-center">
            {editPrefix && <span className="text-xs text-muted-foreground">{editPrefix}</span>}
            <Input
              type="number"
              value={editValue ?? currentNumeric}
              onChange={(e) => onEditChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="w-20 h-6 text-xs font-medium text-center"
            />
            {editSuffix && <span className="text-xs text-muted-foreground">{editSuffix}</span>}
          </div>
        ) : (
          <p className="text-sm font-medium text-center">{currentValue}</p>
        )}
        {currentNumeric > 0 && (
          <div className="w-full bg-muted rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full ${barColor(currentNumeric)}`}
              style={{ width: `${(currentNumeric / maxVal) * 100}%` }}
            />
          </div>
        )}
      </div>
      {projects.map((p) => {
        const val = getNumeric(p);
        return (
          <div key={p.asunto_id} className="space-y-1">
            <p className="text-sm font-medium text-center">{getValue(p)}</p>
            {val > 0 && (
              <div className="w-full bg-muted rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${barColor(val)}`}
                  style={{ width: `${(val / maxVal) * 100}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
