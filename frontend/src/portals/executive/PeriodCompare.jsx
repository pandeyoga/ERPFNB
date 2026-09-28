/** Phase 11D — Period Comparison matrix page (Phase 4C enhanced with chart). */
import { useEffect, useMemo, useState } from "react";
import { GitCompareArrows, RefreshCw, BarChart3 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import LoadingState from "@/components/shared/LoadingState";
import DataTable from "@/components/shared/DataTable";
import { ChartEmpty } from "@/components/shared/charts/chartKit";
import { fmtRp } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const METRICS = [
  { v: "revenue",       l: "Revenue" },
  { v: "cogs",          l: "COGS" },
  { v: "gross_profit",  l: "Gross Profit" },
  { v: "opex",          l: "OPEX" },
  { v: "service_charge", l: "Service Charge" },
  { v: "net_profit",    l: "Net Profit" },
];

const PERIODS = [
  { v: "mtd",        l: "MTD" },
  { v: "lmtd",       l: "LMTD" },
  { v: "qtd",        l: "QTD" },
  { v: "ytd",        l: "YTD" },
  { v: "yoy",        l: "YoY" },
  { v: "last_month", l: "Last Month" },
];

export default function PeriodCompare() {
  const [selectedMetrics, setSelectedMetrics] = useState([
    "revenue", "cogs", "gross_profit", "opex", "net_profit",
  ]);
  const [selectedPeriods, setSelectedPeriods] = useState([
    "mtd", "lmtd", "yoy",
  ]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!selectedMetrics.length || !selectedPeriods.length) {
      toast.error("Pilih minimal 1 metric dan 1 periode");
      return;
    }
    setLoading(true);
    try {
      const r = await api.get("/executive/period-compare", {
        params: {
          metrics: selectedMetrics.join(","),
          period_kinds: selectedPeriods.join(","),
        },
      });
      setData(unwrap(r));
    } catch (e) {
      toast.error("Gagal load comparison");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [selectedMetrics.join(","), selectedPeriods.join(",")]);

  const periods = data?.periods || [];

  // Transform data for chart (Phase 4C)
  const chartData = useMemo(() => {
    if (!data?.metrics || !periods.length) return [];
    return (data.metrics || []).map((row) => {
      const point = {
        metric: METRICS.find((m) => m.v === row.metric)?.l || row.metric,
        metricKey: row.metric,
      };
      periods.forEach((p) => {
        point[p.kind] = row.values[p.kind] || 0;
      });
      return point;
    });
  }, [data, periods]);

  function toggleMetric(v) {
    setSelectedMetrics((m) => m.includes(v) ? m.filter(x => x !== v) : [...m, v]);
  }
  function togglePeriod(v) {
    setSelectedPeriods((p) => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
  }

  // Color palette for periods
  const PERIOD_COLORS = {
    mtd: "#5B5FE3",
    lmtd: "#10B981",
    qtd: "#F59E0B",
    ytd: "#EF4444",
    yoy: "#8B5CF6",
    last_month: "#06B6D4",
  };

  return (
    <div className="space-y-6" data-testid="period-compare-page">
      <div className="glass-card p-5" data-testid="period-compare-controls">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="h-9 w-9 rounded-xl grad-aurora text-white flex items-center justify-center">
              <GitCompareArrows className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-bold">Period Comparison</h2>
              <p className="text-xs text-muted-foreground">
                Bandingkan multi-metric across MTD/LMTD/YoY/QTD/YTD
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={load} className="gap-1" data-testid="period-compare-refresh">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-semibold mb-2">Metrics</div>
            <div className="flex flex-wrap gap-2" data-testid="period-compare-metrics">
              {METRICS.map((m) => (
                <label key={m.v} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-muted/30 cursor-pointer text-xs" data-testid={`metric-checkbox-${m.v}`}>
                  <Checkbox checked={selectedMetrics.includes(m.v)} onCheckedChange={() => toggleMetric(m.v)} />
                  {m.l}
                </label>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold mb-2">Periods</div>
            <div className="flex flex-wrap gap-2">
              {PERIODS.map((p) => (
                <label key={p.v} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-muted/30 cursor-pointer text-xs">
                  <Checkbox checked={selectedPeriods.includes(p.v)} onCheckedChange={() => togglePeriod(p.v)} />
                  {p.l}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {loading || !data ? <LoadingState message="Loading…" /> : (
        <>
          {/* Phase 4C: Visual Overview - Grouped Bar Chart */}
          {chartData.length > 0 && (
            <div className="glass-card p-5 mb-5">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">Visual Overview</h3>
              </div>
              <div style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 16, right: 16, left: 0, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                    <XAxis
                      dataKey="metric"
                      tick={{ fontSize: 11 }}
                      angle={-25}
                      textAnchor="end"
                      height={70}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => {
                        if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                        if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
                        return v;
                      }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const data = payload[0]?.payload;
                        return (
                          <div className="bg-background border rounded-lg shadow-lg p-2.5 text-xs space-y-1">
                            <div className="font-semibold text-foreground mb-1">{data.metric}</div>
                            {payload.map((p, i) => (
                              <div key={i} className="flex items-center justify-between gap-4">
                                <span
                                  className="flex items-center gap-1.5 text-muted-foreground"
                                  style={{ color: p.fill }}
                                >
                                  <span
                                    className="h-2 w-2 rounded-full"
                                    style={{ background: p.fill }}
                                  />
                                  {periods.find((pr) => pr.kind === p.dataKey)?.label || p.dataKey}:
                                </span>
                                <span className="font-bold tabular-nums">{fmtRp(p.value)}</span>
                              </div>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                      formatter={(value) =>
                        periods.find((p) => p.kind === value)?.label || value
                      }
                    />
                    {periods.map((p) => (
                      <Bar
                        key={p.kind}
                        dataKey={p.kind}
                        fill={PERIOD_COLORS[p.kind] || "#888"}
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {chartData.length === 0 && (
            <div className="glass-card p-5 mb-5">
              <ChartEmpty message="Pilih minimal satu metrik & periode untuk membandingkan." />
            </div>
          )}

          {/* Detailed table */}
          <div className="glass-card p-5 overflow-x-auto">
            <DataTable
              rows={data.metrics || []}
              keyField="metric"
              rowTestIdPrefix="compare-row"
              columns={[
                { key: "metric", label: "Metric", primary: true,
                  render: (row) => <span className="font-medium">{METRICS.find((m) => m.v === row.metric)?.l || row.metric}</span> },
                ...periods.map((p) => ({
                  key: p.kind, label: p.label, numeric: true,
                  render: (row) => <span className="font-mono">{fmtRp(row.values[p.kind])}</span>,
                })),
                ...(periods.length >= 2 ? [{
                  key: "_delta", label: `Δ (${periods[0].kind} vs ${periods[1].kind})`, numeric: true,
                  render: (row) => {
                    const v0 = row.values[periods[0]?.kind];
                    const v1 = row.values[periods[1]?.kind];
                    const delta = (v0 != null && v1 != null) ? v0 - v1 : null;
                    const pctv = (v1 && v1 !== 0) ? ((v0 - v1) / Math.abs(v1) * 100).toFixed(1) : null;
                    if (delta == null) return "—";
                    return (
                      <span className={cn("font-mono", delta >= 0 ? "text-emerald-600" : "text-rose-600")}>
                        {delta >= 0 ? "+" : ""}{fmtRp(delta)}
                        {pctv != null && <span className="text-[10px] ml-1">({pctv > 0 ? "+" : ""}{pctv}%)</span>}
                      </span>
                    );
                  },
                }] : []),
              ]}
            />
          </div>
        </>
      )}
    </div>
  );
}
