/** TaxCenter/PPh21Calculator.jsx */
import { useEffect, useState, useCallback } from "react";
import { Receipt, ToggleLeft, ToggleRight, Calculator, ChevronDown, ChevronRight,
         AlertTriangle, CheckCircle2, Info, RefreshCw, TrendingDown, FileDown } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { fmtRp, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import LoadingState from "@/components/shared/LoadingState";

// ───── helpers ────────────────────────────────────────────────────────

function PPh21Calculator() {
  const [monthly, setMonthly] = useState("");
  const [ptkp, setPtkp] = useState("TK/0");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const PTKP_OPTIONS = [
    "TK/0", "TK/1", "TK/2", "TK/3",
    "K/0",  "K/1",  "K/2",  "K/3",
    "K/I/0","K/I/1","K/I/2","K/I/3",
  ];

  async function calculate() {
    if (!monthly || isNaN(parseFloat(monthly))) return;
    setLoading(true);
    try {
      const calcRes1 = await api.post("/tax/calculate", {
        tax_type: "pph21",
        gross_amount: parseFloat(monthly),
        monthly_gross: parseFloat(monthly),
        ptkp_status: ptkp,
      });
      setResult(unwrap(calcRes1));
    } catch(e) {
      toast.error("Gagal kalkulasi: " + (e.message || "Error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 space-y-4">
      <h4 className="font-semibold text-purple-800 flex items-center gap-2">
        <Calculator size={16} /> Kalkulator PPh 21 (Preview)
      </h4>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-purple-700">Gaji Bulanan (Rp)</Label>
          <Input
            type="number" min="0" placeholder="5000000"
            value={monthly} onChange={e => setMonthly(e.target.value)}
            className="border-purple-200"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-purple-700">Status PTKP</Label>
          <SimpleSelect
            value={ptkp} onValueChange={setPtkp}
            className="w-full h-9 px-3 rounded-md border border-purple-200 text-sm bg-white"
            options={PTKP_OPTIONS.map(o => ({ value: o, label: o }))}
          />
        </div>
      </div>
      <Button onClick={calculate} disabled={loading} size="sm" variant="outline"
        className="border-purple-300 text-purple-700 hover:bg-purple-100">
        {loading ? <RefreshCw size={14} className="animate-spin mr-1" /> : <Calculator size={14} className="mr-1" />}
        Hitung
      </Button>
      {result && (
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-purple-200">
          {[
            ["Annual Gross",   fmtRp(result.annual_gross)],
            ["PTKP",           fmtRp(result.ptkp_annual)],
            ["PKP (kena pajak)",fmtRp(result.annual_pkp)],
            ["PPh 21 Tahunan", fmtRp(result.annual_tax)],
            ["PPh 21/bulan",   fmtRp(result.monthly_tax)],
            ["Effective Rate", `${result.effective_rate}%`],
          ].map(([k, v]) => (
            <div key={k} className="text-sm">
              <span className="text-gray-500">{k}: </span>
              <span className="font-semibold text-purple-800">{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ───── PPh Calc Preview (PPh23/PPh42) ─────────────────────────────────────────
export default PPh21Calculator;
