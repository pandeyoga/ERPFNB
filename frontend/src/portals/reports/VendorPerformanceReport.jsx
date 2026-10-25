/** Vendor Performance Report — ekspor Excel scorecard vendor (metrik + bar chart di file). */
import { useState, useEffect } from "react";
import { Store } from "lucide-react";
import { fetchAll } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { todayJakartaISO } from "@/lib/format";
import {
  ReportPage, FilterGrid, ReportField, ChipMultiSelect, useExcelExport, daysAgoISO, validRange, toOptions,
} from "./reportKit";

export default function VendorPerformanceReport() {
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
      path: "/reports/procurement/vendor-performance.xlsx",
      params,
      filename: `vendor_performance_${dateFrom}_${dateTo}.xlsx`,
    });
  }

  return (
    <ReportPage
      reportId="vendor-performance"
      testId="vendor-performance-report-page"
      titleTestId="vendor-performance-title"
      filterTestId="vendor-perf-filter-card"
      exportTestId="vendor-perf-download-btn"
      onExport={downloadExcel}
      exporting={exporting}
    >
      <FilterGrid>
        <ReportField id="vp-date-from" label="Dari tanggal">
          <Input id="vp-date-from" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} data-testid="vendor-perf-date-from" />
        </ReportField>
        <ReportField id="vp-date-to" label="Hingga tanggal">
          <Input id="vp-date-to" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} data-testid="vendor-perf-date-to" />
        </ReportField>
      </FilterGrid>
      <ChipMultiSelect
        id="vp-vendors" label="Vendor" icon={Store}
        options={toOptions(vendors)} value={selectedVendors} onChange={setSelectedVendors}
        testIdFor={o => `vendor-filter-${o.code || o.value}`}
      />
    </ReportPage>
  );
}
