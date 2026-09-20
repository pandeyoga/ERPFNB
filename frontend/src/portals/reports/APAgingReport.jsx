/** AP Aging Report — Excel export with aging buckets per vendor + invoice details */
import { useState, useEffect } from "react";
import { Download, AlertCircle, Store } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { todayJakartaISO } from "@/lib/format";

export default function APAgingReport() {
  const [asOfDate, setAsOfDate] = useState(todayJakartaISO());
  const [vendors, setVendors] = useState([]);
  const [selectedVendors, setSelectedVendors] = useState([]);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api.get("/master/vendors", { params: { per_page: 100 } })
      .then(r => setVendors(r.data?.data || []))
      .catch(() => {});
  }, []);

  async function downloadExcel() {
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (asOfDate) params.append("as_of_date", asOfDate);
      if (selectedVendors.length > 0) params.append("vendor_ids", selectedVendors.join(","));

      const response = await api.get(`/reports/finance/ap-aging.xlsx?${params.toString()}`, {
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ap_aging_${asOfDate}.xlsx`;
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
    <div className="space-y-4" data-testid="ap-aging-report-page">
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/5 border border-amber-500/30 flex items-center justify-center">
            <AlertCircle className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold" data-testid="ap-aging-title">AP Aging Report</h1>
            <p className="text-xs text-muted-foreground">Outstanding payables dengan aging buckets (Current / 1-30 / 31-60 / 61-90 / 90+ days) per vendor + invoice detail</p>
          </div>
        </div>
      </Card>

      <Card className="p-5" data-testid="apa-filter-card">
        <h3 className="font-semibold mb-4 text-sm">Filters</h3>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">As Of Date</Label>
            <Input
              type="date"
              value={asOfDate}
              onChange={e => setAsOfDate(e.target.value)}
              className="mt-1 h-9"
              data-testid="apa-as-of-date"
            />
            <p className="text-xs text-muted-foreground mt-1">Aging dihitung berdasarkan tanggal ini</p>
          </div>
        </div>

        {vendors.length > 0 && (
          <div className="mb-4" data-testid="apa-vendor-filter-container">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
              <Store className="h-3 w-3 inline mr-1" />
              Vendor (opsional) {selectedVendors.length > 0 && `(${selectedVendors.length} dipilih)`}
            </Label>
            <div className="flex flex-wrap gap-2">
              {vendors.map(v => (
                <button
                  key={v.id}
                  onClick={() => toggleSelection(selectedVendors, setSelectedVendors, v.id)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    selectedVendors.includes(v.id)
                      ? "bg-foreground text-background border-foreground"
                      : "border-border/40 text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                  data-testid={`apa-vendor-filter-${v.code || v.id}`}
                >
                  {v.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <Button
          onClick={downloadExcel}
          disabled={downloading}
          className="w-full rounded-full gap-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white"
          data-testid="apa-download-btn"
        >
          <Download className="h-4 w-4" />
          {downloading ? "Downloading..." : "Download Excel Report"}
        </Button>
      </Card>
    </div>
  );
}
