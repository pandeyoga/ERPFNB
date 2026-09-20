/**
 * Phase 4B: Sales Heatmap Widget
 * Displays day-of-week × week matrix for F&B peak pattern analysis
 */
import { useState, useEffect, useMemo } from "react";
import { Calendar, TrendingUp, Activity } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import LoadingState from "@/components/shared/LoadingState";
import DataTable from "@/components/shared/DataTable";
import { fmtRp, fmtNumber, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function SalesHeatmapWidget({ period, brandIds, outletIds }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState("revenue"); // revenue | trx

  async function load() {
    setLoading(true);
    try {
      const params = { metric };
      if (period) params.period = period;
      if (brandIds?.length) params.brand_ids = brandIds.join(",");
      if (outletIds?.length) params.outlet_ids = outletIds.join(",");

      const res = await api.get("/executive/sales-heatmap", { params });
      setData(unwrap(res));
    } catch (e) {
      toast.error("Gagal load sales heatmap");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, brandIds?.join(","), outletIds?.join(","), metric]);

  // Color intensity based on value
  const getHeatColor = (value, min, max) => {
    if (!value || value === 0) return "bg-muted/20";
    const normalized = (value - min) / (max - min || 1);
    if (normalized > 0.75) return "bg-gradient-to-br from-rose-500/80 to-rose-600/90 text-white";
    if (normalized > 0.5) return "bg-gradient-to-br from-orange-500/70 to-orange-600/80 text-white";
    if (normalized > 0.25) return "bg-gradient-to-br from-amber-500/60 to-amber-600/70";
    return "bg-gradient-to-br from-emerald-500/40 to-emerald-600/50";
  };

  if (loading || !data) {
    return (
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">Sales Heatmap</h3>
        </div>
        <LoadingState rows={3} />
      </div>
    );
  }

  const { matrix, weeks, min, max } = data;

  if (!matrix?.length) {
    return (
      <div className="glass-card p-5" data-testid="sales-heatmap-widget">
        <p className="py-8 text-center text-sm text-muted-foreground">Belum ada data sales untuk periode ini.</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-5" data-testid="sales-heatmap-widget">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">Sales Pattern — {data.period}</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMetric("revenue")}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs transition-colors",
              metric === "revenue" ? "bg-foreground/10 font-semibold" : "hover:bg-foreground/5"
            )}
            data-testid="heatmap-metric-revenue"
          >
            Revenue
          </button>
          <button
            onClick={() => setMetric("trx")}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs transition-colors",
              metric === "trx" ? "bg-foreground/10 font-semibold" : "hover:bg-foreground/5"
            )}
            data-testid="heatmap-metric-trx"
          >
            Trx
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <DataTable
          rows={matrix}
          keyField="day"
          rowTestIdPrefix="heatmap-day"
          className="text-xs"
          columns={[
            { key: "day", label: "Day", primary: true,
              render: (row) => <span className="font-medium text-muted-foreground">{row.day}</span> },
            ...weeks.map((w, i) => ({
              key: `w${i}`, label: w, align: "center",
              render: (row) => {
                const cell = row.values[i];
                if (!cell) return <div className="h-10 rounded bg-muted/10" />;
                const value = cell.value;
                const colorClass = getHeatColor(value, min, max);
                return (
                  <div
                    className={cn(
                      "h-10 rounded flex items-center justify-center cursor-pointer transition-transform hover:scale-105",
                      colorClass
                    )}
                    title={`${fmtDate(cell.date, "DD MMM")}: ${
                      metric === "revenue" ? fmtRp(cell.revenue) : `${fmtNumber(cell.trx)} trx`
                    }`}
                  >
                    <span className="font-semibold text-[10px] tabular-nums">
                      {metric === "revenue"
                        ? value >= 1_000_000
                          ? `${(value / 1_000_000).toFixed(1)}M`
                          : value >= 1_000
                          ? `${(value / 1_000).toFixed(0)}K`
                          : value.toFixed(0)
                        : value}
                    </span>
                  </div>
                );
              },
            })),
          ]}
        />
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
        <span>🟢 Low</span>
        <span>Peak activity pattern across weeks</span>
        <span>🔴 High</span>
      </div>
    </div>
  );
}
