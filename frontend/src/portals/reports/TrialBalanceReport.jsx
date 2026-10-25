/** Trial Balance Report — ekspor Excel per periode (YYYY-MM) dengan outlet opsional. */
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import useOutletScope from "@/hooks/useOutletScope";
import { ReportPage, FilterGrid, ReportField, useExcelExport } from "./reportKit";

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function TrialBalanceReport() {
  const { allOutlets: outlets } = useOutletScope();
  const [period, setPeriod] = useState(currentPeriod());
  const [dimOutlet, setDimOutlet] = useState("all");
  const [exporting, exportExcel] = useExcelExport();

  function downloadExcel() {
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      toast.error("Periode harus berformat YYYY-MM (contoh: 2026-04)");
      return;
    }
    const params = new URLSearchParams();
    params.append("period", period);
    if (dimOutlet && dimOutlet !== "all") params.append("dim_outlet", dimOutlet);
    exportExcel({
      path: "/reports/finance/trial-balance.xlsx",
      params,
      filename: `trial_balance_${period}.xlsx`,
    });
  }

  return (
    <ReportPage
      reportId="trial-balance"
      testId="trial-balance-report-page"
      titleTestId="trial-balance-title"
      filterTestId="tb-filter-card"
      exportTestId="tb-download-btn"
      onExport={downloadExcel}
      exporting={exporting}
    >
      <FilterGrid>
        <ReportField id="tb-period" label="Periode" required>
          <Input id="tb-period" type="month" value={period} onChange={e => setPeriod(e.target.value)} data-testid="tb-period-input" />
        </ReportField>
        <ReportField id="tb-outlet" label="Outlet">
          <Select value={dimOutlet} onValueChange={setDimOutlet}>
            <SelectTrigger id="tb-outlet" data-testid="tb-outlet-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" data-testid="tb-outlet-all">Semua outlet (konsolidasi)</SelectItem>
              {outlets.map(o => (
                <SelectItem key={o.id} value={o.id} data-testid={`tb-outlet-${o.code || o.id}`}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ReportField>
      </FilterGrid>
    </ReportPage>
  );
}
