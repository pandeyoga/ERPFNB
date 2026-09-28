/** Trial Balance Report — Excel export per period (YYYY-MM) dengan optional outlet */
import { useState, useEffect } from "react";
import { Download, Scale } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import useOutletScope from "@/hooks/useOutletScope";

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function TrialBalanceReport() {
  const { allOutlets } = useOutletScope();
  const outlets = allOutlets;
  const [period, setPeriod] = useState(currentPeriod());
  const [dimOutlet, setDimOutlet] = useState("all");
  const [downloading, setDownloading] = useState(false);

  async function downloadExcel() {
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      toast.error("Period harus format YYYY-MM (contoh: 2026-04)");
      return;
    }
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      params.append("period", period);
      if (dimOutlet && dimOutlet !== "all") params.append("dim_outlet", dimOutlet);

      const response = await api.get(`/reports/finance/trial-balance.xlsx?${params.toString()}`, {
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trial_balance_${period}.xlsx`;
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

  return (
    <div className="space-y-4" data-testid="trial-balance-report-page">
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/5 border border-amber-500/30 flex items-center justify-center">
            <Scale className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold" data-testid="trial-balance-title">Trial Balance Report</h1>
            <p className="text-xs text-muted-foreground">Account balances per period dengan opening, period activity, dan closing — untuk closing accounting</p>
          </div>
        </div>
      </Card>

      <Card className="p-5" data-testid="tb-filter-card">
        <h3 className="font-semibold mb-4 text-sm">Filters</h3>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Period (YYYY-MM)</Label>
            <Input
              type="month"
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="mt-1 h-9"
              data-testid="tb-period-input"
            />
            <p className="text-xs text-muted-foreground mt-1">Contoh: 2026-04</p>
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Outlet (opsional)</Label>
            <Select value={dimOutlet} onValueChange={setDimOutlet}>
              <SelectTrigger className="mt-1 h-9" data-testid="tb-outlet-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="tb-outlet-all">All Outlet (konsolidasi)</SelectItem>
                {outlets.map(o => (
                  <SelectItem key={o.id} value={o.id} data-testid={`tb-outlet-${o.code || o.id}`}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={downloadExcel}
          disabled={downloading}
          className="w-full rounded-full gap-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white"
          data-testid="tb-download-btn"
        >
          <Download className="h-4 w-4" />
          {downloading ? "Downloading..." : "Download Excel Report"}
        </Button>
      </Card>
    </div>
  );
}
