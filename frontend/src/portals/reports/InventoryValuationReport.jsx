/** Inventory Valuation Report — Nilai persediaan per outlet */
import { useState } from "react";
import { Download, Package, Store } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { todayJakartaISO } from "@/lib/format";
import useOutletScope from "@/hooks/useOutletScope";

export default function InventoryValuationReport() {
  const { allOutlets } = useOutletScope();
  const outlets = allOutlets;
  const [asOf, setAsOf] = useState(todayJakartaISO());
  const [selectedOutlets, setSelectedOutlets] = useState([]);
  const [downloading, setDownloading] = useState(false);

  async function downloadExcel() {
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (asOf) params.append("as_of", asOf);
      if (selectedOutlets.length > 0) params.append("outlet_ids", selectedOutlets.join(","));

      const url = `/reports/inventory-valuation/excel?${params.toString()}`;
      const response = await api.get(url, { responseType: "blob" });
      const blob = new Blob([response.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = `inventory-valuation-${asOf}.xlsx`;
      link.click();
      toast.success("Report downloaded successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to generate report");
    } finally {
      setDownloading(false);
    }
  }

  function toggleOutlet(outletId) {
    setSelectedOutlets(prev =>
      prev.includes(outletId) ? prev.filter(id => id !== outletId) : [...prev, outletId]
    );
  }

  return (
    <div className="space-y-6" data-testid="inventory-valuation-report-page">
      {/* Header */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/5 border border-blue-500/30 flex items-center justify-center">
            <Package className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold" data-testid="inv-val-title">Inventory Valuation Report</h1>
            <p className="text-xs text-muted-foreground">Nilai persediaan per outlet (moving average)</p>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <Card className="p-6 space-y-4" data-testid="inv-val-filter-card">
        <h3 className="font-semibold text-sm">Filters</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="as-of">As Of Date</Label>
            <input
              id="as-of"
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              className="w-full px-3 py-2 rounded-md border mt-1"
              data-testid="inv-val-date-input"
            />
          </div>
        </div>

        {outlets.length > 0 && (
          <div data-testid="inv-val-outlets-filter">
            <Label>Filter by Outlets (optional) {selectedOutlets.length > 0 && `(${selectedOutlets.length} dipilih)`}</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {outlets.map(o => (
                <button
                  key={o.id}
                  onClick={() => toggleOutlet(o.id)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    selectedOutlets.includes(o.id)
                      ? "bg-foreground text-background border-foreground"
                      : "border-border/40 text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                  data-testid={`inv-val-outlet-${o.code || o.id}`}
                >
                  <Store className="h-3 w-3 inline mr-1" />
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
          data-testid="inv-val-download-btn"
        >
          <Download className="h-4 w-4 mr-2" />
          {downloading ? "Generating..." : "Download Excel"}
        </Button>
      </Card>
    </div>
  );
}
