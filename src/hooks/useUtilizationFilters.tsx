import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";

export interface UtilizationFilters {
  seniority: string | null; // e.g., "Socio", "Asociado Sr", "Asociado"
  area: string | null; // e.g., "Corporativo", "Laboral", "Litigios", "Procesal"
  month: string | null; // e.g., "2023-01", "2023-02", etc.
}

interface UtilizationFiltersContextType {
  filters: UtilizationFilters;
  setSeniorityFilter: (seniority: string | null) => void;
  setAreaFilter: (area: string | null) => void;
  setMonthFilter: (month: string | null) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
}

const UtilizationFiltersContext = createContext<
  UtilizationFiltersContextType | undefined
>(undefined);

export function UtilizationFiltersProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [filters, setFilters] = useState<UtilizationFilters>({
    seniority: null,
    area: null,
    month: null,
  });

  const setSeniorityFilter = useCallback((seniority: string | null) => {
    setFilters((prev) => {
      // If clicking the same seniority, clear it. Otherwise, set seniority and clear others
      const newSeniority = prev.seniority === seniority ? null : seniority;
      return {
        seniority: newSeniority,
        area: null, // Clear area when setting seniority
        month: null, // Clear month when setting seniority
      };
    });
  }, []);

  const setAreaFilter = useCallback((area: string | null) => {
    setFilters((prev) => {
      // If clicking the same area, clear it. Otherwise, set area and clear others
      const newArea = prev.area === area ? null : area;
      return {
        seniority: null, // Clear seniority when setting area
        area: newArea,
        month: null, // Clear month when setting area
      };
    });
  }, []);

  const setMonthFilter = useCallback((month: string | null) => {
    setFilters((prev) => {
      // If clicking the same month, clear it. Otherwise, set month and clear others
      const newMonth = prev.month === month ? null : month;
      return {
        seniority: null, // Clear seniority when setting month
        area: null, // Clear area when setting month
        month: newMonth,
      };
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      seniority: null,
      area: null,
      month: null,
    });
  }, []);

  const hasActiveFilters =
    filters.seniority !== null ||
    filters.area !== null ||
    filters.month !== null;

  return (
    <UtilizationFiltersContext.Provider
      value={{
        filters,
        setSeniorityFilter,
        setAreaFilter,
        setMonthFilter,
        clearFilters,
        hasActiveFilters,
      }}
    >
      {children}
    </UtilizationFiltersContext.Provider>
  );
}

export function useUtilizationFilters() {
  const context = useContext(UtilizationFiltersContext);
  if (context === undefined) {
    throw new Error(
      "useUtilizationFilters must be used within a UtilizationFiltersProvider"
    );
  }
  return context;
}
