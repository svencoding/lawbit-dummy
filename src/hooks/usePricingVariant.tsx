import { useCallback, useEffect, useState } from "react";

export type PricingVariant = "classic" | "wizard";

const STORAGE_KEY = "lawbit-pricing-variant";
const CHANGE_EVENT = "lawbit-pricing-variant-change";

export const PRICING_VARIANTS: Array<{
  value: PricingVariant;
  label: string;
  description: string;
}> = [
  {
    value: "classic",
    label: "Calculadora clásica",
    description:
      "Vista completa en una sola pantalla con pestañas, parámetros y resultados en paralelo.",
  },
  {
    value: "wizard",
    label: "Asistente guiado por pasos",
    description:
      "Flujo paso a paso: área → análisis del histórico → diagnóstico → equipo sugerido → propuesta.",
  },
];

function readVariant(): PricingVariant {
  if (typeof window === "undefined") return "classic";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === "wizard" ? "wizard" : "classic";
}

/**
 * Which pricing experience to render. Persisted in localStorage and kept in
 * sync across components in the same tab through a custom event (the native
 * `storage` event only fires in *other* tabs).
 */
export function usePricingVariant() {
  const [variant, setVariantState] = useState<PricingVariant>(readVariant);

  useEffect(() => {
    const sync = () => setVariantState(readVariant());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setVariant = useCallback((next: PricingVariant) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    setVariantState(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { variant, setVariant };
}
