import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";

export interface ChartFilters {
  clientName: string | null;
  category: string | null; // e.g., "Socio", "Asociado Sr", "Asociado"
  feeType: string | null; // e.g., "Hourly", "Fixed", "Contingency"
}

interface ChartFiltersContextType {
  filters: ChartFilters;
  setClientFilter: (clientName: string | null) => void;
  setCategoryFilter: (category: string | null) => void;
  setFeeTypeFilter: (feeType: string | null) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
}

const ChartFiltersContext = createContext<ChartFiltersContextType | undefined>(
  undefined
);

export function ChartFiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<ChartFilters>({
    clientName: null,
    category: null,
    feeType: null,
  });

  const setClientFilter = useCallback((clientName: string | null) => {
    setFilters((prev) => {
      // If clicking the same client, clear it. Otherwise, set client and clear other filters
      const newClientName = prev.clientName === clientName ? null : clientName;
      return {
        clientName: newClientName,
        category: null, // Always clear category when setting client
        feeType: null, // Always clear feeType when setting client
      };
    });
  }, []);

  const setCategoryFilter = useCallback((category: string | null) => {
    setFilters((prev) => {
      // If clicking the same category, clear it. Otherwise, set category and clear other filters
      const newCategory = prev.category === category ? null : category;
      return {
        clientName: null, // Always clear client when setting category
        category: newCategory,
        feeType: null, // Always clear feeType when setting category
      };
    });
  }, []);

  const setFeeTypeFilter = useCallback((feeType: string | null) => {
    setFilters((prev) => {
      // If clicking the same feeType, clear it. Otherwise, set feeType and clear other filters
      const newFeeType = prev.feeType === feeType ? null : feeType;
      return {
        clientName: null, // Always clear client when setting feeType
        category: null, // Always clear category when setting feeType
        feeType: newFeeType,
      };
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      clientName: null,
      category: null,
      feeType: null,
    });
  }, []);

  const hasActiveFilters =
    filters.clientName !== null || filters.category !== null || filters.feeType !== null;

  return (
    <ChartFiltersContext.Provider
      value={{
        filters,
        setClientFilter,
        setCategoryFilter,
        setFeeTypeFilter,
        clearFilters,
        hasActiveFilters,
      }}
    >
      {children}
    </ChartFiltersContext.Provider>
  );
}

export function useChartFilters() {
  const context = useContext(ChartFiltersContext);
  if (context === undefined) {
    throw new Error(
      "useChartFilters must be used within a ChartFiltersProvider"
    );
  }
  return context;
}
