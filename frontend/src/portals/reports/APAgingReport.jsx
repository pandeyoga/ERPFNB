/** AP Aging Report — ekspor Excel bucket umur hutang per vendor + detail invoice. */
import { useState, useEffect } from "react";
import { Store } from "lucide-react";
import { fetchAll } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { todayJakartaISO } from "@/lib/format";
import { ReportPage, FilterGrid, ReportField, ChipMultiSelect, useExcelExport, toOptions } from "./reportKit";

export default function APAgingReport() {
  const [asOfDate, setAsOfDate] = useState(todayJakartaISO());
  const [vendors, setVendors] = useState([]);
  const [selectedVendors, setSelectedVendors] = useState([]);
  const [exporting, exportExcel] = useExcelExport();

  useEffect(() => {
    fetchAll("/master/vendors")
      .then(r => setVendors(r.data?.data || []))
      .catch(() => {});
  }, []);

  function downloadExcel() {
    const params = new URLSearchParams();
    if (asOfDate) params.append("as_of_date", asOfDate);
    if (selectedVendors.length > 0) params.append("vendor_ids", selectedVendors.join(","));
    exportExcel({
      path: "/reports/finance/ap-aging.xlsx",
      params,
      filename: `ap_aging_${asOfDate}.xlsx`,
    });
  }

  return (
    <ReportPage
      reportId="ap-aging"
      testId="ap-aging-report-page"
      titleTestId="ap-aging-title"
      filterTestId="apa-filter-card"
      exportTestId="apa-download-btn"
      onExport={downloadExcel}
      exporting={exporting}
    >
      <FilterGrid>
        <ReportField id="apa-as-of" label="Per tanggal" hint="Umur hutang dihitung dari tanggal ini.">
          <Input id="apa-as-of" type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} data-testid="apa-as-of-date" />
        </ReportField>
      </FilterGrid>
      <ChipMultiSelect
        id="apa-vendors" label="Vendor" icon={Store} testId="apa-vendor-filter-container"
        options={toOptions(vendors)} value={selectedVendors} onChange={setSelectedVendors}
        testIdFor={o => `apa-vendor-filter-${o.code || o.value}`}
      />
    </ReportPage>
  );
}
