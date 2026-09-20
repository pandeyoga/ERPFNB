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
  Filter,
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
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { fmtRp, fmtPct } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function BrandMixOverview() {
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
      toast.error("Gagal load brand mix");
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

  // FIX: Ensure brands is always an array, even during loading
  const brands = Array.isArray(data?.brands) ? data.brands : 
                 Array.isArray(data?.items) ? data.items : 
                 [];

  // Sort brands based on sortBy
  const sortedBrands = useMemo(() => {
    const copy = [...brands];
    if (sortBy === "revenue") {
      return copy.sort((a, b) => (b.revenue || b.net_sales || 0) - (a.revenue || a.net_sales || 0));
    } else if (sortBy === "gp_pct") {
      return copy.sort((a, b) => (b.gp_pct || 0) - (a.gp_pct || 0));
    }
    return copy;
  }, [brands, sortBy]);

  const totalRevenue = brands.reduce((s, b) => s + Number(b.revenue || b.net_sales || 0), 0);
  const totalOutlets = brands.reduce((s, b) => s + Number(b.outlet_count || 0), 0);
  const totalTrx = brands.reduce((s, b) => s + Number(b.transaction_count || 0), 0);

  const colors = ["#7C3AED", "#3B82F6", "#10B981", "#F59E0B", "#EC4899", "#06B6D4"];

  // Prepare chart data for comparative view (Phase 4D)
  const chartData = useMemo(() => {
    return brands.map((b) => ({
      brand: (b.brand_name || b.name || "Unknown").slice(0, 12),
      revenue: Number(b.revenue || b.net_sales || 0),
      gp_pct: Number(b.gp_pct || 0),
    }));
  }, [brands]);

  return (
    <div className="max-w-6xl mx-auto space-y-4" data-testid="brand-mix-overview">
      <PageHeader
        icon={BarChart3}
        title="Brand Mix"
        subtitle="Performa antar-brand dalam grup FnB Group"
        action={
          <div className="flex gap-2 items-center">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <SimpleSelect value={period} onValueChange={setPeriod} className="glass-input rounded-lg px-3 h-10 text-sm" testId="brand-mix-period"
              options={periodOptions.map((p) => ({ value: p, label: p }))} />
          </div>
        }
      />

      {/* KPI Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Kpi icon={TrendingUp} label="Total Revenue" value={fmtRp(totalRevenue)} />
        <Kpi icon={Store} label="Total Outlet" value={`${totalOutlets} outlet`} />
        <Kpi icon={BarChart3} label="Total Transaksi" value={`${totalTrx.toLocaleString()}`} />
      </div>

      {/* Phase 4D: Comparative chart visualization */}
      {!loading && chartData.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">Revenue & GP% Comparison</h3>
            </div>
          </div>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 16, right: 16, left: 0, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                <XAxis
                  dataKey="brand"
                  tick={{ fontSize: 10 }}
                  angle={-25}
                  textAnchor="end"
                  height={70}
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
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0]?.payload;
                    return (
                      <div className="bg-background border rounded-lg shadow-lg p-2.5 text-xs space-y-1">
                        <div className="font-semibold text-foreground mb-1">{data.brand}</div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">Revenue:</span>
                          <span className="font-bold tabular-nums">{fmtRp(data.revenue)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">GP%:</span>
                          <span className="font-semibold tabular-nums">{fmtPct(data.gp_pct)}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                <Bar yAxisId="left" dataKey="revenue" fill="#5B5FE3" name="Revenue" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="gp_pct" fill="#10B981" name="GP%" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Sort controls */}
      {!loading && brands.length > 0 && (
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Sort by:</span>
          <button
            onClick={() => setSortBy("revenue")}
            className={cn(
              "px-3 py-1 rounded-full text-xs transition-colors",
              sortBy === "revenue" ? "bg-foreground/10 font-semibold" : "hover:bg-foreground/5"
            )}
          >
            Revenue
          </button>
          <button
            onClick={() => setSortBy("gp_pct")}
            className={cn(
              "px-3 py-1 rounded-full text-xs transition-colors",
              sortBy === "gp_pct" ? "bg-foreground/10 font-semibold" : "hover:bg-foreground/5"
            )}
          >
            GP%
          </button>
        </div>
      )}

      {/* Brand grid */}
      {loading ? (
        <LoadingState rows={6} />
      ) : brands.length === 0 ? (
        <div className="glass-card"><EmptyState icon={BarChart3} title="Belum ada data brand" description="Pastikan ada brand & data penjualan untuk periode ini." /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {brands.map((b, i) => {
            const pct = totalRevenue > 0 ? (Number(b.revenue || b.net_sales || 0) / totalRevenue) * 100 : 0;
            const color = colors[i % colors.length];
            return (
              <button
                key={b.brand_id || b.id || i}
                onClick={() => navigate(`/executive/brand/${b.brand_id || b.id}`)}
                className="glass-card p-5 text-left hover:shadow-lg transition group"
                data-testid={`brand-mix-card-${b.brand_id || i}`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold shrink-0" style={{ backgroundColor: color }}>
                      {(b.brand_name || b.name || "?").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold truncate">{b.brand_name || b.name}</h3>
                      <p className="text-xs text-muted-foreground">{b.outlet_count || 0} outlet</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">Revenue</span>
                    <span className="font-bold tabular-nums">{fmtRp(Number(b.revenue || b.net_sales || 0))}</span>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Share</span>
                      <span className="tabular-nums font-semibold" style={{ color }}>{fmtPct(pct)}</span>
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

function Kpi({ icon: Icon, label, value }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="font-bold text-lg tabular-nums">{value}</div>
    </div>
  );
}
