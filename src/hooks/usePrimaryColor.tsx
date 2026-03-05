import { createContext, useContext, useEffect, useState, useMemo } from "react";
import {
  DEFAULT_PRIMARY,
  generateChartPalette,
  type PrimaryHSL,
} from "@/lib/chartColors";

const STORAGE_KEY = "lawbit-primary-color";

type PrimaryColorState = {
  primaryColor: PrimaryHSL;
  setPrimaryColor: (color: PrimaryHSL) => void;
  chartColors: string[];
};

const PrimaryColorContext = createContext<PrimaryColorState | undefined>(
  undefined,
);

function readStoredColor(): PrimaryHSL {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as PrimaryHSL;
  } catch {
    // ignore
  }
  return DEFAULT_PRIMARY;
}

/** Apply the primary color to CSS custom properties on :root */
function applyColorToDOM(color: PrimaryHSL) {
  const root = document.documentElement;
  const { h, s } = color;

  // Core theme variables (light mode defaults — dark mode overrides in CSS stay intact
  // because we only set the base values, and .dark overrides still reference these)
  root.style.setProperty("--primary", `${h} ${s}% 23%`);
  root.style.setProperty("--ring", `${h} ${s}% 23%`);
  root.style.setProperty("--sidebar-background", `${h} ${s}% 23%`);
  root.style.setProperty("--sidebar-accent", `${h} 50% 28%`);
  root.style.setProperty("--sidebar-border", `${h} 50% 28%`);
  root.style.setProperty(
    "--gradient-primary",
    `linear-gradient(135deg, hsl(${h} ${s}% 23%), hsl(${h} 50% 30%))`,
  );
  root.style.setProperty(
    "--shadow-elegant",
    `0 10px 30px -10px hsl(${h} ${s}% 23% / 0.3)`,
  );

  // Generate chart color CSS variables (--chart-1 through --chart-10)
  const steps = [15, 23, 32, 41, 50, 59, 68, 77, 83, 90];
  steps.forEach((lightness, i) => {
    root.style.setProperty(`--chart-${i + 1}`, `${h} ${s}% ${lightness}%`);
  });
}

export function PrimaryColorProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [primaryColor, setPrimaryColorState] =
    useState<PrimaryHSL>(readStoredColor);

  // Apply on mount and when color changes
  useEffect(() => {
    applyColorToDOM(primaryColor);
  }, [primaryColor]);

  const chartColors = useMemo(
    () => generateChartPalette(primaryColor.h, primaryColor.s, 10),
    [primaryColor],
  );

  const setPrimaryColor = (color: PrimaryHSL) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(color));
    setPrimaryColorState(color);
  };

  return (
    <PrimaryColorContext.Provider
      value={{ primaryColor, setPrimaryColor, chartColors }}
    >
      {children}
    </PrimaryColorContext.Provider>
  );
}

export const usePrimaryColor = () => {
  const context = useContext(PrimaryColorContext);
  if (context === undefined)
    throw new Error(
      "usePrimaryColor must be used within a PrimaryColorProvider",
    );
  return context;
};
