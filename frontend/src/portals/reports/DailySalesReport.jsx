/** Daily Sales Summary Report — Excel export dengan filters */
import { useState, useEffect } from "react";
import { Download, Calendar, Store, Tag } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { todayJakartaISO } from "@/lib/format";
import useOutletScope from "@/hooks/useOutletScope";

export default function DailySalesReport() {
  const { allOutlets } = useOutletScope(); // FIX: Get outlets from hook
  const outlets = allOutlets; // FIX: Create alias for component usage
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(todayJakartaISO());
  const [brands, setBrands] = useState([]);
  const [selectedOutlets, setSelectedOutlets] = useState([]);
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    // FIX: Removed outlets fetch - already from hook
    api.get("/master/brands", { params: { per_page: 100 } })
      .then(r => setBrands(r.data?.data || []))
      .catch(() => {});
  }, []);

  async function downloadExcel() {
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append("date_from", dateFrom);
      if (dateTo) params.append("date_to", dateTo);
      if (selectedOutlets.length > 0) params.append("outlet_ids", selectedOutlets.join(","));
      if (selectedBrands.length > 0) params.append("brand_ids", selectedBrands.join(","));

      const response = await api.get(`/reports/sales/daily-sales.xlsx?${params.toString()}`, {
        responseType: "blob",
      });

      // Download file
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `daily_sales_${dateFrom}_${dateTo}.xlsx`;
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
    <div className="space-y-4" data-testid="daily-sales-report-page">
      {/* Header */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 border border-emerald-500/30 flex items-center justify-center">
            <Calendar className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold" data-testid="daily-sales-title">Daily Sales Summary Report</h1>
            <p className="text-xs text-muted-foreground">Export laporan penjualan harian per outlet dalam format Excel</p>
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
              data-testid="daily-sales-date-from"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hingga Tanggal</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="mt-1 h-9"
              data-testid="daily-sales-date-to"
            />
          </div>
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

        {/* Brand Filter */}
        {brands.length > 0 && (
          <div className="mb-4">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
              <Tag className="h-3 w-3 inline mr-1" />
              Brand {selectedBrands.length > 0 && `(${selectedBrands.length})`}
            </Label>
            <div className="flex flex-wrap gap-2">
              {brands.map(b => (
                <button
                  key={b.id}
                  onClick={() => toggleSelection(selectedBrands, setSelectedBrands, b.id)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    selectedBrands.includes(b.id)
                      ? "bg-foreground text-background border-foreground"
                      : "border-border/40 text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                  data-testid={`brand-filter-${b.code || b.id}`}
                >
                  {b.name}
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
          data-testid="daily-sales-download-btn"
        >
          <Download className="h-4 w-4" />
          {downloading ? "Downloading..." : "Download Excel Report"}
        </Button>
      </Card>
    </div>
  );
}
