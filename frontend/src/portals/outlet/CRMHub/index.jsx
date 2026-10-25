/**
 * CRM & Reservasi Hub — Unified dashboard for outlet staff.
 * Menggabungkan manajemen Reservasi dan Loyalty/CRM dalam satu halaman.
 * Routes: /outlet/crm
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, Clock, Users, Phone, Plus, RefreshCw, CheckCircle2,
  XCircle, UserCheck, MessageCircle, ChevronRight, Crown,
  Award, Gift, Zap, TrendingUp, Star, BarChart3, AlertTriangle,
  ArrowRight, Eye, UserPlus, Sparkles, CalendarCheck, Loader2,
  Badge as BadgeIcon, Filter, Flag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import EmptyState from "@/components/shared/EmptyState";
import { toast } from "sonner";
import { promptDialog } from "@/components/shared/confirmDialog";
import api, { unwrap } from "@/lib/api";
import { fmtDate, fmtRp } from "@/lib/format";
import { useAuth } from "@/lib/auth";

// ===================== CONSTANTS =====================
const STATUS_CONFIG = {
  pending:     { label: "Menunggu",       color: "bg-amber-100 text-amber-700 border-amber-300",    dot: "bg-amber-500" },
  waitlist:    { label: "Waitlist",       color: "bg-teal-100 text-teal-700 border-teal-300",       dot: "bg-teal-500" },
  confirmed:   { label: "Dikonfirmasi",   color: "bg-blue-100 text-blue-700 border-blue-300",       dot: "bg-blue-500" },
  rescheduled: { label: "Dijadwal Ulang", color: "bg-indigo-100 text-indigo-700 border-indigo-300", dot: "bg-indigo-500" },
  completed:   { label: "Selesai",        color: "bg-emerald-100 text-emerald-700 border-emerald-300", dot: "bg-emerald-500" },
  cancelled:   { label: "Dibatalkan",     color: "bg-red-100 text-red-700 border-red-300",          dot: "bg-red-400" },
  no_show:     { label: "Tidak Hadir",    color: "bg-gray-100 text-gray-600 border-gray-300",       dot: "bg-gray-400" },
};

const TIER_CONFIG = {
  bronze: { label: "Bronze", color: "#C9813C" },
  silver: { label: "Silver", color: "#A0AEC0" },
  gold:   { label: "Gold",   color: "#C9A876" },
};

// Label tab filter reservasi (dipakai juga untuk pesan empty state).
const RES_TAB_LABEL = { all: "Semua", pending: "Menunggu", confirmed: "Dikonfirmasi", done: "Selesai" };

// ===================== QUICK ACTION TILE =====================
function QATile({ to, onClick, icon: Icon, label, sublabel, accent = "aurora-1", testId }) {
  const accentClasses = {
    "aurora-1": "grad-aurora-soft text-foreground",
    "green":    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    "blue":     "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    "purple":   "bg-violet-500/10 text-violet-700 dark:text-violet-400",
    "amber":    "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    "rose":     "bg-rose-500/10 text-rose-700 dark:text-rose-400",
  };

  const inner = (
    <div
      className="glass-card-hover p-3 flex items-center gap-3 cursor-pointer group h-full"
      data-testid={testId}
    >
      <div className={`h-9 w-9 rounded-[calc(var(--radius)-2px)] flex items-center justify-center flex-shrink-0 ${accentClasses[accent]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight">{label}</p>
        {sublabel && <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>}
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
    </div>
  );

  if (onClick) return <button type="button" onClick={onClick} className="w-full text-left">{inner}</button>;
  return <Link to={to} className="block">{inner}</Link>;
}

// ===================== RESERVATION ROW =====================
function ReservationRow({ r, onAction, loading }) {
  const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
  const now = new Date();
  const rDate = new Date(`${r.reservation_date}T${r.reservation_time || "00:00"}`);
  const isPast = rDate < now && r.status !== "completed" && r.status !== "cancelled";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-start gap-3 py-3.5 px-4 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors ${isPast && r.status === "pending" ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}`}
      data-testid={`crm-reservation-row-${r.id}`}
    >
      {/* Time */}
      <div className="flex flex-col items-center gap-0.5 w-14 flex-shrink-0 mt-0.5">
        <span className="text-sm font-semibold tabular-nums">{r.reservation_time || "—"}</span>
        <div className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm leading-none">{r.customer_name}</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${sc.color}`}>
            {sc.label}
          </span>
          {isPast && r.status === "pending" && (
            <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-medium">
              <AlertTriangle className="h-3 w-3" /> Belum dikonfirmasi
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {r.pax} tamu</span>
          <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {r.customer_phone}</span>
          {r.area_preference && <span>Area: {r.area_preference}</span>}
          {r.special_requests?.type && (
            <span className="text-rose-500 inline-flex items-center gap-1"><Flag className="h-3 w-3" /> {r.special_requests.type}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
        {r.status === "pending" && (
          <Button size="sm" variant="outline"
            className="text-blue-700 border-blue-300 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-500/10"
            onClick={() => onAction(r.id, "confirmed")}
            disabled={loading}
            data-testid={`crm-confirm-btn-${r.id}`}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Konfirmasi
          </Button>
        )}
        {r.status === "confirmed" && (
          <Button size="sm" variant="outline"
            className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
            onClick={() => onAction(r.id, "completed")}
            disabled={loading}
            data-testid={`crm-complete-btn-${r.id}`}
          >
            <UserCheck className="h-3.5 w-3.5 mr-1" /> Selesai
          </Button>
        )}
        <Button size="icon-sm" variant="ghost" className="text-muted-foreground" asChild title="Lihat detail">
          <Link to={`/outlet/reservations`} state={{ openId: r.id }} aria-label={`Lihat detail reservasi ${r.customer_name || ""}`}>
            <Eye className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}

// ===================== MAIN COMPONENT =====================
export default function CRMHub() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Reservation state
  const [reservations, setReservations] = useState([]);
  const [resLoading, setResLoading] = useState(true);
  const [resTab, setResTab] = useState("all");
  const [actionLoading, setActionLoading] = useState(false);

  // Loyalty state
  const [loyaltyStats, setLoyaltyStats] = useState(null);
  const [loyaltyLoading, setLoyaltyLoading] = useState(true);
  const [recentMembers, setRecentMembers] = useState([]);

  // Today
  const today = new Date().toISOString().split("T")[0];
  const todayLabel = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // Load today's reservations
  const loadReservations = useCallback(async () => {
    setResLoading(true);
    try {
      const res = await api.get("/reservations", {
        params: { date_from: today, date_to: today, per_page: 50 },
      });
      const data = res.data?.data;
      setReservations(data?.items || []);
    } catch {
      toast.error("Gagal memuat reservasi");
    } finally {
      setResLoading(false);
    }
  }, [today]);

  // Load loyalty stats
  const loadLoyalty = useCallback(async () => {
    setLoyaltyLoading(true);
    try {
      const [statsRes, membersRes] = await Promise.all([
        api.get("/admin/loyalty/analytics/overview"),
        api.get("/admin/loyalty/customers", { params: { per_page: 5, sort: "created_at", order: "desc" } }),
      ]);
      setLoyaltyStats(statsRes.data?.data || statsRes.data || null);
      // Endpoint admin loyalty mengembalikan {items,total} tanpa envelope `data`.
      const membersData = membersRes.data?.data ?? membersRes.data;
      setRecentMembers(
        Array.isArray(membersData) ? membersData.slice(0, 5) :
        Array.isArray(membersData?.items) ? membersData.items.slice(0, 5) : []
      );
    } catch {
      // Silently fail for loyalty if no data
    } finally {
      setLoyaltyLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReservations();
    loadLoyalty();
  }, [loadReservations, loadLoyalty]);

  const handleRefresh = () => {
    loadReservations();
    loadLoyalty();
    toast.success("Data diperbarui");
  };

  // Quick status change
  const handleStatusChange = async (id, status, reason) => {
    setActionLoading(true);
    try {
      await api.post(`/reservations/${id}/status`, { status, reason });
      toast.success(`Reservasi → ${STATUS_CONFIG[status]?.label}`);
      await loadReservations();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal mengubah status");
    } finally {
      setActionLoading(false);
    }
  };

  // Filter reservations
  const filtered = reservations.filter(r => {
    if (resTab === "all") return true;
    if (resTab === "pending") return r.status === "pending";
    if (resTab === "confirmed") return r.status === "confirmed";
    if (resTab === "done") return ["completed", "no_show", "cancelled"].includes(r.status);
    return true;
  });

  // Sort by time
  const sorted = [...filtered].sort((a, b) => (a.reservation_time || "").localeCompare(b.reservation_time || ""));

  // KPI computations
  const totalToday = reservations.length;
  const pendingCount = reservations.filter(r => r.status === "pending").length;
  const confirmedCount = reservations.filter(r => r.status === "confirmed").length;
  const completedCount = reservations.filter(r => r.status === "completed").length;
  const totalPax = reservations.filter(r => ["pending","confirmed"].includes(r.status)).reduce((s,r) => s + (r.pax || 0), 0);

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="crm-hub-page">
      <PageHeader
        icon={Sparkles}
        title="CRM & Reservations"
        subtitle={`Reservasi hari ini & ringkasan loyalty · ${todayLabel}`}
        className="mb-0 md:mb-0"
        actions={
          <>
            <Button variant="outline" onClick={handleRefresh} data-testid="crm-refresh">
              <RefreshCw className="h-4 w-4" /> Muat ulang
            </Button>
            <Button asChild>
              <Link to="/outlet/reservations/new" data-testid="crm-new-reservation-btn">
                <Plus className="h-4 w-4" /> Buat Reservasi
              </Link>
            </Button>
          </>
        }
      />

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" data-testid="crm-kpi-strip">
        <CompactStatCard label="Reservasi Hari Ini" value={totalToday} sub="Semua status"
          icon={CalendarCheck} color="aurora-4" loading={resLoading} testId="kpi-reservasi-total" />
        <CompactStatCard label="Menunggu Konfirmasi" value={pendingCount} sub="Perlu tindakan"
          icon={Clock} color="aurora-3" tone={pendingCount > 0 ? "warning" : "default"} loading={resLoading} testId="kpi-reservasi-pending" />
        <CompactStatCard label="Dikonfirmasi" value={confirmedCount} sub="Siap datang"
          icon={CheckCircle2} color="aurora-1" loading={resLoading} testId="kpi-reservasi-confirmed" />
        <CompactStatCard label="Estimasi Tamu" value={totalPax} sub="Pending + dikonfirmasi"
          icon={Users} color="aurora-2" loading={resLoading} testId="kpi-reservasi-pax" />
        <CompactStatCard label="Total Member Loyalty" value={loyaltyStats?.total_customers ?? "—"}
          sub={loyaltyStats ? `${loyaltyStats.active_customers ?? 0} aktif` : undefined}
          icon={Crown} color="aurora-5" loading={loyaltyLoading} testId="kpi-loyalty-total" />
      </div>

      {/* ── Quick Actions ── */}
      <section data-testid="crm-quick-actions">
        <h2 className="text-base md:text-lg font-semibold mb-2">Aksi Cepat</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <QATile to="/outlet/reservations/new" icon={CalendarCheck} label="Buat Reservasi" sublabel="Walk-in atau telp" accent="blue" testId="qa-new-reservation" />
          <QATile to="/outlet/reservations" icon={Calendar} label="Semua Reservasi" sublabel="Lihat & kelola" accent="aurora-1" testId="qa-all-reservations" />
          <QATile to="/outlet/loyalty/input-poin" icon={Zap} label="Input Poin Kasir" sublabel="Scan struk" accent="amber" testId="qa-input-poin" />
          <QATile to="/outlet/voucher-redeem" icon={Gift} label="Redeem Voucher" sublabel="Tukar reward" accent="purple" testId="qa-voucher-redeem" />
          <QATile to="/admin/loyalty/customers" icon={Users} label="Daftar Member" sublabel="Cari & kelola" accent="green" testId="qa-members" />
          <QATile to="/admin/loyalty/analytics" icon={BarChart3} label="CRM Analytics" sublabel="Statistik loyalty" accent="rose" testId="qa-crm-analytics" />
        </div>
      </section>

      {/* ── Main Content: 2 columns ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 lg:gap-4">

        {/* LEFT: Today's Reservation Timeline */}
        <div className="lg:col-span-3 glass-card overflow-hidden" data-testid="crm-reservation-panel">
          {/* Panel header */}
          <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap border-b border-border/50">
            <div className="flex items-center gap-2.5">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <h3 className="text-sm md:text-base font-semibold">Reservasi Hari Ini</h3>
                {!resLoading && (
                  <p className="text-xs text-muted-foreground">{totalToday} reservasi · {totalPax} estimasi tamu</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Tabs value={resTab} onValueChange={setResTab}>
                <TabsList aria-label="Filter status reservasi">
                  <TabsTrigger value="all" data-testid="crm-res-tab-all">{RES_TAB_LABEL.all}</TabsTrigger>
                  <TabsTrigger value="pending" data-testid="crm-res-tab-pending">
                    {RES_TAB_LABEL.pending} {pendingCount > 0 && <span className="bg-amber-500 text-white rounded-full text-[11px] min-w-4 h-4 px-1 inline-flex items-center justify-center">{pendingCount}</span>}
                  </TabsTrigger>
                  <TabsTrigger value="confirmed" data-testid="crm-res-tab-confirmed">{RES_TAB_LABEL.confirmed}</TabsTrigger>
                  <TabsTrigger value="done" data-testid="crm-res-tab-done">{RES_TAB_LABEL.done}</TabsTrigger>
                </TabsList>
              </Tabs>
              <Button size="icon-sm" variant="ghost" asChild>
                <Link to="/outlet/reservations" aria-label="Lihat semua reservasi" title="Lihat semua reservasi">
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Reservation List */}
          <div className="min-h-[240px] max-h-[520px] overflow-y-auto" data-testid="crm-timeline">
            {resLoading ? (
              <div className="p-4 space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-10 w-14 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-7 w-24" />
                  </div>
                ))}
              </div>
            ) : sorted.length === 0 ? (
              <EmptyState
                icon={CalendarCheck}
                title={resTab === "all" ? "Belum ada reservasi hari ini" : `Tidak ada reservasi "${RES_TAB_LABEL[resTab] || resTab}"`}
                description="Reservasi dari telepon, walk-in, WhatsApp, atau website akan tampil di sini."
                action={
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/outlet/reservations/new">
                      <Plus className="h-4 w-4" /> Buat Reservasi
                    </Link>
                  </Button>
                }
              />
            ) : (
              <AnimatePresence>
                {sorted.map(r => (
                  <ReservationRow
                    key={r.id}
                    r={r}
                    onAction={(id, status) => {
                      if (status === "cancelled") {
                        promptDialog({
                          title: "Batalkan Reservasi",
                          description: `Reservasi atas nama ${r.customer_name || "-"} akan dibatalkan.`,
                          label: "Alasan pembatalan",
                          placeholder: "Opsional",
                          required: false,
                          multiline: true,
                          destructive: true,
                          confirmText: "Batalkan Reservasi",
                          cancelText: "Kembali",
                        }).then((reason) => { if (reason !== null) handleStatusChange(id, "cancelled", reason); });
                      } else {
                        handleStatusChange(id, status);
                      }
                    }}
                    loading={actionLoading}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* Footer */}
          {sorted.length > 0 && (
            <div className="px-4 py-3 border-t border-border/50 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{sorted.length} reservasi ditampilkan</p>
              <Link to="/outlet/reservations" className="text-xs font-medium text-foreground/70 hover:text-foreground flex items-center gap-1">
                Lihat semua <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>

        {/* RIGHT: Loyalty Panel */}
        <div className="lg:col-span-2 space-y-3 lg:space-y-4">

          {/* Loyalty KPIs mini */}
          <div className="glass-card p-4" data-testid="crm-loyalty-panel">
            <div className="flex items-center gap-2 mb-3">
              <Crown className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm md:text-base font-semibold">Loyalty Overview</h3>
              <Link to="/admin/loyalty" className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                Detail <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {loyaltyLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Stats row */}
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { label: "Total Member", val: loyaltyStats?.total_customers ?? 0, icon: Users, accent: "text-blue-600" },
                    { label: "Member Aktif", val: loyaltyStats?.active_customers ?? 0, icon: Zap, accent: "text-emerald-600" },
                    { label: "Poin Beredar", val: (loyaltyStats?.total_points_outstanding ?? 0).toLocaleString("id-ID"), icon: Star, accent: "text-amber-600" },
                    { label: "Redemption/30d", val: loyaltyStats?.redemptions_30d ?? 0, icon: Gift, accent: "text-violet-600" },
                  ].map(({ label, val, icon: Ic, accent }) => (
                    <div key={label} className="rounded-lg border border-border/60 p-2.5">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Ic className={`h-3.5 w-3.5 ${accent}`} />
                        <span className="text-base font-semibold tabular-nums">{val}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tier distribution */}
                {loyaltyStats?.tier_distribution && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Distribusi Tier</p>
                    <div className="space-y-1.5">
                      {Object.entries(loyaltyStats.tier_distribution).map(([tier, count]) => {
                        const total = loyaltyStats.total_customers || 1;
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                        const tc = TIER_CONFIG[tier];
                        return (
                          <div key={tier} className="flex items-center gap-2 text-xs">
                            <span className="w-16 text-muted-foreground inline-flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: tc?.color }} />
                              {tc?.label || tier}
                            </span>
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%`, backgroundColor: tc?.color }} />
                            </div>
                            <span className="w-10 text-right text-muted-foreground tabular-nums">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Recent Members */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm md:text-base font-semibold">Member Terbaru</h3>
              <Link to="/admin/loyalty/customers" className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                Semua <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {loyaltyLoading ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
            ) : recentMembers.length === 0 ? (
              <div className="text-center py-6">
                <Users className="h-7 w-7 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">Belum ada member terdaftar.</p>
                <Link to="/admin/loyalty/customers" className="text-xs text-foreground/60 hover:text-foreground underline mt-1 block">
                  Tambah member manual
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {recentMembers.map((m) => {
                  const tierConf = TIER_CONFIG[m.loyalty_tier] || TIER_CONFIG.bronze;
                  return (
                    <div key={m.id} className="py-2.5 flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                        {m.full_name?.[0] || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.full_name || "—"}</p>
                        <p className="text-xs text-muted-foreground truncate">{m.phone || m.email || "—"}</p>
                      </div>
                      <div className="flex-shrink-0">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: tierConf.color + "22", color: tierConf.color }}>
                          {tierConf.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Points activity hint */}
          {loyaltyStats && (
            <div className="glass-card p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-[calc(var(--radius)-2px)] bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-4 w-4 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Poin earned (30 hari)</p>
                <p className="text-base font-semibold tabular-nums">{(loyaltyStats.points_earned_30d || 0).toLocaleString("id-ID")} pts</p>
              </div>
              <Link to="/admin/loyalty/analytics" className="text-xs text-muted-foreground hover:text-foreground flex-shrink-0" aria-label="Buka CRM Analytics" title="Buka CRM Analytics">
                <BarChart3 className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
