import { useState } from "react";
import { Info, ChevronDown, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getChartColor } from "@/lib/chartColors";

interface ChartInfoModalProps {
  title: string;
  info: string;
  data: Array<{ name: string; value: number }>;
  unit?: string;
  className?: string;
  /** Maps each category name to a list of detail items (e.g. client names) */
  details?: Record<string, string[]>;
  /** Label for the detail items, e.g. "Clientes" */
  detailLabel?: string;
}

const CategoryRow = ({
  item,
  index,
  total,
  unit,
  details,
  detailLabel,
}: {
  item: { name: string; value: number };
  index: number;
  total: number;
  unit: string;
  details?: string[];
  detailLabel?: string;
}) => {
  const [expanded, setExpanded] = useState(false);
  const pct = total > 0 ? (item.value / total) * 100 : 0;
  const hasDetails = details && details.length > 0;

  return (
    <div>
      <div
        className={`flex items-center gap-3 ${hasDetails ? "cursor-pointer hover:bg-muted/50 -mx-1 px-1 rounded" : ""}`}
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        {hasDetails ? (
          expanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          )
        ) : (
          <div
            className="h-3 w-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: getChartColor(index) }}
          />
        )}
        {hasDetails && (
          <div
            className="h-3 w-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: getChartColor(index) }}
          />
        )}
        <span className="text-sm flex-1 truncate">{item.name}</span>
        <span className="text-sm font-medium tabular-nums">
          {unit === "$"
            ? `$${item.value.toLocaleString()}`
            : `${item.value.toLocaleString()}${unit ? ` ${unit}` : ""}`}
        </span>
        <span className="text-xs text-muted-foreground w-12 text-right tabular-nums">
          {pct.toFixed(1)}%
        </span>
        <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden flex-shrink-0">
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              backgroundColor: getChartColor(index),
            }}
          />
        </div>
      </div>
      {expanded && details && (
        <div className="ml-9 mt-1 mb-2 pl-3 border-l-2 border-muted">
          {detailLabel && (
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              {detailLabel} ({details.length})
            </p>
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            {details.map((name) => (
              <span key={name} className="text-xs text-muted-foreground truncate">
                {name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ChartInfoModal = ({
  title,
  info,
  data,
  unit = "",
  className = "mb-3",
  details,
  detailLabel,
}: ChartInfoModalProps) => {
  const [open, setOpen] = useState(false);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <>
      <div className={`flex items-center justify-between ${className}`}>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <button
          onClick={() => setOpen(true)}
          className="h-5 w-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">{info}</p>
          {details && (
            <p className="text-xs text-muted-foreground -mt-2 mb-3 italic">
              Haz clic en una categoría para ver el detalle.
            </p>
          )}
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {[...data]
              .sort((a, b) => b.value - a.value)
              .map((item, index) => (
                <CategoryRow
                  key={item.name}
                  item={item}
                  index={index}
                  total={total}
                  unit={unit}
                  details={details?.[item.name]}
                  detailLabel={detailLabel}
                />
              ))}
          </div>
          <div className="border-t pt-3 mt-3 flex justify-between text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold">
              {unit === "$"
                ? `$${total.toLocaleString()}`
                : `${total.toLocaleString()}${unit ? ` ${unit}` : ""}`}
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ChartInfoModal;
