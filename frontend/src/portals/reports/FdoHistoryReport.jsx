/** FDO History Report — Excel export dengan status color coding */
import { useState, useEffect } from "react";
import { Download, FileText, Store } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { todayJakartaISO } from "@/lib/format";
import useOutletScope from "@/hooks/useOutletScope";

export default function FdoHistoryReport() {
  const { allOutlets } = useOutletScope(); // FIX: Get outlets from hook
  const outlets = allOutlets; // FIX: Create alias
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 60);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(todayJakartaISO());
  const [selectedOutlets, setSelectedOutlets] = useState([]);
  const [status, setStatus] = useState("all");
  const [downloading, setDownloading] = useState(false);

  // FIX: Removed outlets fetch - already from hook
  // No useEffect needed for outlets anymore

  async function downloadExcel() {
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append("date_from", dateFrom);
      if (dateTo) params.append("date_to", dateTo);
      if (selectedOutlets.length > 0) params.append("outlet_ids", selectedOutlets.join(","));
      if (status && status !== "all") params.append("status", status);

      const response = await api.get(`/reports/outlet/fdo-history.xlsx?${params.toString()}`, {
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fdo_history_${dateFrom}_${dateTo}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Excel report downloaded successfully!");
    } catch (e) {
      toast.error("Gagal download report: " + (e.response?.data?.message || e.message));
    } finally {
      setDownloading(false);
    }
  }

  function toggleSelection(arr, setArr, id) {
    if (arr.includes(id)) {
      setArr(arr.filter(x => x !== id));
    } else {
      setArr([...arr, id]);
    }
  }

  return (
    <div className="space-y-4" data-testid="fdo-history-report-page">
      {/* Header */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 border border-emerald-500/30 flex items-center justify-center">
            <FileText className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold" data-testid="fdo-history-title">FDO History Report</h1>
            <p className="text-xs text-muted-foreground">Riwayat Floor Daily Order dengan status color coding</p>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <Card className="p-5">
        <h3 className="font-semibold mb-4 text-sm">Filters</h3>
        
        {/* Date Range */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dari Tanggal</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="mt-1 h-9"
              data-testid="fdo-date-from"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hingga Tanggal</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="mt-1 h-9"
              data-testid="fdo-date-to"
            />
          </div>
        </div>

        {/* Status Filter */}
        <div className="mb-4">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="mt-1 h-9" data-testid="fdo-status-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending">Pending Approval</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Outlet Filter */}
        {outlets.length > 0 && (
          <div className="mb-4">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
              <Store className="h-3 w-3 inline mr-1" />
              Outlet {selectedOutlets.length > 0 && `(${selectedOutlets.length})`}
            </Label>
            <div className="flex flex-wrap gap-2">
              {outlets.map(o => (
                <button
                  key={o.id}
                  onClick={() => toggleSelection(selectedOutlets, setSelectedOutlets, o.id)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    selectedOutlets.includes(o.id)
                      ? "bg-foreground text-background border-foreground"
                      : "border-border/40 text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                  data-testid={`outlet-filter-${o.code || o.id}`}
                >
                  {o.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Download Button */}
        <Button
          onClick={downloadExcel}
          disabled={downloading}
          className="w-full rounded-full gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white"
          data-testid="fdo-download-btn"
        >
          <Download className="h-4 w-4" />
          {downloading ? "Downloading..." : "Download Excel Report"}
        </Button>
      </Card>
    </div>
  );
}
