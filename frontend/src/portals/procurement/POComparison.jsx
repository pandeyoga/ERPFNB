/** Procurement → PO Comparison
 * Side-by-side comparison of multiple POs (or PR-vs-PO).
 */
import { useEffect, useState } from "react";
import { ShoppingCart, Filter, X, Plus } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import PageHeader from "@/components/shared/PageHeader";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import StatusPill from "@/components/shared/StatusPill";
import { Button } from "@/components/ui/button";
import SimpleSelect from "@/components/shared/SimpleSelect";
import DataTable from "@/components/shared/DataTable";
import { fmtRp, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function POComparison() {
  const [pos, setPos] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [selected, setSelected] = useState([]);
  const [filters, setFilters] = useState({ vendor_id: "", status: "" });
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [pRes, vRes] = await Promise.all([
        api.get("/procurement/pos", { params: { ...filters, per_page: 100 } }),
        api.get("/master/vendors", { params: { per_page: 100 } }),
      ]);
      setPos(unwrap(pRes) || []);
      setVendors(unwrap(vRes) || []);
    } catch (e) {
      toast.error("Gagal load data");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filters.vendor_id, filters.status]);

  function addToCompare(po) {
    if (selected.length >= 4) {
      toast.error("Maksimal 4 PO untuk perbandingan");
      return;
    }
    if (selected.find((p) => p.id === po.id)) return;
    setSelected((s) => [...s, po]);
  }
  function removeFromCompare(id) {
    setSelected((s) => s.filter((p) => p.id !== id));
  }

  // Build item-by-PO matrix
  const allItems = {};
  for (const po of selected) {
    for (const ln of po.lines || []) {
      const k = ln.item_id || ln.item_name;
      if (!allItems[k]) allItems[k] = { item_name: ln.item_name, unit: ln.unit, byPo: {} };
      allItems[k].byPo[po.id] = { qty: ln.qty, unit_cost: ln.unit_cost, total: Number(ln.qty || 0) * Number(ln.unit_cost || 0) };
    }
  }
  const itemRows = Object.values(allItems).map((row, i) => {
    const prices = selected.map((po) => row.byPo[po.id]?.unit_cost ?? null).filter((x) => x != null);
    return { ...row, _idx: i, _minP: prices.length ? Math.min(...prices) : null, _priceCount: prices.length };
  });
  const vendorMap = Object.fromEntries(vendors.map((v) => [v.id, v]));

  const cmpColumns = [
    {
      key: "item_name", label: "Item", primary: true,
      render: (row) => <span className="font-medium">{row.item_name}</span>,
    },
    ...selected.map((po) => ({
      key: `po_${po.id}`,
      headerClassName: "min-w-[180px]",
      label: (
        <div data-testid={`po-cmp-col-${po.id}`}>
          <div className="font-mono">{po.doc_no || po.id.slice(0, 8)}</div>
          <div className="text-[10px] text-muted-foreground normal-case">{vendorMap[po.vendor_id]?.name || po.vendor_id}</div>
        </div>
      ),
      render: (row) => {
        const cell = row.byPo[po.id];
        if (!cell) return <span className="text-xs text-muted-foreground" data-testid={`po-cmp-cell-${row._idx}-${po.id}-empty`}>—</span>;
        const isBest = cell.unit_cost === row._minP && row._priceCount > 1;
        return (
          <div className={cn("rounded-md px-1.5 py-1 -mx-1", isBest && "bg-emerald-500/10")} data-testid={`po-cmp-cell-${row._idx}-${po.id}`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-muted-foreground">{cell.qty} {row.unit}</span>
              <span className={cn("tabular-nums font-semibold", isBest && "text-emerald-600 dark:text-emerald-400")}>
                {fmtRp(cell.unit_cost)}
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground tabular-nums text-right">
              Total: {fmtRp(cell.total)}
            </div>
          </div>
        );
      },
    })),
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-4" data-testid="po-comparison-page">
      <PageHeader
        icon={ShoppingCart}
        title="PO Comparison"
        subtitle="Bandingkan beberapa Purchase Order (max 4)"
      />

      {/* Filters + PO picker */}
      <div className="glass-card p-3 flex flex-wrap gap-2 items-center">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <SimpleSelect
          value={filters.vendor_id}
          onValueChange={(v) => setFilters((f) => ({ ...f, vendor_id: v }))}
          options={[{ value: "", label: "Semua Vendor" }, ...vendors.map((v) => ({ value: v.id, label: v.name }))]}
          placeholder="Semua Vendor"
          className="glass-input rounded-lg h-9 text-sm"
          testId="po-cmp-filter-vendor"
        />
        <SimpleSelect
          value={filters.status}
          onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}
          options={[
            { value: "", label: "Semua Status" },
            { value: "draft", label: "Draft" },
            { value: "approved", label: "Approved" },
            { value: "sent", label: "Sent" },
            { value: "received", label: "Received" },
          ]}
          placeholder="Semua Status"
          className="glass-input rounded-lg h-9 text-sm"
          testId="po-cmp-filter-status"
        />
        <span className="text-xs text-muted-foreground ml-auto">{selected.length}/4 PO dipilih untuk dibandingkan</span>
      </div>

      {/* PO list */}
      <div className="glass-card overflow-hidden" data-testid="po-cmp-list-card">
        <div className="px-4 py-3 border-b border-border/50">
          <h3 className="text-sm font-semibold">Pilih PO</h3>
        </div>
        {loading ? (
          <div className="p-4" data-testid="po-cmp-loading"><LoadingState rows={4} /></div>
        ) : pos.length === 0 ? (
          <div data-testid="po-cmp-empty"><EmptyState icon={ShoppingCart} title="Tidak ada PO" /></div>
        ) : (
          <div className="max-h-[260px] overflow-y-auto divide-y divide-border/30" data-testid="po-cmp-list">
            {pos.map((po) => {
              const isSelected = !!selected.find((p) => p.id === po.id);
              return (
                <div
                  key={po.id}
                  className={`flex items-center justify-between px-4 py-3 hover:bg-foreground/5 ${isSelected ? "bg-primary/5" : ""}`}
                  data-testid={`po-cmp-item-${po.id}`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{po.doc_no || po.id.slice(0, 8)}</span>
                      <StatusPill status={po.status} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {vendorMap[po.vendor_id]?.name || po.vendor_id} • {po.lines?.length || 0} items • {fmtRp(po.grand_total || 0)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{fmtDate(po.order_date || po.po_date || po.created_at)}</div>
                  </div>
                  <Button
                    onClick={() => isSelected ? removeFromCompare(po.id) : addToCompare(po)}
                    variant={isSelected ? "outline" : "default"}
                    size="sm"
                    className="rounded-full text-xs h-8"
                    data-testid={`po-cmp-add-${po.id}`}
                  >
                    {isSelected ? <><X className="h-3 w-3 mr-1" /> Lepas</> : <><Plus className="h-3 w-3 mr-1" /> Bandingkan</>}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Comparison table */}
      {selected.length > 0 && (
        <div className="glass-card overflow-hidden" data-testid="po-cmp-table-card">
          <div className="px-4 py-3 border-b border-border/50">
            <h3 className="text-sm font-semibold">Perbandingan Side-by-Side</h3>
          </div>
          <div data-testid="po-cmp-table-wrap">
            <DataTable
              rows={itemRows}
              keyField="_idx"
              columns={cmpColumns}
              stickyHeader={false}
              rowTestIdPrefix="po-cmp-row"
              empty={<div className="p-6"><EmptyState icon={ShoppingCart} title="Tidak ada item" description="PO terpilih belum memiliki line item." /></div>}
              footer={
                <tr className="bg-foreground/5 font-bold" data-testid="po-cmp-totals-row">
                  <td className="px-4 py-3">Grand Total</td>
                  {selected.map((po) => (
                    <td key={po.id} className="px-4 py-3 text-right tabular-nums" data-testid={`po-cmp-total-${po.id}`}>{fmtRp(po.grand_total || 0)}</td>
                  ))}
                </tr>
              }
            />
          </div>
          <div className="px-4 py-2 border-t border-border/50 text-[10px] text-muted-foreground">
            Cell hijau = harga terbaik untuk item tsb (di antara PO yang dibandingkan).
          </div>
        </div>
      )}
    </div>
  );
}
