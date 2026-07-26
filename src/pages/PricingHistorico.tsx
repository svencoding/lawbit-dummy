import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  GitCompare,
  Search,
  X,
} from "lucide-react";
import {
  budgetDeviationPct,
  getBudgetVsActualComparison,
  isUnderRecovery,
} from "@/lib/mockDataUtils";
import type { BudgetVsActualRow } from "@/lib/mockDataUtils";
import { getAreaColor } from "@/lib/constants";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const ANY = "__any__";

function money(n: number): string {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

function moneyShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

const deviationOf = budgetDeviationPct;

function monthLabel(date: string): string {
  const d = date ? new Date(date) : null;
  return d && !isNaN(d.getTime())
    ? d.toLocaleDateString("es-ES", { month: "short", year: "numeric" })
    : "";
}

type SortField =
  | "activity"
  | "budgetedPrice"
  | "actualPrice"
  | "deviation"
  | "actualHours"
  | "project"
  | "date";

const NUMERIC_FIELDS: SortField[] = [
  "activity",
  "budgetedPrice",
  "actualPrice",
  "deviation",
  "actualHours",
  "date",
];

/* ------------------------------------------------------------------ */

export default function PricingHistorico() {
  const navigate = useNavigate();

  // Full history — the wizard/classic views only surface the first page of it
  const rows = useMemo<BudgetVsActualRow[]>(
    () => getBudgetVsActualComparison(Number.MAX_SAFE_INTEGER),
    [],
  );

  const [query, setQuery] = useState("");
  const [area, setArea] = useState(ANY);
  const [status, setStatus] = useState<"all" | "completed" | "in_progress">(
    "all",
  );
  // Starts in the same order as the "Presupuestado vs Real" table on /pricing —
  // most recent activity first — so both views open on the same rows.
  const [sortField, setSortField] = useState<SortField>("activity");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const areas = useMemo(
    () => Array.from(new Set(rows.map((r) => r.area).filter(Boolean))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (area !== ANY && r.area !== area) return false;
      if (status !== "all" && r.status !== status) return false;
      if (q && !`${r.project} ${r.displayId} ${r.area}`.toLowerCase().includes(q))
        return false;
      return true;
    });

    const value = (r: BudgetVsActualRow): number | string => {
      switch (sortField) {
        case "activity":
          return r.lastActivity;
        case "deviation":
          return deviationOf(r);
        case "project":
          return r.project.toLowerCase();
        case "date":
          return r.date ? new Date(r.date).getTime() : 0;
        default:
          return r[sortField];
      }
    };

    return [...list].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      if (typeof va === "string" || typeof vb === "string") {
        const cmp = String(va).localeCompare(String(vb));
        return sortDir === "asc" ? cmp : -cmp;
      }
      return sortDir === "asc" ? va - vb : vb - va;
    });
  }, [rows, query, area, status, sortField, sortDir]);

  const stats = useMemo(() => {
    // Three mutually exclusive buckets that add up to the row count. Matters
    // that never invoiced are kept apart: with no real to compare against they
    // would drag every average to -100%.
    const unbilled = filtered.filter((r) => r.actualPrice <= 0);
    const completed = filtered.filter(
      (r) => r.status === "completed" && r.actualPrice > 0,
    );
    const inProgress = filtered.filter(
      (r) => r.status === "in_progress" && r.actualPrice > 0,
    );
    const totalBudgeted = completed.reduce((s, r) => s + r.budgetedPrice, 0);
    const totalActual = completed.reduce((s, r) => s + r.actualPrice, 0);
    return {
      completed: completed.length,
      inProgress: inProgress.length,
      unbilled: unbilled.length,
      totalBudgeted,
      totalActual,
      avgDeviation:
        totalBudgeted > 0
          ? ((totalActual - totalBudgeted) / totalBudgeted) * 100
          : 0,
      budgetedHours: completed.reduce((s, r) => s + r.budgetedHours, 0),
      actualHours: completed.reduce((s, r) => s + r.actualHours, 0),
      openValue: inProgress.reduce((s, r) => s + r.budgetedPrice, 0),
    };
  }, [filtered]);

  const toggleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortDir(NUMERIC_FIELDS.includes(field) ? "desc" : "asc");
  };

  const hasFilters = query.trim() !== "" || area !== ANY || status !== "all";

  const SortHeader = ({
    field,
    label,
    align = "right",
  }: {
    field: SortField;
    label: string;
    align?: "left" | "right" | "center";
  }) => (
    <th
      className={`p-3 text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors text-${align}`}
      onClick={() => toggleSort(field)}
    >
      <span
        className={`inline-flex items-center gap-1 ${
          align === "right" ? "flex-row-reverse" : ""
        }`}
      >
        {label}
        {sortField === field &&
          (sortDir === "asc" ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          ))}
      </span>
    </th>
  );

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto pb-16">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-orange-500 to-amber-600 p-2.5 rounded-xl shadow-lg shadow-amber-500/20">
              <GitCompare className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Pricing histórico y en curso
              </h1>
              <p className="text-sm text-muted-foreground">
                Encargos con facturación registrada, contra lo presupuestado
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard/pricing")}
            className="gap-1.5 flex-shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver al pricing
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50">
            <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium mb-1">
              Total presupuestado
            </p>
            <p className="text-xl font-bold text-blue-900 dark:text-blue-100 tabular-nums">
              {money(stats.totalBudgeted)}
            </p>
            <p className="text-[11px] text-blue-600/70 dark:text-blue-400/70 mt-1">
              {stats.completed} encargos cerrados
            </p>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mb-1">
              Total real
            </p>
            <p className="text-xl font-bold text-emerald-900 dark:text-emerald-100 tabular-nums">
              {money(stats.totalActual)}
            </p>
            <p className="text-[11px] text-emerald-600/70 dark:text-emerald-400/70 mt-1">
              {stats.budgetedHours.toLocaleString("es-CL")} h ppto ·{" "}
              {stats.actualHours.toLocaleString("es-CL")} h reales
            </p>
          </div>
          <div
            className={`p-4 rounded-xl border ${
              stats.avgDeviation > 0
                ? "bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/50"
                : "bg-green-50 dark:bg-green-950/30 border-green-100 dark:border-green-900/50"
            }`}
          >
            <p
              className={`text-[11px] font-medium mb-1 ${
                stats.avgDeviation > 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-green-600 dark:text-green-400"
              }`}
            >
              Desviación promedio
            </p>
            <p
              className={`text-xl font-bold tabular-nums flex items-center gap-1 ${
                stats.avgDeviation > 0
                  ? "text-red-900 dark:text-red-100"
                  : "text-green-900 dark:text-green-100"
              }`}
            >
              {stats.avgDeviation > 0 ? (
                <ArrowUpRight className="h-4 w-4" />
              ) : (
                <ArrowDownRight className="h-4 w-4" />
              )}
              {Math.abs(stats.avgDeviation).toFixed(1)}%
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Real vs presupuestado
            </p>
          </div>
          <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/50">
            <p className="text-[11px] text-purple-600 dark:text-purple-400 font-medium mb-1">
              En curso
            </p>
            <p className="text-xl font-bold text-purple-900 dark:text-purple-100 tabular-nums">
              {stats.inProgress}
            </p>
            <p className="text-[11px] text-purple-600/70 dark:text-purple-400/70 mt-1">
              {moneyShort(stats.openValue)} presupuestados abiertos
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por proyecto, código o área…"
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Select value={area} onValueChange={setArea}>
            <SelectTrigger className="h-9 w-full sm:w-[190px] text-xs">
              <SelectValue placeholder="Área" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todas las áreas</SelectItem>
              {areas.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as typeof status)}
          >
            <SelectTrigger className="h-9 w-full sm:w-[160px] text-xs">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="completed">Cerrados</SelectItem>
              <SelectItem value="in_progress">En curso</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-1 text-xs"
              onClick={() => {
                setQuery("");
                setArea(ANY);
                setStatus("all");
              }}
            >
              <X className="h-3 w-3" />
              Limpiar
            </Button>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
          <span>{filtered.length.toLocaleString("es-CL")} encargos</span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            {stats.completed} cerrados
          </span>
          <span className="flex items-center gap-1">
            <Circle className="h-3 w-3 text-blue-500" />
            {stats.inProgress} en curso
          </span>
          {stats.unbilled > 0 && (
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-amber-500" />
              {stats.unbilled} sin facturar
            </span>
          )}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border/60 overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border/60">
                  <SortHeader field="project" label="Proyecto" align="left" />
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">
                    Área
                  </th>
                  <SortHeader field="budgetedPrice" label="Presupuestado" />
                  <SortHeader field="actualPrice" label="Real" />
                  <SortHeader field="actualHours" label="Horas" />
                  <SortHeader field="deviation" label="Desviación" />
                  <th className="p-3 text-center text-xs font-medium text-muted-foreground">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const deviation = deviationOf(item);
                  const progressPct =
                    item.budgetedPrice > 0
                      ? Math.min(100, (item.actualPrice / item.budgetedPrice) * 100)
                      : 0;
                  const isAlert = isUnderRecovery(item);
                  const isUnbilled = item.actualPrice <= 0;
                  const dateLabel = monthLabel(item.date);

                  return (
                    <tr
                      key={item.asuntoId}
                      className="border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() =>
                        navigate(`/dashboard/asuntos/${item.asuntoId}`)
                      }
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-xs leading-tight">
                            {item.project}
                          </p>
                          {isAlert && (
                            <AlertTriangle className="h-3 w-3 text-red-600 dark:text-red-400 shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {item.displayId}
                          {dateLabel ? ` · ${dateLabel}` : ""}
                        </p>
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        <Badge
                          variant="outline"
                          className="text-[10px] font-normal"
                          style={{
                            borderColor: `${getAreaColor(item.area)}55`,
                            color: getAreaColor(item.area),
                          }}
                        >
                          {item.area}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <p className="font-medium text-xs tabular-nums">
                          {money(item.budgetedPrice)}
                        </p>
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          {item.budgetedHours}h
                        </p>
                      </td>
                      <td className="p-3 text-right">
                        {isUnbilled ? (
                          <>
                            <p className="font-medium text-xs tabular-nums text-muted-foreground">
                              {money(item.accruedCost)}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              costo en curso
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="font-medium text-xs tabular-nums">
                              {money(item.actualPrice)}
                            </p>
                            <p className="text-[11px] text-muted-foreground tabular-nums">
                              {money(item.actualRate)}/h
                            </p>
                          </>
                        )}
                      </td>
                      <td className="p-3 text-right text-xs tabular-nums">
                        {item.actualHours.toLocaleString("es-CL")} h
                      </td>
                      <td className="p-3 text-right">
                        {isUnbilled ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : item.status === "completed" || deviation > 0 ? (
                          <span
                            className={`text-xs font-semibold tabular-nums ${
                              deviation > 5
                                ? "text-red-600"
                                : deviation < -5
                                  ? "text-emerald-600"
                                  : "text-foreground"
                            }`}
                          >
                            {deviation > 0 ? "+" : ""}
                            {deviation.toFixed(1)}%
                          </span>
                        ) : (
                          <div className="space-y-1">
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {progressPct.toFixed(0)}%
                            </span>
                            <div className="w-full bg-muted rounded-full h-1.5">
                              <div
                                className="bg-blue-500 h-1.5 rounded-full"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {isUnbilled ? (
                          <Badge
                            variant="secondary"
                            className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px]"
                          >
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Sin facturar
                          </Badge>
                        ) : item.status === "completed" ? (
                          <Badge
                            variant="secondary"
                            className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px]"
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Cerrado
                          </Badge>
                        ) : isAlert ? (
                          <Badge
                            variant="secondary"
                            className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px]"
                          >
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Alerta
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[10px]"
                          >
                            <Circle className="h-3 w-3 mr-1" />
                            En curso
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="p-8 text-center text-sm text-muted-foreground"
                    >
                      Ningún encargo coincide con esos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground mt-3 text-center italic">
          Real = facturación registrada del asunto, la misma fuente que alimenta
          Facturación. Las horas son horas facturables. Solo se listan encargos
          con facturación registrada. Haz clic en una fila para abrir el asunto.
        </p>
      </div>
    </DashboardLayout>
  );
}
