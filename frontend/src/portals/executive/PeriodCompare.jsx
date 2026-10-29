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
import PageHeader from "@/components/shared/PageHeader";
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

/** PeriodCompare — `embedded` = dirender sebagai tab di Performance Analytics (tanpa <h1>). */
export default function PeriodCompare({ embedded = false }) {
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
      toast.error("Gagal memuat perbandingan periode");
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

  const subtitle = "Bandingkan beberapa metrik lintas MTD / LMTD / QTD / YTD / YoY";
  const refreshBtn = (
    <Button variant="outline" onClick={load} data-testid="period-compare-refresh">
      <RefreshCw /> Muat ulang
    </Button>
  );

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="period-compare-page">
      {!embedded && (
        <PageHeader icon={GitCompareArrows} title="Period Compare" subtitle={subtitle} actions={refreshBtn} className="mb-0 md:mb-0" />
      )}
      <div className="glass-card p-4" data-testid="period-compare-controls">
        {embedded && (
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <p className="text-xs md:text-sm text-muted-foreground">{subtitle}</p>
            {refreshBtn}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
          <div>
            <div className="text-xs md:text-sm font-medium mb-2">Metrik</div>
            <div className="flex flex-wrap gap-2" data-testid="period-compare-metrics">
              {METRICS.map((m) => (
                <label key={m.v} className="flex items-center gap-1.5 px-2.5 h-8 rounded-full border bg-muted/30 cursor-pointer text-[13px]" data-testid={`metric-checkbox-${m.v}`}>
                  <Checkbox checked={selectedMetrics.includes(m.v)} onCheckedChange={() => toggleMetric(m.v)} aria-label={`Metrik ${m.l}`} />
                  {m.l}
                </label>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs md:text-sm font-medium mb-2">Periode</div>
            <div className="flex flex-wrap gap-2">
              {PERIODS.map((p) => (
                <label key={p.v} className="flex items-center gap-1.5 px-2.5 h-8 rounded-full border bg-muted/30 cursor-pointer text-[13px]" data-testid={`period-checkbox-${p.v}`}>
                  <Checkbox checked={selectedPeriods.includes(p.v)} onCheckedChange={() => togglePeriod(p.v)} aria-label={`Periode ${p.l}`} />
                  {p.l}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {loading || !data ? <LoadingState message="Memuat…" /> : (
        <>
          {/* Phase 4C: Visual Overview - Grouped Bar Chart */}
          {chartData.length > 0 && (
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm md:text-base font-semibold">Visual Overview</h3>
              </div>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 16, right: 16, left: 0, bottom: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                    <XAxis
                      dataKey="metric"
                      tick={{ fontSize: 12 }}
                      angle={-25}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
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
                                <span className="font-semibold tabular-nums">{fmtRp(p.value)}</span>
                              </div>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
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
            <div className="glass-card p-4">
              <ChartEmpty message="Pilih minimal satu metrik & periode untuk membandingkan." />
            </div>
          )}

          {/* Detailed table */}
          <div className="glass-card overflow-hidden">
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
                      <span className={cn("font-mono", delta >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400")}>
                        {delta >= 0 ? "+" : ""}{fmtRp(delta)}
                        {pctv != null && <span className="text-xs ml-1">({pctv > 0 ? "+" : ""}{pctv}%)</span>}
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
