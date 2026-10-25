/** Outlet Usage Log — ingredient consumption & waste from inventory movements. */
import { useEffect, useMemo, useState } from "react";
import { ClipboardList, RefreshCw, Search, TrendingDown, Trash2, Wallet } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtRp, fmtNumber } from "@/lib/format";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/useDebounce";
import { useOutletScopeCtx } from "../OutletScopeContext";

// Consumption / outflow movement types (negative qty = stock leaving) — urutan tab filter.
// Server (usage_only=true) memakai definisi yang sama: tipe ini atau qty negatif.
const USAGE_TYPES = ["issue", "sale", "wastage", "transfer_out", "opname_diff"];
const PER_PAGE = 25;
const TYPE_LABEL = {
  issue: "Pemakaian", sale: "Terjual", wastage: "Waste/Rusak",
  transfer_out: "Transfer Keluar", opname_diff: "Selisih Opname", adjustment: "Penyesuaian",
};
const TYPE_TONE = {
  wastage: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  transfer_out: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  sale: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  issue: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
};

export default function UsageLog() {
  const { scopedOutlets, outletId, currentOutlet } = useOutletScopeCtx();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const search = useDebounce(q.trim(), 350);
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, summary: null });

  const outletMap = useMemo(
    () => Object.fromEntries(scopedOutlets.map((o) => [o.id, o])), [scopedOutlets]);
  const aggregateMode = !outletId;

  async function load() {
    setLoading(true);
    try {
      // Only outflow/consumption movements (this is a USAGE log, not receipts) — difilter &
      // dipaginasi di server; meta.summary berisi KPI atas seluruh hasil.
      const params = { usage_only: true, page, per_page: PER_PAGE };
      if (outletId) params.outlet_id = outletId;
      if (typeFilter !== "all") params.movement_type = typeFilter;
      if (search) params.search = search;
      const res = await api.get("/inventory/movements", { params });
      setRows((unwrap(res) || []).map((r) => ({ ...r, _rk: r.id })));
      setMeta(res.data?.meta || { total: 0, summary: null });
    } catch (e) {
      toast.error("Gagal memuat usage log");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [outletId, typeFilter, search, page]);
  useEffect(() => { setPage(1); }, [outletId, typeFilter, search]);

  const summary = meta.summary || {};
  const totals = {
    usageVal: summary.usage_value || 0,
    wasteVal: summary.waste_value || 0,
    count: summary.count || 0,
  };
  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / PER_PAGE));

  // Semua tipe yang benar-benar ada di data (mis. "adjustment" dengan qty negatif) harus
  // punya filter — sebelumnya hanya USAGE_TYPES sehingga baris "Penyesuaian" tidak bisa difilter.
  const availTypes = useMemo(() => {
    const present = new Set(Object.keys(summary.type_counts || {}));
    const ordered = USAGE_TYPES.filter((t) => present.has(t));
    const extra = [...present].filter((t) => !USAGE_TYPES.includes(t));
    return ["all", ...ordered, ...extra];
  }, [summary.type_counts]);

  const columns = [
    { key: "movement_date", label: "Tanggal", primary: true,
      render: (r) => <span className="text-sm">{fmtDate(r.movement_date)}</span> },
    { key: "item_name", label: "Item",
      render: (r) => <span className="font-medium">{r.item_name || r.item_id}</span> },
    ...(aggregateMode ? [{ key: "outlet", label: "Outlet",
      render: (r) => outletMap[r.outlet_id]?.name || r.outlet_id }] : []),
    { key: "movement_type", label: "Tipe",
      render: (r) => (
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${TYPE_TONE[r.movement_type] || "bg-muted text-muted-foreground"}`}>
          {TYPE_LABEL[r.movement_type] || r.movement_type}
        </span>
      ) },
    { key: "qty", label: "Qty", numeric: true,
      render: (r) => <span className="tabular-nums">{fmtNumber(Math.abs(Number(r.qty) || 0))} {r.unit || ""}</span> },
    { key: "value", label: "Nilai", numeric: true,
      render: (r) => <span className="tabular-nums">{fmtRp(Math.abs(Number(r.total_cost || r.total_value) || 0))}</span> },
  ];

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="outlet-usage-log">
      <PageHeader
        icon={ClipboardList}
        title="Usage Log"
        subtitle={`Pemakaian bahan & waste dari pergerakan stok · ${currentOutlet ? currentOutlet.name : `Semua Outlet (${scopedOutlets.length})`}`}
        className="mb-0 md:mb-0"
        actions={
          <Button variant="outline" onClick={load} data-testid="usage-refresh">
            <RefreshCw className="h-4 w-4" /> Muat ulang
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <CompactStatCard label="Total Pergerakan" value={fmtNumber(totals.count)} icon={TrendingDown} color="aurora-1" loading={loading} testId="usage-kpi-count" />
        <CompactStatCard label="Total Nilai Pemakaian" value={fmtRp(totals.usageVal)} icon={Wallet} color="aurora-3" loading={loading} testId="usage-kpi-value" />
        <CompactStatCard label="Nilai Waste/Rusak" value={fmtRp(totals.wasteVal)} icon={Trash2} color="aurora-6"
          tone={totals.wasteVal > 0 ? "danger" : "default"} loading={loading} testId="usage-kpi-waste" className="col-span-2 lg:col-span-1" />
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <Tabs value={typeFilter} onValueChange={setTypeFilter}>
          <TabsList aria-label="Filter tipe pergerakan">
            {availTypes.map((t) => (
              <TabsTrigger key={t} value={t} data-testid={`usage-filter-${t}`}>
                {t === "all" ? "Semua" : (TYPE_LABEL[t] || t)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative md:ml-auto md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cari item…" aria-label="Cari item" value={q} onChange={(e) => setQ(e.target.value)}
            className="glass-input pl-9" data-testid="usage-search" />
        </div>
      </div>

      <div className="glass-card">
        <DataTable
          columns={columns}
          rows={rows}
          keyField="_rk"
          loading={loading}
          empty={<EmptyState icon={ClipboardList}
            title={q || typeFilter !== "all" ? "Tidak ada data" : "Belum ada pemakaian"}
            description="Log pemakaian muncul otomatis dari penjualan, transfer keluar, dan pencatatan waste." />}
          rowTestIdPrefix="usage-row"
        />
        {totalPages > 1 && (
          <div className="px-4 py-2.5 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground" data-testid="usage-pagination">
            <span className="tabular-nums">Total: {meta.total}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="Halaman sebelumnya" data-testid="usage-prev">Sebelumnya</Button>
              <span className="tabular-nums" data-testid="usage-page-info">{page}/{totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} aria-label="Halaman berikutnya" data-testid="usage-next">Berikutnya</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
