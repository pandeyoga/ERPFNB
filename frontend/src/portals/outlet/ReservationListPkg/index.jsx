/** ReservationList/index.jsx */
/**
 * Outlet Portal — Reservation Management
 * Statuses: pending, waitlist, confirmed, rescheduled, cancelled, completed, no_show
 * DP/Downpayment: amount, status, payment_method, dp_deadline, dp_reference, dp_paid_at
 */
import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { confirmDialog } from "@/components/shared/confirmDialog";

export default function ReservationList() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── Outlet Scope ──
  const { outletId, setOutletId, scopedOutlets, isFullAccess, currentOutlet, allowAllOption } = useOutletScopeCtx();

  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const PER_PAGE = 20;

  const [filters, setFilters] = useState({ status: "", search: "", date_from: "", date_to: "" });

  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // Dialogs
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
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
        setTotalPages(Math.ceil((meta?.total || 0) / PER_PAGE));
      }
    } catch { toast.error("Gagal memuat reservasi"); }
    finally { setLoading(false); }
  }, [page, filters, outletId]);

  useEffect(() => { load(); }, [load]);

  // Reset page when outlet scope changes
  useEffect(() => { setPage(1); }, [outletId]);

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
      setCancelOpen(false);
    }
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
  const pendingCount    = reservations.filter(r => r.status === "pending").length;
  const waitlistCount   = reservations.filter(r => r.status === "waitlist").length;
  const confirmedCount  = reservations.filter(r => r.status === "confirmed").length;
  const rescheduledCount = reservations.filter(r => r.status === "rescheduled").length;
  const todayCount      = reservations.filter(r => r.reservation_date === today).length;

  return (
    <div className="p-6 space-y-5" data-testid="reservation-list-page">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Manajemen Reservasi</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {outletId && currentOutlet
              ? `Outlet: ${currentOutlet.name}`
              : "Semua Outlet"}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {/* Outlet switcher — visible when user has access to multiple outlets */}
          {scopedOutlets.length > 1 && (
            <Select value={outletId || "all"} onValueChange={v => setOutletId(v === "all" ? "" : v)}>
              <SelectTrigger className="w-48" data-testid="outlet-scope-select">
                <SelectValue placeholder="Pilih Outlet..." />
              </SelectTrigger>
              <SelectContent>
                {allowAllOption && <SelectItem value="all">Semua Outlet</SelectItem>}
                {scopedOutlets.map(o => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={() => navigate("/outlet/reservations/new")} data-testid="btn-new-reservation">
            <Plus className="h-4 w-4 mr-2" /> Buat Reservasi
          </Button>
        </div>
      </div>

      {/* Status KPI strip */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5" data-testid="reservation-kpi-strip">
        {[
          { label: "Total", val: total, cls: "text-foreground" },
          { label: "Menunggu", val: pendingCount, cls: "text-amber-600" },
          { label: "Waitlist", val: waitlistCount, cls: "text-teal-600" },
          { label: "Dikonfirmasi", val: confirmedCount, cls: "text-blue-600" },
          { label: "Dijadwal Ulang", val: rescheduledCount, cls: "text-indigo-600" },
        ].map(s => (
          <div key={s.label} className="glass-card p-3 text-center">
            <p className={`text-xl font-bold tabular-nums ${s.cls}`}>{s.val}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="glass-card p-4" data-testid="reservation-filters">
        <div className="flex flex-wrap gap-2.5">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cari nama / nomor HP..." value={filters.search}
              onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1); }}
              className="pl-9" />
          </div>
          <Select value={filters.status || "all"} onValueChange={v => { setFilters(f => ({ ...f, status: v === "all" ? "" : v })); setPage(1); }}>
            <SelectTrigger className="w-44" data-testid="filter-status-select">
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
            className="w-36" placeholder="Dari" />
          <Input type="date" value={filters.date_to}
            onChange={e => { setFilters(f => ({ ...f, date_to: e.target.value })); setPage(1); }}
            className="w-36" placeholder="Sampai" />
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden" data-testid="reservation-table-wrap">
        <DataTable
          rows={reservations}
          keyField="id"
          loading={loading}
          loadingRows={6}
          rowTestIdPrefix="reservation-row"
          onRowClick={(r) => { setSelected(r); setDetailOpen(true); }}
          rowClassName={(r) => r.reservation_date === today ? "bg-blue-50/30" : ""}
          empty={(
            <div className="text-center py-16 text-muted-foreground">
              <CalendarCheck className="h-12 w-12 mx-auto mb-3 opacity-25" />
              <p>Belum ada reservasi</p>
              <Button className="mt-4" onClick={() => navigate("/outlet/reservations/new")}>
                <Plus className="h-4 w-4 mr-2" /> Buat Reservasi Baru
              </Button>
            </div>
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
                    <p className="text-[11px] text-indigo-500 mt-0.5">Dijadwal ulang {r.reschedule_history.length}x</p>
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
                    <p className={`text-[11px] ${DEPOSIT_CONFIG[r.deposit_status]?.color || "text-gray-500"}`}>
                      {DEPOSIT_CONFIG[r.deposit_status]?.label}
                    </p>
                    {dpPending && <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5" />}
                  </div>
                ) : <span className="text-xs text-muted-foreground">—</span>;
              } },
            { key: "status", label: "Status",
              render: (r) => <StatusBadge status={r.status} /> },
          ]}
          rowAction={(r) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Aksi lebih lanjut" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setSelected(r); setDetailOpen(true); }}>
                  <Eye className="h-4 w-4 mr-2" /> Detail
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {r.status === "pending" && (
                  <DropdownMenuItem onClick={() => handleStatusChange(r.id, "confirmed")}>
                    <CheckCircle2 className="h-4 w-4 mr-2 text-blue-600" /> Konfirmasi
                  </DropdownMenuItem>
                )}
                {r.status === "pending" && (
                  <DropdownMenuItem onClick={() => handleStatusChange(r.id, "waitlist")}>
                    <ListOrdered className="h-4 w-4 mr-2 text-teal-600" /> Pindah ke Waitlist
                  </DropdownMenuItem>
                )}
                {r.status === "waitlist" && (
                  <DropdownMenuItem onClick={() => handleStatusChange(r.id, "confirmed")}>
                    <CheckCircle2 className="h-4 w-4 mr-2 text-blue-600" /> Konfirmasi dari Waitlist
                  </DropdownMenuItem>
                )}
                {r.status === "rescheduled" && (
                  <DropdownMenuItem onClick={() => handleStatusChange(r.id, "confirmed")}>
                    <CheckCircle2 className="h-4 w-4 mr-2 text-blue-600" /> Konfirmasi Jadwal Baru
                  </DropdownMenuItem>
                )}
                {r.status === "confirmed" && (
                  <DropdownMenuItem onClick={() => handleStatusChange(r.id, "completed")}>
                    <UserCheck className="h-4 w-4 mr-2 text-emerald-600" /> Tandai Selesai
                  </DropdownMenuItem>
                )}
                {r.status === "confirmed" && (
                  <DropdownMenuItem onClick={() => handleStatusChange(r.id, "no_show")}>
                    <CalendarX className="h-4 w-4 mr-2 text-gray-500" /> Tidak Hadir
                  </DropdownMenuItem>
                )}
                {["pending", "waitlist", "confirmed", "rescheduled"].includes(r.status) && (
                  <DropdownMenuItem onClick={() => setRescheduleTarget(r)}>
                    <CalendarClock className="h-4 w-4 mr-2 text-indigo-600" /> Jadwal Ulang
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {["pending", "waitlist", "confirmed", "rescheduled"].includes(r.status) && (
                  <DropdownMenuItem className="text-destructive"
                    onClick={() => { setSelected(r); setCancelOpen(true); }}>
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
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Detail Dialog ── */}
      {selected && (
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Detail Reservasi</span>
                <span className="text-xs font-normal text-muted-foreground">#{selected.id?.slice(-8).toUpperCase()}</span>
              </DialogTitle>
            </DialogHeader>

            {/* Status + quick actions */}
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={selected.status} />
              {selected.status === "pending" && (
                <Button size="sm" className="h-7 text-xs" onClick={() => handleStatusChange(selected.id, "confirmed")} disabled={statusLoading}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Konfirmasi
                </Button>
              )}
              {selected.status === "pending" && (
                <Button size="sm" variant="outline" className="h-7 text-xs text-teal-700 border-teal-300"
                  onClick={() => handleStatusChange(selected.id, "waitlist")} disabled={statusLoading}>
                  <ListOrdered className="h-3.5 w-3.5 mr-1" /> Waitlist
                </Button>
              )}
              {(selected.status === "waitlist" || selected.status === "rescheduled") && (
                <Button size="sm" className="h-7 text-xs" onClick={() => handleStatusChange(selected.id, "confirmed")} disabled={statusLoading}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Konfirmasi
                </Button>
              )}
              {selected.status === "confirmed" && (
                <>
                  <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => handleStatusChange(selected.id, "completed")} disabled={statusLoading}>
                    <UserCheck className="h-3.5 w-3.5 mr-1" /> Selesai
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs"
                    onClick={() => handleStatusChange(selected.id, "no_show")} disabled={statusLoading}>
                    <CalendarX className="h-3.5 w-3.5 mr-1" /> Tidak Hadir
                  </Button>
                </>
              )}
              {["pending", "waitlist", "confirmed", "rescheduled"].includes(selected.status) && (
                <Button size="sm" variant="outline" className="h-7 text-xs text-indigo-700 border-indigo-300"
                  onClick={() => setRescheduleTarget(selected)} disabled={statusLoading}>
                  <CalendarClock className="h-3.5 w-3.5 mr-1" /> Jadwal Ulang
                </Button>
              )}
              {["pending","waitlist","confirmed","rescheduled"].includes(selected.status) && (
                <Button size="sm" variant="destructive" className="h-7 text-xs"
                  onClick={() => setCancelOpen(true)} disabled={statusLoading}>
                  <XCircle className="h-3.5 w-3.5 mr-1" /> Batalkan
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
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-amber-700 mb-1">Permintaan Khusus: {selected.special_requests.type}</p>
                {selected.special_requests.notes && <p className="text-sm text-amber-800">{selected.special_requests.notes}</p>}
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
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-indigo-700 mb-2 flex items-center gap-1">
                  <History className="h-3.5 w-3.5" /> Riwayat Penjadwalan Ulang ({selected.reschedule_history.length}x)
                </p>
                <div className="space-y-1">
                  {selected.reschedule_history.map((h, i) => (
                    <p key={i} className="text-xs text-indigo-600">
                      {fmtDate(h.changed_at)}: <span className="line-through text-indigo-400">{h.old_date} {h.old_time}</span> → {h.new_date} {h.new_time}
                      {h.reason && <span className="text-indigo-500"> · {h.reason}</span>}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* DP Panel */}
            <DepositPanel reservation={selected} onUpdated={handleDetailUpdate} />
          </DialogContent>
        </Dialog>
      )}

      {/* ── Cancel Dialog ── */}
      <Dialog open={cancelOpen} onOpenChange={v => { setCancelOpen(v); if (!v) setCancelReason(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Batalkan Reservasi</DialogTitle>
            <DialogDescription>Reservasi atas nama <strong>{selected?.customer_name}</strong> akan dibatalkan. DP yang sudah dibayar akan otomatis di-refund.</DialogDescription>
          </DialogHeader>
          <textarea rows={3} value={cancelReason} onChange={e => setCancelReason(e.target.value)}
            placeholder="Alasan pembatalan (opsional)..."
            className="w-full border rounded-lg px-3 py-2 text-sm resize-none bg-background" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Kembali</Button>
            <Button variant="destructive" disabled={statusLoading}
              onClick={() => handleStatusChange(selected?.id, "cancelled", cancelReason)}
              data-testid="btn-confirm-cancel">
              {statusLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ya, Batalkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
