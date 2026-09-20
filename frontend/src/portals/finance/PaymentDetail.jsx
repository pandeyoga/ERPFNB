/** Payment Request detail with approval chain + actions.
 *  Phase 3: PeriodLockBanner on the Mark Paid dialog blocks submit when payment_date period is locked.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Banknote, Check, X, CreditCard, ArrowLeft, ExternalLink } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import LoadingState from "@/components/shared/LoadingState";
import StatusPill from "@/components/shared/StatusPill";
import ApprovalChain from "@/components/shared/ApprovalChain";
import PeriodLockBanner from "@/components/shared/PeriodLockBanner";
import { fmtRp, fmtDate, fmtDateTime, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";

export default function PaymentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [payForm, setPayForm] = useState({ payment_date: todayJakartaISO(), payment_ref: "", bank_account_id: "" });
  const [banks, setBanks] = useState([]);
  const [payPeriodLocked, setPayPeriodLocked] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get(`/finance/payments/${id}`);
      setDoc(unwrap(res));
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal memuat PAY");
    } finally { setLoading(false); }
  }
  async function loadBanks() {
    try {
      const res = await api.get("/master/bank-accounts?page=1&per_page=50");
      setBanks(unwrap(res) || []);
    } catch {}
  }
  useEffect(() => { load(); loadBanks(); }, [id]);
  useEffect(() => { if (doc?.bank_account_id && !payForm.bank_account_id) setPayForm(f => ({ ...f, bank_account_id: doc.bank_account_id })); }, [doc]);

  async function doAction(action, body = {}) {
    setActing(true);
    try {
      await api.post(`/finance/payments/${id}/${action}`, body);
      toast.success(`Action ${action} berhasil`);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || `Gagal ${action}`);
    } finally { setActing(false); }
  }

  if (loading) return <LoadingState rows={6} />;
  if (!doc) return <div>Not found</div>;

  const st = doc.approval_state || {};
  const canSubmit = doc.status === "draft";
  const canApprove = doc.status === "awaiting_approval" || doc.status === "submitted";
  const canReject = canApprove;
  const canMarkPaid = doc.status === "approved";
  const canCancel = ["draft", "submitted", "awaiting_approval", "approved"].includes(doc.status);

  return (
    <div className="space-y-4" data-testid="payment-detail-page">
      <div className="flex items-center gap-3" data-testid="pay-detail-header">
        <Button variant="ghost" size="icon" aria-label="Kembali ke daftar pembayaran" onClick={() => navigate("/finance/payments")}
          data-testid="pay-back"><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Banknote className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold font-mono" data-testid="pay-doc-no">{doc.doc_no}</h2>
            <StatusPill status={doc.status} />
          </div>
          <div className="text-xs text-muted-foreground mt-0.5" data-testid="pay-meta">
            Requested {fmtDate(doc.request_date)} · {doc.payee_type} · {doc.payee_name || doc.payee_text || "-"}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card p-5 space-y-3" data-testid="pay-info-card">
            <Row label="Amount" value={<span className="text-2xl font-bold tabular-nums" data-testid="pay-amount-display">{fmtRp(doc.amount)}</span>} />
            <Row label="Description" value={doc.description} />
            <Row label="GL Debit" value={doc.gl_debit_code ? `${doc.gl_debit_code} · ${doc.gl_debit_name}` : doc.gl_debit_id} />
            <Row label="Bank Account" value={doc.bank_account_name || "-"} />
            {doc.invoice_no && <Row label="Invoice" value={`${doc.invoice_no} (${fmtDate(doc.invoice_date)})`} />}
            {doc.gr_id && <Row label="Linked GR" value={<a className="text-primary hover:underline" href={`/procurement/gr/${doc.gr_id}`} data-testid="pay-linked-gr">{doc.gr_id.slice(0, 8)} <ExternalLink className="h-3 w-3 inline" /></a>} />}
            {doc.payment_date && <Row label="Paid on" value={`${fmtDate(doc.payment_date)} · ref ${doc.payment_ref || '-'}`} />}
            {doc.journal_entry_id && <Row label="Journal Entry" value={<a className="text-primary hover:underline" href={`/finance/journals/${doc.journal_entry_id}`} data-testid="pay-linked-je">View JE <ExternalLink className="h-3 w-3 inline" /></a>} />}
            {doc.reconciled_at && <Row label="Reconciled" value={`✓ ${fmtDateTime(doc.reconciled_at)}`} />}
            {doc.notes && <Row label="Notes" value={doc.notes} />}
          </div>

          {doc.cancelled_at && (
            <div className="glass-card p-4 border-red-500/30 bg-red-500/5" data-testid="pay-cancelled-banner">
              <div className="text-sm font-semibold text-red-700 dark:text-red-400">Cancelled</div>
              <div className="text-xs mt-1">{doc.cancelled_reason}</div>
            </div>
          )}
          {doc.status === "rejected" && (
            <div className="glass-card p-4 border-red-500/30 bg-red-500/5" data-testid="pay-rejected-banner">
              <div className="text-sm font-semibold text-red-700 dark:text-red-400">Rejected</div>
              <div className="text-xs mt-1">{doc.rejected_reason}</div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="glass-card p-4" data-testid="pay-approval-card">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Approval chain</div>
            {st.has_workflow ? (
              <ApprovalChain steps={st.steps || []} executedSteps={st.executed_steps || []} currentStepIdx={st.current_step_idx} isRejected={st.is_rejected} isComplete={st.is_complete} />
            ) : (
              <div className="text-xs text-muted-foreground" data-testid="pay-no-workflow">No workflow configured for this tier — single-step.</div>
            )}
            {st.tier && (
              <div className="mt-3 text-[11px] text-muted-foreground" data-testid="pay-tier-info">
                Tier: <span className="font-semibold">{st.tier.label}</span>
              </div>
            )}
          </div>

          <div className="glass-card p-4 space-y-2" data-testid="pay-actions-card">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Actions</div>
            {canSubmit && <Button disabled={acting} onClick={() => doAction("submit")} className="w-full rounded-full" data-testid="pay-submit">Submit for Approval</Button>}
            {canApprove && <Button disabled={acting} onClick={() => doAction("approve", { note: "" })} className="w-full rounded-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2" data-testid="pay-approve"><Check className="h-4 w-4" /> Approve</Button>}
            {canReject && <Button disabled={acting} variant="outline" onClick={() => setShowReject(true)} className="w-full rounded-full gap-2 text-red-600 border-red-500/40 hover:bg-red-500/10" data-testid="pay-reject"><X className="h-4 w-4" /> Reject</Button>}
            {canMarkPaid && <Button disabled={acting} onClick={() => setShowPay(true)} className="w-full rounded-full bg-foreground text-background hover:bg-foreground/90 gap-2" data-testid="pay-markpaid"><CreditCard className="h-4 w-4" /> Mark Paid</Button>}
            {canCancel && <Button disabled={acting} variant="ghost" onClick={() => setShowCancel(true)} className="w-full rounded-full" data-testid="pay-cancel">Cancel PAY</Button>}
          </div>
        </div>
      </div>

      {/* Reject dialog */}
      <Dialog open={showReject} onOpenChange={setShowReject}>
        <DialogContent data-testid="pay-reject-dialog"><DialogHeader><DialogTitle>Reject PAY {doc.doc_no}</DialogTitle></DialogHeader>
          <div className="space-y-2"><Label>Alasan reject</Label>
            <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} data-testid="pay-reject-reason" />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowReject(false)} data-testid="pay-reject-cancel">Batal</Button>
            <Button disabled={!rejectReason.trim() || acting} onClick={async () => { await doAction("reject", { reason: rejectReason.trim() }); setShowReject(false); setRejectReason(""); }} className="bg-red-600 hover:bg-red-700 text-white" data-testid="pay-reject-confirm">Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark-paid dialog */}
      <Dialog open={showPay} onOpenChange={setShowPay}>
        <DialogContent data-testid="pay-markpaid-dialog"><DialogHeader><DialogTitle>Mark Paid — {doc.doc_no}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Payment Date</Label>
              <Input type="date" value={payForm.payment_date} onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))} className="mt-1" data-testid="pay-paydate" />
            </div>
            <PeriodLockBanner
              date={payForm.payment_date}
              action="mark Payment paid"
              onLockState={({ locked, closed }) => setPayPeriodLocked(locked || closed)}
            />
            <div><Label>Payment Reference (Ref bank, TF no, dll)</Label>
              <Input value={payForm.payment_ref} onChange={e => setPayForm(f => ({ ...f, payment_ref: e.target.value }))} placeholder="mis. TF-20260420-001" className="mt-1" data-testid="pay-payref" />
            </div>
            <div><Label>Bank Account (dari)</Label>
              <SimpleSelect value={payForm.bank_account_id} onValueChange={v => setPayForm(f => ({ ...f, bank_account_id: v }))} className="glass-input h-10 mt-1 w-full rounded-md px-3" testId="pay-paybank" placeholder="Pilih..."
                options={[{ value: "", label: "Pilih..." }, ...banks.map(b => ({ value: b.id, label: `${b.bank} ${b.account_number} — ${b.name}` }))]} />
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowPay(false)} data-testid="pay-paid-cancel">Batal</Button>
            <Button disabled={!payForm.payment_date || !payForm.bank_account_id || acting || payPeriodLocked} onClick={async () => { await doAction("mark-paid", payForm); setShowPay(false); }} data-testid="pay-paid-confirm">Mark Paid & Post Journal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel dialog */}
      <Dialog open={showCancel} onOpenChange={setShowCancel}>
        <DialogContent data-testid="pay-cancel-dialog"><DialogHeader><DialogTitle>Cancel PAY {doc.doc_no}</DialogTitle></DialogHeader>
          <div className="space-y-2"><Label>Alasan cancel</Label>
            <Textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3} data-testid="pay-cancel-reason" />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowCancel(false)} data-testid="pay-cancel-close">Tutup</Button>
            <Button disabled={!cancelReason.trim() || acting} onClick={async () => { await doAction("cancel", { reason: cancelReason.trim() }); setShowCancel(false); setCancelReason(""); }} className="bg-red-600 hover:bg-red-700 text-white" data-testid="pay-cancel-confirm">Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex gap-3 text-sm border-b border-border/30 pb-2 last:border-0">
      <div className="w-32 text-muted-foreground text-xs uppercase tracking-wide">{label}</div>
      <div className="flex-1">{value}</div>
    </div>
  );
}
