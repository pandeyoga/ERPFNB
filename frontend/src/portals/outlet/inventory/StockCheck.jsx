/** Outlet Stock Check — live stock levels per outlet (search + low-stock flags). */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Package, AlertTriangle, Search, RefreshCw, Store, ArrowRight } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import { fmtRp, fmtNumber } from "@/lib/format";
import { toast } from "sonner";
import { useOutletScopeCtx } from "../OutletScopeContext";

const LOW_STOCK_THRESHOLD = 10; // qty below this (and > 0) is flagged low

export default function StockCheck() {
  const { scopedOutlets, outletId, currentOutlet } = useOutletScopeCtx();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const outletMap = useMemo(
    () => Object.fromEntries(scopedOutlets.map((o) => [o.id, o])),
    [scopedOutlets],
  );
  const aggregateMode = !outletId;

  async function load() {
    setLoading(true);
    try {
      const params = { per_page: 500 };
      if (outletId) params.outlet_id = outletId;
      const res = await api.get("/inventory/balance", { params });
      const data = (unwrap(res) || []).map((r) => ({ ...r, _rk: `${r.item_id}-${r.outlet_id}` }));
      setRows(data);
    } catch (e) {
      toast.error("Gagal memuat stok");
    } finally {
      setLoading(false);
    }
  }

  // Reload when the active outlet scope changes.
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [outletId]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      (r.item_name || "").toLowerCase().includes(term) ||
      (r.item_id || "").toLowerCase().includes(term),
    );
  }, [rows, q]);

  const lowCount = useMemo(
    () => rows.filter((r) => Number(r.qty) <= LOW_STOCK_THRESHOLD).length,
    [rows],
  );

  const stockBadge = (qty) => {
    const n = Number(qty || 0);
    if (n <= 0) {
      return (
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-400 font-medium inline-flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" /> Habis
        </span>
      );
    }
    if (n <= LOW_STOCK_THRESHOLD) {
      return (
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 font-medium inline-flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" /> Rendah
        </span>
      );
    }
    return (
      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-medium">
        Cukup
      </span>
    );
  };

  const columns = [
    { key: "item_name", label: "Item", primary: true,
      render: (r) => <span className="font-medium">{r.item_name || r.item_id}</span> },
    ...(aggregateMode
      ? [{ key: "outlet", label: "Outlet",
          render: (r) => outletMap[r.outlet_id]?.name || r.outlet_id }]
      : []),
    { key: "qty", label: "Qty", numeric: true,
      render: (r) => (
        <span className="font-mono tabular-nums">
          {fmtNumber(r.qty || 0)} <span className="text-muted-foreground text-xs">{r.unit || ""}</span>
        </span>
      ) },
    { key: "last_unit_cost", label: "Harga/Unit", numeric: true,
      render: (r) => <span className="font-mono tabular-nums">{fmtRp(r.last_unit_cost || 0)}</span> },
    { key: "total_value", label: "Nilai", numeric: true,
      render: (r) => <span className="font-mono tabular-nums font-semibold">{fmtRp(r.total_value || 0)}</span> },
    { key: "status", label: "Status", render: (r) => stockBadge(r.qty) },
  ];

  return (
    <div className="p-1 sm:p-2 space-y-5" data-testid="outlet-stock-check">
      {/* Header */}
      <div className="glass-card p-5 lg:p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-xl font-bold mb-1 flex items-center gap-2">
              <Package className="h-5 w-5" /> Stock Check
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <Store className="h-3.5 w-3.5" />
                {currentOutlet ? currentOutlet.name : `Semua Outlet (${scopedOutlets.length})`}
              </span>
              <span className="text-muted-foreground/50">·</span>
              <span>Cek level stok terkini per outlet</span>
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} data-testid="stock-check-refresh">
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="glass-card p-4" data-testid="stock-kpi-total">
          <div className="text-xs text-muted-foreground">Total Item Tercatat</div>
          <div className="text-2xl font-bold tabular-nums">{fmtNumber(rows.length)}</div>
        </div>
        <div className="glass-card p-4" data-testid="stock-kpi-low">
          <div className="text-xs text-muted-foreground">Perlu Restock (≤ {LOW_STOCK_THRESHOLD})</div>
          <div className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{fmtNumber(lowCount)}</div>
        </div>
        <div className="glass-card p-4 col-span-2 lg:col-span-1" data-testid="stock-kpi-value">
          <div className="text-xs text-muted-foreground">Total Nilai Persediaan</div>
          <div className="text-2xl font-bold tabular-nums">
            {fmtRp(rows.reduce((s, r) => s + (Number(r.total_value) || 0), 0))}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama item…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="glass-input pl-9 h-10"
              data-testid="stock-check-search"
            />
          </div>
          <Link to="/inventory/opname">
            <Button variant="outline" className="h-10 gap-2" data-testid="stock-check-opname">
              Mulai Opname <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Stock table */}
      <div className="glass-card">
        <DataTable
          columns={columns}
          rows={filtered}
          keyField="_rk"
          loading={loading}
          empty={
            <EmptyState
              icon={Package}
              title={q ? "Item tidak ditemukan" : "Belum ada data stok"}
              description={
                q
                  ? "Coba kata kunci lain."
                  : "Stok akan muncul setelah ada penerimaan barang (GR) atau pergerakan inventory."
              }
            />
          }
          rowTestIdPrefix="stock-check-row"
        />
      </div>
    </div>
  );
}
