/** chartKit — shared chart theming primitives for FnB Group ERP.
 *
 *  Use these across ALL charts so tooltips, colors, empty-states and axes
 *  are consistent (see UX Usability Standard §Charts). Never use the bare
 *  Recharts default <Tooltip/> — always pass content={<GlassTooltip .../>}.
 */
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

/** Semantic colors (theme-aware via CSS vars). Use for bars/lines/legends. */
export const SEMANTIC = {
  positive: "hsl(var(--aurora-4))",   // emerald — gains
  negative: "hsl(var(--destructive))", // red — losses
  subtotal: "hsl(var(--aurora-2))",   // violet — milestones
  total:    "hsl(var(--aurora-1))",   // indigo — final
  neutral:  "hsl(var(--aurora-3))",   // sky — informational
  muted:    "hsl(var(--muted-foreground))",
  border:   "hsl(var(--border))",
};

/** Categorical palette for series (donuts, multi-series). */
export const CATEGORICAL = [
  "hsl(var(--aurora-1))", "hsl(var(--aurora-2))", "hsl(var(--aurora-3))",
  "hsl(var(--aurora-4))", "hsl(var(--aurora-5))", "hsl(var(--aurora-6))",
];

/** Compact money/number label, e.g. 625.000.000 → "625M", 1.2e9 → "1,2B". */
export function fmtCompact(n) {
  if (n == null || isNaN(n)) return "-";
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1e9) return `${sign}${(a / 1e9).toFixed(a >= 1e10 ? 0 : 1).replace(".", ",")}B`;
  if (a >= 1e6) return `${sign}${Math.round(a / 1e6)}M`;
  if (a >= 1e3) return `${sign}${Math.round(a / 1e3)}K`;
  return `${sign}${a}`;
}

/** Recharts-compatible axis defaults — spread onto <XAxis/> / <YAxis/>. */
export const axisProps = {
  tick: { fontSize: 11, fill: "hsl(var(--muted-foreground))" },
  axisLine: { stroke: "hsl(var(--border))" },
  tickLine: false,
};

export const gridProps = {
  strokeDasharray: "3 3",
  stroke: "hsl(var(--border))",
  opacity: 0.4,
  vertical: false,
};

/**
 * GlassTooltip — drop-in styled tooltip for Recharts.
 * Usage: <Tooltip content={<GlassTooltip valueFormatter={fmtRp} />} />
 * Optionally pass `rows={[{key,label,format}]}` to control which payload
 * entries render and how.
 */
export function GlassTooltip({ active, payload, label, valueFormatter, labelFormatter, rows }) {
  if (!active || !payload?.length) return null;
  const fmt = valueFormatter || ((v) => v);
  const head = labelFormatter ? labelFormatter(label, payload) : (label ?? payload[0]?.payload?.label);
  const entries = rows
    ? rows.map((r) => ({
        name: r.label,
        value: (r.format || fmt)(payload[0]?.payload?.[r.key]),
        color: r.color,
      }))
    : payload.map((p) => ({ name: p.name, value: fmt(p.value), color: p.color || p.fill }));

  return (
    <div className="rounded-xl border border-border/70 bg-popover/95 backdrop-blur-md px-3 py-2 shadow-xl text-xs space-y-1 min-w-[150px]">
      {head != null && <div className="font-semibold text-foreground mb-1">{head}</div>}
      {entries.map((e, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            {e.color && <span className="h-2 w-2 rounded-full shrink-0" style={{ background: e.color }} />}
            {e.name}
          </span>
          <span className="font-mono font-semibold tabular-nums text-foreground">{e.value}</span>
        </div>
      ))}
    </div>
  );
}

/** ChartEmpty — consistent empty state inside a chart frame. */
export function ChartEmpty({ message = "Belum ada data untuk periode ini.", icon: Icon = Inbox, className }) {
  return (
    <div className={cn("flex h-full min-h-[160px] flex-col items-center justify-center gap-2 text-center", className)}>
      <div className="h-10 w-10 rounded-2xl grad-aurora-soft flex items-center justify-center">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground max-w-[240px]">{message}</p>
    </div>
  );
}
