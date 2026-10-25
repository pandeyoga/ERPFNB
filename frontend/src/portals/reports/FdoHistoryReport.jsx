/** FDO History Report — ekspor Excel riwayat Floor Daily Order (status color coding di file). */
import { useState } from "react";
import { Store } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { todayJakartaISO } from "@/lib/format";
import useOutletScope from "@/hooks/useOutletScope";
import {
  ReportPage, FilterGrid, ReportField, ChipMultiSelect, useExcelExport, daysAgoISO, validRange, toOptions,
} from "./reportKit";

export default function FdoHistoryReport() {
  const { allOutlets } = useOutletScope();
  const [dateFrom, setDateFrom] = useState(() => daysAgoISO(60));
  const [dateTo, setDateTo] = useState(todayJakartaISO());
  const [selectedOutlets, setSelectedOutlets] = useState([]);
  const [status, setStatus] = useState("all");
  const [exporting, exportExcel] = useExcelExport();

  function downloadExcel() {
    if (!validRange(dateFrom, dateTo)) return;
    const params = new URLSearchParams();
    if (dateFrom) params.append("date_from", dateFrom);
    if (dateTo) params.append("date_to", dateTo);
    if (selectedOutlets.length > 0) params.append("outlet_ids", selectedOutlets.join(","));
    if (status && status !== "all") params.append("status", status);
    exportExcel({
      path: "/reports/outlet/fdo-history.xlsx",
      params,
      filename: `fdo_history_${dateFrom}_${dateTo}.xlsx`,
    });
  }

  return (
    <ReportPage
      reportId="fdo-history"
      testId="fdo-history-report-page"
      titleTestId="fdo-history-title"
      filterTestId="fdo-filter-card"
      exportTestId="fdo-download-btn"
      onExport={downloadExcel}
      exporting={exporting}
    >
      <FilterGrid>
        <ReportField id="fdo-date-from-input" label="Dari tanggal">
          <Input id="fdo-date-from-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} data-testid="fdo-date-from" />
        </ReportField>
        <ReportField id="fdo-date-to-input" label="Hingga tanggal">
          <Input id="fdo-date-to-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} data-testid="fdo-date-to" />
        </ReportField>
        <ReportField id="fdo-status" label="Status">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="fdo-status" data-testid="fdo-status-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending">Menunggu approval</SelectItem>
              <SelectItem value="approved">Disetujui</SelectItem>
              <SelectItem value="rejected">Ditolak</SelectItem>
            </SelectContent>
          </Select>
        </ReportField>
      </FilterGrid>
      <ChipMultiSelect
        id="fdo-outlets" label="Outlet" icon={Store}
        options={toOptions(allOutlets)} value={selectedOutlets} onChange={setSelectedOutlets}
        testIdFor={o => `outlet-filter-${o.code || o.value}`}
      />
    </ReportPage>
  );
}
