/** Daily Sales — list view with filter (mobile-card on sm). 7E polish. */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Calendar, Receipt, Eye } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { fmtRp, fmtDate, todayJakartaISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StatusPill from "@/components/shared/StatusPill";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useOutletScopeCtx } from "./OutletScopeContext";

const STATUS_TABS = [
  { key: "",          label: "Semua" },
  { key: "draft",     label: "Draft" },
  { key: "submitted", label: "Submitted" },
  { key: "validated", label: "Validated" },
  { key: "rejected",  label: "Rejected" },
];

export default function DailySalesList() {
  const { user } = useAuth();
  const { outletId, scopedOutlets } = useOutletScopeCtx();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(todayJakartaISO());
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, per_page: 20 });

  const outletMap = useMemo(
    () => Object.fromEntries(scopedOutlets.map(o => [o.id, o])),
    [scopedOutlets],
  );

  async function load() {
    setLoading(true);
    try {
      const params = { page, per_page: 20 };
      if (status) params.status = status;
      if (outletId) params.outlet_id = outletId;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await api.get("/outlet/daily-sales", { params });
      setItems(unwrap(res) || []);
      setMeta(res.data?.meta || {});
    } catch (e) {
      toast.error("Gagal load daily sales");
    } finally {
      setLoading(false);
    }
  }

  // Refetch when outlet context changes, page changes, or filters change
  useEffect(() => { load(); setPage(1); /* eslint-disable-next-line */ }, [outletId]);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, status, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.per_page || 20)));

  const columns = [
    {
      key: "sales_date", label: "Tanggal", primary: true,
      render: (s) => fmtDate(s.sales_date),
    },
    {
      key: "outlet", label: "Outlet",
      render: (s) => outletMap[s.outlet_id]?.name || s.outlet_id,
    },
    {
      key: "grand_total", label: "Grand Total", numeric: true,
      render: (s) => <span className="font-semibold">{fmtRp(s.grand_total || 0)}</span>,
    },
    {
      key: "transaction_count", label: "Trx", numeric: true,
      render: (s) => <span className="text-muted-foreground">{s.transaction_count || 0}</span>,
    },
    {
      key: "status", label: "Status",
      render: (s) => <StatusPill status={s.status} />,
    },
  ];

  return (
    <div className="space-y-4" data-testid="daily-sales-list-page">
      {/* Toolbar — only Date filters + New button. Outlet filter is in global header. */}
      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
          <div className="sm:min-w-[160px] flex-1">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold" htmlFor="ds-date-from">
              <Calendar className="inline h-3 w-3 mr-1" /> Dari Tanggal
            </label>
            <Input
              id="ds-date-from"
              type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
              className="glass-input mt-1 h-10" data-testid="ds-filter-date-from"
            />
          </div>
          <div className="sm:min-w-[160px] flex-1">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold" htmlFor="ds-date-to">
              <Calendar className="inline h-3 w-3 mr-1" /> Sampai Tanggal
            </label>
            <Input
              id="ds-date-to"
              type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
              className="glass-input mt-1 h-10" data-testid="ds-filter-date-to"
            />
          </div>
          <Link to="/outlet/daily-sales/new" className="sm:ml-auto">
            <Button className="rounded-full pill-active gap-2 h-10 px-5 w-full sm:w-auto" data-testid="ds-new">
              <Plus className="h-4 w-4" /> Daily Sales Baru
            </Button>
          </Link>
        </div>
        {/* Active range indicator — makes the default 14-day window explicit so the
            shown count is never mistaken for the full dataset. */}
        <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between gap-3 flex-wrap text-xs">
          <span className="text-muted-foreground">
            {dateFrom || dateTo ? (
              <>Menampilkan <b className="text-foreground tabular-nums">{meta.total ?? 0}</b> entri
                {" "}dalam rentang{" "}
                <b className="text-foreground">{dateFrom ? fmtDate(dateFrom) : "awal"}</b>
                {" – "}
                <b className="text-foreground">{dateTo ? fmtDate(dateTo) : "kini"}</b>
              </>
            ) : (
              <>Menampilkan <b className="text-foreground tabular-nums">{meta.total ?? 0}</b> entri · semua tanggal</>
            )}
          </span>
          <button
            type="button"
            onClick={() => { setDateFrom(""); setDateTo(""); setPage(1); }}
            disabled={!dateFrom && !dateTo}
            className="px-3 py-1 rounded-full glass-input disabled:opacity-40 hover:bg-foreground/5 transition-colors"
            data-testid="ds-filter-all-dates"
          >
            Semua Tanggal
          </button>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="Filter status">
        {STATUS_TABS.map(t => (
          <button
            key={t.key || "all"}
            role="tab"
            aria-selected={status === t.key}
            onClick={() => { setStatus(t.key); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors touch-target ${
              status === t.key ? "pill-active" : "hover:bg-foreground/5 text-muted-foreground"
            }`}
            data-testid={`ds-tab-${t.key || "all"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Responsive list */}
      <div className="glass-card">
        <DataTable
          columns={columns}
          rows={items}
          keyField="id"
          onRowClick={(s) => { window.location.assign(`/outlet/daily-sales/${s.id}`); }}
          loading={loading}
          empty={
            <EmptyState
              icon={Receipt}
              title="Belum ada daily sales"
              description="Buat draft daily sales untuk hari ini."
              action={
                <Link to="/outlet/daily-sales/new">
                  <Button className="pill-active rounded-full">Buat Daily Sales</Button>
                </Link>
              }
            />
          }
          rowAction={(s) => (
            <Link
              to={`/outlet/daily-sales/${s.id}`}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              data-testid={`ds-view-${s.id}`}
              aria-label={`Lihat detail daily sales ${fmtDate(s.sales_date)}`}
              onClick={(e) => e.stopPropagation()}
            >
              <Eye className="h-3.5 w-3.5" /> Detail
            </Link>
          )}
          rowTestIdPrefix="ds"
        />
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
            <span>Total: {meta.total}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded-full glass-input disabled:opacity-50" aria-label="Halaman sebelumnya">Prev</button>
              <span className="px-2 py-1" aria-current="page">{page}/{totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded-full glass-input disabled:opacity-50" aria-label="Halaman berikutnya">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
