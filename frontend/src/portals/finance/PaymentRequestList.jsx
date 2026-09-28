/** Payment Request List — daftar PR dengan filters dan status tracking. */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Receipt, Plus, Filter, CheckCircle2, Clock, XCircle, DollarSign } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { InlineHelp } from "@/components/shared/InlineHelp";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import { fmtRp, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function PaymentRequestList() {
  const navigate = useNavigate();
  const [prs, setPrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: "",
    period_week: "",
    date_from: "",
    date_to: "",
  });

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/finance/payment-requests", { params: filters });
      setPrs(unwrap(res) || []);
    } catch (e) {
      toast.error("Gagal load Payment Requests");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [filters]);

  const stats = {
    draft: prs.filter(p => p.status === "draft").length,
    submitted: prs.filter(p => p.status === "submitted").length,
    approved: prs.filter(p => p.status === "approved").length,
    paid: prs.filter(p => p.status === "paid").length,
  };

  return (
    <div data-testid="payment-request-list-page" className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          Payment Request <InlineHelp id="payment-request-workflow" placement="bottom-start" />
        </h2>
        <Button
          onClick={() => navigate("/finance/payment-requests/new")}
          className="rounded-full gap-2"
          data-testid="pr-create"
        >
          <Plus className="h-4 w-4" /> Buat PR Baru
        </Button>
      </div>

      {/* Stats Cards */}
      <div data-testid="pr-stats-cards" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Draft" value={stats.draft} icon={Clock} accent="slate" />
        <StatCard label="Menunggu Approval" value={stats.submitted} icon={Clock} accent="amber" />
        <StatCard label="Approved" value={stats.approved} icon={CheckCircle2} accent="emerald" />
        <StatCard label="Paid" value={stats.paid} icon={DollarSign} accent="sky" />
      </div>

      {/* Filters */}
      <div data-testid="pr-filter-card" className="glass-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Filter</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-[11px] uppercase text-muted-foreground">Status</Label>
            <SimpleSelect
              value={filters.status}
              onValueChange={(v) => setFilters({ ...filters, status: v })}
              options={[
                { value: "", label: "-- Semua --" },
                { value: "draft", label: "Draft" },
                { value: "submitted", label: "Submitted" },
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Rejected" },
                { value: "paid", label: "Paid" },
              ]}
              placeholder="-- Semua --"
              className="glass-input rounded-lg w-full h-9 mt-1 text-sm"
              testId="pr-filter-status"
            />
          </div>
          <div>
            <Label className="text-[11px] uppercase text-muted-foreground inline-flex items-center gap-1.5">
              Period Week (YYYY-WW) <InlineHelp id="payment-request-period" size="xs" placement="top" />
            </Label>
            <Input
              type="text"
              placeholder="mis: 2026-20"
              value={filters.period_week}
              onChange={(e) => setFilters({ ...filters, period_week: e.target.value })}
              className="glass-input h-9 mt-1"
            />
          </div>
          <div>
            <Label className="text-[11px] uppercase text-muted-foreground">Dari Tanggal</Label>
            <Input
              type="date"
              value={filters.date_from}
              onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
              className="glass-input h-9 mt-1"
            />
          </div>
          <div>
            <Label className="text-[11px] uppercase text-muted-foreground">Sampai Tanggal</Label>
            <Input
              type="date"
              value={filters.date_to}
              onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
              className="glass-input h-9 mt-1"
            />
          </div>
        </div>
      </div>

      {/* List */}
      <div data-testid="pr-table-card" className="glass-card overflow-hidden">
        <DataTable
          columns={[
            { key: "doc_no", label: "PR No", primary: true, sortable: true,
              render: (pr) => <span className="font-mono font-medium">{pr.doc_no}</span> },
            { key: "request_date", label: "Tanggal", sortable: true,
              sortAccessor: (pr) => pr.request_date, render: (pr) => fmtDate(pr.request_date) },
            { key: "period_week", label: "Periode",
              render: (pr) => <span className="font-mono text-xs">{pr.period_week}</span> },
            { key: "item_count", label: "Item", numeric: true,
              sortAccessor: (pr) => pr.items?.length || 0, render: (pr) => pr.items?.length || 0 },
            { key: "total_amount", label: "Total Amount", numeric: true, sortable: true,
              render: (pr) => fmtRp(pr.total_amount) },
            { key: "requested_by", label: "Requested By",
              render: (pr) => <span className="text-xs">{pr.requested_by_name || pr.requested_by}</span> },
            { key: "status", label: "Status", render: (pr) => <StatusBadge status={pr.status} /> },
          ]}
          rows={prs}
          keyField="doc_no"
          loading={loading}
          rowTestIdPrefix="pr-row"
          defaultSort={{ key: "request_date", dir: "desc" }}
          renderExpanded={(pr) => <PrBreakdown pr={pr} />}
          rowAction={(pr) => (
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full"
              onClick={(e) => { e.stopPropagation(); navigate(`/finance/payment-requests/${pr.id}`); }}
              data-testid={`pr-detail-${pr.doc_no}`}
            >
              Detail
            </Button>
          )}
          empty={
            <EmptyState
              icon={Receipt}
              title="Belum ada Payment Request"
              description="Klik 'Buat PR Baru' untuk membuat payment request pertama."
            />
          }
        />
      </div>
    </div>
  );
}

function PrBreakdown({ pr }) {
  const items = pr.items || [];
  if (!items.length) {
    return <p className="text-sm text-muted-foreground" data-testid={`pr-breakdown-empty-${pr.doc_no}`}>Tidak ada rincian invoice.</p>;
  }
  return (
    <div className="space-y-2" data-testid={`pr-breakdown-${pr.doc_no}`}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
        Rincian Invoice ({items.length})
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 pr-3 font-medium">Vendor</th>
              <th className="py-1 pr-3 font-medium">No. Invoice</th>
              <th className="py-1 pr-3 font-medium">Jatuh Tempo</th>
              <th className="py-1 pr-3 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className="border-t border-border/30">
                <td className="py-1.5 pr-3 font-medium">{it.vendor_name || "—"}</td>
                <td className="py-1.5 pr-3 font-mono">{it.invoice_no || "—"}</td>
                <td className="py-1.5 pr-3">{it.due_date ? fmtDate(it.due_date) : "—"}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums font-semibold">{fmtRp(it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, accent }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-4 w-4 text-${accent}-700 dark:text-${accent}-400`} />
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
      <div className={`text-2xl font-bold tabular-nums text-${accent}-700 dark:text-${accent}-400`}>
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const config = {
    draft: { label: "Draft", color: "slate", Icon: Clock },
    submitted: { label: "Menunggu Approval", color: "amber", Icon: Clock },
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
