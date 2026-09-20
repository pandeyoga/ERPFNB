/** Phase 9C — Stock Balance Matrix view (item × outlet pivot).
 *
 * Migrated 2026-06-17 to the shared DataTable primitive (sticky header,
 * responsive, built-in loading/empty). Heatmap cell coloring preserved via a
 * memoized cell renderer; totals rendered in the DataTable footer.
 *
 * - Heatmap coloring: red=below par, amber=zero, emerald=above par, gray=no par
 * - Cell click → modal with last 30 movements for that (item, outlet)
 * - Outlet Scope: restricted users see only their outlets pre-selected
 */
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Search, X, AlertTriangle, ArrowUpRight } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import DataTable from "@/components/shared/DataTable";
import useOutletScope from "@/hooks/useOutletScope";
import { fmtRp, fmtNumber } from "@/lib/format";
import { toast } from "sonner";
import { Link } from "react-router-dom";

function cellClasses(cell) {
  if (cell.negative) return "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30";
  if (cell.below_par && cell.par_level > 0) return "bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/30";
  if (cell.zero) return "bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/30";
  if (cell.par_level > 0 && cell.qty >= cell.par_level * 1.5) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
  if (cell.par_level > 0) return "bg-emerald-500/8 text-emerald-700 dark:text-emerald-300 border-emerald-500/20";
  return "bg-foreground/5 text-foreground/60 border-border/40";
}

/* ----------------------- Cell movements dialog ----------------------- */
function CellMovementsDialog({ open, onClose, itemName, outletName, itemId, outletId }) {
  const [moves, setMoves] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !itemId || !outletId) return;
    setLoading(true);
    api.get("/inventory/movements/cell", {
      params: { item_id: itemId, outlet_id: outletId, limit: 30 },
    })
      .then(r => setMoves(unwrap(r) || []))
      .catch(() => toast.error("Gagal load movements"))
      .finally(() => setLoading(false));
  }, [open, itemId, outletId]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="glass-card max-w-3xl" data-testid="matrix-cell-dialog">
        <DialogHeader>
          <DialogTitle className="text-base">
            Riwayat: {itemName} · <span className="text-muted-foreground">{outletName}</span>
          </DialogTitle>
          <DialogDescription>
            30 movement terakhir untuk kombinasi item × outlet ini.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto -mx-2 px-2">
          {loading && <LoadingState rows={4} />}
          {!loading && moves.length === 0 && (
            <EmptyState title="Belum ada riwayat" description="Belum ada movement untuk cell ini." />
          )}
          {!loading && moves.length > 0 && (
            <DataTable
              rows={moves}
              keyField="id"
              rowTestIdPrefix="matrix-move"
              columns={[
                { key: "movement_date", label: "Tanggal", primary: true,
                  render: (m) => <span className="text-xs">{m.movement_date || "—"}</span> },
                { key: "movement_type", label: "Tipe",
                  render: (m) => (
                    <span className="text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 bg-foreground/10">
                      {m.movement_type || "—"}
                    </span>
                  ) },
                { key: "qty", label: "Qty", numeric: true,
                  render: (m) => (
                    <span className={m.qty < 0 ? "text-rose-700 dark:text-rose-300 font-semibold" : "text-emerald-700 dark:text-emerald-300 font-semibold"}>
                      {fmtNumber(m.qty, 2)}
                    </span>
                  ) },
                { key: "unit_cost", label: "Unit Cost", numeric: true, render: (m) => fmtRp(m.unit_cost) },
                { key: "total_cost", label: "Value", numeric: true, render: (m) => fmtRp(m.total_cost) },
                { key: "source", label: "Source",
                  render: (m) => (
                    <span className="text-xs text-muted-foreground truncate max-w-[180px] inline-block align-top">
                      {m.source_doc_no || m.source_type || "—"}
                    </span>
                  ) },
              ]}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------- Memoized heatmap cell ----------------------- */
const MatrixCell = memo(function MatrixCell({ rowId, cell, onClick }) {
  const handleClick = useCallback(() => onClick(rowId, cell), [rowId, cell, onClick]);
  return (
    <button
      type="button"
      onClick={handleClick}
      className={`w-full inline-flex flex-col items-center gap-0.5 px-2 py-1.5 rounded border text-[11px] tabular-nums font-semibold hover:scale-[1.02] transition-transform ${cellClasses(cell)}`}
      title={`Par: ${cell.par_level || 0} (${cell.par_source}) · klik untuk lihat riwayat`}
      data-testid={`matrix-cell-${rowId}-${cell.outlet_id}`}
    >
      <span>{fmtNumber(cell.qty, cell.qty % 1 === 0 ? 0 : 1)}</span>
      {cell.par_level > 0 && (
        <span className="text-[9px] font-normal opacity-70">par {fmtNumber(cell.par_level, 0)}</span>
      )}
    </button>
  );
});

/* ----------------------- Page ----------------------- */
export default function StockBalanceMatrix() {
  const { allOutlets, scopedOutlets, isRestricted } = useOutletScope();
  const [matrix, setMatrix] = useState({ outlets: [], rows: [], totals: { by_outlet: {}, grand_total_value: 0 } });
  const [loading, setLoading] = useState(true);
  const [selectedOutlets, setSelectedOutlets] = useState([]);
  const [outletList, setOutletList] = useState([]);
  const [search, setSearch] = useState("");
  const [includeZero, setIncludeZero] = useState(true);
  const [cellOpen, setCellOpen] = useState(false);
  const [cellCtx, setCellCtx] = useState(null);

  useEffect(() => { setOutletList(allOutlets); }, [allOutlets]);

  useEffect(() => {
    if (isRestricted && scopedOutlets.length > 0 && selectedOutlets.length === 0) {
      setSelectedOutlets(scopedOutlets.map(o => o.id));
    }
  }, [isRestricted, scopedOutlets]); // eslint-disable-line

  const load = useCallback(async (q) => {
    setLoading(true);
    try {
      const params = { include_zero: includeZero, days_for_par: 30, par_buffer_days: 7 };
      if (selectedOutlets.length) params.outlet_ids = selectedOutlets.join(",");
      if (q && q.trim()) params.search = q.trim();
      const res = await api.get("/inventory/balance-matrix", { params });
      setMatrix(unwrap(res) || { outlets: [], rows: [] });
    } catch (e) {
      toast.error("Gagal load matrix");
    } finally { setLoading(false); }
  }, [selectedOutlets, includeZero]);

  // Initial load when filters change
  useEffect(() => { load(search); }, [selectedOutlets, includeZero]); // eslint-disable-line

  // Debounced search (350ms)
  useEffect(() => {
    const t = setTimeout(() => { load(search); }, 350);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line

  function toggleOutlet(id) {
    setSelectedOutlets((cur) =>
      cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]
    );
  }

  // Stable callback so MatrixCell stays memoized across re-renders
  const openCell = useCallback((itemId, cell) => {
    const row = matrix.rows.find(r => r.item_id === itemId);
    setCellCtx({
      itemId,
      itemName: row?.item_name || itemId,
      outletId: cell.outlet_id,
      outletName: matrix.outlets.find(o => o.id === cell.outlet_id)?.name || "Outlet",
    });
    setCellOpen(true);
  }, [matrix.rows, matrix.outlets]);

  const belowParCount = useMemo(() => {
    let n = 0;
    matrix.rows.forEach(r => r.cells.forEach(c => {
      if (c.below_par || c.negative) n++;
    }));
    return n;
  }, [matrix.rows]);

  const columns = useMemo(() => [
    { key: "item", label: "Item", primary: true,
      render: (row) => (
        <div data-testid={`matrix-row-${row.item_id}`}>
          <div className="font-medium text-sm">{row.item_name}</div>
          <div className="text-[10px] text-muted-foreground">{row.item_code} · {row.unit}</div>
        </div>
      ) },
    ...matrix.outlets.map((o) => ({
      key: `outlet_${o.id}`, label: o.name, align: "center",
      render: (row) => {
        const cell = row.cells.find(c => c.outlet_id === o.id);
        return cell
          ? <MatrixCell rowId={row.item_id} cell={cell} onClick={openCell} />
          : <span className="text-muted-foreground">—</span>;
      },
    })),
    { key: "total_value", label: "Total Value", numeric: true,
      render: (row) => <span className="font-semibold text-xs">{fmtRp(row.totals.value)}</span> },
  ], [matrix.outlets, openCell]);

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 flex flex-wrap gap-3 items-end" data-testid="matrix-toolbar">
        <div className="min-w-[260px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Outlet (multi-pilih)</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {outletList.map(o => (
              <button
                key={o.id}
                type="button"
                onClick={() => toggleOutlet(o.id)}
                className={`text-xs px-2.5 py-1 rounded-full border ${
                  selectedOutlets.includes(o.id)
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background hover:bg-foreground/5 border-border/60"
                }`}
                data-testid={`matrix-outlet-${o.id}`}
              >
                {o.name}
              </button>
            ))}
            {selectedOutlets.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedOutlets([])}
                className="text-xs px-2 py-1 text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Reset
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-[220px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Cari Item</Label>
          <div className="relative mt-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama / kode…" className="glass-input pl-9 h-9"
              data-testid="matrix-search" />
          </div>
        </div>
        <div>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input type="checkbox" checked={includeZero}
              onChange={e => setIncludeZero(e.target.checked)}
              data-testid="matrix-include-zero" />
            <span>Tampilkan item qty=0</span>
          </label>
        </div>
        {belowParCount > 0 && (
          <Link to="/inventory/low-stock"
            className="text-xs px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 inline-flex items-center gap-1.5"
            data-testid="matrix-low-link">
            <AlertTriangle className="h-3 w-3" />
            {belowParCount} cell di bawah par
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      <div className="glass-card overflow-hidden" data-testid="matrix-card">
        <DataTable
          rows={matrix.rows}
          keyField="item_id"
          loading={loading}
          rowTestIdPrefix="matrix-row-data"
          empty={<EmptyState title="Tidak ada data" description="Coba ubah filter outlet atau pencarian." />}
          columns={columns}
          footer={matrix.rows.length > 0 ? (
            <tr className="bg-foreground/5 font-semibold">
              <td className="px-3 py-2 text-xs uppercase tracking-wide">Total</td>
              {matrix.outlets.map(o => {
                const t = matrix.totals.by_outlet[o.id] || {};
                return (
                  <td key={o.id} className="px-2 py-2 text-center text-[11px] tabular-nums">
                    <div className="text-xs">{fmtNumber(t.qty || 0, 0)}</div>
                    <div className="text-[10px] text-muted-foreground">{fmtRp(t.value || 0)}</div>
                  </td>
                );
              })}
              <td className="px-3 py-2 text-right tabular-nums text-sm">
                {fmtRp(matrix.totals.grand_total_value || 0)}
              </td>
            </tr>
          ) : null}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 px-1 text-[11px] text-muted-foreground">
        <span className="font-semibold">Legend:</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-rose-500/30 border border-rose-500/40" /> Di bawah par / negatif
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-amber-500/30 border border-amber-500/40" /> Qty = 0
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500/40" /> Aman
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-foreground/15 border border-border/40" /> Tidak ada par
        </span>
      </div>

      <CellMovementsDialog
        open={cellOpen}
        onClose={(open) => { if (!open) setCellOpen(false); }}
        itemId={cellCtx?.itemId}
        itemName={cellCtx?.itemName}
        outletId={cellCtx?.outletId}
        outletName={cellCtx?.outletName}
      />
    </div>
  );
}
