/** Balance Sheet report page. */
import { useEffect, useState } from "react";
import { Scale, Download, CheckCircle2, AlertTriangle } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import { fmtRp, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";

export default function BalanceSheet() {
  const [asOf, setAsOf] = useState(todayJakartaISO());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/finance/balance-sheet", { params: { as_of: asOf } });
      setData(unwrap(res));
    } catch (e) {
      toast.error("Gagal memuat Balance Sheet");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [asOf]);

  function exportCsv() {
    if (!data) return;
    const rows = ["Section,Code,Name,Amount"];
    for (const sec of ["asset", "liability", "equity"]) {
      for (const r of data.sections[sec] || []) {
        rows.push(`${sec},${r.code},"${r.name}",${r.amount}`);
      }
    }
    rows.push(`TOTAL,ASSETS,,${data.totals.assets}`);
    rows.push(`TOTAL,LIABILITIES,,${data.totals.liabilities}`);
    rows.push(`TOTAL,EQUITY,,${data.totals.equity}`);
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `Balance-Sheet-${data.as_of}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div data-testid="balance-sheet-page" className="space-y-3 lg:space-y-4">
      <div data-testid="bs-filter-card" className="glass-card p-3 flex flex-wrap items-end gap-3">
        <div className="min-w-[180px]">
          <Label htmlFor="bs-asof" className="text-xs font-medium text-muted-foreground">Per tanggal</Label>
          <Input id="bs-asof" type="date" value={asOf} onChange={e => setAsOf(e.target.value)}
            className="glass-input mt-1 h-9" data-testid="bs-asof" />
        </div>
        <Button onClick={exportCsv} variant="outline" className="ml-auto" disabled={!data} data-testid="bs-export">
          <Download /> Ekspor CSV
        </Button>
      </div>

      {loading && <LoadingState rows={8} />}
      {!loading && data && (
        <>
          <div data-testid="bs-balance-status" className={`glass-card p-3 flex flex-wrap items-center gap-3 ${data.totals.is_balanced ? "bg-emerald-500/5 border-emerald-500/20" : "bg-amber-500/5 border-amber-500/30"}`}>
            {data.totals.is_balanced
              ? <CheckCircle2 className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
              : <AlertTriangle className="h-5 w-5 text-amber-800 dark:text-amber-400" />}
            <div className="flex-1">
              <div className="font-semibold text-sm">
                {data.totals.is_balanced ? "Seimbang — Aset = Liabilitas + Ekuitas" : `Tidak seimbang: selisih ${fmtRp(data.totals.diff)}`}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Net Income (periode berjalan): <span className="font-semibold">{fmtRp(data.totals.net_income)}</span>
              </div>
            </div>
            <div className="text-right text-xs tabular-nums">
              <div>Aset: <span className="font-semibold">{fmtRp(data.totals.assets)}</span></div>
              <div>Liabilitas + Ekuitas: <span className="font-semibold">{fmtRp(data.totals.liabilities_plus_equity)}</span></div>
            </div>
          </div>

          <div data-testid="bs-sections" className="grid lg:grid-cols-3 gap-3 lg:gap-4">
            <Section title="ASET" rows={data.sections.asset} total={data.totals.assets} accent="emerald" sectionId="asset" />
            <Section title="LIABILITAS" rows={data.sections.liability} total={data.totals.liabilities} accent="amber" sectionId="liability" />
            <Section title="EKUITAS" rows={data.sections.equity} total={data.totals.equity} accent="sky" sectionId="equity" />
          </div>

          {(!data.sections.asset.length && !data.sections.liability.length && !data.sections.equity.length) && (
            <EmptyState icon={Scale} title="Belum ada data balance sheet" description="Posting jurnal terlebih dahulu untuk melihat posisi keuangan." />
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, rows, total, accent, sectionId }) {
  const toneBg = {
    emerald: "bg-emerald-500/5 text-emerald-800 dark:text-emerald-400",
    amber: "bg-amber-500/5 text-amber-800 dark:text-amber-400",
    sky: "bg-sky-500/5 text-sky-800 dark:text-sky-400",
  }[accent] || "";
  return (
    <div data-testid={`bs-section-${sectionId}`} className="glass-card overflow-hidden">
      <h3 className={`px-4 py-2 border-b border-border/40 ${toneBg} font-semibold text-xs uppercase tracking-wide`}>
        {title}
      </h3>
      <DataTable
        rows={rows || []}
        keyField="coa_id"
        rowTestIdPrefix={`bs-${sectionId}-row`}
        empty={<div className="px-4 py-6 text-xs text-muted-foreground text-center">Kosong</div>}
        columns={[
          { key: "code", label: "Kode", primary: true,
            render: (r) => <span className={r.pseudo ? "text-xs font-medium tabular-nums italic text-muted-foreground" : "text-xs font-medium tabular-nums"}>{r.code}</span> },
          { key: "name", label: "Akun",
            render: (r) => <span className={r.pseudo ? "italic text-muted-foreground" : ""}>{r.name}</span> },
          { key: "amount", label: "Jumlah", numeric: true, sortable: true,
            render: (r) => <span className="whitespace-nowrap">{fmtRp(r.amount)}</span> },
        ]}
        footer={(
          <tr className="font-bold border-t-2 border-border/70">
            <td colSpan={2} className="px-4 py-3">Total</td>
            <td className={`px-4 py-3 text-right tabular-nums whitespace-nowrap text-${accent}-700 dark:text-${accent}-400`}>{fmtRp(total || 0)}</td>
          </tr>
        )}
      />
    </div>
  );
}
