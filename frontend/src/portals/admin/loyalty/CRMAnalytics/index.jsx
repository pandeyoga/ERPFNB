/**
 * CRMAnalytics — Sprint CRM: Advanced customer analytics dashboard
 * Tabs: Overview · Retention · Cohorts · Segments · Top Customers · RFM · CLV
 */
import { useState, useEffect, useCallback } from "react";
import {
  BarChart2, TrendingUp, Users, UserMinus, UserCheck, UserX, Crown,
  RefreshCw, Loader2, Target, DollarSign, Activity, ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GlassTooltip, ChartEmpty, axisProps, gridProps } from "@/components/shared/charts/chartKit";
import DataTable from "@/components/shared/DataTable";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import api from "@/lib/api";
import { toast } from "sonner";

const TIER_COLORS = { bronze: "#CD7F32", silver: "#9CA3AF", gold: "#F59E0B" };
const SEG_ICONS = { new: UserCheck, active: Activity, at_risk: UserMinus, churned: UserX };

function fmt(n) {
  if (n === null || n === undefined) return "-";
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}k`;
  return `Rp ${n}`;
}

function pct(n) { return `${n}%`; }

/** Legend seragam untuk semua chart di halaman ini (12px, ikon kecil). */
const LEGEND_PROPS = { iconSize: 10, wrapperStyle: { fontSize: 12, paddingTop: 8 } };

/** Sub-tab CRM analytics — label sentence case (RFM/CLV = singkatan). */
const CRM_TABS = [
  { value: "overview", label: "Overview" },
  { value: "retention", label: "Retention" },
  { value: "cohorts", label: "Cohorts" },
  { value: "segments", label: "Segments" },
  { value: "top-customers", label: "Top customers" },
  { value: "rfm", label: "RFM" },
  { value: "clv", label: "CLV" },
];

/** Segmented control (periode / urutan) — tampilan sama dengan Tabs terpadu. */
function Segmented({ value, onChange, options, ariaLabel, testId }) {
  return (
    <Tabs value={String(value)} onValueChange={(v) => onChange(v)}>
      <TabsList aria-label={ariaLabel} data-testid={testId}>
        {options.map((o) => (
          <TabsTrigger key={o.value} value={String(o.value)}>{o.label}</TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

const SEG_COLOR_TOKEN = { new: "aurora-3", active: "aurora-4", at_risk: "aurora-5", churned: "aurora-6" };

// ─── Cohort Heatmap ─────────────────────────────────────────────────────────
function CohortHeatmap({ data }) {
  if (!data?.cohorts?.length) return (
    <div className="text-center py-8 text-muted-foreground text-sm">Belum ada data cohort.</div>
  );
  const maxOffset = Math.max(...data.cohorts.map(c => Object.keys(c.retention).length));
  const cols = Array.from({ length: maxOffset }, (_, i) => i);

  function cellColor(val) {
    if (val === undefined || val === null) return "bg-muted/30 text-muted-foreground";
    if (val >= 80) return "bg-emerald-500 text-white";
    if (val >= 60) return "bg-emerald-400 text-white";
    if (val >= 40) return "bg-yellow-400 text-gray-900";
    if (val >= 20) return "bg-orange-400 text-white";
    if (val > 0)  return "bg-red-400 text-white";
    return "bg-muted/30 text-muted-foreground";
  }

  return (
    <div className="overflow-x-auto">
      <DataTable
        rows={data.cohorts}
        keyField="cohort_month"
        rowTestIdPrefix="cohort-row"
        className="text-xs"
        columns={[
          { key: "cohort_label", label: "Cohort", primary: true,
            render: (row) => <span className="font-medium whitespace-nowrap">{row.cohort_label}</span> },
          { key: "cohort_size", label: "Size", align: "center",
            render: (row) => <span className="text-muted-foreground">{row.cohort_size}</span> },
          ...cols.map((i) => ({
            key: `m${i}`, label: `M+${i}`, align: "center",
            render: (row) => {
              const val = row.retention[String(i)];
              return (
                <span className={`inline-block px-2 py-1 rounded-sm font-medium ${cellColor(val)}`}>
                  {val !== undefined ? `${val}%` : "—"}
                </span>
              );
            },
          })),
        ]}
      />
      <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground flex-wrap">
        <span>Keterangan:</span>
        {[["≥80%","bg-emerald-500"],["60–79%","bg-emerald-400"],["40–59%","bg-yellow-400"],["20–39%","bg-orange-400"],["<20%","bg-red-400"]].map(([lbl,cls])=>(
          <span key={lbl} className={`flex items-center gap-1`}><span className={`w-3 h-3 rounded-sm inline-block ${cls}`} />{lbl}</span>
        ))}
      </div>
    </div>
  );
}

// ─── RFM Segment Chart ────────────────────────────────────────────────────────
function RFMChart({ data }) {
  if (!data?.segments?.length) return <ChartEmpty message="Belum ada data RFM." />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Donut chart */}
        <div className="flex flex-col items-center">
          <h3 className="text-sm md:text-base font-semibold mb-2">Segment Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={data.segments} dataKey="count" nameKey="segment" cx="50%" cy="50%"
                   innerRadius={55} outerRadius={90} paddingAngle={2} label={({segment,pct})=>`${pct}%`}
                   labelLine={false}>
                {data.segments.map((s, i) => <Cell key={i} fill={s.color} />)}
              </Pie>
              <Tooltip content={<GlassTooltip valueFormatter={(v) => Number(v).toLocaleString("id-ID")} />} />
              <Legend {...LEGEND_PROPS} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Segment table */}
        <div className="space-y-2">
          <h3 className="text-sm md:text-base font-semibold">Breakdown</h3>
          {data.segments.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-sm flex-1">{s.segment}</span>
              <span className="text-sm font-medium">{s.count.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground w-12 text-right tabular-nums">{s.pct}%</span>
              <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CRMAnalytics({ embedded = false }) {
  const [loading, setLoading] = useState(true);
  const [retentionMonths, setRetentionMonths] = useState(12);
  const [trendMonths, setTrendMonths] = useState(12);
  const [sortBy, setSortBy] = useState("total_spend");

  const [overview, setOverview] = useState(null);
  const [retention, setRetention] = useState(null);
  const [segments, setSegments] = useState(null);
  const [cohorts, setCohorts] = useState(null);
  const [topCustomers, setTopCustomers] = useState([]);
  const [trends, setTrends] = useState(null);
  const [rfm, setRfm] = useState(null);
  const [clv, setClv] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ovr, ret, seg, coh, top, trnd, rfmD, clvD] = await Promise.all([
        api.get("/admin/crm/analytics/overview"),
        api.get(`/admin/crm/analytics/retention?months=${retentionMonths}`),
        api.get("/admin/crm/analytics/segments"),
        api.get("/admin/crm/analytics/cohorts?months=6"),
        api.get(`/admin/crm/analytics/top-customers?limit=15&sort_by=${sortBy}`),
        api.get(`/admin/crm/analytics/trends?months=${trendMonths}`),
        api.get("/admin/crm/analytics/rfm"),
        api.get("/admin/crm/analytics/clv"),
      ]);
      setOverview(ovr.data?.data);
      setRetention(ret.data?.data);
      setSegments(seg.data?.data);
      setCohorts(coh.data?.data);
      setTopCustomers(top.data?.data || []);
      setTrends(trnd.data?.data);
      setRfm(rfmD.data?.data);
      setClv(clvD.data?.data);
    } catch (e) { toast.error("Gagal memuat CRM analytics"); }
    finally { setLoading(false); }
  }, [retentionMonths, trendMonths, sortBy]);

  useEffect(() => { load(); }, [load]);

  if (loading && !overview) return (
    <div className="flex justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
  );

  const kpi1 = overview ? [
    { label: "Total Customers",     value: overview.total_customers?.toLocaleString(), icon: Users,       color: "aurora-1" },
    { label: "Active Rate",         value: pct(overview.active_rate),                   icon: UserCheck,   color: "aurora-4" },
    { label: "Churn Rate",          value: pct(overview.churn_rate),                    icon: UserX,       color: "aurora-6" },
    { label: "Avg Retention",       value: pct(retention?.avg_retention || 0),          icon: TrendingUp,  color: "aurora-2" },
  ] : [];

  const kpi2 = overview ? [
    { label: "Avg CLV",             value: fmt(overview.avg_clv),                        icon: Crown,       color: "aurora-5" },
    { label: "Avg Order Value",     value: fmt(overview.avg_order_value),                icon: ShoppingBag, color: "aurora-3" },
    { label: "Repeat Purchase Rate",value: pct(overview.repeat_purchase_rate),           icon: Target,      color: "aurora-2" },
    { label: "Lifetime Revenue",    value: fmt(overview.total_lifetime_revenue),         icon: DollarSign,  color: "aurora-4" },
  ] : [];

  const tierOrder = ["bronze", "silver", "gold"];
  const tierDist = tierOrder.map(t => ({
    tier: t.charAt(0).toUpperCase() + t.slice(1),
    count: overview?.tier_distribution?.[t] || 0,
    fill: TIER_COLORS[t],
  }));

  const segmentItems = segments?.segments || [];
  const rfmScores = rfm?.score_distribution
    ? [...rfm.score_distribution].sort((a, b) => Number(a.score) - Number(b.score))
    : null;

  const refreshBtn = (
    <Button variant="outline" onClick={load} disabled={loading} data-testid="crm-analytics-refresh">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      Muat ulang
    </Button>
  );
  const intro = "Customer retention, cohorts, CLV, RFM dan analisis segmen.";

  return (
    <div className="space-y-3" data-testid="crm-analytics">
      {/* Header */}
      {embedded ? (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm text-muted-foreground">{intro}</p>
          {refreshBtn}
        </div>
      ) : (
        <PageHeader icon={BarChart2} title="CRM Analytics" subtitle={intro} actions={refreshBtn} />
      )}

      <Tabs defaultValue="overview" className="w-full">
        <TabsList data-testid="crm-analytics-tabs">
          {CRM_TABS.map(t => (
            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
          ))}
        </TabsList>

        {/* ─── OVERVIEW ─────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-3 lg:space-y-4">
          {/* KPI Row 1 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpi1.map((k) => (
              <CompactStatCard key={k.label} label={k.label} value={k.value} icon={k.icon} color={k.color} />
            ))}
          </div>

          {/* Segment mini-cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {segmentItems.map(s => (
              <CompactStatCard
                key={s.key}
                size="sm"
                label={s.label}
                value={s.count.toLocaleString()}
                icon={SEG_ICONS[s.key] || Activity}
                color={SEG_COLOR_TOKEN[s.key] || "aurora-1"}
              />
            ))}
          </div>

          {/* KPI Row 2 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpi2.map((k) => (
              <CompactStatCard key={k.label} label={k.label} value={k.value} icon={k.icon} color={k.color} />
            ))}
          </div>

          {/* Trend chart */}
          {trends?.timeline && (
            <div className="glass-card p-4">
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <h3 className="text-sm md:text-base font-semibold">Monthly Acquisition &amp; Transactions</h3>
                <Segmented
                  value={trendMonths}
                  onChange={(v) => setTrendMonths(Number(v))}
                  options={[{ value: 6, label: "6M" }, { value: 12, label: "12M" }]}
                  ariaLabel="Periode tren"
                  testId="crm-trend-period"
                />
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trends.timeline} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis yAxisId="left" {...axisProps} />
                  <Tooltip content={<GlassTooltip valueFormatter={(v) => Number(v).toLocaleString("id-ID")} />} />
                  <Legend {...LEGEND_PROPS} />
                  <Bar yAxisId="left" dataKey="new_customers" name="New Customers" fill="#3B82F6" radius={[3,3,0,0]} />
                  <Bar yAxisId="left" dataKey="transactions" name="Transactions" fill="#8B5CF6" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tier distribution */}
          <div className="glass-card p-4">
            <h3 className="text-sm md:text-base font-semibold mb-3">Loyalty Tier Distribution</h3>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={tierDist} layout="vertical" margin={{ left: 20, right: 30 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="tier" {...axisProps} width={55} />
                <Tooltip content={<GlassTooltip valueFormatter={(v) => Number(v).toLocaleString("id-ID")} />} />
                <Bar dataKey="count" radius={[0,4,4,0]}>
                  {tierDist.map((t, i) => <Cell key={i} fill={t.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        {/* ─── RETENTION ────────────────────────────────────────── */}
        <TabsContent value="retention" className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="grid grid-cols-2 gap-3 w-full sm:w-auto sm:min-w-[360px]">
              <CompactStatCard size="sm" label="Avg Retention" value={pct(retention?.avg_retention || 0)} icon={TrendingUp} color="aurora-4" tone="success" />
              <CompactStatCard size="sm" label="Avg Churn" value={pct(retention?.avg_churn || 0)} icon={UserX} color="aurora-6" tone="danger" />
            </div>
            <Segmented
              value={retentionMonths}
              onChange={(v) => setRetentionMonths(Number(v))}
              options={[{ value: 3, label: "3M" }, { value: 6, label: "6M" }, { value: 12, label: "12M" }]}
              ariaLabel="Periode retensi"
              testId="crm-retention-period"
            />
          </div>

          {retention?.monthly && (
            <div className="glass-card p-4">
              <h3 className="text-sm md:text-base font-semibold mb-3">Monthly Retention vs Churn Rate</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={retention.monthly} margin={{ top: 5, right: 15, left: 0, bottom: 5 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} {...axisProps} />
                  <Tooltip content={<GlassTooltip valueFormatter={(v) => `${v}%`} />} />
                  <Legend {...LEGEND_PROPS} />
                  <Line type="monotone" dataKey="retention_rate" name="Retention Rate %" stroke="#10B981"
                        strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="churn_rate" name="Churn Rate %" stroke="#EF4444"
                        strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Monthly table */}
          {retention?.monthly && (
            <div className="glass-card overflow-hidden">
              <DataTable
                rows={[...retention.monthly].reverse()}
                keyField="label"
                rowTestIdPrefix="retention-row"
                columns={[
                  { key: "label", label: "Month", primary: true,
                    render: (r) => <span className="font-medium">{r.label}</span> },
                  { key: "active_prev", label: "Active Prev", numeric: true, sortable: true },
                  { key: "retained", label: "Retained", numeric: true, sortable: true },
                  { key: "new", label: "New", numeric: true, sortable: true,
                    render: (r) => <span className="text-blue-600">+{r.new}</span> },
                  { key: "retention_rate", label: "Retention", numeric: true, sortable: true,
                    render: (r) => (
                      <span className={`font-medium ${r.retention_rate >= 80 ? 'text-emerald-600' : r.retention_rate >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                        {r.retention_rate}%
                      </span>
                    ) },
                  { key: "churn_rate", label: "Churn", numeric: true, sortable: true,
                    render: (r) => <span className="text-red-500">{r.churn_rate}%</span> },
                ]}
              />
            </div>
          )}
        </TabsContent>

        {/* ─── COHORTS ──────────────────────────────────────────── */}
        <TabsContent value="cohorts" className="space-y-3">
          <div>
            <h2 className="text-base md:text-lg font-semibold">Cohort Retention Analysis</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Persentase pelanggan dari setiap cohort yang tetap aktif di bulan berikutnya.
              M+0 = bulan pertama, M+1 = bulan kedua, dst.
            </p>
          </div>
          <div className="glass-card p-4 overflow-x-auto">
            <CohortHeatmap data={cohorts} />
          </div>
        </TabsContent>

        {/* ─── SEGMENTS ─────────────────────────────────────────── */}
        <TabsContent value="segments" className="space-y-3">
          {segments && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {segments.segments.map(s => (
                  <CompactStatCard
                    key={s.key}
                    label={s.label}
                    value={s.count.toLocaleString()}
                    sub={`${s.pct}% · ${s.desc}`}
                    icon={SEG_ICONS[s.key] || Activity}
                    color={SEG_COLOR_TOKEN[s.key] || "aurora-1"}
                  />
                ))}
              </div>
              {/* Stacked bar chart */}
              <div className="glass-card p-4">
                <h3 className="text-sm md:text-base font-semibold mb-3">Segment Share</h3>
                <div className="flex h-10 rounded-full overflow-hidden">
                  {segments.segments.map(s => (
                    <div key={s.key} className="h-full transition-all" title={`${s.label}: ${s.pct}%`}
                         style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
                  ))}
                </div>
                <div className="flex gap-4 mt-3 flex-wrap">
                  {segments.segments.map(s => (
                    <div key={s.key} className="flex items-center gap-1.5 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      <span>{s.label}</span>
                      <span className="font-medium">{s.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </TabsContent>

        {/* ─── TOP CUSTOMERS ────────────────────────────────────── */}
        <TabsContent value="top-customers" className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-base md:text-lg font-semibold">Top Customers</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs md:text-sm text-muted-foreground">Urutkan</span>
              <Segmented
                value={sortBy}
                onChange={setSortBy}
                options={[
                  { value: "total_spend", label: "Spend" },
                  { value: "visit_count", label: "Visits" },
                  { value: "lifetime_points", label: "Points" },
                ]}
                ariaLabel="Urutkan top customers"
                testId="crm-top-sort"
              />
            </div>
          </div>
          <div className="glass-card overflow-hidden">
            <DataTable
              rows={topCustomers.map((c, i) => ({ ...c, _rank: i + 1, _key: c.id || i }))}
              keyField="_key"
              rowTestIdPrefix="top-customer-row"
              columns={[
                { key: "_rank", label: "#", render: (c) => <span className="font-bold text-muted-foreground">{c._rank}</span> },
                { key: "full_name", label: "Customer", primary: true, render: (c) => (
                  <div>
                    <div className="font-medium">{c.full_name}</div>
                    <div className="text-xs text-muted-foreground">{c.email}</div>
                  </div>
                ) },
                { key: "loyalty_tier", label: "Tier", render: (c) => (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                        style={{ backgroundColor: (TIER_COLORS[c.loyalty_tier] || "#9CA3AF") + "20",
                                 color: TIER_COLORS[c.loyalty_tier] || "#9CA3AF" }}>
                    {c.loyalty_tier}
                  </span>
                ) },
                { key: "total_spend", label: "Total Spend", numeric: true, sortable: true,
                  render: (c) => <span className="font-medium">{fmt(c.total_spend)}</span> },
                { key: "visit_count", label: "Visits", numeric: true, sortable: true },
                { key: "clv_annual", label: "CLV (Annual)", numeric: true, sortable: true,
                  render: (c) => <span className="text-violet-600 font-medium">{fmt(c.clv_annual)}</span> },
                { key: "is_active", label: "Status", align: "center", render: (c) => (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    c.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {c.is_active ? "Aktif" : "Nonaktif"}
                  </span>
                ) },
              ]}
            />
          </div>
        </TabsContent>

        {/* ─── RFM ──────────────────────────────────────────────── */}
        <TabsContent value="rfm" className="space-y-3">
          <div>
            <h2 className="text-base md:text-lg font-semibold">RFM Segmentation</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Segmentasi berdasarkan Recency (kapan terakhir beli), Frequency (seberapa sering), Monetary (berapa banyak dibelanjakan).
            </p>
          </div>
          <div className="glass-card p-4">
            <RFMChart data={rfm} />
          </div>
          {rfmScores && (
            <div className="glass-card p-4">
              <h3 className="text-sm md:text-base font-semibold mb-3">RFM Score Distribution (3–15)</h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={rfmScores} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="score" {...axisProps} />
                  <YAxis {...axisProps} />
                  <Tooltip content={<GlassTooltip valueFormatter={(v) => Number(v).toLocaleString("id-ID")} />} />
                  <Bar dataKey="count" fill="#8B5CF6" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </TabsContent>

        {/* ─── CLV ──────────────────────────────────────────────── */}
        <TabsContent value="clv" className="space-y-3">
          <div>
            <h2 className="text-base md:text-lg font-semibold">Customer Lifetime Value</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Perbandingan CLV rata-rata per tier loyalty dan distribusi spending.</p>
          </div>
          {clv?.by_tier && (
            <div className="grid md:grid-cols-3 gap-3">
              {["bronze","silver","gold"].map(tier => {
                const t = clv.by_tier.find(x => x.tier === tier);
                if (!t) return null;
                return (
                  <div key={tier} className="glass-card p-4" data-testid={`clv-tier-${tier}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <Crown className="h-4 w-4" style={{ color: TIER_COLORS[tier] }} />
                      <h3 className="text-sm md:text-base font-semibold capitalize">{tier}</h3>
                      <span className="text-xs text-muted-foreground ml-auto">{t.customer_count} customers</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Avg Spend</span>
                        <span className="font-medium">{fmt(t.avg_spend)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Avg Visits</span>
                        <span className="font-medium">{t.avg_visits}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Max Spend</span>
                        <span className="font-medium">{fmt(t.max_spend)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {clv?.by_tier && (
            <div className="glass-card p-4">
              <h3 className="text-sm md:text-base font-semibold mb-3">Average CLV by Tier</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={clv.by_tier.map(t=>({...t, tier: t.tier.charAt(0).toUpperCase()+t.tier.slice(1)}))}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="tier" {...axisProps} />
                  <YAxis {...axisProps} tickFormatter={v => `${(v/1000000).toFixed(1)}jt`} />
                  <Tooltip content={<GlassTooltip valueFormatter={(v) => fmt(v)} />} />
                  <Bar dataKey="avg_spend" name="Avg Spend" radius={[4,4,0,0]}>
                    {clv.by_tier.map((t, i) => <Cell key={i} fill={TIER_COLORS[t.tier] || "#6B7280"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {clv?.histogram && clv.histogram.length > 0 && (
            <div className="glass-card p-4">
              <h3 className="text-sm md:text-base font-semibold mb-3">Spending Distribution</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={clv.histogram}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="range" {...axisProps} />
                  <YAxis {...axisProps} />
                  <Tooltip content={<GlassTooltip valueFormatter={(v) => Number(v).toLocaleString("id-ID")} />} />
                  <Bar dataKey="count" fill="#6366F1" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
