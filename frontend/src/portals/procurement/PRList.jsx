/** Purchase Request List + filter. (7E mobile-card polish) */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, FileText, Eye, Download } from "lucide-react";
import { usePaginatedList } from "@/hooks/useListQuery";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { InlineHelp } from "@/components/shared/InlineHelp";
import StatusPill from "@/components/shared/StatusPill";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import { fmtDate, fmtRp } from "@/lib/format";
import useOutletScope from "@/hooks/useOutletScope";
import useExcelExport from "@/hooks/useExcelExport";

const STATUS_TABS = [
  { key: "",          label: "Semua" },
  { key: "draft",     label: "Draft" },
  { key: "submitted", label: "Submitted" },
  { key: "approved",  label: "Approved" },
  { key: "rejected",  label: "Rejected" },
  { key: "converted", label: "Converted" },
];

export default function PRList() {
  const { outletId, setOutletId, scopedOutlets } = useOutletScope();
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [page, setPage] = useState(1);
  const { downloading, exportXlsx } = useExcelExport();

  const filters = useMemo(() => {
    const f = {};
    if (status) f.status = status;
    if (outletId) f.outlet_id = outletId;
    if (source) f.source = source;
    return f;
  }, [status, outletId, source]);

  const { data, isLoading: loading } = usePaginatedList("/procurement/prs", filters, page, 20);
  const items = data?.data || [];
  const meta = data?.meta || { total: 0, per_page: 20 };

  const outletMap = useMemo(
    () => Object.fromEntries(scopedOutlets.map(o => [o.id, o])),
    [scopedOutlets],
  );

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.per_page || 20)));

  return (
    <div className="space-y-4" data-testid="pr-list-page">
      <div className="glass-card p-4" data-testid="pr-filters-card">
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
          <div className="sm:min-w-[180px] flex-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold" htmlFor="pr-outlet">Outlet</Label>
            <SimpleSelect
              value={outletId}
              onValueChange={(v) => { setOutletId(v); setPage(1); }}
              options={[{ value: "", label: "Semua" }, ...scopedOutlets.map(o => ({ value: o.id, label: o.name }))]}
              placeholder="Semua"
              className="glass-input rounded-lg w-full h-10 text-sm mt-1"
              testId="pr-filter-outlet"
            />
          </div>
          <div className="sm:min-w-[150px] flex-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold inline-flex items-center gap-1.5" htmlFor="pr-source">
              Source <InlineHelp id="pr-source" size="xs" placement="top" />
            </Label>
            <SimpleSelect
              value={source}
              onValueChange={(v) => { setSource(v); setPage(1); }}
              options={[
                { value: "", label: "Semua" },
                { value: "manual", label: "Manual" },
                { value: "KDO", label: "KDO" },
                { value: "BDO", label: "BDO" },
              ]}
              placeholder="Semua"
              className="glass-input rounded-lg w-full h-10 text-sm mt-1"
              testId="pr-filter-source"
            />
          </div>
          <Link to="/procurement/pr/new" className="sm:ml-auto">
            <Button className="rounded-full pill-active gap-2 h-10 px-5 w-full sm:w-auto" data-testid="pr-new">
              <Plus className="h-4 w-4" /> PR Baru
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={() => exportXlsx("/procurement/prs/export/xlsx", "purchase_requests.xlsx", { status, outlet_id: outletId, source })}
            disabled={downloading}
            className="rounded-full gap-2 h-10 px-4 w-full sm:w-auto"
            data-testid="pr-export-xlsx"
          >
            <Download className="h-4 w-4" />
            {downloading ? "Mengunduh..." : "Export Excel"}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="Filter status" data-testid="pr-status-tabs">
        {STATUS_TABS.map(t => (
          <button key={t.key || "all"}
            role="tab" aria-selected={status === t.key}
            onClick={() => { setStatus(t.key); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors touch-target ${
              status === t.key ? "pill-active" : "hover:bg-foreground/5 text-muted-foreground"
            }`}
            data-testid={`pr-tab-${t.key || "all"}`}
          >{t.label}</button>
        ))}
      </div>

      <div className="glass-card" data-testid="pr-table-card">
        <DataTable
          columns={[
            {
              key: "doc_no", label: "Doc No", primary: true, sortable: true,
              render: pr => <span className="font-mono text-xs">{pr.doc_no || pr.id.slice(0, 8)}</span>,
            },
            { key: "request_date", label: "Tanggal", sortable: true, render: pr => fmtDate(pr.request_date) },
            { key: "outlet", label: "Outlet", render: pr => outletMap[pr.outlet_id]?.name || pr.outlet_id },
            { key: "source", label: "Source", sortable: true, render: pr => pr.source },
            { key: "lines", label: "Lines", numeric: true, sortable: true, sortAccessor: pr => pr.lines?.length || 0, render: pr => pr.lines?.length || 0 },
            {
              key: "status",
              label: <span className="inline-flex items-center gap-1.5">Status <InlineHelp id="pr-status-workflow" size="xs" placement="top" /></span>,
              render: pr => <StatusPill status={pr.status} />,
            },
          ]}
          rows={items}
          loading={loading}
          defaultSort={{ key: "request_date", dir: "desc" }}
          renderExpanded={(pr) => <PrLinesDrilldown pr={pr} />}
          empty={<EmptyState icon={FileText} title="Belum ada PR" description="Buat PR untuk request item dari outlet/central."
            action={<Link to="/procurement/pr/new"><Button className="pill-active rounded-full" data-testid="pr-empty-new-btn">Buat PR</Button></Link>} />}
          rowAction={(pr) => (
            <Link to={`/procurement/pr/${pr.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" data-testid={`pr-view-${pr.id}`} aria-label={`Lihat detail PR ${pr.doc_no || pr.id}`} onClick={(e) => e.stopPropagation()}>
              <Eye className="h-3.5 w-3.5" /> Detail
            </Link>
          )}
          rowTestIdPrefix="pr"
        />
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground" data-testid="pr-pagination">
            <span data-testid="pr-pagination-total">Total: {meta.total}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded-full glass-input disabled:opacity-50" aria-label="Halaman sebelumnya" data-testid="pr-prev">Prev</button>
              <span className="px-2 py-1" data-testid="pr-page-info">{page}/{totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded-full glass-input disabled:opacity-50" aria-label="Halaman berikutnya" data-testid="pr-next">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PrLinesDrilldown({ pr }) {
  const lines = pr.lines || [];
  if (!lines.length) return <p className="text-sm text-muted-foreground">Tidak ada baris item.</p>;
  return (
    <div className="space-y-2" data-testid={`pr-lines-${pr.id}`}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Baris Item ({lines.length})</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 pr-3 font-medium">Item</th>
              <th className="py-1 pr-3 font-medium text-right">Qty</th>
              <th className="py-1 pr-3 font-medium">Unit</th>
              <th className="py-1 pr-3 font-medium text-right">Est. Harga</th>
              <th className="py-1 pr-3 font-medium text-right">Subtotal</th>
              <th className="py-1 pr-3 font-medium">Catatan</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((ln, i) => (
              <tr key={i} className="border-t border-border/30">
                <td className="py-1.5 pr-3 font-medium">{ln.item_name}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{ln.qty}</td>
                <td className="py-1.5 pr-3 text-muted-foreground">{ln.unit}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{fmtRp(ln.est_cost || 0)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums font-medium">{fmtRp(Number(ln.qty || 0) * Number(ln.est_cost || 0))}</td>
                <td className="py-1.5 pr-3 text-muted-foreground">{ln.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
