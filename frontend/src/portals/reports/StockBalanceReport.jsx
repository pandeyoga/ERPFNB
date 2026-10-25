/** Stock Balance Report — ekspor Excel posisi stok per item/outlet/kategori. */
import { useState, useEffect } from "react";
import { Store, Tag } from "lucide-react";
import { fetchAll } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { todayJakartaISO } from "@/lib/format";
import useOutletScope from "@/hooks/useOutletScope";
import { ReportPage, FilterGrid, ReportField, ChipMultiSelect, useExcelExport, toOptions } from "./reportKit";

export default function StockBalanceReport() {
  const { allOutlets } = useOutletScope();
  const [asOfDate, setAsOfDate] = useState(todayJakartaISO());
  const [categories, setCategories] = useState([]);
  const [selectedOutlets, setSelectedOutlets] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [exporting, exportExcel] = useExcelExport();

  useEffect(() => {
    fetchAll("/master/categories")
      .then(r => setCategories(r.data?.data || []))
      .catch(() => {});
  }, []);

  function downloadExcel() {
    const params = new URLSearchParams();
    if (asOfDate) params.append("as_of_date", asOfDate);
    if (selectedOutlets.length > 0) params.append("outlet_ids", selectedOutlets.join(","));
    if (selectedCategories.length > 0) params.append("category_ids", selectedCategories.join(","));
    exportExcel({
      path: "/reports/inventory/stock-balance.xlsx",
      params,
      filename: `stock_balance_${asOfDate}.xlsx`,
    });
  }

  return (
    <ReportPage
      reportId="stock-balance"
      testId="stock-balance-report-page"
      titleTestId="stock-balance-title"
      filterTestId="stock-balance-filter-card"
      exportTestId="stock-balance-download-btn"
      onExport={downloadExcel}
      exporting={exporting}
    >
      <FilterGrid>
        <ReportField id="sb-as-of" label="Per tanggal">
          <Input id="sb-as-of" type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} data-testid="stock-balance-date" />
        </ReportField>
      </FilterGrid>
      <ChipMultiSelect
        id="sb-outlets" label="Outlet" icon={Store}
        options={toOptions(allOutlets)} value={selectedOutlets} onChange={setSelectedOutlets}
        testIdFor={o => `outlet-filter-${o.code || o.value}`}
      />
      <ChipMultiSelect
        id="sb-categories" label="Kategori" icon={Tag}
        options={toOptions(categories)} value={selectedCategories} onChange={setSelectedCategories}
        testIdFor={o => `category-filter-${o.code || o.value}`}
      />
    </ReportPage>
  );
}
