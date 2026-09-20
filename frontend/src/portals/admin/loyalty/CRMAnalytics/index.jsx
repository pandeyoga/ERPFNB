/**
 * CRMAnalytics — Sprint CRM: Advanced customer analytics dashboard
 * Tabs: Overview · Retention · Cohorts · Segments · Top Customers · RFM · CLV
 */
import { useState, useEffect, useCallback } from "react";
import {
  BarChart2, TrendingUp, Users, UserMinus, UserCheck, UserX, Crown,
  RefreshCw, Loader2, Target, DollarSign, Activity, ShoppingBag, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GlassTooltip, ChartEmpty } from "@/components/shared/charts/chartKit";
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

const RETENTION_COLORS = ["#3B82F6", "#EF4444"];

// ─── Cohort Heatmap ─────────────────────────────────────────────────────────
function CohortHeatmap({ data }) {
  if (!data?.cohorts?.length) return (
    <div className="text-center py-12 text-muted-foreground text-sm">No cohort data available.</div>
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
        <span>Legend:</span>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Donut chart */}
        <div className="flex flex-col items-center">
          <h5 className="text-sm font-semibold mb-2">Segment Distribution</h5>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={data.segments} dataKey="count" nameKey="segment" cx="50%" cy="50%"
                   innerRadius={55} outerRadius={90} paddingAngle={2} label={({segment,pct})=>`${pct}%`}
                   labelLine={false}>
                {data.segments.map((s, i) => <Cell key={i} fill={s.color} />)}
              </Pie>
              <Tooltip content={<GlassTooltip valueFormatter={(v) => Number(v).toLocaleString("id-ID")} />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Segment table */}
        <div className="space-y-2">
          <h5 className="text-sm font-semibold">Breakdown</h5>
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
export default function CRMAnalytics() {
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
    { label: "Total Customers",     value: overview.total_customers?.toLocaleString(), icon: Users,       color: "bg-blue-50 text-blue-600" },
    { label: "Active Rate",         value: pct(overview.active_rate),                   icon: UserCheck,   color: "bg-emerald-50 text-emerald-600" },
    { label: "Churn Rate",          value: pct(overview.churn_rate),                    icon: UserX,       color: "bg-red-50 text-red-600" },
    { label: "Avg Retention",       value: pct(retention?.avg_retention || 0),          icon: TrendingUp,  color: "bg-violet-50 text-violet-600" },
  ] : [];

  const kpi2 = overview ? [
    { label: "Avg CLV",             value: fmt(overview.avg_clv),                        icon: Crown,       color: "bg-amber-50 text-amber-600" },
    { label: "Avg Order Value",     value: fmt(overview.avg_order_value),                icon: ShoppingBag, color: "bg-teal-50 text-teal-600" },
    { label: "Repeat Purchase Rate",value: pct(overview.repeat_purchase_rate),           icon: Target,      color: "bg-pink-50 text-pink-600" },
    { label: "Lifetime Revenue",    value: fmt(overview.total_lifetime_revenue),         icon: DollarSign,  color: "bg-green-50 text-green-600" },
  ] : [];

  const tierOrder = ["bronze", "silver", "gold"];
  const tierDist = tierOrder.map(t => ({
    tier: t.charAt(0).toUpperCase() + t.slice(1),
    count: overview?.tier_distribution?.[t] || 0,
    fill: TIER_COLORS[t],
  }));

  const segmentColors = { new: "#3B82F6", active: "#10B981", at_risk: "#F59E0B", churned: "#EF4444" };
  const segmentItems = segments?.segments || [];

  return (
    <div className="space-y-5" data-testid="crm-analytics">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-violet-600" /> CRM Advanced Analytics
          </h3>
          <p className="text-sm text-muted-foreground">Customer retention, cohorts, CLV, RFM dan analisis segmen.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex-wrap h-auto gap-1 bg-muted/50 p-1 rounded-xl">
          {["overview","retention","cohorts","segments","top-customers","rfm","clv"].map(t => (
            <TabsTrigger key={t} value={t} className="capitalize text-xs rounded-lg">
              {t.replace("-", " ")}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ─── OVERVIEW ─────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-5 mt-4">
          {/* KPI Row 1 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {kpi1.map((k, i) => {
              const Icon = k.icon;
              return (
                <div key={i} className="border rounded-xl p-4 bg-white">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${k.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="text-2xl font-bold">{k.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{k.label}</div>
                </div>
              );
            })}
          </div>

          {/* Segment mini-cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {segmentItems.map(s => {
              const Icon = SEG_ICONS[s.key] || Activity;
              return (
                <div key={s.key} className="border rounded-xl p-3 bg-white flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                       style={{ backgroundColor: s.color + "20", color: s.color }}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-bold">{s.count.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* KPI Row 2 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {kpi2.map((k, i) => {
              const Icon = k.icon;
              return (
                <div key={i} className="border rounded-xl p-4 bg-white">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${k.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="text-2xl font-bold">{k.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{k.label}</div>
                </div>
              );
            })}
          </div>

          {/* Trend chart */}
          {trends?.timeline && (
            <div className="border rounded-xl p-5 bg-white">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-sm">Monthly Acquisition &amp; Transactions</h4>
                <div className="flex gap-1">
                  {[6, 12].map(m => (
                    <Button key={m} size="sm" variant={trendMonths === m ? "default" : "outline"} className="h-6 text-xs px-2"
                            onClick={() => setTrendMonths(m)}>{m}M</Button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trends.timeline} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                  <Tooltip content={<GlassTooltip valueFormatter={(v) => Number(v).toLocaleString("id-ID")} />} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="new_customers" name="New Customers" fill="#3B82F6" radius={[3,3,0,0]} />
                  <Bar yAxisId="left" dataKey="transactions" name="Transactions" fill="#8B5CF6" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tier distribution */}
          <div className="border rounded-xl p-5 bg-white">
            <h4 className="font-semibold text-sm mb-4">Loyalty Tier Distribution</h4>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={tierDist} layout="vertical" margin={{ left: 20, right: 30 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="tier" tick={{ fontSize: 12 }} width={55} />
                <Tooltip content={<GlassTooltip valueFormatter={(v) => Number(v).toLocaleString("id-ID")} />} />
                <Bar dataKey="count" radius={[0,4,4,0]}>
                  {tierDist.map((t, i) => <Cell key={i} fill={t.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        {/* ─── RETENTION ────────────────────────────────────────── */}
        <TabsContent value="retention" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="border rounded-xl px-4 py-3 bg-white text-center">
                <div className="text-2xl font-bold text-emerald-600">{pct(retention?.avg_retention || 0)}</div>
                <div className="text-xs text-muted-foreground">Avg Retention</div>
              </div>
              <div className="border rounded-xl px-4 py-3 bg-white text-center">
                <div className="text-2xl font-bold text-red-500">{pct(retention?.avg_churn || 0)}</div>
                <div className="text-xs text-muted-foreground">Avg Churn</div>
              </div>
            </div>
            <div className="flex gap-1">
              {[3,6,12].map(m => (
                <Button key={m} size="sm" variant={retentionMonths === m ? "default" : "outline"}
                        className="h-7 text-xs px-2"
                        onClick={() => setRetentionMonths(m)}>{m}M</Button>
              ))}
            </div>
          </div>

          {retention?.monthly && (
            <div className="border rounded-xl p-5 bg-white">
              <h4 className="font-semibold text-sm mb-4">Monthly Retention vs Churn Rate</h4>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={retention.monthly} margin={{ top: 5, right: 15, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
                  <Tooltip content={<GlassTooltip valueFormatter={(v) => `${v}%`} />} />
                  <Legend />
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
            <div className="border rounded-xl bg-white overflow-hidden">
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
        <TabsContent value="cohorts" className="mt-4 space-y-4">
          <div>
            <h4 className="font-semibold">Cohort Retention Analysis</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Persentase pelanggan dari setiap cohort yang tetap aktif di bulan berikutnya.
              M+0 = bulan pertama, M+1 = bulan kedua, dst.
            </p>
          </div>
          <div className="border rounded-xl p-5 bg-white overflow-x-auto">
            <CohortHeatmap data={cohorts} />
          </div>
        </TabsContent>

        {/* ─── SEGMENTS ─────────────────────────────────────────── */}
        <TabsContent value="segments" className="mt-4 space-y-4">
          {segments && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {segments.segments.map(s => {
                  const Icon = SEG_ICONS[s.key] || Activity;
                  return (
                    <div key={s.key} className="border rounded-xl p-4 bg-white">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                           style={{ backgroundColor: s.color + "20", color: s.color }}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="text-2xl font-bold">{s.count.toLocaleString()}</div>
                      <div className="text-sm font-medium">{s.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{s.desc}</div>
                      <Badge className="mt-2 text-xs" style={{ backgroundColor: s.color + "20", color: s.color }}>
                        {s.pct}%
                      </Badge>
                    </div>
                  );
                })}
              </div>
              {/* Stacked bar chart */}
              <div className="border rounded-xl p-5 bg-white">
                <h4 className="font-semibold text-sm mb-4">Segment Share</h4>
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
        <TabsContent value="top-customers" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Top Customers</h4>
            <div className="flex gap-2">
              {["total_spend","visit_count","lifetime_points"].map(f => (
                <Button key={f} size="sm" variant={sortBy === f ? "default" : "outline"} className="h-7 text-xs px-2"
                        onClick={() => setSortBy(f)}>
                  {f === "total_spend" ? "Spend" : f === "visit_count" ? "Visits" : "Points"}
                </Button>
              ))}
            </div>
          </div>
          <div className="border rounded-xl bg-white overflow-hidden">
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
                    {c.is_active ? "Active" : "Inactive"}
                  </span>
                ) },
              ]}
            />
          </div>
        </TabsContent>

        {/* ─── RFM ──────────────────────────────────────────────── */}
        <TabsContent value="rfm" className="mt-4 space-y-4">
          <div>
            <h4 className="font-semibold">RFM Segmentation</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Segmentasi berdasarkan Recency (kapan terakhir beli), Frequency (seberapa sering), Monetary (berapa banyak dibelanjakan).
            </p>
          </div>
          <div className="border rounded-xl p-5 bg-white">
            <RFMChart data={rfm} />
          </div>
          {rfm?.score_distribution && (
            <div className="border rounded-xl p-5 bg-white">
              <h4 className="font-semibold text-sm mb-4">RFM Score Distribution (3–15)</h4>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={rfm.score_distribution} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <XAxis dataKey="score" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<GlassTooltip valueFormatter={(v) => Number(v).toLocaleString("id-ID")} />} />
                  <Bar dataKey="count" fill="#8B5CF6" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </TabsContent>

        {/* ─── CLV ──────────────────────────────────────────────── */}
        <TabsContent value="clv" className="mt-4 space-y-4">
          <div>
            <h4 className="font-semibold">Customer Lifetime Value</h4>
            <p className="text-sm text-muted-foreground mt-1">Perbandingan CLV rata-rata per tier loyalty dan distribusi spending.</p>
          </div>
          {clv?.by_tier && (
            <div className="grid md:grid-cols-3 gap-4">
              {["bronze","silver","gold"].map(tier => {
                const t = clv.by_tier.find(x => x.tier === tier);
                if (!t) return null;
                return (
                  <div key={tier} className="border rounded-xl p-4 bg-white">
                    <div className="flex items-center gap-2 mb-3">
                      <Crown className="h-4 w-4" style={{ color: TIER_COLORS[tier] }} />
                      <span className="font-semibold capitalize">{tier}</span>
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
            <div className="border rounded-xl p-5 bg-white">
              <h4 className="font-semibold text-sm mb-4">Average CLV by Tier</h4>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={clv.by_tier.map(t=>({...t, tier: t.tier.charAt(0).toUpperCase()+t.tier.slice(1)}))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="tier" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000000).toFixed(1)}jt`} />
                  <Tooltip formatter={v => [fmt(v), "Avg Spend"]} />
                  <Bar dataKey="avg_spend" radius={[4,4,0,0]}>
                    {clv.by_tier.map((t, i) => <Cell key={i} fill={TIER_COLORS[t.tier] || "#6B7280"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {clv?.histogram && clv.histogram.length > 0 && (
            <div className="border rounded-xl p-5 bg-white">
              <h4 className="font-semibold text-sm mb-4">Spending Distribution</h4>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={clv.histogram}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="range" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 10 }} />
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
