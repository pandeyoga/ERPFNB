/** Budget Approvals — Executive Dashboard Widget v0.3.5 */
import { useState, useEffect } from "react";
import { Check, XCircle, Lock, Send, Target } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DataTable from "@/components/shared/DataTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import api from "@/lib/api";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { logger } from "@/lib/logger";
import { confirmDialog } from "@/components/shared/confirmDialog";

const totalBudgeted = (b) => (b.lines || []).reduce((s, l) => s + parseFloat(l.amount || 0), 0);

/** Drill-down: budget line items (COA + category + amount). */
function BudgetLines({ b }) {
  const lines = b.lines || [];
  if (!lines.length) {
    return (
      <div className="text-sm text-muted-foreground" data-testid={`budget-lines-empty-${b.id}`}>
        Tidak ada rincian budget.
      </div>
    );
  }
  return (
    <div className="space-y-1.5" data-testid={`budget-lines-${b.id}`}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
        Rincian Budget ({lines.length} baris)
      </div>
      {lines.map((l, i) => (
        <div key={i} className="flex items-center justify-between gap-3 text-sm border-b border-border/20 py-1">
          <div className="min-w-0 flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{l.coa_code}</span>
            <span className="truncate">{l.coa_name}</span>
            {l.category && <Badge variant="secondary" className="text-[10px]">{l.category}</Badge>}
          </div>
          <span className="tabular-nums font-medium shrink-0">{formatCurrency(l.amount)}</span>
        </div>
      ))}
      <div className="flex items-center justify-between gap-3 text-sm pt-1 font-semibold">
        <span>Total</span>
        <span className="tabular-nums">{formatCurrency(totalBudgeted(b))}</span>
      </div>
    </div>
  );
}

export default function BudgetApprovals() {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [rejectBudgetId, setRejectBudgetId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/budget/budgets", { params: { approval_status: "submitted" } });
      if (res.data.success) setBudgets(res.data.data?.items || []);
    } catch (err) {
      toast.error("Gagal memuat budget submissions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (budgetId) => {
    if (!(await confirmDialog("Approve budget ini?"))) return;
    try {
      await api.post(`/budget/budgets/${budgetId}/approve`);
      toast.success("Budget berhasil di-approve");
      load();
    } catch (err) {
      toast.error(err.response?.data?.errors?.[0]?.message || "Gagal approve budget");
    }
  };

  const openRejectDialog = (budgetId) => {
    setRejectBudgetId(budgetId);
    setRejectReason("");
    setRejectDialog(true);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error("Alasan penolakan wajib diisi");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/budget/budgets/${rejectBudgetId}/reject`, { reason: rejectReason });
      toast.success("Budget ditolak");
      setRejectDialog(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.errors?.[0]?.message || "Gagal reject budget");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLock = async (budgetId) => {
    if (!(await confirmDialog("Lock budget ini? Budget yang terkunci tidak bisa diedit."))) return;
    try {
      await api.post(`/budget/budgets/${budgetId}/lock`);
      toast.success("Budget berhasil di-lock");
      load();
    } catch (err) {
      toast.error(err.response?.data?.errors?.[0]?.message || "Gagal lock budget");
    }
  };

  return (
    <div className="space-y-6" data-testid="budget-approvals">
      <div>
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <Target className="h-6 w-6" /> Budget Approvals
        </h2>
        <p className="text-muted-foreground text-sm">Review dan approve budget yang disubmit oleh Finance</p>
      </div>

      <Card data-testid="budget-approval-list">
        <CardHeader>
          <CardTitle>Budget Menunggu Approval</CardTitle>
          <CardDescription>
            Daftar budget dengan status "Submitted" yang memerlukan review Executive. Klik baris untuk lihat rincian.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={[
              { key: "name", label: "Nama Budget", primary: true, sortable: true, render: (b) => (
                <div>
                  <div className="font-medium">{b.name}</div>
                  {b.outlet_name && <div className="text-xs text-muted-foreground">{b.outlet_name}</div>}
                  {b.brand_name && <div className="text-xs text-muted-foreground">{b.brand_name}</div>}
                </div>
              ) },
              { key: "period", label: "Periode", sortable: true, render: (b) => <Badge variant="outline">{b.period}</Badge> },
              { key: "scope", label: "Scope", sortable: true, render: (b) => <Badge variant="secondary">{b.scope}</Badge> },
              { key: "total", label: "Total", numeric: true, sortable: true, sortAccessor: (b) => totalBudgeted(b), render: (b) => formatCurrency(totalBudgeted(b)) },
              { key: "submitted_by", label: "Submitted By", sortable: true, hideOnMobile: true, render: (b) => <span className="text-sm text-muted-foreground">{b.submitted_by || "-"}</span> },
              { key: "submitted_at", label: "Submitted At", sortable: true, hideOnMobile: true, render: (b) => <span className="text-sm text-muted-foreground">{b.submitted_at ? new Date(b.submitted_at).toLocaleDateString("id-ID") : "-"}</span> },
            ]}
            rows={budgets}
            keyField="id"
            loading={loading}
            renderExpanded={(b) => <BudgetLines b={b} />}
            empty={
              <div className="text-center py-12 text-muted-foreground" data-testid="budget-approvals-empty">
                <Send className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p>Tidak ada budget yang menunggu approval</p>
              </div>
            }
            rowAction={(b) => (
              <div className="flex items-center justify-end gap-1">
                <Button variant="default" size="sm" onClick={() => handleApprove(b.id)} data-testid={`approve-btn-${b.id}`} title="Approve">
                  <Check className="h-4 w-4 mr-1" /> Approve
                </Button>
                <Button variant="destructive" size="sm" onClick={() => openRejectDialog(b.id)} data-testid={`reject-btn-${b.id}`} title="Reject">
                  <XCircle className="h-4 w-4 mr-1" /> Reject
                </Button>
              </div>
            )}
            rowTestIdPrefix="approval-row"
          />
        </CardContent>
      </Card>

      {/* Approved budgets that can be locked */}
      <ApprovedBudgetsCard onLock={handleLock} />

      {/* Reject Dialog */}
      <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
        <DialogContent data-testid="reject-dialog">
          <DialogHeader>
            <DialogTitle>Reject Budget</DialogTitle>
            <DialogDescription>
              Berikan alasan penolakan. Budget akan dikembalikan ke status Draft.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Alasan Penolakan *</Label>
              <Textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Jelaskan alasan penolakan..."
                rows={4}
                data-testid="reject-reason-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectDialog(false)}>Batal</Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={submitting || !rejectReason.trim()}
              data-testid="confirm-reject-btn"
            >
              {submitting ? "Menolak..." : "Reject Budget"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Approved Budgets that can be locked */
function ApprovedBudgetsCard({ onLock }) {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get("/budget/budgets", { params: { approval_status: "approved" } });
        if (res.data.success) setBudgets(res.data.data?.items || []);
      } catch (err) {
        logger.error("Failed to load approved budgets", { error: err.message });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return null;
  if (budgets.length === 0) return null;

  return (
    <Card data-testid="approved-budgets-card">
      <CardHeader>
        <CardTitle>Budget yang Sudah Disetujui</CardTitle>
        <CardDescription>Budget yang sudah di-approve dan dapat di-lock. Klik baris untuk lihat rincian.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <DataTable
          columns={[
            { key: "name", label: "Nama Budget", primary: true, sortable: true, render: (b) => (
              <div>
                <div className="font-medium">{b.name}</div>
                {b.outlet_name && <div className="text-xs text-muted-foreground">{b.outlet_name}</div>}
                {b.brand_name && <div className="text-xs text-muted-foreground">{b.brand_name}</div>}
              </div>
            ) },
            { key: "period", label: "Periode", sortable: true, render: (b) => <Badge variant="outline">{b.period}</Badge> },
            { key: "scope", label: "Scope", sortable: true, render: (b) => <Badge variant="secondary">{b.scope}</Badge> },
            { key: "total", label: "Total", numeric: true, sortable: true, sortAccessor: (b) => totalBudgeted(b), render: (b) => formatCurrency(totalBudgeted(b)) },
            { key: "approved_at", label: "Approved At", sortable: true, hideOnMobile: true, render: (b) => <span className="text-sm text-muted-foreground">{b.approved_at ? new Date(b.approved_at).toLocaleDateString("id-ID") : "-"}</span> },
          ]}
          rows={budgets}
          keyField="id"
          renderExpanded={(b) => <BudgetLines b={b} />}
          rowAction={(b) => (
            <Button variant="outline" size="sm" onClick={() => onLock(b.id)} data-testid={`lock-btn-${b.id}`} title="Lock budget (tidak bisa diedit)">
              <Lock className="h-4 w-4 mr-1" /> Lock
            </Button>
          )}
          rowTestIdPrefix="approved-row"
        />
      </CardContent>
    </Card>
  );
}
