import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";

export interface FacturacionFilters {
  area: string | null; // e.g., "Corporativo", "Laboral", "Litigios", "Procesal"
  clientName: string | null; // Client name filter
}

interface FacturacionFiltersContextType {
  filters: FacturacionFilters;
  setAreaFilter: (area: string | null) => void;
  setClientFilter: (clientName: string | null) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
}

const FacturacionFiltersContext = createContext<
  FacturacionFiltersContextType | undefined
>(undefined);

export function FacturacionFiltersProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [filters, setFilters] = useState<FacturacionFilters>({
    area: null,
    clientName: null,
  });

  const setAreaFilter = useCallback((area: string | null) => {
    setFilters((prev) => {
      // If clicking the same area, clear it. Otherwise, set area and clear client
      const newArea = prev.area === area ? null : area;
      return {
        area: newArea,
        clientName: null, // Clear client when setting area
      };
    });
  }, []);

  const setClientFilter = useCallback((clientName: string | null) => {
    setFilters((prev) => {
      // If clicking the same client, clear it. Otherwise, set client and clear area
      const newClientName = prev.clientName === clientName ? null : clientName;
      return {
        area: null, // Clear area when setting client
        clientName: newClientName,
      };
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      area: null,
      clientName: null,
    });
  }, []);

  const hasActiveFilters = filters.area !== null || filters.clientName !== null;

  return (
    <FacturacionFiltersContext.Provider
      value={{
        filters,
        setAreaFilter,
        setClientFilter,
        clearFilters,
        hasActiveFilters,
      }}
    >
      {children}
    </FacturacionFiltersContext.Provider>
  );
}

export function useFacturacionFilters() {
  const context = useContext(FacturacionFiltersContext);
  if (context === undefined) {
    throw new Error(
      "useFacturacionFilters must be used within a FacturacionFiltersProvider"
    );
  }
  return context;
}
