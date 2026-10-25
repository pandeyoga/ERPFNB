/** PO Detail — view + multi-tier approve + send/cancel + create GR shortcut.
 *  Phase 9B: Added Download PDF + Email PO buttons. */
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Send, Ban, Truck, FileCheck, CheckCircle2, XCircle, ClipboardCheck,
  FileDown, Mail,
} from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/shared/PageHeader";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import StatusPill from "@/components/shared/StatusPill";
import ApprovalChain from "@/components/shared/ApprovalChain";
import ApprovalProgress from "@/components/shared/ApprovalProgress";
import LoadingState from "@/components/shared/LoadingState";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import { fmtRp, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { confirmDialog } from "@/components/shared/confirmDialog";

import { fetchAll } from "@/lib/api";

export default function PODetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [po, setPo] = useState(null);
  const [state, setState] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailForm, setEmailForm] = useState({ to: "", subject: "", message: "" });
  const [reason, setReason] = useState("");
  const [acting, setActing] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [poRes, v, o, st] = await Promise.all([
        api.get(`/procurement/pos/${id}`),
        fetchAll("/master/vendors"),
        fetchAll("/master/outlets"),
        api.get(`/procurement/pos/${id}/approval-state`).catch(() => null),
      ]);
      setVendors(unwrap(v) || []);
      setOutlets(unwrap(o) || []);
      setPo(unwrap(poRes) || null);
      setState(st ? unwrap(st) : null);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [id]); // eslint-disable-line

  async function send() {
    if (!(await confirmDialog("Kirim PO ke vendor?"))) return;
    try {
      setActing(true);
      await api.post(`/procurement/pos/${id}/send`);
      toast.success("PO dikirim"); load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal mengirim PO");
    } finally { setActing(false); }
  }
  async function cancel() {
    if (!reason.trim()) { toast.error("Alasan pembatalan wajib diisi"); return; }
    try {
      setActing(true);
      await api.post(`/procurement/pos/${id}/cancel`, { reason });
      toast.success("PO dibatalkan");
      setCancelOpen(false); setReason("");
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal membatalkan PO");
    } finally { setActing(false); }
  }
  async function submitForApproval() {
    if (!(await confirmDialog("Ajukan PO ini untuk approval?"))) return;
    try {
      setActing(true);
      await api.post(`/procurement/pos/${id}/submit`);
      toast.success("PO diajukan untuk approval"); load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal mengajukan PO");
    } finally { setActing(false); }
  }
  async function approve() {
    if (!(await confirmDialog("Setujui PO ini?"))) return;
    try {
      setActing(true);
      await api.post(`/procurement/pos/${id}/approve`, { note: "Approved" });
      toast.success("PO disetujui"); load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal menyetujui PO");
    } finally { setActing(false); }
  }
  async function rejectSubmit() {
    if (!reason.trim()) { toast.error("Alasan penolakan wajib diisi"); return; }
    try {
      setActing(true);
      await api.post(`/procurement/pos/${id}/reject`, { reason });
      toast.success("PO ditolak");
      setRejectOpen(false); setReason("");
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal menolak PO");
    } finally { setActing(false); }
  }

  async function downloadPdf() {
    setDownloadingPdf(true);
    try {
      const res = await fetch(`${API_BASE}/procurement/pos/${id}/pdf`, { credentials: "include" });
      if (!res.ok) throw new Error("PDF download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `PO-${po?.doc_no || id.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("PDF diunduh");
    } catch (e) {
      toast.error("Gagal mengunduh PDF");
    } finally { setDownloadingPdf(false); }
  }

  function openEmailDialog() {
    // Auto-fill from vendor + PO
    const vendorEmail = vendors.find(v => v.id === po.vendor_id)?.email || "";
    setEmailForm({
      to: vendorEmail,
      subject: `Purchase Order ${po.doc_no || id.slice(0, 8)}`,
      message:
        `Dear ${vendors.find(v => v.id === po.vendor_id)?.name || "Vendor"},\n\n` +
        `Mohon konfirmasi penerimaan Purchase Order berikut:\n\n` +
        `Nomor PO  : ${po.doc_no || id.slice(0, 8)}\n` +
        `Tanggal   : ${fmtDate(po.order_date)}\n` +
        `Total     : ${fmtRp(po.grand_total || 0)}\n\n` +
        `Detail terlampir dalam dokumen PDF.\n\nTerima kasih.`,
    });
    setEmailOpen(true);
  }

  async function sendEmail() {
    if (!emailForm.to.trim()) { toast.error("Email tujuan wajib"); return; }
    try {
      setActing(true);
      const toList = emailForm.to.split(",").map(s => s.trim()).filter(Boolean);
      await api.post(`/procurement/pos/${id}/email`, {
        to: toList,
        subject: emailForm.subject,
        message: emailForm.message,
      });
      toast.success(`PO dikirim ke ${toList.join(", ")} (mock)`);
      setEmailOpen(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal kirim email");
    } finally { setActing(false); }
  }

  if (loading) return <LoadingState rows={6} />;
  if (!po) return (
    <div className="glass-card" data-testid="po-detail-not-found">
      <EmptyState icon={FileCheck} title="PO tidak ditemukan" description="PO mungkin sudah dihapus atau Anda tidak punya akses."
        action={<Button asChild variant="outline"><Link to="/procurement/po"><ArrowLeft /> Kembali ke Purchase Orders</Link></Button>} />
    </div>
  );

  const vendorName = vendors.find(v => v.id === po.vendor_id)?.name || po.vendor_name || "—";
  const outletName = po.outlet_id ? (outlets.find(o => o.id === po.outlet_id)?.name || po.outlet_id) : "Central";
  const hasWf = !!state?.has_workflow;
  const wfNeedsApproval = hasWf && !state.is_complete && !state.is_rejected;

  let canApproveNow = false;
  if (wfNeedsApproval) {
    const required = state.steps?.[state.current_step_idx]?.any_of_perms || [];
    canApproveNow = required.some(p => can(p)) || can("*");
  }

  // PO must be in awaiting_approval to be approved
  const isAwaitingApproval = po.status === "awaiting_approval";
  // From draft → submit (move to awaiting_approval) only if workflow exists
  const canSubmitForApproval = hasWf && po.status === "draft" && can("procurement.po.create");
  const canSendDirectly = !hasWf && po.status === "draft" && can("procurement.po.send");
  // Send (after approval complete OR no workflow at all)
  const canSendApproved = can("procurement.po.send") && (
    po.status === "approved" || (!hasWf && po.status === "draft")
  );
  const canCancel = can("procurement.po.cancel") && ["draft", "awaiting_approval", "approved", "sent", "partial"].includes(po.status);
  const canReceive = can("procurement.gr.post") && ["sent", "partial"].includes(po.status);

  const docNo = po.doc_no || `PO ${po.id.slice(0, 8)}`;

  return (
    <div className="space-y-3 lg:space-y-4 max-w-5xl mx-auto" data-testid="po-detail-page">
      <div data-testid="po-detail-header">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2 mb-1" data-testid="po-detail-back">
          <ArrowLeft /> Kembali
        </Button>
        <PageHeader
          icon={FileCheck}
          title={<span data-testid="po-detail-doc-no">{docNo}</span>}
          subtitle={
            <span className="inline-flex items-center gap-2 flex-wrap">
              <StatusPill status={po.status} />
              <span>Purchase Order · {vendorName}</span>
            </span>
          }
          className="mb-0 md:mb-0"
          actions={
            <div className="flex items-center gap-2 flex-wrap" data-testid="po-detail-actions">
              <Button onClick={downloadPdf} variant="outline" disabled={downloadingPdf} data-testid="po-download-pdf">
                <FileDown /> {downloadingPdf ? "Mengunduh…" : "Unduh PDF"}
              </Button>
              {can("procurement.po.send") && (
                <Button onClick={openEmailDialog} variant="outline" disabled={acting} data-testid="po-email">
                  <Mail /> Email PO
                </Button>
              )}
              {canCancel && (
                <Button onClick={() => { setCancelOpen(true); setReason(""); }}
                  variant="outline" className="text-destructive hover:text-destructive" disabled={acting} data-testid="po-cancel">
                  <Ban /> Batalkan PO
                </Button>
              )}
              {wfNeedsApproval && isAwaitingApproval && canApproveNow && (
                <>
                  <Button onClick={() => { setRejectOpen(true); setReason(""); }}
                    variant="outline" disabled={acting} className="text-destructive hover:text-destructive" data-testid="po-reject">
                    <XCircle /> Tolak
                  </Button>
                  <Button onClick={approve} disabled={acting} data-testid="po-approve">
                    <CheckCircle2 /> Setujui
                  </Button>
                </>
              )}
              {canSubmitForApproval && (
                <Button onClick={submitForApproval} disabled={acting} data-testid="po-submit">
                  <ClipboardCheck /> Ajukan approval
                </Button>
              )}
              {(canSendApproved || canSendDirectly) && (
                <Button onClick={send} disabled={acting} data-testid="po-send">
                  <Send /> Kirim ke vendor
                </Button>
              )}
              {canReceive && (
                <Button asChild data-testid="po-receive">
                  <Link to={`/procurement/gr/new?po=${po.id}`}>
                    <Truck /> Terima barang (GR)
                  </Link>
                </Button>
              )}
            </div>
          }
        />
      </div>

      <div className="glass-card p-4 grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4 text-sm" data-testid="po-info-card">
        <Field label="Vendor" value={vendorName} testid="po-info-vendor" />
        <Field label="Kirim ke" value={outletName} testid="po-info-outlet" />
        <Field label="Tanggal order" value={fmtDate(po.order_date)} testid="po-info-order-date" />
        <Field label="Estimasi tiba" value={po.expected_delivery_date ? fmtDate(po.expected_delivery_date) : "—"} testid="po-info-expected" />
        <Field label="Termin pembayaran" value={`${po.payment_terms_days} hari`} testid="po-info-terms" />
        {po.sent_at && <Field label="Dikirim" value={fmtDate(po.sent_at)} testid="po-info-sent-at" />}
      </div>

      {hasWf && (
        <div className="glass-card p-4" data-testid="po-approval-progress-card">
          <h3 className="text-sm md:text-base font-semibold mb-3">Progres approval</h3>
          <ApprovalProgress state={state} />
          {wfNeedsApproval && ["draft", "awaiting_approval"].includes(po.status) && (
            <p className="text-xs text-muted-foreground mt-3" data-testid="po-approval-step-info">
              Tahap saat ini: <b>{state.steps[state.current_step_idx]?.label}</b>.
              {canApproveNow && isAwaitingApproval ? " Anda berwenang menyetujui di tahap ini." :
                isAwaitingApproval ? " Menunggu approver yang berwenang." :
                po.status === "draft" ? " PO masih draft. Klik 'Ajukan approval'." : ""}
            </p>
          )}
        </div>
      )}

      <div className="glass-card p-4" data-testid="po-lines-card">
        <h3 className="text-sm md:text-base font-semibold mb-3">Item</h3>
        <DataTable
          rows={(po.lines || []).map((ln, i) => ({ ...ln, _idx: i }))}
          keyField="_idx"
          stickyHeader={false}
          rowTestIdPrefix="po-line-row"
          empty={<EmptyState title="Tidak ada item" description="PO ini belum memiliki line item." />}
          columns={[
            { key: "item_name", label: "Item", primary: true, sortable: true,
              render: (ln) => <span className="font-medium">{ln.item_name}</span> },
            { key: "qty", label: "Qty", numeric: true },
            { key: "unit", label: "Unit", render: (ln) => <span className="text-muted-foreground">{ln.unit}</span> },
            { key: "unit_cost", label: "Harga satuan", numeric: true, render: (ln) => fmtRp(ln.unit_cost || 0) },
            { key: "total", label: "Total", numeric: true,
              render: (ln) => <span className="font-medium" data-testid={`po-line-total-${ln._idx}`}>{fmtRp(ln.total || 0)}</span> },
          ]}
        />
        <div className="mt-3 max-w-sm ml-auto space-y-1 text-sm" data-testid="po-totals">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums" data-testid="po-subtotal">{fmtRp(po.subtotal || 0)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Pajak</span><span className="tabular-nums" data-testid="po-tax">{fmtRp(po.tax_total || 0)}</span></div>
          <div className="flex justify-between pt-2 border-t border-border/50 text-base font-semibold"><span>Grand Total</span><span className="tabular-nums" data-testid="po-grand-total">{fmtRp(po.grand_total || 0)}</span></div>
        </div>
      </div>

      {po.cancelled_reason && (
        <div className="glass-card p-4 text-sm border-l-4 border-red-500" data-testid="po-cancelled-banner">
          <strong className="text-red-700 dark:text-red-400">Dibatalkan:</strong> {po.cancelled_reason}
        </div>
      )}
      {po.rejected_reason && (
        <div className="glass-card p-4 text-sm border-l-4 border-red-500" data-testid="po-rejected-banner">
          <strong className="text-red-700 dark:text-red-400">Ditolak:</strong> {po.rejected_reason}
        </div>
      )}

      {(po.approval_chain || []).length > 0 && (
        <div className="glass-card p-4" data-testid="po-timeline-card">
          <h3 className="text-sm md:text-base font-semibold mb-3">Riwayat approval</h3>
          <ApprovalChain chain={po.approval_chain || []} />
        </div>
      )}

      {(po.email_log || []).length > 0 && (
        <div className="glass-card p-4" data-testid="po-email-log">
          <h3 className="text-sm md:text-base font-semibold mb-3 inline-flex items-center gap-1.5">
            <Mail className="h-4 w-4" /> Riwayat email
          </h3>
          <div className="space-y-2">
            {(po.email_log || []).slice().reverse().map((log, i) => {
              const status = log.status || "unknown";
              const statusStyle = (
                status === "sent" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" :
                status === "failed" ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30" :
                status === "mocked" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" :
                status === "queued" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" :
                "bg-muted text-muted-foreground border-border/50"
              );
              return (
                <div key={i} className="rounded-lg border border-border/50 p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{log.subject}</div>
                    <span className="text-muted-foreground text-[11px]">{fmtDate(log.sent_at)}</span>
                  </div>
                  <div className="text-muted-foreground mt-1">
                    → {(log.to || []).join(", ")}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className={`text-[11px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded border ${statusStyle}`}>
                      {status}
                    </span>
                    {log.provider && (
                      <span className="text-[11px] text-muted-foreground">
                        via <span className="font-medium">{log.provider}</span>
                      </span>
                    )}
                    {log.pdf_attached && (
                      <span className="text-[11px] text-muted-foreground inline-flex items-center gap-0.5">
                        <FileDown className="h-3 w-3" /> PDF terlampir
                      </span>
                    )}
                    {log.provider_message_id && (
                      <span className="text-[11px] text-muted-foreground font-mono">
                        id: {String(log.provider_message_id).slice(0, 12)}…
                      </span>
                    )}
                  </div>
                  {log.error && (
                    <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 italic break-all">
                      Error: {log.error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {po.notes && (
        <div className="glass-card p-4" data-testid="po-notes-card">
          <h3 className="text-sm md:text-base font-semibold mb-1">Catatan</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{po.notes}</p>
        </div>
      )}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="glass-card max-w-md" data-testid="po-cancel-dialog">
          <DialogHeader>
            <DialogTitle>Batalkan PO?</DialogTitle>
            <DialogDescription>PO yang dibatalkan tidak bisa dikirim atau diterima lagi.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="po-cancel-reason" className="text-xs md:text-sm font-medium">Alasan pembatalan *</Label>
            <Textarea id="po-cancel-reason" value={reason} onChange={e => setReason(e.target.value)} className="glass-input min-h-[100px]" placeholder="Mis. vendor tidak bisa memenuhi pesanan…" data-testid="po-cancel-reason" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)} data-testid="po-cancel-close">Batal</Button>
            <Button variant="destructive" onClick={cancel} disabled={acting} data-testid="po-cancel-confirm">Batalkan PO</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="glass-card max-w-md" data-testid="po-reject-dialog">
          <DialogHeader>
            <DialogTitle>Tolak PO?</DialogTitle>
            <DialogDescription>Berikan alasan penolakan pada tahap approval ini.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="po-reject-reason" className="text-xs md:text-sm font-medium">Alasan penolakan *</Label>
            <Textarea id="po-reject-reason" value={reason} onChange={e => setReason(e.target.value)} className="glass-input min-h-[100px]" placeholder="Mis. harga di atas budget…" data-testid="po-reject-reason" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} data-testid="po-reject-close">Batal</Button>
            <Button variant="destructive" onClick={rejectSubmit} disabled={acting} data-testid="po-reject-confirm">Tolak PO</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Phase 9C - Email PO Dialog (real send via Resend) */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="glass-card max-w-lg" data-testid="po-email-dialog">
          <DialogHeader>
            <DialogTitle>Email Purchase Order</DialogTitle>
            <DialogDescription>
              Kirim PO ke vendor (PDF terlampir otomatis).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs md:text-sm font-medium" htmlFor="email-to">Kepada * (pisahkan dengan koma)</Label>
              <Input id="email-to" value={emailForm.to}
                onChange={e => setEmailForm(f => ({ ...f, to: e.target.value }))}
                className="glass-input mt-1" placeholder="vendor@example.com"
                data-testid="po-email-to" />
            </div>
            <div>
              <Label className="text-xs md:text-sm font-medium" htmlFor="email-subject">Subjek</Label>
              <Input id="email-subject" value={emailForm.subject}
                onChange={e => setEmailForm(f => ({ ...f, subject: e.target.value }))}
                className="glass-input mt-1"
                data-testid="po-email-subject" />
            </div>
            <div>
              <Label className="text-xs md:text-sm font-medium" htmlFor="email-message">Pesan</Label>
              <Textarea id="email-message" value={emailForm.message}
                onChange={e => setEmailForm(f => ({ ...f, message: e.target.value }))}
                className="glass-input mt-1 min-h-[160px]"
                data-testid="po-email-message" />
            </div>
            <p className="text-[11px] text-muted-foreground bg-emerald-500/10 border border-emerald-500/30 rounded-md p-2">
              <strong>Email aktif via Resend.</strong> PDF PO akan dilampirkan otomatis. Catatan: dalam mode sandbox, email hanya bisa dikirim ke alamat yang sudah diverifikasi di akun Resend (atau ke <code>delivered@resend.dev</code> sebagai test address).
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailOpen(false)} data-testid="po-email-cancel">Batal</Button>
            <Button onClick={sendEmail} disabled={acting} data-testid="po-email-send">
              <Mail /> Kirim email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value, testid }) {
  return (
    <div data-testid={testid}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium mt-0.5">{value}</div>
    </div>
  );
}
