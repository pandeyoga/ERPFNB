/** GR (Goods Receipt) List + create. */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, PackageOpen, FileText } from "lucide-react";
import { usePaginatedList } from "@/hooks/useListQuery";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
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
    () => Object.fromEntries(allOutlets.map(o => [o.id, o])),
    [allOutlets],
  );

  useEffect(() => {
    api.get("/master/vendors", { params: { per_page: 200 } })
      .then(v => setVendors(unwrap(v) || [])).catch(() => {});
  }, []);

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.per_page || 20)));

  const columns = [
    { key: "doc_no", label: "Doc No", primary: true, sortable: true, sortAccessor: (gr) => gr.doc_no || gr.id,
      render: (gr) => <span className="font-mono text-xs" data-testid={`gr-docno-${gr.id}`}>{gr.doc_no || gr.id.slice(0, 8)}</span> },
    { key: "receive_date", label: "Tanggal", sortable: true, render: (gr) => fmtDate(gr.receive_date) },
    { key: "vendor", label: "Vendor", sortAccessor: (gr) => vendors.find(x => x.id === gr.vendor_id)?.name || gr.vendor_id,
      render: (gr) => vendors.find(x => x.id === gr.vendor_id)?.name || gr.vendor_id },
    { key: "outlet", label: "Outlet", render: (gr) => allOutlets.find(x => x.id === gr.outlet_id)?.name || gr.outlet_id },
    { key: "invoice_no", label: "Invoice", render: (gr) => <span className="text-xs">{gr.invoice_no || "—"}</span> },
    { key: "grand_total", label: "Grand Total", numeric: true, sortable: true,
      render: (gr) => <span className="font-semibold" data-testid={`gr-total-${gr.id}`}>{fmtRp(gr.grand_total || 0)}</span> },
    { key: "status", label: "Status", render: (gr) => <StatusPill status={gr.status} /> },
    { key: "je", label: "", render: (gr) => gr.journal_entry_id ? (
      <span className="text-[11px] flex items-center gap-1 text-emerald-700 dark:text-emerald-400" data-testid={`gr-je-${gr.id}`}>
        <FileText className="h-3 w-3" /> JE
      </span>) : null },
  ];

  return (
    <div className="space-y-4" data-testid="gr-list-page">
      <div className="glass-card p-4 flex items-center justify-between" data-testid="gr-list-header">
        <div>
          <h3 className="font-semibold inline-flex items-center gap-2">
            Goods Receipts <InlineHelp id="gr-je-link" placement="bottom-start" />
          </h3>
          <p className="text-xs text-muted-foreground">Posting GR akan otomatis menambah stok &amp; jurnal AP.</p>
        </div>
        <Link to="/procurement/gr/new">
          <Button className="rounded-full pill-active gap-2 h-10" data-testid="gr-new">
            <Plus className="h-4 w-4" /> Posting GR
          </Button>
        </Link>
      </div>

      <div className="glass-card overflow-hidden" data-testid="gr-table-card">
        <DataTable
          columns={columns}
          rows={items}
          keyField="id"
          loading={loading}
          rowTestIdPrefix="gr-row"
          defaultSort={{ key: "receive_date", dir: "desc" }}
          empty={
            <div className="py-2" data-testid="gr-empty">
              <EmptyState icon={PackageOpen} title="Belum ada GR"
                description="Posting GR setelah barang diterima dari vendor."
                action={<Link to="/procurement/gr/new"><Button className="pill-active rounded-full" data-testid="gr-empty-new-btn">Posting GR</Button></Link>}
              />
            </div>
          }
        />
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground" data-testid="gr-pagination">
            <span data-testid="gr-pagination-total">Total: {meta.total}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded-full glass-input disabled:opacity-50" data-testid="gr-prev">Prev</button>
              <span className="px-2 py-1" data-testid="gr-page-info">{page}/{totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded-full glass-input disabled:opacity-50" data-testid="gr-next">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
