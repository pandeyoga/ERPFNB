/** ReservationList/index.jsx */
/**
 * Outlet Portal — Reservation Management
 * Statuses: pending, waitlist, confirmed, rescheduled, cancelled, completed, no_show
 * DP/Downpayment: amount, status, payment_method, dp_deadline, dp_reference, dp_paid_at
 */
import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Calendar, Clock, Users, Phone, Plus, Search, Filter,
  CheckCircle2, XCircle, Eye, RefreshCw, CalendarCheck, Loader2,
  ChevronLeft, ChevronRight, MoreVertical, MessageCircle, AlertCircle,
  UserCheck, X, Edit2, Trash2, CalendarX, CalendarClock, ListOrdered,
  Banknote, CreditCard, Wallet, QrCode, Clock3, CheckCheck,
  History, ChevronDown, AlertTriangle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import DataTable from "@/components/shared/DataTable";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import EmptyState from "@/components/shared/EmptyState";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import api from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useOutletScopeCtx } from "../OutletScopeContext";

// ─── STATUS CONFIG ──────────────────────────────────────────────
import { STATUS_CONFIG, SOURCE_LABELS, DEPOSIT_CONFIG, fmtRp, fmtDate } from "./constants";
import StatusBadge from "./StatusBadge";
import DepositPanel from "./DepositPanel";
import RescheduleDialog from "./RescheduleDialog";
import { confirmDialog, promptDialog } from "@/components/shared/confirmDialog";
import ListToolbar from "@/components/shared/ListToolbar";

export default function ReservationList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // ── Outlet Scope ──
  const { outletId, setOutletId, scopedOutlets, isFullAccess, currentOutlet, allowAllOption } = useOutletScopeCtx();

  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState({}); // dari API: seluruh hasil filter, bukan halaman aktif
  const PER_PAGE = 20;

  const [filters, setFilters] = useState({ status: "", search: "", date_from: "", date_to: "" });

  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // Dialogs
  const [rescheduleTarget, setRescheduleTarget] = useState(null);

  const today = new Date().toISOString().split("T")[0];

  // ── Load ──
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page, per_page: PER_PAGE,
        ...(filters.status && { status: filters.status }),
        ...(filters.search && { search: filters.search }),
        ...(filters.date_from && { date_from: filters.date_from }),
        ...(filters.date_to && { date_to: filters.date_to }),
        // Scope: pass outlet_id if a specific outlet is selected
        ...(outletId && { outlet_id: outletId }),
      };
      const res = await api.get("/reservations", { params });
      if (res.data.success) {
        const { items, meta } = res.data.data;
        setReservations(items || []);
        setTotal(meta?.total || 0);
        setStatusCounts(meta?.status_counts || {});
        setTotalPages(Math.ceil((meta?.total || 0) / PER_PAGE));
      }
    } catch { toast.error("Gagal memuat reservasi"); }
    finally { setLoading(false); }
  }, [page, filters, outletId]);

  useEffect(() => { load(); }, [load]);

  // Reset page when outlet scope changes
  useEffect(() => { setPage(1); }, [outletId]);

  // Deep link dari CRM Hub ("Lihat detail" → state.openId): buka dialog detail reservasi.
  // Sebelumnya state ini diabaikan sehingga tombol hanya membuka daftar.
  useEffect(() => {
    const openId = location.state?.openId;
    if (!openId) return;
    api.get(`/reservations/${openId}`)
      .then(r => { if (r.data?.success) { setSelected(r.data.data); setDetailOpen(true); } })
      .catch(() => toast.error("Gagal memuat detail reservasi"))
      .finally(() => navigate(location.pathname, { replace: true, state: null }));
  }, [location.state]); // eslint-disable-line

  // ── Status Change ──
  const handleStatusChange = async (id, status, reason) => {
    setStatusLoading(true);
    try {
      await api.post(`/reservations/${id}/status`, { status, reason });
      toast.success(`Status → ${STATUS_CONFIG[status]?.label}`);
      load();
      if (selected?.id === id) {
        const r = await api.get(`/reservations/${id}`);
        if (r.data.success) setSelected(r.data.data);
      }
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal mengubah status");
    } finally {
      setStatusLoading(false);
    }
  };

  // Pembatalan memakai promptDialog global (alasan opsional).
  const handleCancel = async (r) => {
    if (!r) return;
    const reason = await promptDialog({
      title: "Batalkan Reservasi",
      description: `Reservasi atas nama ${r.customer_name || "-"} akan dibatalkan. DP yang sudah dibayar akan otomatis di-refund.`,
      label: "Alasan pembatalan",
      placeholder: "Opsional",
      required: false,
      multiline: true,
      destructive: true,
      confirmText: "Ya, Batalkan",
      cancelText: "Kembali",
    });
    if (reason === null) return;
    handleStatusChange(r.id, "cancelled", reason);
  };

  const handleDetailUpdate = (updated) => {
    if (!updated) return;
    setSelected(updated);
    setReservations(rs => rs.map(r => r.id === updated.id ? updated : r));
  };

  const handleDelete = async (id) => {
    if (!(await confirmDialog("Hapus reservasi ini permanen?"))) return;
    try {
      await api.delete(`/reservations/${id}`);
      toast.success("Reservasi dihapus");
      setDetailOpen(false);
      load();
    } catch { toast.error("Gagal menghapus"); }
  };

  // ── Quick stats ──
  const pendingCount    = statusCounts.pending ?? 0;
  const waitlistCount   = statusCounts.waitlist ?? 0;
  const confirmedCount  = statusCounts.confirmed ?? 0;
  const rescheduledCount = statusCounts.rescheduled ?? 0;
  const todayCount      = reservations.filter(r => r.reservation_date === today).length;

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="reservation-list-page">
      {/* Outlet dipilih lewat header Outlet Aktif (tidak ada picker kedua di halaman). */}
      <PageHeader
        icon={CalendarCheck}
        title="Reservations"
        subtitle={`Kelola reservasi, waitlist, jadwal ulang & DP · ${outletId && currentOutlet ? currentOutlet.name : "Semua Outlet"}`}
        className="mb-0 md:mb-0"
        actions={
          <>
            <Button variant="outline" onClick={load} data-testid="reservation-refresh">
              <RefreshCw className="h-4 w-4" /> Muat ulang
            </Button>
            <Button onClick={() => navigate("/outlet/reservations/new")} data-testid="btn-new-reservation">
              <Plus className="h-4 w-4" /> Buat Reservasi
            </Button>
          </>
        }
      />

      {/* Status KPI strip — Total = semua hasil filter; angka status dihitung dari halaman yang tampil. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" data-testid="reservation-kpi-strip">
        <CompactStatCard label="Total" value={total} icon={CalendarCheck} color="aurora-1" size="sm" loading={loading} testId="reservation-kpi-total" />
        <CompactStatCard label="Menunggu" value={pendingCount} tone={pendingCount > 0 ? "warning" : "default"} icon={Clock} color="aurora-3" size="sm" loading={loading} testId="reservation-kpi-pending" />
        <CompactStatCard label="Waitlist" value={waitlistCount} icon={ListOrdered} color="aurora-2" size="sm" loading={loading} testId="reservation-kpi-waitlist" />
        <CompactStatCard label="Dikonfirmasi" value={confirmedCount} tone="info" icon={CheckCircle2} color="aurora-4" size="sm" loading={loading} testId="reservation-kpi-confirmed" />
        <CompactStatCard label="Dijadwal Ulang" value={rescheduledCount} icon={CalendarClock} color="aurora-5" size="sm" loading={loading} testId="reservation-kpi-rescheduled" />
      </div>

      {/* Filters */}
      <div className="glass-card overflow-hidden" data-testid="reservation-table-wrap">
        {/* Filter menempel pada tabel yang difilternya (DESIGN_SYSTEM §10.3). */}
        <ListToolbar testId="reservation-filters">
          <div className="flex flex-wrap gap-2.5 w-full">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cari nama / nomor HP..." value={filters.search}
                aria-label="Cari nama atau nomor HP"
                onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1); }}
                className="pl-9" data-testid="filter-search-input" />
            </div>
            <Select value={filters.status || "all"} onValueChange={v => { setFilters(f => ({ ...f, status: v === "all" ? "" : v })); setPage(1); }}>
              <SelectTrigger className="w-44" aria-label="Filter status" data-testid="filter-status-select">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={filters.date_from}
              onChange={e => { setFilters(f => ({ ...f, date_from: e.target.value })); setPage(1); }}
              className="w-40" aria-label="Dari tanggal" title="Dari tanggal" data-testid="filter-date-from" />
            <Input type="date" value={filters.date_to}
              onChange={e => { setFilters(f => ({ ...f, date_to: e.target.value })); setPage(1); }}
              className="w-40" aria-label="Sampai tanggal" title="Sampai tanggal" data-testid="filter-date-to" />
            {(filters.status || filters.search || filters.date_from || filters.date_to) && (
              <Button variant="ghost" onClick={() => { setFilters({ status: "", search: "", date_from: "", date_to: "" }); setPage(1); }} data-testid="filter-reset">
                <X className="h-4 w-4" /> Reset
              </Button>
            )}
          </div>
        </ListToolbar>
        <DataTable
          rows={reservations}
          keyField="id"
          loading={loading}
          loadingRows={6}
          rowTestIdPrefix="reservation-row"
          onRowClick={(r) => { setSelected(r); setDetailOpen(true); }}
          rowClassName={(r) => r.reservation_date === today ? "bg-blue-50/30" : ""}
          empty={(
            <EmptyState
              icon={CalendarCheck}
              title="Belum ada reservasi"
              description="Reservasi dari telepon, walk-in, WhatsApp, atau website akan tampil di sini."
              action={
                <Button size="sm" variant="outline" onClick={() => navigate("/outlet/reservations/new")}>
                  <Plus className="h-4 w-4" /> Buat Reservasi
                </Button>
              }
            />
          )}
          columns={[
            { key: "customer_name", label: "Tamu", primary: true, sortable: true,
              render: (r) => (
                <div>
                  <p className="font-medium">{r.customer_name}</p>
                  <p className="text-muted-foreground text-xs flex items-center gap-1">
                    <Phone className="h-3 w-3" />{r.customer_phone}
                  </p>
                </div>
              ) },
            { key: "reservation_date", label: "Jadwal", sortable: true,
              render: (r) => (
                <div>
                  <p className="font-medium text-sm">{r.reservation_date}</p>
                  <p className="text-muted-foreground text-xs flex items-center gap-1">
                    <Clock className="h-3 w-3" />{r.reservation_time || "—"}
                  </p>
                  {r.status === "rescheduled" && r.reschedule_history?.length > 0 && (
                    <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-0.5">Dijadwal ulang {r.reschedule_history.length}x</p>
                  )}
                </div>
              ) },
            { key: "pax", label: "Pax", numeric: true, sortable: true,
              render: (r) => (
                <span className="flex items-center gap-1 text-sm justify-end">
                  <Users className="h-4 w-4 text-muted-foreground" /> {r.pax}
                </span>
              ) },
            ...((!outletId || isFullAccess) ? [{
              key: "outlet", label: "Outlet", hideOnMobile: true,
              render: (r) => (
                <p className="text-xs text-muted-foreground truncate max-w-[120px]">
                  {r.outlet_name || scopedOutlets.find(o => o.id === r.outlet_id)?.name || r.outlet_id || "—"}
                </p>
              ),
            }] : []),
            { key: "dp", label: "DP",
              render: (r) => {
                const dpPending = r.deposit_status === "pending" && r.deposit_amount > 0;
                return r.deposit_amount > 0 ? (
                  <div>
                    <p className="text-xs font-medium">{fmtRp(r.deposit_amount)}</p>
                    <p className={`text-xs ${DEPOSIT_CONFIG[r.deposit_status]?.color || "text-muted-foreground"}`}>
                      {DEPOSIT_CONFIG[r.deposit_status]?.label}
                    </p>
                    {dpPending && <AlertTriangle className="h-3 w-3 text-amber-800 dark:text-amber-400 mt-0.5" />}
                  </div>
                ) : <span className="text-xs text-muted-foreground">—</span>;
              } },
            { key: "status", label: "Status",
              render: (r) => <StatusBadge status={r.status} /> },
          ]}
          rowAction={(r) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Aksi lebih lanjut">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setSelected(r); setDetailOpen(true); }}>
                  <Eye className="h-4 w-4 mr-2" /> Lihat detail
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/outlet/reservations/${r.id}/edit`)}>
                  <Edit2 className="h-4 w-4 mr-2" /> Ubah
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {r.status === "pending" && (
                  <DropdownMenuItem onClick={() => handleStatusChange(r.id, "confirmed")}>
                    <CheckCircle2 className="h-4 w-4 mr-2 text-blue-700 dark:text-blue-400" /> Konfirmasi
                  </DropdownMenuItem>
                )}
                {r.status === "pending" && (
                  <DropdownMenuItem onClick={() => handleStatusChange(r.id, "waitlist")}>
                    <ListOrdered className="h-4 w-4 mr-2 text-teal-700 dark:text-teal-400" /> Pindah ke Waitlist
                  </DropdownMenuItem>
                )}
                {r.status === "waitlist" && (
                  <DropdownMenuItem onClick={() => handleStatusChange(r.id, "confirmed")}>
                    <CheckCircle2 className="h-4 w-4 mr-2 text-blue-700 dark:text-blue-400" /> Konfirmasi dari Waitlist
                  </DropdownMenuItem>
                )}
                {r.status === "rescheduled" && (
                  <DropdownMenuItem onClick={() => handleStatusChange(r.id, "confirmed")}>
                    <CheckCircle2 className="h-4 w-4 mr-2 text-blue-700 dark:text-blue-400" /> Konfirmasi Jadwal Baru
                  </DropdownMenuItem>
                )}
                {r.status === "confirmed" && (
                  <DropdownMenuItem onClick={() => handleStatusChange(r.id, "completed")}>
                    <UserCheck className="h-4 w-4 mr-2 text-emerald-700 dark:text-emerald-400" /> Tandai Selesai
                  </DropdownMenuItem>
                )}
                {r.status === "confirmed" && (
                  <DropdownMenuItem onClick={() => handleStatusChange(r.id, "no_show")}>
                    <CalendarX className="h-4 w-4 mr-2 text-muted-foreground" /> Tidak Hadir
                  </DropdownMenuItem>
                )}
                {["pending", "waitlist", "confirmed", "rescheduled"].includes(r.status) && (
                  <DropdownMenuItem onClick={() => setRescheduleTarget(r)}>
                    <CalendarClock className="h-4 w-4 mr-2 text-indigo-700 dark:text-indigo-400" /> Jadwal Ulang
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {["pending", "waitlist", "confirmed", "rescheduled"].includes(r.status) && (
                  <DropdownMenuItem className="text-destructive"
                    onClick={() => handleCancel(r)}>
                    <XCircle className="h-4 w-4 mr-2" /> Batalkan
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(r.id)}>
                  <Trash2 className="h-4 w-4 mr-2" /> Hapus Permanen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        />
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Total {total} reservasi</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="Halaman sebelumnya">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm tabular-nums">{page} / {totalPages}</span>
            <Button variant="outline" size="icon-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} aria-label="Halaman berikutnya">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Detail Dialog ── */}
      {selected && (
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between gap-3 pr-6">
                <span>Detail Reservasi</span>
                <span className="text-xs font-normal text-muted-foreground">#{selected.id?.slice(-8).toUpperCase()}</span>
              </DialogTitle>
            </DialogHeader>

            {/* Status + quick actions */}
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={selected.status} />
              {selected.status === "pending" && (
                <Button size="sm" onClick={() => handleStatusChange(selected.id, "confirmed")} disabled={statusLoading}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Konfirmasi
                </Button>
              )}
              {selected.status === "pending" && (
                <Button size="sm" variant="outline" className="text-teal-700 border-teal-300 dark:text-teal-300"
                  onClick={() => handleStatusChange(selected.id, "waitlist")} disabled={statusLoading}>
                  <ListOrdered className="h-3.5 w-3.5" /> Waitlist
                </Button>
              )}
              {(selected.status === "waitlist" || selected.status === "rescheduled") && (
                <Button size="sm" onClick={() => handleStatusChange(selected.id, "confirmed")} disabled={statusLoading}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Konfirmasi
                </Button>
              )}
              {selected.status === "confirmed" && (
                <>
                  <Button size="sm"
                    onClick={() => handleStatusChange(selected.id, "completed")} disabled={statusLoading}>
                    <UserCheck className="h-3.5 w-3.5" /> Selesai
                  </Button>
                  <Button size="sm" variant="outline"
                    onClick={() => handleStatusChange(selected.id, "no_show")} disabled={statusLoading}>
                    <CalendarX className="h-3.5 w-3.5" /> Tidak Hadir
                  </Button>
                </>
              )}
              {["pending", "waitlist", "confirmed", "rescheduled"].includes(selected.status) && (
                <Button size="sm" variant="outline" className="text-indigo-700 border-indigo-300 dark:text-indigo-300"
                  onClick={() => setRescheduleTarget(selected)} disabled={statusLoading}>
                  <CalendarClock className="h-3.5 w-3.5" /> Jadwal Ulang
                </Button>
              )}
              {["pending","waitlist","confirmed","rescheduled"].includes(selected.status) && (
                <Button size="sm" variant="destructive"
                  onClick={() => handleCancel(selected)} disabled={statusLoading}>
                  <XCircle className="h-3.5 w-3.5" /> Batalkan
                </Button>
              )}
            </div>

            <Separator />

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Nama Tamu</p><p className="font-medium">{selected.customer_name}</p></div>
              <div><p className="text-xs text-muted-foreground">No. HP</p><p className="font-medium">{selected.customer_phone}</p></div>
              <div><p className="text-xs text-muted-foreground">Tanggal</p><p className="font-medium">{selected.reservation_date}</p></div>
              <div><p className="text-xs text-muted-foreground">Waktu</p><p className="font-medium">{selected.reservation_time || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Jumlah Tamu</p><p className="font-medium">{selected.pax} orang</p></div>
              <div><p className="text-xs text-muted-foreground">Sumber Booking</p><p className="font-medium">{SOURCE_LABELS[selected.source] || selected.source}</p></div>
              {selected.outlet_name && <div className="col-span-2"><p className="text-xs text-muted-foreground">Outlet</p><p className="font-medium">{selected.outlet_name || scopedOutlets.find(o => o.id === selected.outlet_id)?.name || selected.outlet_id || "—"}</p></div>}
              {selected.area_preference && <div><p className="text-xs text-muted-foreground">Area</p><p className="font-medium">{selected.area_preference}</p></div>}
              {selected.table_preference && <div><p className="text-xs text-muted-foreground">Preferensi Meja</p><p className="font-medium">{selected.table_preference}</p></div>}
              {selected.customer_email && <div className="col-span-2"><p className="text-xs text-muted-foreground">Email</p><p className="font-medium">{selected.customer_email}</p></div>}
            </div>

            {selected.special_requests?.type && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">Permintaan Khusus: {selected.special_requests.type}</p>
                {selected.special_requests.notes && <p className="text-sm text-amber-800 dark:text-amber-200">{selected.special_requests.notes}</p>}
              </div>
            )}
            {selected.notes && (
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Catatan Staf</p>
                <p className="text-sm">{selected.notes}</p>
              </div>
            )}

            {/* Reschedule history */}
            {selected.reschedule_history?.length > 0 && (
              <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-3">
                <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-2 flex items-center gap-1">
                  <History className="h-3.5 w-3.5" /> Riwayat Penjadwalan Ulang ({selected.reschedule_history.length}x)
                </p>
                <div className="space-y-1">
                  {selected.reschedule_history.map((h, i) => (
                    <p key={i} className="text-xs text-indigo-700 dark:text-indigo-300">
                      {fmtDate(h.changed_at)}: <span className="line-through text-indigo-700 dark:text-indigo-400">{h.old_date} {h.old_time}</span> → {h.new_date} {h.new_time}
                      {h.reason && <span className="text-indigo-700 dark:text-indigo-400"> · {h.reason}</span>}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* DP Panel */}
            <DepositPanel reservation={selected} onUpdated={handleDetailUpdate} />

            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(selected.id)} data-testid="btn-delete-reservation">
                <Trash2 className="h-4 w-4" /> Hapus
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setDetailOpen(false)}>Tutup</Button>
                <Button variant="outline" onClick={() => navigate(`/outlet/reservations/${selected.id}/edit`)} data-testid="btn-edit-reservation">
                  <Edit2 className="h-4 w-4" /> Ubah
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}


      {/* ── Reschedule Dialog ── */}
      <RescheduleDialog
        reservation={rescheduleTarget}
        open={!!rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        onSuccess={updated => {
          handleDetailUpdate(updated);
          load();
        }}
      />
    </div>
  );
}
