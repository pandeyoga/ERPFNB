/** PO List + filter. (7E mobile-card polish; outlet scope: auto-filter for restricted staff) */
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, FileCheck, Eye, Download } from "lucide-react";
import { usePaginatedList } from "@/hooks/useListQuery";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { InlineHelp } from "@/components/shared/InlineHelp";
import StatusPill from "@/components/shared/StatusPill";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import OutletScopePicker from "@/components/shared/OutletScopePicker";
import useOutletScope from "@/hooks/useOutletScope";
import useOutletScopeGuard from "@/hooks/useOutletScopeGuard";
import { fmtRp, fmtDate } from "@/lib/format";
import useExcelExport from "@/hooks/useExcelExport";

const STATUS_TABS = [
  { key: "",          label: "Semua" },
  { key: "draft",     label: "Draft" },
  { key: "sent",      label: "Sent" },
  { key: "partial",   label: "Partial" },
  { key: "received",  label: "Received" },
  { key: "cancelled", label: "Cancelled" },
];

export default function POList() {
  const [searchParams] = useSearchParams();
  const urlOutletId = searchParams.get("outlet_id") || "";

  const { outletId, setOutletId, scopedOutlets, isFullAccess, isRestricted, loaded } = useOutletScope(urlOutletId);
  const [vendors, setVendors] = useState([]);
  const [status, setStatus] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [page, setPage] = useState(1);
  const { downloading, exportXlsx } = useExcelExport();

  // Guard: warn if URL outlet_id is not in user's scope
  useOutletScopeGuard({ requestedOutletId: urlOutletId, setOutletId, scopedOutlets, isRestricted, loaded });

  useEffect(() => {
    api.get("/master/vendors", { params: { per_page: 200 } })
      .then(r => setVendors(unwrap(r) || [])).catch(() => {});
  }, []);

  const filters = useMemo(() => {
    const f = {};
    if (status) f.status = status;
    if (vendorId) f.vendor_id = vendorId;
    if (outletId) f.outlet_id = outletId;
    return f;
  }, [status, vendorId, outletId]);

  const { data, isLoading: loading } = usePaginatedList("/procurement/pos", filters, page, 20);
  const items = data?.data || [];
  const meta = data?.meta || { total: 0, per_page: 20 };

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.per_page || 20)));

  return (
    <div className="space-y-4" data-testid="po-list-page">
      <div className="glass-card p-4" data-testid="po-filters-card">
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
          <div>
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Outlet</Label>
            <div className="mt-1">
              <OutletScopePicker
                value={outletId}
                onChange={(id) => { setOutletId(id); setPage(1); }}
                outlets={scopedOutlets}
                isFullAccess={isFullAccess}
                data-testid="po-filter-outlet"
              />
            </div>
          </div>
          <div className="sm:min-w-[220px] flex-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold" htmlFor="po-vendor">Vendor</Label>
            <SimpleSelect
              value={vendorId}
              onValueChange={(v) => { setVendorId(v); setPage(1); }}
              options={[{ value: "", label: "Semua" }, ...vendors.map(v => ({ value: v.id, label: v.name }))]}
              placeholder="Semua"
              className="glass-input rounded-lg w-full h-10 text-sm mt-1"
              testId="po-filter-vendor"
            />
          </div>
          <Link to="/procurement/po/new" className="sm:ml-auto">
            <Button className="rounded-full pill-active gap-2 h-10 px-5 w-full sm:w-auto" data-testid="po-new">
              <Plus className="h-4 w-4" /> PO Baru
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={() => exportXlsx("/procurement/pos/export/xlsx", "purchase_orders.xlsx", { status, vendor_id: vendorId, outlet_id: outletId })}
            disabled={downloading}
            className="rounded-full gap-2 h-10 px-4 w-full sm:w-auto"
            data-testid="po-export-xlsx"
          >
            <Download className="h-4 w-4" />
            {downloading ? "Mengunduh..." : "Export Excel"}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="Filter status" data-testid="po-status-tabs">
        {STATUS_TABS.map(t => (
          <button key={t.key || "all"}
            role="tab" aria-selected={status === t.key}
            onClick={() => { setStatus(t.key); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors touch-target ${
              status === t.key ? "pill-active" : "hover:bg-foreground/5 text-muted-foreground"
            }`}
            data-testid={`po-tab-${t.key || "all"}`}
          >{t.label}</button>
        ))}
      </div>

      <div className="glass-card" data-testid="po-table-card">
        <DataTable
          columns={[
            {
              key: "doc_no", label: "Doc No", primary: true, sortable: true,
              render: po => <span className="font-mono text-xs">{po.doc_no || po.id.slice(0, 8)}</span>,
            },
            { key: "order_date", label: "Tanggal", sortable: true, render: po => fmtDate(po.order_date) },
            { key: "vendor", label: "Vendor", render: po => vendors.find(x => x.id === po.vendor_id)?.name || po.vendor_id },
            { key: "lines", label: "Lines", numeric: true, sortable: true, sortAccessor: po => po.lines?.length || 0, render: po => po.lines?.length || 0 },
            {
              key: "grand_total", label: "Grand Total", numeric: true, sortable: true,
              render: po => <span className="font-semibold">{fmtRp(po.grand_total || 0)}</span>,
            },
            {
              key: "status",
              label: <span className="inline-flex items-center gap-1.5">Status <InlineHelp id="po-status-workflow" size="xs" placement="top" /></span>,
              render: po => <StatusPill status={po.status} />,
            },
          ]}
          rows={items}
          loading={loading}
          defaultSort={{ key: "order_date", dir: "desc" }}
          renderExpanded={(po) => <PoLinesDrilldown po={po} />}
          empty={<EmptyState icon={FileCheck} title="Belum ada PO" description="Buat PO dari PR yang sudah approved atau langsung."
            action={<Link to="/procurement/po/new"><Button className="pill-active rounded-full" data-testid="po-empty-new-btn">Buat PO</Button></Link>} />}
          rowAction={(po) => (
            <Link to={`/procurement/po/${po.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" data-testid={`po-view-${po.id}`} aria-label={`Lihat detail PO ${po.doc_no || po.id}`} onClick={(e) => e.stopPropagation()}>
              <Eye className="h-3.5 w-3.5" /> Detail
            </Link>
          )}
          rowTestIdPrefix="po"
        />
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground" data-testid="po-pagination">
            <span data-testid="po-pagination-total">Total: {meta.total}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded-full glass-input disabled:opacity-50" aria-label="Halaman sebelumnya" data-testid="po-prev">Prev</button>
              <span className="px-2 py-1" data-testid="po-page-info">{page}/{totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded-full glass-input disabled:opacity-50" aria-label="Halaman berikutnya" data-testid="po-next">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PoLinesDrilldown({ po }) {
  const lines = po.lines || [];
  if (!lines.length) return <p className="text-sm text-muted-foreground">Tidak ada baris item.</p>;
  return (
    <div className="space-y-2" data-testid={`po-lines-${po.id}`}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Baris Item ({lines.length})</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 pr-3 font-medium">Item</th>
              <th className="py-1 pr-3 font-medium text-right">Qty</th>
              <th className="py-1 pr-3 font-medium">Unit</th>
              <th className="py-1 pr-3 font-medium text-right">Harga Satuan</th>
              <th className="py-1 pr-3 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((ln, i) => (
              <tr key={i} className="border-t border-border/30">
                <td className="py-1.5 pr-3 font-medium">{ln.item_name}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{ln.qty}</td>
                <td className="py-1.5 pr-3 text-muted-foreground">{ln.unit}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{fmtRp(ln.unit_cost || 0)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums font-medium">{fmtRp(ln.total || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
