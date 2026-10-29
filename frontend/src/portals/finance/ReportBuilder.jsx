/** Report Builder lite — pick dimensions × metrics × filters, run, save. */
import { useEffect, useState } from "react";
import { Play, Save, Download, Trash2, FolderOpen } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import LoadingState from "@/components/shared/LoadingState";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import { fmtRp, fmtNumber, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import useOutletScope from "@/hooks/useOutletScope";
import { confirmDialog } from "@/components/shared/confirmDialog";

import { fetchAll } from "@/lib/api";

const LABEL = "text-xs font-medium text-muted-foreground";

/** Label metrik ringkas: "Sales (validated daily_sales grand_total)" → "Sales". */
function shortLabel(label, fallback) {
  return String(label || fallback || "").split(" (")[0];
}

/** Gaya chip toggle (multi-select) — satu gaya untuk dimensi, metrik, dan filter. */
function chipClass(selected) {
  return cn(
    "h-8 px-2.5 rounded-[calc(var(--radius)-4px)] text-[13px] font-medium border transition-colors",
    selected
      ? "pill-active border-transparent"
      : "border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/30",
  );
}

export default function ReportBuilder() {
  const [catalog, setCatalog] = useState(null);
  const [brands, setBrands] = useState([]);
  const [vendors, setVendors] = useState([]);
  // Bug fix 2026-05-26: useOutletScope was imported but never invoked.
  const { scopedOutlets: outlets } = useOutletScope();

  const [dimensions, setDimensions] = useState(["outlet"]);
  const [metrics, setMetrics] = useState(["sales", "gross_profit"]);
  const [periodFrom, setPeriodFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 60);
    return d.toISOString().slice(0, 10);
  });
  const [periodTo, setPeriodTo] = useState(todayJakartaISO());
  const [outletIds, setOutletIds] = useState([]);
  const [brandIds, setBrandIds] = useState([]);
  const [vendorIds, setVendorIds] = useState([]);

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const [savedList, setSavedList] = useState([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");

  // Load catalog + masters on mount
  useEffect(() => {
    Promise.all([
      api.get("/reports/catalog").then(r => setCatalog(unwrap(r))),
      fetchAll("/master/brands").then(r => setBrands(unwrap(r) || [])),
      fetchAll("/master/vendors").then(r => setVendors(unwrap(r) || [])),
    ]).catch(() => {});
    loadSaved();
  }, []);

  async function loadSaved() {
    try {
      const r = await api.get("/reports/saved");
      setSavedList(unwrap(r) || []);
    } catch { /* noop */ }
  }

  function toggleArr(arr, setArr, val) {
    if (arr.includes(val)) setArr(arr.filter(x => x !== val));
    else setArr([...arr, val]);
  }

  async function run() {
    if (dimensions.length === 0) { toast.error("Pilih minimal 1 dimensi"); return; }
    if (metrics.length === 0) { toast.error("Pilih minimal 1 metrik"); return; }
    setRunning(true);
    try {
      const payload = {
        dimensions, metrics,
        period_from: periodFrom, period_to: periodTo,
        outlet_ids: outletIds.length ? outletIds : null,
        brand_ids: brandIds.length ? brandIds : null,
        vendor_ids: vendorIds.length ? vendorIds : null,
        limit: 200,
      };
      const r = await api.post("/reports/builder/run", payload);
      setResult(unwrap(r));
    } catch (e) {
      toast.error("Gagal menjalankan report: " + (e.response?.data?.errors?.[0]?.message || e.message));
    } finally { setRunning(false); }
  }

  async function saveReport() {
    if (!saveName.trim()) { toast.error("Nama wajib"); return; }
    try {
      await api.post("/reports/saved", {
        name: saveName.trim(),
        config: {
          type: "builder",
          dimensions, metrics,
          period_from: periodFrom, period_to: periodTo,
          outlet_ids: outletIds, brand_ids: brandIds, vendor_ids: vendorIds,
        },
      });
      toast.success("Report tersimpan");
      setSaveOpen(false); setSaveName("");
      loadSaved();
    } catch (e) {
      toast.error("Gagal menyimpan: " + (e.response?.data?.errors?.[0]?.message || e.message));
    }
  }

  function loadSavedConfig(s) {
    const c = s.config || {};
    setDimensions(c.dimensions || []);
    setMetrics(c.metrics || []);
    setPeriodFrom(c.period_from || periodFrom);
    setPeriodTo(c.period_to || periodTo);
    setOutletIds(c.outlet_ids || []);
    setBrandIds(c.brand_ids || []);
    setVendorIds(c.vendor_ids || []);
    toast.success(`Laporan dimuat: ${s.name}`);
  }

  async function deleteSaved(id) {
    if (!(await confirmDialog("Hapus laporan tersimpan ini?"))) return;
    try {
      await api.delete(`/reports/saved/${id}`);
      loadSaved();
      toast.success("Laporan dihapus");
    } catch { toast.error("Gagal menghapus laporan"); }
  }

  function exportCsv() {
    if (!result?.rows?.length) return;
    const dimCols = dimensions.map(d => `dim_${d}`);
    const headers = [...dimensions, ...metrics];
    const lines = [headers.join(",")];
    result.rows.forEach(r => {
      lines.push([
        ...dimCols.map(c => `"${(r[c] || "").toString().replace(/"/g, '""')}"`),
        ...metrics.map(m => r[m] ?? 0),
      ].join(","));
    });
    lines.push([...dimensions.map(() => ""), ...metrics.map(m => result.totals[m] ?? 0)].join(","));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `builder-${periodFrom}_${periodTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportXlsx() {
    if (!dimensions.length || !metrics.length) {
      toast.error("Pilih minimal 1 dimensi dan 1 metrik");
      return;
    }
    try {
      const payload = {
        dimensions, metrics,
        period_from: periodFrom, period_to: periodTo,
        outlet_ids: outletIds.length ? outletIds : null,
        brand_ids: brandIds.length ? brandIds : null,
        vendor_ids: vendorIds.length ? vendorIds : null,
        title: "Custom Report",
      };
      const response = await api.post("/reports/builder/run.xlsx", payload, { responseType: "blob" });
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-builder_${periodFrom}_${periodTo}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Laporan Excel diunduh");
    } catch (e) {
      toast.error("Gagal ekspor Excel: " + (e.response?.data?.message || e.message));
    }
  }

  if (!catalog) return (
    <div className="space-y-4" data-testid="report-builder-page">
      <LoadingState rows={3} />
    </div>
  );

  const isCountMetric = (m) => m === "transaction_count" || m === "po_count" || m === "gr_count";
  const dimLabel = (key) => shortLabel(catalog.dimensions.find(d => d.key === key)?.label, key);
  const metricLabel = (key) => shortLabel(catalog.metrics.find(m => m.key === key)?.label, key);
  const builderColumns = [
    ...dimensions.map((d, i) => ({ key: `dim_${d}`, label: dimLabel(d), primary: i === 0,
      render: (r) => <span className="font-medium">{r[`dim_${d}`]}</span> })),
    ...metrics.map((m) => ({ key: m, label: metricLabel(m), numeric: true, sortable: true,
      render: (r) => (isCountMetric(m) ? fmtNumber(r[m]) : fmtRp(r[m])) })),
  ];

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="report-builder-page">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
        {/* Config panel */}
        <div className="lg:col-span-2 space-y-3 lg:space-y-4">
          <div className="glass-card p-4">
            <h3 className="text-sm md:text-base font-semibold mb-3">1. Dimensi (group by)</h3>
            <div className="flex flex-wrap gap-2">
              {catalog.dimensions.map(d => (
                <button key={d.key} type="button" onClick={() => toggleArr(dimensions, setDimensions, d.key)}
                  aria-pressed={dimensions.includes(d.key)}
                  className={chipClass(dimensions.includes(d.key))}
                  data-testid={`builder-dim-${d.key}`}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="glass-card p-4">
            <h3 className="text-sm md:text-base font-semibold mb-3">2. Metrik (kolom)</h3>
            <div className="flex flex-wrap gap-2">
              {catalog.metrics.map(m => (
                <button key={m.key} type="button" onClick={() => toggleArr(metrics, setMetrics, m.key)}
                  aria-pressed={metrics.includes(m.key)} title={m.label}
                  className={chipClass(metrics.includes(m.key))}
                  data-testid={`builder-metric-${m.key}`}>
                  {shortLabel(m.label, m.key)}
                </button>
              ))}
            </div>
          </div>

          <div className="glass-card p-4">
            <h3 className="text-sm md:text-base font-semibold mb-3">3. Filter</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <Label htmlFor="builder-from" className={LABEL}>Dari</Label>
                <Input id="builder-from" type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)}
                  className="glass-input mt-1 h-9" data-testid="builder-from" />
              </div>
              <div>
                <Label htmlFor="builder-to" className={LABEL}>Hingga</Label>
                <Input id="builder-to" type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)}
                  className="glass-input mt-1 h-9" data-testid="builder-to" />
              </div>
            </div>
            <FilterRow label="Outlet" items={outlets} selected={outletIds} setSelected={setOutletIds} testid="builder-outlet" />
            <FilterRow label="Brand" items={brands} selected={brandIds} setSelected={setBrandIds} testid="builder-brand" />
            <FilterRow label="Vendor" items={vendors} selected={vendorIds} setSelected={setVendorIds} testid="builder-vendor" />
          </div>

          <div className="glass-card p-3 flex flex-wrap gap-2 sticky bottom-2 z-10">
            <Button onClick={run} disabled={running} className="flex-1 min-w-[160px]"
              data-testid="builder-run">
              <Play /> {running ? "Menjalankan…" : "Jalankan laporan"}
            </Button>
            <Button onClick={() => setSaveOpen(!saveOpen)} variant="outline" aria-expanded={saveOpen}
              data-testid="builder-save-toggle">
              <Save /> Simpan
            </Button>
            <Button onClick={exportCsv} variant="outline" disabled={!result}
              data-testid="builder-export">
              <Download /> Ekspor CSV
            </Button>
            <Button onClick={exportXlsx} variant="outline"
              data-testid="builder-export-xlsx">
              <Download /> Ekspor Excel
            </Button>
          </div>
          {saveOpen && (
            <div className="glass-card p-3 flex gap-2 items-end">
              <div className="flex-1">
                <Label htmlFor="builder-save-name" className={LABEL}>Nama laporan <span className="text-destructive">*</span></Label>
                <Input id="builder-save-name" value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="contoh: Sales Q1 per Outlet"
                  className="glass-input mt-1 h-9" data-testid="builder-save-name" />
              </div>
              <Button variant="outline" onClick={() => { setSaveOpen(false); setSaveName(""); }} data-testid="builder-save-cancel">Batal</Button>
              <Button onClick={saveReport} data-testid="builder-save">Simpan</Button>
            </div>
          )}
        </div>

        {/* Saved reports */}
        <div className="glass-card p-4 self-start lg:sticky lg:top-4">
          <h3 className="text-sm md:text-base font-semibold mb-3 flex items-center gap-2">
            <FolderOpen className="h-4 w-4" /> Laporan tersimpan
          </h3>
          {savedList.length === 0 && (
            <div className="text-sm text-muted-foreground">Belum ada laporan tersimpan. Atur dimensi &amp; metrik lalu klik Simpan.</div>
          )}
          <div className="space-y-1.5">
            {savedList.map(s => (
              <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
                <button type="button" onClick={() => loadSavedConfig(s)} className="flex-1 min-w-0 text-left"
                  data-testid={`saved-load-${s.id}`}>
                  <div className="text-sm font-medium truncate">{s.name}</div>
                  {s.description && <div className="text-xs text-muted-foreground truncate">{s.description}</div>}
                </button>
                <Button variant="ghost" size="icon-sm" onClick={() => deleteSaved(s.id)}
                  aria-label={`Hapus laporan ${s.name}`}
                  className="text-muted-foreground hover:text-red-600"
                  data-testid={`saved-delete-${s.id}`}>
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="glass-card p-0 overflow-hidden" data-testid="builder-result">
          <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm md:text-base font-semibold">Hasil ({result.row_count} baris)</h3>
            <div className="flex gap-2 flex-wrap">
              {metrics.map(m => (
                <Badge key={m} className="bg-muted/40 text-foreground border-0">
                  Σ {metricLabel(m)}: <span className="font-semibold ml-1">{isCountMetric(m) ? fmtNumber(result.totals[m]) : fmtRp(result.totals[m])}</span>
                </Badge>
              ))}
            </div>
          </div>
          <DataTable
            rows={result.rows}
            columns={builderColumns}
            keyField="id"
            loading={running}
            rowTestIdPrefix="builder-row"
            empty={<div className="p-4"><EmptyState title="Tidak ada data" description="Tidak ada data untuk filter ini." /></div>}
            footer={result.rows.length > 0 ? (
              <tr className="bg-muted/30 font-bold border-t-2 border-border">
                <td colSpan={dimensions.length} className="px-4 py-3">Total</td>
                {metrics.map(m => (
                  <td key={m} className="px-4 py-3 text-right tabular-nums">
                    {isCountMetric(m) ? fmtNumber(result.totals[m]) : fmtRp(result.totals[m])}
                  </td>
                ))}
              </tr>
            ) : null}
          />
        </div>
      )}
    </div>
  );
}

function FilterRow({ label, items, selected, setSelected, testid }) {
  if (!items?.length) return null;
  return (
    <div className="mb-3">
      <div className={cn(LABEL, "mb-1.5")} id={`${testid}-label`}>
        {label} {selected.length > 0 && <span className="text-foreground">({selected.length})</span>}
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby={`${testid}-label`}>
        {items.map(it => (
          <button key={it.id} type="button" onClick={() => {
            if (selected.includes(it.id)) setSelected(selected.filter(x => x !== it.id));
            else setSelected([...selected, it.id]);
          }}
            aria-pressed={selected.includes(it.id)}
            className={chipClass(selected.includes(it.id))}
            data-testid={`${testid}-${it.code || it.id}`}>
            {it.name}
          </button>
        ))}
      </div>
    </div>
  );
}
