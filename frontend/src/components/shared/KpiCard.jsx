import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import Sparkline from "@/components/shared/Sparkline";

/**
 * KpiCard — executive metric card (glassmorphism).
 *  Backward-compatible props: label, value, delta, hint, icon, onClick, color, testId.
 *  New optional props:
 *    - series: number[]   → renders a sparkline (trend) bottom-right
 *    - deltaLabel: string → text after the delta chip (e.g. "vs LMTD")
 *    - subtle: bool       → smaller value (for secondary KPI strips)
 */
export default function KpiCard({
  label, value, delta, hint, icon: Icon, onClick,
  color = "aurora-1", testId, series, deltaLabel, subtle = false,
}) {
  const hasDelta = delta != null && !isNaN(delta);
  const positive = hasDelta && Number(delta) >= 0;
  const computedTestId = testId || (label ? `kpi-${String(label).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}` : undefined);

  return (
    <motion.button
      whileHover={onClick ? { y: -3 } : undefined}
      whileTap={onClick ? { scale: 0.99 } : undefined}
      onClick={onClick}
      data-testid={computedTestId}
      className={cn(
        "glass-card-hover relative overflow-hidden p-4 text-left w-full block group",
        onClick ? "cursor-pointer" : "cursor-default",
      )}
    >
      {/* accent wash that intensifies on hover */}
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-20 w-20 rounded-full opacity-50 blur-2xl transition-opacity duration-300 group-hover:opacity-90"
        style={{ background: `hsl(var(--${color}) / 0.18)` }}
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-2 mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground leading-tight">
          {label}
        </span>
        {Icon && (
          <div
            className="h-8 w-8 shrink-0 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
            style={{ background: `hsl(var(--${color}) / 0.15)`, color: `hsl(var(--${color}))` }}
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className={cn("relative font-bold tracking-tight tabular-nums leading-none", subtle ? "text-lg lg:text-xl" : "text-xl lg:text-[22px]")}>
        {value}
      </div>

      <div className="relative mt-2 flex items-end justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {hasDelta && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                positive
                  ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
                  : "bg-rose-500/12 text-rose-700 dark:text-rose-400",
              )}
            >
              {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {positive ? "+" : ""}{Number(delta).toFixed(1)}%
            </span>
          )}
          {(deltaLabel || hint) && (
            <span className="truncate text-xs text-muted-foreground">{deltaLabel || hint}</span>
          )}
        </div>
        {series?.length > 1 && (
          <Sparkline
            data={series}
            width={72}
            height={26}
            strokeClassName={positive || !hasDelta ? "text-emerald-500" : "text-rose-500"}
          />
        )}
      </div>
    </motion.button>
  );
}
