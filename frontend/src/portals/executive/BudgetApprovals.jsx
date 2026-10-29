/** Budget Approvals — Executive Dashboard Widget v0.3.5 */
import { useState, useEffect } from "react";
import { Check, XCircle, Lock, Send, Target } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import api from "@/lib/api";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { logger } from "@/lib/logger";
import { confirmDialog, promptDialog } from "@/components/shared/confirmDialog";
import PageHeader from "@/components/shared/PageHeader";

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
            {l.category && <Badge variant="secondary" className="text-xs">{l.category}</Badge>}
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

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/budget/budgets", { params: { approval_status: "submitted" } });
      if (res.data.success) setBudgets(res.data.data?.items || []);
    } catch (err) {
      toast.error("Gagal memuat pengajuan budget");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (budgetId) => {
    if (!(await confirmDialog("Setujui budget ini?"))) return;
    try {
      await api.post(`/budget/budgets/${budgetId}/approve`);
      toast.success("Budget disetujui");
      load();
    } catch (err) {
      toast.error(err.response?.data?.errors?.[0]?.message || "Gagal menyetujui budget");
    }
  };

  // Alasan penolakan via promptDialog global (pengganti dialog lokal).
  const handleReject = async (budgetId) => {
    const reason = await promptDialog({
      title: "Tolak Budget",
      description: "Berikan alasan penolakan. Budget akan dikembalikan ke status Draft.",
      label: "Alasan penolakan",
      placeholder: "Jelaskan alasan penolakan…",
      multiline: true,
      destructive: true,
      confirmText: "Tolak Budget",
    });
    if (!reason) return;
    try {
      await api.post(`/budget/budgets/${budgetId}/reject`, { reason });
      toast.success("Budget ditolak");
      load();
    } catch (err) {
      toast.error(err.response?.data?.errors?.[0]?.message || "Gagal menolak budget");
    }
  };

  const handleLock = async (budgetId) => {
    if (!(await confirmDialog("Kunci budget ini? Budget yang terkunci tidak bisa diedit."))) return;
    try {
      await api.post(`/budget/budgets/${budgetId}/lock`);
      toast.success("Budget dikunci");
      load();
    } catch (err) {
      toast.error(err.response?.data?.errors?.[0]?.message || "Gagal mengunci budget");
    }
  };

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="budget-approvals">
      <PageHeader
        icon={Target}
        title="Budget Approvals"
        subtitle="Tinjau dan setujui budget yang diajukan oleh Finance"
        className="mb-0 md:mb-0"
      />

      <Card data-testid="budget-approval-list">
        <CardHeader>
          <CardTitle>Budget Menunggu Approval</CardTitle>
          <CardDescription>
            Budget berstatus "Submitted" yang memerlukan review Executive. Klik baris untuk melihat rincian.
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
              { key: "submitted_by", label: "Diajukan oleh", sortable: true, hideOnMobile: true, render: (b) => <span className="text-sm text-muted-foreground">{b.submitted_by || "-"}</span> },
              { key: "submitted_at", label: "Tgl diajukan", sortable: true, hideOnMobile: true, render: (b) => <span className="text-sm text-muted-foreground">{b.submitted_at ? new Date(b.submitted_at).toLocaleDateString("id-ID") : "-"}</span> },
            ]}
            rows={budgets}
            keyField="id"
            loading={loading}
            renderExpanded={(b) => <BudgetLines b={b} />}
            empty={
              <div data-testid="budget-approvals-empty">
                <EmptyState icon={Send} title="Tidak ada budget yang menunggu approval" description="Budget yang diajukan Finance akan muncul di sini." />
              </div>
            }
            rowAction={(b) => (
              <div className="flex items-center justify-end gap-1">
                <Button variant="outline" size="sm" className="text-rose-700 dark:text-rose-400 hover:text-rose-700" onClick={() => handleReject(b.id)} data-testid={`reject-btn-${b.id}`}>
                  <XCircle /> Tolak
                </Button>
                <Button size="sm" onClick={() => handleApprove(b.id)} data-testid={`approve-btn-${b.id}`}>
                  <Check /> Setujui
                </Button>
              </div>
            )}
            rowTestIdPrefix="approval-row"
          />
        </CardContent>
      </Card>

      {/* Approved budgets that can be locked */}
      <ApprovedBudgetsCard onLock={handleLock} />
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
        <CardDescription>Budget yang sudah disetujui dan dapat dikunci. Klik baris untuk melihat rincian.</CardDescription>
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
            { key: "approved_at", label: "Tgl disetujui", sortable: true, hideOnMobile: true, render: (b) => <span className="text-sm text-muted-foreground">{b.approved_at ? new Date(b.approved_at).toLocaleDateString("id-ID") : "-"}</span> },
          ]}
          rows={budgets}
          keyField="id"
          renderExpanded={(b) => <BudgetLines b={b} />}
          rowAction={(b) => (
            <Button variant="outline" size="sm" onClick={() => onLock(b.id)} data-testid={`lock-btn-${b.id}`} title="Kunci budget (tidak bisa diedit lagi)">
              <Lock /> Kunci
            </Button>
          )}
          rowTestIdPrefix="approved-row"
        />
      </CardContent>
    </Card>
  );
}
