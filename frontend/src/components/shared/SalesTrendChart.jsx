/**
 * Sales trend chart using Recharts (Phase 4A enhancement).
 * Props: series = [{date, total, trx}], height = number
 */
import { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import { fmtRp, fmtDate, fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function SalesTrendChart({ series = [], height = 180 }) {
  const { chartData, mean, growth } = useMemo(() => {
    if (!series.length) return { chartData: [], mean: 0, growth: null };

    // Calculate moving average (3-day window)
    const chartData = series.map((s, i) => {
      const window = series.slice(Math.max(0, i - 2), i + 1);
      const movingAvg = window.reduce((sum, d) => sum + d.total, 0) / window.length;
      return {
        date: s.date,
        total: s.total,
        trx: s.trx || 0,
        movingAvg: Math.round(movingAvg),
        avgTicket: s.trx > 0 ? Math.round(s.total / s.trx) : 0,
      };
    });

    const totals = series.map((s) => s.total);
    const sum = totals.reduce((a, b) => a + b, 0);
    const mean = Math.round(sum / totals.length);

    // Calculate growth vs first half vs second half
    const mid = Math.floor(series.length / 2);
    const firstHalf = series.slice(0, mid);
    const secondHalf = series.slice(mid);
    const firstSum = firstHalf.reduce((s, d) => s + d.total, 0);
    const secondSum = secondHalf.reduce((s, d) => s + d.total, 0);
    const growth =
      firstSum > 0 ? (((secondSum - firstSum) / firstSum) * 100).toFixed(1) : null;

    return { chartData, mean, growth };
  }, [series]);

  if (!series.length) {
    return (
      <div className="text-sm text-muted-foreground italic">Tidak ada data trend.</div>
    );
  }

  return (
    <div className="w-full" data-testid="sales-trend-chart">
      {/* Growth indicator badge */}
      {growth !== null && (
        <div className="mb-2 flex items-center gap-2">
          <div
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
              Number(growth) >= 0
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "bg-rose-500/10 text-rose-700 dark:text-rose-400"
            )}
          >
            {Number(growth) >= 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {Number(growth) >= 0 ? "+" : ""}
            {growth}% vs previous period
          </div>
        </div>
      )}

      {/* Recharts chart */}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="areaTrendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--aurora-1))" stopOpacity={0.45} />
                <stop offset="100%" stopColor="hsl(var(--aurora-1))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => fmtDate(v, "DD/MM")}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => {
                if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
                return v;
              }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const data = payload[0].payload;
                return (
                  <div className="bg-background border rounded-lg shadow-lg p-2.5 text-xs space-y-1">
                    <div className="font-semibold text-foreground">
                      {fmtDate(data.date, "DD MMM YYYY")}
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Revenue:</span>
                      <span className="font-bold tabular-nums">{fmtRp(data.total)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Trx:</span>
                      <span className="font-semibold tabular-nums">{fmtNumber(data.trx)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Avg Ticket:</span>
                      <span className="font-semibold tabular-nums">{fmtRp(data.avgTicket)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 pt-1 border-t border-border/50">
                      <span className="text-muted-foreground">Moving Avg:</span>
                      <span className="font-medium tabular-nums">{fmtRp(data.movingAvg)}</span>
                    </div>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="hsl(var(--aurora-1))"
              strokeWidth={2}
              fill="url(#areaTrendGrad)"
              animationDuration={600}
            />
            <Line
              type="monotone"
              dataKey="movingAvg"
              stroke="hsl(var(--aurora-4))"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              animationDuration={600}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Summary footer */}
      <div className="flex justify-between text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50">
        <span>{fmtDate(series[0].date, "DD MMM")}</span>
        <span>
          Avg: <span className="text-foreground font-medium">{fmtRp(mean)}</span>
        </span>
        <span>
          {fmtDate(series[series.length - 1].date, "DD MMM")} ·{" "}
          <span className="text-foreground font-medium">
            {fmtRp(series[series.length - 1].total)}
          </span>
        </span>
      </div>
    </div>
  );
}
