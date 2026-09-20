/**
 * CMSAnalytics — Sprint K: Content Analytics Dashboard
 * Shows page views, top content, daily trends.
 */
import { useState, useEffect } from "react";
import { BarChart2, TrendingUp, Eye, RefreshCw, Loader2, Globe, Newspaper, Tag, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { GlassTooltip } from "@/components/shared/charts/chartKit";
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
    { label: `Total Views (${days}d)`, value: overview.total_views?.toLocaleString() || "0", icon: Eye, color: "text-blue-600 bg-blue-50" },
    { label: "Views 7 Hari Terakhir", value: overview.views_7d?.toLocaleString() || "0", icon: TrendingUp, color: "text-green-600 bg-green-50" },
    { label: "Brand Views", value: (overview.by_type?.brand || 0).toLocaleString(), icon: Globe, color: "text-purple-600 bg-purple-50" },
    { label: "News Views", value: (overview.by_type?.news || 0).toLocaleString(), icon: Newspaper, color: "text-amber-600 bg-amber-50" },
  ] : [];

  // Fill missing dates in trend
  const trend = overview?.daily_trend || [];

  const filteredPopular = contentTypeFilter === "all"
    ? popular
    : popular.filter(p => p.content_type === contentTypeFilter);

  return (
    <div className="space-y-6" data-testid="cms-analytics">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-blue-600" />
            Content Analytics
          </h3>
          <p className="text-sm text-muted-foreground">Page views dan performa konten publik.</p>
        </div>
        <div className="flex items-center gap-2">
          {PERIOD_OPTIONS.map(o => (
            <Button key={o.value} size="sm" variant={days === o.value ? "default" : "outline"}
                    onClick={() => setDays(o.value)}>
              {o.label}
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={() => load(days)} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {loading && !overview ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {kpiCards.map((card, i) => {
              const Icon = card.icon;
              return (
                <div key={i} className="border rounded-xl p-4 bg-white">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${card.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="text-2xl font-bold">{card.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{card.label}</div>
                </div>
              );
            })}
          </div>

          {/* Daily Trend Chart */}
          {trend.length > 0 && (
            <div className="border rounded-xl p-5 bg-white">
              <h4 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                Daily Page Views — {days} hari terakhir
              </h4>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    formatter={(v) => [v.toLocaleString(), "Views"]}
                    labelStyle={{ fontSize: 12 }}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Line type="monotone" dataKey="views" stroke="#3B82F6" strokeWidth={2}
                        dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {trend.length === 0 && (
            <div className="border rounded-xl p-10 bg-white text-center">
              <BarChart2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground text-sm">Belum ada data views untuk periode ini.</p>
              <p className="text-xs text-muted-foreground mt-1">Tracking dimulai saat pengunjung membuka halaman publik.</p>
            </div>
          )}

          {/* Popular Content */}
          {popular.length > 0 && (
            <div className="border rounded-xl bg-white overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Eye className="h-4 w-4 text-amber-600" />
                  Konten Terpopuler ({days} hari)
                </h4>
                <div className="flex gap-1">
                  {["all", "brand", "news", "outlet", "menu"].map(t => (
                    <Button key={t} size="sm" variant={contentTypeFilter === t ? "default" : "ghost"}
                            className="h-6 text-xs px-2"
                            onClick={() => setContentTypeFilter(t)}>
                      {t === "all" ? "All" : TYPE_LABELS[t]}
                    </Button>
                  ))}
                </div>
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
