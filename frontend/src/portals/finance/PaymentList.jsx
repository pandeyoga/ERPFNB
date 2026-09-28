/** Payment Request (PAY) list page. */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Banknote, Plus, Search } from "lucide-react";
import api, { unwrapWithMeta } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import EmptyState from "@/components/shared/EmptyState";
import StatusPill from "@/components/shared/StatusPill";
import DataTable from "@/components/shared/DataTable";
import { fmtRp, fmtDate } from "@/lib/format";
import { toast } from "sonner";

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "awaiting_approval", label: "Awaiting" },
  { key: "submitted", label: "Submitted" },
  { key: "approved", label: "Approved" },
  { key: "paid", label: "Paid" },
  { key: "rejected", label: "Rejected" },
  { key: "cancelled", label: "Cancelled" },
];

export default function PaymentList() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, per_page: 20, total: 0 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [kpi, setKpi] = useState(null);
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    try {
      const params = { page: 1, per_page: 50 };
      if (status !== "all") params.status = status;
      if (search.trim()) params.search = search.trim();
      const res = await api.get("/finance/payments", { params });
      const { data, meta } = unwrapWithMeta(res);
      setItems(data || []);
      setMeta(meta || { page: 1, per_page: 50, total: 0 });
    } catch (e) {
      toast.error("Gagal memuat daftar PAY");
    } finally { setLoading(false); }
  }

  async function loadKpi() {
    try {
      const res = await api.get("/finance/payments/kpi");
      setKpi(res.data.data);
    } catch {}
  }

  useEffect(() => { load(); }, [status]);
  useEffect(() => { loadKpi(); }, []);
  useEffect(() => {
    const t = setTimeout(() => load(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [search]);

  return (
    <div className="space-y-4" data-testid="payment-list-page">
      {kpi && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="pay-kpi-strip">
          <KpiTile label="Draft" value={kpi.draft} tone="neutral" testid="pay-kpi-draft" />
          <KpiTile label="Awaiting approval" value={kpi.awaiting_approval} tone="amber" testid="pay-kpi-awaiting" />
          <KpiTile label="Approved (ready to pay)" value={kpi.approved} tone="sky" testid="pay-kpi-approved" />
          <KpiTile label={`Paid ${kpi.period}`} value={`${kpi.paid_this_month.count} · ${fmtRp(kpi.paid_this_month.amount)}`} tone="emerald" testid="pay-kpi-paid" />
        </div>
      )}

      <div className="glass-card p-4 flex flex-wrap items-center gap-3" data-testid="pay-toolbar">
        <div className="flex flex-wrap gap-1" role="tablist" data-testid="pay-status-tabs">
          {STATUS_TABS.map(t => (
            <button key={t.key}
              role="tab" aria-selected={status === t.key}
              data-testid={`pay-tab-${t.key}`}
              className={`px-3 py-1.5 text-xs rounded-full transition ${status === t.key ? "bg-foreground text-background" : "hover:bg-foreground/10"}`}
              onClick={() => setStatus(t.key)}>{t.label}</button>
          ))}
        </div>
        <div className="relative ml-auto max-w-xs w-full">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Cari doc_no / payee / invoice..." value={search}
                 onChange={e => setSearch(e.target.value)}
                 className="glass-input pl-9 h-9" data-testid="pay-search" />
        </div>
        <Button onClick={() => navigate("/finance/payments/new")}
          className="rounded-full gap-2 h-10 bg-foreground text-background hover:bg-foreground/90"
          data-testid="pay-new-btn"><Plus className="h-4 w-4" />New Payment</Button>
      </div>

      <div className="glass-card overflow-hidden" data-testid="pay-table-card">
        <DataTable
          columns={[
            { key: "doc_no", label: "Doc No", primary: true, sortable: true,
              render: (p) => <span className="font-mono text-xs" data-testid={`pay-doc-no-${p.doc_no}`}>{p.doc_no}</span> },
            { key: "request_date", label: "Date", sortable: true, render: (p) => fmtDate(p.request_date) },
            { key: "payee", label: "Payee",
              render: (p) => (
                <div>
                  <div>{p.payee_name || p.payee_text || "-"}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">{p.payee_type}</div>
                </div>
              ) },
            { key: "description", label: "Description",
              render: (p) => <span className="max-w-[280px] truncate block">{p.description}</span> },
            { key: "amount", label: "Amount", numeric: true, sortable: true,
              render: (p) => <span data-testid={`pay-amount-${p.doc_no}`}>{fmtRp(p.amount)}</span> },
            { key: "status", label: "Status", render: (p) => <StatusPill status={p.status} /> },
          ]}
          rows={items}
          keyField="doc_no"
          loading={loading}
          rowTestIdPrefix="pay-row"
          defaultSort={{ key: "request_date", dir: "desc" }}
          renderExpanded={(p) => <PayBreakdown p={p} />}
          rowAction={(p) => (
            <Link to={`/finance/payments/${p.id}`} className="text-xs text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
              data-testid={`pay-view-${p.doc_no}`}>View</Link>
          )}
          empty={
            <EmptyState icon={Banknote} title="Belum ada Payment"
              description="Klik 'New Payment' untuk bayar vendor/pegawai/lainnya."
              actionLabel="Buat Payment" onAction={() => navigate("/finance/payments/new")}
              data-testid="pay-empty-state" />
          }
        />
        {items.length > 0 && (
          <div className="px-4 py-2 border-t border-border/40 text-[11px] text-muted-foreground" data-testid="pay-table-meta">
            Total: {meta.total} PAY
          </div>
        )}
      </div>
    </div>
  );
}

function PayBreakdown({ p }) {
  const gross = parseFloat(p.amount || 0);
  const wht = parseFloat(p.wh_amount || 0);
  const hasWht = p.wh_type && wht > 0;
  return (
    <div className="space-y-3 text-sm" data-testid={`pay-breakdown-${p.doc_no}`}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-2">
        <KV label="Payee" value={`${p.payee_name || p.payee_text || "-"} · ${(p.payee_type || "-")}`} />
        <KV label="Tanggal Request" value={fmtDate(p.request_date)} />
        <KV label="Invoice No" value={p.invoice_no || "—"} />
        <KV label="Status" value={p.status} />
      </div>
      {p.description && (
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Keterangan</div>
          <div className="mt-0.5">{p.description}</div>
        </div>
      )}
      {hasWht && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5">
          <div className="text-[11px] uppercase tracking-wide text-amber-700 dark:text-amber-400 font-semibold mb-1">Withholding Tax ({p.wh_type})</div>
          <div className="grid grid-cols-3 gap-2 text-xs tabular-nums">
            <div><div className="text-muted-foreground">Gross</div><div className="font-semibold">{fmtRp(gross)}</div></div>
            <div><div className="text-muted-foreground">WHT</div><div className="font-semibold text-amber-700 dark:text-amber-400">({fmtRp(wht)})</div></div>
            <div><div className="text-muted-foreground">Net</div><div className="font-semibold">{fmtRp(gross - wht)}</div></div>
          </div>
        </div>
      )}
    </div>
  );
}

function KV({ label, value }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
function KpiTile({ label, value, tone = "neutral", testid }) {
  const cls = {
    neutral: "", amber: "text-amber-700 dark:text-amber-400",
    sky: "text-sky-700 dark:text-sky-400", emerald: "text-emerald-700 dark:text-emerald-400",
  }[tone] || "";
  return (
    <div className="glass-card p-4" data-testid={testid}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold tabular-nums mt-1 ${cls}`} data-testid={testid ? `${testid}-value` : undefined}>{value}</div>
    </div>
  );
}
