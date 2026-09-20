/** Journal Ledger Report — Excel export dengan period, COA, outlet & source filters */
import { useState, useEffect } from "react";
import { Download, BookOpen, Store } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { todayJakartaISO } from "@/lib/format";
import useOutletScope from "@/hooks/useOutletScope";

export default function JournalLedgerReport() {
  // Bug fix 2026-05-26: useOutletScope was imported but never invoked.
  const { scopedOutlets: outlets } = useOutletScope();
  const [periodFrom, setPeriodFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [periodTo, setPeriodTo] = useState(todayJakartaISO());
  const [coaList, setCoaList] = useState([]);
  const [coaId, setCoaId] = useState("all");
  const [selectedOutlets, setSelectedOutlets] = useState([]);
  const [sourceType, setSourceType] = useState("all");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api.get("/finance/coa", { params: { per_page: 500 } })
      .then(r => setCoaList(r.data?.data || []))
      .catch(() => {});
  }, []);

  async function downloadExcel() {
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (periodFrom) params.append("period_from", periodFrom);
      if (periodTo) params.append("period_to", periodTo);
      if (coaId && coaId !== "all") params.append("coa_id", coaId);
      if (selectedOutlets.length > 0) params.append("outlet_ids", selectedOutlets.join(","));
      if (sourceType && sourceType !== "all") params.append("source_type", sourceType);

      const response = await api.get(`/reports/finance/journal-ledger.xlsx?${params.toString()}`, {
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `journal_ledger_${periodFrom}_${periodTo}.xlsx`;
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
    <div className="space-y-4" data-testid="journal-ledger-report-page">
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/5 border border-amber-500/30 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold" data-testid="journal-ledger-title">Journal Ledger Report</h1>
            <p className="text-xs text-muted-foreground">General Ledger entries dengan COA detail, Dr/Cr, dan dimensi outlet/brand</p>
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
              value={periodFrom}
              onChange={e => setPeriodFrom(e.target.value)}
              className="mt-1 h-9"
              data-testid="jl-period-from"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hingga Tanggal</Label>
            <Input
              type="date"
              value={periodTo}
              onChange={e => setPeriodTo(e.target.value)}
              className="mt-1 h-9"
              data-testid="jl-period-to"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">COA (Akun)</Label>
            <Select value={coaId} onValueChange={setCoaId}>
              <SelectTrigger className="mt-1 h-9" data-testid="jl-coa-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Akun</SelectItem>
                {coaList.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.code} - {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Source</Label>
            <Select value={sourceType} onValueChange={setSourceType}>
              <SelectTrigger className="mt-1 h-9" data-testid="jl-source-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Source</SelectItem>
                <SelectItem value="manual">Manual JE</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="goods_receipt">Goods Receipt</SelectItem>
                <SelectItem value="payment">Payment</SelectItem>
                <SelectItem value="petty_cash">Petty Cash</SelectItem>
                <SelectItem value="adjustment">Inventory Adjustment</SelectItem>
                <SelectItem value="payroll">Payroll</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
                  data-testid={`jl-outlet-filter-${o.code || o.id}`}
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
          className="w-full rounded-full gap-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white"
          data-testid="jl-download-btn"
        >
          <Download className="h-4 w-4" />
          {downloading ? "Downloading..." : "Download Excel Report"}
        </Button>
      </Card>
    </div>
  );
}
