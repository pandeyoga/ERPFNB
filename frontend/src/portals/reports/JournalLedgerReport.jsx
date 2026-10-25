/** Journal Ledger Report — ekspor Excel general ledger dengan filter periode, COA, outlet & source. */
import { useState, useEffect } from "react";
import { Store } from "lucide-react";
import { fetchAll } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { todayJakartaISO } from "@/lib/format";
import useOutletScope from "@/hooks/useOutletScope";
import {
  ReportPage, FilterGrid, ReportField, ChipMultiSelect, useExcelExport, daysAgoISO, validRange, toOptions,
} from "./reportKit";

export default function JournalLedgerReport() {
  // Bug fix 2026-05-26: useOutletScope was imported but never invoked.
  const { scopedOutlets: outlets } = useOutletScope();
  const [periodFrom, setPeriodFrom] = useState(() => daysAgoISO(30));
  const [periodTo, setPeriodTo] = useState(todayJakartaISO());
  const [coaList, setCoaList] = useState([]);
  const [coaId, setCoaId] = useState("all");
  const [selectedOutlets, setSelectedOutlets] = useState([]);
  const [sourceType, setSourceType] = useState("all");
  const [exporting, exportExcel] = useExcelExport();

  useEffect(() => {
    fetchAll("/master/coa")
      .then(r => setCoaList(r.data?.data || []))
      .catch(() => {});
  }, []);

  function downloadExcel() {
    if (!validRange(periodFrom, periodTo)) return;
    const params = new URLSearchParams();
    if (periodFrom) params.append("period_from", periodFrom);
    if (periodTo) params.append("period_to", periodTo);
    if (coaId && coaId !== "all") params.append("coa_id", coaId);
    if (selectedOutlets.length > 0) params.append("outlet_ids", selectedOutlets.join(","));
    if (sourceType && sourceType !== "all") params.append("source_type", sourceType);
    exportExcel({
      path: "/reports/finance/journal-ledger.xlsx",
      params,
      filename: `journal_ledger_${periodFrom}_${periodTo}.xlsx`,
    });
  }

  return (
    <ReportPage
      reportId="journal-ledger"
      testId="journal-ledger-report-page"
      titleTestId="journal-ledger-title"
      filterTestId="jl-filter-card"
      exportTestId="jl-download-btn"
      onExport={downloadExcel}
      exporting={exporting}
    >
      <FilterGrid>
        <ReportField id="jl-from" label="Dari tanggal">
          <Input id="jl-from" type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} data-testid="jl-period-from" />
        </ReportField>
        <ReportField id="jl-to" label="Hingga tanggal">
          <Input id="jl-to" type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)} data-testid="jl-period-to" />
        </ReportField>
        <ReportField id="jl-coa" label="Akun (COA)">
          <Select value={coaId} onValueChange={setCoaId}>
            <SelectTrigger id="jl-coa" data-testid="jl-coa-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua akun</SelectItem>
              {coaList.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.code} - {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ReportField>
        <ReportField id="jl-source" label="Sumber jurnal">
          <Select value={sourceType} onValueChange={setSourceType}>
            <SelectTrigger id="jl-source" data-testid="jl-source-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua sumber</SelectItem>
              <SelectItem value="manual">Manual JE</SelectItem>
              <SelectItem value="sales">Sales</SelectItem>
              <SelectItem value="goods_receipt">Goods Receipt</SelectItem>
              <SelectItem value="payment">Payment</SelectItem>
              <SelectItem value="petty_cash">Petty Cash</SelectItem>
              <SelectItem value="adjustment">Inventory Adjustment</SelectItem>
              <SelectItem value="payroll">Payroll</SelectItem>
            </SelectContent>
          </Select>
        </ReportField>
      </FilterGrid>
      <ChipMultiSelect
        id="jl-outlets" label="Outlet" icon={Store}
        options={toOptions(outlets)} value={selectedOutlets} onChange={setSelectedOutlets}
        testIdFor={o => `jl-outlet-filter-${o.code || o.value}`}
      />
    </ReportPage>
  );
}
