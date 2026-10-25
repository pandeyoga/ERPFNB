/** Stock Movements Report — ekspor Excel riwayat pergerakan stok IN/OUT. */
import { useState } from "react";
import { Store } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { todayJakartaISO } from "@/lib/format";
import useOutletScope from "@/hooks/useOutletScope";
import {
  ReportPage, FilterGrid, ReportField, ChipMultiSelect, useExcelExport, daysAgoISO, validRange, toOptions,
} from "./reportKit";

export default function StockMovementReport() {
  // Bug fix 2026-05-26: useOutletScope was imported but never invoked.
  const { scopedOutlets: outlets } = useOutletScope();
  const [dateFrom, setDateFrom] = useState(() => daysAgoISO(30));
  const [dateTo, setDateTo] = useState(todayJakartaISO());
  const [selectedOutlets, setSelectedOutlets] = useState([]);
  const [movementType, setMovementType] = useState("all");
  const [exporting, exportExcel] = useExcelExport();

  function downloadExcel() {
    if (!validRange(dateFrom, dateTo)) return;
    const params = new URLSearchParams();
    if (dateFrom) params.append("date_from", dateFrom);
    if (dateTo) params.append("date_to", dateTo);
    if (selectedOutlets.length > 0) params.append("outlet_ids", selectedOutlets.join(","));
    if (movementType && movementType !== "all") params.append("movement_type", movementType);
    exportExcel({
      path: "/reports/inventory/stock-movement.xlsx",
      params,
      filename: `stock_movement_${dateFrom}_${dateTo}.xlsx`,
    });
  }

  return (
    <ReportPage
      reportId="stock-movement"
      testId="stock-movement-report-page"
      titleTestId="stock-movement-title"
      filterTestId="stock-movement-filter-card"
      exportTestId="stock-movement-download-btn"
      onExport={downloadExcel}
      exporting={exporting}
    >
      <FilterGrid>
        <ReportField id="sm-date-from" label="Dari tanggal">
          <Input id="sm-date-from" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} data-testid="stock-movement-date-from" />
        </ReportField>
        <ReportField id="sm-date-to" label="Hingga tanggal">
          <Input id="sm-date-to" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} data-testid="stock-movement-date-to" />
        </ReportField>
        <ReportField id="sm-type" label="Tipe movement">
          <Select value={movementType} onValueChange={setMovementType}>
            <SelectTrigger id="sm-type" data-testid="movement-type-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua tipe</SelectItem>
              <SelectItem value="in">IN (Receiving)</SelectItem>
              <SelectItem value="out">OUT (Usage)</SelectItem>
              <SelectItem value="adj">Adjustment</SelectItem>
              <SelectItem value="transfer_in">Transfer IN</SelectItem>
              <SelectItem value="transfer_out">Transfer OUT</SelectItem>
            </SelectContent>
          </Select>
        </ReportField>
      </FilterGrid>
      <ChipMultiSelect
        id="sm-outlets" label="Outlet" icon={Store}
        options={toOptions(outlets)} value={selectedOutlets} onChange={setSelectedOutlets}
        testIdFor={o => `outlet-filter-${o.code || o.value}`}
      />
    </ReportPage>
  );
}
