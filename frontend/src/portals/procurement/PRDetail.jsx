/** PR Detail — view + multi-tier approve/reject + ApprovalChain + ApprovalProgress. */
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, XCircle, ArrowRight, ShoppingCart, FileText } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
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
        fetchAll("/master/outlets"),
        api.get(`/procurement/prs/${id}/approval-state`).catch(() => null),
      ]);
      setOutlets(unwrap(o) || []);
      setPr(unwrap(prRes) || null);
      setState(st ? unwrap(st) : null);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [id]); // eslint-disable-line

  async function approve() {
    if (!(await confirmDialog("Setujui PR ini?"))) return;
    try {
      setActing(true);
      await api.post(`/procurement/prs/${id}/approve`, { note: "Approved" });
      toast.success("PR disetujui");
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal menyetujui PR");
    } finally { setActing(false); }
  }
  async function rejectSubmit() {
    if (!reason.trim()) { toast.error("Alasan penolakan wajib diisi"); return; }
    try {
      setActing(true);
      await api.post(`/procurement/prs/${id}/reject`, { reason });
      toast.success("PR ditolak");
      setReject(false); setReason("");
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal menolak PR");
    } finally { setActing(false); }
  }

  if (loading) return <LoadingState rows={6} />;
  if (!pr) return (
    <div className="glass-card" data-testid="pr-detail-not-found">
      <EmptyState icon={FileText} title="PR tidak ditemukan" description="PR mungkin sudah dihapus atau Anda tidak punya akses."
        action={<Button asChild variant="outline"><Link to="/procurement/pr"><ArrowLeft /> Kembali ke Purchase Requests</Link></Button>} />
    </div>
  );

  const outletName = outlets.find(o => o.id === pr.outlet_id)?.name || pr.outlet_name || "—";
  // Approve/Reject hanya relevan selama PR masih menunggu approval
  const isPending = ["submitted", "awaiting_approval"].includes(pr.status);
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
    canApproveNow = isPending && (required.some(p => can(p)) || can("*"));
    canRejectNow = canApproveNow; // same gate to reject at this step
  } else if (!state?.has_workflow) {
    canApproveNow = can("procurement.pr.approve") && pr.status === "submitted";
    canRejectNow = can("procurement.pr.reject") && pr.status === "submitted";
  }

  const docNo = pr.doc_no || `PR ${pr.id.slice(0, 8)}`;

  return (
    <div className="space-y-3 lg:space-y-4 max-w-5xl mx-auto" data-testid="pr-detail-page">
      <div data-testid="pr-detail-header">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2 mb-1" data-testid="pr-detail-back">
          <ArrowLeft /> Kembali
        </Button>
        <PageHeader
          icon={FileText}
          title={<span data-testid="pr-detail-doc-no">{docNo}</span>}
          subtitle={
            <span className="inline-flex items-center gap-2 flex-wrap">
              <StatusPill status={pr.status} />
              <span>Purchase Request · {outletName}</span>
            </span>
          }
          className="mb-0 md:mb-0"
          actions={
            <div className="flex items-center gap-2 flex-wrap" data-testid="pr-detail-actions">
              {/* Convert to PO — visible only when approved and user has PO create permission */}
              {pr.status === "approved" && can("procurement.po.create") && (
                <Button onClick={() => navigate(`/procurement/po/new?pr=${id}`)} data-testid="pr-convert-to-po-btn">
                  <ShoppingCart /> Buat PO dari PR <ArrowRight />
                </Button>
              )}
              {canRejectNow && (
                <Button onClick={() => setReject(true)} disabled={acting}
                  variant="outline" className="text-destructive hover:text-destructive" data-testid="pr-reject">
                  <XCircle /> Tolak
                </Button>
              )}
              {canApproveNow && (
                <Button onClick={approve} disabled={acting} data-testid="pr-approve">
                  <CheckCircle2 /> Setujui
                </Button>
              )}
            </div>
          }
        />
      </div>

      <div className="glass-card p-4 grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4 text-sm" data-testid="pr-info-card">
        <Field label="Outlet" value={outletName} testid="pr-info-outlet" />
        <Field label="Tanggal request" value={fmtDate(pr.request_date)} testid="pr-info-date" />
        <Field label="Dibutuhkan" value={pr.needed_by ? fmtDate(pr.needed_by) : "—"} testid="pr-info-needed" />
        <Field label="Source" value={pr.source || "—"} testid="pr-info-source" />
      </div>

      {state?.has_workflow && (
        <div className="glass-card p-4" data-testid="pr-approval-progress-card">
          <h3 className="text-sm md:text-base font-semibold mb-3">Progres approval</h3>
          <ApprovalProgress state={state} />
          {isPending && state.is_complete === false && state.current_step_idx != null && (
            <p className="text-xs text-muted-foreground mt-3" data-testid="pr-approval-step-info">
              Tahap saat ini: <b>{state.steps[state.current_step_idx]?.label}</b>.
              {canApproveNow ? " Anda berwenang menyetujui di tahap ini." : " Menunggu approver yang berwenang."}
            </p>
          )}
        </div>
      )}

      <div className="glass-card p-4" data-testid="pr-lines-card">
        <h3 className="text-sm md:text-base font-semibold mb-3">Item</h3>
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
            { key: "est_cost", label: "Est. harga", numeric: true, render: (ln) => fmtRp(ln.est_cost || 0) },
            { key: "subtotal", label: "Subtotal", numeric: true,
              render: (ln) => <span className="font-medium" data-testid={`pr-line-subtotal-${ln._idx}`}>{fmtRp(Number(ln.qty || 0) * Number(ln.est_cost || 0))}</span> },
            { key: "notes", label: "Catatan", render: (ln) => <span className="text-xs text-muted-foreground">{ln.notes || "—"}</span> },
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
        <div className="glass-card p-4" data-testid="pr-timeline-card">
          <h3 className="text-sm md:text-base font-semibold mb-3">Riwayat approval</h3>
          <ApprovalChain chain={pr.approval_chain || []} />
        </div>
        <div className="glass-card p-4" data-testid="pr-notes-card">
          <h3 className="text-sm md:text-base font-semibold mb-2">Catatan</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{pr.notes || "—"}</p>
          {pr.rejected_reason && (
            <div className="mt-3 text-sm border-l-4 border-red-500 pl-3" data-testid="pr-rejected-banner">
              <strong className="text-red-700 dark:text-red-400">Ditolak:</strong> {pr.rejected_reason}
            </div>
          )}
          {pr.converted_to_po_ids?.length > 0 && (
            <div className="mt-3 text-sm" data-testid="pr-converted-pos">
              <strong>Sudah dibuatkan PO:</strong>
              <ul className="mt-1 space-y-0.5 text-xs">
                {pr.converted_to_po_ids.map(p => (
                  <li key={p}>
                    <Link to={`/procurement/po/${p}`} className="text-primary hover:underline" data-testid={`pr-converted-po-link-${p}`}>
                      Lihat PO {p.slice(0, 8)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <Dialog open={reject} onOpenChange={setReject}>
        <DialogContent className="glass-card max-w-md" data-testid="pr-reject-dialog">
          <DialogHeader>
            <DialogTitle>Tolak PR?</DialogTitle>
            <DialogDescription>Berikan alasan agar requester dapat memperbaiki.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="pr-reject-reason" className="text-xs md:text-sm font-medium">Alasan penolakan *</Label>
            <Textarea id="pr-reject-reason" value={reason} onChange={e => setReason(e.target.value)} className="glass-input min-h-[100px]" placeholder="Mis. qty terlalu besar, item sudah ada stok…" data-testid="pr-reject-reason" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReject(false)} data-testid="pr-reject-cancel">Batal</Button>
            <Button variant="destructive" onClick={rejectSubmit} disabled={acting} data-testid="pr-reject-confirm">Tolak PR</Button>
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
