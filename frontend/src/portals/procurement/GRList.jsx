/** Goods Receipt — daftar GR yang sudah di-posting (stok + jurnal AP otomatis). */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, PackageOpen, FileText } from "lucide-react";
import { usePaginatedList } from "@/hooks/useListQuery";
import { unwrap, fetchAll } from "@/lib/api";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/shared/PageHeader";
import { InlineHelp } from "@/components/shared/InlineHelp";
import useOutletScope from "@/hooks/useOutletScope";
import StatusPill from "@/components/shared/StatusPill";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import { fmtRp, fmtDate } from "@/lib/format";

export default function GRList() {
  const { allOutlets } = useOutletScope();
  const [vendors, setVendors] = useState([]);
  const [page, setPage] = useState(1);

  const { data, isLoading: loading } = usePaginatedList("/procurement/grs", {}, page, 20);
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
    { key: "je", label: "Jurnal", render: (gr) => gr.journal_entry_id ? (
      <span className="text-xs inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400" title="Jurnal AP sudah terbentuk" data-testid={`gr-je-${gr.id}`}>
        <FileText className="h-3.5 w-3.5" /> JE
      </span>) : dash },
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

      <div className="glass-card overflow-hidden" data-testid="gr-table-card">
        <DataTable
          columns={columns}
          rows={items}
          keyField="id"
          loading={loading}
          rowTestIdPrefix="gr-row"
          defaultSort={{ key: "receive_date", dir: "desc" }}
          empty={
            <div data-testid="gr-empty">
              <EmptyState icon={PackageOpen} title="Belum ada GR"
                description="Posting GR setelah barang diterima dari vendor."
                action={<Button asChild data-testid="gr-empty-new-btn"><Link to="/procurement/gr/new"><Plus /> Posting GR</Link></Button>}
              />
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
