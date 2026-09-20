/**
 * TourAnalytics — Admin page untuk melihat statistik penggunaan tour interactive.
 *
 * Menampilkan:
 * - Global summary (total starts/completes/skips, completion rate)
 * - Per-tour breakdown dengan completion rate, skip rate, avg duration
 * - Top performing tours (highest completion rate)
 * - Tours needing attention (high skip rate / low completion)
 * - Per-tour detail drill-down dengan step-by-step drop-off
 */
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Play,
  Sparkles,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import DataTable from "@/components/shared/DataTable";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getTourMetadata } from "@/contexts/tour/tourMap";
import { toast } from "sonner";

const PERIODS = [
  { value: "7", label: "7 hari" },
  { value: "30", label: "30 hari" },
  { value: "90", label: "90 hari" },
  { value: "365", label: "1 tahun" },
];

function fmtPct(v) {
  if (v == null || isNaN(v)) return "—";
  return (v * 100).toFixed(1) + "%";
}

function fmtNum(v) {
  if (v == null || isNaN(v)) return "0";
  return new Intl.NumberFormat("id-ID").format(v);
}

function fmtDuration(ms) {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}m ${rs}s`;
}

export default function TourAnalytics() {
  const [days, setDays] = useState("30");
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTourId, setSelectedTourId] = useState(null);

  const loadData = async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);
      const res = await api.get(`/tour-analytics/summary?days=${days}`);
      setSummary(unwrap(res));
      if (showToast) toast.success("Data analytics diperbarui");
    } catch (err) {
      const msg = err?.response?.data?.errors?.[0]?.message || "Gagal memuat analytics";
      toast.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  // Derived KPIs
  const tours = useMemo(() => summary?.tours || [], [summary]);
  const totals = summary?.totals || {};

  const { topPerformers, needAttention } = useMemo(() => {
    const withStarts = tours.filter((t) => t.starts >= 3);
    const top = [...withStarts]
      .sort((a, b) => b.completion_rate - a.completion_rate)
      .slice(0, 3);
    const attn = [...withStarts]
      .filter((t) => t.completion_rate < 0.5 || t.skip_rate > 0.4)
      .sort((a, b) => b.skip_rate - a.skip_rate)
      .slice(0, 3);
    return { topPerformers: top, needAttention: attn };
  }, [tours]);

  return (
    <div className="space-y-6" data-testid="tour-analytics-page">
      {/* Header */}
      <div className="glass-card p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="h-10 w-10 rounded-xl grad-aurora flex items-center justify-center text-white">
              <BarChart3 className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold mb-0.5">Tour Analytics</h2>
              <p className="text-sm text-muted-foreground">
                Lacak penggunaan & efektivitas panduan interaktif di seluruh sistem.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-32" data-testid="ta-period-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData(true)}
              disabled={refreshing}
              data-testid="ta-refresh"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Global KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4" data-testid="ta-global-kpis">
        <KpiCard
          label="Tour Dimulai"
          value={fmtNum(totals.total_starts || 0)}
          icon={Play}
          color="blue"
          loading={loading}
        />
        <KpiCard
          label="Selesai"
          value={fmtNum(totals.total_completes || 0)}
          icon={CheckCircle2}
          color="emerald"
          loading={loading}
        />
        <KpiCard
          label="Diskip"
          value={fmtNum(totals.total_skips || 0)}
          icon={XCircle}
          color="amber"
          loading={loading}
        />
        <KpiCard
          label="Completion Rate"
          value={fmtPct(totals.completion_rate)}
          icon={TrendingUp}
          color="purple"
          loading={loading}
        />
        <KpiCard
          label="Unique Users"
          value={fmtNum(totals.unique_users || 0)}
          icon={Users}
          color="slate"
          loading={loading}
        />
      </div>

      {/* Top performers + needs attention */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PerformerCard
            title="Tour Performa Terbaik"
            subtitle="Tingkat penyelesaian tertinggi (min. 3 starts)"
            icon={Sparkles}
            color="emerald"
            tours={topPerformers}
            emptyText="Belum cukup data — perlu lebih banyak tour starts."
            onSelect={setSelectedTourId}
          />
          <PerformerCard
            title="Perlu Perhatian"
            subtitle="Tour dengan skip rate tinggi atau completion rate rendah"
            icon={TrendingDown}
            color="amber"
            tours={needAttention}
            emptyText="Tidak ada tour yang perlu perhatian — semua performa baik!"
            onSelect={setSelectedTourId}
          />
        </div>
      )}

      {/* Per-tour table */}
      <div className="glass-card overflow-hidden" data-testid="ta-tour-table">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Semua Tour</h3>
            <p className="text-xs text-muted-foreground">
              Klik baris untuk lihat detail drop-off per step
            </p>
          </div>
          <Badge variant="secondary">{tours.length} tour aktif</Badge>
        </div>
        <DataTable
          columns={[
            { key: "tour", label: "Tour", primary: true, sortable: true,
              sortAccessor: (t) => getTourMetadata(t.tour_id)?.title || t.tour_id,
              render: (t) => (
                <div className="flex items-center gap-2">
                  <span className="text-base">{getTourMetadata(t.tour_id)?.icon || "📊"}</span>
                  <div>
                    <p className="font-medium text-sm">{getTourMetadata(t.tour_id)?.title || t.tour_id}</p>
                    <p className="text-xs text-muted-foreground">{t.tour_id}</p>
                  </div>
                </div>
              ) },
            { key: "starts", label: "Starts", numeric: true, sortable: true, render: (t) => fmtNum(t.starts) },
            { key: "completes", label: "Completes", numeric: true, sortable: true, render: (t) => fmtNum(t.completes) },
            { key: "skips", label: "Skips", numeric: true, sortable: true, render: (t) => fmtNum(t.skips) },
            { key: "closes", label: "Closes", numeric: true, sortable: true, hideOnMobile: true, render: (t) => fmtNum(t.closes) },
            { key: "completion_rate", label: "Completion %", numeric: true, sortable: true, render: (t) => <CompletionBadge rate={t.completion_rate} /> },
            { key: "skip_rate", label: "Skip %", numeric: true, sortable: true, render: (t) => <SkipBadge rate={t.skip_rate} /> },
            { key: "unique_users", label: "Users", numeric: true, sortable: true, hideOnMobile: true, render: (t) => fmtNum(t.unique_users) },
            { key: "avg_duration_ms", label: "Avg. Durasi", numeric: true, sortable: true, hideOnMobile: true, render: (t) => <span className="text-xs text-muted-foreground">{fmtDuration(t.avg_duration_ms)}</span> },
          ]}
          rows={tours}
          keyField="tour_id"
          loading={loading}
          onRowClick={(t) => setSelectedTourId(t.tour_id)}
          empty={<div className="py-8 text-center text-sm text-muted-foreground" data-testid="ta-empty">Belum ada event tour di periode ini.</div>}
          rowTestIdPrefix="ta-row"
        />
      </div>

      {/* Detail dialog */}
      <TourDetailDialog
        tourId={selectedTourId}
        days={days}
        onClose={() => setSelectedTourId(null)}
      />
    </div>
  );
}

// ============================================================
// Helper components
// ============================================================
function KpiCard({ label, value, icon: Icon, color, loading }) {
  const colorMap = {
    blue: "from-blue-500/15 to-blue-500/5 text-blue-600",
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-600",
    amber: "from-amber-500/15 to-amber-500/5 text-amber-600",
    purple: "from-purple-500/15 to-purple-500/5 text-purple-600",
    slate: "from-slate-500/15 to-slate-500/5 text-slate-600",
  };
  return (
    <div className="glass-card p-4">
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br mb-2 ${colorMap[color] || colorMap.slate}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold tabular-nums">
        {loading ? "…" : value}
      </p>
    </div>
  );
}

function PerformerCard({ title, subtitle, icon: Icon, color, tours, emptyText, onSelect }) {
  const colorMap = {
    emerald: "from-emerald-500 to-teal-500",
    amber: "from-amber-500 to-orange-500",
  };
  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className={`h-8 w-8 rounded-lg flex items-center justify-center text-white bg-gradient-to-br ${colorMap[color]}`}>
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{subtitle}</p>
      {tours.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {tours.map((t) => (
            <button
              key={t.tour_id}
              onClick={() => onSelect(t.tour_id)}
              className="w-full flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
              data-testid={`ta-performer-${t.tour_id}`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-lg">{getTourMetadata(t.tour_id)?.icon || "📊"}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {getTourMetadata(t.tour_id)?.title || t.tour_id}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fmtNum(t.starts)} starts · {fmtNum(t.unique_users)} users
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold tabular-nums">
                  {fmtPct(t.completion_rate)}
                </p>
                <p className="text-xs text-muted-foreground">selesai</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CompletionBadge({ rate }) {
  if (rate == null) return <span className="text-muted-foreground">—</span>;
  const cls =
    rate >= 0.7
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
      : rate >= 0.4
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
      : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium tabular-nums ${cls}`}>
      {fmtPct(rate)}
    </span>
  );
}

function SkipBadge({ rate }) {
  if (rate == null) return <span className="text-muted-foreground">—</span>;
  const cls =
    rate <= 0.2
      ? "text-muted-foreground"
      : rate <= 0.4
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400 font-medium";
  return <span className={`text-xs tabular-nums ${cls}`}>{fmtPct(rate)}</span>;
}

// ============================================================
// Detail Dialog
// ============================================================
function TourDetailDialog({ tourId, days, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tourId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    api
      .get(`/tour-analytics/tour/${tourId}?days=${days}`)
      .then((res) => setDetail(unwrap(res)))
      .catch(() => toast.error("Gagal memuat detail"))
      .finally(() => setLoading(false));
  }, [tourId, days]);

  const meta = tourId ? getTourMetadata(tourId) : null;

  return (
    <Dialog open={!!tourId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl" data-testid="ta-detail-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{meta?.icon || "📊"}</span>
            {meta?.title || tourId}
          </DialogTitle>
          <DialogDescription>
            {meta?.description} · Last {days} days
          </DialogDescription>
        </DialogHeader>

        {loading || !detail ? (
          <div className="py-8 text-center text-muted-foreground">Memuat...</div>
        ) : (
          <div className="space-y-4">
            {/* Quick stats */}
            <div className="grid grid-cols-4 gap-2">
              <MiniStat label="Starts" value={fmtNum(detail.starts)} />
              <MiniStat
                label="Completes"
                value={fmtNum(detail.completes)}
                color="text-emerald-600"
              />
              <MiniStat
                label="Skips"
                value={fmtNum(detail.skips)}
                color="text-amber-600"
              />
              <MiniStat
                label="Completion"
                value={fmtPct(detail.completion_rate)}
                color="text-purple-600"
              />
            </div>

            {/* Step views drop-off */}
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                Step View Pattern
              </h4>
              {detail.step_views.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Belum ada step view event.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {detail.step_views.map((s) => {
                    const max = Math.max(...detail.step_views.map((x) => x.count));
                    const pct = max > 0 ? (s.count / max) * 100 : 0;
                    return (
                      <div key={s.step} className="flex items-center gap-2">
                        <span className="text-xs w-16 text-muted-foreground">
                          Step {s.step + 1}
                        </span>
                        <div className="flex-1 h-5 bg-muted rounded relative overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums w-12 text-right">
                          {fmtNum(s.count)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Skip drop-off */}
            {detail.skip_dropoffs.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-amber-600">
                  <TrendingDown className="h-4 w-4" />
                  Skip Drop-off (langkah dimana user keluar)
                </h4>
                <div className="space-y-1.5">
                  {detail.skip_dropoffs.map((s) => (
                    <div key={s.step} className="flex items-center gap-2">
                      <span className="text-xs w-16 text-muted-foreground">
                        Step {s.step + 1}
                      </span>
                      <div className="flex-1 h-5 bg-muted rounded">
                        <div
                          className="h-full bg-amber-500 rounded"
                          style={{
                            width: `${
                              detail.skips > 0
                                ? Math.min(100, (s.count / detail.skips) * 100)
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      <span className="text-xs tabular-nums w-12 text-right">
                        {fmtNum(s.count)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MiniStat({ label, value, color = "" }) {
  return (
    <div className="bg-muted/40 rounded-lg p-3">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
