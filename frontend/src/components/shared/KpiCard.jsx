import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import Sparkline from "@/components/shared/Sparkline";

/**
 * KpiCard — metric card dengan delta + sparkline (varian "tren" dari CompactStatCard).
 *  Tipografi & padding mengikuti token CompactStatCard (p-3, label 11px, nilai text-lg/xl).
 *  Untuk angka tanpa delta/tren gunakan CompactStatCard.
 *  Backward-compatible props: label, value, delta, hint, icon, onClick, color, testId.
 *  New optional props:
 *    - series: number[]   → renders a sparkline (trend) bottom-right
 *    - deltaLabel: string → text after the delta chip (e.g. "vs LMTD")
 *    - subtle: bool       → smaller value (for secondary KPI strips)
 *    - invertDelta: bool  → turun = baik (KPI beban/biaya): warna delta dibalik, ikon tetap ikut arah
 */
export default function KpiCard({
  label, value, delta, hint, icon: Icon, onClick,
  color = "aurora-1", testId, series, deltaLabel, subtle = false, invertDelta = false,
}) {
  const hasDelta = delta != null && !isNaN(delta);
  const positive = hasDelta && Number(delta) >= 0;
  const good = invertDelta ? !positive : positive;
  const computedTestId = testId || (label ? `kpi-${String(label).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}` : undefined);

  // Tanpa onClick dirender sebagai <div> (bukan tombol mati yang bisa di-tab).
  const Comp = onClick ? motion.button : motion.div;
  return (
    <Comp
      whileHover={onClick ? { y: -3 } : undefined}
      whileTap={onClick ? { scale: 0.99 } : undefined}
      onClick={onClick}
      data-testid={computedTestId}
      className={cn(
        "glass-card-hover relative overflow-hidden p-3 min-h-[88px] text-left w-full block group",
        onClick ? "cursor-pointer" : "cursor-default",
      )}
    >
      {/* accent wash that intensifies on hover */}
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-20 w-20 rounded-full opacity-50 blur-2xl transition-opacity duration-300 group-hover:opacity-90"
        style={{ background: `hsl(var(--${color}) / 0.18)` }}
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-2 mb-1.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground leading-tight">
          {label}
        </span>
        {Icon && (
          <div
            className="h-8 w-8 shrink-0 rounded-[calc(var(--radius)-2px)] flex items-center justify-center"
            style={{ background: `hsl(var(--${color}) / 0.15)`, color: `hsl(var(--${color}))` }}
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className={cn("relative font-semibold tracking-[-0.02em] tabular-nums leading-[1.1]", subtle ? "text-lg" : "text-lg md:text-xl")}>
        {value}
      </div>

      <div className="relative mt-1.5 flex items-end justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {hasDelta && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                good
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
            strokeClassName={positive || !hasDelta ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}
          />
        )}
      </div>
    </Comp>
  );
}
