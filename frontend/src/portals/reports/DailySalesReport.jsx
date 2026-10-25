/** Daily Sales Summary Report — ekspor Excel penjualan harian per outlet/brand. */
import { useState, useEffect } from "react";
import { Store, Tag } from "lucide-react";
import { fetchAll } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { todayJakartaISO } from "@/lib/format";
import useOutletScope from "@/hooks/useOutletScope";
import {
  ReportPage, FilterGrid, ReportField, ChipMultiSelect, useExcelExport, daysAgoISO, validRange, toOptions,
} from "./reportKit";

export default function DailySalesReport() {
  const { allOutlets } = useOutletScope();
  const [dateFrom, setDateFrom] = useState(() => daysAgoISO(30));
  const [dateTo, setDateTo] = useState(todayJakartaISO());
  const [brands, setBrands] = useState([]);
  const [selectedOutlets, setSelectedOutlets] = useState([]);
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [exporting, exportExcel] = useExcelExport();

  useEffect(() => {
    fetchAll("/master/brands")
      .then(r => setBrands(r.data?.data || []))
      .catch(() => {});
  }, []);

  function downloadExcel() {
    if (!validRange(dateFrom, dateTo)) return;
    const params = new URLSearchParams();
    if (dateFrom) params.append("date_from", dateFrom);
    if (dateTo) params.append("date_to", dateTo);
    if (selectedOutlets.length > 0) params.append("outlet_ids", selectedOutlets.join(","));
    if (selectedBrands.length > 0) params.append("brand_ids", selectedBrands.join(","));
    exportExcel({
      path: "/reports/sales/daily-sales.xlsx",
      params,
      filename: `daily_sales_${dateFrom}_${dateTo}.xlsx`,
    });
  }

  return (
    <ReportPage
      reportId="daily-sales"
      testId="daily-sales-report-page"
      titleTestId="daily-sales-title"
      filterTestId="daily-sales-filter-card"
      exportTestId="daily-sales-download-btn"
      onExport={downloadExcel}
      exporting={exporting}
    >
      <FilterGrid>
        <ReportField id="ds-date-from" label="Dari tanggal">
          <Input id="ds-date-from" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} data-testid="daily-sales-date-from" />
        </ReportField>
        <ReportField id="ds-date-to" label="Hingga tanggal">
          <Input id="ds-date-to" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} data-testid="daily-sales-date-to" />
        </ReportField>
      </FilterGrid>
      <ChipMultiSelect
        id="ds-outlets" label="Outlet" icon={Store}
        options={toOptions(allOutlets)} value={selectedOutlets} onChange={setSelectedOutlets}
        testIdFor={o => `outlet-filter-${o.code || o.value}`}
      />
      <ChipMultiSelect
        id="ds-brands" label="Brand" icon={Tag}
        options={toOptions(brands)} value={selectedBrands} onChange={setSelectedBrands}
        testIdFor={o => `brand-filter-${o.code || o.value}`}
      />
    </ReportPage>
  );
}
