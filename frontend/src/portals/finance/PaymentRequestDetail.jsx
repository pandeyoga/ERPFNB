/** Payment Request Detail — view PR, submit, approve, reject, mark paid. */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Send,
  CheckCircle2,
  XCircle,
  DollarSign,
  Clock,
  User,
  Calendar,
  FileText,
} from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import LoadingState from "@/components/shared/LoadingState";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import { fmtRp, fmtDate, fmtDateTime } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function PaymentRequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pr, setPr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get(`/finance/payment-requests/${id}`);
      setPr(unwrap(res));
    } catch (e) {
      toast.error("Gagal load Payment Request");
      navigate("/finance/payment-requests");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    setActionLoading(true);
    try {
      await api.post(`/finance/payment-requests/${id}/submit`);
      toast.success("PR berhasil di-submit untuk approval");
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal submit PR");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApprove() {
    setActionLoading(true);
    try {
      await api.post(`/finance/payment-requests/${id}/approve`);
      toast.success("PR berhasil di-approve");
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal approve PR");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      toast.error("Alasan reject wajib diisi");
      return;
    }

    setActionLoading(true);
    try {
      await api.post(`/finance/payment-requests/${id}/reject`, { reason: rejectReason });
      toast.success("PR berhasil di-reject");
      setShowRejectForm(false);
      setRejectReason("");
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal reject PR");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleMarkPaid() {
    setActionLoading(true);
    try {
      await api.post(`/finance/payment-requests/${id}/mark-paid`);
      toast.success("PR berhasil di-mark sebagai Paid");
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal mark paid");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading || !pr) {
    return <LoadingState rows={8} />;
  }

  const canSubmit = pr.status === "draft";
  const canApproveReject = pr.status === "submitted";
  const canMarkPaid = pr.status === "approved";

  return (
    <div className="space-y-5 max-w-5xl mx-auto" data-testid="pr-detail-page">
      <div className="flex items-center gap-3 flex-wrap" data-testid="pr-detail-header">
        <Button
          variant="outline"
          onClick={() => navigate("/finance/payment-requests")}
          className="rounded-full gap-2"
          data-testid="pr-detail-back"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>
        <h2 className="text-xl font-bold" data-testid="pr-detail-doc-no">Payment Request: {pr.doc_no}</h2>
        <div className="ml-auto" data-testid="pr-detail-status">
          <StatusBadge status={pr.status} />
        </div>
      </div>

      {/* Header Info */}
      <div className="glass-card p-5" data-testid="pr-detail-meta">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InfoItem icon={Calendar} label="Request Date" value={fmtDate(pr.request_date)} />
          <InfoItem icon={FileText} label="Period Week" value={pr.period_week} />
          <InfoItem icon={User} label="Requested By" value={pr.requested_by_name || pr.requested_by} />
        </div>
        {pr.notes && (
          <div className="mt-4 p-3 bg-foreground/5 rounded-lg" data-testid="pr-detail-notes">
            <div className="text-xs uppercase text-muted-foreground mb-1">Notes</div>
            <div className="text-sm">{pr.notes}</div>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="glass-card p-4" data-testid="pr-detail-stat-items">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Total Items</div>
          <div className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400 mt-1">
            {pr.items?.length || 0}
          </div>
        </div>
        <div className="glass-card p-4" data-testid="pr-detail-stat-total">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Total Amount</div>
          <div className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
            {fmtRp(pr.total_amount)}
          </div>
        </div>
        <div className="glass-card p-4" data-testid="pr-detail-stat-vendors">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Unique Vendors</div>
          <div className="text-2xl font-bold tabular-nums text-sky-700 dark:text-sky-400 mt-1">
            {new Set(pr.items?.map((i) => i.vendor_id)).size}
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="glass-card p-5">
        <h3 className="font-semibold mb-3">Invoice Items</h3>
        <DataTable
          rows={(pr.items || []).map((item, idx) => ({ ...item, _idx: idx }))}
          keyField="_idx"
          rowTestIdPrefix="pr-detail-item"
          empty={<div className="py-6"><EmptyState title="Belum ada item" description="Payment request ini belum memiliki invoice item." /></div>}
          columns={[
            { key: "vendor_name", label: "Vendor", primary: true, sortable: true,
              render: (item) => <span className="font-medium">{item.vendor_name}</span> },
            { key: "invoice_no", label: "Invoice No",
              render: (item) => <span className="font-mono text-xs">{item.invoice_no || "—"}</span> },
            { key: "invoice_date", label: "Invoice Date",
              render: (item) => fmtDate(item.invoice_date) },
            { key: "due_date", label: "Due Date",
              render: (item) => fmtDate(item.due_date) },
            { key: "amount", label: "Amount", numeric: true, sortable: true,
              render: (item) => <span className="font-semibold">{fmtRp(item.amount)}</span> },
            { key: "priority", label: "Priority",
              render: (item) => <PriorityBadge priority={item.priority} /> },
          ]}
          footer={
            <tr className="font-bold border-t-2 border-border/70" data-testid="pr-detail-total-row">
              <td colSpan={4} className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-right tabular-nums text-lg">{fmtRp(pr.total_amount)}</td>
              <td></td>
            </tr>
          }
        />
      </div>

      {/* Approval Chain */}
      {pr.approval_chain && pr.approval_chain.length > 0 && (
        <div className="glass-card p-5" data-testid="pr-detail-approval-chain">
          <h3 className="font-semibold mb-3">Approval History</h3>
          <div className="space-y-2">
            {pr.approval_chain.map((step, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-3 bg-foreground/5 rounded-lg"
                data-testid={`pr-detail-approval-step-${idx}`}
              >
                <ApprovalStatusIcon status={step.status} />
                <div className="flex-1">
                  <div className="font-medium">
                    {step.user_name} <span className="text-xs text-muted-foreground">({step.role})</span>
                  </div>
                  {step.action_at && (
                    <div className="text-xs text-muted-foreground">{fmtDateTime(step.action_at)}</div>
                  )}
                  {step.notes && <div className="text-sm mt-1">{step.notes}</div>}
                </div>
                <StatusBadge status={step.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="glass-card p-5" data-testid="pr-detail-actions-card">
        <h3 className="font-semibold mb-3">Actions</h3>
        <div className="flex flex-wrap gap-3">
          {canSubmit && (
            <Button
              onClick={handleSubmit}
              disabled={actionLoading}
              className="rounded-full gap-2"
              data-testid="pr-submit"
            >
              <Send className="h-4 w-4" /> {actionLoading ? "..." : "Submit untuk Approval"}
            </Button>
          )}

          {canApproveReject && !showRejectForm && (
            <>
              <Button
                onClick={handleApprove}
                disabled={actionLoading}
                className="rounded-full gap-2 bg-emerald-700 hover:bg-emerald-800"
                data-testid="pr-approve"
              >
                <CheckCircle2 className="h-4 w-4" /> {actionLoading ? "..." : "Approve"}
              </Button>
              <Button
                onClick={() => setShowRejectForm(true)}
                variant="destructive"
                className="rounded-full gap-2"
                data-testid="pr-reject-btn"
              >
                <XCircle className="h-4 w-4" /> Reject
              </Button>
            </>
          )}

          {canMarkPaid && (
            <Button
              onClick={handleMarkPaid}
              disabled={actionLoading}
              className="rounded-full gap-2 bg-sky-700 hover:bg-sky-800"
              data-testid="pr-mark-paid"
            >
              <DollarSign className="h-4 w-4" /> {actionLoading ? "..." : "Mark as Paid"}
            </Button>
          )}
        </div>

        {/* Reject Form */}
        {showRejectForm && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800" data-testid="pr-reject-form">
            <Label className="text-xs uppercase text-muted-foreground font-semibold">
              Alasan Reject (wajib)
            </Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="mis. Budget tidak mencukupi, invoice tidak lengkap, dll."
              className="glass-input mt-2 min-h-[80px]"
              data-testid="pr-reject-reason"
            />
            <div className="flex gap-2 mt-3">
              <Button
                onClick={handleReject}
                disabled={actionLoading || !rejectReason.trim()}
                variant="destructive"
                className="rounded-full gap-2"
                data-testid="pr-reject-confirm"
              >
                <XCircle className="h-4 w-4" /> {actionLoading ? "..." : "Confirm Reject"}
              </Button>
              <Button
                onClick={() => {
                  setShowRejectForm(false);
                  setRejectReason("");
                }}
                variant="outline"
                className="rounded-full"
                data-testid="pr-reject-cancel"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
      <div>
        <div className="text-xs uppercase text-muted-foreground">{label}</div>
        <div className="font-medium mt-0.5">{value}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const config = {
    draft: { label: "Draft", color: "slate", Icon: Clock },
    submitted: { label: "Submitted", color: "amber", Icon: Clock },
    pending: { label: "Pending", color: "amber", Icon: Clock },
    approved: { label: "Approved", color: "emerald", Icon: CheckCircle2 },
    rejected: { label: "Rejected", color: "red", Icon: XCircle },
    paid: { label: "Paid", color: "sky", Icon: DollarSign },
  };

  const c = config[status] || config.draft;
  const Icon = c.Icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        `bg-${c.color}-100 dark:bg-${c.color}-900/30 text-${c.color}-700 dark:text-${c.color}-400`
      )}
    >
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
}

function ApprovalStatusIcon({ status }) {
  if (status === "approved") {
    return <CheckCircle2 className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />;
  }
  if (status === "rejected") {
    return <XCircle className="h-5 w-5 text-red-700 dark:text-red-400" />;
  }
  return <Clock className="h-5 w-5 text-amber-700 dark:text-amber-400" />;
}

function PriorityBadge({ priority }) {
  if (priority === "urgent") {
    return (
      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
        URGENT
      </span>
    );
  }
  return (
    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
      Normal
    </span>
  );
}
