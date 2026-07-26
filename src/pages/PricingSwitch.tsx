import { usePricingVariant } from "@/hooks/usePricingVariant";
import Pricing from "./Pricing";
import PricingWizard from "./PricingWizard";

/**
 * Renders whichever pricing experience is selected in Settings.
 * Both variants read the same historical data and produce comparable numbers.
 */
export default function PricingSwitch() {
  const { variant } = usePricingVariant();
  return variant === "wizard" ? <PricingWizard /> : <Pricing />;
}
