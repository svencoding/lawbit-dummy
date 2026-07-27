import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Flame,
  GitCompare,
  Table2,
  Timer,
  TimerReset,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/* ------------------------------------------------------------------ *
 * Chart palette — validated with the dataviz palette validator in
 * BOTH light and dark surfaces (lightness band, chroma floor, CVD
 * separation, normal-vision floor, contrast). Do not swap for
 * lighter tints: the 400-level Tailwind steps fail the dark band.
 * ------------------------------------------------------------------ */
const C_COSTO = "#d97706"; // amber-600  · costo interno
const C_VALOR = "#0284c7"; // sky-600    · valor trabajado
const C_INGRESO = "#059669"; // emerald-600 · ingreso / honorarios
const C_ALERT = "#dc2626"; // red-600    · exceso / margen negativo

export interface EjecucionLevel {
  level: string | number;
  label: string;
  budgetedHours: number;
  actualHours: number;
}

export interface EjecucionBurnPoint {
  key: string;
  label: string;
  costo: number;
  valor: number;
  horas: number;
}

interface ProjectEjecucionProps {
  ingreso: number;
  costoEnCurso: number;
  valorTrabajado: number;
  margen: number;
  margenPct: number;
  totalHours: number;
  budgetedHours: number;
  hourlyCost: number;
  inProgress: boolean;
  areas: string[];
  levels: EjecucionLevel[];
  burn: EjecucionBurnPoint[];
}

const money = (v: number) => {
  const abs = Math.abs(Math.round(v));
  const s = `$${abs.toLocaleString()}`;
  return v < 0 ? `−${s}` : s;
};
const moneyShort = (v: number) => {
  const abs = Math.abs(v);
  const s =
    abs >= 1000
      ? `$${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`
      : `$${Math.round(abs)}`;
  return v < 0 ? `−${s}` : s;
};
const hours = (v: number) => `${Math.round(v)}h`;

/* ------------------------------------------------------------------ *
 * Arco de progreso — consumo del budget de horas
 * ------------------------------------------------------------------ */
const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy - r * Math.sin(a)] as const;
};

const arcPath = (
  cx: number,
  cy: number,
  r: number,
  fromDeg: number,
  toDeg: number,
) => {
  const [x0, y0] = polar(cx, cy, r, fromDeg);
  const [x1, y1] = polar(cx, cy, r, toDeg);
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
};

function BudgetGauge({
  pct,
  totalHours: worked,
  budgetedHours: budget,
}: {
  pct: number;
  totalHours: number;
  budgetedHours: number;
}) {
  const CX = 160;
  const CY = 150;
  const R = 118;
  const SW = 16;
  const hasBudget = budget > 0;

  // Keep the 100% mark comfortably inside the sweep so it always reads as a
  // threshold and not as the end of the scale.
  const gaugeMax = Math.max(120, Math.ceil((pct * 1.1) / 20) * 20);
  const toDeg = (p: number) => 180 - (180 * Math.min(p, gaugeMax)) / gaugeMax;

  const over = pct > 100;
  const warn = pct > 85 && pct <= 100;
  const mainColor = over ? C_ALERT : warn ? C_COSTO : C_INGRESO;
  const [tickIn] = [polar(CX, CY, R - SW / 2 - 7, toDeg(100))];
  const [tickOut] = [polar(CX, CY, R + SW / 2 + 7, toDeg(100))];
  const [labelX, labelY] = polar(CX, CY, R + SW / 2 + 14, toDeg(100));

  return (
    <div className="relative">
      <svg
        viewBox="0 0 320 178"
        className="w-full max-w-[320px] mx-auto overflow-visible"
        role="img"
        aria-label={`${pct.toFixed(0)}% del presupuesto de horas consumido`}
      >
        {/* track */}
        <path
          d={arcPath(CX, CY, R, 180, 0)}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={SW}
          strokeLinecap="round"
        />
        {/* consumed, up to budget */}
        <path
          d={arcPath(CX, CY, R, 180, toDeg(Math.min(pct, 100)))}
          fill="none"
          stroke={mainColor}
          strokeWidth={SW}
          strokeLinecap="round"
        />
        {/* overflow beyond budget — 2px surface gap keeps the two fills apart */}
        {over && (
          <path
            d={arcPath(CX, CY, R, toDeg(100) - 1.2, toDeg(pct))}
            fill="none"
            stroke={C_ALERT}
            strokeWidth={SW}
            strokeLinecap="round"
          />
        )}
        {/* budget threshold tick */}
        {hasBudget && (
          <>
            <line
              x1={tickIn[0]}
              y1={tickIn[1]}
              x2={tickOut[0]}
              y2={tickOut[1]}
              stroke="hsl(var(--foreground))"
              strokeWidth={2}
            />
            <text
              x={labelX}
              y={labelY}
              fill="hsl(var(--muted-foreground))"
              fontSize={10}
              textAnchor={toDeg(100) > 90 ? "end" : "start"}
              dominantBaseline="middle"
            >
              presupuesto
            </text>
          </>
        )}
        {/* scale ends */}
        <text
          x={CX - R}
          y={CY + 20}
          fill="hsl(var(--muted-foreground))"
          fontSize={10}
          textAnchor="middle"
        >
          0%
        </text>
        <text
          x={CX + R}
          y={CY + 20}
          fill="hsl(var(--muted-foreground))"
          fontSize={10}
          textAnchor="middle"
        >
          {gaugeMax}%
        </text>
      </svg>

      <div className="absolute inset-x-0 top-[40%] flex flex-col items-center pointer-events-none">
        <div className="text-4xl font-bold leading-none" style={{ color: mainColor }}>
          {hasBudget ? `${pct.toFixed(0)}%` : hours(worked)}
        </div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mt-1.5">
          {hasBudget ? "presupuesto consumido" : "horas trabajadas"}
        </div>
        <div className="text-xs mt-1 tabular-nums">
          {hasBudget
            ? `${hours(worked)} de ${hours(budget)}`
            : "sin horas presupuestadas"}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Waterfall económico — Ingreso → Costo → Margen
 * ------------------------------------------------------------------ */
interface WfStep {
  key: string;
  label: string;
  sub: string;
  from: number;
  to: number;
  value: number;
  color: string;
  ink: string;
  icon: typeof Wallet;
  tip: string;
}

function Waterfall({
  ingreso,
  costo,
  margen,
  margenPct,
  totalHours: worked,
  pctBudget,
}: {
  ingreso: number;
  costo: number;
  margen: number;
  margenPct: number;
  totalHours: number;
  pctBudget: number;
}) {
  const negative = margen < 0;
  const steps: WfStep[] = [
    {
      key: "ingreso",
      label: "Ingreso",
      sub: "Honorarios acordados con el cliente",
      from: 0,
      to: ingreso,
      value: ingreso,
      color: C_INGRESO,
      ink: C_INGRESO,
      icon: Wallet,
      tip: "Honorarios acordados con el cliente para este proyecto.",
    },
    {
      key: "costo",
      label: "Costo en curso",
      sub: `${hours(worked)} trabajadas · ${pctBudget.toFixed(0)}% del presupuesto`,
      from: ingreso,
      to: ingreso - costo,
      value: -costo,
      color: C_COSTO,
      ink: C_COSTO,
      icon: Flame,
      tip: "Costo interno ya incurrido por las horas reales trabajadas. Es lo que llevamos gastado hasta hoy.",
    },
    {
      key: "margen",
      label: "Margen",
      sub: "Ingreso − Costo en curso",
      from: 0,
      to: margen,
      value: margen,
      color: negative ? C_ALERT : C_INGRESO,
      ink: negative ? C_ALERT : C_INGRESO,
      icon: negative ? TrendingDown : TrendingUp,
      tip: "Resultado real a la fecha: lo que se cobra menos lo que ya costó producirlo.",
    },
  ];

  const allY = steps.flatMap((s) => [s.from, s.to]).concat(0);
  const rawMax = Math.max(...allY);
  const rawMin = Math.min(...allY);
  const span = Math.max(rawMax - rawMin, 1);
  // Asymmetric headroom so the direct value labels sitting outside each bar end
  // always fit inside the plot box instead of spilling over the card chrome.
  const yMax = rawMax + span * 0.32;
  const yMin = rawMin - span * 0.26;
  const H = 100; // percentage space
  const pos = (v: number) => ((yMax - v) / (yMax - yMin)) * H;
  const zero = pos(0);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Cascada económica
        </p>
        <Badge
          variant="outline"
          className={`text-[10px] tabular-nums ${
            negative
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
          }`}
        >
          margen {margenPct.toFixed(1)}%
        </Badge>
      </div>

      <div className="relative flex-1 min-h-[210px]">
        {/* zero baseline */}
        <div
          className="absolute inset-x-0 border-t border-foreground/25"
          style={{ top: `${zero}%` }}
        />
        <div className="absolute inset-0 flex items-stretch gap-3 sm:gap-6">
          {steps.map((s, i) => {
            const top = pos(Math.max(s.from, s.to));
            const bottom = pos(Math.min(s.from, s.to));
            const height = Math.max(bottom - top, 1.2);
            const labelAbove = s.to >= s.from;
            const prev = steps[i - 1];
            return (
              <div key={s.key} className="relative flex-1 min-w-0">
                {/* connector: sits only in the gutter, up to this bar's edge */}
                {prev && (
                  <div
                    className="absolute -left-3 sm:-left-6 right-[86%] border-t border-border"
                    style={{ top: `${pos(prev.to)}%` }}
                  />
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="absolute left-[14%] right-[14%] rounded-[4px] transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      style={{
                        top: `${top}%`,
                        height: `${height}%`,
                        background: s.color,
                      }}
                      aria-label={`${s.label}: ${money(s.value)}`}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[15rem] text-xs">
                    <p className="font-semibold">{s.label}</p>
                    <p className="tabular-nums">{money(s.value)}</p>
                    <p className="text-muted-foreground mt-1">{s.tip}</p>
                  </TooltipContent>
                </Tooltip>

                {/* direct value label, outside the bar end */}
                <div
                  className="absolute inset-x-0 text-center pointer-events-none"
                  style={
                    labelAbove
                      ? { bottom: `${100 - top}%`, paddingBottom: 6 }
                      : { top: `${bottom}%`, paddingTop: 6 }
                  }
                >
                  <div
                    className="text-lg sm:text-xl font-bold leading-none"
                    style={{ color: s.ink }}
                  >
                    {money(s.value)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* labels row — identity is never color-alone */}
      <div className="flex items-stretch gap-3 sm:gap-6 mt-2 pt-3 border-t">
        {steps.map((s) => (
          <div key={s.key} className="flex-1 min-w-0 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <s.icon className="h-3 w-3 shrink-0" style={{ color: s.ink }} />
              <span className="text-[11px] font-medium truncate">{s.label}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
              {s.sub}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */
export function ProjectEjecucion({
  ingreso,
  costoEnCurso,
  valorTrabajado,
  margen,
  margenPct,
  totalHours,
  budgetedHours,
  hourlyCost,
  inProgress,
  areas,
  levels,
  burn,
}: ProjectEjecucionProps) {
  const [showTable, setShowTable] = useState(false);

  const pctBudget =
    budgetedHours > 0 ? (totalHours / budgetedHours) * 100 : 0;
  const excedidas = totalHours - budgetedHours;
  const capturaPct =
    valorTrabajado > 0 ? (ingreso / valorTrabajado) * 100 : 0;

  const breakpoint = useMemo(() => {
    if (ingreso <= 0) return null;
    return burn.find((p) => p.costo > ingreso) ?? null;
  }, [burn, ingreso]);

  const maxLevelHours = useMemo(
    () =>
      Math.max(
        1,
        ...levels.map((l) => Math.max(l.budgetedHours, l.actualHours)),
      ),
    [levels],
  );

  const totals = useMemo(
    () => ({
      ppto: levels.reduce((s, l) => s + l.budgetedHours, 0),
      real: levels.reduce((s, l) => s + l.actualHours, 0),
    }),
    [levels],
  );

  return (
    <div className="space-y-4">
      {/* ==================== EJECUCIÓN VS PRESUPUESTO ==================== */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <GitCompare className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Ejecución vs Presupuesto</h2>
              <p className="text-[11px] text-muted-foreground">
                Lo presupuestado contra la ejecución real, al día de hoy
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {areas.map((a) => (
              <Badge key={a} variant="secondary" className="text-[10px] px-1.5 py-0">
                {a}
              </Badge>
            ))}
            <Badge
              variant="outline"
              className={`text-[10px] ${
                inProgress
                  ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
              }`}
            >
              {inProgress ? (
                <Circle className="h-3 w-3 mr-1" />
              ) : (
                <CheckCircle2 className="h-3 w-3 mr-1" />
              )}
              {inProgress ? "En curso" : "Cerrado"}
            </Badge>
          </div>
        </div>

        {/* progress arc + waterfall */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,330px)_1fr] gap-6 lg:gap-8 px-4 py-6">
          <div className="flex flex-col justify-center">
            <BudgetGauge
              pct={pctBudget}
              totalHours={totalHours}
              budgetedHours={budgetedHours}
            />
            {excedidas > 0 && (
              <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-red-600 dark:text-red-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-semibold tabular-nums">
                    +{hours(excedidas)}
                  </span>{" "}
                  sobre lo presupuestado
                </span>
              </div>
            )}
          </div>
          <div className="lg:border-l lg:border-border/60 lg:pl-8">
            <Waterfall
              ingreso={ingreso}
              costo={costoEnCurso}
              margen={margen}
              margenPct={margenPct}
              totalHours={totalHours}
              pctBudget={pctBudget}
            />
          </div>
        </div>

        {/* hour rail + valor trabajado strip */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_minmax(0,260px)] gap-5 px-4 py-4 border-t bg-muted/20">
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Consumo de horas
              </p>
              <p className="text-[11px] tabular-nums">
                {hours(totalHours)} trabajadas · {hours(budgetedHours)}{" "}
                presupuestadas
              </p>
            </div>
            <div className="relative h-3 rounded-full bg-muted overflow-hidden flex">
              {/* budget portion */}
              <div
                className="h-full"
                style={{
                  width: `${
                    (Math.min(totalHours, budgetedHours) /
                      Math.max(totalHours, budgetedHours, 1)) *
                    100
                  }%`,
                  background: C_COSTO,
                }}
              />
              {excedidas > 0 && (
                <>
                  {/* 2px surface gap between the two fills */}
                  <div className="h-full w-[2px] bg-card" />
                  <div
                    className="h-full"
                    style={{
                      width: `${
                        (excedidas / Math.max(totalHours, budgetedHours, 1)) * 100
                      }%`,
                      background: C_ALERT,
                    }}
                  />
                </>
              )}
            </div>
            <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-[2px] shrink-0"
                  style={{ background: C_COSTO }}
                />
                <Timer className="h-3 w-3" /> Dentro de presupuesto{" "}
                <span className="tabular-nums text-foreground">
                  {hours(Math.min(totalHours, budgetedHours))}
                </span>
              </span>
              {excedidas > 0 ? (
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-[2px] shrink-0"
                    style={{ background: C_ALERT }}
                  />
                  <TimerReset className="h-3 w-3" /> Excedidas{" "}
                  <span className="tabular-nums text-red-600 dark:text-red-400 font-semibold">
                    +{hours(excedidas)}
                  </span>
                </span>
              ) : (
                budgetedHours > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-[2px] bg-muted-foreground/30 shrink-0" />
                    <TimerReset className="h-3 w-3" /> Restantes{" "}
                    <span className="tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                      {hours(-excedidas)}
                    </span>
                  </span>
                )
              )}
            </div>
          </div>

          {/* Valor trabajado — producción a tarifa cliente */}
          <div className="md:border-l md:border-border/60 md:pl-5">
            <div className="flex items-center gap-1.5">
              <Activity className="h-3 w-3" style={{ color: C_VALOR }} />
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Valor trabajado
              </p>
            </div>
            <p
              className="text-xl font-bold mt-1"
              style={{ color: C_VALOR }}
            >
              {money(valorTrabajado)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Producción a tarifa cliente
              {valorTrabajado > 0 && ingreso > 0 && (
                <>
                  {" · se cobró el "}
                  <span className="text-foreground tabular-nums">
                    {capturaPct.toFixed(0)}%
                  </span>{" "}
                  del valor generado
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ====================== BURN-UP EN EL TIEMPO ====================== */}
      {burn.length > 1 && (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center">
                <Zap className="h-3.5 w-3.5" style={{ color: C_COSTO }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Cómo se consumió el presupuesto</h3>
                <p className="text-[11px] text-muted-foreground">
                  Costo y valor acumulados mes a mes contra el ingreso acordado
                </p>
              </div>
            </div>
            {/* legend — always present for ≥2 series, with endpoint values */}
            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-[2px] shrink-0"
                  style={{ background: C_COSTO }}
                />
                Costo en curso
                <span className="font-semibold tabular-nums">
                  {money(costoEnCurso)}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-[2px] shrink-0"
                  style={{ background: C_VALOR }}
                />
                Valor trabajado
                <span className="font-semibold tabular-nums">
                  {money(valorTrabajado)}
                </span>
              </span>
            </div>
          </div>
          <div className="px-2 pt-4 pb-2">
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart
                data={burn}
                margin={{ top: 8, right: 16, bottom: 4, left: 4 }}
              >
                <defs>
                  <linearGradient id="ejec-costo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C_COSTO} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={C_COSTO} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="hsl(var(--border))"
                  strokeWidth={1}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={16}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                  tickFormatter={(v: number) => moneyShort(v)}
                />
                <RTooltip
                  cursor={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as EjecucionBurnPoint;
                    return (
                      <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                        <p className="font-semibold mb-1">{label}</p>
                        <p className="tabular-nums text-muted-foreground">
                          {hours(p.horas)} acumuladas
                        </p>
                        <p className="flex items-center gap-1.5 tabular-nums mt-1">
                          <span
                            className="h-2 w-2 rounded-[2px]"
                            style={{ background: C_COSTO }}
                          />
                          Costo {money(p.costo)}
                        </p>
                        <p className="flex items-center gap-1.5 tabular-nums">
                          <span
                            className="h-2 w-2 rounded-[2px]"
                            style={{ background: C_VALOR }}
                          />
                          Valor {money(p.valor)}
                        </p>
                      </div>
                    );
                  }}
                />
                {ingreso > 0 && (
                  <ReferenceLine
                    y={ingreso}
                    stroke={C_INGRESO}
                    strokeWidth={2}
                    label={{
                      value: `Ingreso ${money(ingreso)}`,
                      position: "insideTopLeft",
                      fill: C_INGRESO,
                      fontSize: 10,
                    }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="costo"
                  stroke={C_COSTO}
                  strokeWidth={2}
                  fill="url(#ejec-costo)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }}
                  name="Costo en curso"
                />
                <Line
                  type="monotone"
                  dataKey="valor"
                  stroke={C_VALOR}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }}
                  name="Valor trabajado"
                />
                {breakpoint && (
                  <ReferenceDot
                    x={breakpoint.label}
                    y={breakpoint.costo}
                    r={5}
                    fill={C_ALERT}
                    stroke="hsl(var(--card))"
                    strokeWidth={2}
                    label={{
                      value: "punto de quiebre",
                      position: "top",
                      fill: C_ALERT,
                      fontSize: 10,
                    }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {breakpoint && (
            <div className="px-4 py-2.5 border-t bg-red-50/60 dark:bg-red-950/20 flex items-center gap-2 text-[11px]">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
              <span className="text-red-700 dark:text-red-300">
                El costo interno superó el ingreso acordado en{" "}
                <span className="font-semibold">{breakpoint.label}</span> — desde
                ahí cada hora trabajada resta margen.
              </span>
            </div>
          )}
        </div>
      )}

      {/* ==================== DESVIACIÓN POR SENIORIDAD ==================== */}
      {levels.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center">
                <Users className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">
                  Desviación por nivel de senioridad
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Horas presupuestadas contra horas reales, y su costo
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-[2px] bg-muted-foreground/35 shrink-0" />
                  Presupuestado
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-[2px] shrink-0"
                    style={{ background: C_COSTO }}
                  />
                  Real
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-[2px] shrink-0"
                    style={{ background: C_ALERT }}
                  />
                  Exceso
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={() => setShowTable((s) => !s)}
              >
                <Table2 className="h-3.5 w-3.5 mr-1.5" />
                {showTable ? "Ver gráfico" : "Ver tabla"}
              </Button>
            </div>
          </div>

          {showTable ? (
            /* table view twin — every value reachable without color */
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30 border-b">
                    <th className="text-left p-2.5 font-medium text-muted-foreground">
                      Nivel
                    </th>
                    <th className="text-right p-2.5 font-medium text-muted-foreground">
                      Horas Ppto
                    </th>
                    <th className="text-right p-2.5 font-medium text-muted-foreground">
                      Horas Real
                    </th>
                    <th className="text-right p-2.5 font-medium text-muted-foreground">
                      {inProgress ? "Avance" : "Desv. horas"}
                    </th>
                    <th className="text-right p-2.5 font-medium text-muted-foreground">
                      Monto Ppto
                    </th>
                    <th className="text-right p-2.5 font-medium text-muted-foreground">
                      Monto Real
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {levels.map((l) => {
                    const dev =
                      l.budgetedHours > 0
                        ? ((l.actualHours - l.budgetedHours) / l.budgetedHours) * 100
                        : 0;
                    const progress =
                      l.budgetedHours > 0
                        ? (l.actualHours / l.budgetedHours) * 100
                        : 0;
                    const showProgress = inProgress && dev < 0;
                    return (
                      <tr key={String(l.level)} className="border-b last:border-0">
                        <td className="p-2.5 font-medium">{l.label}</td>
                        <td className="p-2.5 text-right tabular-nums">
                          {l.budgetedHours}h
                        </td>
                        <td className="p-2.5 text-right tabular-nums">
                          {l.actualHours}h
                        </td>
                        <td
                          className={`p-2.5 text-right tabular-nums font-semibold ${
                            dev > 5
                              ? "text-red-600 dark:text-red-400"
                              : dev < -5
                                ? "text-emerald-600 dark:text-emerald-400"
                                : ""
                          }`}
                        >
                          {showProgress
                            ? `${progress.toFixed(0)}%`
                            : `${dev > 0 ? "+" : ""}${dev.toFixed(0)}%`}
                        </td>
                        <td className="p-2.5 text-right tabular-nums">
                          {money(l.budgetedHours * hourlyCost)}
                        </td>
                        <td className="p-2.5 text-right tabular-nums">
                          {money(l.actualHours * hourlyCost)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-muted/30 font-semibold">
                    <td className="p-2.5">Total</td>
                    <td className="p-2.5 text-right tabular-nums">{totals.ppto}h</td>
                    <td className="p-2.5 text-right tabular-nums">{totals.real}h</td>
                    <td className="p-2.5" />
                    <td className="p-2.5 text-right tabular-nums">
                      {money(totals.ppto * hourlyCost)}
                    </td>
                    <td className="p-2.5 text-right tabular-nums">
                      {money(totals.real * hourlyCost)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="divide-y">
              {levels.map((l) => {
                const dev =
                  l.budgetedHours > 0
                    ? ((l.actualHours - l.budgetedHours) / l.budgetedHours) * 100
                    : 0;
                const progress =
                  l.budgetedHours > 0
                    ? (l.actualHours / l.budgetedHours) * 100
                    : 0;
                const showProgress = inProgress && dev < 0;
                const exceso = Math.max(0, l.actualHours - l.budgetedHours);
                const dentro = Math.min(l.actualHours, l.budgetedHours);
                const w = (h: number) => (h / maxLevelHours) * 100;
                const montoPpto = l.budgetedHours * hourlyCost;
                const montoReal = l.actualHours * hourlyCost;
                const deltaMonto = montoReal - montoPpto;

                return (
                  <div
                    key={String(l.level)}
                    className="px-4 py-3 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,220px)] gap-3 lg:gap-6 items-center hover:bg-muted/20 transition-colors"
                  >
                    {/* rail */}
                    <div className="min-w-0">
                      <div className="flex items-baseline justify-between gap-2 mb-1.5">
                        <span className="text-xs font-semibold truncate">
                          {l.label}
                        </span>
                        <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">
                          {l.budgetedHours}h ppto →{" "}
                          <span className="font-semibold text-foreground">
                            {l.actualHours}h real
                          </span>
                          <span
                            className={`ml-2 font-semibold ${
                              dev > 5
                                ? "text-red-600 dark:text-red-400"
                                : dev < -5
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : ""
                            }`}
                          >
                            {showProgress
                              ? `${progress.toFixed(0)}%`
                              : `${dev > 0 ? "+" : ""}${dev.toFixed(0)}%`}
                          </span>
                        </span>
                      </div>

                      {/* ghost = presupuestado */}
                      <div className="relative h-6">
                        <div
                          className="absolute top-0 h-2 rounded-[3px] bg-muted-foreground/25"
                          style={{ width: `${w(l.budgetedHours)}%` }}
                        />
                        {/* real, split at the budget threshold with a 2px surface gap */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              className="absolute top-3 left-0 h-2.5 flex focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[3px]"
                              style={{ width: `${w(l.actualHours)}%` }}
                              aria-label={`${l.label}: ${l.actualHours}h reales de ${l.budgetedHours}h presupuestadas`}
                            >
                              <span
                                className="h-full rounded-l-[3px]"
                                style={{
                                  width: `${
                                    l.actualHours > 0
                                      ? (dentro / l.actualHours) * 100
                                      : 0
                                  }%`,
                                  background: C_COSTO,
                                  borderTopRightRadius: exceso > 0 ? 0 : 3,
                                  borderBottomRightRadius: exceso > 0 ? 0 : 3,
                                }}
                              />
                              {exceso > 0 && (
                                <>
                                  <span className="h-full w-[2px] bg-card shrink-0" />
                                  <span
                                    className="h-full rounded-r-[3px] flex-1"
                                    style={{ background: C_ALERT }}
                                  />
                                </>
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <p className="font-semibold">{l.label}</p>
                            <p className="tabular-nums">
                              Ppto {l.budgetedHours}h · Real {l.actualHours}h
                            </p>
                            {exceso > 0 && (
                              <p className="tabular-nums text-red-400">
                                Exceso +{exceso}h ({money(exceso * hourlyCost)})
                              </p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                        {/* budget threshold marker */}
                        <div
                          className="absolute top-0 h-6 w-px bg-foreground/35"
                          style={{ left: `${w(l.budgetedHours)}%` }}
                        />
                      </div>
                    </div>

                    {/* montos */}
                    <div className="flex items-center justify-between lg:justify-end gap-3 lg:border-l lg:pl-6 lg:border-border/60">
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground">
                          Ppto → Real
                        </p>
                        <p className="text-xs tabular-nums">
                          <span className="text-muted-foreground">
                            {money(montoPpto)}
                          </span>
                          <span className="mx-1 text-muted-foreground">→</span>
                          <span className="font-semibold">{money(montoReal)}</span>
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] tabular-nums shrink-0 ${
                          deltaMonto > 0
                            ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                        }`}
                      >
                        {deltaMonto > 0 ? "+" : ""}
                        {money(deltaMonto)}
                      </Badge>
                    </div>
                  </div>
                );
              })}

              {/* total */}
              <div className="px-4 py-3 bg-muted/30 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,220px)] gap-3 lg:gap-6 items-center">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold">Total</span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {totals.ppto}h ppto →{" "}
                    <span className="font-semibold text-foreground">
                      {totals.real}h real
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between lg:justify-end gap-3 lg:border-l lg:pl-6 lg:border-border/60">
                  <p className="text-xs tabular-nums">
                    <span className="text-muted-foreground">
                      {money(totals.ppto * hourlyCost)}
                    </span>
                    <span className="mx-1 text-muted-foreground">→</span>
                    <span className="font-semibold">
                      {money(totals.real * hourlyCost)}
                    </span>
                  </p>
                  <Badge
                    variant="outline"
                    className={`text-[10px] tabular-nums shrink-0 ${
                      totals.real > totals.ppto
                        ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                    }`}
                  >
                    {totals.real > totals.ppto ? "+" : ""}
                    {money((totals.real - totals.ppto) * hourlyCost)}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ProjectEjecucion;
