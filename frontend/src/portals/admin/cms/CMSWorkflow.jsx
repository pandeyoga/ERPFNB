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
  draft:          { label: "Draft",          color: "bg-muted/40 text-foreground border-border",    icon: AlertCircle },
  pending_review: { label: "Menunggu Review", color: "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30", icon: Clock },
  approved:       { label: "Disetujui",       color: "bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30",    icon: CheckCircle2 },
  rejected:       { label: "Ditolak",       color: "bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30",       icon: XCircle },
  published:      { label: "Published",      color: "bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30", icon: CheckCircle2 },
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
            <Button variant="ghost" size="icon-sm" data-testid={`cms-workflow-menu-${itemId}`}>
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(status === "draft" || status === "rejected") && (
              <DropdownMenuItem onClick={doSubmit} disabled={loading} data-testid={`cms-workflow-submit-${itemId}`}>
                <Send className="h-3.5 w-3.5 mr-2 text-amber-800 dark:text-amber-400" />
                Submit for Review
              </DropdownMenuItem>
            )}
            {status === "pending_review" && (
              <>
                <DropdownMenuItem onClick={() => { setComment(""); setApproveOpen(true); }} data-testid={`cms-workflow-approve-open-${itemId}`}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-green-700 dark:text-green-400" />
                  Approve & Publish
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { setComment(""); setRejectOpen(true); }} className="text-red-700 dark:text-red-400" data-testid={`cms-workflow-reject-open-${itemId}`}>
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
          <Button size="sm" variant="outline" className="text-emerald-700 dark:text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10"
                  onClick={() => { setComment(""); setApproveOpen(true); }} data-testid={`cms-workflow-approve-compact-${itemId}`}>
            <CheckCircle2 className="h-3 w-3" /> Approve
          </Button>
          <Button size="sm" variant="outline" className="text-red-700 dark:text-red-400 border-red-500/40 hover:bg-red-500/10"
                  onClick={() => { setComment(""); setRejectOpen(true); }} data-testid={`cms-workflow-reject-compact-${itemId}`}>
            <XCircle className="h-3 w-3" /> Reject
          </Button>
        </div>
      )}

      {compact && (status === "draft" || status === "rejected") && (
        <Button size="sm" variant="outline" className="text-amber-800 dark:text-amber-400 border-amber-500/40 hover:bg-amber-500/10"
                disabled={loading}
                onClick={doSubmit}
                data-testid={`cms-workflow-submit-compact-${itemId}`}>
          <Send className="h-3 w-3" /> Submit
        </Button>
      )}

      {/* Approve Dialog */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="max-w-sm" data-testid="cms-workflow-approve-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
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
            <Button variant="outline" onClick={() => setApproveOpen(false)} data-testid="cms-workflow-approve-cancel">Batal</Button>
            <Button variant="success" onClick={doApprove} disabled={loading} data-testid="cms-workflow-approve-confirm">
              <CheckCircle2 className="h-4 w-4" /> Setujui & Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-sm" data-testid="cms-workflow-reject-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
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
            <Button variant="outline" onClick={() => setRejectOpen(false)} data-testid="cms-workflow-reject-cancel">Batal</Button>
            <Button variant="destructive" onClick={doReject} disabled={loading} data-testid="cms-workflow-reject-confirm">
              <XCircle className="h-4 w-4" /> Tolak
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
