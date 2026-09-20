/**
 * PeriodPicker — preset + custom range.
 * Presets: Today, Week, Month, Quarter, YTD, Custom.
 * onChange({ preset, period_yyyymm, date_from, date_to })
 *
 * For executive dashboard: returns a `period` (YYYY-MM) for endpoints that take month-period,
 * and date_from/date_to for endpoints that take ranges. UI is mobile-friendly.
 */
import { useEffect, useState } from "react";
import { ChevronDown, Calendar } from "lucide-react";
import dayjs from "dayjs";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";

const PRESETS = [
  { id: "today", label: "Hari Ini" },
  { id: "week", label: "Minggu Ini" },
  { id: "month", label: "Bulan Ini" },
  { id: "quarter", label: "Quarter" },
  { id: "ytd", label: "YTD" },
  { id: "custom", label: "Custom" },
];

function computeRange(presetId) {
  const today = dayjs();
  switch (presetId) {
    case "today":
      return { from: today, to: today, period_yyyymm: today.format("YYYY-MM") };
    case "week": {
      const start = today.startOf("week").add(1, "day"); // Monday-based per locale id
      return { from: start, to: today, period_yyyymm: today.format("YYYY-MM") };
    }
    case "month": {
      const start = today.startOf("month");
      return { from: start, to: today, period_yyyymm: today.format("YYYY-MM") };
    }
    case "quarter": {
      const q = Math.floor(today.month() / 3);
      const start = today.month(q * 3).startOf("month");
      return { from: start, to: today, period_yyyymm: today.format("YYYY-MM") };
    }
    case "ytd": {
      const start = today.startOf("year");
      return { from: start, to: today, period_yyyymm: today.format("YYYY-MM") };
    }
    default:
      return null;
  }
}

export default function PeriodPicker({ value = "month", onChange, className }) {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState(value || "month");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (preset !== "custom") {
      const range = computeRange(preset);
      if (range) {
        const fromIso = range.from.format("YYYY-MM-DD");
        const toIso = range.to.format("YYYY-MM-DD");
        setDateFrom(fromIso);
        setDateTo(toIso);
        if (onChange) {
          onChange({
            preset,
            period: range.period_yyyymm,
            date_from: fromIso,
            date_to: toIso,
          });
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  function applyCustom() {
    if (!dateFrom || !dateTo) return;
    if (onChange) {
      onChange({
        preset: "custom",
        period: dayjs(dateTo).format("YYYY-MM"),
        date_from: dateFrom,
        date_to: dateTo,
      });
    }
    setOpen(false);
  }

  const currentLabel = (() => {
    if (preset === "custom" && dateFrom && dateTo) {
      return `${fmtDate(dateFrom)} – ${fmtDate(dateTo)}`;
    }
    return PRESETS.find(p => p.id === preset)?.label || "Pilih periode";
  })();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("glass-input rounded-full gap-2 px-4 h-9", className)}
          data-testid="period-picker"
        >
          <Calendar className="h-4 w-4" />
          <span className="text-sm font-medium">{currentLabel}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 glass-card p-3 z-50" align="start">
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={cn(
                "text-sm rounded-xl px-3 py-2 transition-colors",
                preset === p.id
                  ? "pill-active"
                  : "hover:bg-foreground/5 text-foreground",
              )}
              data-testid={`period-preset-${p.id}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="mt-3 space-y-2">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Dari</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full glass-input rounded-xl px-3 py-2 text-sm"
                data-testid="period-from"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Sampai</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-full glass-input rounded-xl px-3 py-2 text-sm"
                data-testid="period-to"
              />
            </div>
            <Button onClick={applyCustom} size="sm" className="w-full pill-active rounded-full" data-testid="period-apply">
              Terapkan
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
