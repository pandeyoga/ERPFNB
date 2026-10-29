/** Payment Request (PAY) list page. */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Banknote, Plus, FileEdit, Clock, CheckCircle2 } from "lucide-react";
import api, { unwrapWithMeta } from "@/lib/api";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import EmptyState from "@/components/shared/EmptyState";
import StatusPill from "@/components/shared/StatusPill";
import DataTable from "@/components/shared/DataTable";
import ListToolbar, { ListSearch, StatusTabs } from "@/components/shared/ListToolbar";
import { fmtRp, fmtDate } from "@/lib/format";
import { toast } from "sonner";

// "Menunggu Approval" = submitted (tanpa workflow) + awaiting_approval (dengan workflow): tahap yang sama bagi user.
// Maks. 5 tab; sisanya di menu "Status lain" (DESIGN_SYSTEM §10.3).
const STATUS_TABS = [
  { key: "all", label: "Semua" },
  { key: "draft", label: "Draft" },
  { key: "submitted,awaiting_approval", label: "Menunggu Approval" },
  { key: "approved", label: "Disetujui" },
  { key: "paid", label: "Dibayar" },
  { key: "rejected", label: "Ditolak" },
  { key: "cancelled", label: "Dibatalkan" },
];

export default function PaymentList({ embedded = false }) {
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

  const subtitle = "Pembayaran ke vendor, karyawan, dan pihak lain — draft, approval, sampai dibayar & dijurnal.";
  const actions = (
    <Button onClick={() => navigate("/finance/payments/new")} data-testid="pay-new-btn">
      <Plus className="h-4 w-4" />Buat Payment
    </Button>
  );

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="payment-list-page">
      <PageHeader icon={Banknote} title="Payments" subtitle={subtitle} actions={actions} />

      {kpi && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="pay-kpi-strip">
          <CompactStatCard label="Draft" icon={FileEdit} color="aurora-3" testId="pay-kpi-draft"
            value={<span data-testid="pay-kpi-draft-value">{kpi.draft}</span>} />
          <CompactStatCard label="Menunggu approval" icon={Clock} color="aurora-5" tone="warning" testId="pay-kpi-awaiting"
            value={<span data-testid="pay-kpi-awaiting-value">{kpi.awaiting_approval}</span>} />
          <CompactStatCard label="Disetujui (siap bayar)" icon={CheckCircle2} color="aurora-2" tone="info" testId="pay-kpi-approved"
            value={<span data-testid="pay-kpi-approved-value">{kpi.approved}</span>} />
          <CompactStatCard label={`Dibayar ${kpi.period}`} icon={Banknote} color="aurora-4" tone="success" testId="pay-kpi-paid"
            value={<span data-testid="pay-kpi-paid-value">{fmtRp(kpi.paid_this_month.amount)}</span>}
            sub={`${kpi.paid_this_month.count} payment`} />
        </div>
      )}

      <div className="glass-card overflow-hidden" data-testid="pay-table-card">
        <ListToolbar
          testId="pay-toolbar"
          search={<ListSearch value={search} onChange={setSearch} placeholder="Cari doc no / payee / invoice…" ariaLabel="Cari payment" testId="pay-search" />}
        >
          <StatusTabs value={status} onChange={setStatus} options={STATUS_TABS} ariaLabel="Filter status payment"
            testId="pay-status-tabs" tabTestId={(k) => `pay-tab-${k.split(",").pop()}`} />
        </ListToolbar>
        <DataTable
          columns={[
            { key: "doc_no", label: "Doc No", primary: true, sortable: true,
              render: (p) => <span className="font-mono text-xs whitespace-nowrap" data-testid={`pay-doc-no-${p.doc_no}`}>{p.doc_no}</span> },
            { key: "request_date", label: "Tanggal", sortable: true, render: (p) => fmtDate(p.request_date) },
            { key: "payee", label: "Payee",
              render: (p) => (
                <div>
                  <div>{p.payee_name || p.payee_text || "-"}</div>
                  <div className="text-[11px] text-muted-foreground uppercase">{p.payee_type}</div>
                </div>
              ) },
            { key: "description", label: "Deskripsi",
              render: (p) => <span className="max-w-[280px] truncate block">{p.description}</span> },
            { key: "amount", label: "Nominal", numeric: true, sortable: true,
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
            <Button asChild variant="ghost" size="sm">
              <Link to={`/finance/payments/${p.id}`}
                onClick={(e) => e.stopPropagation()}
                data-testid={`pay-view-${p.doc_no}`}>Lihat detail</Link>
            </Button>
          )}
          empty={
            <EmptyState icon={Banknote} title="Belum ada payment"
              description="Klik 'Buat Payment' untuk membayar vendor, karyawan, atau pihak lain."
              action={<Button size="sm" onClick={() => navigate("/finance/payments/new")} data-testid="pay-empty-create">
                <Plus className="h-4 w-4" />Buat Payment</Button>}
              data-testid="pay-empty-state" />
          }
        />
        {items.length > 0 && (
          <div className="px-4 py-2 border-t border-border/40 text-xs text-muted-foreground" data-testid="pay-table-meta">
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
