/**
 * CMSWorkflow — Sprint I: Approval Workflow badge + actions
 * Reusable component that shows workflow status and allows submit/approve/reject.
 */
import { useState } from "react";
import { CheckCircle2, XCircle, Clock, Send, AlertCircle, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import api from "@/lib/api";

const STATUS_CONFIG = {
  draft:          { label: "Draft",          color: "bg-gray-100 text-gray-700 border-gray-200",    icon: AlertCircle },
  pending_review: { label: "Pending Review", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
  approved:       { label: "Approved",       color: "bg-blue-100 text-blue-700 border-blue-200",    icon: CheckCircle2 },
  rejected:       { label: "Rejected",       color: "bg-red-100 text-red-700 border-red-200",       icon: XCircle },
  published:      { label: "Published",      color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2 },
};

export function WorkflowBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

export default function CMSWorkflow({
  contentType,
  itemId,
  workflowStatus,
  onStatusChange,
  compact = false,
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const status = workflowStatus || "draft";

  const doSubmit = async () => {
    setLoading(true);
    try {
      const r = await api.post(`/admin/cms/${contentType}/${itemId}/submit-for-review`);
      toast.success("Berhasil dikirim untuk review");
      onStatusChange?.(r.data?.data?.workflow_status || "pending_review");
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal mengirim untuk review");
    } finally { setLoading(false); }
  };

  const doApprove = async () => {
    setLoading(true);
    try {
      const r = await api.post(`/admin/cms/${contentType}/${itemId}/approve`, { comment: comment || "Approved" });
      toast.success("Konten disetujui dan dipublish!");
      setApproveOpen(false);
      setComment("");
      onStatusChange?.("published");
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal menyetujui");
    } finally { setLoading(false); }
  };

  const doReject = async () => {
    if (!comment.trim()) { toast.error("Berikan alasan penolakan"); return; }
    setLoading(true);
    try {
      await api.post(`/admin/cms/${contentType}/${itemId}/reject`, { comment });
      toast.success("Konten ditolak");
      setRejectOpen(false);
      setComment("");
      onStatusChange?.("rejected");
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal menolak");
    } finally { setLoading(false); }
  };

  return (
    <div className={`flex items-center gap-2 ${compact ? "" : ""}`} data-testid={`cms-workflow-${contentType}-${itemId}`}>
      <WorkflowBadge status={status} />

      {!compact && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" data-testid={`cms-workflow-menu-${itemId}`}>
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(status === "draft" || status === "rejected") && (
              <DropdownMenuItem onClick={doSubmit} disabled={loading} data-testid={`cms-workflow-submit-${itemId}`}>
                <Send className="h-3.5 w-3.5 mr-2 text-amber-600" />
                Submit for Review
              </DropdownMenuItem>
            )}
            {status === "pending_review" && (
              <>
                <DropdownMenuItem onClick={() => { setComment(""); setApproveOpen(true); }} data-testid={`cms-workflow-approve-open-${itemId}`}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-green-600" />
                  Approve & Publish
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { setComment(""); setRejectOpen(true); }} className="text-red-600" data-testid={`cms-workflow-reject-open-${itemId}`}>
                  <XCircle className="h-3.5 w-3.5 mr-2" />
                  Reject
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {compact && status === "pending_review" && (
        <div className="flex gap-1">
          <Button size="sm" variant="outline" className="h-6 text-xs text-green-600 border-green-300 hover:bg-green-50"
                  onClick={() => { setComment(""); setApproveOpen(true); }} data-testid={`cms-workflow-approve-compact-${itemId}`}>
            <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
          </Button>
          <Button size="sm" variant="outline" className="h-6 text-xs text-red-600 border-red-300 hover:bg-red-50"
                  onClick={() => { setComment(""); setRejectOpen(true); }} data-testid={`cms-workflow-reject-compact-${itemId}`}>
            <XCircle className="h-3 w-3 mr-1" /> Reject
          </Button>
        </div>
      )}

      {compact && (status === "draft" || status === "rejected") && (
        <Button size="sm" variant="outline" className="h-6 text-xs text-amber-600 border-amber-300 hover:bg-amber-50"
                disabled={loading}
                onClick={doSubmit}
                data-testid={`cms-workflow-submit-compact-${itemId}`}>
          <Send className="h-3 w-3 mr-1" /> Submit
        </Button>
      )}

      {/* Approve Dialog */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="max-w-sm" data-testid="cms-workflow-approve-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" /> Setujui & Publish
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Konten akan disetujui dan langsung dipublish ke website publik.</p>
            <div className="space-y-1">
              <label className="text-sm font-medium">Catatan (opsional)</label>
              <Textarea rows={3} value={comment} onChange={e => setComment(e.target.value)}
                        placeholder="Tambahkan catatan approval..." data-testid="cms-workflow-approve-comment" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setApproveOpen(false)} data-testid="cms-workflow-approve-cancel">Batal</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={doApprove} disabled={loading} data-testid="cms-workflow-approve-confirm">
              <CheckCircle2 className="h-4 w-4 mr-2" /> Setujui & Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-sm" data-testid="cms-workflow-reject-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <XCircle className="h-5 w-5" /> Tolak Konten
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Berikan alasan penolakan agar editor dapat memperbaiki konten.</p>
            <div className="space-y-1">
              <label className="text-sm font-medium">Alasan Penolakan *</label>
              <Textarea rows={3} value={comment} onChange={e => setComment(e.target.value)}
                        placeholder="Jelaskan mengapa konten ini ditolak..." data-testid="cms-workflow-reject-comment" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)} data-testid="cms-workflow-reject-cancel">Batal</Button>
            <Button variant="destructive" onClick={doReject} disabled={loading} data-testid="cms-workflow-reject-confirm">
              <XCircle className="h-4 w-4 mr-2" /> Tolak
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
