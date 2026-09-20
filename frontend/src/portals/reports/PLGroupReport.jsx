/** Custom P&L FnB Group Format — multi-month Excel export */
import { useState, useEffect } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import useOutletScope from "@/hooks/useOutletScope";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function startOfYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-01`;
}

export default function PLGroupReport() {
  const { allOutlets } = useOutletScope();
  const outlets = allOutlets;
  const [periodFrom, setPeriodFrom] = useState(startOfYearMonth());
  const [periodTo, setPeriodTo] = useState(currentMonth());
  const [dimOutlet, setDimOutlet] = useState("all");
  const [downloading, setDownloading] = useState(false);

  async function downloadExcel() {
    if (!periodFrom || !/^\d{4}-\d{2}$/.test(periodFrom) || !periodTo || !/^\d{4}-\d{2}$/.test(periodTo)) {
      toast.error("Period harus format YYYY-MM");
      return;
    }
    if (periodFrom > periodTo) {
      toast.error("Period From harus <= Period To");
      return;
    }
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      params.append("period_from", periodFrom);
      params.append("period_to", periodTo);
      if (dimOutlet && dimOutlet !== "all") params.append("dim_outlet", dimOutlet);

      const response = await api.get(`/reports/finance/pl-group.xlsx?${params.toString()}`, {
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `profit_loss_group_${periodFrom}_to_${periodTo}.xlsx`;
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
    <div className="space-y-4" data-testid="pl-group-report-page">
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/5 border border-amber-500/30 flex items-center justify-center">
            <FileSpreadsheet className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold" data-testid="pl-group-title">Profit &amp; Loss — FnB Group Format</h1>
            <p className="text-xs text-muted-foreground">Income statement multi-bulan dengan kolom per bulan + YTD, format custom FnB Group (Revenue / COGS / Gross Profit / OPEX / Net Income)</p>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-4 text-sm">Filters</h3>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Period From (YYYY-MM)</Label>
            <Input
              type="month"
              value={periodFrom}
              onChange={e => setPeriodFrom(e.target.value)}
              className="mt-1 h-9"
              data-testid="plt-period-from"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Period To (YYYY-MM)</Label>
            <Input
              type="month"
              value={periodTo}
              onChange={e => setPeriodTo(e.target.value)}
              className="mt-1 h-9"
              data-testid="plt-period-to"
            />
            <p className="text-xs text-muted-foreground mt-1">Maksimal 24 bulan</p>
          </div>
        </div>

        <div className="mb-4">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Outlet (opsional)</Label>
          <Select value={dimOutlet} onValueChange={setDimOutlet}>
            <SelectTrigger className="mt-1 h-9" data-testid="plt-outlet-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Outlet (Konsolidasi)</SelectItem>
              {outlets.map(o => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={downloadExcel}
          disabled={downloading}
          className="w-full rounded-full gap-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white"
          data-testid="plt-download-btn"
        >
          <Download className="h-4 w-4" />
          {downloading ? "Generating..." : "Download Excel Report"}
        </Button>
      </Card>

      <Card className="p-5 bg-amber-50/30 dark:bg-amber-950/10 border-amber-200/40">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Format Detail</h4>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li><strong>A. Revenue</strong> — list semua akun pendapatan per bulan</li>
          <li><strong>B. COGS</strong> — Cost of Goods Sold per bulan</li>
          <li><strong>C. Gross Profit (A − B)</strong> — termasuk Gross Margin %</li>
          <li><strong>D. Operating Expense</strong> — semua akun biaya operasional</li>
          <li><strong>E. Net Income (C − D)</strong> — termasuk Net Margin %, color-coded (hijau positif, merah negatif)</li>
          <li>Setiap baris akun ditampilkan untuk semua bulan + kolom <strong>YTD</strong> di akhir</li>
        </ul>
      </Card>
    </div>
  );
}
