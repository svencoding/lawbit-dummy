import jsPDF from "jspdf";

/**
 * Colourful PDF version of the pricing wizard's proposal screen.
 * Everything the user sees in step 5 is redrawn here with jsPDF primitives
 * (instead of rasterising the DOM) so the file stays crisp and selectable.
 */

export interface ProposalPdfRow {
  label: string;
  hours: number;
  rate: number;
  subtotal: number;
  professionals: string[];
}

export interface ProposalPdfComparable {
  title: string;
  client: string;
  hours: number;
  billed: number;
  rate: number;
  margin: number;
}

export interface ProposalPdfData {
  area: string;
  complexityLabel: string;
  modelLabel: string;
  price: number;
  low: number;
  high: number;
  confidence: number;
  blendedRate: number;
  hoursTotal: number;
  cost: number;
  profit: number;
  margin: number;
  factor: number;
  rows: ProposalPdfRow[];
  comparables: ProposalPdfComparable[];
  comparablesArePicked: boolean;
}

type RGB = [number, number, number];

const INK: RGB = [15, 23, 42]; // slate-900
const MUTED: RGB = [100, 116, 139]; // slate-500
const LINE: RGB = [226, 232, 240]; // slate-200
const INDIGO: RGB = [79, 70, 229];
const VIOLET: RGB = [124, 58, 237];
const INDIGO_SOFT: RGB = [238, 242, 255];
const EMERALD: RGB = [5, 150, 105];
const EMERALD_SOFT: RGB = [236, 253, 245];
const AMBER: RGB = [217, 119, 6];
const AMBER_SOFT: RGB = [255, 251, 235];
const SLATE_SOFT: RGB = [248, 250, 252];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;

function money(n: number): string {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

function moneyShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/** jsPDF has no gradients — fake one with thin interpolated strips. */
function gradientBand(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  from: RGB,
  to: RGB,
  steps = 120,
) {
  const stripe = w / steps;
  for (let i = 0; i < steps; i++) {
    const c = mix(from, to, i / (steps - 1));
    doc.setFillColor(c[0], c[1], c[2]);
    // Overlap by a hair so no white seams show between strips
    doc.rect(x + i * stripe, y, stripe + 0.3, h, "F");
  }
}

function truncate(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && doc.getTextWidth(`${cut}…`) > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}…`;
}

export function buildProposalPdf(data: ProposalPdfData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const today = new Date().toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  let y = 0;

  /* ---------------- header band ---------------- */
  gradientBand(doc, 0, 0, PAGE_W, 44, INDIGO, VIOLET);
  // Subtle highlight blob
  doc.setFillColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: 0.08 }));
  doc.circle(180, 6, 26, "F");
  doc.setGState(doc.GState({ opacity: 1 }));

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  doc.text("Propuesta de honorarios", MARGIN, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(data.area, MARGIN, 28.5);

  doc.setFontSize(8.5);
  doc.text(
    `Generada el ${today} · Asistente de Pricing`,
    PAGE_W - MARGIN,
    28.5,
    { align: "right" },
  );

  y = 54;

  /* ---------------- hero price ---------------- */
  doc.setFillColor(...INDIGO_SOFT);
  doc.setDrawColor(199, 210, 254);
  doc.setLineWidth(0.4);
  doc.roundedRect(MARGIN, y, CONTENT_W, 36, 3, 3, "FD");

  doc.setTextColor(...INDIGO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("PRECIO RECOMENDADO", MARGIN + 8, y + 10);

  doc.setTextColor(...INK);
  doc.setFontSize(28);
  doc.text(money(data.price), MARGIN + 8, y + 24);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(
    `Rango sugerido ${moneyShort(data.low)} — ${moneyShort(data.high)}   ·   ${money(
      data.blendedRate,
    )}/h efectiva`,
    MARGIN + 8,
    y + 31,
  );

  // Confidence pill
  const pillW = 42;
  const pillX = PAGE_W - MARGIN - 8 - pillW;
  doc.setFillColor(...INDIGO);
  doc.roundedRect(pillX, y + 7, pillW, 8, 4, 4, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(`${data.confidence}% de confianza`, pillX + pillW / 2, y + 12.4, {
    align: "center",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(data.complexityLabel, PAGE_W - MARGIN - 8, y + 22, {
    align: "right",
  });
  doc.text(data.modelLabel, PAGE_W - MARGIN - 8, y + 27, { align: "right" });

  y += 44;

  /* ---------------- KPI cards ---------------- */
  const kpis: { label: string; value: string; tone: RGB; soft: RGB }[] = [
    {
      label: "Horas totales",
      value: `${data.hoursTotal} h`,
      tone: INK,
      soft: SLATE_SOFT,
    },
    {
      label: "Costo interno",
      value: moneyShort(data.cost),
      tone: INK,
      soft: SLATE_SOFT,
    },
    {
      label: "Utilidad",
      value: moneyShort(data.profit),
      tone: data.profit >= 0 ? EMERALD : [220, 38, 38],
      soft: data.profit >= 0 ? EMERALD_SOFT : [254, 242, 242],
    },
    {
      label: "Margen",
      value: `${data.margin.toFixed(1)}%`,
      tone: data.margin >= 30 ? EMERALD : AMBER,
      soft: data.margin >= 30 ? EMERALD_SOFT : AMBER_SOFT,
    },
  ];

  const gap = 4;
  const cardW = (CONTENT_W - gap * 3) / 4;
  kpis.forEach((k, i) => {
    const x = MARGIN + i * (cardW + gap);
    doc.setFillColor(k.soft[0], k.soft[1], k.soft[2]);
    doc.setDrawColor(...LINE);
    doc.roundedRect(x, y, cardW, 20, 2.5, 2.5, "FD");
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(k.label, x + 5, y + 7.5);
    doc.setTextColor(k.tone[0], k.tone[1], k.tone[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(k.value, x + 5, y + 15.5);
  });

  y += 30;

  /* ---------------- helpers for the tables ---------------- */
  // Redraws the current table's column headers when a table spills onto a new page
  let repeatHeader: (() => void) | null = null;

  const ensureSpace = (needed: number) => {
    if (y + needed <= PAGE_H - 20) return;
    doc.addPage();
    gradientBand(doc, 0, 0, PAGE_W, 6, INDIGO, VIOLET);
    y = 20;
    repeatHeader?.();
  };

  const sectionTitle = (title: string, subtitle?: string) => {
    ensureSpace(18);
    doc.setFillColor(...INDIGO);
    doc.roundedRect(MARGIN, y - 3.2, 1.6, 8, 0.8, 0.8, "F");
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, MARGIN + 5, y + 1.5);
    if (subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(subtitle, MARGIN + 5, y + 6);
      y += 4;
    }
    y += 10;
  };

  /* ---------------- breakdown by seniority ---------------- */
  sectionTitle(
    "Desglose por perfil",
    "Horas asignadas y tarifa promedio de cada nivel.",
  );

  const cols = [
    { x: MARGIN + 4, w: 74, align: "left" as const },
    { x: MARGIN + 92, w: 22, align: "right" as const },
    { x: MARGIN + 122, w: 26, align: "right" as const },
    { x: PAGE_W - MARGIN - 4, w: 30, align: "right" as const },
  ];

  const paintHeader = (labels: string[]) => {
    doc.setFillColor(241, 245, 249);
    doc.rect(MARGIN, y, CONTENT_W, 8, "F");
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    labels.forEach((label, i) => {
      const c = cols[i];
      doc.text(label, c.x, y + 5.3, { align: c.align });
    });
    y += 8;
  };

  /** Draws the header now and keeps repeating it on every page this table spans. */
  const tableHeader = (labels: string[]) => {
    repeatHeader = null;
    ensureSpace(19);
    paintHeader(labels);
    repeatHeader = () => paintHeader(labels);
  };

  tableHeader(["PERFIL", "HORAS", "TARIFA", "SUBTOTAL"]);

  const visibleRows = data.rows.filter((r) => r.hours > 0);
  visibleRows.forEach((r, i) => {
    ensureSpace(11);
    if (i % 2 === 1) {
      doc.setFillColor(...SLATE_SOFT);
      doc.rect(MARGIN, y, CONTENT_W, 11, "F");
    }
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(truncate(doc, r.label, cols[0].w), cols[0].x, y + 5);

    if (r.professionals.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text(
        truncate(doc, r.professionals.slice(0, 3).join(", "), cols[0].w),
        cols[0].x,
        y + 9,
      );
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(`${r.hours} h`, cols[1].x, y + 5, { align: "right" });
    doc.text(`${money(r.rate)}/h`, cols[2].x, y + 5, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text(money(r.subtotal), cols[3].x, y + 5, { align: "right" });

    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, y + 11, PAGE_W - MARGIN, y + 11);
    y += 11;
  });

  repeatHeader = null;

  // Complexity adjustment
  ensureSpace(9);
  doc.setFillColor(...INDIGO_SOFT);
  doc.rect(MARGIN, y, CONTENT_W, 9, "F");
  doc.setTextColor(...INDIGO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Ajuste por complejidad", cols[0].x, y + 5.8);
  doc.text(`×${data.factor.toFixed(2)}`, cols[3].x, y + 5.8, {
    align: "right",
  });
  y += 9;

  // Total
  ensureSpace(12);
  doc.setFillColor(...INK);
  doc.rect(MARGIN, y, CONTENT_W, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("TOTAL PROPUESTO", cols[0].x, y + 7.6);
  doc.setFontSize(12);
  doc.text(money(data.price), cols[3].x, y + 7.8, { align: "right" });
  y += 20;

  /* ---------------- comparables ---------------- */
  if (data.comparables.length) {
    sectionTitle(
      data.comparablesArePicked
        ? "Encargos usados como referencia"
        : `Casos comparables en ${data.area}`,
      data.comparablesArePicked
        ? "Asuntos pasados seleccionados durante el diagnóstico."
        : "Asuntos de tamaño similar ya facturados por la firma.",
    );

    tableHeader(["ENCARGO", "HORAS", "TARIFA", "FACTURADO"]);

    data.comparables.forEach((c, i) => {
      ensureSpace(11);
      if (i % 2 === 1) {
        doc.setFillColor(...SLATE_SOFT);
        doc.rect(MARGIN, y, CONTENT_W, 11, "F");
      }
      doc.setTextColor(...INK);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.text(truncate(doc, c.title, cols[0].w), cols[0].x, y + 4.8);
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text(
        truncate(doc, `${c.client} · margen ${c.margin.toFixed(0)}%`, cols[0].w),
        cols[0].x,
        y + 8.8,
      );

      doc.setTextColor(...INK);
      doc.setFontSize(8.5);
      doc.text(`${Math.round(c.hours)} h`, cols[1].x, y + 5, {
        align: "right",
      });
      doc.text(`${money(c.rate)}/h`, cols[2].x, y + 5, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.text(money(c.billed), cols[3].x, y + 5, { align: "right" });

      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, y + 11, PAGE_W - MARGIN, y + 11);
      y += 11;
    });
    repeatHeader = null;
    y += 8;
  }

  /* ---------------- footer on every page ---------------- */
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, PAGE_H - 14, PAGE_W - MARGIN, PAGE_H - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(
      "Estimación construida sobre el histórico real de la firma. Valores referenciales, sujetos a revisión.",
      MARGIN,
      PAGE_H - 9,
    );
    doc.text(`${p} / ${pages}`, PAGE_W - MARGIN, PAGE_H - 9, {
      align: "right",
    });
  }

  return doc;
}

export function downloadProposalPdf(data: ProposalPdfData) {
  const doc = buildProposalPdf(data);
  const slug = data.area
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`propuesta-${slug || "pricing"}-${stamp}.pdf`);
}
