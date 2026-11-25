/** PO Summary Report — ekspor Excel ringkasan Purchase Order per vendor & status. */
import { useState, useEffect } from "react";
import { Store } from "lucide-react";
import { fetchAll } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { todayJakartaISO } from "@/lib/format";
import {
  ReportPage, FilterGrid, ReportField, ChipMultiSelect, useExcelExport, daysAgoISO, validRange, toOptions,
} from "./reportKit";

export default function POSummaryReport() {
  const [dateFrom, setDateFrom] = useState(() => daysAgoISO(90));
  const [dateTo, setDateTo] = useState(todayJakartaISO());
  const [vendors, setVendors] = useState([]);
  const [selectedVendors, setSelectedVendors] = useState([]);
  const [status, setStatus] = useState("all");
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
    if (status && status !== "all") params.append("status", status);
    exportExcel({
      path: "/reports/procurement/po-summary.xlsx",
      params,
      filename: `po_summary_${dateFrom}_${dateTo}.xlsx`,
    });
  }

  return (
    <ReportPage
      reportId="po-summary"
      testId="po-summary-report-page"
      titleTestId="po-summary-title"
      filterTestId="po-summary-filter-card"
      exportTestId="po-summary-download-btn"
      onExport={downloadExcel}
      exporting={exporting}
    >
      <FilterGrid>
        <ReportField id="po-date-from" label="Dari tanggal">
          <Input id="po-date-from" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} data-testid="po-summary-date-from" />
        </ReportField>
        <ReportField id="po-date-to" label="Hingga tanggal">
          <Input id="po-date-to" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} data-testid="po-summary-date-to" />
        </ReportField>
        <ReportField id="po-status" label="Status">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="po-status" data-testid="po-status-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending">Menunggu approval</SelectItem>
              <SelectItem value="approved">Disetujui</SelectItem>
              <SelectItem value="rejected">Ditolak</SelectItem>
              <SelectItem value="completed">Selesai</SelectItem>
            </SelectContent>
          </Select>
        </ReportField>
      </FilterGrid>
      <ChipMultiSelect
        id="po-vendors" label="Vendor" icon={Store}
        options={toOptions(vendors)} value={selectedVendors} onChange={setSelectedVendors}
        testIdFor={o => `vendor-filter-${o.code || o.value}`}
      />
    </ReportPage>
  );
}
