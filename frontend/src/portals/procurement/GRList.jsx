/** Goods Receipt — daftar GR yang sudah di-posting (stok + jurnal AP otomatis).
 *  Filter: outlet, vendor, rentang tanggal terima, cari no. GR / invoice. */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, PackageOpen, FileText, Search } from "lucide-react";
import { usePaginatedList } from "@/hooks/useListQuery";
import { useDebounce } from "@/hooks/useDebounce";
import { unwrap, fetchAll } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { permitted } from "@/lib/portalGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/shared/PageHeader";
import SimpleSelect from "@/components/shared/SimpleSelect";
import OutletScopePicker from "@/components/shared/OutletScopePicker";
import { InlineHelp } from "@/components/shared/InlineHelp";
import useOutletScope from "@/hooks/useOutletScope";
import StatusPill from "@/components/shared/StatusPill";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import { fmtRp, fmtDate } from "@/lib/format";

export default function GRList() {
  const { user } = useAuth();
  const canSeeJournal = permitted(user, "finance.journal_entry.read");
  const { allOutlets, outletId, setOutletId, scopedOutlets, isFullAccess } = useOutletScope();
  const [vendors, setVendors] = useState([]);
  const [vendorId, setVendorId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search.trim(), 350);
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [debouncedSearch]);

  const filters = useMemo(() => {
    const f = {};
    if (outletId) f.outlet_id = outletId;
    if (vendorId) f.vendor_id = vendorId;
    if (dateFrom) f.date_from = dateFrom;
    if (dateTo) f.date_to = dateTo;
    if (debouncedSearch) f.search = debouncedSearch;
    return f;
  }, [outletId, vendorId, dateFrom, dateTo, debouncedSearch]);
  const hasFilter = Object.keys(filters).length > 0;

  const { data, isLoading: loading } = usePaginatedList("/procurement/grs", filters, page, 20);
  const items = data?.data || [];
  const meta = data?.meta || { total: 0, per_page: 20 };

  const outletMap = useMemo(
    () => Object.fromEntries((allOutlets || []).map(o => [o.id, o])),
    [allOutlets],
  );
  const vendorMap = useMemo(() => Object.fromEntries(vendors.map(v => [v.id, v])), [vendors]);

  useEffect(() => {
    fetchAll("/master/vendors")
      .then(v => setVendors(unwrap(v) || [])).catch(() => {});
  }, []);

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.per_page || 20)));
  const dash = <span className="text-muted-foreground">—</span>;

  const columns = [
    { key: "doc_no", label: "No. GR", primary: true, sortable: true, sortAccessor: (gr) => gr.doc_no || gr.id,
      render: (gr) => <span className="font-mono text-xs" data-testid={`gr-docno-${gr.id}`}>{gr.doc_no || gr.id.slice(0, 8)}</span> },
    { key: "receive_date", label: "Tanggal", sortable: true, render: (gr) => fmtDate(gr.receive_date) },
    { key: "vendor", label: "Vendor", sortable: true, sortAccessor: (gr) => vendorMap[gr.vendor_id]?.name || "",
      render: (gr) => vendorMap[gr.vendor_id]?.name || dash },
    { key: "outlet", label: "Outlet", render: (gr) => outletMap[gr.outlet_id]?.name || dash },
    { key: "invoice_no", label: "Invoice", render: (gr) => gr.invoice_no || dash },
    { key: "grand_total", label: "Grand Total", numeric: true, sortable: true,
      render: (gr) => <span className="font-semibold" data-testid={`gr-total-${gr.id}`}>{fmtRp(gr.grand_total || 0)}</span> },
    { key: "status", label: "Status", render: (gr) => <StatusPill status={gr.status} /> },
    { key: "je", label: "Jurnal", render: (gr) => {
      if (!gr.journal_entry_id) return dash;
      const cls = "text-xs inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400";
      return canSeeJournal ? (
        <Link to={`/finance/journals/${gr.journal_entry_id}`} className={`${cls} hover:underline`} title="Buka jurnal AP" data-testid={`gr-je-${gr.id}`}>
          <FileText className="h-3.5 w-3.5" /> JE
        </Link>
      ) : (
        <span className={cls} title="Jurnal AP sudah terbentuk" data-testid={`gr-je-${gr.id}`}>
          <FileText className="h-3.5 w-3.5" /> JE
        </span>
      );
    } },
  ];

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="gr-list-page">
      <PageHeader
        icon={PackageOpen}
        title="Goods Receipt"
        subtitle="Posting GR akan otomatis menambah stok & membuat jurnal AP."
        testId="gr-list-header"
        actions={
          <>
            <InlineHelp id="gr-je-link" placement="bottom-end" />
            <Button asChild data-testid="gr-new">
              <Link to="/procurement/gr/new"><Plus /> Posting GR</Link>
            </Button>
          </>
        }
      />

      <div className="glass-card p-3 flex flex-wrap items-center gap-2" data-testid="gr-filters-card">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Cari no. GR atau invoice…"
            aria-label="Cari GR"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="glass-input pl-9"
            data-testid="gr-filter-search"
          />
        </div>
        <OutletScopePicker
          value={outletId}
          onChange={(id) => { setOutletId(id); setPage(1); }}
          outlets={scopedOutlets}
          isFullAccess={isFullAccess}
          data-testid="gr-filter-outlet"
        />
        <SimpleSelect
          value={vendorId}
          onValueChange={(v) => { setVendorId(v); setPage(1); }}
          options={[{ value: "", label: "Semua vendor" }, ...vendors.map(v => ({ value: v.id, label: v.name }))]}
          placeholder="Semua vendor"
          ariaLabel="Filter vendor"
          className="glass-input w-[180px]"
          testId="gr-filter-vendor"
        />
        <div className="flex items-center gap-1.5">
          <Input type="date" value={dateFrom} max={dateTo || undefined}
            onChange={e => { setDateFrom(e.target.value); setPage(1); }}
            aria-label="Tanggal terima dari" className="glass-input w-[136px]" data-testid="gr-filter-date-from" />
          <span className="text-xs text-muted-foreground">s/d</span>
          <Input type="date" value={dateTo} min={dateFrom || undefined}
            onChange={e => { setDateTo(e.target.value); setPage(1); }}
            aria-label="Tanggal terima sampai" className="glass-input w-[136px]" data-testid="gr-filter-date-to" />
        </div>
        {hasFilter && (
          <Button variant="ghost" size="sm" data-testid="gr-filter-reset"
            onClick={() => { setSearch(""); setOutletId(""); setVendorId(""); setDateFrom(""); setDateTo(""); setPage(1); }}>
            Reset
          </Button>
        )}
      </div>

      <div className="glass-card overflow-hidden" data-testid="gr-table-card">
        <DataTable
          columns={columns}
          rows={items}
          keyField="id"
          loading={loading}
          rowTestIdPrefix="gr-row"
          defaultSort={{ key: "receive_date", dir: "desc" }}
          renderExpanded={(gr) => (
            <div className="space-y-2 text-sm" data-testid={`gr-detail-${gr.id}`}>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                {gr.po_id && <span>PO: <Link to={`/procurement/po/${gr.po_id}`} className="text-foreground hover:underline" data-testid={`gr-po-link-${gr.id}`}>Lihat PO</Link></span>}
                {gr.invoice_date && <span>Tgl invoice: <span className="text-foreground">{fmtDate(gr.invoice_date)}</span></span>}
                {gr.payment_terms_days != null && <span>Termin: <span className="text-foreground">{gr.payment_terms_days} hari</span></span>}
                {gr.notes && <span>Catatan: <span className="text-foreground">{gr.notes}</span></span>}
              </div>
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b border-border/50">
                    <th className="text-left font-medium py-1.5">Item</th>
                    <th className="text-right font-medium py-1.5">Dipesan</th>
                    <th className="text-right font-medium py-1.5">Diterima</th>
                    <th className="text-right font-medium py-1.5">Harga</th>
                    <th className="text-right font-medium py-1.5">Total</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {(gr.lines || []).map((ln, i) => (
                    <tr key={i} className="border-b border-border/30 last:border-0">
                      <td className="py-1.5">
                        {ln.item_name || "—"}
                        {ln.condition_note && <span className="block text-muted-foreground">{ln.condition_note}</span>}
                      </td>
                      <td className="text-right py-1.5">{ln.qty_ordered ?? "—"} {ln.unit}</td>
                      <td className={`text-right py-1.5 ${ln.qty_variance ? "text-amber-700 dark:text-amber-400 font-medium" : ""}`}>{ln.qty_received} {ln.unit}</td>
                      <td className="text-right py-1.5">{fmtRp(ln.invoice_unit_cost ?? ln.unit_cost ?? 0)}</td>
                      <td className="text-right py-1.5 font-medium">{fmtRp(ln.total_cost ?? ln.total ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          empty={
            <div data-testid="gr-empty">
              {hasFilter ? (
                <EmptyState icon={PackageOpen} title="Tidak ada GR yang cocok"
                  description="Ubah atau reset filter untuk melihat GR lain." />
              ) : (
              <EmptyState icon={PackageOpen} title="Belum ada GR"
                description="Posting GR setelah barang diterima dari vendor."
                action={<Button asChild data-testid="gr-empty-new-btn"><Link to="/procurement/gr/new"><Plus /> Posting GR</Link></Button>}
              />
              )}
            </div>
          }
        />
        {totalPages > 1 && (
          <div className="px-4 py-2.5 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground" data-testid="gr-pagination">
            <span data-testid="gr-pagination-total">Total: {meta.total}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="Halaman sebelumnya" data-testid="gr-prev">Sebelumnya</Button>
              <span className="tabular-nums" data-testid="gr-page-info">{page}/{totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} aria-label="Halaman berikutnya" data-testid="gr-next">Berikutnya</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
