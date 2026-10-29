/** Comparatives — MoM/YoY metric comparison with rolling 12m sparkline. */
import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, CalendarDays, History } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SimpleSelect from "@/components/shared/SimpleSelect";
import LoadingState from "@/components/shared/LoadingState";
import CompactStatCard from "@/components/shared/CompactStatCard";
import { fmtRp, fmtNumber } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import useOutletScope from "@/hooks/useOutletScope";

import { fetchAll } from "@/lib/api";

const LABEL = "text-xs font-medium text-muted-foreground";

/** Label metrik ringkas: "Sales (validated daily_sales grand_total)" → "Sales". */
function shortMetricLabel(m) {
  if (!m) return "";
  return String(m.label || m.key || "").split(" (")[0];
}

export default function Comparatives() {
  const [catalog, setCatalog] = useState(null);
  const [brands, setBrands] = useState([]);

  const [metric, setMetric] = useState("sales");
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [compareTo, setCompareTo] = useState("mom");
  const { outletId, setOutletId, scopedOutlets, allOutlets } = useOutletScope();
  const [brandId, setBrandId] = useState("");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/reports/catalog").then(r => setCatalog(unwrap(r))),
      fetchAll("/master/brands").then(r => setBrands(unwrap(r) || [])),
    ]).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    try {
      const params = { metric, period, compare_to: compareTo };
      if (outletId) params.outlet_ids = outletId;
      if (brandId) params.brand_ids = brandId;
      const r = await api.get("/reports/comparatives", { params });
      setData(unwrap(r));
    } catch (e) {
      toast.error("Gagal memuat perbandingan periode: " + (e.response?.data?.errors?.[0]?.message || e.message));
    } finally { setLoading(false); }
  }
  useEffect(() => { if (catalog) load(); }, [metric, period, compareTo, outletId, brandId, catalog]); // eslint-disable-line

  if (!catalog) return (
    <div className="space-y-4" data-testid="comparatives-page">
      <LoadingState rows={3} />
    </div>
  );

  const isCount = metric === "transaction_count" || metric === "po_count" || metric === "gr_count";
  const fmt = isCount ? fmtNumber : fmtRp;
  const metricName = shortMetricLabel(catalog.metrics.find(m => m.key === metric)) || metric;

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="comparatives-page">
      <div className="glass-card p-3 grid grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <div>
          <Label className={LABEL}>Metrik</Label>
          <SimpleSelect value={metric} onValueChange={setMetric} ariaLabel="Metrik"
            options={catalog.metrics.map(m => ({ value: m.key, label: shortMetricLabel(m) }))}
            className="glass-input rounded-lg w-full h-9 text-sm mt-1" testId="comp-metric" />
        </div>
        <div>
          <Label htmlFor="comp-period" className={LABEL}>Periode</Label>
          <Input id="comp-period" type="month" value={period} onChange={e => setPeriod(e.target.value)}
            className="glass-input mt-1 h-9" data-testid="comp-period" />
        </div>
        <div>
          <Label className={LABEL}>Pembanding</Label>
          <div role="group" aria-label="Pembanding"
            className="mt-1 flex w-full items-center gap-1 rounded-[calc(var(--radius)-2px)] border border-border/60 bg-white/35 dark:bg-white/5 p-px">
            {["mom", "yoy"].map(c => (
              <button key={c} type="button" onClick={() => setCompareTo(c)} aria-pressed={compareTo === c}
                className={cn(
                  "h-8 flex-1 rounded-[calc(var(--radius)-4px)] px-2.5 text-[13px] font-medium transition-colors",
                  compareTo === c ? "pill-active" : "text-muted-foreground hover:text-foreground",
                )}
                data-testid={`comp-${c}`}>
                {c.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label className={LABEL}>Outlet</Label>
          <SimpleSelect value={outletId} onValueChange={setOutletId} ariaLabel="Outlet"
            options={[{ value: "", label: "Semua outlet" }, ...scopedOutlets.map(o => ({ value: o.id, label: o.name }))]}
            placeholder="Semua outlet"
            className="glass-input rounded-lg w-full h-9 text-sm mt-1" testId="comp-outlet" />
        </div>
        <div>
          <Label className={LABEL}>Brand</Label>
          <SimpleSelect value={brandId} onValueChange={setBrandId} ariaLabel="Brand"
            options={[{ value: "", label: "Semua brand" }, ...brands.map(b => ({ value: b.id, label: b.name }))]}
            placeholder="Semua brand"
            className="glass-input rounded-lg w-full h-9 text-sm mt-1" testId="comp-brand" />
        </div>
      </div>

      {loading && <LoadingState rows={4} />}

      {!loading && data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <CompactStatCard label={`Periode ${data.period}`} value={fmt(data.current)} icon={CalendarDays}
              color="aurora-1" active testId="comp-current" />
            <CompactStatCard label={`Sebelumnya ${data.previous_period}`} value={fmt(data.previous)} icon={History}
              color="aurora-3" testId="comp-previous" />
            <CompactStatCard
              label={`Δ ${data.compare_to.toUpperCase()}`}
              value={data.delta_pct == null ? "—" : `${data.delta_pct >= 0 ? "+" : ""}${data.delta_pct}%`}
              sub={`${data.delta >= 0 ? "+" : ""}${fmt(data.delta)}`}
              icon={data.delta > 0 ? TrendingUp : data.delta < 0 ? TrendingDown : Minus}
              tone={data.delta > 0 ? "success" : data.delta < 0 ? "danger" : "default"}
              color={data.delta > 0 ? "aurora-4" : data.delta < 0 ? "aurora-6" : "aurora-1"}
              testId="comp-delta" />
          </div>

          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm md:text-base font-semibold">Rolling 12 bulan — {metricName}</h3>
              <span className="text-xs text-muted-foreground">{data.compare_to.toUpperCase()}</span>
            </div>
            <Sparkline data={data.rolling_12m || []} fmt={fmt} highlightPeriod={data.period} />
          </div>
        </>
      )}
    </div>
  );
}

function Sparkline({ data, fmt, highlightPeriod }) {
  if (!data?.length) return <div className="text-sm text-muted-foreground italic">Tidak ada data</div>;
  const max = Math.max(...data.map(d => d.value), 1);
  const min = Math.min(...data.map(d => d.value), 0);
  const range = max - min || 1;
  return (
    <div className="flex items-end gap-1.5 h-40 px-2 pb-1 overflow-x-auto">
      {data.map((d, i) => {
        const h = max === 0 ? 4 : Math.max(4, ((d.value - min) / range) * 140);
        const isHi = d.period === highlightPeriod;
        return (
          <div key={d.period} className="flex flex-col items-center gap-1 group min-w-[42px]">
            <div className="text-xs tabular-nums text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
              {fmt(d.value)}
            </div>
            <div
              className={cn(
                "w-7 rounded-t transition-all",
                isHi ? "grad-aurora" : "bg-foreground/30 group-hover:bg-foreground/60",
              )}
              style={{ height: `${h}px` }}
              data-testid={`spark-${d.period}`}
            />
            <div className={cn("text-xs", isHi ? "font-bold" : "text-muted-foreground")}>
              {d.period.slice(2)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
