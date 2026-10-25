/** Daily Sales — list view with filter (mobile-card on sm). 7E polish.
 *  `embedded` = dirender di dalam langkah End of Day → tanpa PageHeader (satu <h1> per halaman). */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Calendar, Receipt, Eye } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { fmtRp, fmtDate, todayJakartaISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/shared/PageHeader";
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

export default function DailySalesList({ embedded = false }) {
  const navigate = useNavigate();
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

  const newButton = (
    <Button asChild>
      <Link to="/outlet/daily-sales/new" data-testid="ds-new">
        <Plus className="h-4 w-4" /> Daily Sales Baru
      </Link>
    </Button>
  );

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="daily-sales-list-page">
      {!embedded && (
        <PageHeader
          icon={Receipt}
          title="Daily Sales"
          subtitle="Rekap penjualan harian per outlet — draft, submit, lalu divalidasi finance."
          actions={newButton}
          className="mb-0 md:mb-0"
        />
      )}

      {/* Toolbar — date filters (outlet filter ada di header Outlet Aktif). */}
      <div className="glass-card p-3">
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
          <div className="sm:min-w-[160px] flex-1 space-y-1">
            <Label className="text-xs md:text-sm font-medium inline-flex items-center gap-1" htmlFor="ds-date-from">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> Dari tanggal
            </Label>
            <Input
              id="ds-date-from"
              type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
              className="glass-input" data-testid="ds-filter-date-from"
            />
          </div>
          <div className="sm:min-w-[160px] flex-1 space-y-1">
            <Label className="text-xs md:text-sm font-medium inline-flex items-center gap-1" htmlFor="ds-date-to">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> Sampai tanggal
            </Label>
            <Input
              id="ds-date-to"
              type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
              className="glass-input" data-testid="ds-filter-date-to"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => { setDateFrom(""); setDateTo(""); setPage(1); }}
            disabled={!dateFrom && !dateTo}
            data-testid="ds-filter-all-dates"
          >
            Semua tanggal
          </Button>
          {embedded && newButton}
        </div>
        {/* Active range indicator — makes the default 14-day window explicit so the
            shown count is never mistaken for the full dataset. */}
        <div className="mt-2 text-xs text-muted-foreground">
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
        </div>
      </div>

      {/* Status filter */}
      <Tabs value={status || "all"} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setPage(1); }}>
        <TabsList aria-label="Filter status">
          {STATUS_TABS.map(t => (
            <TabsTrigger key={t.key || "all"} value={t.key || "all"} data-testid={`ds-tab-${t.key || "all"}`}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Responsive list */}
      <div className="glass-card">
        <DataTable
          columns={columns}
          rows={items}
          keyField="id"
          onRowClick={(s) => navigate(`/outlet/daily-sales/${s.id}`)}
          loading={loading}
          empty={
            <EmptyState
              icon={Receipt}
              title="Belum ada daily sales"
              description={status ? "Tidak ada daily sales dengan status ini pada rentang tanggal terpilih." : "Buat draft daily sales untuk hari ini."}
              action={
                <Button asChild variant="outline" size="sm">
                  <Link to="/outlet/daily-sales/new">Buat Daily Sales</Link>
                </Button>
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
          <div className="px-4 py-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
            <span>Total: {meta.total}</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="Halaman sebelumnya" data-testid="ds-page-prev">Sebelumnya</Button>
              <span className="px-1 tabular-nums" aria-current="page">{page}/{totalPages}</span>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} aria-label="Halaman berikutnya" data-testid="ds-page-next">Berikutnya</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
