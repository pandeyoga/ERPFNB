/** PaymentRunDetail.jsx — Detail, confirm, post (execute), cancel. */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, CheckCircle2, Play, X, AlertTriangle, FileText, Banknote,
} from "lucide-react";
import { toast } from "sonner";

import api, { unwrap } from "@/lib/api";
import { fmtRp, fmtDate, fmtDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import LoadingState from "@/components/shared/LoadingState";
import DataTable from "@/components/shared/DataTable";

const STATUS_BADGE = {
  draft: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  confirmed: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  posted: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  cancelled: "bg-zinc-500/15 text-zinc-500 dark:text-zinc-400",
};

const STATUS_LABELS = {
  draft: "Draft",
  confirmed: "Confirmed",
  posted: "Posted",
  cancelled: "Cancelled",
};

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
      toast.success(`Aksi '${endpoint}' berhasil`);
      setShowConfirm(false);
      setShowPost(false);
      setShowCancel(false);
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || `Gagal: ${endpoint}`);
    } finally { setActing(false); }
  }

  if (loading) return <LoadingState rows={6} />;
  if (!run) return <div className="p-8 text-center text-muted-foreground">Payment Run tidak ditemukan.</div>;

  const canConfirm = run.status === "draft";
  const canPost = run.status === "confirmed";
  const canCancel = ["draft", "confirmed"].includes(run.status);

  return (
    <div className="space-y-5" data-testid="payment-run-detail-page">
      {/* Header */}
      <div className="flex items-start gap-3" data-testid="prn-detail-header">
        <Button variant="ghost" size="icon" onClick={() => navigate("/finance/payment-runs")}
          data-testid="prn-back-btn" aria-label="Kembali ke daftar payment run">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-bold font-mono" data-testid="prn-doc-no">{run.doc_no}</h2>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[run.status] || ""}`}
              data-testid="prn-status-badge">
              {STATUS_LABELS[run.status] || run.status}
            </span>
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            Payment date: <strong>{fmtDate(run.payment_date)}</strong>
            {" · "}Bank: <strong>{run.bank_account_name || run.bank_account_id}</strong>
          </div>
        </div>
        {/* Actions */}
        <div className="flex gap-2 flex-wrap" data-testid="prn-action-bar">
          {canConfirm && (
            <Button onClick={() => setShowConfirm(true)} variant="outline"
              className="gap-2" data-testid="prn-confirm-btn" disabled={acting}>
              <CheckCircle2 className="h-4 w-4" />Konfirmasi
            </Button>
          )}
          {canPost && (
            <Button onClick={() => setShowPost(true)}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              data-testid="prn-post-btn" disabled={acting}>
              <Play className="h-4 w-4" />Eksekusi (Post)
            </Button>
          )}
          {canCancel && (
            <Button onClick={() => setShowCancel(true)} variant="outline"
              className="gap-2 text-red-600 hover:text-red-700 hover:border-red-400"
              data-testid="prn-cancel-btn" disabled={acting}>
              <X className="h-4 w-4" />Batalkan
            </Button>
          )}
        </div>
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
                    <a key={jid} href={`/finance/journals/${jid}`}
                      className="text-primary hover:underline font-mono text-xs ml-1"
                      data-testid={`prn-je-link-${idx}`}>
                      {idx === 0 ? "Batch JE" : `WHT JE #${idx}`}
                    </a>
                  ))}</span>
                ) : run.je_id && (
                  <> · JE: <a href={`/finance/journals/${run.je_id}`} className="text-primary hover:underline font-mono text-xs" data-testid="prn-je-link">Lihat Journal Entry</a></>
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
        <SummaryCard label="Total Gross" value={fmtRp(run.total_amount)} tone="strong" testid="prn-total-amount" />
        {run.total_wht > 0 ? (
          <>
            <SummaryCard label="Total WHT (PPh)" value={fmtRp(run.total_wht)} tone="wht" testid="prn-total-wht" />
            <SummaryCard label="Net ke Bank" value={fmtRp(run.net_amount ?? (run.total_amount - (run.total_wht || 0)))} tone="strong" testid="prn-net-amount" />
          </>
        ) : (
          <SummaryCard label="Jumlah Payment" value={`${run.payments?.length || run.pay_count || 0} items`} testid="prn-pay-count" />
        )}
        <SummaryCard label="Dibuat oleh" value={run.created_by_name || "-"} testid="prn-created-by" />
        {run.total_wht > 0 && <SummaryCard label="Jumlah Payment" value={`${run.payments?.length || run.pay_count || 0} items`} testid="prn-pay-count" />}
        {!run.total_wht && <SummaryCard label="Catatan" value={run.notes || "—"} testid="prn-notes" />}
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
        <div className="px-5 py-3 border-b border-border/40">
          <h3 className="font-semibold text-sm flex items-center gap-2">
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
                    <span className="font-mono text-xs">
                      {p.doc_no}
                      {hasWht && <span className="ml-1 px-1 rounded text-[9px] bg-amber-500/15 text-amber-700">WHT</span>}
                    </span>
                  );
                } },
              { key: "payee_name", label: "Payee", sortable: true,
                render: (p) => (
                  <div>
                    <div className="font-medium">{p.payee_name || "-"}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">{p.payee_type}</div>
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
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium
                    ${p.status === "paid" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                      : p.status === "approved" ? "bg-sky-500/15 text-sky-700"
                      : "bg-muted text-muted-foreground"}`}
                    data-testid={`prn-pay-status-${p.doc_no}`}>
                    {p.status}
                  </span>
                ) },
            ]}
          />
        )}
      </div>

      {/* Timeline / audit */}
      <div className="glass-card p-5" data-testid="prn-timeline">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
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
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
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
              <Label>Alasan pembatalan (opsional)</Label>
              <Input value={cancelReason} onChange={e => setCancelReason(e.target.value)}
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

function SummaryCard({ label, value, tone = "normal", testid }) {
  return (
    <div className="glass-card p-4" data-testid={testid}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 font-semibold truncate ${
        tone === "strong" ? "text-lg tabular-nums"
        : tone === "wht" ? "text-amber-600 dark:text-amber-400 tabular-nums"
        : "text-sm"
      }`}>{value}</div>
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
