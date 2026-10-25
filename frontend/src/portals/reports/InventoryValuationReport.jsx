/** Stock Valuation Report (/reports/inventory-valuation) — ekspor Excel nilai persediaan per outlet. */
import { useState } from "react";
import { Store } from "lucide-react";
import { Input } from "@/components/ui/input";
import { todayJakartaISO } from "@/lib/format";
import useOutletScope from "@/hooks/useOutletScope";
import { ReportPage, FilterGrid, ReportField, ChipMultiSelect, useExcelExport, toOptions } from "./reportKit";

export default function InventoryValuationReport() {
  const { allOutlets } = useOutletScope();
  const [asOf, setAsOf] = useState(todayJakartaISO());
  const [selectedOutlets, setSelectedOutlets] = useState([]);
  const [exporting, exportExcel] = useExcelExport();

  function downloadExcel() {
    const params = new URLSearchParams();
    if (asOf) params.append("as_of", asOf);
    if (selectedOutlets.length > 0) params.append("outlet_ids", selectedOutlets.join(","));
    exportExcel({
      path: "/reports/inventory-valuation/excel",
      params,
      filename: `inventory-valuation-${asOf}.xlsx`,
    });
  }

  return (
    <ReportPage
      reportId="inventory-valuation"
      testId="inventory-valuation-report-page"
      titleTestId="inv-val-title"
      filterTestId="inv-val-filter-card"
      exportTestId="inv-val-download-btn"
      onExport={downloadExcel}
      exporting={exporting}
    >
      <FilterGrid>
        <ReportField id="as-of" label="Per tanggal">
          <Input id="as-of" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} data-testid="inv-val-date-input" />
        </ReportField>
      </FilterGrid>
      <ChipMultiSelect
        id="inv-val-outlets" label="Outlet" icon={Store} testId="inv-val-outlets-filter"
        options={toOptions(allOutlets)} value={selectedOutlets} onChange={setSelectedOutlets}
        testIdFor={o => `inv-val-outlet-${o.code || o.value}`}
      />
    </ReportPage>
  );
}
