/**
 * Centralized chart color system.
 * Generates palettes from a single primary HSL hue+saturation,
 * varying lightness to create cohesive chart visuals.
 */

export interface PrimaryHSL {
  h: number;
  s: number;
}

/** Default primary color (navy blue matching the existing design) */
export const DEFAULT_PRIMARY: PrimaryHSL = { h: 210, s: 55 };

/** Lightness steps for chart palette — from darkest to lightest */
const LIGHTNESS_STEPS = [20, 30, 40, 50, 60, 70, 80];

/**
 * Generate an array of HSL color strings from a single hue+saturation,
 * varying the lightness evenly.
 */
export function generateChartPalette(
  hue: number,
  saturation: number,
  count: number = LIGHTNESS_STEPS.length,
): string[] {
  if (count <= LIGHTNESS_STEPS.length) {
    // Distribute evenly across the available lightness steps
    const step = (LIGHTNESS_STEPS.length - 1) / Math.max(count - 1, 1);
    return Array.from({ length: count }, (_, i) => {
      const idx = Math.round(i * step);
      return `hsl(${hue} ${saturation}% ${LIGHTNESS_STEPS[idx]}%)`;
    });
  }

  // For more than 7 colors, interpolate between 18% and 82% lightness
  return Array.from({ length: count }, (_, i) => {
    const lightness = 18 + (i / Math.max(count - 1, 1)) * 64;
    return `hsl(${hue} ${saturation}% ${Math.round(lightness)}%)`;
  });
}

/**
 * Returns an HSL string referencing a CSS custom property --chart-N.
 * These are set dynamically by the PrimaryColorProvider.
 */
export function getChartColor(index: number): string {
  const varIndex = (index % 10) + 1;
  return `hsl(var(--chart-${varIndex}))`;
}

/**
 * Preset color options for the Settings color picker.
 */
export const COLOR_PRESETS: { label: string; hsl: PrimaryHSL }[] = [
  { label: "Azul Marino", hsl: { h: 210, s: 55 } },
  { label: "Indigo", hsl: { h: 235, s: 55 } },
  { label: "Violeta", hsl: { h: 270, s: 50 } },
  { label: "Esmeralda", hsl: { h: 160, s: 55 } },
  { label: "Teal", hsl: { h: 180, s: 50 } },
  { label: "Rosa", hsl: { h: 340, s: 55 } },
  { label: "Pizarra", hsl: { h: 220, s: 15 } },
  { label: "Ámbar", hsl: { h: 25, s: 70 } },
];
