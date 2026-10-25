/** Phase 9C — Low Stock Alert + Quick PR.
 *
 * Migrated 2026-06-17 to the shared DataTable primitive (UX baseline):
 *   sortable columns, sticky header, responsive cards, built-in loading/empty.
 *
 * Lists items where qty < par_level across the user's outlets.
 * - Bulk select → "Buat PR (X items)" button passes prefill payload to /procurement/pr/new
 *   via base64-encoded URL param. PRForm picks it up and seeds line items.
 * - Filter by outlet, severity, search.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, Search, ShoppingCart,
  CheckSquare, Square, Package, RefreshCw, ShieldCheck, XOctagon, TrendingDown, ListChecks,
} from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import { fmtRp, fmtNumber } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import useOutletScope from "@/hooks/useOutletScope";

function severityClasses(sev) {
  if (sev === "critical") return "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30";
  if (sev === "low") return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
  return "bg-muted text-muted-foreground border-border/50";
}

function encodePrefill(items) {
  const payload = {
    source: "low_stock",
    lines: items.map(it => ({
      item_id: it.item_id,
      item_name: it.item_name,
      qty: it.suggested_reorder || 1,
      unit: it.unit,
      unit_cost: it.last_unit_cost || 0,
      outlet_id: it.outlet_id,
    })),
    outlet_id: items[0]?.outlet_id,
    vendor_id: items[0]?.last_vendor_id || null,
    note: `Otomatis dari Low Stock — ${items.length} item perlu replenish.`,
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

const rowKeyFor = (it) => `${it.item_id}::${it.outlet_id}`;

/* --------------------------- Page --------------------------- */
export default function LowStockAlert() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const { outletId, setOutletId, scopedOutlets } = useOutletScope();
  const [data, setData] = useState({ outlets: [], items: [], total_below: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("all");
  const [selected, setSelected] = useState(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { include_zero: true, include_negative: true, days_for_par: 30 };
      if (outletId) params.outlet_ids = outletId;
      const res = await api.get("/inventory/low-stock", { params });
      setData(unwrap(res) || { outlets: [], items: [], total_below: 0 });
      setSelected(new Set());
    } catch (e) {
      toast.error("Gagal memuat data low stock");
    } finally { setLoading(false); }
  }, [outletId]);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let list = (data.items || []).slice();
    if (severity !== "all") list = list.filter(x => x.severity === severity);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(x =>
        (x.item_name || "").toLowerCase().includes(s) ||
        (x.item_code || "").toLowerCase().includes(s) ||
        (x.outlet_name || "").toLowerCase().includes(s),
      );
    }
    // Default ordering: critical first, then largest deficit.
    list.sort((a, b) => {
      const cmp = (a.severity === "critical" ? 0 : 1) - (b.severity === "critical" ? 0 : 1);
      if (cmp !== 0) return cmp;
      return (b.deficit || 0) - (a.deficit || 0);
    });
    return list.map(it => ({ ...it, _rowkey: `${it.item_id}-${it.outlet_id}` }));
  }, [data.items, severity, search]);

  const toggleSelect = useCallback((it) => {
    const k = rowKeyFor(it);
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === filtered.length && filtered.length > 0) return new Set();
      return new Set(filtered.map(rowKeyFor));
    });
  }, [filtered]);

  const selectedItems = useMemo(
    () => filtered.filter(it => selected.has(rowKeyFor(it))),
    [filtered, selected]
  );

  function createPRFromSelected() {
    if (selectedItems.length === 0) {
      toast.error("Pilih minimal 1 item.");
      return;
    }
    const outlets = new Set(selectedItems.map(it => it.outlet_id));
    if (outlets.size > 1) {
      toast.warning(
        `Anda memilih ${outlets.size} outlet — PR akan dibuat untuk outlet pertama saja. Buat PR terpisah untuk outlet lain.`,
        { duration: 5000 }
      );
    }
    if (!can("procurement.pr.create")) {
      toast.error("Anda tidak punya izin membuat PR.");
      return;
    }
    const encoded = encodePrefill(selectedItems);
    navigate(`/procurement/pr/new?prefill=${encodeURIComponent(encoded)}`);
  }

  const counts = useMemo(() => {
    const total = data.total_below || 0;
    const critical = (data.items || []).filter(x => x.severity === "critical").length;
    const low = total - critical;
    return { total, critical, low };
  }, [data.items, data.total_below]);

  const allSelected = selected.size === filtered.length && filtered.length > 0;

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="low-stock-page">
      <PageHeader
        icon={AlertTriangle}
        title="Low Stock Alert"
        subtitle="Item di bawah par level — pilih item lalu buat PR untuk replenish."
        className="mb-0 md:mb-0"
        actions={
          <Button variant="outline" onClick={load} disabled={loading} data-testid="low-refresh">
            <RefreshCw /> Muat ulang
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CompactStatCard size="sm" label="Total di bawah par" value={counts.total} tone="danger" icon={TrendingDown} color="aurora-6" loading={loading} testId="low-tile-total" />
        <CompactStatCard size="sm" label="Critical (qty 0 / negatif)" value={counts.critical} tone="danger" icon={XOctagon} color="aurora-6" loading={loading} testId="low-tile-critical" />
        <CompactStatCard size="sm" label="Low (di bawah par)" value={counts.low} tone="warning" icon={AlertTriangle} color="aurora-5" loading={loading} testId="low-tile-low" />
        <CompactStatCard size="sm" label="Item dipilih" value={selected.size} icon={ListChecks} color="aurora-1" testId="low-tile-selected" />
      </div>

      <div className="glass-card p-4 flex flex-wrap gap-3 items-end" data-testid="low-toolbar">
        <div className="min-w-[200px]">
          <Label className="text-xs md:text-sm font-medium">Outlet</Label>
          <SimpleSelect
            ariaLabel="Filter outlet"
            value={outletId}
            onValueChange={setOutletId}
            options={[{ value: "", label: "Semua outlet (dalam scope)" }, ...scopedOutlets.map(o => ({ value: o.id, label: o.name }))]}
            placeholder="Semua outlet (dalam scope)"
            className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1"
            testId="low-outlet"
          />
        </div>
        <div className="min-w-[200px]" role="group" aria-labelledby="low-sev-label">
          <span id="low-sev-label" className="text-xs md:text-sm font-medium">Severity</span>
          <div className="flex gap-1.5 mt-1">
            {[
              { v: "all", l: "Semua" },
              { v: "critical", l: "Critical" },
              { v: "low", l: "Low" },
            ].map(s => (
              <Button
                key={s.v}
                type="button"
                size="sm"
                variant={severity === s.v ? "default" : "outline"}
                aria-pressed={severity === s.v}
                onClick={() => setSeverity(s.v)}
                data-testid={`low-sev-${s.v}`}
              >
                {s.l}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex-1 min-w-[200px]">
          <Label htmlFor="low-search-input" className="text-xs md:text-sm font-medium">Cari</Label>
          <div className="relative mt-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input id="low-search-input" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari item / outlet…" className="glass-input pl-9"
              data-testid="low-search" />
          </div>
        </div>
        <Button onClick={createPRFromSelected}
          disabled={selectedItems.length === 0}
          data-testid="low-create-pr">
          <ShoppingCart />
          Buat PR ({selectedItems.length})
        </Button>
      </div>

      <div className="glass-card overflow-hidden" data-testid="low-table-card">
        <DataTable
          rows={filtered}
          keyField="_rowkey"
          loading={loading}
          rowTestIdPrefix="low-row"
          empty={
            search || severity !== "all"
              ? <EmptyState icon={Search} title="Tidak ada item yang cocok" description="Ubah filter severity atau kata kunci pencarian." />
              : <EmptyState icon={ShieldCheck} title="Stok aman" description="Tidak ada item yang di bawah par level." />
          }
          columns={[
            { key: "_select", label: (
                <button onClick={toggleSelectAll} type="button" data-testid="low-select-all" className="inline-flex rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  role="checkbox" aria-checked={allSelected} aria-label="Pilih semua item">
                  {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                </button>
              ),
              render: (it) => {
                const sel = selected.has(rowKeyFor(it));
                return (
                  <button onClick={() => toggleSelect(it)} type="button"
                    className="inline-flex rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    role="checkbox" aria-checked={sel} aria-label={`Pilih ${it.item_name} — ${it.outlet_name}`}
                    data-testid={`low-select-${it.item_id}-${it.outlet_id}`}>
                    {sel ? <CheckSquare className="h-4 w-4 text-foreground" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                  </button>
                );
              } },
            { key: "severity", label: "Severity", sortable: true,
              sortAccessor: (it) => (it.severity === "critical" ? 0 : 1),
              render: (it) => (
                <span className={`text-[11px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded border ${severityClasses(it.severity)}`}>
                  {it.severity}
                </span>
              ) },
            { key: "item_name", label: "Item", primary: true, sortable: true,
              render: (it) => (
                <div>
                  <div className="font-medium text-sm flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                    {it.item_name}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{it.item_code} · {it.unit}</div>
                </div>
              ) },
            { key: "outlet_name", label: "Outlet", sortable: true },
            { key: "qty", label: "Qty", numeric: true, sortable: true,
              render: (it) => (
                <span className={it.qty < 0 ? "text-rose-700 dark:text-rose-300 font-semibold" : "font-semibold"}>
                  {fmtNumber(it.qty, 1)}
                </span>
              ) },
            { key: "par_level", label: "Par", numeric: true,
              render: (it) => (
                <span className="text-muted-foreground">
                  {fmtNumber(it.par_level, 1)}
                  <span className="block text-[11px] uppercase tracking-wide opacity-70">{it.par_source}</span>
                </span>
              ) },
            { key: "deficit", label: "Defisit", numeric: true, sortable: true,
              render: (it) => <span className="text-rose-700 dark:text-rose-300 font-semibold">{fmtNumber(it.deficit, 1)}</span> },
            { key: "suggested_reorder", label: "Suggested Reorder", numeric: true,
              render: (it) => (
                <span>
                  <span className="font-medium">{it.suggested_reorder || 0}</span>
                  <span className="text-[11px] text-muted-foreground"> {it.unit}</span>
                </span>
              ) },
            { key: "last_vendor", label: "Last Vendor / Price",
              render: (it) => it.last_vendor_name ? (
                <div className="text-xs">
                  <div className="font-medium">{it.last_vendor_name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {fmtRp(it.last_unit_cost)}/{it.unit}
                    {it.last_purchase_date && <> · {it.last_purchase_date}</>}
                  </div>
                </div>
              ) : (
                <span className="text-[11px] text-muted-foreground">Belum ada riwayat</span>
              ) },
          ]}
        />
      </div>
    </div>
  );
}
