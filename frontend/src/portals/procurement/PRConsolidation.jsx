/** Procurement → PR Consolidation
 * Multi-PR aggregation: filter PRs (status=approved, vendor, period),
 * select multiple, group by item, generate consolidated PO draft.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, ShoppingCart, CheckSquare, Square, ArrowRight, Package } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import PageHeader from "@/components/shared/PageHeader";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import StatusPill from "@/components/shared/StatusPill";
import { Button } from "@/components/ui/button";
import SimpleSelect from "@/components/shared/SimpleSelect";
import DataTable from "@/components/shared/DataTable";
import { fmtRp, fmtDate, fmtNumber } from "@/lib/format";
import { toast } from "sonner";
import useOutletScope from "@/hooks/useOutletScope";

/** Harga baris PR disimpan sebagai `est_cost` (lihat PRForm); `unit_cost` hanya fallback data lama.
 *  Sebelumnya hanya `unit_cost` yang dibaca → total & harga PO hasil konsolidasi selalu Rp 0. */
const lineCost = (ln) => Number(ln.est_cost ?? ln.unit_cost ?? 0);

export default function PRConsolidation() {
  const navigate = useNavigate();
  const { scopedOutlets, allOutlets } = useOutletScope();
  const outlets = scopedOutlets.length > 0 ? scopedOutlets : allOutlets;
  const [prs, setPrs] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: "approved", outlet_id: "" });
  const [selectedIds, setSelectedIds] = useState(new Set());

  async function load() {
    setLoading(true);
    try {
      const pRes = await api.get("/procurement/prs", { params: { ...filters, per_page: 100 } });
      setPrs(unwrap(pRes) || []);
    } catch (e) {
      toast.error("Gagal memuat PR");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filters.status, filters.outlet_id]);

  function toggle(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (selectedIds.size === prs.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(prs.map((p) => p.id)));
  }

  // Aggregate selected PRs by item
  const consolidated = useMemo(() => {
    const selected = prs.filter((p) => selectedIds.has(p.id));
    const byItem = {};
    for (const p of selected) {
      for (const ln of p.lines || []) {
        const k = ln.item_id || ln.item_name;
        if (!byItem[k]) {
          byItem[k] = {
            item_id: ln.item_id,
            item_name: ln.item_name,
            unit: ln.unit,
            qty: 0,
            total_cost: 0,
            sources: [],
          };
        }
        byItem[k].qty += Number(ln.qty || 0);
        byItem[k].total_cost += Number(ln.qty || 0) * lineCost(ln);
        byItem[k].sources.push({ pr_doc: p.doc_no, pr_id: p.id, qty: ln.qty, outlet: p.outlet_id });
      }
    }
    return Object.values(byItem);
  }, [prs, selectedIds]);

  const grandTotal = consolidated.reduce((s, c) => s + c.total_cost, 0);
  const outletMap = Object.fromEntries(outlets.map((o) => [o.id, o]));

  function generatePO() {
    if (consolidated.length === 0) {
      toast.error("Pilih minimal 1 PR untuk konsolidasi.");
      return;
    }
    const payload = {
      source: "consolidation",
      lines: consolidated.map((c) => ({
        item_id: c.item_id,
        item_name: c.item_name,
        qty: c.qty,
        unit: c.unit,
        unit_cost: c.qty > 0 ? c.total_cost / c.qty : 0,
      })),
      pr_ids: Array.from(selectedIds),
      note: `Konsolidasi dari ${selectedIds.size} PR.`,
    };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    navigate(`/procurement/po/new?prefill=${encoded}`);
  }

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="pr-consolidation-page">
      <PageHeader
        icon={ClipboardList}
        title="PR Consolidation"
        subtitle="Gabungkan beberapa Purchase Request menjadi satu PO — item yang sama dijumlahkan otomatis."
        actions={
          <Button onClick={generatePO} disabled={consolidated.length === 0} data-testid="cons-generate-po">
            {selectedIds.size > 0 ? `Buat PO dari ${selectedIds.size} PR` : "Buat PO"} <ArrowRight />
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center" data-testid="cons-filters">
        <SimpleSelect
          value={filters.status}
          onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}
          options={[
            { value: "approved", label: "Disetujui" },
            { value: "submitted", label: "Diajukan" },
            { value: "", label: "Semua status" },
          ]}
          placeholder="Semua status"
          ariaLabel="Filter status"
          className="glass-input w-[160px]"
          testId="cons-filter-status"
        />
        <SimpleSelect
          value={filters.outlet_id}
          onValueChange={(v) => setFilters((f) => ({ ...f, outlet_id: v }))}
          options={[{ value: "", label: "Semua outlet" }, ...outlets.map(o => ({ value: o.id, label: o.name }))]}
          placeholder="Semua outlet"
          ariaLabel="Filter outlet"
          className="glass-input w-[180px]"
          testId="cons-filter-outlet"
        />
        <span className="text-xs text-muted-foreground ml-auto" data-testid="cons-pr-count">{prs.length} PR</span>
      </div>

      {/* Grid: PR list + Consolidated preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
        {/* PR List */}
        <div className="glass-card overflow-hidden" data-testid="cons-pr-list-card">
          <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
            <h3 className="text-sm md:text-base font-semibold flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> Purchase Requests
            </h3>
            <Button variant="ghost" size="sm" onClick={toggleAll} disabled={prs.length === 0} data-testid="cons-toggle-all">
              {selectedIds.size === prs.length && prs.length > 0 ? <CheckSquare /> : <Square />}
              {selectedIds.size === prs.length && prs.length > 0 ? "Batal pilih semua" : "Pilih semua"}
            </Button>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            {loading ? (
              <div className="p-4" data-testid="cons-loading"><LoadingState rows={4} /></div>
            ) : prs.length === 0 ? (
              <div data-testid="cons-empty"><EmptyState icon={ClipboardList} title="Tidak ada PR" description="Coba ubah filter status atau outlet." /></div>
            ) : (
              <div className="divide-y divide-border/30" data-testid="cons-pr-list">
                {prs.map((p) => {
                  const checked = selectedIds.has(p.id);
                  const total = (p.lines || []).reduce((s, l) => s + Number(l.qty || 0) * lineCost(l), 0);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() => toggle(p.id)}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-foreground/5 ${checked ? "bg-primary/5" : ""}`}
                      data-testid={`cons-pr-row-${p.id}`}
                    >
                      {checked ? <CheckSquare className="h-4 w-4 text-primary mt-0.5" /> : <Square className="h-4 w-4 text-muted-foreground mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs" data-testid={`cons-pr-doc-${p.id}`}>{p.doc_no || p.id.slice(0, 8)}</span>
                          <StatusPill status={p.status} />
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {outletMap[p.outlet_id]?.name || "—"} · {p.lines?.length || 0} item · {fmtRp(total)}
                        </div>
                        <div className="text-xs text-muted-foreground">{fmtDate(p.request_date || p.created_at)}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Consolidated preview */}
        <div className="glass-card overflow-hidden" data-testid="cons-preview-card">
          <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
            <h3 className="text-sm md:text-base font-semibold flex items-center gap-2">
              <Package className="h-4 w-4" /> Hasil konsolidasi (<span data-testid="cons-unique-count">{consolidated.length}</span> item unik)
            </h3>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            {consolidated.length === 0 ? (
              <div data-testid="cons-preview-empty"><EmptyState icon={ShoppingCart} title="Belum ada PR yang dipilih" description="Pilih beberapa PR di kolom kiri untuk melihat konsolidasi item." /></div>
            ) : (
              <DataTable
                rows={consolidated.map((c, i) => ({ ...c, _idx: i }))}
                keyField="_idx"
                stickyHeader={false}
                rowTestIdPrefix="cons-preview-row"
                columns={[
                  { key: "item_name", label: "Item", primary: true, sortable: true,
                    render: (c) => c.item_name },
                  { key: "qty", label: "Qty", numeric: true, sortable: true,
                    render: (c) => <span>{fmtNumber(c.qty)} {c.unit}</span> },
                  { key: "total_cost", label: "Subtotal", numeric: true, sortable: true,
                    render: (c) => <span className="font-semibold">{fmtRp(c.total_cost)}</span> },
                  { key: "sources", label: "Sumber",
                    render: (c) => (
                      <span className="text-xs text-muted-foreground">
                        {c.sources.slice(0, 3).map((s) => s.pr_doc).join(", ")}
                        {c.sources.length > 3 && ` +${c.sources.length - 3}`}
                      </span>
                    ) },
                ]}
                footer={
                  <tr className="bg-foreground/5 font-semibold" data-testid="cons-preview-totals-row">
                    <td colSpan={2} className="px-4 py-2.5 text-right">Grand Total</td>
                    <td className="px-4 py-2.5 text-right tabular-nums" data-testid="cons-grand-total">{fmtRp(grandTotal)}</td>
                    <td></td>
                  </tr>
                }
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
