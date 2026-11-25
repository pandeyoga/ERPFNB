/** GR Summary Report — ekspor Excel ringkasan Goods Receipt dengan analisis selisih. */
import { useState, useEffect } from "react";
import { Store } from "lucide-react";
import { fetchAll } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { todayJakartaISO } from "@/lib/format";
import {
  ReportPage, FilterGrid, ReportField, ChipMultiSelect, useExcelExport, daysAgoISO, validRange, toOptions,
} from "./reportKit";

export default function GRSummaryReport() {
  const [dateFrom, setDateFrom] = useState(() => daysAgoISO(90));
  const [dateTo, setDateTo] = useState(todayJakartaISO());
  const [vendors, setVendors] = useState([]);
  const [selectedVendors, setSelectedVendors] = useState([]);
  const [exporting, exportExcel] = useExcelExport();

  useEffect(() => {
    fetchAll("/master/vendors")
      .then(r => setVendors(r.data?.data || []))
      .catch(() => {});
  }, []);

  function downloadExcel() {
    if (!validRange(dateFrom, dateTo)) return;
    const params = new URLSearchParams();
    if (dateFrom) params.append("date_from", dateFrom);
    if (dateTo) params.append("date_to", dateTo);
    if (selectedVendors.length > 0) params.append("vendor_ids", selectedVendors.join(","));
    exportExcel({
      path: "/reports/procurement/gr-summary.xlsx",
      params,
      filename: `gr_summary_${dateFrom}_${dateTo}.xlsx`,
    });
  }

  return (
    <ReportPage
      reportId="gr-summary"
      testId="gr-summary-report-page"
      titleTestId="gr-summary-title"
      filterTestId="gr-summary-filter-card"
      exportTestId="gr-summary-download-btn"
      onExport={downloadExcel}
      exporting={exporting}
    >
      <FilterGrid>
        <ReportField id="gr-date-from" label="Dari tanggal">
          <Input id="gr-date-from" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} data-testid="gr-summary-date-from" />
        </ReportField>
        <ReportField id="gr-date-to" label="Hingga tanggal">
          <Input id="gr-date-to" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} data-testid="gr-summary-date-to" />
        </ReportField>
      </FilterGrid>
      <ChipMultiSelect
        id="gr-vendors" label="Vendor" icon={Store}
        options={toOptions(vendors)} value={selectedVendors} onChange={setSelectedVendors}
        testIdFor={o => `vendor-filter-${o.code || o.value}`}
      />
    </ReportPage>
  );
}
