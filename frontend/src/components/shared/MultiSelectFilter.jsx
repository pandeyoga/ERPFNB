/**
 * MultiSelectFilter — chip-based multi-select.
 * Props:
 *   - label (e.g. "Brand")
 *   - options: [{id, label, color?}]
 *   - value: array of ids
 *   - onChange(newIds)
 *   - testId base
 */
import { useState } from "react";
import { ChevronDown, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export default function MultiSelectFilter({
  label = "Filter",
  options = [],
  value = [],
  onChange,
  testId = "msf",
  width = 200,
}) {
  const [open, setOpen] = useState(false);
  const selected = new Set(value);
  const isAll = selected.size === 0 || selected.size === options.length;
  const selCount = selected.size;

  function toggle(id) {
    if (!onChange) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  }

  function clear() {
    if (onChange) onChange([]);
  }

  function selectAll() {
    if (onChange) onChange(options.map(o => o.id));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="glass-input rounded-full gap-2 px-4 h-9"
          data-testid={`${testId}-trigger`}
        >
          <span className="text-sm font-medium">{label}</span>
          {!isAll && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold pill-active">
              {selCount}
            </span>
          )}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="glass-card p-2 z-50"
        style={{ width }}
      >
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/50 mb-1">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={selectAll}
              className="text-[11px] text-muted-foreground hover:text-foreground"
              data-testid={`${testId}-all`}
            >
              Semua
            </button>
            <span className="text-muted-foreground">·</span>
            <button
              onClick={clear}
              className="text-[11px] text-muted-foreground hover:text-foreground"
              data-testid={`${testId}-clear`}
            >
              <X className="h-3 w-3 inline" />
            </button>
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto py-1 space-y-0.5">
          {options.length === 0 && (
            <div className="px-2 py-2 text-xs text-muted-foreground italic">Tidak ada opsi.</div>
          )}
          {options.map(opt => {
            const checked = selected.has(opt.id);
            return (
              <button
                key={opt.id}
                onClick={() => toggle(opt.id)}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors text-left",
                  checked
                    ? "bg-foreground/10"
                    : "hover:bg-foreground/5",
                )}
                data-testid={`${testId}-opt-${opt.id}`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {opt.color && (
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ background: opt.color }}
                    />
                  )}
                  <span className="truncate">{opt.label}</span>
                </div>
                {checked && <Check className="h-3.5 w-3.5 text-foreground" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
