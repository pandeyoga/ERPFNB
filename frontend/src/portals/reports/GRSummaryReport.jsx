/** GR Summary Report — Excel export dengan variance analysis */
import { useState, useEffect } from "react";
import { Download, PackageCheck, Store } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { todayJakartaISO } from "@/lib/format";

export default function GRSummaryReport() {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(todayJakartaISO());
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
      if (dateFrom) params.append("date_from", dateFrom);
      if (dateTo) params.append("date_to", dateTo);
      if (selectedVendors.length > 0) params.append("vendor_ids", selectedVendors.join(","));

      const response = await api.get(`/reports/procurement/gr-summary.xlsx?${params.toString()}`, {
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gr_summary_${dateFrom}_${dateTo}.xlsx`;
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
    <div className="space-y-4" data-testid="gr-summary-report-page">
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-600/5 border border-purple-500/30 flex items-center justify-center">
            <PackageCheck className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold" data-testid="gr-summary-title">GR Summary Report</h1>
            <p className="text-xs text-muted-foreground">Goods Receipt summary dengan variance analysis (PO vs GR)</p>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-4 text-sm">Filters</h3>
        
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dari Tanggal</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="mt-1 h-9"
              data-testid="gr-summary-date-from"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hingga Tanggal</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="mt-1 h-9"
              data-testid="gr-summary-date-to"
            />
          </div>
        </div>

        {vendors.length > 0 && (
          <div className="mb-4">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
              <Store className="h-3 w-3 inline mr-1" />
              Vendor {selectedVendors.length > 0 && `(${selectedVendors.length})`}
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
                  data-testid={`vendor-filter-${v.code || v.id}`}
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
          className="w-full rounded-full gap-2 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white"
          data-testid="gr-summary-download-btn"
        >
          <Download className="h-4 w-4" />
          {downloading ? "Downloading..." : "Download Excel Report"}
        </Button>
      </Card>
    </div>
  );
}
