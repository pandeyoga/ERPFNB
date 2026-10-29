/** Executive → Profit Walk. Rebuilt on the shared usability primitives:
 *  real WaterfallChart, expandable DataTable drill-down, polished KpiCards. */
import { useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown, RefreshCw, Sparkles, Wallet, BarChart3 } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import KpiCard from "@/components/shared/KpiCard";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import WaterfallChart from "@/components/shared/charts/WaterfallChart";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { fmtRp } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PERIODS = [
  { v: "mtd", l: "MTD" },
  { v: "lmtd", l: "Last Month (LMTD)" },
  { v: "qtd", l: "QTD" },
  { v: "ytd", l: "YTD" },
  { v: "yoy", l: "YoY" },
  { v: "last_month", l: "Last Month (Full)" },
];

const KIND_BADGE = {
  positive: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  negative: "bg-rose-500/12 text-rose-700 dark:text-rose-400 border-rose-500/20",
  subtotal: "bg-violet-500/12 text-violet-700 dark:text-violet-400 border-violet-500/20",
  total: "bg-indigo-500/12 text-indigo-700 dark:text-indigo-400 border-indigo-500/20",
};

function Delta({ value, pct }) {
  const positive = (value ?? 0) >= 0;
  return (
    <span className={cn("inline-flex items-center justify-end gap-1 font-mono tabular-nums", positive ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400")}>
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {value != null && <>{positive ? "+" : ""}{fmtRp(value)}</>}
      {pct != null && <span className="text-xs opacity-80">({pct > 0 ? "+" : ""}{pct}%)</span>}
    </span>
  );
}

/** Drill-down panel rendered when a stage row is expanded. */
function StageBreakdown({ stage }) {
  const items = stage.breakdown || [];
  if (!items.length) {
    return (
      <p className="text-xs text-muted-foreground">
        {stage.kind === "subtotal" || stage.kind === "total"
          ? "Tahap agregat — merupakan akumulasi dari tahap-tahap di atas."
          : "Tidak ada rincian akun pada periode ini."}
      </p>
    );
  }
  const maxVal = Math.max(...items.map((i) => i.period), 1);
  return (
    <div className="space-y-1.5" data-testid={`breakdown-${stage.label}`}>
      <div className="grid grid-cols-12 gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1">
        <span className="col-span-5">Akun</span>
        <span className="col-span-3 text-right">Period</span>
        <span className="col-span-2 text-right">Compare</span>
        <span className="col-span-2 text-right">Δ %</span>
      </div>
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-center text-xs rounded-lg px-1 py-1 hover:bg-foreground/[0.04]">
          <div className="col-span-5 min-w-0">
            <div className="truncate font-medium">{it.label}</div>
            <div className="mt-1 h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
              <div className="h-full rounded-full grad-aurora" style={{ width: `${Math.max(4, (it.period / maxVal) * 100)}%` }} />
            </div>
          </div>
          <span className="col-span-3 text-right font-mono tabular-nums font-medium">{fmtRp(it.period)}</span>
          <span className="col-span-2 text-right font-mono tabular-nums text-muted-foreground">{fmtRp(it.compare)}</span>
          <span className={cn("col-span-2 text-right font-mono tabular-nums text-xs", (it.delta_pct ?? 0) >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400")}>
            {it.delta_pct != null ? `${it.delta_pct > 0 ? "+" : ""}${it.delta_pct}%` : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

/** ProfitWalk — `embedded` = dirender sebagai tab di Performance Analytics (tanpa <h1>). */
export default function ProfitWalk({ embedded = false }) {
  const [period, setPeriod] = useState("mtd");
  const [compare, setCompare] = useState("lmtd");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get("/executive/profit-walk", { params: { period_kind: period, compare_kind: compare } });
      setData(unwrap(r));
    } catch (e) {
      toast.error("Gagal memuat profit walk");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [period, compare]);

  const summary = data?.summary || {};
  const stageByLabel = useMemo(
    () => Object.fromEntries((data?.stages || []).map((s) => [s.label, s])),
    [data],
  );

  const columns = useMemo(() => [
    {
      key: "label", label: "Stage", primary: true,
      render: (s) => (
        <span className="inline-flex items-center gap-2">
          <Badge variant="outline" className={cn("text-xs capitalize border", KIND_BADGE[s.kind])}>{s.kind}</Badge>
          <span className="font-medium">{s.label}</span>
        </span>
      ),
    },
    { key: "value", label: "Period", numeric: true, sortable: true, render: (s) => <span className="font-mono">{fmtRp(s.value)}</span> },
    { key: "compare", label: "Compare", numeric: true, sortable: true, render: (s) => <span className="font-mono text-muted-foreground">{fmtRp(s.compare)}</span> },
    {
      key: "delta", label: "Δ", numeric: true, sortable: true,
      sortAccessor: (s) => (s.value || 0) - (s.compare || 0),
      render: (s) => <Delta value={(s.value || 0) - (s.compare || 0)} />,
    },
    {
      key: "delta_pct", label: "Δ %", numeric: true, sortable: true,
      render: (s) => (
        <span className={cn("font-mono tabular-nums text-xs", (s.delta_pct || 0) >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400")}>
          {s.delta_pct != null ? `${s.delta_pct > 0 ? "+" : ""}${s.delta_pct}%` : "—"}
        </span>
      ),
    },
    { key: "running", label: "Running", numeric: true, render: (s) => <span className="font-mono text-xs text-muted-foreground">{fmtRp(s.running)}</span> },
  ], []);

  const subtitle = "Revenue → COGS → GP → OPEX → Service → Net Profit";
  // Filter tingkat halaman = baris polos (tanpa kartu); Muat ulang = aksi layar di header (DESIGN_SYSTEM §10).
  const filters = (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={period} onValueChange={setPeriod}>
        <SelectTrigger className="w-[180px]" data-testid="profit-period-select" aria-label="Periode"><SelectValue /></SelectTrigger>
        <SelectContent>{PERIODS.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
      </Select>
      <span className="text-xs text-muted-foreground">vs</span>
      <Select value={compare} onValueChange={setCompare}>
        <SelectTrigger className="w-[180px]" data-testid="profit-compare-select" aria-label="Periode pembanding"><SelectValue /></SelectTrigger>
        <SelectContent>{PERIODS.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
  const refreshBtn = (
    <Button variant="outline" onClick={load} data-testid="profit-refresh">
      <RefreshCw /> Muat ulang
    </Button>
  );
  const periodLine = data && (
    <span className="text-xs text-muted-foreground">
      Periode <span className="font-mono font-semibold text-foreground">{data.period?.label}</span>
      {data.compare?.label && <> vs <span className="font-mono font-semibold text-foreground">{data.compare.label}</span></>}
    </span>
  );
  const header = (
    <>
      <PageHeader icon={TrendingUp} title="Profit Walk" subtitle={subtitle} actions={refreshBtn} className="mb-0 md:mb-0" />
      <div className="flex items-center justify-between flex-wrap gap-3" data-testid="profit-walk-controls">
        {filters}
        {periodLine}
      </div>
    </>
  );

  if (loading || !data) return (
    <div className="space-y-3 lg:space-y-4" data-testid="profit-walk-page">
      {header}
      <LoadingState variant="page" />
    </div>
  );

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="profit-walk-page">
      {header}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="profit-kpi-cards">
        <KpiCard label="Revenue" value={fmtRp(summary.revenue || 0)} icon={Wallet} color="aurora-1"
                 delta={stageByLabel["Revenue"]?.delta_pct} deltaLabel="vs compare" />
        <KpiCard label="Gross Profit" value={fmtRp(summary.gross_profit || 0)} icon={BarChart3} color="aurora-2"
                 delta={stageByLabel["Gross Profit"]?.delta_pct}
                 deltaLabel={summary.gp_margin_pct != null ? `${summary.gp_margin_pct}% margin` : "vs compare"} />
        <KpiCard label="Net Profit" value={fmtRp(summary.net_profit || 0)} icon={TrendingUp}
                 color={(summary.net_profit || 0) >= 0 ? "aurora-4" : "destructive"}
                 delta={summary.net_delta_pct}
                 deltaLabel={summary.net_margin_pct != null ? `${summary.net_margin_pct}% margin` : "vs compare"} />
        <KpiCard label="Δ Net vs Compare"
                 value={summary.net_delta_pct != null ? `${summary.net_delta_pct > 0 ? "+" : ""}${summary.net_delta_pct}%` : "—"}
                 icon={Sparkles} color={(summary.net_delta_pct || 0) >= 0 ? "aurora-4" : "destructive"}
                 hint={`Compare: ${fmtRp(summary.compare_net_profit || 0)}`} />
      </div>

      {/* Waterfall */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm md:text-base font-semibold">Waterfall</h3>
          <span className="text-xs text-muted-foreground">Floating bars · label = kontribusi tahap</span>
        </div>
        <WaterfallChart stages={data.stages || []} height={340} valueFormatter={fmtRp} />
      </div>

      {/* Detail per stage — expandable */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h3 className="text-sm md:text-base font-semibold">Detail per Stage</h3>
          <span className="text-xs text-muted-foreground">Klik baris untuk rincian akun</span>
        </div>
        <DataTable
          columns={columns}
          rows={data.stages || []}
          keyField="label"
          rowTestIdPrefix="stage"
          renderExpanded={(s) => <StageBreakdown stage={s} />}
          empty={<EmptyState title="Tidak ada data" />}
        />
      </div>

      {/* Top drivers */}
      {data.top_drivers?.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-sm md:text-base font-semibold mb-3">Top Drivers</h3>
          <ul className="space-y-1.5">
            {data.top_drivers.map((d, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-sm py-2 px-2 rounded-lg hover:bg-foreground/[0.04]">
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className="h-6 w-6 shrink-0 rounded-full grad-aurora-soft text-xs font-semibold flex items-center justify-center">{i + 1}</span>
                  <span className="truncate font-medium">{d.label}</span>
                </span>
                <Delta value={d.delta} pct={d.delta_pct} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
