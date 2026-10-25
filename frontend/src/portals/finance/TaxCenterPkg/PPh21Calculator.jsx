/** TaxCenter/PPh21Calculator.jsx */
import { useState } from "react";
import { Calculator, RefreshCw } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { fmtRp } from "@/lib/format";
import { toast } from "sonner";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PTKP_OPTIONS = [
  "TK/0", "TK/1", "TK/2", "TK/3",
  "K/0",  "K/1",  "K/2",  "K/3",
  "K/I/0","K/I/1","K/I/2","K/I/3",
];

function PPh21Calculator() {
  const [monthly, setMonthly] = useState("");
  const [ptkp, setPtkp] = useState("TK/0");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function calculate() {
    if (!monthly || isNaN(parseFloat(monthly))) { toast.error("Isi gaji bulanan terlebih dahulu"); return; }
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
      toast.error("Gagal menghitung: " + (e.message || "Kesalahan"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-card p-4 space-y-3" data-testid="pph21-calculator">
      <h3 className="text-sm md:text-base font-semibold flex items-center gap-2">
        <Calculator className="h-4 w-4 text-violet-600 dark:text-violet-300" /> Kalkulator PPh 21 (Preview)
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="pph21-calc-monthly" className="text-xs md:text-sm font-medium">Gaji Bulanan (Rp)</Label>
          <Input
            id="pph21-calc-monthly"
            type="number" min="0" placeholder="5000000"
            value={monthly} onChange={e => setMonthly(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs md:text-sm font-medium">Status PTKP</Label>
          <SimpleSelect
            value={ptkp} onValueChange={setPtkp}
            ariaLabel="Status PTKP"
            className="w-full"
            options={PTKP_OPTIONS.map(o => ({ value: o, label: o }))}
          />
        </div>
      </div>
      <Button onClick={calculate} disabled={loading} size="sm" variant="outline" data-testid="pph21-calc-btn">
        {loading ? <RefreshCw className="animate-spin" /> : <Calculator />}
        Hitung
      </Button>
      {result && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-3 border-t border-border/50">
          {[
            ["Bruto tahunan",    fmtRp(result.annual_gross)],
            ["PTKP",             fmtRp(result.ptkp_annual)],
            ["PKP (kena pajak)", fmtRp(result.annual_pkp)],
            ["PPh 21 tahunan",   fmtRp(result.annual_tax)],
            ["PPh 21 / bulan",   fmtRp(result.monthly_tax)],
            ["Tarif efektif",    `${result.effective_rate}%`],
          ].map(([k, v]) => (
            <div key={k} className="text-sm">
              <div className="text-xs text-muted-foreground">{k}</div>
              <div className="font-semibold tabular-nums">{v}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PPh21Calculator;
