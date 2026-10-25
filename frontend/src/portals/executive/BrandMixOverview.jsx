/** Executive → Brand Mix landing (list view + Phase 4D comparative chart).
 *  Shows all brands with KPI strip; click a brand → drilldown.
 */
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  ArrowRight,
  TrendingUp,
  Store,
  Calendar,
  ArrowUpDown,
} from "lucide-react";
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
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { fmtRp, fmtPct } from "@/lib/format";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

// /executive/brand-mix mengembalikan { period, grand_total, rows: [{ brand_id, brand_name,
// total, trx, outlet_count, share_pct, color }] } — field lama (brands/items, revenue,
// net_sales, transaction_count) tetap didukung sebagai fallback.
const revenueOf = (b) => Number(b.revenue ?? b.net_sales ?? b.total ?? 0);
const trxOf = (b) => Number(b.transaction_count ?? b.trx ?? 0);
const COLORS = ["#7C3AED", "#3B82F6", "#10B981", "#F59E0B", "#EC4899", "#06B6D4"];

/**
 * BrandMixOverview — `embedded` = dirender sebagai tab di Performance Analytics
 * (tanpa <h1> sendiri; pemilih periode tampil di toolbar).
 */
export default function BrandMixOverview({ embedded = false }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("revenue"); // revenue | gp_pct

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/executive/brand-mix", { params: { period } });
      setData(unwrap(res));
    } catch (e) {
      toast.error("Gagal memuat brand mix");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [period]);

  // Generate last 6 months for picker
  const periodOptions = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    periodOptions.push(d.toISOString().slice(0, 7));
  }

  const brands = useMemo(() => (
    Array.isArray(data?.rows) ? data.rows
      : Array.isArray(data?.brands) ? data.brands
      : Array.isArray(data?.items) ? data.items
      : []
  ), [data]);
  const hasGp = brands.some((b) => b.gp_pct != null);

  // Warna per brand stabil (tidak ikut berubah saat urutan sort berubah)
  const colorById = useMemo(() => {
    const m = {};
    brands.forEach((b, i) => { m[b.brand_id || b.id || i] = b.color || COLORS[i % COLORS.length]; });
    return m;
  }, [brands]);

  const sortedBrands = useMemo(() => {
    const copy = [...brands];
    if (sortBy === "gp_pct") return copy.sort((a, b) => (b.gp_pct || 0) - (a.gp_pct || 0));
    return copy.sort((a, b) => revenueOf(b) - revenueOf(a));
  }, [brands, sortBy]);

  const totalRevenue = brands.reduce((s, b) => s + revenueOf(b), 0);
  const totalOutlets = brands.reduce((s, b) => s + Number(b.outlet_count || 0), 0);
  const totalTrx = brands.reduce((s, b) => s + trxOf(b), 0);

  // Prepare chart data for comparative view (Phase 4D)
  const chartData = useMemo(() => brands.map((b) => ({
    brand: (b.brand_name || b.name || "Unknown").slice(0, 12),
    revenue: revenueOf(b),
    gp_pct: Number(b.gp_pct || 0),
  })), [brands]);

  const periodSelect = (
    <div className="flex gap-2 items-center">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <SimpleSelect value={period} onValueChange={setPeriod} className="w-[130px]" testId="brand-mix-period"
        ariaLabel="Periode" options={periodOptions.map((p) => ({ value: p, label: p }))} />
    </div>
  );

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="brand-mix-overview">
      {embedded ? (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs md:text-sm text-muted-foreground">Performa antar-brand dalam grup FnB Group</p>
          {periodSelect}
        </div>
      ) : (
        <PageHeader
          icon={BarChart3}
          title="Brand Mix"
          subtitle="Performa antar-brand dalam grup FnB Group"
          className="mb-0 md:mb-0"
          actions={periodSelect}
        />
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <CompactStatCard icon={TrendingUp} color="aurora-1" label="Total Revenue" value={fmtRp(totalRevenue)} loading={loading} />
        <CompactStatCard icon={Store} color="aurora-3" label="Total Outlet" value={`${totalOutlets} outlet`} loading={loading} />
        <CompactStatCard icon={BarChart3} color="aurora-2" label="Total Transaksi" value={totalTrx.toLocaleString("id-ID")} loading={loading} />
      </div>

      {/* Phase 4D: Comparative chart visualization */}
      {!loading && chartData.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm md:text-base font-semibold">{hasGp ? "Revenue & GP% Comparison" : "Revenue per Brand"}</h3>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 16, right: 16, left: 0, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                <XAxis
                  dataKey="brand"
                  tick={{ fontSize: 11 }}
                  angle={-25}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => {
                    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
                    return v;
                  }}
                />
                {hasGp && <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" />}
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload;
                    return (
                      <div className="bg-background border rounded-lg shadow-lg p-2.5 text-xs space-y-1">
                        <div className="font-semibold text-foreground mb-1">{row.brand}</div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">Revenue:</span>
                          <span className="font-semibold tabular-nums">{fmtRp(row.revenue)}</span>
                        </div>
                        {hasGp && (
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">GP%:</span>
                            <span className="font-semibold tabular-nums">{fmtPct(row.gp_pct)}</span>
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar yAxisId="left" dataKey="revenue" fill="#5B5FE3" name="Revenue" radius={[4, 4, 0, 0]} />
                {hasGp && <Bar yAxisId="right" dataKey="gp_pct" fill="#10B981" name="GP%" radius={[4, 4, 0, 0]} />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Sort controls */}
      {!loading && brands.length > 1 && hasGp && (
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs md:text-sm text-muted-foreground">Urutkan:</span>
          <Tabs value={sortBy} onValueChange={setSortBy}>
            <TabsList>
              <TabsTrigger value="revenue" data-testid="brand-mix-sort-revenue">Revenue</TabsTrigger>
              <TabsTrigger value="gp_pct" data-testid="brand-mix-sort-gp">GP%</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      {/* Brand grid */}
      {loading ? (
        <LoadingState rows={6} />
      ) : brands.length === 0 ? (
        <div className="glass-card"><EmptyState icon={BarChart3} title="Belum ada data brand" description="Belum ada penjualan tervalidasi untuk periode ini." /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sortedBrands.map((b, i) => {
            const key = b.brand_id || b.id || i;
            const rev = revenueOf(b);
            const pct = b.share_pct != null ? Number(b.share_pct) : (totalRevenue > 0 ? (rev / totalRevenue) * 100 : 0);
            const color = colorById[key] || COLORS[i % COLORS.length];
            return (
              <button
                type="button"
                key={key}
                onClick={() => navigate(`/executive/brand/${b.brand_id || b.id}`)}
                className="glass-card p-4 text-left hover:shadow-md transition group"
                data-testid={`brand-mix-card-${b.brand_id || i}`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-[calc(var(--radius)-2px)] flex items-center justify-center text-white text-sm font-semibold shrink-0" style={{ backgroundColor: color }}>
                      {(b.brand_name || b.name || "?").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm md:text-base font-semibold truncate">{b.brand_name || b.name}</h3>
                      <p className="text-xs text-muted-foreground">{b.outlet_count || 0} outlet · {trxOf(b).toLocaleString("id-ID")} trx</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">Revenue</span>
                    <span className="font-semibold tabular-nums">{fmtRp(rev)}</span>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Share</span>
                      <span className="tabular-nums font-semibold" style={{ color }}>{pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-foreground/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }} />
                    </div>
                  </div>
                  {b.gp_pct != null && (
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-muted-foreground">Gross Profit %</span>
                      <span className="text-sm font-semibold tabular-nums">{fmtPct(Number(b.gp_pct))}</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
