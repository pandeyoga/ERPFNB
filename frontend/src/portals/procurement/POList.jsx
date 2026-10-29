/** Purchase Orders — daftar PO + filter. (7E mobile-card polish; outlet scope: auto-filter for restricted staff)
 *  ?status=<key> / ?outlet_id=<id> di URL memilih filter awal. */
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, FileCheck, Eye, Download, Scale } from "lucide-react";
import { usePaginatedList } from "@/hooks/useListQuery";
import { unwrap, fetchAll } from "@/lib/api";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/shared/PageHeader";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { InlineHelp } from "@/components/shared/InlineHelp";
import StatusPill from "@/components/shared/StatusPill";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import ListToolbar, { StatusTabs } from "@/components/shared/ListToolbar";
import OutletScopePicker from "@/components/shared/OutletScopePicker";
import useOutletScope from "@/hooks/useOutletScope";
import useOutletScopeGuard from "@/hooks/useOutletScopeGuard";
import { fmtRp, fmtDate } from "@/lib/format";
import useExcelExport from "@/hooks/useExcelExport";

const STATUS_TABS = [
  { key: "all",               label: "Semua" },
  { key: "draft",             label: "Draft" },
  { key: "awaiting_approval", label: "Menunggu Approval" },
  { key: "approved",          label: "Disetujui" },
  { key: "sent",              label: "Terkirim" },
  { key: "partial",           label: "Partial" },
  { key: "received",          label: "Diterima" },
  { key: "cancelled",         label: "Dibatalkan" },
];

export default function POList() {
  const [searchParams] = useSearchParams();
  const urlOutletId = searchParams.get("outlet_id") || "";

  const { outletId, setOutletId, scopedOutlets, isFullAccess, isRestricted, loaded } = useOutletScope(urlOutletId);
  const [vendors, setVendors] = useState([]);
  const [status, setStatus] = useState(() => {
    const s = searchParams.get("status") || "";
    return STATUS_TABS.some(t => t.key === s) ? s : "";
  });
  const [vendorId, setVendorId] = useState("");
  const [page, setPage] = useState(1);
  const { downloading, exportXlsx } = useExcelExport();

  // Guard: warn if URL outlet_id is not in user's scope
  useOutletScopeGuard({ requestedOutletId: urlOutletId, setOutletId, scopedOutlets, isRestricted, loaded });

  useEffect(() => {
    fetchAll("/master/vendors")
      .then(r => setVendors(unwrap(r) || [])).catch(() => {});
  }, []);

  const filters = useMemo(() => {
    const f = {};
    if (status) f.status = status;
    if (vendorId) f.vendor_id = vendorId;
    if (outletId) f.outlet_id = outletId;
    return f;
  }, [status, vendorId, outletId]);
  const hasFilter = Object.keys(filters).length > 0;

  const { data, isLoading: loading } = usePaginatedList("/procurement/pos", filters, page, 20);
  const items = data?.data || [];
  const meta = data?.meta || { total: 0, per_page: 20 };
  const vendorMap = useMemo(() => Object.fromEntries(vendors.map(v => [v.id, v])), [vendors]);

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.per_page || 20)));

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="po-list-page">
      <PageHeader
        icon={FileCheck}
        title="Purchase Orders"
        subtitle="Buat, kirim, dan pantau PO ke vendor sampai barang diterima."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => exportXlsx("/procurement/pos/export/xlsx", "purchase_orders.xlsx", { status, vendor_id: vendorId, outlet_id: outletId })}
              disabled={downloading}
              data-testid="po-export-xlsx"
            >
              <Download /> {downloading ? "Mengunduh…" : "Ekspor Excel"}
            </Button>
            <Button variant="outline" asChild data-testid="po-compare-link">
              <Link to="/procurement/vendor-comparison?tab=po"><Scale /> Bandingkan PO</Link>
            </Button>
            <Button asChild data-testid="po-new">
              <Link to="/procurement/po/new"><Plus /> Buat PO</Link>
            </Button>
          </>
        }
      />

      <div className="glass-card overflow-hidden" data-testid="po-table-card">
        {/* Filter menempel pada tabel yang difilternya (DESIGN_SYSTEM §10.3). */}
        <ListToolbar testId="po-filters-card">
          <StatusTabs value={status || "all"} onChange={(v) => { setStatus(v === "all" ? "" : v); setPage(1); }}
            options={STATUS_TABS} testId="po-status-tabs" tabTestId={(k) => `po-tab-${k}`} />
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <OutletScopePicker
            value={outletId}
            onChange={(id) => { setOutletId(id); setPage(1); }}
            outlets={scopedOutlets}
            isFullAccess={isFullAccess}
            data-testid="po-filter-outlet"
          />
          <SimpleSelect
            value={vendorId}
            onValueChange={(v) => { setVendorId(v); setPage(1); }}
            options={[{ value: "", label: "Semua vendor" }, ...vendors.map(v => ({ value: v.id, label: v.name }))]}
            placeholder="Semua vendor"
            ariaLabel="Filter vendor"
            className="glass-input w-[200px]"
            testId="po-filter-vendor"
          />
          </div>
        </ListToolbar>
        <DataTable
          columns={[
            {
              key: "doc_no", label: "No. PO", primary: true, sortable: true,
              render: po => <span className="font-mono text-xs">{po.doc_no || po.id.slice(0, 8)}</span>,
            },
            { key: "order_date", label: "Tanggal", sortable: true, render: po => fmtDate(po.order_date) },
            { key: "vendor", label: "Vendor", sortAccessor: po => vendorMap[po.vendor_id]?.name || "",
              render: po => vendorMap[po.vendor_id]?.name || po.vendor_name || <span className="text-muted-foreground">—</span> },
            { key: "lines", label: "Item", numeric: true, sortable: true, sortAccessor: po => po.lines?.length || 0, render: po => po.lines?.length || 0 },
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
          empty={hasFilter ? (
            <EmptyState icon={FileCheck} title="Tidak ada PO yang cocok" description="Ubah filter status, outlet, atau vendor untuk melihat PO lain." />
          ) : (
            <EmptyState icon={FileCheck} title="Belum ada PO" description="Buat PO dari PR yang sudah approved atau langsung."
              action={<Button asChild data-testid="po-empty-new-btn"><Link to="/procurement/po/new"><Plus /> Buat PO</Link></Button>} />
          )}
          rowAction={(po) => (
            <Button asChild variant="ghost" size="sm">
              <Link to={`/procurement/po/${po.id}`} data-testid={`po-view-${po.id}`} aria-label={`Lihat detail PO ${po.doc_no || po.id}`}>
                <Eye /> Detail
              </Link>
            </Button>
          )}
          rowTestIdPrefix="po"
        />
        {totalPages > 1 && (
          <div className="px-4 py-2.5 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground" data-testid="po-pagination">
            <span data-testid="po-pagination-total">Total: {meta.total}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="Halaman sebelumnya" data-testid="po-prev">Sebelumnya</Button>
              <span className="tabular-nums" data-testid="po-page-info">{page}/{totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} aria-label="Halaman berikutnya" data-testid="po-next">Berikutnya</Button>
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
