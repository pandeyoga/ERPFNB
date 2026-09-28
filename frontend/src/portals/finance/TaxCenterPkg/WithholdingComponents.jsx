/** TaxCenter/WithholdingComponents.jsx — withholding preview + helper tables. */
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
import DataTable from "@/components/shared/DataTable";

// ───── helpers ────────────────────────────────────────────────────────

function WithholdingCalcPreview({ taxType, serviceTypes, defaultService }) {
  const color = taxType === "pph23" ? "amber" : "rose";
  const [gross, setGross] = useState("");
  const [stype, setStype] = useState(defaultService || (serviceTypes[0]?.code ?? ""));
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function calculate() {
    if (!gross || isNaN(parseFloat(gross))) return;
    setLoading(true);
    try {
      const calcRes2 = await api.post("/tax/calculate", {
        tax_type: taxType,
        gross_amount: parseFloat(gross),
        service_type: stype,
      });
      setResult(unwrap(calcRes2));
    } catch(e) {
      toast.error("Gagal: " + (e.message || "Error"));
    } finally {
      setLoading(false);
    }
  }

  const borderCol = color === "amber" ? "border-amber-200 bg-amber-50" : "border-rose-200 bg-rose-50";
  const headCol  = color === "amber" ? "text-amber-800" : "text-rose-800";
  const btnCol   = color === "amber"
    ? "border-amber-300 text-amber-700 hover:bg-amber-100"
    : "border-rose-300 text-rose-700 hover:bg-rose-100";
  const divCol   = color === "amber" ? "border-amber-200" : "border-rose-200";

  return (
    <div className={cn("rounded-xl border p-4 space-y-4", borderCol)}>
      <h4 className={cn("font-semibold flex items-center gap-2", headCol)}>
        <Calculator size={16} /> Kalkulator {taxType === "pph23" ? "PPh 23" : "PPh 4(2)"}
      </h4>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Jumlah Bruto (Rp)</Label>
          <Input type="number" min="0" placeholder="10000000"
            value={gross} onChange={e => setGross(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Jenis Transaksi</Label>
          <SimpleSelect value={stype} onValueChange={setStype}
            className="w-full h-9 px-3 rounded-md border text-sm bg-white"
            options={serviceTypes.map(s => ({ value: s.code, label: `${s.label} (${(s.rate * 100).toFixed(0)}%)` }))} />
        </div>
      </div>
      <Button onClick={calculate} disabled={loading} size="sm" variant="outline" className={btnCol}>
        {loading ? <RefreshCw size={14} className="animate-spin mr-1" /> : <Calculator size={14} className="mr-1" />}
        Hitung
      </Button>
      {result && result.enabled !== false && (
        <div className={cn("grid grid-cols-3 gap-2 pt-2 border-t text-sm", divCol)}>
          {[
            ["Bruto", fmtRp(result.gross_amount)],
            ["PPh Dipotong", fmtRp(result.wh_amount)],
            ["Net Dibayar", fmtRp(result.net_amount)],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="text-gray-500 text-xs">{k}</div>
              <div className="font-semibold">{v}</div>
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
    <div className="border border-purple-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-purple-50 hover:bg-purple-100 text-sm font-medium text-purple-800 transition-colors"
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
              render: (b) => <span className="font-semibold text-purple-700">{b.rate_pct}%</span> },
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

  if (loading) return <div className="py-4 text-center text-sm text-gray-400">Memuat...</div>;

  return (
    <DataTable
      rows={rows.map((r, i) => ({ ...r, _idx: i }))}
      keyField="_idx"
      stickyHeader={false}
      rowTestIdPrefix="wh-summary-row"
      empty={<p className="text-sm text-gray-400 py-4 text-center">Belum ada transaksi withholding.</p>}
      columns={[
        { key: "period", label: "Periode", primary: true, sortable: true,
          render: (r) => <span className="font-mono">{r.period}</span> },
        { key: "wh_type", label: "Jenis PPh",
          render: (r) => (
            <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium",
              r.wh_type === "pph21" ? "bg-purple-100 text-purple-700" :
              r.wh_type === "pph23" ? "bg-amber-100 text-amber-700" :
              "bg-rose-100 text-rose-700")
            }>{r.wh_type_label}</span>
          ) },
        { key: "count", label: "#Transaksi", numeric: true, sortable: true },
        { key: "gross_total", label: "Bruto", numeric: true, sortable: true,
          render: (r) => fmtRp(r.gross_total) },
        { key: "wh_total", label: "PPh Dipotong", numeric: true, sortable: true,
          render: (r) => <span className="text-red-600 font-medium">{fmtRp(r.wh_total)}</span> },
        { key: "net_total", label: "Net", numeric: true,
          render: (r) => <span className="text-green-700 font-medium">{fmtRp(r.net_total)}</span> },
      ]}
    />
  );
}

// ───── ServiceTypeList ────────────────────────────────────────────────────────────
function ServiceTypeList({ types, color }) {
  const badge = color === "amber" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700";
  return (
    <DataTable
      rows={types}
      keyField="code"
      stickyHeader={false}
      rowTestIdPrefix="svc-type-row"
      columns={[
        { key: "code", label: "Kode", primary: true,
          render: (t) => <span className="font-mono text-xs">{t.code}</span> },
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
