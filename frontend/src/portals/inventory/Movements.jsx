/** Movements — history list with filters. */
import { useEffect, useMemo, useState } from "react";
import api, { unwrap } from "@/lib/api";
import { Label } from "@/components/ui/label";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { Input } from "@/components/ui/input";
import { InlineHelp } from "@/components/shared/InlineHelp";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import { fmtRp, fmtNumber, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import useOutletScope from "@/hooks/useOutletScope";

const TYPE_OPTIONS = [
  { v: "",            l: "Semua" },
  { v: "receipt",     l: "Receipt" },
  { v: "transfer_in", l: "Transfer In" },
  { v: "transfer_out",l: "Transfer Out" },
  { v: "adjustment",  l: "Adjustment" },
  { v: "opname_diff", l: "Opname Diff" },
  { v: "issue",       l: "Issue" },
];

export default function Movements() {
  const { outletId, setOutletId, scopedOutlets, allOutlets } = useOutletScope();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, per_page: 50 });

  const outletMap = useMemo(
    () => Object.fromEntries(allOutlets.map(o => [o.id, o])),
    [allOutlets],
  );

  async function load() {
    setLoading(true);
    try {
      const params = { page, per_page: 50 };
      if (outletId) params.outlet_id = outletId;      if (type) params.movement_type = type;
      if (dateFrom) params.date_from = dateFrom;
      const res = await api.get("/inventory/movements", { params });
      setItems(unwrap(res) || []);
      setMeta(res.data?.meta || {});
    } catch (e) {
      toast.error("Gagal load movements");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [page, outletId, type, dateFrom]); // eslint-disable-line

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.per_page || 50)));

  return (
    <div className="space-y-4" data-testid="inventory-movements-page">
      <div className="glass-card p-4 flex flex-wrap gap-3 items-end" data-testid="movements-filters">
        <div className="min-w-[180px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Outlet</Label>
          <SimpleSelect
            value={outletId}
            onValueChange={v => { setOutletId(v); setPage(1); }}
            options={[{ value: "", label: "Semua" }, ...scopedOutlets.map(o => ({ value: o.id, label: o.name }))]}
            placeholder="Semua"
            className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1"
            testId="movements-filter-outlet"
          />
        </div>
        <div className="min-w-[160px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold inline-flex items-center gap-1.5">
            Type <InlineHelp id="movement-types" size="xs" placement="top" />
          </Label>
          <SimpleSelect
            value={type}
            onValueChange={v => { setType(v); setPage(1); }}
            options={TYPE_OPTIONS.map(t => ({ value: t.v, label: t.l }))}
            className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1"
            testId="movements-filter-type"
          />
        </div>
        <div className="min-w-[160px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Sejak Tanggal</Label>
          <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
            className="glass-input mt-1 h-9" data-testid="movements-filter-date" />
        </div>
      </div>

      <div className="glass-card overflow-hidden" data-testid="movements-table-card">
        <DataTable
          columns={[
            { key: "movement_date", label: "Tanggal", sortable: true, render: m => fmtDate(m.movement_date) },
            { key: "outlet", label: "Outlet", render: m => outletMap[m.outlet_id]?.name || m.outlet_id },
            { key: "item_name", label: "Item", primary: true, sortable: true, sortAccessor: m => m.item_name || m.item_id || "",
              render: m => <span className="font-medium" data-testid={`movement-item-${m.id}`}>{m.item_name || m.item_id}</span> },
            { key: "movement_type", label: "Type", sortable: true,
              render: m => <span className="capitalize" data-testid={`movement-type-${m.id}`}>{(m.movement_type || "").replace("_", " ")}</span> },
            { key: "qty", label: "Qty", numeric: true, sortable: true, sortAccessor: m => m.qty || 0,
              render: m => <span className={m.qty > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"} data-testid={`movement-qty-${m.id}`}>{m.qty > 0 ? "+" : ""}{fmtNumber(m.qty, 2)} {m.unit}</span> },
            { key: "unit_cost", label: "Unit Cost", numeric: true, sortable: true, sortAccessor: m => m.unit_cost || 0, render: m => fmtRp(m.unit_cost || 0) },
            { key: "total_cost", label: "Total Cost", numeric: true, sortable: true, sortAccessor: m => m.total_cost || 0,
              render: m => <span data-testid={`movement-total-${m.id}`}>{fmtRp(m.total_cost || 0)}</span> },
            { key: "ref_type", label: "Ref", render: m => <span className="text-xs text-muted-foreground capitalize">{m.ref_type || "—"}</span> },
          ]}
          rows={items}
          loading={loading}
          rowTestIdPrefix="movement-row"
          defaultSort={{ key: "movement_date", dir: "desc" }}
          empty={<EmptyState title="Belum ada movement" />}
        />
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground" data-testid="movements-pagination">
            <span data-testid="movements-pagination-total">Total: {meta.total}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded-full glass-input disabled:opacity-50" data-testid="movements-prev">Prev</button>
              <span className="px-2 py-1" data-testid="movements-page-info">{page}/{totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded-full glass-input disabled:opacity-50" data-testid="movements-next">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

