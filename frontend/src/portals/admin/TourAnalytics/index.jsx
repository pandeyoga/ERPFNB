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
  MousePointerClick,
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
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";

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

/** Ikon tour seragam (lucide) — emoji dari tourMap tidak dirender di UI admin. */
function TourIcon({ className = "h-4 w-4" }) {
  return (
    <span className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
      <MousePointerClick className={className} />
    </span>
  );
}

/** embedded=true saat dirender di hub Monitoring (/admin/operations/tour-analytics). */
export default function TourAnalytics({ embedded = false }) {
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

  const intro = "Lacak penggunaan & efektivitas panduan interaktif di seluruh sistem.";
  const headerActions = (
    <>
      <Select value={days} onValueChange={setDays}>
        <SelectTrigger className="w-32" aria-label="Periode" data-testid="ta-period-select">
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
        onClick={() => loadData(true)}
        disabled={refreshing}
        data-testid="ta-refresh"
      >
        <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        Muat ulang
      </Button>
    </>
  );

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="tour-analytics-page">
      {/* Header */}
      {embedded ? (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-muted-foreground">{intro}</p>
          <div className="flex gap-2">{headerActions}</div>
        </div>
      ) : (
        <PageHeader icon={BarChart3} title="Tour Analytics" subtitle={intro} actions={headerActions} />
      )}

      {/* Global KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="ta-global-kpis">
        <CompactStatCard label="Tour Dimulai" value={fmtNum(totals.total_starts || 0)} icon={Play} color="aurora-3" loading={loading} />
        <CompactStatCard label="Selesai" value={fmtNum(totals.total_completes || 0)} icon={CheckCircle2} color="aurora-4" loading={loading} />
        <CompactStatCard label="Diskip" value={fmtNum(totals.total_skips || 0)} icon={XCircle} color="aurora-5" loading={loading} />
        <CompactStatCard label="Completion Rate" value={fmtPct(totals.completion_rate)} icon={TrendingUp} color="aurora-2" loading={loading} />
        <CompactStatCard label="Unique Users" value={fmtNum(totals.unique_users || 0)} icon={Users} color="aurora-1" loading={loading} />
      </div>

      {/* Top performers + needs attention */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
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
            <h3 className="text-sm md:text-base font-semibold">Semua Tour</h3>
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
                  <TourIcon className="h-3.5 w-3.5" />
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
function PerformerCard({ title, subtitle, icon: Icon, color, tours, emptyText, onSelect }) {
  const colorMap = {
    emerald: "from-emerald-500 to-teal-500",
    amber: "from-amber-500 to-orange-500",
  };
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className={`h-8 w-8 rounded-lg flex items-center justify-center text-white bg-gradient-to-br ${colorMap[color]}`}>
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="text-sm md:text-base font-semibold">{title}</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{subtitle}</p>
      {tours.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {tours.map((t) => (
            <button
              type="button"
              key={t.tour_id}
              onClick={() => onSelect(t.tour_id)}
              className="w-full flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
              data-testid={`ta-performer-${t.tour_id}`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <TourIcon />
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
            <TourIcon />
            {meta?.title || tourId}
          </DialogTitle>
          <DialogDescription>
            {meta?.description} · {days} hari terakhir
          </DialogDescription>
        </DialogHeader>

        {loading || !detail ? (
          <div className="py-8 text-center text-muted-foreground">Memuat...</div>
        ) : (
          <div className="space-y-4">
            {/* Quick stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <CompactStatCard size="sm" label="Starts" value={fmtNum(detail.starts)} />
              <CompactStatCard size="sm" label="Completes" value={fmtNum(detail.completes)} tone="success" />
              <CompactStatCard size="sm" label="Skips" value={fmtNum(detail.skips)} tone="warning" />
              <CompactStatCard size="sm" label="Completion" value={fmtPct(detail.completion_rate)} tone="info" />
            </div>

            {/* Step views drop-off */}
            <div>
              <h3 className="text-sm md:text-base font-semibold mb-2 flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                Step View Pattern
              </h3>
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
                <h3 className="text-sm md:text-base font-semibold mb-2 flex items-center gap-1.5 text-amber-600">
                  <TrendingDown className="h-4 w-4" />
                  Skip Drop-off (langkah dimana user keluar)
                </h3>
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
