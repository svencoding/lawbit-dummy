import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  X,
  Send,
  Clock,
  DollarSign,
  Briefcase,
  TrendingUp,
  ArrowRight,
  User,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * Demo-only AI assistant. Every prompt returns the same scripted answer
 * about Lucas Gómez (LGO) — the data below is real data from the mock set,
 * so all the links land on real profiles.
 */

const PROFESSIONAL = {
  name: "Lucas Gómez",
  code: "LGO",
  initials: "LG",
  category: "Asociado Sr",
  area: "Procesal",
};

const PROJECTS = [
  {
    id: 36000003,
    title: "Pacto de socios",
    client: "Analítica FusiónTec",
    area: "Corporativo",
    hours: 5254,
    cost: 945788,
    share: 55,
  },
  {
    id: 1300205,
    title: "Emisión de bonos convertibles",
    client: "ClearView Financials",
    area: "Corporativo",
    hours: 2015,
    cost: 362723,
    share: 21,
  },
  {
    id: 61700003,
    title: "Auditoría legal preventiva",
    client: "SolarFlare Systems",
    area: "Consultoría",
    hours: 1375,
    cost: 247433,
    share: 14,
  },
  {
    id: 57600001,
    title: "Consultoría en contratación pública",
    client: "SolarNest Solutions",
    area: "Consultoría",
    hours: 685,
    cost: 123323,
    share: 7,
  },
];

const MONTHLY = [
  { mes: "Sep", horas: 1506 },
  { mes: "Oct", horas: 1326 },
  { mes: "Nov", horas: 1493 },
  { mes: "Dic", horas: 806 },
  { mes: "Ene", horas: 1323 },
  { mes: "Feb", horas: 553 },
];

const SUGGESTIONS = [
  "¿En qué proyectos ha estado trabajando Lucas Gómez?",
  "¿Cuántas horas facturó el último mes?",
  "¿Quién es el profesional con más horas?",
];

const nf = new Intl.NumberFormat("es-ES");

// Mismo formato compacto en USD que usa el resto de la app ($1.7M / $945K).
function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}$${m % 1 === 0 ? m : m.toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    const k = abs / 1_000;
    return `${sign}$${k % 1 === 0 ? k : k.toFixed(1)}K`;
  }
  return `${sign}$${Math.round(abs).toLocaleString()}`;
}

type Message =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "assistant"; kind: "answer" }
  | { id: number; role: "assistant"; kind: "typing" };

export function AIAssistantWidget() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const ask = (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    setInput("");
    setBusy(true);
    setMessages((prev) => [
      ...prev,
      { id: ++idRef.current, role: "user", text: question },
      { id: ++idRef.current, role: "assistant", kind: "typing" },
    ]);
    // Scripted delay so it feels like the model is thinking.
    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev.filter((m) => !(m.role === "assistant" && m.kind === "typing")),
        { id: ++idRef.current, role: "assistant", kind: "answer" },
      ]);
      setBusy(false);
    }, 1400);
  };

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <>
      {/* Floating bubble */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Asistente IA"
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full",
          "bg-gradient-to-br from-primary to-primary/70 text-primary-foreground",
          "shadow-lg shadow-primary/30 transition-all duration-300 hover:scale-105 hover:shadow-xl",
          open && "scale-90 opacity-0 pointer-events-none",
        )}
      >
        <Sparkles className="h-6 w-6" />
        <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
        </span>
      </button>

      {/* Chat panel */}
      <div
        className={cn(
          "fixed bottom-6 right-6 z-50 flex w-[calc(100vw-3rem)] max-w-[420px] flex-col",
          "h-[min(640px,calc(100vh-6rem))] overflow-hidden rounded-2xl border border-border",
          "bg-background shadow-2xl transition-all duration-300 origin-bottom-right",
          open
            ? "scale-100 opacity-100"
            : "pointer-events-none scale-95 opacity-0",
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border bg-gradient-to-r from-primary to-primary/80 px-4 py-3 text-primary-foreground">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold leading-tight">Lawbit AI</p>
            <p className="text-[11px] text-primary-foreground/80">
              Pregunta sobre tus datos en lenguaje natural
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-md p-1.5 transition-colors hover:bg-white/15"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <p className="text-sm text-foreground">
                  Hola 👋 Soy tu asistente. Puedo responder sobre horas,
                  proyectos, clientes y rentabilidad del estudio.
                </p>
              </div>
              <div className="space-y-2">
                <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Prueba con
                </p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => ask(s)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-left text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => {
            if (m.role === "user") {
              return (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                    {m.text}
                  </div>
                </div>
              );
            }
            if (m.kind === "typing") {
              return (
                <div key={m.id} className="flex items-center gap-1.5 px-1">
                  {[0, 150, 300].map((d) => (
                    <span
                      key={d}
                      className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50"
                      style={{ animationDelay: `${d}ms` }}
                    />
                  ))}
                  <span className="ml-1 text-xs text-muted-foreground">
                    Analizando 11.481 registros de horas…
                  </span>
                </div>
              );
            }
            return <AnswerCard key={m.id} onNavigate={go} />;
          })}
        </div>

        {/* Composer */}
        <div className="border-t border-border p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pregunta lo que quieras…"
              className="h-10 rounded-full text-sm"
            />
            <Button
              type="submit"
              size="icon"
              disabled={busy || !input.trim()}
              className="h-10 w-10 shrink-0 rounded-full"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            Lawbit AI puede cometer errores. Verifica los datos importantes.
          </p>
        </div>
      </div>
    </>
  );
}

function AnswerCard({ onNavigate }: { onNavigate: (path: string) => void }) {
  const totalHours = PROJECTS.reduce((a, p) => a + p.hours, 0);
  const totalCost = PROJECTS.reduce((a, p) => a + p.cost, 0);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-muted/40 p-3.5">
        <p className="text-sm leading-relaxed text-foreground">
          <span className="font-semibold">{PROFESSIONAL.name}</span> ha
          registrado <span className="font-semibold">{nf.format(totalHours)} h</span>{" "}
          en los últimos 12 meses, concentradas en{" "}
          <span className="font-semibold">4 asuntos</span>. Más de la mitad de su
          tiempo está en un solo proyecto corporativo.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2">
        <Kpi icon={Clock} label="Horas" value={`${nf.format(totalHours)}`} />
        <Kpi icon={DollarSign} label="Producción" value={formatCurrency(totalCost)} />
        <Kpi icon={Briefcase} label="Asuntos" value="4" />
      </div>

      {/* Profile link */}
      <button
        onClick={() => onNavigate(`/user/${PROFESSIONAL.code}`)}
        className="flex w-full items-center gap-3 rounded-xl border border-border bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
      >
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
            {PROFESSIONAL.initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium">{PROFESSIONAL.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {PROFESSIONAL.category} · {PROFESSIONAL.area}
          </p>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-medium text-primary">
          <User className="h-3.5 w-3.5" />
          Ver perfil
        </div>
      </button>

      {/* Projects */}
      <div className="space-y-1.5">
        <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Proyectos por horas
        </p>
        {PROJECTS.map((p) => (
          <button
            key={p.id}
            onClick={() => onNavigate(`/dashboard/asuntos/${p.id}`)}
            className="group w-full rounded-xl border border-border bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {p.client}
                </p>
              </div>
              <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${p.share}%` }}
                />
              </div>
              <span className="text-[11px] font-semibold tabular-nums">
                {nf.format(p.hours)} h
              </span>
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {p.area}
              </Badge>
            </div>
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-border bg-background p-3">
        <div className="mb-2 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" />
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Horas por mes
          </p>
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={MONTHLY} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="hsl(var(--border))"
            />
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))" }}
              contentStyle={{
                fontSize: 11,
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--background))",
              }}
              formatter={(v: number) => [`${nf.format(v)} h`, "Horas"]}
            />
            <Bar dataKey="horas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-8 flex-1 text-xs"
          onClick={() => onNavigate("/dashboard/profesionales")}
        >
          Comparar con el equipo
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 flex-1 text-xs"
          onClick={() => onNavigate("/dashboard/reportes")}
        >
          Exportar informe
        </Button>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-2.5">
      <div className="flex items-center gap-1 text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span className="text-[10px] uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-0.5 truncate text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
