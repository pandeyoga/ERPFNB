/** P&L Report — FnB Group Format: ekspor Excel laba rugi multi-bulan (kolom per bulan + YTD). */
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import useOutletScope from "@/hooks/useOutletScope";
import { ReportPage, FilterGrid, ReportField, useExcelExport, validRange } from "./reportKit";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function startOfYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-01`;
}

const FORMAT_ROWS = [
  ["A. Revenue", "semua akun pendapatan per bulan"],
  ["B. COGS", "harga pokok penjualan per bulan"],
  ["C. Gross Profit (A − B)", "termasuk gross margin %"],
  ["D. Operating Expense", "semua akun biaya operasional"],
  ["E. Net Income (C − D)", "termasuk net margin %, hijau bila positif, merah bila negatif"],
];

export default function PLGroupReport() {
  const { allOutlets: outlets } = useOutletScope();
  const [periodFrom, setPeriodFrom] = useState(startOfYearMonth());
  const [periodTo, setPeriodTo] = useState(currentMonth());
  const [dimOutlet, setDimOutlet] = useState("all");
  const [exporting, exportExcel] = useExcelExport();

  function downloadExcel() {
    if (!periodFrom || !/^\d{4}-\d{2}$/.test(periodFrom) || !periodTo || !/^\d{4}-\d{2}$/.test(periodTo)) {
      toast.error("Periode harus berformat YYYY-MM");
      return;
    }
    if (!validRange(periodFrom, periodTo, "Periode awal tidak boleh setelah periode akhir")) return;
    const params = new URLSearchParams();
    params.append("period_from", periodFrom);
    params.append("period_to", periodTo);
    if (dimOutlet && dimOutlet !== "all") params.append("dim_outlet", dimOutlet);
    exportExcel({
      path: "/reports/finance/pl-group.xlsx",
      params,
      filename: `profit_loss_group_${periodFrom}_to_${periodTo}.xlsx`,
    });
  }

  return (
    <ReportPage
      reportId="pl-group"
      testId="pl-group-report-page"
      titleTestId="pl-group-title"
      filterTestId="plt-filter-card"
      exportTestId="plt-download-btn"
      onExport={downloadExcel}
      exporting={exporting}
      after={
        <section className="glass-card p-4" data-testid="plt-format-detail">
          <h2 className="text-sm md:text-base font-semibold mb-2">Struktur laporan</h2>
          <ul className="text-xs md:text-sm text-muted-foreground space-y-1 list-disc list-inside">
            {FORMAT_ROWS.map(([k, v]) => (
              <li key={k}><span className="font-medium text-foreground">{k}</span> — {v}</li>
            ))}
            <li>Setiap baris akun ditampilkan untuk semua bulan + kolom <span className="font-medium text-foreground">YTD</span> di akhir.</li>
          </ul>
        </section>
      }
    >
      <FilterGrid>
        <ReportField id="plt-from" label="Periode awal" required>
          <Input id="plt-from" type="month" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} data-testid="plt-period-from" />
        </ReportField>
        <ReportField id="plt-to" label="Periode akhir" required hint="Maksimal 24 bulan.">
          <Input id="plt-to" type="month" value={periodTo} onChange={e => setPeriodTo(e.target.value)} data-testid="plt-period-to" />
        </ReportField>
        <ReportField id="plt-outlet" label="Outlet">
          <Select value={dimOutlet} onValueChange={setDimOutlet}>
            <SelectTrigger id="plt-outlet" data-testid="plt-outlet-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua outlet (konsolidasi)</SelectItem>
              {outlets.map(o => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ReportField>
      </FilterGrid>
    </ReportPage>
  );
}
