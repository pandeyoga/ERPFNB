/**
 * CompactStatCard — SATU kartu statistik/KPI untuk seluruh aplikasi.
 *
 * Spesifikasi: design_guidelines.md → component_sizing_specs.unify_stat_card
 *   wrapper  glass-card p-3 flex items-center justify-between gap-3
 *   label    text-[11px] uppercase tracking-[0.08em] text-muted-foreground
 *   value    text-lg (sm) / text-xl (md) font-semibold tabular-nums
 *   height   min-h-[72px] (sm) / min-h-[88px] (md)
 *   icon     kanan, dalam badge 36px
 *
 * Menggantikan belasan varian lokal (StatCard, KpiTile, SummaryTile, Tile, …).
 * Props:
 *  - label, value, sub (meta di bawah nilai), icon, color (token aurora-*)
 *  - tone: "default" | "success" | "warning" | "danger" | "info" — warna nilai
 *  - onClick → dirender sebagai <button>; active → state terpilih (filter tile)
 *  - badge (angka di pojok), loading, size "sm" | "md", testId / testIdPrefix
 */
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const TONE_VALUE = {
  default: "",
  success: "text-emerald-700 dark:text-emerald-400",
  warning: "text-amber-800 dark:text-amber-400",
  danger: "text-rose-700 dark:text-rose-400",
  info: "text-sky-700 dark:text-sky-400",
};

export default function CompactStatCard({
  label,
  value,
  sub,
  icon: Icon,
  color = "aurora-1",
  tone = "default",
  onClick,
  active = false,
  badge,
  loading = false,
  size = "md",
  testId,
  testIdPrefix = "stat",
  className,
}) {
  const clickable = typeof onClick === "function";
  // Nominal panjang (mis. "Rp 1.236.158.000") tidak muat di text-xl pada grid 4 kolom → turun ke
  // text-lg agar tidak terpotong; nilai lengkap tetap tersedia di title.
  const valueText = typeof value === "string" || typeof value === "number" ? String(value) : undefined;
  const longValue = (valueText?.length || 0) >= 15;
  const tid =
    testId ||
    `${testIdPrefix}-${String(label || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

  const inner = (
    <>
      {badge !== undefined && badge !== null && badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 h-5 min-w-5 rounded-full bg-red-500 text-white text-[11px] font-semibold flex items-center justify-center px-1">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground truncate" data-testid="kpi-card-label">
          {label}
        </div>
        {loading ? (
          <Skeleton className="h-6 w-24 mt-1" />
        ) : (
          <div
            className={cn(
              "mt-0.5 font-semibold leading-[1.1] tabular-nums tracking-[-0.02em] truncate",
              size === "sm" || longValue ? "text-lg" : "text-lg md:text-xl",
              TONE_VALUE[tone] || ""
            )}
            title={valueText}
            data-testid="kpi-card-value"
          >
            {value}
          </div>
        )}
        {sub && <div className="mt-0.5 text-xs text-muted-foreground truncate">{sub}</div>}
      </div>
      {Icon && (
        <div
          className="shrink-0 h-9 w-9 rounded-[calc(var(--radius)-2px)] flex items-center justify-center"
          style={{ background: `hsl(var(--${color}) / 0.12)`, color: `hsl(var(--${color}))` }}
        >
          <Icon className="h-[18px] w-[18px]" />
        </div>
      )}
    </>
  );

  const base = cn(
    "glass-card relative w-full p-3 flex items-center justify-between gap-3 text-left",
    size === "sm" ? "min-h-[72px]" : "min-h-[88px]",
    clickable && "transition-[box-shadow,border-color] hover:shadow-md hover:border-primary/30 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active && "ring-2 ring-primary/40",
    className
  );

  if (clickable) {
    return (
      <button type="button" onClick={onClick} className={base} data-testid={tid} aria-pressed={active || undefined}>
        {inner}
      </button>
    );
  }
  return (
    <div className={base} data-testid={tid}>
      {inner}
    </div>
  );
}
