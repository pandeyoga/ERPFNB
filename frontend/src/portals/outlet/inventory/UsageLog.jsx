/** Outlet Usage Log — ingredient consumption & waste from inventory movements. */
import { useEffect, useMemo, useState } from "react";
import { ClipboardList, RefreshCw, Store, Search, TrendingDown, Trash2 } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import { fmtRp, fmtNumber } from "@/lib/format";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { useOutletScopeCtx } from "../OutletScopeContext";

// Consumption / outflow movement types (negative qty = stock leaving).
const USAGE_TYPES = ["issue", "sale", "wastage", "transfer_out", "opname_diff"];
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
  const [typeFilter, setTypeFilter] = useState("all");

  const outletMap = useMemo(
    () => Object.fromEntries(scopedOutlets.map((o) => [o.id, o])), [scopedOutlets]);
  const aggregateMode = !outletId;

  async function load() {
    setLoading(true);
    try {
      const params = { per_page: 200 };
      if (outletId) params.outlet_id = outletId;
      const res = await api.get("/inventory/movements", { params });
      const all = (unwrap(res) || []).map((r) => ({ ...r, _rk: r.id }));
      // Only outflow/consumption movements (this is a USAGE log, not receipts).
      setRows(all.filter((r) => USAGE_TYPES.includes(r.movement_type) || Number(r.qty) < 0));
    } catch (e) {
      toast.error("Gagal memuat usage log");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [outletId]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== "all" && r.movement_type !== typeFilter) return false;
      if (term && !(r.item_name || "").toLowerCase().includes(term)) return false;
      return true;
    });
  }, [rows, q, typeFilter]);

  const totals = useMemo(() => {
    const usageVal = rows.reduce((s, r) => s + Math.abs(Number(r.total_cost || r.total_value) || 0), 0);
    const wasteVal = rows.filter((r) => r.movement_type === "wastage")
      .reduce((s, r) => s + Math.abs(Number(r.total_cost || r.total_value) || 0), 0);
    return { usageVal, wasteVal, count: rows.length };
  }, [rows]);

  const availTypes = useMemo(() => {
    const present = new Set(rows.map((r) => r.movement_type));
    return ["all", ...USAGE_TYPES.filter((t) => present.has(t))];
  }, [rows]);

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
      render: (r) => <span className="font-mono tabular-nums">{fmtNumber(Math.abs(Number(r.qty) || 0))} {r.unit || ""}</span> },
    { key: "value", label: "Nilai", numeric: true,
      render: (r) => <span className="font-mono tabular-nums">{fmtRp(Math.abs(Number(r.total_cost || r.total_value) || 0))}</span> },
  ];

  return (
    <div className="p-1 sm:p-2 space-y-5" data-testid="outlet-usage-log">
      <div className="glass-card p-5 lg:p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-xl font-bold mb-1 flex items-center gap-2">
              <ClipboardList className="h-5 w-5" /> Usage Log
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <Store className="h-3.5 w-3.5" />
                {currentOutlet ? currentOutlet.name : `Semua Outlet (${scopedOutlets.length})`}
              </span>
              <span className="text-muted-foreground/50">·</span>
              <span>Pemakaian bahan & waste dari pergerakan stok</span>
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} data-testid="usage-refresh">
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="glass-card p-4" data-testid="usage-kpi-count">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3.5 w-3.5" /> Total Pergerakan</div>
          <div className="text-2xl font-bold tabular-nums">{fmtNumber(totals.count)}</div>
        </div>
        <div className="glass-card p-4" data-testid="usage-kpi-value">
          <div className="text-xs text-muted-foreground">Total Nilai Pemakaian</div>
          <div className="text-2xl font-bold tabular-nums">{fmtRp(totals.usageVal)}</div>
        </div>
        <div className="glass-card p-4 col-span-2 lg:col-span-1" data-testid="usage-kpi-waste">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><Trash2 className="h-3.5 w-3.5" /> Nilai Waste/Rusak</div>
          <div className="text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400">{fmtRp(totals.wasteVal)}</div>
        </div>
      </div>

      <div className="glass-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {availTypes.map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${typeFilter === t ? "pill-active" : "glass-input hover:bg-foreground/5"}`}
              data-testid={`usage-filter-${t}`}>
              {t === "all" ? "Semua" : (TYPE_LABEL[t] || t)}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cari item…" value={q} onChange={(e) => setQ(e.target.value)}
            className="glass-input pl-9 h-10" data-testid="usage-search" />
        </div>
      </div>

      <div className="glass-card">
        <DataTable
          columns={columns}
          rows={filtered}
          keyField="_rk"
          loading={loading}
          empty={<EmptyState icon={ClipboardList}
            title={q || typeFilter !== "all" ? "Tidak ada data" : "Belum ada pemakaian"}
            description="Log pemakaian muncul otomatis dari penjualan, transfer keluar, dan pencatatan waste." />}
          rowTestIdPrefix="usage-row"
        />
      </div>
    </div>
  );
}
