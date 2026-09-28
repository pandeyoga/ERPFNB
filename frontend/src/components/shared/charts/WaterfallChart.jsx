/** WaterfallChart — a TRUE financial waterfall (floating bars + connectors).
 *
 *  Built as a self-contained responsive SVG (not Recharts) for precise
 *  floating bars, connector lines and on-bar value labels — the things a
 *  plain bar chart cannot express. See UX Usability Standard §Charts.
 *
 *  Props:
 *    stages: [{ label, value, kind, running, compare, delta_pct }]
 *            value  = signed contribution (Revenue +, COGS -, …)
 *            kind   = 'positive' | 'negative' | 'subtotal' | 'total'
 *            running= cumulative total AT this stage
 *    height: number (default 380)
 *    valueFormatter: (n)=>string for tooltip (default fmtRp)
 */
import { useLayoutEffect, useRef, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { fmtRp } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SEMANTIC, fmtCompact, ChartEmpty } from "./chartKit";

const COLOR = {
  positive: SEMANTIC.positive,
  negative: SEMANTIC.negative,
  subtotal: SEMANTIC.subtotal,
  total: SEMANTIC.total,
};

export default function WaterfallChart({ stages = [], height = 380, valueFormatter = fmtRp }) {
  const wrapRef = useRef(null);
  const [w, setW] = useState(820);
  const [hover, setHover] = useState(null);

  useLayoutEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect?.width;
      if (cw) setW(Math.max(320, Math.round(cw)));
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  if (!stages.length) return <ChartEmpty />;

  const M = { top: 30, right: 14, bottom: 70, left: 56 };
  const plotW = w - M.left - M.right;
  const plotH = height - M.top - M.bottom;
  const n = stages.length;

  // Each bar floats from prevRunning → running (subtotals/totals anchor at 0).
  const bars = stages.map((s) => {
    const prev = (s.running ?? 0) - (s.value ?? 0);
    const lo = Math.min(prev, s.running ?? 0);
    const hi = Math.max(prev, s.running ?? 0);
    return { ...s, lo, hi, prev };
  });

  const allY = [0, ...bars.flatMap((b) => [b.lo, b.hi])];
  let yMin = Math.min(...allY);
  let yMax = Math.max(...allY);
  if (yMin === yMax) yMax = yMin + 1;
  const padY = (yMax - yMin) * 0.08;
  yMin -= padY; yMax += padY;
  const yScale = (v) => M.top + plotH * (1 - (v - yMin) / (yMax - yMin));

  const slot = plotW / n;
  const barW = Math.min(64, slot * 0.52);
  const cx = (i) => M.left + slot * (i + 0.5);

  // y gridlines
  const TICKS = 5;
  const ticks = Array.from({ length: TICKS }, (_, i) => yMin + ((yMax - yMin) * i) / (TICKS - 1));

  const hovered = hover != null ? bars[hover] : null;

  return (
    <div ref={wrapRef} className="relative w-full" data-testid="waterfall-chart">
      <svg width={w} height={height} role="img" aria-label="Profit waterfall">
        {/* gridlines + y labels */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={M.left} x2={w - M.right} y1={yScale(t)} y2={yScale(t)}
              stroke="hsl(var(--border))" strokeDasharray="3 3" opacity={0.4} />
            <text x={M.left - 8} y={yScale(t)} dy="0.32em" textAnchor="end"
              fontSize="10" fill="hsl(var(--muted-foreground))">{fmtCompact(t)}</text>
          </g>
        ))}
        {/* zero baseline */}
        {yMin < 0 && yMax > 0 && (
          <line x1={M.left} x2={w - M.right} y1={yScale(0)} y2={yScale(0)} stroke="hsl(var(--muted-foreground))" opacity={0.5} />
        )}

        {/* connectors */}
        {bars.slice(0, -1).map((b, i) => {
          const y = yScale(b.running ?? 0);
          return (
            <line key={`c${i}`}
              x1={cx(i) + barW / 2} x2={cx(i + 1) - barW / 2}
              y1={y} y2={y}
              stroke="hsl(var(--muted-foreground))" strokeDasharray="4 3" opacity={0.5} />
          );
        })}

        {/* bars + value labels + x labels */}
        {bars.map((b, i) => {
          const x = cx(i) - barW / 2;
          const y = yScale(b.hi);
          const h = Math.max(2, yScale(b.lo) - yScale(b.hi));
          const fill = COLOR[b.kind] || SEMANTIC.neutral;
          const dim = hover != null && hover !== i;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: "default" }}>
              {/* hover hit-area */}
              <rect x={M.left + slot * i} y={M.top} width={slot} height={plotH} fill="transparent" />
              <rect x={x} y={y} width={barW} height={h} rx={5}
                fill={fill} opacity={dim ? 0.4 : 1}
                style={{ transition: "opacity 150ms ease" }}
                data-testid={`waterfall-bar-${i}`} />
              {/* value label */}
              <text x={cx(i)} y={y - 7} textAnchor="middle" fontSize="11" fontWeight="600"
                fill="hsl(var(--foreground))" opacity={dim ? 0.4 : 0.92}>
                {fmtCompact(b.value)}
              </text>
              {/* x-axis label (rotated) */}
              <text x={cx(i)} y={height - M.bottom + 16} textAnchor="end" fontSize="10.5"
                fill="hsl(var(--muted-foreground))"
                transform={`rotate(-22 ${cx(i)} ${height - M.bottom + 16})`}>
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* HTML tooltip overlay */}
      {hovered && (
        <div
          className="pointer-events-none absolute z-10 rounded-xl border border-border/70 bg-popover/95 backdrop-blur-md px-3 py-2 shadow-xl text-xs space-y-1 min-w-[170px]"
          style={{
            left: Math.min(Math.max(cx(hover), 90), w - 90),
            top: Math.max(yScale(hovered.hi) - 12, 4),
            transform: "translate(-50%, -100%)",
          }}
          data-testid="waterfall-tooltip"
        >
          <div className="font-semibold text-foreground">{hovered.label}</div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Period</span>
            <span className="font-mono font-bold tabular-nums">{valueFormatter(hovered.value)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Compare</span>
            <span className="font-mono tabular-nums text-muted-foreground">{valueFormatter(hovered.compare ?? 0)}</span>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-border/50 pt-1">
            <span className="text-muted-foreground">Running</span>
            <span className="font-mono tabular-nums">{valueFormatter(hovered.running ?? 0)}</span>
          </div>
          {hovered.delta_pct != null && (
            <div className={cn("flex items-center gap-1 pt-0.5", hovered.delta_pct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
              {hovered.delta_pct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              <span className="font-mono font-semibold">{hovered.delta_pct >= 0 ? "+" : ""}{hovered.delta_pct}% vs compare</span>
            </div>
          )}
        </div>
      )}

      {/* legend */}
      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
        <Legend color={SEMANTIC.positive} label="Naik" />
        <Legend color={SEMANTIC.negative} label="Turun" />
        <Legend color={SEMANTIC.subtotal} label="Subtotal" />
        <Legend color={SEMANTIC.total} label="Net" />
      </div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
