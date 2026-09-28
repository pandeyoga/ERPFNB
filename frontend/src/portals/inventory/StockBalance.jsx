/** Stock Balance — list aggregated per item per outlet.
 *  Phase 9C: List ↔ Matrix view toggle.
 */
import { useEffect, useMemo, useState } from "react";
import { Search, List as ListIcon, Layers } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SimpleSelect from "@/components/shared/SimpleSelect";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import { fmtRp, fmtNumber, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import StockBalanceMatrix from "./StockBalanceMatrix";
import useOutletScope from "@/hooks/useOutletScope";
import { InlineHelp } from "@/components/shared/InlineHelp";

export default function StockBalance() {
  const [view, setView] = useState(() => localStorage.getItem("inv-bal-view") || "list");
  useEffect(() => { localStorage.setItem("inv-bal-view", view); }, [view]);

  return (
    <div className="space-y-4" data-testid="stock-balance-page">
      <div className="flex items-center gap-2" data-testid="bal-view-toggle">
        <button
          type="button"
          onClick={() => setView("list")}
          className={`text-xs px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 border transition-colors ${
            view === "list"
              ? "bg-foreground text-background border-foreground"
              : "bg-background hover:bg-foreground/5 border-border/60"
          }`}
          data-testid="bal-view-list"
        >
          <ListIcon className="h-3.5 w-3.5" /> List
        </button>
        <button
          type="button"
          onClick={() => setView("matrix")}
          className={`text-xs px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 border transition-colors ${
            view === "matrix"
              ? "bg-foreground text-background border-foreground"
              : "bg-background hover:bg-foreground/5 border-border/60"
          }`}
          data-testid="bal-view-matrix"
        >
          <Layers className="h-3.5 w-3.5" /> Matrix
        </button>
        <span className="text-xs text-muted-foreground ml-2 inline-flex items-center gap-1.5">
          {view === "matrix" ? "Pivot view: Item × Outlet dengan heatmap par-level" : "List view: per item × outlet"}
          <InlineHelp id="stock-balance-view" size="xs" placement="right" />
        </span>
      </div>

      {view === "matrix" ? <StockBalanceMatrix /> : <StockBalanceList />}
    </div>
  );
}

function StockBalanceList() {
  const { outletId, setOutletId, scopedOutlets, allOutlets } = useOutletScope();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, per_page: 100 });

  const outletMap = useMemo(
    () => Object.fromEntries(allOutlets.map(o => [o.id, o])),
    [allOutlets],
  );

  async function load() {
    setLoading(true);
    try {
      const params = { page, per_page: 100 };
      if (outletId) params.outlet_id = outletId;
      const res = await api.get("/inventory/balance", { params });
      setRows(unwrap(res) || []);
      setMeta(res.data?.meta || {});
    } catch (e) {
      toast.error("Gagal load stock");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [page, outletId]); // eslint-disable-line

  const filtered = useMemo(() => {
    if (!q) return rows;
    const s = q.toLowerCase();
    return rows.filter(r =>
      (r.item_name || "").toLowerCase().includes(s) ||
      (r.item_id || "").toLowerCase().includes(s),
    );
  }, [q, rows]);

  return (
    <div className="space-y-4" data-testid="stock-balance-list">
      <div className="glass-card p-4 flex flex-wrap gap-3 items-end" data-testid="bal-filters">
        <div className="min-w-[200px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Outlet</Label>
          <SimpleSelect
            value={outletId}
            onValueChange={v => { setOutletId(v); setPage(1); }}
            options={[{ value: "", label: "Semua" }, ...scopedOutlets.map(o => ({ value: o.id, label: o.name }))]}
            placeholder="Semua"
            className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1"
            testId="inv-bal-outlet"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Cari Item</Label>
          <div className="relative mt-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nama item…" className="glass-input pl-9 h-9" data-testid="inv-bal-search" />
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden" data-testid="bal-table-card">
        <DataTable
          columns={[
            { key: "item_name", label: "Item", primary: true, sortable: true, sortAccessor: r => r.item_name || r.item_id || "",
              render: r => <span className="font-medium">{r.item_name || r.item_id}</span> },
            { key: "outlet", label: "Outlet", render: r => outletMap[r.outlet_id]?.name || r.outlet_id },
            { key: "qty", label: "Qty", help: <InlineHelp id="stock-negative" size="xs" placement="top" />,
              numeric: true, sortable: true, sortAccessor: r => r.qty || 0,
              render: r => <span className={cnQty(r.qty)}>{fmtNumber(r.qty, 2)}</span> },
            { key: "unit", label: "Unit", render: r => <span className="text-muted-foreground">{r.unit || "—"}</span> },
            { key: "last_unit_cost", label: "Last Cost", numeric: true, sortable: true, sortAccessor: r => r.last_unit_cost || 0,
              render: r => fmtRp(r.last_unit_cost || 0) },
            { key: "total_value", label: "Total Value", help: <InlineHelp id="moving-avg" size="xs" placement="top-end" />,
              numeric: true, sortable: true, sortAccessor: r => r.total_value || 0,
              render: r => fmtRp(r.total_value || 0) },
            { key: "last_movement_at", label: "Last Move", render: r => <span className="text-xs text-muted-foreground">{r.last_movement_at || "—"}</span> },
          ]}
          rows={filtered.map(r => ({ ...r, _key: `${r.item_id}-${r.outlet_id}` }))}
          keyField="_key"
          loading={loading}
          rowTestIdPrefix="bal-row"
          defaultSort={{ key: "total_value", dir: "desc" }}
          renderExpanded={(r) => <StockMovesDrilldown r={r} />}
          empty={<EmptyState title="Belum ada stok" description="Posting GR atau adjustment untuk menambah stok." />}
        />
      </div>
    </div>
  );
}

function cnQty(qty) {
  return `tabular-nums font-semibold ${qty < 0 ? "text-red-700 dark:text-red-400" : ""}`;
}

function StockMovesDrilldown({ r }) {
  const [moves, setMoves] = useState(null);
  const [loadingD, setLoadingD] = useState(true);
  useEffect(() => {
    let active = true;
    api.get("/inventory/movements", { params: { item_id: r.item_id, outlet_id: r.outlet_id, per_page: 8 } })
      .then(res => { if (active) setMoves(unwrap(res) || []); })
      .catch(() => { if (active) setMoves([]); })
      .finally(() => { if (active) setLoadingD(false); });
    return () => { active = false; };
  }, [r.item_id, r.outlet_id]);
  if (loadingD) return <div className="text-xs text-muted-foreground py-2">Memuat pergerakan…</div>;
  if (!moves?.length) return <p className="text-sm text-muted-foreground">Belum ada pergerakan stok untuk item ini.</p>;
  return (
    <div className="space-y-2" data-testid={`bal-moves-${r.item_id}-${r.outlet_id}`}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Pergerakan Terakhir ({moves.length})</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 pr-3 font-medium">Tanggal</th>
              <th className="py-1 pr-3 font-medium">Type</th>
              <th className="py-1 pr-3 font-medium text-right">Qty</th>
              <th className="py-1 pr-3 font-medium text-right">Unit Cost</th>
              <th className="py-1 pr-3 font-medium">Ref</th>
            </tr>
          </thead>
          <tbody>
            {moves.map((m, i) => (
              <tr key={m.id || i} className="border-t border-border/30">
                <td className="py-1.5 pr-3">{fmtDate(m.movement_date)}</td>
                <td className="py-1.5 pr-3 capitalize">{(m.movement_type || m.type || "").replace("_", " ")}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{fmtNumber(m.qty || 0, 2)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{fmtRp(m.unit_cost || 0)}</td>
                <td className="py-1.5 pr-3 font-mono text-muted-foreground">{m.ref_doc_no || m.ref_type || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
