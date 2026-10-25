/** PaymentRunDetail.jsx — Detail, confirm, post (execute), cancel. */
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, CheckCircle2, Play, X, AlertTriangle, FileText, Banknote, Layers, Receipt, User, StickyNote,
} from "lucide-react";
import { toast } from "sonner";

import api, { unwrap } from "@/lib/api";
import { fmtRp, fmtDate, fmtDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import LoadingState from "@/components/shared/LoadingState";
import DataTable from "@/components/shared/DataTable";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import StatusPill from "@/components/shared/StatusPill";
import EmptyState from "@/components/shared/EmptyState";

const BACK_PATH = "/finance/payments-hub?tab=payment-runs";

export default function PaymentRunDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPost, setShowPost] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await api.get(`/finance/payment-runs/${id}`);
      setRun(unwrap(res));
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal memuat Payment Run");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [id]);

  async function doAction(endpoint, body = {}) {
    setActing(true);
    try {
      const res = await api.post(`/finance/payment-runs/${id}/${endpoint}`, body);
      const updated = unwrap(res);
      setRun(updated);
      toast.success({ confirm: "Payment run dikonfirmasi", post: "Payment run dieksekusi & dijurnal", cancel: "Payment run dibatalkan" }[endpoint] || "Berhasil");
      setShowConfirm(false);
      setShowPost(false);
      setShowCancel(false);
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || `Gagal: ${endpoint}`);
    } finally { setActing(false); }
  }

  if (loading) return <LoadingState rows={6} />;
  if (!run) return (
    <div className="glass-card" data-testid="prn-not-found">
      <EmptyState icon={Layers} title="Payment run tidak ditemukan"
        description="Payment run mungkin sudah dihapus atau tautannya salah."
        action={<Button variant="outline" size="sm" onClick={() => navigate(BACK_PATH)} data-testid="prn-notfound-back">
          <ArrowLeft className="h-4 w-4" />Kembali ke Payment Runs</Button>} />
    </div>
  );

  const canConfirm = run.status === "draft";
  const canPost = run.status === "confirmed";
  const canCancel = ["draft", "confirmed"].includes(run.status);

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="payment-run-detail-page">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate(BACK_PATH)}
        data-testid="prn-back-btn">
        <ArrowLeft className="h-4 w-4" />Kembali ke Payment Runs
      </Button>
      <div data-testid="prn-detail-header">
        <PageHeader
          icon={Layers}
          title={<span data-testid="prn-doc-no">{run.doc_no}</span>}
          subtitle={<>Payment date: <strong>{fmtDate(run.payment_date)}</strong>{" · "}Bank: <strong>{run.bank_account_name || run.bank_account_id}</strong></>}
          actions={
            <div className="flex gap-2 flex-wrap" data-testid="prn-action-bar">
              {canCancel && (
                <Button onClick={() => setShowCancel(true)} variant="outline"
                  className="text-red-600 hover:text-red-700"
                  data-testid="prn-cancel-btn" disabled={acting}>
                  <X className="h-4 w-4" />Batalkan
                </Button>
              )}
              {canConfirm && (
                <Button onClick={() => setShowConfirm(true)}
                  data-testid="prn-confirm-btn" disabled={acting}>
                  <CheckCircle2 className="h-4 w-4" />Konfirmasi
                </Button>
              )}
              {canPost && (
                <Button onClick={() => setShowPost(true)}
                  data-testid="prn-post-btn" disabled={acting}>
                  <Play className="h-4 w-4" />Eksekusi (Post)
                </Button>
              )}
            </div>
          }
        >
          <span data-testid="prn-status-badge"><StatusPill status={run.status} /></span>
        </PageHeader>
      </div>

      {/* Posted banner */}
      {run.status === "posted" && (
        <div className="glass-card p-4 border-l-4 border-emerald-500 bg-emerald-500/5"
          data-testid="prn-posted-banner">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <div>
              <div className="font-semibold text-emerald-700 dark:text-emerald-400">Run berhasil dieksekusi</div>
              <div className="text-sm text-muted-foreground">
                {run.payments?.length || 0} payment di-posting pada {fmtDateTime(run.posted_at)}
                {run.je_ids && run.je_ids.length > 0 ? (
                  <span> · JE: {run.je_ids.map((jid, idx) => (
                    <Link key={jid} to={`/finance/journals/${jid}`}
                      className="text-primary hover:underline font-medium ml-1"
                      data-testid={`prn-je-link-${idx}`}>
                      {idx === 0 ? "Batch JE" : `WHT JE #${idx}`}
                    </Link>
                  ))}</span>
                ) : run.je_id && (
                  <> · JE: <Link to={`/finance/journals/${run.je_id}`} className="text-primary hover:underline font-medium" data-testid="prn-je-link">Lihat journal entry</Link></>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancelled banner */}
      {run.status === "cancelled" && (
        <div className="glass-card p-4 border-l-4 border-zinc-400 bg-zinc-500/5"
          data-testid="prn-cancelled-banner">
          <div className="flex items-center gap-3">
            <X className="h-5 w-5 text-zinc-500 flex-shrink-0" />
            <div>
              <div className="font-semibold text-zinc-600">Run dibatalkan</div>
              {run.cancel_reason && <div className="text-sm text-muted-foreground">Alasan: {run.cancel_reason}</div>}
              <div className="text-xs text-muted-foreground">
                oleh {run.cancelled_by_name || run.cancelled_by} · {fmtDateTime(run.cancelled_at)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="prn-summary-grid">
        <CompactStatCard label="Total gross" icon={Banknote} color="aurora-1" value={fmtRp(run.total_amount)} testId="prn-total-amount" />
        {run.total_wht > 0 ? (
          <>
            <CompactStatCard label="Total WHT (PPh)" icon={Receipt} color="aurora-5" tone="warning" value={fmtRp(run.total_wht)} testId="prn-total-wht" />
            <CompactStatCard label="Net ke bank" icon={Banknote} color="aurora-4" value={fmtRp(run.net_amount ?? (run.total_amount - (run.total_wht || 0)))} testId="prn-net-amount" />
          </>
        ) : (
          <CompactStatCard label="Jumlah payment" icon={Layers} color="aurora-2" value={`${run.payments?.length || run.pay_count || 0} PAY`} testId="prn-pay-count" />
        )}
        <CompactStatCard label="Dibuat oleh" icon={User} color="aurora-3" size="sm" value={run.created_by_name || "-"} testId="prn-created-by" />
        {run.total_wht > 0 && <CompactStatCard label="Jumlah payment" icon={Layers} color="aurora-2" value={`${run.payments?.length || run.pay_count || 0} PAY`} testId="prn-pay-count" />}
        {!run.total_wht && <CompactStatCard label="Catatan" icon={StickyNote} color="aurora-6" size="sm" value={run.notes || "—"} testId="prn-notes" />}
      </div>
      {/* WHT info banner */}
      {run.total_wht > 0 && (
        <div className="glass-card p-3 border-l-4 border-amber-400 bg-amber-500/5 text-sm"
          data-testid="prn-wht-banner">
          <div className="flex items-center gap-2">
            <span className="text-amber-600 font-semibold">PPh Withholding Tax</span>
            <span className="text-muted-foreground">—</span>
            <span>Run ini mengandung {(run.payments || []).filter(p => p.wh_type && parseFloat(p.wh_amount || 0) > 0).length} payment dengan WHT.
            JE terpisah telah dibuat per payment dan dicatat ke eBupot.</span>
          </div>
        </div>
      )}

      {/* Payment table */}
      <div className="glass-card overflow-hidden" data-testid="prn-payments-card">
        <div className="px-4 py-3 border-b border-border/40">
          <h3 className="text-sm md:text-base font-semibold flex items-center gap-2">
            <Banknote className="h-4 w-4" />
            Daftar Payment ({run.payments?.length || 0})
            <span className="ml-auto text-muted-foreground font-normal tabular-nums">
              Total: {fmtRp(run.total_amount)}
            </span>
          </h3>
        </div>
        {(!run.payments || run.payments.length === 0) ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Tidak ada payment dalam run ini.</div>
        ) : (
          <DataTable
            rows={run.payments}
            keyField="doc_no"
            rowTestIdPrefix="prn-pay-row"
            onRowClick={(p) => navigate(`/finance/payments/${p.id}`)}
            empty={<div className="p-8 text-center text-muted-foreground text-sm">Tidak ada payment dalam run ini.</div>}
            columns={[
              { key: "doc_no", label: "Doc No", primary: true, sortable: true,
                render: (p) => {
                  const hasWht = p.wh_type && parseFloat(p.wh_amount || 0) > 0;
                  return (
                    <span className="font-mono text-xs whitespace-nowrap">
                      {p.doc_no}
                      {hasWht && <span className="ml-1 px-1 rounded text-[11px] bg-amber-500/15 text-amber-700 dark:text-amber-400">WHT</span>}
                    </span>
                  );
                } },
              { key: "payee_name", label: "Payee", sortable: true,
                render: (p) => (
                  <div>
                    <div className="font-medium">{p.payee_name || "-"}</div>
                    <div className="text-[11px] text-muted-foreground uppercase">{p.payee_type}</div>
                  </div>
                ) },
              { key: "description", label: "Keterangan",
                render: (p) => <span className="max-w-[240px] truncate inline-block text-muted-foreground align-middle">{p.description}</span> },
              { key: "amount", label: "Gross", numeric: true, sortable: true,
                render: (p) => <span className="font-semibold">{fmtRp(p.amount)}</span> },
              { key: "wh_amount", label: "WHT", numeric: true, sortable: true,
                render: (p) => {
                  const hasWht = p.wh_type && parseFloat(p.wh_amount || 0) > 0;
                  return <span className="text-amber-700 dark:text-amber-400 text-xs">{hasWht ? fmtRp(p.wh_amount) : "—"}</span>;
                } },
              { key: "status", label: "Status",
                render: (p) => (
                  <span data-testid={`prn-pay-status-${p.doc_no}`}><StatusPill status={p.status} /></span>
                ) },
            ]}
          />
        )}
      </div>

      {/* Timeline / audit */}
      <div className="glass-card p-4" data-testid="prn-timeline">
        <h3 className="text-sm md:text-base font-semibold mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4" />Riwayat
        </h3>
        <ol className="space-y-3 text-sm">
          <TimelineItem
            when={run.created_at} who={run.created_by_name}
            action="Dibuat (Draft)" color="bg-slate-400" />
          {run.confirmed_at && (
            <TimelineItem
              when={run.confirmed_at} who={run.confirmed_by_name}
              action="Dikonfirmasi" color="bg-sky-400" />
          )}
          {run.posted_at && (
            <TimelineItem
              when={run.posted_at} who={run.posted_by_name}
              action={`Dieksekusi (Posted) — ${run.payments?.length || 0} payments`}
              color="bg-emerald-500" />
          )}
          {run.cancelled_at && (
            <TimelineItem
              when={run.cancelled_at} who={run.cancelled_by_name}
              action={`Dibatalkan${run.cancel_reason ? ` — ${run.cancel_reason}` : ""}`}
              color="bg-zinc-400" />
          )}
        </ol>
      </div>

      {/* Confirm dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent data-testid="prn-confirm-dialog">
          <DialogHeader>
            <DialogTitle>Konfirmasi Payment Run</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Setelah dikonfirmasi, run akan siap untuk dieksekusi (posted). Anda tidak dapat mengubah daftar payment setelah ini.
          </p>
          <div className="bg-muted/40 rounded-lg p-4 text-sm space-y-1">
            <div className="flex justify-between"><span>Jumlah payment:</span><strong>{run.payments?.length || 0}</strong></div>
            <div className="flex justify-between"><span>Total amount:</span><strong>{fmtRp(run.total_amount)}</strong></div>
            <div className="flex justify-between"><span>Bank account:</span><span>{run.bank_account_name}</span></div>
            <div className="flex justify-between"><span>Payment date:</span><span>{fmtDate(run.payment_date)}</span></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirm(false)} data-testid="prn-confirm-cancel">Batal</Button>
            <Button onClick={() => doAction("confirm")} disabled={acting}
              data-testid="prn-confirm-ok">
              {acting ? "Memproses..." : "Konfirmasi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Post/Execute dialog */}
      <Dialog open={showPost} onOpenChange={setShowPost}>
        <DialogContent data-testid="prn-post-dialog">
          <DialogHeader>
            <DialogTitle>Eksekusi Payment Run</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                Aksi ini akan <strong>memposting Journal Entry</strong> dan menandai semua {run.payments?.length || 0} payment sebagai <strong>Paid</strong>. Tindakan ini <strong>tidak dapat dibatalkan</strong>.
              </div>
            </div>
            <div className="bg-muted/40 rounded-lg p-4 text-sm space-y-1">
              <div className="flex justify-between"><span>Jumlah payment:</span><strong>{run.payments?.length || 0}</strong></div>
              <div className="flex justify-between"><span>Total amount:</span><strong>{fmtRp(run.total_amount)}</strong></div>
              <div className="flex justify-between"><span>Dari bank:</span><span>{run.bank_account_name}</span></div>
              <div className="flex justify-between"><span>Payment date:</span><span>{fmtDate(run.payment_date)}</span></div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPost(false)} data-testid="prn-post-cancel">Batal</Button>
            <Button onClick={() => doAction("post")} disabled={acting}
              data-testid="prn-post-ok">
              {acting ? "Memproses..." : "Eksekusi Sekarang"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel dialog */}
      <Dialog open={showCancel} onOpenChange={setShowCancel}>
        <DialogContent data-testid="prn-cancel-dialog">
          <DialogHeader>
            <DialogTitle>Batalkan Payment Run</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Payment run akan dibatalkan. Payments yang terpilih kembali ke status approved.</p>
            <div className="space-y-1.5">
              <Label htmlFor="prn-cancel-reason">Alasan pembatalan (opsional)</Label>
              <Input id="prn-cancel-reason" value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                placeholder="Alasan..." className="glass-input" data-testid="prn-cancel-reason" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCancel(false)} data-testid="prn-cancel-abort">Tutup</Button>
            <Button variant="destructive" onClick={() => doAction("cancel", { reason: cancelReason })}
              disabled={acting} data-testid="prn-cancel-ok">
              {acting ? "Membatalkan..." : "Batalkan Run"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TimelineItem({ when, who, action, color }) {
  return (
    <li className="flex items-start gap-3">
      <div className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${color}`} />
      <div>
        <span className="font-medium text-sm">{action}</span>
        {(when || who) && (
          <div className="text-xs text-muted-foreground">
            {fmtDateTime(when)}{who ? ` · ${who}` : ""}
          </div>
        )}
      </div>
    </li>
  );
}
