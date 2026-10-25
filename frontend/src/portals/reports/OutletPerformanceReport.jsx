/** Outlet Performance Report — ekspor Excel performa outlet (dengan bar chart di file). */
import { useState } from "react";
import { Store } from "lucide-react";
import { Input } from "@/components/ui/input";
import { todayJakartaISO } from "@/lib/format";
import useOutletScope from "@/hooks/useOutletScope";
import {
  ReportPage, FilterGrid, ReportField, ChipMultiSelect, useExcelExport, daysAgoISO, validRange, toOptions,
} from "./reportKit";

export default function OutletPerformanceReport() {
  const { allOutlets } = useOutletScope();
  const [dateFrom, setDateFrom] = useState(() => daysAgoISO(30));
  const [dateTo, setDateTo] = useState(todayJakartaISO());
  const [selectedOutlets, setSelectedOutlets] = useState([]);
  const [exporting, exportExcel] = useExcelExport();

  function downloadExcel() {
    if (!validRange(dateFrom, dateTo)) return;
    const params = new URLSearchParams();
    if (dateFrom) params.append("date_from", dateFrom);
    if (dateTo) params.append("date_to", dateTo);
    if (selectedOutlets.length > 0) params.append("outlet_ids", selectedOutlets.join(","));
    exportExcel({
      path: "/reports/outlet/performance.xlsx",
      params,
      filename: `outlet_performance_${dateFrom}_${dateTo}.xlsx`,
    });
  }

  return (
    <ReportPage
      reportId="outlet-performance"
      testId="outlet-performance-report-page"
      titleTestId="outlet-performance-title"
      filterTestId="outlet-perf-filter-card"
      exportTestId="outlet-perf-download-btn"
      onExport={downloadExcel}
      exporting={exporting}
    >
      <FilterGrid>
        <ReportField id="op-date-from" label="Dari tanggal">
          <Input id="op-date-from" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} data-testid="outlet-perf-date-from" />
        </ReportField>
        <ReportField id="op-date-to" label="Hingga tanggal">
          <Input id="op-date-to" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} data-testid="outlet-perf-date-to" />
        </ReportField>
      </FilterGrid>
      <ChipMultiSelect
        id="op-outlets" label="Outlet" icon={Store}
        options={toOptions(allOutlets)} value={selectedOutlets} onChange={setSelectedOutlets}
        testIdFor={o => `outlet-filter-${o.code || o.value}`}
      />
    </ReportPage>
  );
}
