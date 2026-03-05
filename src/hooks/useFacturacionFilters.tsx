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
  formaCobro: string | null; // Forma de cobro filter (e.g., "Honorarios Fijos", "Por Hora")
  encargado: { code: string; name: string } | null; // Encargado comercial filter
}

interface FacturacionFiltersContextType {
  filters: FacturacionFilters;
  setAreaFilter: (area: string | null) => void;
  setClientFilter: (clientName: string | null) => void;
  setFormaCobroFilter: (formaCobro: string | null) => void;
  setEncargadoFilter: (encargado: { code: string; name: string } | null) => void;
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
    formaCobro: null,
    encargado: null,
  });

  const setAreaFilter = useCallback((area: string | null) => {
    setFilters((prev) => ({
      ...prev,
      area: prev.area === area ? null : area,
    }));
  }, []);

  const setClientFilter = useCallback((clientName: string | null) => {
    setFilters((prev) => ({
      ...prev,
      clientName: prev.clientName === clientName ? null : clientName,
    }));
  }, []);

  const setFormaCobroFilter = useCallback((formaCobro: string | null) => {
    setFilters((prev) => ({
      ...prev,
      formaCobro: prev.formaCobro === formaCobro ? null : formaCobro,
    }));
  }, []);

  const setEncargadoFilter = useCallback(
    (encargado: { code: string; name: string } | null) => {
      setFilters((prev) => ({
        ...prev,
        encargado:
          prev.encargado?.code === encargado?.code ? null : encargado,
      }));
    },
    []
  );

  const clearFilters = useCallback(() => {
    setFilters({
      area: null,
      clientName: null,
      formaCobro: null,
      encargado: null,
    });
  }, []);

  const hasActiveFilters =
    filters.area !== null ||
    filters.clientName !== null ||
    filters.formaCobro !== null ||
    filters.encargado !== null;

  return (
    <FacturacionFiltersContext.Provider
      value={{
        filters,
        setAreaFilter,
        setClientFilter,
        setFormaCobroFilter,
        setEncargadoFilter,
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
