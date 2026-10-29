/** Phase 7C — 3-month Forecasting (linear regression + EWMA + hybrid). */
import { useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown, Activity, Target, BarChart3, Sparkles, Info, LineChart, Gauge } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { Badge } from "@/components/ui/badge";
import LoadingState from "@/components/shared/LoadingState";
import DataTable from "@/components/shared/DataTable";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import { fmtRp } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import useOutletScope from "@/hooks/useOutletScope";

const METHOD_COLORS = {
  linear: "#10b981",   // emerald
  ewma: "#f59e0b",     // amber
  hybrid: "#7c4cc4",   // aurora purple
};

const LABEL = "text-xs font-medium text-muted-foreground";

function mapeColor(mape) {
  if (mape == null) return "text-muted-foreground bg-muted/40";
  if (mape <= 10) return "text-emerald-800 bg-emerald-500/15 dark:text-emerald-300";
  if (mape <= 20) return "text-amber-800 bg-amber-500/15 dark:text-amber-300";
  return "text-red-800 bg-red-500/15 dark:text-red-300";
}

export default function Forecasting({ embedded = false }) {
  const [methodsCatalog, setMethodsCatalog] = useState(null);
  const [target, setTarget] = useState("sales");
  const { outletId, setOutletId, scopedOutlets, allOutlets } = useOutletScope();
  const [months, setMonths] = useState(3);
  const [method, setMethod] = useState("hybrid");
  const [historyDays, setHistoryDays] = useState(90);

  const [data, setData] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/forecasting/methods").then(r => setMethodsCatalog(unwrap(r))),
    ]).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [main, dash] = await Promise.all([
        api.get(`/forecasting/${target}`, {
          params: { outlet_id: outletId || undefined, months, method, history_days: historyDays },
        }),
        target === "sales"
          ? api.get("/forecasting/dashboard", { params: { months, method } })
          : Promise.resolve(null),
      ]);
      setData(unwrap(main));
      setDashboard(dash ? unwrap(dash) : null);
    } catch (e) {
      toast.error("Gagal memuat forecast: " + (e.response?.data?.errors?.[0]?.message || e.message));
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [target, outletId, months, method, historyDays]); // eslint-disable-line

  const header = (
    <PageHeader
      icon={LineChart}
      title="Forecasting"
      subtitle="Proyeksi sales & expense 1–6 bulan ke depan (linear, EWMA, hybrid)"
    />
  );

  if (!methodsCatalog) return (
    <div data-testid="forecasting-page">
      {header}
      <LoadingState rows={3} />
    </div>
  );

  const methodDesc = methodsCatalog.methods.find(m => m.key === method)?.description;
  const mape = data?.accuracy_mape;
  const grade = mape == null ? "n/a" : mape <= 10 ? "Sangat akurat" : mape <= 20 ? "Baik" : mape <= 35 ? "Cukup" : "Volatil";
  const growth = data?.totals?.growth_pct;

  return (
    <div data-testid="forecasting-page">
      {header}
      <div className="space-y-3 lg:space-y-4">
      {/* Filter bar */}
      <div className="glass-card p-3 flex flex-wrap gap-3 items-end">
        <div className="w-full sm:w-52">
          <Label className={LABEL}>Target</Label>
          <SimpleSelect value={target} onValueChange={setTarget} ariaLabel="Target"
            options={methodsCatalog.targets.map(t => ({ value: t.key, label: String(t.label || t.key).split(" (")[0] }))}
            className="glass-input rounded-lg w-full h-9 text-sm mt-1" testId="forecast-target" />
        </div>
        <div className="w-full sm:w-52">
          <Label className={LABEL}>Outlet</Label>
          <SimpleSelect value={outletId} onValueChange={setOutletId} ariaLabel="Outlet"
            options={[{ value: "", label: "Konsolidasi (semua)" }, ...scopedOutlets.map(o => ({ value: o.id, label: o.name }))]}
            placeholder="Konsolidasi (semua)"
            className="glass-input rounded-lg w-full h-9 text-sm mt-1" testId="forecast-outlet" />
        </div>
        <div>
          <div className={LABEL} id="forecast-method-label">Metode</div>
          <Segmented labelledBy="forecast-method-label" value={method} onChange={setMethod}
            options={methodsCatalog.methods.map(m => ({ value: m.key, label: m.key, title: m.description }))}
            testIdPrefix="forecast-method" capitalize />
        </div>
        <div>
          <div className={LABEL} id="forecast-months-label">Horizon</div>
          <Segmented labelledBy="forecast-months-label" value={months} onChange={setMonths}
            options={[1, 3, 6].map(m => ({ value: m, label: `${m} bln` }))}
            testIdPrefix="forecast-months" />
        </div>
        <div className="w-28">
          <Label htmlFor="forecast-history-days" className={LABEL}>Histori (hari)</Label>
          <Input id="forecast-history-days" type="number" value={historyDays}
            onChange={e => setHistoryDays(Math.max(14, Math.min(365, +e.target.value || 90)))}
            className="glass-input mt-1 h-9" min={14} max={365} data-testid="forecast-history-days" />
        </div>
        {methodDesc && (
          <p className="basis-full text-xs text-muted-foreground">
            <span className="font-medium capitalize text-foreground/80">{method}:</span> {methodDesc}
          </p>
        )}
      </div>

      {loading && <LoadingState rows={6} />}

      {!loading && data && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <CompactStatCard
              icon={Activity}
              color="aurora-3"
              label={`Histori ${data.filters.history_days} hari`}
              value={fmtRp(data.totals.history_total)}
              sub={`Rata-rata ${fmtRp(data.totals.history_avg_daily)}/hari`}
              testId="forecast-history-kpi"
            />
            <CompactStatCard
              icon={Target}
              color="aurora-2"
              label={`Forecast ${months} bulan`}
              value={fmtRp(data.totals.forecast_total)}
              sub={`Rata-rata ${fmtRp(data.totals.forecast_avg_daily)}/hari`}
              active
              testId="forecast-total-kpi"
            />
            <CompactStatCard
              icon={growth > 0 ? TrendingUp : TrendingDown}
              color={growth > 0 ? "aurora-4" : growth < 0 ? "aurora-6" : "aurora-1"}
              tone={growth > 0 ? "success" : growth < 0 ? "danger" : "default"}
              label="Pertumbuhan vs histori"
              value={growth == null ? "—" : `${growth >= 0 ? "+" : ""}${growth}%`}
              sub={`±${fmtRp(data.confidence_band)} (CI 95%)`}
              testId="forecast-growth-kpi"
            />
            <CompactStatCard
              icon={Gauge}
              color="aurora-5"
              tone={mape == null ? "default" : mape <= 10 ? "success" : mape <= 20 ? "warning" : "danger"}
              label="Akurasi backtest"
              value={mape == null ? "—" : `${mape}%`}
              sub={`MAPE 30 hari (${data.method}) — ${grade}`}
              testId="forecast-accuracy-kpi"
            />
          </div>

          {/* Main chart */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                <h3 className="text-sm md:text-base font-semibold">
                  {target === "sales" ? "Sales" : "Expense"} — histori &amp; forecast
                </h3>
              </div>
              <div className="flex items-center gap-3 text-xs flex-wrap">
                <LegendDot color="#94a3b8" label="Histori" />
                <LegendDot color={METHOD_COLORS[data.method]} label={`Forecast (${data.method})`} dashed />
                <LegendDot color={METHOD_COLORS[data.method]} label="Rentang kepercayaan" opacity={0.2} swatch />
              </div>
            </div>
            <ForecastChart history={data.history_daily} forecast={data.forecast_daily}
              band={data.confidence_band} color={METHOD_COLORS[data.method]} />
          </div>

          {/* Monthly bars */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm md:text-base font-semibold">Forecast bulanan — {months} bulan ke depan</h3>
              <Badge className="bg-muted/40 text-foreground border-0 text-xs">
                Metode: <span className="capitalize ml-1">{data.method}</span>
              </Badge>
            </div>
            <MonthlyBars history={data.monthly_history} forecast={data.monthly_forecast}
              color={METHOD_COLORS[data.method]} />
          </div>

          {/* Method comparison */}
          <div className="glass-card p-4">
            <h3 className="text-sm md:text-base font-semibold mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Perbandingan metode (total forecast {months} bulan)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {Object.entries(data.comparison_methods).map(([m, fc]) => {
                const total = fc.reduce((s, r) => s + r.value, 0);
                const isActive = m === data.method;
                return (
                  <div key={m} className={cn(
                    "rounded-lg p-3 border transition-all",
                    isActive ? "border-2" : "border-border/30",
                  )}
                    style={isActive ? { borderColor: METHOD_COLORS[m] } : undefined}
                    data-testid={`forecast-compare-${m}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full" style={{ background: METHOD_COLORS[m] }} />
                      <span className="text-sm font-semibold capitalize">{m}</span>
                      {isActive && <Badge className="ml-auto bg-foreground text-background text-xs h-5">aktif</Badge>}
                    </div>
                    <div className="text-lg font-semibold tabular-nums">{fmtRp(total)}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {fc.map(f => f.period.slice(5)).join(" / ")}: {fc.map(f => `${(f.value / 1e6).toFixed(0)}jt`).join(" / ")}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per-outlet dashboard (only for sales + consolidated) */}
          {target === "sales" && dashboard && !outletId && (
            <div className="glass-card p-0 overflow-hidden">
              <h3 className="px-4 py-3 border-b border-border/30 text-sm md:text-base font-semibold">Ringkasan forecast per outlet</h3>
              <DataTable
                rows={dashboard.outlets.map(o => ({ ...o, _rid: o.outlet_code || o.outlet_id }))}
                keyField="_rid"
                rowTestIdPrefix="outlet-row"
                columns={[
                  { key: "outlet_name", label: "Outlet", primary: true, sortable: true,
                    render: (o) => <span className="font-medium">{o.outlet_name}</span> },
                  { key: "history_total", label: `Histori ${historyDays} hr`, numeric: true, sortable: true,
                    render: (o) => fmtRp(o.history_total) },
                  { key: "forecast_total", label: `Forecast ${months} bln`, numeric: true, sortable: true,
                    render: (o) => <span className="font-semibold">{fmtRp(o.forecast_total)}</span> },
                  { key: "growth_pct", label: "Pertumbuhan", numeric: true, sortable: true,
                    render: (o) => <GrowthBadge pct={o.growth_pct} /> },
                  { key: "confidence_band", label: "±Rentang", numeric: true,
                    render: (o) => <span className="text-muted-foreground">±{fmtRp(o.confidence_band)}</span> },
                  { key: "accuracy_mape", label: "MAPE", numeric: true, sortable: true,
                    render: (o) => (
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold", mapeColor(o.accuracy_mape))}>
                        {o.accuracy_mape == null ? "—" : `${o.accuracy_mape}%`}
                      </span>
                    ) },
                ]}
                footer={
                  <tr className="bg-muted/40 font-semibold border-t-2 border-border">
                    <td className="px-4 py-2.5">Konsolidasi grup</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtRp(dashboard.consolidated.history_total)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtRp(dashboard.consolidated.forecast_total)}</td>
                    <td className="px-4 py-2.5 text-right"><GrowthBadge pct={dashboard.consolidated.growth_pct} /></td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">±{fmtRp(dashboard.consolidated.confidence_band)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold", mapeColor(dashboard.consolidated.accuracy_mape))}>
                        {dashboard.consolidated.accuracy_mape == null ? "—" : `${dashboard.consolidated.accuracy_mape}%`}
                      </span>
                    </td>
                  </tr>
                }
              />
            </div>
          )}

          {/* Disclaimer */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground p-3 rounded-lg bg-muted/20 border border-border/30">
            <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <div>
              Forecast adalah <span className="font-semibold">estimasi statistik</span> dari pola historis. MAPE ≤10% sangat akurat, ≤20% baik, &gt;20% data masih volatil.
              Gunakan rentang kepercayaan (±) sebagai kisaran realistis.
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  );
}

// ============== Sub-components ==============

/** Segmented control — gaya sama dengan Tabs (h-8, 13px, aktif = pill-active). */
function Segmented({ value, onChange, options, testIdPrefix, labelledBy, capitalize = false }) {
  return (
    <div role="group" aria-labelledby={labelledBy}
      className="mt-1 inline-flex items-center gap-1 rounded-[calc(var(--radius)-2px)] border border-border/60 bg-white/35 dark:bg-white/5 p-px">
      {options.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} aria-pressed={value === o.value}
          title={o.title}
          className={cn(
            "h-8 rounded-[calc(var(--radius)-4px)] px-2.5 text-[13px] font-medium transition-colors whitespace-nowrap",
            capitalize && "capitalize",
            value === o.value ? "pill-active" : "text-muted-foreground hover:text-foreground",
          )}
          data-testid={`${testIdPrefix}-${o.value}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function GrowthBadge({ pct }) {
  if (pct == null) return <span className="text-muted-foreground">—</span>;
  const positive = pct > 0;
  const cls = positive ? "text-emerald-800 dark:text-emerald-400 bg-emerald-500/10"
    : pct < 0 ? "text-red-800 dark:text-red-400 bg-red-500/10"
    : "text-muted-foreground bg-muted/40";
  return (
    <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold tabular-nums", cls)}>
      {positive ? "+" : ""}{pct}%
    </span>
  );
}

function LegendDot({ color, label, dashed, swatch, opacity = 1 }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      {swatch ? (
        <span className="w-4 h-3 rounded-sm" style={{ background: color, opacity }} />
      ) : (
        <span
          className={cn("w-4 h-0.5", dashed ? "border-t-2 border-dashed" : "")}
          style={{ background: dashed ? "transparent" : color, borderColor: color }}
        />
      )}
      {label}
    </span>
  );
}

// ============== Charts ==============

function ForecastChart({ history, forecast, band, color }) {
  const chartData = useMemo(() => {
    const all = [
      ...history.map(d => ({ ...d, type: "history" })),
      ...forecast.map(d => ({ ...d, type: "forecast" })),
    ];
    if (all.length === 0) return null;
    const max = Math.max(...all.map(d => d.value + (d.type === "forecast" ? band : 0)), 1);
    const min = 0;
    return { all, max, min, historyLen: history.length };
  }, [history, forecast, band]);

  if (!chartData) return <div className="text-sm text-muted-foreground italic">Tidak ada data</div>;

  const { all, max, historyLen } = chartData;
  const W = 1000, H = 240, PAD_L = 70, PAD_B = 20, PAD_T = 10;
  const innerW = W - PAD_L - 10, innerH = H - PAD_T - PAD_B;
  const xStep = innerW / Math.max(1, all.length - 1);

  const xy = (i, v) => [PAD_L + i * xStep, PAD_T + innerH - (v / max) * innerH];

  const historyPath = history.map((d, i) => `${i === 0 ? "M" : "L"} ${xy(i, d.value).join(" ")}`).join(" ");
  const forecastPath = forecast.map((d, i) => {
    const idx = historyLen + i;
    return `${i === 0 ? "M" : "L"} ${xy(idx, d.value).join(" ")}`;
  }).join(" ");

  // Confidence band polygon (forecast only)
  const bandUpper = forecast.map((d, i) => xy(historyLen + i, d.value + band));
  const bandLower = forecast.map((d, i) => xy(historyLen + i, Math.max(0, d.value - band)));
  const bandPath = "M " + bandUpper.map(p => p.join(" ")).join(" L ")
    + " L " + bandLower.reverse().map(p => p.join(" ")).join(" L ") + " Z";

  // Y-axis ticks (4 ticks)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => max * t);

  // X-axis labels (~6 across)
  const xLabelEvery = Math.max(1, Math.floor(all.length / 7));

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[280px]" data-testid="forecast-chart">
        {/* Grid + Y labels */}
        {yTicks.map((t, i) => {
          const y = PAD_T + innerH - (t / max) * innerH;
          return (
            <g key={i}>
              <line x1={PAD_L} y1={y} x2={W - 10} y2={y}
                stroke="currentColor" strokeOpacity="0.08" strokeDasharray="2 4" />
              <text x={PAD_L - 6} y={y + 4} textAnchor="end" fontSize="12" className="fill-current opacity-60 tabular-nums">
                {(t / 1e6).toFixed(0)}jt
              </text>
            </g>
          );
        })}

        {/* Vertical line at history/forecast boundary */}
        {(() => {
          const [bx] = xy(historyLen - 0.5, 0);
          return (
            <g>
              <line x1={bx} y1={PAD_T} x2={bx} y2={PAD_T + innerH}
                stroke="currentColor" strokeOpacity="0.2" strokeDasharray="3 3" />
              <text x={bx + 4} y={PAD_T + 12} fontSize="12" className="fill-current opacity-60">hari ini</text>
            </g>
          );
        })()}

        {/* Confidence band */}
        <path d={bandPath} fill={color} opacity="0.15" />

        {/* History line */}
        <path d={historyPath} fill="none" stroke="#94a3b8" strokeWidth="1.5" />

        {/* Forecast line (dashed) */}
        <path d={forecastPath} fill="none" stroke={color} strokeWidth="2" strokeDasharray="5 4" />

        {/* X labels */}
        {all.map((d, i) => {
          if (i % xLabelEvery !== 0) return null;
          const [x] = xy(i, 0);
          return (
            <text key={i} x={x} y={H - 4} textAnchor="middle" fontSize="12"
              className="fill-current opacity-60">{d.date.slice(5)}</text>
          );
        })}
      </svg>
    </div>
  );
}

function MonthlyBars({ history, forecast, color }) {
  const all = [
    ...history.map(h => ({ ...h, type: "history" })),
    ...forecast.map(f => ({ ...f, type: "forecast" })),
  ];
  if (all.length === 0) return <div className="text-sm text-muted-foreground italic">Tidak ada data</div>;
  const max = Math.max(...all.map(r => r.value), 1);

  return (
    <div className="flex items-end gap-3 h-44 overflow-x-auto pb-2">
      {all.map(r => {
        const h = (r.value / max) * 140;
        const key = `${r.type}-${r.period}`;
        return (
          <div key={key} className="flex flex-col items-center gap-1.5 min-w-[60px]" data-testid={`month-bar-${key}`}>
            <div className="text-xs tabular-nums text-foreground font-semibold">{(r.value / 1e6).toFixed(0)}jt</div>
            <div className="w-12 rounded-t-md transition-all"
              style={{
                height: `${Math.max(4, h)}px`,
                background: r.type === "forecast" ? color : "rgba(148, 163, 184, 0.5)",
                borderTopLeftRadius: 6, borderTopRightRadius: 6,
                opacity: r.type === "forecast" ? 0.85 : 1,
                ...(r.type === "forecast" ? { borderTop: `3px solid ${color}` } : {}),
              }}
            />
            <div className={cn("text-xs", r.type === "forecast" ? "font-bold" : "text-muted-foreground")}>
              {r.period.slice(2)}
            </div>
            {r.type === "forecast" && (
              <span className="text-[11px] uppercase font-semibold tracking-wider"
                style={{ color }}>proyeksi</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
