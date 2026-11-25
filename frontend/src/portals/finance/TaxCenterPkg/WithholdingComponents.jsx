/** TaxCenter/WithholdingComponents.jsx — withholding preview + helper tables. */
import { useEffect, useState } from "react";
import { Calculator, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { fmtRp } from "@/lib/format";
import { toast } from "sonner";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import DataTable from "@/components/shared/DataTable";

// ───── helpers ────────────────────────────────────────────────────────

function WithholdingCalcPreview({ taxType, serviceTypes, defaultService }) {
  const [gross, setGross] = useState("");
  const [stype, setStype] = useState(defaultService || (serviceTypes[0]?.code ?? ""));
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const label = taxType === "pph23" ? "PPh 23" : "PPh 4(2)";
  const grossId = `${taxType}-calc-gross`;

  async function calculate() {
    if (!gross || isNaN(parseFloat(gross))) { toast.error("Isi jumlah bruto terlebih dahulu"); return; }
    setLoading(true);
    try {
      const calcRes2 = await api.post("/tax/calculate", {
        tax_type: taxType,
        gross_amount: parseFloat(gross),
        service_type: stype,
      });
      setResult(unwrap(calcRes2));
    } catch(e) {
      toast.error("Gagal menghitung: " + (e.message || "Kesalahan"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-card p-4 space-y-3">
      <h3 className={cn("text-sm md:text-base font-semibold flex items-center gap-2")}>
        <Calculator className={cn("h-4 w-4", taxType === "pph23" ? "text-amber-800 dark:text-amber-300" : "text-rose-700 dark:text-rose-300")} />
        Kalkulator {label}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={grossId} className="text-xs md:text-sm font-medium">Jumlah Bruto (Rp)</Label>
          <Input id={grossId} type="number" min="0" placeholder="10000000"
            value={gross} onChange={e => setGross(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs md:text-sm font-medium">Jenis Transaksi</Label>
          <SimpleSelect value={stype} onValueChange={setStype} ariaLabel="Jenis transaksi"
            className="w-full"
            options={serviceTypes.map(s => ({ value: s.code, label: `${s.label} (${(s.rate * 100).toFixed(0)}%)` }))} />
        </div>
      </div>
      <Button onClick={calculate} disabled={loading} size="sm" variant="outline" data-testid={`${taxType}-calc-btn`}>
        {loading ? <RefreshCw className="animate-spin" /> : <Calculator />}
        Hitung
      </Button>
      {result && result.enabled !== false && (
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/50 text-sm">
          {[
            ["Bruto", fmtRp(result.gross_amount)],
            ["PPh dipotong", fmtRp(result.wh_amount)],
            ["Net dibayar", fmtRp(result.net_amount)],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="text-muted-foreground text-xs">{k}</div>
              <div className="font-semibold tabular-nums">{v}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ───── BracketsTable ────────────────────────────────────────────────────────────
function BracketsTable({ brackets }) {
  const [open, setOpen] = useState(false);
  if (!brackets?.length) return null;
  return (
    <div className="border border-violet-500/25 rounded-lg overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-violet-500/10 hover:bg-violet-500/15 text-sm font-medium text-violet-800 dark:text-violet-200 transition-colors"
        data-testid="pph21-brackets-toggle"
      >
        <span>Tabel Tarif PPh 21 Progresif (UU HPP No. 7/2021)</span>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {open && (
        <DataTable
          rows={brackets.map((b, i) => ({ ...b, _idx: i }))}
          keyField="_idx"
          stickyHeader={false}
          rowTestIdPrefix="pph21-bracket"
          columns={[
            { key: "range", label: "Rentang PKP", primary: true,
              render: (b) => (
                <span>{b.lower === 0 ? "s.d." : `> ${fmtRp(b.lower)} –`} {b.upper ? fmtRp(b.upper) : "tak terbatas"}</span>
              ) },
            { key: "rate_pct", label: "Tarif", numeric: true,
              render: (b) => <span className="font-semibold text-violet-700 dark:text-violet-300">{b.rate_pct}%</span> },
          ]}
        />
      )}
    </div>
  );
}

// ───── WithholdingSummaryTable ────────────────────────────────────────────────
function WithholdingSummaryTable({ year }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get("/tax/withholding/summary", { params: { year } })
      .then(res => setRows(unwrap(res) || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [year]);

  if (loading) return <div className="py-4 text-center text-sm text-muted-foreground">Memuat…</div>;

  return (
    <DataTable
      rows={rows.map((r, i) => ({ ...r, _idx: i }))}
      keyField="_idx"
      stickyHeader={false}
      rowTestIdPrefix="wh-summary-row"
      empty={<p className="text-sm text-muted-foreground py-4 text-center">Belum ada transaksi withholding pada tahun {year}.</p>}
      columns={[
        { key: "period", label: "Periode", primary: true, sortable: true,
          render: (r) => <span className="font-medium tabular-nums">{r.period}</span> },
        { key: "wh_type", label: "Jenis PPh",
          render: (r) => (
            <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium",
              r.wh_type === "pph21" ? "bg-violet-500/15 text-violet-800 dark:text-violet-300" :
              r.wh_type === "pph23" ? "bg-amber-500/15 text-amber-800 dark:text-amber-300" :
              "bg-rose-500/15 text-rose-800 dark:text-rose-300")
            }>{r.wh_type_label}</span>
          ) },
        { key: "count", label: "#Transaksi", numeric: true, sortable: true },
        { key: "gross_total", label: "Bruto", numeric: true, sortable: true,
          render: (r) => fmtRp(r.gross_total) },
        { key: "wh_total", label: "PPh Dipotong", numeric: true, sortable: true,
          render: (r) => <span className="text-red-700 dark:text-red-400 font-medium">{fmtRp(r.wh_total)}</span> },
        { key: "net_total", label: "Net", numeric: true,
          render: (r) => <span className="text-emerald-700 dark:text-emerald-400 font-medium">{fmtRp(r.net_total)}</span> },
      ]}
    />
  );
}

// ───── ServiceTypeList ────────────────────────────────────────────────────────────
function ServiceTypeList({ types, color }) {
  const badge = color === "amber"
    ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
    : "bg-rose-500/15 text-rose-800 dark:text-rose-300";
  return (
    <DataTable
      rows={types}
      keyField="code"
      stickyHeader={false}
      rowTestIdPrefix="svc-type-row"
      columns={[
        { key: "code", label: "Kode", primary: true,
          render: (t) => <span className="text-xs font-medium tabular-nums">{t.code}</span> },
        { key: "label", label: "Jenis", render: (t) => t.label },
        { key: "rate", label: "Tarif", numeric: true,
          render: (t) => (
            <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold", badge)}>
              {(t.rate * 100).toFixed(0)}%
            </span>
          ) },
      ]}
    />
  );
}

// ───── MAIN TaxCenter ────────────────────────────────────────────────────────────
export { WithholdingCalcPreview, BracketsTable, WithholdingSummaryTable, ServiceTypeList };
