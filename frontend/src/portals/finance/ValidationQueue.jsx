/** Sales Validation Queue — Finance approves submitted DS → generates JE. */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardCheck, CheckCircle2, XCircle, Eye, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import PageHeader from "@/components/shared/PageHeader";
import SegmentedFilter from "@/components/shared/SegmentedFilter";
import StatusPill from "@/components/shared/StatusPill";
import { fmtRp, fmtDate, fmtRelative } from "@/lib/format";
import { toast } from "sonner";
import { confirmDialog } from "@/components/shared/confirmDialog";

export default function ValidationQueue() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  // Default = yang benar-benar menunggu; tanpa filter API mengembalikan juga yang sudah
  // divalidasi/ditolak (dulu tampil "303 menunggu" lengkap dengan tombol Validasi).
  const [status, setStatus] = useState("submitted");
  const [meta, setMeta] = useState({ total: 0, per_page: 50 });
  const [reject, setReject] = useState(null);
  const [reason, setReason] = useState("");
  const [actingId, setActingId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/finance/validation-queue", { params: { page, per_page: 50, status } });
      setItems(unwrap(res) || []);
      setMeta(res.data?.meta || {});
    } catch (e) {
      toast.error("Gagal memuat antrian validasi");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [page, status]); // eslint-disable-line react-hooks/exhaustive-deps

  async function validate(ds) {
    if (actingId) return; // RC-12/POS-03: one in-flight action at a time (no double-posting)
    if (!(await confirmDialog(`Validasi daily sales ${fmtDate(ds.sales_date)} di ${ds.outlet_name}? Jurnal akan dibuat.`))) return;
    setActingId(ds.id);
    try {
      await api.post(`/outlet/daily-sales/${ds.id}/validate`);
      toast.success("Daily sales tervalidasi. Jurnal dibuat.");
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal memvalidasi");
    } finally {
      setActingId(null);
    }
  }

  async function rejectSubmit() {
    if (!reason.trim()) { toast.error("Alasan wajib"); return; }
    if (actingId) return;
    setActingId(reject.id);
    try {
      await api.post(`/outlet/daily-sales/${reject.id}/reject`, { reason });
      toast.success("Daily sales ditolak. Outlet manager akan diberi tahu.");
      setReject(null); setReason("");
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal menolak");
    } finally {
      setActingId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.per_page || 50)));

  return (
    <div data-testid="validation-queue-page" className="space-y-3 lg:space-y-4">
      <div data-testid="vq-header-card">
        <PageHeader
          icon={ClipboardCheck}
          title="Sales Validation"
          subtitle="Daily sales yang sudah di-submit outlet. Validasi untuk membuat jurnal otomatis, atau tolak agar outlet memperbaiki."
          actions={status === "submitted" && (
            <span className="inline-flex items-center h-8 px-3 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 text-sm font-semibold tabular-nums" data-testid="vq-pending-count">
              {meta.total || 0} menunggu
            </span>
          )}
        />
      </div>

      <SegmentedFilter
        value={status}
        onChange={(v) => { setStatus(v); setPage(1); }}
        ariaLabel="Status validasi"
        testId="vq-status-filter"
        options={[
          { value: "submitted", label: "Menunggu validasi", testId: "vq-status-submitted" },
          { value: "validated", label: "Tervalidasi", testId: "vq-status-validated" },
          { value: "rejected", label: "Ditolak", testId: "vq-status-rejected" },
        ]}
      />

      <div data-testid="vq-table-card" className="glass-card overflow-hidden">
        <DataTable
          rows={items}
          keyField="id"
          loading={loading}
          rowTestIdPrefix="vq-row"
          empty={<div className="p-6"><EmptyState icon={ClipboardCheck}
            title={status === "submitted" ? "Inbox kosong" : "Belum ada data"}
            description={status === "submitted" ? "Tidak ada daily sales yang menunggu validasi." : "Tidak ada daily sales dengan status ini."} /></div>}
          columns={[
            { key: "sales_date", label: "Tanggal", sortable: true, primary: true,
              render: (ds) => <span className="font-medium">{fmtDate(ds.sales_date)}</span> },
            { key: "outlet_name", label: "Outlet", sortable: true },
            { key: "grand_total", label: "Grand Total", numeric: true, sortable: true,
              render: (ds) => <span className="font-semibold">{fmtRp(ds.grand_total || 0)}</span> },
            { key: "transaction_count", label: "Trx", numeric: true,
              render: (ds) => <span className="text-muted-foreground">{ds.transaction_count || 0}</span> },
            { key: "submitted_at", label: "Diajukan",
              render: (ds) => (
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />{ds.submitted_at ? fmtRelative(ds.submitted_at) : "—"}
                </span>
              ) },
          ]}
          rowAction={(ds) => ds.status !== "submitted" ? (
            <div className="inline-flex items-center gap-1.5">
              <StatusPill status={ds.status} />
              <Button asChild size="sm" variant="ghost">
                <Link to={`/outlet/daily-sales/${ds.id}`} data-testid={`fin-vq-view-${ds.id}`}>
                  <Eye className="h-3.5 w-3.5" /> Detail
                </Link>
              </Button>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5">
              <Button asChild size="sm" variant="ghost">
                <Link to={`/outlet/daily-sales/${ds.id}`} data-testid={`fin-vq-view-${ds.id}`}>
                  <Eye className="h-3.5 w-3.5" /> Detail
                </Link>
              </Button>
              <Button onClick={() => setReject(ds)} size="sm" variant="outline" className="text-red-600 hover:text-red-700" data-testid={`fin-vq-reject-${ds.id}`}>
                <XCircle className="h-3.5 w-3.5" /> Tolak
              </Button>
              <Button onClick={() => validate(ds)} disabled={!!actingId} size="sm" data-testid={`fin-vq-validate-${ds.id}`}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Validasi
              </Button>
            </div>
          )}
        />
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground" data-testid="vq-pagination">
            <span>Total: {meta.total}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="Halaman sebelumnya" data-testid="vq-page-prev">
                <ChevronLeft className="h-4 w-4" />Sebelumnya
              </Button>
              <span className="px-1 tabular-nums">{page}/{totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} aria-label="Halaman berikutnya" data-testid="vq-page-next">
                Berikutnya<ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!reject} onOpenChange={(o) => !o && setReject(null)}>
        <DialogContent data-testid="vq-reject-dialog" className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tolak daily sales?</DialogTitle>
            <DialogDescription>
              {reject ? `${fmtDate(reject.sales_date)} · ${reject.outlet_name} · ${fmtRp(reject.grand_total || 0)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="fin-vq-reject-reason">Alasan penolakan <span className="text-red-500">*</span></Label>
            <Textarea id="fin-vq-reject-reason" value={reason} onChange={e => setReason(e.target.value)} placeholder="Mis: total pembayaran tidak balance" className="glass-input min-h-[100px]" data-testid="fin-vq-reject-reason" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReject(null)} data-testid="fin-vq-reject-cancel">Batal</Button>
            <Button onClick={rejectSubmit} variant="destructive" disabled={!reason.trim() || !!actingId} data-testid="fin-vq-reject-confirm">Tolak</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
