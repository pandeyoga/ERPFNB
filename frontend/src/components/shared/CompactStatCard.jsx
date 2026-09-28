/**
 * CompactStatCard — the canonical dense stat/KPI tile (Phase 2 density).
 *
 * One component to replace the various bespoke stat tiles across dashboards.
 * Supports two sizes (sm/md), optional click (renders as a button with a hover
 * chevron affordance), a corner count badge, a loading skeleton, and an optional
 * trend line. Colors use the aurora CSS variables.
 */
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export default function CompactStatCard({
  label,
  value,
  sub,
  icon: Icon,
  color = "aurora-1",
  onClick,
  badge,
  loading = false,
  size = "md",
  testId,
  testIdPrefix = "stat",
  className,
}) {
  const pad = size === "sm" ? "p-3" : "p-4";
  const valueCls = size === "sm" ? "text-lg" : "text-xl lg:text-[22px]";
  const iconBox = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const iconSize = size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]";
  const clickable = typeof onClick === "function";

  const tid = testId || `${testIdPrefix}-${label?.toLowerCase().replace(/\s+/g, "-")}`;

  const inner = (
    <>
      {badge !== undefined && badge !== null && badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 h-5 min-w-5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center px-1">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      <div className="flex items-start justify-between mb-2">
        <div
          className={cn("rounded-xl flex items-center justify-center flex-shrink-0", iconBox)}
          style={{
            background: `hsl(var(--${color}) / 0.12)`,
            color: `hsl(var(--${color}))`,
          }}
        >
          {Icon && <Icon className={iconSize} />}
        </div>
        {clickable && (
          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
        )}
      </div>
      {loading ? (
        <Skeleton className="h-7 w-24 mb-1" />
      ) : (
        <div className={cn("font-bold tabular-nums tracking-tight leading-none", valueCls)}>{value}</div>
      )}
      <div className="text-xs text-muted-foreground mt-1.5 font-medium leading-tight">{label}</div>
      {sub && <div className="text-[11px] text-muted-foreground/70 mt-0.5 leading-tight">{sub}</div>}
    </>
  );

  const base = cn(
    "relative text-left w-full rounded-2xl border border-border/60 bg-card shadow-sm group",
    pad,
    clickable && "hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer",
    className,
  );

  if (clickable) {
    return (
      <motion.button
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.985 }}
        onClick={onClick}
        className={base}
        data-testid={tid}
      >
        {inner}
      </motion.button>
    );
  }

  return (
    <div className={base} data-testid={tid}>
      {inner}
    </div>
  );
}
