/** Journal List with filters: period, source_type, search, COA, dim_outlet. (7E mobile-card polish) */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, BookOpenCheck, Search, Eye, Download } from "lucide-react";
import { usePaginatedList } from "@/hooks/useListQuery";
import api, { unwrap } from "@/lib/api";
import useExcelExport from "@/hooks/useExcelExport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SimpleSelect from "@/components/shared/SimpleSelect";
import StatusPill from "@/components/shared/StatusPill";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import { fmtRp, fmtDate, todayJakartaISO } from "@/lib/format";
import useOutletScope from "@/hooks/useOutletScope";
import { InlineHelp } from "@/components/shared/InlineHelp";

const SOURCE_TYPES = [
  { v: "",                l: "Semua sumber" },
  { v: "sales",           l: "Daily Sales" },
  { v: "petty_cash",      l: "Petty Cash" },
  { v: "urgent_purchase", l: "Urgent Purchase" },
  { v: "goods_receipt",   l: "Goods Receipt" },
  { v: "adjustment",      l: "Stock Adjustment" },
  { v: "opname",          l: "Opname Variance" },
  { v: "manual",          l: "Manual JE" },
  { v: "reversal",        l: "Reversal" },
];

export default function JournalList() {
  const [period, setPeriod] = useState(() => todayJakartaISO().slice(0, 7));
  const [sourceType, setSourceType] = useState("");
  const { outletId, setOutletId, scopedOutlets, allOutlets } = useOutletScope();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filters = useMemo(() => {
    const f = {};
    if (period) f.period = period;
    if (sourceType) f.source_type = sourceType;
    if (outletId) f.dim_outlet = outletId;
    if (search) f.search = search;
    return f;
  }, [period, sourceType, outletId, search]);

  const { data, isLoading: loading } = usePaginatedList("/finance/journals", filters, page, 20);
  const items = data?.data || [];
  const meta = data?.meta || { total: 0, per_page: 20 };

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.per_page || 20)));

  // Excel export — Journal Ledger (GET /reports/finance/journal-ledger.xlsx)
  const { downloading, exportXlsx } = useExcelExport();
  function handleExportExcel() {
    const exParams = {};
    if (period) {
      const [y, m] = period.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      exParams.period_from = `${period}-01`;
      exParams.period_to = `${period}-${String(lastDay).padStart(2, "0")}`;
    }
    if (sourceType) exParams.source_type = sourceType;
    if (outletId) exParams.outlet_ids = outletId;
    exportXlsx("/reports/finance/journal-ledger.xlsx", `journal_ledger_${period || "all"}.xlsx`, exParams);
  }

  return (
    <div data-testid="journal-list-page" className="space-y-4">
      <div data-testid="je-filter-card" className="glass-card p-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
          <div className="sm:min-w-[140px] flex-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold" htmlFor="je-period">Period</Label>
            <Input id="je-period" type="month" value={period} onChange={e => { setPeriod(e.target.value); setPage(1); }}
              className="glass-input mt-1 h-10" data-testid="je-period" />
          </div>
          <div className="sm:min-w-[180px] flex-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1" htmlFor="je-source">
              Source <InlineHelp id="journal-source" size="xs" placement="bottom-start" />
            </Label>
            <SimpleSelect
              value={sourceType}
              onValueChange={(v) => { setSourceType(v); setPage(1); }}
              options={SOURCE_TYPES.map(t => ({ value: t.v, label: t.l }))}
              className="glass-input rounded-lg w-full h-10 text-sm mt-1"
              testId="je-source"
            />
          </div>
          <div className="sm:min-w-[180px] flex-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold" htmlFor="je-outlet">Outlet (dim)</Label>
            <SimpleSelect
              value={outletId}
              onValueChange={(v) => { setOutletId(v); setPage(1); }}
              options={[{ value: "", label: "Semua" }, ...scopedOutlets.map(o => ({ value: o.id, label: o.name }))]}
              placeholder="Semua"
              className="glass-input rounded-lg w-full h-10 text-sm mt-1"
              testId="je-outlet"
            />
          </div>
          <div className="flex-1 sm:min-w-[200px]">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold" htmlFor="je-search">Cari</Label>
            <div className="relative mt-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input id="je-search" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Doc no / deskripsi…" className="glass-input pl-9 h-10" data-testid="je-search" />
            </div>
          </div>
          <Link to="/finance/manual-journal" className="sm:ml-auto">
            <Button className="rounded-full pill-active gap-2 h-10 px-5 w-full sm:w-auto" data-testid="je-new">
              <Plus className="h-4 w-4" /> Manual JE
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={handleExportExcel}
            disabled={downloading}
            className="rounded-full gap-2 h-10 px-5 w-full sm:w-auto"
            data-testid="je-export-excel"
          >
            <Download className="h-4 w-4" /> {downloading ? "Mengunduh..." : "Excel"}
          </Button>
        </div>
      </div>

      <div data-testid="je-list-card" className="glass-card">
        <DataTable
          columns={[
            {
              key: "doc_no", label: "Doc No", primary: true, sortable: true,
              render: je => <span className="font-mono text-xs">{je.doc_no || je.id.slice(0, 8)}</span>,
            },
            { key: "entry_date", label: "Tanggal", sortable: true, render: je => fmtDate(je.entry_date) },
            { key: "source_type", label: "Source", sortable: true, render: je => <span className="capitalize">{(je.source_type || "").replace("_", " ")}</span> },
            {
              key: "description", label: "Deskripsi",
              render: je => <span className="line-clamp-2 max-w-[280px] block">{je.description}</span>,
            },
            {
              key: "total_dr", label: "Total Dr", numeric: true, sortable: true,
              render: je => <span className="font-semibold">{fmtRp(je.total_dr || 0)}</span>,
            },
            { key: "status", label: "Status", render: je => <StatusPill status={je.status} /> },
          ]}
          rows={items}
          loading={loading}
          defaultSort={{ key: "entry_date", dir: "desc" }}
          renderExpanded={(je) => <JournalLinesDrilldown je={je} />}
          empty={<EmptyState icon={BookOpenCheck} title="Tidak ada journal entry" description="Coba ubah filter atau buat manual JE." />}
          rowAction={(je) => (
            <Link to={`/finance/journals/${je.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" data-testid={`je-view-${je.id}`} aria-label={`Lihat detail journal ${je.doc_no || je.id}`} onClick={(e) => e.stopPropagation()}>
              <Eye className="h-3.5 w-3.5" /> Detail
            </Link>
          )}
          rowTestIdPrefix="je"
        />
        {totalPages > 1 && (
          <div data-testid="je-pagination" className="px-5 py-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
            <span>Total: {meta.total}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded-full glass-input disabled:opacity-50" aria-label="Halaman sebelumnya">Prev</button>
              <span className="px-2 py-1">{page}/{totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded-full glass-input disabled:opacity-50" aria-label="Halaman berikutnya">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function JournalLinesDrilldown({ je }) {
  const [lines, setLines] = useState(null);
  const [loadingD, setLoadingD] = useState(true);
  useEffect(() => {
    let active = true;
    api.get(`/finance/journals/${je.id}`)
      .then(r => { if (active) setLines(unwrap(r)?.lines || []); })
      .catch(() => { if (active) setLines([]); })
      .finally(() => { if (active) setLoadingD(false); });
    return () => { active = false; };
  }, [je.id]);

  if (loadingD) return <div className="text-xs text-muted-foreground py-2">Memuat baris jurnal…</div>;
  if (!lines?.length) return <p className="text-sm text-muted-foreground">Tidak ada baris jurnal.</p>;
  const totalDr = lines.reduce((s, l) => s + (parseFloat(l.dr) || 0), 0);
  const totalCr = lines.reduce((s, l) => s + (parseFloat(l.cr) || 0), 0);
  return (
    <div className="space-y-2" data-testid={`je-lines-${je.id}`}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Baris Jurnal ({lines.length})</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 pr-3 font-medium">Akun</th>
              <th className="py-1 pr-3 font-medium">Memo</th>
              <th className="py-1 pr-3 font-medium text-right">Debit</th>
              <th className="py-1 pr-3 font-medium text-right">Kredit</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-t border-border/30">
                <td className="py-1.5 pr-3">
                  <span className="font-mono text-[10px] text-muted-foreground">{l.coa_code}</span>{" "}
                  <span className="font-medium">{l.coa_name || l.coa_id}</span>
                </td>
                <td className="py-1.5 pr-3 text-muted-foreground">{l.memo || "—"}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{l.dr ? fmtRp(l.dr) : "—"}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{l.cr ? fmtRp(l.cr) : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border/60 font-semibold">
              <td className="py-1.5 pr-3" colSpan={2}>Total</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{fmtRp(totalDr)}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{fmtRp(totalCr)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
