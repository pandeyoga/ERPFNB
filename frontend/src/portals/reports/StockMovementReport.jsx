/** Stock Movement Report — Excel export dengan IN/OUT transaction history */
import { useState, useEffect } from "react";
import { Download, ArrowLeftRight, Store } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { todayJakartaISO } from "@/lib/format";
import useOutletScope from "@/hooks/useOutletScope";

export default function StockMovementReport() {
  // Bug fix 2026-05-26: useOutletScope was imported but never invoked.
  const { scopedOutlets: outlets } = useOutletScope();
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(todayJakartaISO());
  const [selectedOutlets, setSelectedOutlets] = useState([]);
  const [movementType, setMovementType] = useState("all");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    // outlets sourced from useOutletScope() hook
  }, []);

  async function downloadExcel() {
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append("date_from", dateFrom);
      if (dateTo) params.append("date_to", dateTo);
      if (selectedOutlets.length > 0) params.append("outlet_ids", selectedOutlets.join(","));
      if (movementType && movementType !== "all") params.append("movement_type", movementType);

      const response = await api.get(`/reports/inventory/stock-movement.xlsx?${params.toString()}`, {
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stock_movement_${dateFrom}_${dateTo}.xlsx`;
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
    <div className="space-y-4" data-testid="stock-movement-report-page">
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/5 border border-blue-500/30 flex items-center justify-center">
            <ArrowLeftRight className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold" data-testid="stock-movement-title">Stock Movement Report</h1>
            <p className="text-xs text-muted-foreground">IN/OUT transaction history dengan detail movements</p>
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
              data-testid="stock-movement-date-from"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hingga Tanggal</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="mt-1 h-9"
              data-testid="stock-movement-date-to"
            />
          </div>
        </div>

        <div className="mb-4">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Movement Type</Label>
          <Select value={movementType} onValueChange={setMovementType}>
            <SelectTrigger className="mt-1 h-9" data-testid="movement-type-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="in">IN (Receiving)</SelectItem>
              <SelectItem value="out">OUT (Usage)</SelectItem>
              <SelectItem value="adj">Adjustment</SelectItem>
              <SelectItem value="transfer_in">Transfer IN</SelectItem>
              <SelectItem value="transfer_out">Transfer OUT</SelectItem>
            </SelectContent>
          </Select>
        </div>

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

        <Button
          onClick={downloadExcel}
          disabled={downloading}
          className="w-full rounded-full gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white"
          data-testid="stock-movement-download-btn"
        >
          <Download className="h-4 w-4" />
          {downloading ? "Downloading..." : "Download Excel Report"}
        </Button>
      </Card>
    </div>
  );
}
