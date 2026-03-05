import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { BudgetEntry } from "@/lib/types";

interface AnnualRow {
  area: string;
  professionalCount: number;
  annualRevenue: number;
  annualCost: number;
  utilization: number;
}

interface MonthlyRow {
  month: number;
  planned_revenue: number;
  planned_cost: number;
  target_utilization: number;
}

interface BudgetEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  allAreas: string[];
  professionalCounts: Map<string, number>;
  budgetEntries: BudgetEntry[];
  onSaveAnnual: (
    area: string,
    annualRevenue: number,
    annualCost: number,
    utilization: number,
  ) => void;
  onSaveMonthly: (
    area: string,
    data: Array<{
      month: number;
      planned_revenue: number;
      planned_cost: number;
      target_utilization: number;
    }>,
  ) => void;
}

export function BudgetEntryDialog({
  open,
  onOpenChange,
  year,
  allAreas,
  professionalCounts,
  budgetEntries,
  onSaveAnnual,
  onSaveMonthly,
}: BudgetEntryDialogProps) {
  // Annual tab state
  const [annualRows, setAnnualRows] = useState<AnnualRow[]>([]);

  // Monthly tab state
  const [selectedArea, setSelectedArea] = useState<string>("");
  const [monthlyRows, setMonthlyRows] = useState<MonthlyRow[]>([]);

  // Initialize annual rows from budget entries
  useEffect(() => {
    if (!open) return;
    const rows = allAreas.map((area) => {
      const areaEntries = budgetEntries.filter(
        (e) => e.practice_area === area,
      );
      const annualRevenue = areaEntries.reduce(
        (s, e) => s + e.planned_revenue,
        0,
      );
      const annualCost = areaEntries.reduce((s, e) => s + e.planned_cost, 0);
      const avgUtil =
        areaEntries.length > 0
          ? areaEntries.reduce((s, e) => s + e.target_utilization, 0) /
            areaEntries.length
          : 75;

      return {
        area,
        professionalCount: professionalCounts.get(area) || 0,
        annualRevenue,
        annualCost,
        utilization: Math.round(avgUtil),
      };
    });
    setAnnualRows(rows);
    if (allAreas.length > 0 && !selectedArea) {
      setSelectedArea(allAreas[0]);
    }
  }, [open, allAreas, budgetEntries, professionalCounts]);

  // Load monthly rows when area changes
  useEffect(() => {
    if (!selectedArea) return;
    const areaEntries = budgetEntries.filter(
      (e) => e.practice_area === selectedArea,
    );
    const rows: MonthlyRow[] = [];
    for (let m = 1; m <= 12; m++) {
      const entry = areaEntries.find((e) => e.month === m);
      rows.push({
        month: m,
        planned_revenue: entry?.planned_revenue || 0,
        planned_cost: entry?.planned_cost || 0,
        target_utilization: entry?.target_utilization || 75,
      });
    }
    setMonthlyRows(rows);
  }, [selectedArea, budgetEntries]);

  const handleAnnualChange = (
    idx: number,
    field: keyof Pick<AnnualRow, "annualRevenue" | "annualCost" | "utilization">,
    value: string,
  ) => {
    const num = parseFloat(value) || 0;
    setAnnualRows((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: num };
      return updated;
    });
  };

  const handleMonthlyChange = (
    idx: number,
    field: keyof Pick<MonthlyRow, "planned_revenue" | "planned_cost" | "target_utilization">,
    value: string,
  ) => {
    const num = parseFloat(value) || 0;
    setMonthlyRows((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: num };
      return updated;
    });
  };

  const handleSaveAnnual = () => {
    annualRows.forEach((row) => {
      onSaveAnnual(row.area, row.annualRevenue, row.annualCost, row.utilization);
    });
    onOpenChange(false);
  };

  const handleSaveMonthly = () => {
    if (selectedArea) {
      onSaveMonthly(selectedArea, monthlyRows);
    }
    onOpenChange(false);
  };

  const formatMonthName = (month: number) => {
    const date = new Date(year, month - 1, 1);
    return format(date, "MMMM", { locale: es });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Presupuesto {year}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="annual">
          <TabsList className="w-full">
            <TabsTrigger value="annual" className="flex-1">
              Metas Anuales
            </TabsTrigger>
            <TabsTrigger value="monthly" className="flex-1">
              Detalle Mensual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="annual" className="mt-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Área</TableHead>
                    <TableHead className="text-xs text-center">
                      Profesionales
                    </TableHead>
                    <TableHead className="text-xs">
                      Meta Ingreso Anual
                    </TableHead>
                    <TableHead className="text-xs">
                      Tope Costos Anual
                    </TableHead>
                    <TableHead className="text-xs">Utilización %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {annualRows.map((row, idx) => (
                    <TableRow key={row.area}>
                      <TableCell className="text-sm font-medium">
                        {row.area}
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {row.professionalCount}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={row.annualRevenue || ""}
                          onChange={(e) =>
                            handleAnnualChange(
                              idx,
                              "annualRevenue",
                              e.target.value,
                            )
                          }
                          className="h-8 text-sm w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={row.annualCost || ""}
                          onChange={(e) =>
                            handleAnnualChange(
                              idx,
                              "annualCost",
                              e.target.value,
                            )
                          }
                          className="h-8 text-sm w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={row.utilization || ""}
                          onChange={(e) =>
                            handleAnnualChange(
                              idx,
                              "utilization",
                              e.target.value,
                            )
                          }
                          className="h-8 text-sm w-20"
                          min={0}
                          max={100}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveAnnual}>
                Guardar y Distribuir
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="monthly" className="mt-4 space-y-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Área:</Label>
              <Select value={selectedArea} onValueChange={setSelectedArea}>
                <SelectTrigger className="w-60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allAreas.map((area) => (
                    <SelectItem key={area} value={area}>
                      {area}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Mes</TableHead>
                    <TableHead className="text-xs">Ingreso Planificado</TableHead>
                    <TableHead className="text-xs">Costo Planificado</TableHead>
                    <TableHead className="text-xs">Utilización %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyRows.map((row, idx) => (
                    <TableRow key={row.month}>
                      <TableCell className="text-sm font-medium capitalize">
                        {formatMonthName(row.month)}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={row.planned_revenue || ""}
                          onChange={(e) =>
                            handleMonthlyChange(
                              idx,
                              "planned_revenue",
                              e.target.value,
                            )
                          }
                          className="h-8 text-sm w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={row.planned_cost || ""}
                          onChange={(e) =>
                            handleMonthlyChange(
                              idx,
                              "planned_cost",
                              e.target.value,
                            )
                          }
                          className="h-8 text-sm w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={row.target_utilization || ""}
                          onChange={(e) =>
                            handleMonthlyChange(
                              idx,
                              "target_utilization",
                              e.target.value,
                            )
                          }
                          className="h-8 text-sm w-20"
                          min={0}
                          max={100}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveMonthly}>Guardar</Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
