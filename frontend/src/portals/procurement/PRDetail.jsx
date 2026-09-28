/** PR Detail — view + multi-tier approve/reject + ApprovalChain + ApprovalProgress. */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, XCircle, ArrowRight, ShoppingCart } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

export default function PRDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [pr, setPr] = useState(null);
  const [state, setState] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reject, setReject] = useState(false);
  const [reason, setReason] = useState("");
  const [acting, setActing] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [prRes, o, st] = await Promise.all([
        api.get(`/procurement/prs/${id}`),
        api.get("/master/outlets", { params: { per_page: 100 } }),
        api.get(`/procurement/prs/${id}/approval-state`).catch(() => null),
      ]);
      setOutlets(unwrap(o) || []);
      setPr(unwrap(prRes) || null);
      setState(st ? unwrap(st) : null);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [id]); // eslint-disable-line

  async function approve() {
    if (!(await confirmDialog("Approve PR ini?"))) return;
    try {
      setActing(true);
      await api.post(`/procurement/prs/${id}/approve`, { note: "Approved" });
      toast.success("PR approved");
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal approve");
    } finally { setActing(false); }
  }
  async function rejectSubmit() {
    if (!reason.trim()) { toast.error("Alasan wajib"); return; }
    try {
      setActing(true);
      await api.post(`/procurement/prs/${id}/reject`, { reason });
      toast.success("PR rejected");
      setReject(false); setReason("");
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal reject");
    } finally { setActing(false); }
  }

  if (loading) return <LoadingState rows={6} />;
  if (!pr) return <div className="glass-card p-6 text-center">PR tidak ditemukan</div>;

  const outletName = outlets.find(o => o.id === pr.outlet_id)?.name || pr.outlet_id;
  const totalEst = (pr.lines || []).reduce(
    (s, ln) => s + Number(ln.qty || 0) * Number(ln.est_cost || 0), 0,
  );

  // Engine-aware eligibility:
  // - User can approve only if they hold ANY of current step's required perms (or *)
  // - If no workflow → fall back to legacy permission check (procurement.pr.approve)
  let canApproveNow = false;
  let canRejectNow = false;
  if (state?.has_workflow && !state.is_complete && !state.is_rejected) {
    const required = state.steps?.[state.current_step_idx]?.any_of_perms || [];
    canApproveNow = required.some(p => can(p)) || can("*");
    canRejectNow = canApproveNow; // same gate to reject at this step
  } else if (!state?.has_workflow) {
    canApproveNow = can("procurement.pr.approve") && pr.status === "submitted";
    canRejectNow = can("procurement.pr.reject") && pr.status === "submitted";
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto" data-testid="pr-detail-page">
      <div className="flex items-center gap-3 flex-wrap" data-testid="pr-detail-header">
        <Button variant="outline" onClick={() => navigate(-1)} className="rounded-full gap-2" data-testid="pr-detail-back">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>
        <h2 className="text-xl font-bold" data-testid="pr-detail-doc-no">PR {pr.doc_no || pr.id.slice(0, 8)}</h2>
        <StatusPill status={pr.status} />
        <div className="ml-auto flex items-center gap-2" data-testid="pr-detail-actions">
          {/* Convert to PO — visible only when approved and user has PO create permission */}
          {pr.status === "approved" && can("procurement.po.create") && (
            <Button
              onClick={() => navigate(`/procurement/pos/new?pr=${id}`)}
              className="rounded-full gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
              data-testid="pr-convert-to-po-btn"
            >
              <ShoppingCart className="h-4 w-4" />
              Buat PO dari PR
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
          {canRejectNow && (
            <Button onClick={() => setReject(true)} disabled={acting}
              variant="outline" className="rounded-full gap-2 text-red-600" data-testid="pr-reject">
              <XCircle className="h-4 w-4" /> Reject
            </Button>
          )}
          {canApproveNow && (
            <Button onClick={approve} disabled={acting}
              className="rounded-full pill-active gap-2" data-testid="pr-approve">
              <CheckCircle2 className="h-4 w-4" /> Approve
            </Button>
          )}
        </div>
      </div>

      <div className="glass-card p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm" data-testid="pr-info-card">
        <Field label="Outlet" value={outletName} testid="pr-info-outlet" />
        <Field label="Tanggal Request" value={fmtDate(pr.request_date)} testid="pr-info-date" />
        <Field label="Needed By" value={pr.needed_by ? fmtDate(pr.needed_by) : "—"} testid="pr-info-needed" />
        <Field label="Source" value={pr.source} testid="pr-info-source" />
      </div>

      {state?.has_workflow && (
        <div className="glass-card p-5" data-testid="pr-approval-progress-card">
          <h3 className="font-semibold mb-3">Approval Progress</h3>
          <ApprovalProgress state={state} />
          {state.is_complete === false && state.current_step_idx != null && (
            <p className="text-xs text-muted-foreground mt-3" data-testid="pr-approval-step-info">
              Tahap saat ini: <b>{state.steps[state.current_step_idx]?.label}</b>.
              {canApproveNow ? " Anda berwenang approve di tahap ini." : " Tunggu approver yang berwenang."}
            </p>
          )}
        </div>
      )}

      <div className="glass-card p-5" data-testid="pr-lines-card">
        <h3 className="font-semibold mb-3">Line Items</h3>
        <DataTable
          rows={(pr.lines || []).map((ln, i) => ({ ...ln, _idx: i }))}
          keyField="_idx"
          stickyHeader={false}
          rowTestIdPrefix="pr-line-row"
          empty={<EmptyState title="Tidak ada item" description="PR ini belum memiliki line item." />}
          columns={[
            { key: "item_name", label: "Item", primary: true, sortable: true,
              render: (ln) => <span className="font-medium">{ln.item_name}</span> },
            { key: "qty", label: "Qty", numeric: true },
            { key: "unit", label: "Unit", render: (ln) => <span className="text-muted-foreground">{ln.unit}</span> },
            { key: "est_cost", label: "Est. Cost", numeric: true, render: (ln) => fmtRp(ln.est_cost || 0) },
            { key: "subtotal", label: "Subtotal", numeric: true,
              render: (ln) => <span className="font-medium" data-testid={`pr-line-subtotal-${ln._idx}`}>{fmtRp(Number(ln.qty || 0) * Number(ln.est_cost || 0))}</span> },
            { key: "notes", label: "Notes", render: (ln) => <span className="text-xs text-muted-foreground">{ln.notes || "—"}</span> },
          ]}
          footer={
            <tr className="font-semibold" data-testid="pr-totals-row">
              <td colSpan={4} className="px-4 py-3 text-right">Total Estimasi</td>
              <td className="px-4 py-3 text-right tabular-nums" data-testid="pr-total-est">{fmtRp(totalEst)}</td>
              <td />
            </tr>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-card p-5" data-testid="pr-timeline-card">
          <h3 className="font-semibold mb-3">Approval Timeline</h3>
          <ApprovalChain chain={pr.approval_chain || []} />
        </div>
        <div className="glass-card p-5" data-testid="pr-notes-card">
          <h3 className="font-semibold mb-2">Catatan</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{pr.notes || "—"}</p>
          {pr.rejected_reason && (
            <div className="mt-3 text-sm border-l-4 border-red-500 pl-3" data-testid="pr-rejected-banner">
              <strong className="text-red-700 dark:text-red-400">Rejected:</strong> {pr.rejected_reason}
            </div>
          )}
          {pr.converted_to_po_ids?.length > 0 && (
            <div className="mt-3 text-sm" data-testid="pr-converted-pos">
              <strong>Converted to PO:</strong>
              <ul className="list-disc list-inside mt-1 text-xs text-muted-foreground">
                {pr.converted_to_po_ids.map(p => <li key={p}><code>{p.slice(0, 8)}</code></li>)}
              </ul>
            </div>
          )}
        </div>
      </div>

      <Dialog open={reject} onOpenChange={setReject}>
        <DialogContent className="glass-card max-w-md" data-testid="pr-reject-dialog">
          <DialogHeader>
            <DialogTitle>Reject PR?</DialogTitle>
            <DialogDescription>Berikan alasan agar requester dapat memperbaiki.</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} className="glass-input min-h-[100px]" placeholder="Alasan reject…" data-testid="pr-reject-reason" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReject(false)} data-testid="pr-reject-cancel">Batal</Button>
            <Button onClick={rejectSubmit} className="pill-active" data-testid="pr-reject-confirm">Reject</Button>
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
