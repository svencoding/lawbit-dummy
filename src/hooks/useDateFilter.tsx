import { createContext, useContext, useState, ReactNode } from "react";

interface DateFilterContextType {
  startDate: Date | undefined;
  endDate: Date | undefined;
  setStartDate: (date: Date | undefined) => void;
  setEndDate: (date: Date | undefined) => void;
  clearDates: () => void;
}

const DateFilterContext = createContext<DateFilterContextType | undefined>(
  undefined
);

export const DateFilterProvider = ({ children }: { children: ReactNode }) => {
  const [startDate, setStartDate] = useState<Date | undefined>(
    new Date(2025, 0, 1)
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    new Date(2025, 11, 31)
  );

  const clearDates = () => {
    setStartDate(undefined);
    setEndDate(undefined);
  };

  return (
    <DateFilterContext.Provider
      value={{
        startDate,
        endDate,
        setStartDate,
        setEndDate,
        clearDates,
      }}
    >
      {children}
    </DateFilterContext.Provider>
  );
};

export const useDateFilter = () => {
  const context = useContext(DateFilterContext);
  if (!context) {
    throw new Error("useDateFilter must be used within a DateFilterProvider");
  }
  return context;
};
