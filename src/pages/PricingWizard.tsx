import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart3,
  Brain,
  Check,
  Clock,
  Database,
  Download,
  GitCompare,
  History,
  Layers,
  RotateCcw,
  Scale,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { downloadProposalPdf } from "@/lib/pricingProposalPdf";
import {
  getAsuntos,
  getFullPricingData,
  getHistoricalProjectsByArea,
  getPricingData,
} from "@/lib/mockDataUtils";
import type { HistoricalProject } from "@/lib/mockDataUtils";
import { getAreaColor } from "@/lib/constants";

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

const STEPS = [
  { id: 0, title: "Área", subtitle: "Materia del asunto", icon: Scale },
  { id: 1, title: "Análisis", subtitle: "Histórico de la firma", icon: Database },
  { id: 2, title: "Diagnóstico", subtitle: "Perfil del encargo", icon: Brain },
  { id: 3, title: "Equipo", subtitle: "Asignación sugerida", icon: Users },
  { id: 4, title: "Propuesta", subtitle: "Precio recomendado", icon: Award },
];

type ComplexityKey = "estandar" | "compleja" | "critica";
type ModelKey = "hourly" | "fixed" | "value";

interface Answers {
  complexity: ComplexityKey;
  model: ModelKey;
}

const COMPLEXITY_FACTOR: Record<ComplexityKey, number> = {
  estandar: 1,
  compleja: 1.35,
  critica: 1.75,
};

/**
 * Share of total hours per seniority level, by complexity. A more complex
 * matter pulls hours upward into senior/partner time.
 */
const MIX_PROFILES: Record<ComplexityKey, Record<string, number>> = {
  estandar: { junior: 0.4, associate: 0.35, senior: 0.2, partner: 0.05 },
  compleja: { junior: 0.25, associate: 0.3, senior: 0.3, partner: 0.15 },
  critica: { junior: 0.15, associate: 0.25, senior: 0.35, partner: 0.25 },
};

const QUESTIONS = [
  {
    key: "complexity" as const,
    icon: Layers,
    question: "¿Qué tan complejo es el asunto?",
    hint: "Define cuánta participación senior necesita el equipo.",
    options: [
      { value: "estandar", label: "Estándar", detail: "Materia conocida, camino claro" },
      { value: "compleja", label: "Compleja", detail: "Varias aristas o contrapartes" },
      { value: "critica", label: "Crítica", detail: "Alto riesgo o precedente nuevo" },
    ],
  },
  {
    key: "model" as const,
    icon: Target,
    question: "¿Cómo se le cobrará al cliente?",
    hint: "Cambia la forma de presentar el mismo trabajo.",
    options: [
      { value: "hourly", label: "Por hora", detail: "Tarifa por profesional" },
      { value: "fixed", label: "Tarifa fija", detail: "Precio cerrado del encargo" },
      { value: "value", label: "Por valor", detail: "Ligado al resultado" },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function money(n: number): string {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

function moneyShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

/** Ease-out count-up used for the headline price reveal. */
function useCountUp(target: number, duration = 1100): number {
  const [value, setValue] = useState(0);
  const frame = useRef<number>();

  useEffect(() => {
    if (!target) {
      setValue(0);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      setValue(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [target, duration]);

  return value;
}

/* ------------------------------------------------------------------ */
/* Step 1 — analysis console                                           */
/* ------------------------------------------------------------------ */

function AnalysisConsole({
  area,
  matterCount,
  caseCount,
  professionalCount,
  onDone,
}: {
  area: string;
  matterCount: number;
  caseCount: number;
  professionalCount: number;
  onDone: () => void;
}) {
  const lines = useMemo(
    () => [
      `Conectando con el histórico de la firma…`,
      `Indexando ${matterCount.toLocaleString("es-CL")} asuntos en ${area}`,
      `Filtrando ${caseCount.toLocaleString("es-CL")} casos con horas registradas`,
      `Reconstruyendo tarifas de ${professionalCount} profesionales`,
      `Calculando dispersión de precios y márgenes`,
      `Modelo listo.`,
    ],
    [area, matterCount, caseCount, professionalCount],
  );

  const [visible, setVisible] = useState(0);

  useEffect(() => {
    setVisible(0);
    const timers = lines.map((_, i) =>
      setTimeout(() => setVisible(i + 1), 420 * (i + 1)),
    );
    const finish = setTimeout(onDone, 420 * lines.length + 500);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(finish);
    };
  }, [lines, onDone]);

  const progress = (visible / lines.length) * 100;

  return (
    <div className="rounded-2xl bg-slate-950 border border-slate-800 p-6 font-mono text-sm shadow-2xl">
      <div className="flex items-center gap-2 mb-5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
        <span className="ml-3 text-[11px] text-slate-500 tracking-wide">
          motor-de-pricing · {area.toLowerCase().replace(/\s+/g, "-")}
        </span>
      </div>

      <div className="space-y-2 min-h-[168px]">
        {lines.slice(0, visible).map((line, i) => {
          const isLast = i === lines.length - 1;
          return (
            <div
              key={line}
              className="flex items-start gap-2 animate-in fade-in slide-in-from-left-2 duration-300"
            >
              <span className={isLast ? "text-emerald-400" : "text-sky-400"}>
                {isLast ? "✓" : "›"}
              </span>
              <span className={isLast ? "text-emerald-300" : "text-slate-300"}>
                {line}
              </span>
            </div>
          );
        })}
        {visible < lines.length && (
          <div className="flex items-center gap-2 text-slate-500">
            <span className="inline-block h-3 w-2 bg-sky-400 animate-pulse" />
          </div>
        )}
      </div>

      <div className="mt-5 h-1 w-full rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2 — comparable past matters                                    */
/* ------------------------------------------------------------------ */

const SIZE_BUCKETS: { value: string; label: string; test: (h: number) => boolean }[] = [
  { value: "todos", label: "Cualquier tamaño", test: () => true },
  { value: "chico", label: "Menos de 50 h", test: (h) => h < 50 },
  { value: "medio", label: "Entre 50 y 150 h", test: (h) => h >= 50 && h <= 150 },
  { value: "grande", label: "Más de 150 h", test: (h) => h > 150 },
];

type SortKey = "similitud" | "horas" | "monto" | "margen" | "recientes";

const SORT_LABELS: Record<SortKey, string> = {
  similitud: "Más parecidos en tamaño",
  horas: "Más horas",
  monto: "Mayor facturación",
  margen: "Mejor margen",
  recientes: "Más recientes",
};

/** Small helper so a Select can express "sin filtro" without an empty value. */
const ANY = "__any__";

function ComparablesPicker({
  projects,
  anchorHours,
  selectedIds,
  onToggle,
  onClear,
}: {
  projects: HistoricalProject[];
  anchorHours: number;
  selectedIds: number[];
  onToggle: (id: number) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [projectType, setProjectType] = useState(ANY);
  const [chargeType, setChargeType] = useState(ANY);
  const [client, setClient] = useState(ANY);
  const [size, setSize] = useState("todos");
  const [sort, setSort] = useState<SortKey>("similitud");
  const [showAll, setShowAll] = useState(false);

  const options = useMemo(() => {
    const uniq = (values: (string | null)[]) =>
      Array.from(new Set(values.filter((v): v is string => !!v))).sort();
    return {
      projectTypes: uniq(projects.map((p) => p.project_type)),
      chargeTypes: uniq(projects.map((p) => p.charge_type)),
      clients: uniq(projects.map((p) => p.client_name)),
    };
  }, [projects]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const bucket = SIZE_BUCKETS.find((b) => b.value === size) ?? SIZE_BUCKETS[0];

    const rows = projects.filter((p) => {
      if (p.total_hours <= 0) return false;
      if (projectType !== ANY && p.project_type !== projectType) return false;
      if (chargeType !== ANY && p.charge_type !== chargeType) return false;
      if (client !== ANY && p.client_name !== client) return false;
      if (!bucket.test(p.total_hours)) return false;
      if (
        q &&
        !`${p.title} ${p.client_name} ${p.project_type ?? ""}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });

    const sorters: Record<SortKey, (a: HistoricalProject, b: HistoricalProject) => number> = {
      similitud: (a, b) =>
        Math.abs(a.total_hours - anchorHours) - Math.abs(b.total_hours - anchorHours),
      horas: (a, b) => b.total_hours - a.total_hours,
      monto: (a, b) => b.total_billed - a.total_billed,
      margen: (a, b) => b.profit_margin - a.profit_margin,
      recientes: (a, b) =>
        (b.start_date ?? "").localeCompare(a.start_date ?? ""),
    };

    return [...rows].sort(sorters[sort]);
  }, [projects, query, projectType, chargeType, client, size, sort, anchorHours]);

  const visible = showAll ? filtered.slice(0, 80) : filtered.slice(0, 6);
  const selectedSet = new Set(selectedIds);

  const hasFilters =
    query.trim() !== "" ||
    projectType !== ANY ||
    chargeType !== ANY ||
    client !== ANY ||
    size !== "todos";

  const resetFilters = () => {
    setQuery("");
    setProjectType(ANY);
    setChargeType(ANY);
    setClient(ANY);
    setSize("todos");
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
            <History className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">
              Compara con encargos pasados
            </p>
            <p className="text-xs text-muted-foreground">
              Busca asuntos similares y selecciona los que sirvan de referencia.
            </p>
          </div>
        </div>
        {selectedIds.length > 0 && (
          <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-transparent flex-shrink-0">
            {selectedIds.length} seleccionado
            {selectedIds.length === 1 ? "" : "s"}
          </Badge>
        )}
      </div>

      {/* Filters */}
      <div className="space-y-2.5 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por asunto, cliente o tipo…"
            className="pl-9 h-9 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <Select value={projectType} onValueChange={setProjectType}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Tipo de encargo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todo tipo de encargo</SelectItem>
              {options.projectTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={chargeType} onValueChange={setChargeType}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Forma de cobro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Toda forma de cobro</SelectItem>
              {options.chargeTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={client} onValueChange={setClient}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todos los clientes</SelectItem>
              {options.clients.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={size} onValueChange={setSize}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Tamaño" />
            </SelectTrigger>
            <SelectContent>
              {SIZE_BUCKETS.map((b) => (
                <SelectItem key={b.value} value={b.value}>
                  {b.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {filtered.length.toLocaleString("es-CL")} encargo
            {filtered.length === 1 ? "" : "s"} coinciden
          </p>
          <div className="flex items-center gap-2">
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-7 px-2 text-xs gap-1"
              >
                <X className="h-3 w-3" />
                Limpiar filtros
              </Button>
            )}
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="h-7 w-[190px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {SORT_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Results */}
      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Ningún encargo pasado coincide con esos filtros.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
          {visible.map((p) => {
            const selected = selectedSet.has(p.asunto_id);
            return (
              <button
                key={p.asunto_id}
                type="button"
                onClick={() => onToggle(p.asunto_id)}
                className={`w-full text-left rounded-lg border-2 px-3 py-2.5 flex items-center gap-3 transition-all ${
                  selected
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
                    : "border-border/60 hover:border-indigo-300 hover:bg-muted/40"
                }`}
              >
                <span
                  className={`h-4 w-4 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${
                    selected
                      ? "border-indigo-500 bg-indigo-500"
                      : "border-muted-foreground/40"
                  }`}
                >
                  {selected && <Check className="h-3 w-3 text-white" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate leading-tight">
                    {p.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {p.client_name}
                    {p.project_type ? ` · ${p.project_type}` : ""}
                    {p.charge_type ? ` · ${p.charge_type}` : ""}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold tabular-nums leading-tight">
                    {Math.round(p.total_hours)} h
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {moneyShort(p.total_billed)} · {money(p.avg_rate)}/h
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold tabular-nums w-12 text-right flex-shrink-0 ${
                    p.profit_margin >= 30 ? "text-emerald-600" : "text-amber-600"
                  }`}
                >
                  {p.profit_margin.toFixed(0)}%
                </span>
              </button>
            );
          })}
        </div>
      )}

      {filtered.length > 6 && (
        <div className="flex items-center justify-between mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll((v) => !v)}
            className="h-7 px-2 text-xs"
          >
            {showAll
              ? "Ver menos"
              : `Ver los ${Math.min(filtered.length, 80)} resultados`}
          </Button>
          {selectedIds.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-7 px-2 text-xs gap-1"
            >
              <X className="h-3 w-3" />
              Quitar selección
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

export default function PricingWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [area, setArea] = useState<string | null>(null);
  const [analysisReady, setAnalysisReady] = useState(false);
  const [answers, setAnswers] = useState<Answers>({
    complexity: "estandar",
    model: "hourly",
  });
  const [selectedComparableIds, setSelectedComparableIds] = useState<number[]>([]);
  const [teamHours, setTeamHours] = useState<Record<string, number>>({});
  const [teamTouched, setTeamTouched] = useState(false);

  const fullPricing = useMemo(() => getFullPricingData(), []);

  /* ---- areas with matter counts ---- */
  const areas = useMemo(() => {
    const counts = new Map<string, number>();
    getAsuntos().forEach((a) => {
      if (a.practice_area) {
        counts.set(a.practice_area, (counts.get(a.practice_area) || 0) + 1);
      }
    });
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, []);

  const base = useMemo(() => (area ? getPricingData(area) : null), [area]);
  const historical = useMemo<HistoricalProject[]>(
    () => (area ? getHistoricalProjectsByArea(area) : []),
    [area],
  );

  const matterCount = useMemo(
    () => areas.find((a) => a.name === area)?.count ?? 0,
    [areas, area],
  );

  /* ---- selected comparables drive the size of the engagement ---- */
  const selectedComparables = useMemo(
    () => historical.filter((h) => selectedComparableIds.includes(h.asunto_id)),
    [historical, selectedComparableIds],
  );

  /**
   * Benchmark used to size the encargo: the average of the past matters the
   * user picked, falling back to the whole area when nothing is selected.
   */
  const benchmark = useMemo(() => {
    if (!selectedComparables.length) {
      return {
        count: 0,
        hours: base?.avgHoursPerCase ?? 40,
        billed: base?.avgTotalBilled ?? 0,
        rate: base?.avgHourlyRate ?? 0,
        margin: 0,
      };
    }
    const n = selectedComparables.length;
    const avg = (fn: (p: HistoricalProject) => number) =>
      selectedComparables.reduce((s, p) => s + fn(p), 0) / n;
    return {
      count: n,
      hours: avg((p) => p.total_hours),
      billed: avg((p) => p.total_billed),
      rate: avg((p) => p.avg_rate),
      margin: avg((p) => p.profit_margin),
    };
  }, [selectedComparables, base]);

  /* ---- derived hours & team mix ---- */
  const estimatedHours = useMemo(
    () => Math.max(1, Math.round(benchmark.hours || 40)),
    [benchmark.hours],
  );

  const recommendedTeam = useMemo(() => {
    if (!base || base.seniorityLevels.length === 0) return {};
    const profile = MIX_PROFILES[answers.complexity];
    const levels = base.seniorityLevels;

    const weights = levels.map((l) => profile[l.level] ?? 0.25);
    const totalWeight = weights.reduce((s, w) => s + w, 0) || 1;

    const result: Record<string, number> = {};
    let assigned = 0;
    levels.forEach((l, i) => {
      const h = Math.round((estimatedHours * weights[i]) / totalWeight);
      result[l.level] = h;
      assigned += h;
    });
    // Push any rounding remainder onto the largest bucket
    const diff = estimatedHours - assigned;
    if (diff !== 0 && levels.length > 0) {
      const biggest = Object.entries(result).sort((a, b) => b[1] - a[1])[0][0];
      result[biggest] = Math.max(0, result[biggest] + diff);
    }
    return result;
  }, [base, answers.complexity, estimatedHours]);

  // Reset manual team edits whenever the recommendation changes
  useEffect(() => {
    setTeamHours(recommendedTeam);
    setTeamTouched(false);
  }, [recommendedTeam]);

  /* ---- pricing math (mirrors the classic calculator) ---- */
  const quote = useMemo(() => {
    if (!base || base.seniorityLevels.length === 0) return null;

    const factor = COMPLEXITY_FACTOR[answers.complexity];

    let hoursTotal = 0;
    let rawFees = 0;
    let cost = 0;
    const rows = base.seniorityLevels.map((level) => {
      const hours = teamHours[level.level] ?? 0;
      const levelCost =
        fullPricing.seniorityLevels[
          level.level as keyof typeof fullPricing.seniorityLevels
        ]?.hourlyCost ?? 0;
      hoursTotal += hours;
      rawFees += level.avgHourlyRate * hours;
      cost += levelCost * hours;
      return {
        level: level.level,
        label: level.label,
        rate: level.avgHourlyRate,
        hourlyCost: levelCost,
        hours,
        subtotal: level.avgHourlyRate * hours,
        professionals: level.professionals,
      };
    });

    let price = rawFees * factor;
    if (answers.model === "fixed") {
      // Anchor on what comparable matters actually billed, scaled by size
      const refHours = benchmark.hours > 0 ? benchmark.hours : base.avgHoursPerCase;
      const refBilled = benchmark.billed > 0 ? benchmark.billed : base.avgTotalBilled;
      const ratio = refHours > 0 ? hoursTotal / refHours : 1;
      price = refBilled * ratio * factor;
    } else if (answers.model === "value") {
      price = rawFees * factor * 1.5;
    }

    const profit = price - cost;
    const margin = price > 0 ? (profit / price) * 100 : 0;
    const blendedRate = hoursTotal > 0 ? price / hoursTotal : 0;

    // Confidence band from the spread of rates: the picked comparables when
    // there are enough of them, otherwise the whole area.
    const sample =
      selectedComparables.length > 2 ? selectedComparables : historical;
    const rates = sample.map((h) => h.avg_rate).filter((r) => r > 0);
    let spread = 0.12;
    if (rates.length > 2) {
      const mean = rates.reduce((s, r) => s + r, 0) / rates.length;
      const variance =
        rates.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / rates.length;
      spread = mean > 0 ? Math.sqrt(variance) / mean : 0.12;
    }
    spread = Math.min(Math.max(spread, 0.08), 0.25);

    // Picking comparables narrows the band and raises confidence a notch
    const confidence = Math.round(
      Math.min(
        97,
        Math.max(68, 68 + Math.log10(Math.max(base.totalCases, 1)) * 11) +
          Math.min(selectedComparables.length * 1.5, 6),
      ),
    );

    return {
      rows,
      hoursTotal,
      price,
      cost,
      profit,
      margin,
      blendedRate,
      factor,
      low: price * (1 - spread),
      high: price * (1 + spread),
      confidence,
    };
  }, [base, teamHours, answers, fullPricing, historical, selectedComparables, benchmark]);

  /* ---- comparables shown in the proposal: the picked ones, or the closest in size ---- */
  const comparables = useMemo(() => {
    if (selectedComparables.length) return selectedComparables;
    if (!historical.length || !quote) return [];
    return [...historical]
      .filter((h) => h.total_hours > 0 && h.total_billed > 0)
      .sort(
        (a, b) =>
          Math.abs(a.total_hours - quote.hoursTotal) -
          Math.abs(b.total_hours - quote.hoursTotal),
      )
      .slice(0, 3);
  }, [historical, quote, selectedComparables]);

  const animatedPrice = useCountUp(step === 4 && quote ? quote.price : 0);

  /* ---- navigation ---- */
  const goTo = useCallback((next: number) => {
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const reset = useCallback(() => {
    setArea(null);
    setAnalysisReady(false);
    setAnswers({
      complexity: "estandar",
      model: "hourly",
    });
    setSelectedComparableIds([]);
    setTeamTouched(false);
    goTo(0);
  }, [goTo]);

  const selectArea = useCallback(
    (name: string) => {
      setArea(name);
      setAnalysisReady(false);
      setSelectedComparableIds([]);
      goTo(1);
    },
    [goTo],
  );

  const toggleComparable = useCallback((id: number) => {
    setSelectedComparableIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  /* ---- export the proposal exactly as it reads on screen ---- */
  const exportPdf = useCallback(() => {
    if (!area || !quote) return;
    const optionLabel = (key: "complexity" | "model") =>
      QUESTIONS.find((q) => q.key === key)?.options.find(
        (o) => o.value === answers[key],
      )?.label ?? "";

    downloadProposalPdf({
      area,
      complexityLabel: `Complejidad: ${optionLabel("complexity")}`,
      modelLabel: `Cobro: ${optionLabel("model")}`,
      price: quote.price,
      low: quote.low,
      high: quote.high,
      confidence: quote.confidence,
      blendedRate: quote.blendedRate,
      hoursTotal: quote.hoursTotal,
      cost: quote.cost,
      profit: quote.profit,
      margin: quote.margin,
      factor: quote.factor,
      rows: quote.rows.map((r) => ({
        label: r.label,
        hours: r.hours,
        rate: r.rate,
        subtotal: r.subtotal,
        professionals: r.professionals,
      })),
      comparables: comparables.map((c) => ({
        title: c.title,
        client: c.client_name,
        hours: c.total_hours,
        billed: c.total_billed,
        rate: c.avg_rate,
        margin: c.profit_margin,
      })),
      comparablesArePicked: selectedComparables.length > 0,
    });
  }, [area, quote, answers, comparables, selectedComparables]);

  const professionalCount = base
    ? base.seniorityLevels.reduce((s, l) => s + l.professionals.length, 0)
    : 0;

  /* ------------------------------------------------------------------ */

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto pb-16">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-violet-500 to-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Asistente de Pricing
              </h1>
              <p className="text-sm text-muted-foreground">
                Construye una propuesta a partir del histórico real de la firma
              </p>
            </div>
          </div>
          {step > 0 && (
            <Button variant="ghost" size="sm" onClick={reset} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              Reiniciar
            </Button>
          )}
        </div>

        {/* Stepper */}
        <div className="flex items-center mb-10">
          {STEPS.map((s, i) => {
            const done = step > s.id;
            const active = step === s.id;
            const Icon = s.icon;
            return (
              <div key={s.id} className="flex items-center flex-1 last:flex-none">
                <button
                  type="button"
                  disabled={s.id > step}
                  onClick={() => s.id < step && goTo(s.id)}
                  className={`flex items-center gap-2.5 text-left transition-opacity ${
                    s.id < step ? "cursor-pointer" : "cursor-default"
                  } ${s.id > step ? "opacity-40" : ""}`}
                >
                  <span
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                      done
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : active
                          ? "border-indigo-500 bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 scale-110"
                          : "border-border bg-muted text-muted-foreground"
                    }`}
                  >
                    {done ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </span>
                  <span className="hidden sm:block">
                    <span
                      className={`block text-xs font-semibold leading-tight ${
                        active ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {s.title}
                    </span>
                    <span className="block text-[10px] text-muted-foreground leading-tight">
                      {s.subtitle}
                    </span>
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 h-px mx-3 bg-border relative overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-emerald-500 transition-all duration-500"
                      style={{ width: step > s.id ? "100%" : "0%" }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ---------------- STEP 0 — area ---------------- */}
        {step === 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-500">
            <h2 className="text-lg font-semibold mb-1">
              ¿En qué área de práctica es el asunto?
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Analizaremos todos los casos históricos de esa área para construir
              el precio.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {areas.map((a) => (
                <button
                  key={a.name}
                  onClick={() => selectArea(a.name)}
                  className="group relative text-left rounded-xl border border-border/60 bg-card p-4 hover:border-indigo-400 hover:shadow-lg hover:-translate-y-0.5 transition-all"
                >
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center mb-3"
                    style={{ backgroundColor: `${getAreaColor(a.name)}1a` }}
                  >
                    <Scale
                      className="h-4 w-4"
                      style={{ color: getAreaColor(a.name) }}
                    />
                  </div>
                  <p className="font-semibold text-sm mb-0.5">{a.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.count.toLocaleString("es-CL")} asuntos registrados
                  </p>
                  <ArrowRight className="absolute right-4 top-4 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ---------------- STEP 1 — analysis ---------------- */}
        {step === 1 && area && (
          <div className="animate-in fade-in duration-500 space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">
                Analizando {area}
              </h2>
              <p className="text-sm text-muted-foreground">
                Leyendo el histórico de la firma para calibrar el modelo.
              </p>
            </div>

            <AnalysisConsole
              area={area}
              matterCount={matterCount}
              caseCount={base?.totalCases ?? 0}
              professionalCount={professionalCount}
              onDone={() => setAnalysisReady(true)}
            />

            {analysisReady && base && (
              <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 space-y-5">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    {
                      label: "Casos analizados",
                      value: base.totalCases.toLocaleString("es-CL"),
                      icon: Database,
                      tone: "from-sky-500 to-blue-600",
                    },
                    {
                      label: "Horas por caso",
                      value: `${Math.round(base.avgHoursPerCase)} h`,
                      icon: Clock,
                      tone: "from-violet-500 to-purple-600",
                    },
                    {
                      label: "Tarifa promedio",
                      value: money(base.avgHourlyRate),
                      icon: TrendingUp,
                      tone: "from-emerald-500 to-teal-600",
                    },
                    {
                      label: "Ticket promedio",
                      value: moneyShort(base.avgTotalBilled),
                      icon: BarChart3,
                      tone: "from-amber-500 to-orange-600",
                    },
                  ].map((kpi) => (
                    <div
                      key={kpi.label}
                      className="rounded-xl border border-border/60 bg-card p-4"
                    >
                      <div
                        className={`h-8 w-8 rounded-lg bg-gradient-to-br ${kpi.tone} flex items-center justify-center mb-3`}
                      >
                        <kpi.icon className="h-4 w-4 text-white" />
                      </div>
                      <p className="text-xl font-bold tabular-nums leading-none">
                        {kpi.value}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {kpi.label}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/60 dark:bg-indigo-950/20 p-4 flex gap-3">
                  <Brain className="h-4 w-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    Encontramos{" "}
                    <span className="font-semibold text-foreground">
                      {base.totalCases.toLocaleString("es-CL")} casos
                    </span>{" "}
                    con horas registradas en {area}, trabajados por{" "}
                    <span className="font-semibold text-foreground">
                      {professionalCount} profesionales
                    </span>
                    . Es una base sólida para estimar. Ahora necesitamos
                    entender este encargo en particular.
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => goTo(2)} className="gap-1.5">
                    Continuar al diagnóstico
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------------- STEP 2 — questions ---------------- */}
        {step === 2 && base && (
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 space-y-5">
            <div>
              <h2 className="text-lg font-semibold mb-1">
                Cuéntanos sobre este encargo
              </h2>
              <p className="text-sm text-muted-foreground">
                Cada respuesta ajusta el equipo y la tarifa recomendada.
              </p>
            </div>

            {QUESTIONS.map((q) => (
              <div
                key={q.key}
                className="rounded-xl border border-border/60 bg-card p-5"
              >
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center">
                    <q.icon className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-tight">
                      {q.question}
                    </p>
                    <p className="text-xs text-muted-foreground">{q.hint}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {q.options.map((opt) => {
                    const selected =
                      answers[q.key] === (opt.value as never);
                    return (
                      <button
                        key={opt.value}
                        onClick={() =>
                          setAnswers((p) => ({
                            ...p,
                            [q.key]: opt.value as never,
                          }))
                        }
                        className={`rounded-lg border-2 p-3 text-left transition-all ${
                          selected
                            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 shadow-sm"
                            : "border-border/60 hover:border-indigo-300 hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-sm font-medium">
                            {opt.label}
                          </span>
                          {selected && (
                            <Check className="h-3.5 w-3.5 text-indigo-600" />
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {opt.detail}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <ComparablesPicker
              projects={historical}
              anchorHours={base.avgHoursPerCase}
              selectedIds={selectedComparableIds}
              onToggle={toggleComparable}
              onClear={() => setSelectedComparableIds([])}
            />

            {/* Benchmark from the picked matters */}
            <div
              className={`rounded-xl border p-4 flex gap-3 ${
                benchmark.count > 0
                  ? "border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/60 dark:bg-indigo-950/20"
                  : "border-border/60 bg-muted/40"
              }`}
            >
              <Target className="h-4 w-4 text-indigo-600 mt-0.5 flex-shrink-0" />
              {benchmark.count > 0 ? (
                <div className="space-y-2 w-full">
                  <p className="text-sm text-muted-foreground">
                    Usaremos{" "}
                    <span className="font-semibold text-foreground">
                      {benchmark.count} encargo
                      {benchmark.count === 1 ? "" : "s"} pasado
                      {benchmark.count === 1 ? "" : "s"}
                    </span>{" "}
                    como referencia para dimensionar este asunto.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Horas promedio", value: `${Math.round(benchmark.hours)} h` },
                      { label: "Tarifa promedio", value: money(benchmark.rate) },
                      { label: "Monto promedio", value: moneyShort(benchmark.billed) },
                      { label: "Margen promedio", value: `${benchmark.margin.toFixed(1)}%` },
                    ].map((m) => (
                      <div key={m.label}>
                        <p className="text-sm font-bold tabular-nums leading-none">
                          {m.value}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {m.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Sin encargos seleccionados usaremos el promedio del área:{" "}
                  <span className="font-semibold text-foreground">
                    {Math.round(benchmark.hours)} horas
                  </span>{" "}
                  por caso. Selecciona algunos arriba para afinar la estimación.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <Button variant="ghost" onClick={() => goTo(1)} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" />
                Volver
              </Button>
              <Button onClick={() => goTo(3)} className="gap-1.5">
                Ver equipo sugerido
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ---------------- STEP 3 — team ---------------- */}
        {step === 3 && base && quote && (
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 space-y-5">
            <div>
              <h2 className="text-lg font-semibold mb-1">
                Este es el equipo ideal para el encargo
              </h2>
              <p className="text-sm text-muted-foreground">
                Basado en cómo la firma resolvió casos parecidos. Puedes ajustar
                las horas.
              </p>
            </div>

            <div className="rounded-xl border border-violet-200 dark:border-violet-900/40 bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20 p-4 flex gap-3">
              <Sparkles className="h-4 w-4 text-violet-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                Para un asunto{" "}
                <span className="font-semibold text-foreground">
                  {answers.complexity === "estandar"
                    ? "estándar"
                    : answers.complexity === "compleja"
                      ? "complejo"
                      : "crítico"}
                </span>{" "}
                {benchmark.count > 0 ? (
                  <>
                    calibrado con{" "}
                    <span className="font-semibold text-foreground">
                      {benchmark.count} encargo
                      {benchmark.count === 1 ? "" : "s"} comparable
                      {benchmark.count === 1 ? "" : "s"}
                    </span>
                  </>
                ) : (
                  <>
                    calibrado con el promedio de{" "}
                    <span className="font-semibold text-foreground">{area}</span>
                  </>
                )}
                , estimamos{" "}
                <span className="font-semibold text-foreground">
                  {estimatedHours} horas
                </span>{" "}
                y concentramos{" "}
                <span className="font-semibold text-foreground">
                  {Math.round(
                    ((quote.rows
                      .filter((r) => r.level === "senior" || r.level === "partner")
                      .reduce((s, r) => s + r.hours, 0) || 0) /
                      Math.max(quote.hoursTotal, 1)) *
                      100,
                  )}
                  %
                </span>{" "}
                del trabajo en perfiles senior.
              </p>
            </div>

            <div className="space-y-2.5">
              {quote.rows.map((row) => (
                <div
                  key={row.level}
                  className="rounded-xl border border-border/60 bg-card p-4"
                >
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                        <Users className="h-4 w-4 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight">
                          {row.label}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {money(row.rate)}/h ·{" "}
                          {row.professionals.length} profesional
                          {row.professionals.length === 1 ? "" : "es"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold tabular-nums leading-none">
                        {row.hours} h
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {moneyShort(row.subtotal)}
                      </p>
                    </div>
                  </div>
                  <Slider
                    value={[row.hours]}
                    min={0}
                    max={Math.max(estimatedHours, row.hours) || 100}
                    step={1}
                    onValueChange={([v]) => {
                      setTeamTouched(true);
                      setTeamHours((p) => ({ ...p, [row.level]: v }));
                    }}
                  />
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/40 p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total asignado</p>
                <p className="text-lg font-bold tabular-nums">
                  {quote.hoursTotal} horas
                </p>
              </div>
              {teamTouched && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTeamHours(recommendedTeam);
                    setTeamTouched(false);
                  }}
                  className="gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Volver a la sugerencia
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <Button variant="ghost" onClick={() => goTo(2)} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" />
                Volver
              </Button>
              <Button onClick={() => goTo(4)} className="gap-1.5">
                Generar propuesta
                <Sparkles className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ---------------- STEP 4 — proposal ---------------- */}
        {step === 4 && base && quote && (
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 space-y-5">
            {/* Hero price */}
            <div className="relative overflow-hidden rounded-2xl border border-indigo-200 dark:border-indigo-900/40 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-8 text-center shadow-xl">
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_20%,white,transparent_60%)]" />
              <div className="relative">
                <Badge className="bg-white/15 text-white border-white/20 hover:bg-white/20 mb-4">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Precio recomendado · {quote.confidence}% de confianza
                </Badge>
                <p className="text-5xl font-bold text-white tabular-nums tracking-tight">
                  {money(animatedPrice)}
                </p>
                <p className="text-sm text-white/70 mt-3">
                  Rango sugerido {moneyShort(quote.low)} — {moneyShort(quote.high)}
                  {" · "}
                  {money(quote.blendedRate)}/h efectiva
                </p>
              </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  label: "Horas totales",
                  value: `${quote.hoursTotal} h`,
                  tone: "text-foreground",
                },
                {
                  label: "Costo interno",
                  value: moneyShort(quote.cost),
                  tone: "text-foreground",
                },
                {
                  label: "Utilidad",
                  value: moneyShort(quote.profit),
                  tone: quote.profit >= 0 ? "text-emerald-600" : "text-red-600",
                },
                {
                  label: "Margen",
                  value: `${quote.margin.toFixed(1)}%`,
                  tone: quote.margin >= 30 ? "text-emerald-600" : "text-amber-600",
                },
              ].map((k) => (
                <div
                  key={k.label}
                  className="rounded-xl border border-border/60 bg-card p-4"
                >
                  <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
                  <p className={`text-xl font-bold tabular-nums ${k.tone}`}>
                    {k.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Breakdown */}
            <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border/60">
                <p className="text-sm font-semibold">Desglose por perfil</p>
              </div>
              <div className="divide-y divide-border/60">
                {quote.rows
                  .filter((r) => r.hours > 0)
                  .map((r) => (
                    <div
                      key={r.level}
                      className="px-5 py-3 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{r.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.hours} h × {money(r.rate)}/h
                        </p>
                      </div>
                      <p className="text-sm font-semibold tabular-nums flex-shrink-0">
                        {money(r.subtotal)}
                      </p>
                    </div>
                  ))}
                <div className="px-5 py-3 flex items-center justify-between bg-muted/40">
                  <p className="text-sm font-medium">Ajuste por complejidad</p>
                  <p className="text-sm font-semibold tabular-nums">
                    ×{quote.factor.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Comparables */}
            {comparables.length > 0 && (
              <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
                <div className="px-5 py-3 border-b border-border/60">
                  <p className="text-sm font-semibold">
                    {selectedComparables.length
                      ? "Encargos usados como referencia"
                      : `Casos comparables en ${area}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedComparables.length
                      ? "Los que seleccionaste en el diagnóstico."
                      : "Asuntos de tamaño similar ya facturados por la firma."}
                  </p>
                </div>
                <div className="divide-y divide-border/60 max-h-[320px] overflow-y-auto">
                  {comparables.map((c) => (
                    <div
                      key={c.asunto_id}
                      className="px-5 py-3 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {c.client_name} · {Math.round(c.total_hours)} h ·{" "}
                          {money(c.avg_rate)}/h
                        </p>
                      </div>
                      <p className="text-sm font-semibold tabular-nums flex-shrink-0">
                        {moneyShort(c.total_billed)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <Button variant="ghost" onClick={() => goTo(3)} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" />
                Ajustar equipo
              </Button>
              <Button onClick={reset} variant="outline" className="gap-1.5">
                <RotateCcw className="h-4 w-4" />
                Nueva cotización
              </Button>
            </div>

            {/* Export & follow-up */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={exportPdf}
                className="group text-left rounded-xl border border-border/60 bg-card p-4 flex items-center gap-3 hover:border-indigo-400 hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                  <Download className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight">
                    Descargar propuesta en PDF
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Toda esta pantalla en un documento a color, listo para enviar.
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                type="button"
                onClick={() => navigate("/dashboard/pricing/historico")}
                className="group text-left rounded-xl border border-border/60 bg-card p-4 flex items-center gap-3 hover:border-amber-400 hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center flex-shrink-0">
                  <GitCompare className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight">
                    Ver pricing histórico y en curso
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Presupuestado vs real de todos los encargos de la firma.
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>
          </div>
        )}

        {/* Empty-data guard */}
        {step > 1 && base && base.totalCases === 0 && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 p-5 text-center">
            <p className="text-sm text-muted-foreground">
              No hay casos históricos con horas registradas en {area}. Elige otra
              área para calcular un precio.
            </p>
            <Button variant="outline" size="sm" onClick={reset} className="mt-3">
              Elegir otra área
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
