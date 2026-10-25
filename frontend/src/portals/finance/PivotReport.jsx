/** Pivot — 2D matrix with cell heat-map + row/col totals + CSV export. */
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { Button } from "@/components/ui/button";
import LoadingState from "@/components/shared/LoadingState";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import { fmtRp, fmtNumber, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";

const LABEL = "text-xs font-medium text-muted-foreground";
const shortLabel = (label, fallback) => String(label || fallback || "").split(" (")[0];

export default function PivotReport() {
  const [catalog, setCatalog] = useState(null);
  const [dimX, setDimX] = useState("month");
  const [dimY, setDimY] = useState("outlet");
  const [metric, setMetric] = useState("sales");
  const [periodFrom, setPeriodFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 90);
    return d.toISOString().slice(0, 10);
  });
  const [periodTo, setPeriodTo] = useState(todayJakartaISO());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/reports/catalog").then(r => setCatalog(unwrap(r))).catch(() => {});
  }, []);

  async function load() {
    if (dimX === dimY) { toast.error("Dimensi baris & kolom harus berbeda"); return; }
    setLoading(true);
    try {
      const r = await api.get("/reports/pivot", {
        params: { dim_x: dimX, dim_y: dimY, metric, period_from: periodFrom, period_to: periodTo },
      });
      setData(unwrap(r));
    } catch (e) {
      toast.error("Gagal memuat pivot: " + (e.response?.data?.errors?.[0]?.message || e.message));
    } finally { setLoading(false); }
  }
  useEffect(() => { if (catalog) load(); }, [dimX, dimY, metric, periodFrom, periodTo, catalog]); // eslint-disable-line

  function exportCsv() {
    if (!data) return;
    const lines = [`${dimY}\\${dimX},${data.x_labels.join(",")},Total`];
    data.y_labels.forEach((yl, i) => {
      lines.push([`"${yl}"`, ...data.cells[i], data.row_totals[i]].join(","));
    });
    lines.push(["Total", ...data.col_totals, data.grand_total].join(","));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `pivot-${dimY}_x_${dimX}-${metric}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Find cell max for heatmap intensity
  const maxCell = data ? Math.max(1, ...data.cells.flat()) : 1;

  if (!catalog) return (
    <div className="space-y-4" data-testid="pivot-page">
      <LoadingState rows={3} />
    </div>
  );

  const isCount = metric === "transaction_count" || metric === "po_count" || metric === "gr_count";
  const fmt = isCount ? fmtNumber : fmtRp;
  const dimLabel = (key) => shortLabel(catalog.dimensions.find(d => d.key === key)?.label, key);
  const metricName = shortLabel(catalog.metrics.find(m => m.key === metric)?.label, metric);

  const pivotColumns = data ? [
    { key: "__label", label: `${dimLabel(dimY)} \\ ${dimLabel(dimX)}`, primary: true,
      render: (r) => <span className="font-medium">{r.__label}</span> },
    ...data.x_labels.map((xl, ci) => ({
      key: `c${ci}`, label: xl, numeric: true, className: "relative",
      render: (r) => {
        const v = r[`c${ci}`];
        const intensity = maxCell > 0 ? v / maxCell : 0;
        return (
          <>
            <span className="absolute inset-0 m-0.5 rounded pointer-events-none"
              style={{ background: `rgba(124, 76, 196, ${0.05 + intensity * 0.35})` }} />
            <span className="relative" data-testid={`pivot-cell-${r.__ri}-${ci}`}>{v === 0 ? "—" : fmt(v)}</span>
          </>
        );
      },
    })),
    { key: "__total", label: "Total", numeric: true,
      render: (r) => <span className="font-bold">{fmt(r.__total)}</span> },
  ] : [];

  const pivotRows = data ? data.y_labels.map((yl, ri) => {
    const row = { id: yl, __ri: ri, __label: yl, __total: data.row_totals[ri] };
    data.cells[ri].forEach((v, ci) => { row[`c${ci}`] = v; });
    return row;
  }) : [];

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="pivot-page">
      <div className="glass-card p-3 grid grid-cols-2 lg:grid-cols-6 gap-3 items-end">
        <div>
          <Label className={LABEL}>Baris (sumbu Y)</Label>
          <SimpleSelect value={dimY} onValueChange={setDimY} ariaLabel="Baris (sumbu Y)"
            options={catalog.dimensions.map(d => ({ value: d.key, label: d.label }))}
            className="glass-input rounded-lg w-full h-9 text-sm mt-1" testId="pivot-dim-y" />
        </div>
        <div>
          <Label className={LABEL}>Kolom (sumbu X)</Label>
          <SimpleSelect value={dimX} onValueChange={setDimX} ariaLabel="Kolom (sumbu X)"
            options={catalog.dimensions.filter(d => d.key !== dimY).map(d => ({ value: d.key, label: d.label }))}
            className="glass-input rounded-lg w-full h-9 text-sm mt-1" testId="pivot-dim-x" />
        </div>
        <div>
          <Label className={LABEL}>Metrik</Label>
          <SimpleSelect value={metric} onValueChange={setMetric} ariaLabel="Metrik"
            options={catalog.metrics.map(m => ({ value: m.key, label: shortLabel(m.label, m.key) }))}
            className="glass-input rounded-lg w-full h-9 text-sm mt-1" testId="pivot-metric" />
        </div>
        <div>
          <Label htmlFor="pivot-from" className={LABEL}>Dari</Label>
          <Input id="pivot-from" type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)}
            className="glass-input mt-1 h-9" data-testid="pivot-from" />
        </div>
        <div>
          <Label htmlFor="pivot-to" className={LABEL}>Hingga</Label>
          <Input id="pivot-to" type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)}
            className="glass-input mt-1 h-9" data-testid="pivot-to" />
        </div>
        <Button onClick={exportCsv} variant="outline" className="col-span-2 lg:col-span-1"
          disabled={!data} data-testid="pivot-export-csv">
          <Download /> Ekspor CSV
        </Button>
      </div>

      {loading && <LoadingState rows={6} />}

      {!loading && data && (
        <div className="glass-card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm md:text-base font-semibold">{dimLabel(dimY)} × {dimLabel(dimX)} — {metricName}</h3>
            <div className="text-sm">
              Total: <span className="font-semibold tabular-nums">{fmt(data.grand_total)}</span>
            </div>
          </div>
          <DataTable
            rows={pivotRows}
            columns={pivotColumns}
            keyField="id"
            rowTestIdPrefix="pivot-row"
            empty={<div className="p-4"><EmptyState title="Tidak ada data" description="Tidak ada data untuk kombinasi dimensi/periode ini." /></div>}
            footer={data.y_labels.length > 0 ? (
              <tr className="bg-muted/30 font-bold border-t-2 border-border">
                <td className="px-4 py-3">Total</td>
                {data.col_totals.map((c, i) => (
                  <td key={i} className="px-4 py-3 text-right tabular-nums">{fmt(c)}</td>
                ))}
                <td className="px-4 py-3 text-right tabular-nums">{fmt(data.grand_total)}</td>
              </tr>
            ) : null}
          />
        </div>
      )}
    </div>
  );
}
