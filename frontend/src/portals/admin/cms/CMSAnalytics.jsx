/**
 * CMSAnalytics — Sprint K: Content Analytics Dashboard
 * Shows page views, top content, daily trends.
 */
import { useState, useEffect } from "react";
import { BarChart2, TrendingUp, Eye, RefreshCw, Loader2, Globe, Newspaper, Tag, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { GlassTooltip, axisProps, gridProps } from "@/components/shared/charts/chartKit";
import CompactStatCard from "@/components/shared/CompactStatCard";
import EmptyState from "@/components/shared/EmptyState";
import SegmentedFilter from "@/components/shared/SegmentedFilter";
import api from "@/lib/api";
import { toast } from "sonner";

const PERIOD_OPTIONS = [
  { label: "7 Hari", value: 7 },
  { label: "30 Hari", value: 30 },
  { label: "90 Hari", value: 90 },
];

const TYPE_ICONS = {
  brand: Globe, news: Newspaper, outlet: Tag, menu: UtensilsCrossed,
};
const TYPE_LABELS = { brand: "Brand", news: "News", outlet: "Outlet", menu: "Menu" };
const TYPE_COLORS = { brand: "#7C3AED", news: "#2563EB", outlet: "#0D9488", menu: "#EA580C" };

export default function CMSAnalytics() {
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState(null);
  const [popular, setPopular] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contentTypeFilter, setContentTypeFilter] = useState("all");

  const load = async (d = days) => {
    setLoading(true);
    try {
      const [ovr, pop] = await Promise.all([
        api.get("/admin/cms/analytics/overview", { params: { days: d } }),
        api.get("/admin/cms/analytics/popular", { params: { days: d, limit: 10 } }),
      ]);
      setOverview(ovr.data?.data);
      setPopular(pop.data?.data || []);
    } catch { toast.error("Gagal memuat analytics"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(days); }, [days]);

  const kpiCards = overview ? [
    { label: `Total Views (${days}d)`, value: overview.total_views?.toLocaleString() || "0", icon: Eye, color: "aurora-3" },
    { label: "Views 7 Hari Terakhir", value: overview.views_7d?.toLocaleString() || "0", icon: TrendingUp, color: "aurora-4" },
    { label: "Brand Views", value: (overview.by_type?.brand || 0).toLocaleString(), icon: Globe, color: "aurora-2" },
    { label: "News Views", value: (overview.by_type?.news || 0).toLocaleString(), icon: Newspaper, color: "aurora-5" },
  ] : [];

  // Fill missing dates in trend
  const trend = overview?.daily_trend || [];

  const filteredPopular = contentTypeFilter === "all"
    ? popular
    : popular.filter(p => p.content_type === contentTypeFilter);

  return (
    <div className="space-y-3" data-testid="cms-analytics">
      {/* Toolbar: deskripsi + periode + muat ulang (judul sudah di PageHeader/tab CMS Studio) */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">Page views dan performa konten publik.</p>
        <div className="flex items-center gap-2">
          <SegmentedFilter
            value={days}
            onChange={(v) => setDays(Number(v))}
            ariaLabel="Periode analytics"
            testId="cms-analytics-period"
            options={PERIOD_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
          />
          <Button variant="outline" size="icon" onClick={() => load(days)} disabled={loading}
                  aria-label="Muat ulang" title="Muat ulang" data-testid="cms-analytics-refresh">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {loading && !overview ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpiCards.map((card) => (
              <CompactStatCard key={card.label} label={card.label} value={card.value} icon={card.icon} color={card.color} />
            ))}
          </div>

          {/* Daily Trend Chart */}
          {trend.length > 0 && (
            <div className="glass-card p-4">
              <h3 className="text-sm md:text-base font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                Daily Page Views — {days} hari terakhir
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="date" {...axisProps} tickFormatter={d => d.slice(5)} />
                  <YAxis {...axisProps} allowDecimals={false} />
                  <Tooltip content={<GlassTooltip valueFormatter={(v) => Number(v).toLocaleString("id-ID")} />} />
                  <Line type="monotone" dataKey="views" name="Views" stroke="#3B82F6" strokeWidth={2}
                        dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {trend.length === 0 && (
            <div className="glass-card">
              <EmptyState
                icon={BarChart2}
                title="Belum ada data views untuk periode ini"
                description="Tracking dimulai saat pengunjung membuka halaman publik."
              />
            </div>
          )}

          {/* Popular Content */}
          {popular.length > 0 && (
            <div className="glass-card overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between gap-3 flex-wrap">
                <h3 className="text-sm md:text-base font-semibold flex items-center gap-2">
                  <Eye className="h-4 w-4 text-amber-600" />
                  Konten Terpopuler ({days} hari)
                </h3>
                <SegmentedFilter
                  value={contentTypeFilter}
                  onChange={setContentTypeFilter}
                  ariaLabel="Filter tipe konten"
                  testId="cms-analytics-type-filter"
                  options={["all", "brand", "news", "outlet", "menu"].map(t => ({
                    value: t,
                    label: t === "all" ? "Semua" : TYPE_LABELS[t],
                  }))}
                />
              </div>
              <div className="divide-y">
                {filteredPopular.map((item, i) => {
                  const Icon = TYPE_ICONS[item.content_type] || Globe;
                  const maxViews = popular[0]?.views || 1;
                  const pct = Math.round((item.views / maxViews) * 100);
                  return (
                    <div key={i} className="flex items-center gap-3 p-3">
                      <span className="text-sm font-bold text-muted-foreground w-5 flex-shrink-0">{i + 1}</span>
                      <Icon className={`h-4 w-4 flex-shrink-0`}
                            style={{ color: TYPE_COLORS[item.content_type] || "#6b7280" }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium line-clamp-1">{item.title}</div>
                        <div className="text-xs text-muted-foreground">{TYPE_LABELS[item.content_type]}</div>
                        <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all"
                               style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <span className="text-sm font-semibold flex-shrink-0">
                        {item.views.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
