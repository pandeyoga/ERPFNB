/**
 * Executive — Outlet Budget Monitor
 *
 * 4 tabs: Heatmap / Stacked Bar / Pace Line / Detail Table.
 * Period selector (weekly|monthly) + period nav.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3, Activity, Table as TableIcon, TrendingUp,
  Calendar, ChevronLeft, ChevronRight, AlertCircle, CheckCircle2,
  Wallet, ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, LineChart, Line, ReferenceLine,
} from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import api from "@/lib/api";
import { fmtRp } from "@/lib/format";
import DataTable from "@/components/shared/DataTable";
import { GlassTooltip } from "@/components/shared/charts/chartKit";
import {
  BUCKETS, BUCKET_LABELS, BUCKET_COLORS,
  isoWeekKey, monthKey, prevPeriod, nextPeriod,
  fetchMonitorOverview, fetchHeatmap, paceColor, paceBg,
} from "@/lib/outletBudgetApi";

export default function OutletBudgetMonitor() {
  const navigate = useNavigate();
  const [periodType, setPeriodType] = useState("monthly");
  const [periodKey, setPeriodKey] = useState(monthKey(new Date()));
  const [view, setView] = useState("heatmap");
  const [overview, setOverview] = useState(null);
  const [heatmap, setHeatmap] = useState(null);
  const [outletsById, setOutletsById] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (periodType === "weekly") setPeriodKey(isoWeekKey(new Date()));
    else if (periodType === "monthly") setPeriodKey(monthKey(new Date()));
  }, [periodType]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/master/outlets");
        const m = {};
        for (const o of res.data.data || []) m[o.id] = o;
        setOutletsById(m);
      } catch (e) { /* ignore */ }
    })();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const ov = await fetchMonitorOverview({ periodType, periodKey });
      setOverview(ov);
      // Heatmap = last 6 periods
      const keys = [periodKey];
      let k = periodKey;
      for (let i = 0; i < 5; i++) {
        k = prevPeriod(periodType, k);
        keys.unshift(k);
      }
      const hm = await fetchHeatmap({ periodType, periodKeys: keys });
      setHeatmap(hm);
    } catch (e) {
      toast.error("Gagal memuat data monitoring");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [periodType, periodKey]);

  // Build chart data for Stacked Bar
  const stackedBarData = useMemo(() => {
    if (!overview) return [];
    return overview.items.map((it) => ({
      name: outletsById[it.outlet_id]?.code || it.outlet_id.slice(0, 6),
      "KDO Budget": it.kdo_budget,
      "FDO Budget": it.fdo_budget,
      "BDO Budget": it.bdo_budget,
      "KDO Actual": it.actuals?.kdo || 0,
      "FDO Actual": it.actuals?.fdo || 0,
      "BDO Actual": it.actuals?.bdo || 0,
    }));
  }, [overview, outletsById]);

  // Pace chart: ideal vs actual per outlet (simulate with current pace ratio)
  const paceLineData = useMemo(() => {
    if (!overview) return [];
    return overview.items.map((it) => {
      const summary = it.pace?.summary || {};
      const total = (it.pace?.kdo?.actual || 0) + (it.pace?.fdo?.actual || 0) + (it.pace?.bdo?.actual || 0);
      const tgt = summary.total_budget || 0;
      const tElapsed = (summary.time_elapsed_pct || 0) / 100;
      const ideal = tgt * tElapsed;
      return {
        name: outletsById[it.outlet_id]?.code || it.outlet_id.slice(0, 6),
        ideal: Math.round(ideal),
        actual: Math.round(total),
      };
    });
  }, [overview, outletsById]);

  return (
    <div className="space-y-6" data-testid="outlet-budget-monitor">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-aurora" />
            Budget Monitor
          </h2>
          <p className="text-muted-foreground text-sm">
            Pantau realisasi PR (KDO/FDO/BDO) terhadap budget tiap outlet.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/executive/outlet-budgets")} className="gap-2">
          <Wallet className="h-4 w-4" /> Set Budget <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Period selector */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-4 pb-4">
          <Tabs value={periodType} onValueChange={setPeriodType}>
            <TabsList>
              <TabsTrigger value="weekly">Mingguan</TabsTrigger>
              <TabsTrigger value="monthly">Bulanan</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setPeriodKey(prevPeriod(periodType, periodKey))} aria-label="Periode sebelumnya">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[140px] text-center font-mono font-semibold">{periodKey}</div>
            <Button variant="ghost" size="icon" onClick={() => setPeriodKey(nextPeriod(periodType, periodKey))} aria-label="Periode berikutnya">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
        </CardContent>
      </Card>

      {/* KPI strip */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiBox label="Total Outlets" value={overview.total_outlets} />
          <KpiBox label="Total Budget" value={fmtRp(overview.totals.total)} />
          <KpiBox label="Total Actual" value={fmtRp(overview.totals.actual_total)} />
          <KpiBox
            label="Over Budget"
            value={overview.over_budget_count}
            tone={overview.over_budget_count > 0 ? "red" : "green"}
          />
          <KpiBox
            label="Peringatan"
            value={overview.warning_count}
            tone={overview.warning_count > 0 ? "amber" : "green"}
          />
        </div>
      )}

      {/* Tabs */}
      <Tabs value={view} onValueChange={setView}>
        <TabsList>
          <TabsTrigger value="heatmap" data-testid="tab-heatmap">
            <Activity className="h-4 w-4 mr-1" /> Heatmap
          </TabsTrigger>
          <TabsTrigger value="stacked" data-testid="tab-stacked">
            <BarChart3 className="h-4 w-4 mr-1" /> Stacked Bar
          </TabsTrigger>
          <TabsTrigger value="pace" data-testid="tab-pace">
            <TrendingUp className="h-4 w-4 mr-1" /> Pace
          </TabsTrigger>
          <TabsTrigger value="table" data-testid="tab-table">
            <TableIcon className="h-4 w-4 mr-1" /> Detail
          </TabsTrigger>
        </TabsList>

        <TabsContent value="heatmap" className="mt-4">
          {heatmap ? (
            <HeatmapView heatmap={heatmap} outletsById={outletsById} />
          ) : (
            <SkeletonCard text="Memuat heatmap…" />
          )}
        </TabsContent>

        <TabsContent value="stacked" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Budget vs Actual per Outlet</CardTitle>
              <CardDescription>Stacked bar tiap outlet, breakdown KDO/FDO/BDO.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer>
                  <BarChart data={stackedBarData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb33" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis
                      stroke="#94a3b8"
                      tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}jt`}
                    />
                    <Tooltip content={<GlassTooltip valueFormatter={fmtRp} />} />
                    <Legend />
                    <Bar dataKey="KDO Budget" stackId="budget" fill={BUCKET_COLORS.kdo} fillOpacity={0.4} />
                    <Bar dataKey="FDO Budget" stackId="budget" fill={BUCKET_COLORS.fdo} fillOpacity={0.4} />
                    <Bar dataKey="BDO Budget" stackId="budget" fill={BUCKET_COLORS.bdo} fillOpacity={0.4} />
                    <Bar dataKey="KDO Actual" stackId="actual" fill={BUCKET_COLORS.kdo} />
                    <Bar dataKey="FDO Actual" stackId="actual" fill={BUCKET_COLORS.fdo} />
                    <Bar dataKey="BDO Actual" stackId="actual" fill={BUCKET_COLORS.bdo} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pace" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Pace Line — Actual vs Ideal Run-rate</CardTitle>
              <CardDescription>Garis ideal = total budget × % waktu berlalu. Aktual di atas garis = over-pacing.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer>
                  <LineChart data={paceLineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb33" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}jt`} />
                    <Tooltip content={<GlassTooltip valueFormatter={fmtRp} />} />
                    <Legend />
                    <Line type="monotone" dataKey="ideal" stroke="#94a3b8" strokeDasharray="5 5" name="Ideal (run-rate)" />
                    <Line type="monotone" dataKey="actual" stroke="#f59e0b" strokeWidth={2} name="Aktual" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="table" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Detail per Outlet × Bucket</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <div data-testid="detail-table">
                <DataTable
                  rows={overview?.items || []}
                  keyField="outlet_id"
                  rowTestIdPrefix="detail-row"
                  empty={<div className="px-3 py-6 text-center text-muted-foreground">{loading ? "Memuat…" : "Belum ada budget di periode ini."}</div>}
                  columns={[
                    { key: "outlet", label: "Outlet", primary: true, render: (it) => {
                      const ol = outletsById[it.outlet_id];
                      return (
                        <div>
                          <div>{ol?.name || it.outlet_id.slice(0, 8)}</div>
                          <div className="text-xs text-muted-foreground">{ol?.code}</div>
                        </div>
                      );
                    } },
                    ...BUCKETS.map((bk) => ({
                      key: `bucket_${bk}`,
                      label: <span style={{ color: BUCKET_COLORS[bk] }}>{bk.toUpperCase()} Budget / Actual / %</span>,
                      render: (it) => {
                        const cell = it.pace?.[bk] || {};
                        return (
                          <div className="tabular-nums text-xs">
                            <div>{fmtRp(cell.budget)} / {fmtRp(cell.actual)}</div>
                            <div className={paceColor(cell.status)}>{cell.pct_used?.toFixed(1)}%</div>
                          </div>
                        );
                      },
                    })),
                    { key: "total_pace", label: "Total Pace", numeric: true, render: (it) => {
                      const summary = it.pace?.summary || {};
                      const totalPct = summary.total_budget > 0 ? (summary.total_actual / summary.total_budget * 100) : 0;
                      const tone = summary.any_red ? "red" : summary.any_amber ? "amber" : "green";
                      return <Badge variant="outline" className={paceBg(tone)}>{totalPct.toFixed(1)}%</Badge>;
                    } },
                  ]}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiBox({ label, value, tone = "default" }) {
  const toneClass = tone === "red"
    ? "text-red-500"
    : tone === "amber"
      ? "text-amber-500"
      : tone === "green"
        ? "text-emerald-500"
        : "";
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-xl font-bold tabular-nums mt-1 ${toneClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function HeatmapView({ heatmap, outletsById }) {
  const periodKeys = heatmap.period_keys || [];
  const outletIds = Object.keys(heatmap.matrix || {});
  if (outletIds.length === 0) {
    return <SkeletonCard text="Belum ada budget di 6 periode terakhir." />;
  }
  const colorFor = (cell) => {
    if (!cell) return "bg-muted/30 text-muted-foreground";
    if (cell.status === "red") return "bg-red-500/30 text-red-700 dark:text-red-300";
    if (cell.status === "amber") return "bg-amber-500/30 text-amber-700 dark:text-amber-300";
    return "bg-emerald-500/30 text-emerald-700 dark:text-emerald-300";
  };
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Heatmap Pace (6 periode terakhir)</CardTitle>
        <CardDescription>
          Warna: <span className="text-emerald-500">hijau &lt; 80%</span> /
          <span className="text-amber-500"> kuning 80–99%</span> /
          <span className="text-red-500"> merah ≥ 100%</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div data-testid="heatmap-table">
          <DataTable
            rows={outletIds.map((oid) => ({ _id: oid }))}
            keyField="_id"
            rowTestIdPrefix="heatmap-row"
            className="text-sm"
            columns={[
              { key: "outlet", label: "Outlet", primary: true, render: (row) => (
                <span className="font-medium">{outletsById[row._id]?.name || row._id.slice(0, 8)}</span>
              ) },
              ...periodKeys.map((k) => ({
                key: `p_${k}`, label: <span className="font-mono text-xs">{k}</span>, align: "center",
                render: (row) => {
                  const cell = heatmap.matrix[row._id][k];
                  return (
                    <div className={`rounded-md px-2 py-2 text-center font-mono ${colorFor(cell)}`}>
                      {cell ? `${cell.pct.toFixed(0)}%` : "—"}
                    </div>
                  );
                },
              })),
            ]}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonCard({ text }) {
  return (
    <Card>
      <CardContent className="py-10 text-center text-muted-foreground">{text}</CardContent>
    </Card>
  );
}
