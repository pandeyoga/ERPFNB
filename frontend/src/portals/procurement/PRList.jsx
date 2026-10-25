/** Purchase Requests — daftar PR + filter status/outlet/source. (7E mobile-card polish)
 *  ?status=<key> di URL memilih tab status awal (dipakai KPI di Procurement Overview). */
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, FileText, Eye, Download } from "lucide-react";
import { usePaginatedList } from "@/hooks/useListQuery";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/shared/PageHeader";
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
  { key: "submitted", label: "Diajukan" },
  { key: "approved",  label: "Disetujui" },
  { key: "rejected",  label: "Ditolak" },
  { key: "converted", label: "Dikonversi" },
];

const SOURCE_LABEL = { manual: "Manual", KDO: "KDO", BDO: "BDO" };

export default function PRList() {
  const [searchParams] = useSearchParams();
  const { outletId, setOutletId, scopedOutlets, allOutlets } = useOutletScope();
  const [status, setStatus] = useState(() => {
    const s = searchParams.get("status") || "";
    return STATUS_TABS.some(t => t.key === s) ? s : "";
  });
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
  const hasFilter = Object.keys(filters).length > 0;

  const { data, isLoading: loading } = usePaginatedList("/procurement/prs", filters, page, 20);
  const items = data?.data || [];
  const meta = data?.meta || { total: 0, per_page: 20 };

  const outletMap = useMemo(
    () => Object.fromEntries([...(allOutlets || []), ...scopedOutlets].map(o => [o.id, o])),
    [allOutlets, scopedOutlets],
  );

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.per_page || 20)));

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="pr-list-page">
      <PageHeader
        icon={FileText}
        title="Purchase Requests"
        subtitle="Permintaan pembelian dari outlet & central. PR yang sudah approved bisa dikonversi menjadi PO."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => exportXlsx("/procurement/prs/export/xlsx", "purchase_requests.xlsx", { status, outlet_id: outletId, source })}
              disabled={downloading}
              data-testid="pr-export-xlsx"
            >
              <Download /> {downloading ? "Mengunduh…" : "Ekspor Excel"}
            </Button>
            <Button asChild data-testid="pr-new">
              <Link to="/procurement/pr/new"><Plus /> PR Baru</Link>
            </Button>
          </>
        }
      />

      <div className="glass-card p-3 flex flex-wrap items-center gap-2" data-testid="pr-filters-card">
        <Tabs value={status || "all"} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setPage(1); }}>
          <TabsList aria-label="Filter status" data-testid="pr-status-tabs">
            {STATUS_TABS.map(t => (
              <TabsTrigger key={t.key || "all"} value={t.key || "all"} data-testid={`pr-tab-${t.key || "all"}`}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <SimpleSelect
            value={outletId}
            onValueChange={(v) => { setOutletId(v); setPage(1); }}
            options={[{ value: "", label: "Semua outlet" }, ...scopedOutlets.map(o => ({ value: o.id, label: o.name }))]}
            placeholder="Semua outlet"
            ariaLabel="Filter outlet"
            className="glass-input w-[180px]"
            testId="pr-filter-outlet"
          />
          <div className="flex items-center gap-1.5">
            <SimpleSelect
              value={source}
              onValueChange={(v) => { setSource(v); setPage(1); }}
              options={[
                { value: "", label: "Semua source" },
                { value: "manual", label: "Manual" },
                { value: "KDO", label: "KDO" },
                { value: "BDO", label: "BDO" },
              ]}
              placeholder="Semua source"
              ariaLabel="Filter source"
              className="glass-input w-[150px]"
              testId="pr-filter-source"
            />
            <InlineHelp id="pr-source" size="xs" placement="top" />
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden" data-testid="pr-table-card">
        <DataTable
          columns={[
            {
              key: "doc_no", label: "No. PR", primary: true, sortable: true,
              render: pr => <span className="font-mono text-xs">{pr.doc_no || pr.id.slice(0, 8)}</span>,
            },
            { key: "request_date", label: "Tanggal", sortable: true, render: pr => fmtDate(pr.request_date) },
            { key: "outlet", label: "Outlet", render: pr => outletMap[pr.outlet_id]?.name || pr.outlet_name || <span className="text-muted-foreground">—</span> },
            { key: "source", label: "Source", sortable: true, render: pr => SOURCE_LABEL[pr.source] || pr.source || "—" },
            { key: "lines", label: "Item", numeric: true, sortable: true, sortAccessor: pr => pr.lines?.length || 0, render: pr => pr.lines?.length || 0 },
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
          empty={hasFilter ? (
            <EmptyState icon={FileText} title="Tidak ada PR yang cocok" description="Ubah filter status, outlet, atau source untuk melihat PR lain." />
          ) : (
            <EmptyState icon={FileText} title="Belum ada PR" description="Buat PR untuk request item dari outlet/central."
              action={<Button asChild data-testid="pr-empty-new-btn"><Link to="/procurement/pr/new"><Plus /> Buat PR</Link></Button>} />
          )}
          rowAction={(pr) => (
            <Button asChild variant="ghost" size="sm">
              <Link to={`/procurement/pr/${pr.id}`} data-testid={`pr-view-${pr.id}`} aria-label={`Lihat detail PR ${pr.doc_no || pr.id}`}>
                <Eye /> Detail
              </Link>
            </Button>
          )}
          rowTestIdPrefix="pr"
        />
        {totalPages > 1 && (
          <div className="px-4 py-2.5 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground" data-testid="pr-pagination">
            <span data-testid="pr-pagination-total">Total: {meta.total}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="Halaman sebelumnya" data-testid="pr-prev">Sebelumnya</Button>
              <span className="tabular-nums" data-testid="pr-page-info">{page}/{totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} aria-label="Halaman berikutnya" data-testid="pr-next">Berikutnya</Button>
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
