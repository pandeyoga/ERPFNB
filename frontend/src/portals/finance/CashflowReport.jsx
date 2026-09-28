/** Cashflow report (Direct Method). */
import { useEffect, useState } from "react";
import { Wallet, TrendingUp, TrendingDown, ArrowRight, Download } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import { fmtRp, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function CashflowReport() {
  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [period, setPeriod] = useState(defaultPeriod);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedCat, setExpandedCat] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/finance/cashflow", { params: { period } });
      setData(unwrap(res));
    } catch (e) {
      toast.error("Gagal memuat Cashflow");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [period]);

  function exportCsv() {
    if (!data) return;
    const rows = ["Date,Description,Source,Category,Inflow,Outflow,Net"];
    for (const t of data.transactions) {
      rows.push(`${t.entry_date},"${(t.description || "").replace(/"/g, "'")}",${t.source_type},${t.category},${t.inflow},${t.outflow},${t.net}`);
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `Cashflow-${period}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div data-testid="cashflow-report-page" className="space-y-4">
      <div data-testid="cf-filter-card" className="glass-card p-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[160px]">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Period</Label>
          <Input type="month" value={period} onChange={e => setPeriod(e.target.value)}
            className="glass-input mt-1 h-9" data-testid="cf-period" />
        </div>
        <Button onClick={exportCsv} variant="outline" className="ml-auto rounded-full gap-2 h-10" data-testid="cf-export">
          <Download className="h-4 w-4" /> CSV
        </Button>
      </div>

      {loading && <LoadingState rows={6} />}
      {!loading && data && (
        <>
          <div data-testid="cf-kpi-cards" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiTile label="Opening balance" value={fmtRp(data.opening_balance)} />
            <KpiTile label="Total inflow" value={fmtRp(sumInflow(data))} icon={TrendingUp} tone="emerald" />
            <KpiTile label="Total outflow" value={fmtRp(sumOutflow(data))} icon={TrendingDown} tone="red" />
            <KpiTile label="Closing balance" value={fmtRp(data.closing_balance)}
              sub={`Net ${data.net_flow >= 0 ? "+" : ""}${fmtRp(data.net_flow)}`}
              tone={data.net_flow >= 0 ? "emerald" : "red"} />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div data-testid="cf-by-category-card" className="glass-card p-4">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">By Category</div>
              <div className="space-y-2">
                {Object.entries(data.by_category).map(([key, cat]) => (
                  <button key={key}
                    onClick={() => setExpandedCat(expandedCat === key ? null : key)}
                    className={cn("w-full text-left p-3 rounded-lg border transition",
                      expandedCat === key ? "bg-foreground/5 border-foreground/30" : "border-border/30 hover:bg-foreground/5")}
                    data-testid={`cf-cat-${key}`}>
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{cat.label}</div>
                      <div className={cn("text-sm font-bold tabular-nums", cat.net >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>
                        {cat.net >= 0 ? "+" : ""}{fmtRp(cat.net)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground mt-1">
                      <span>In: {fmtRp(cat.inflow)}</span>
                      <span>Out: {fmtRp(cat.outflow)}</span>
                      <span className="ml-auto">{cat.rows.length} txn</span>
                    </div>
                    {expandedCat === key && cat.rows.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/30 space-y-1 text-xs">
                        {cat.rows.slice(0, 10).map(r => (
                          <div key={r.je_id} className="flex items-center gap-2">
                            <span className="text-muted-foreground w-20">{fmtDate(r.entry_date)}</span>
                            <span className="flex-1 truncate">{r.description}</span>
                            <span className={cn("font-mono tabular-nums", r.net >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>
                              {r.net >= 0 ? "+" : ""}{fmtRp(r.net)}
                            </span>
                          </div>
                        ))}
                        {cat.rows.length > 10 && <div className="text-[11px] text-muted-foreground">+{cat.rows.length - 10} lagi</div>}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div data-testid="cf-daily-chart-card" className="glass-card p-4">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">Daily Running Balance</div>
              {data.daily.length === 0
                ? <EmptyState icon={Wallet} title="Tidak ada pergerakan cash bulan ini" description="Semua hari tanpa transaksi cash." />
                : <DailyChart daily={data.daily} opening={data.opening_balance} />}
            </div>
          </div>

          {data.transactions.length > 0 && (
            <div data-testid="cf-transactions-card" className="glass-card overflow-hidden">
              <div className="px-4 py-2 border-b border-border/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Recent Transactions (top 50)
              </div>
              <div className="max-h-[460px] overflow-y-auto">
                <DataTable
                  rows={data.transactions.slice(0, 50)}
                  keyField="je_id"
                  rowTestIdPrefix="cf-txn"
                  columns={[
                    { key: "entry_date", label: "Date", sortable: true, primary: true,
                      render: (t) => fmtDate(t.entry_date) },
                    { key: "doc_no", label: "Doc No",
                      render: (t) => <span className="font-mono text-xs">{t.doc_no}</span> },
                    { key: "source_type", label: "Source",
                      render: (t) => <span className="text-muted-foreground">{t.source_type}</span> },
                    { key: "description", label: "Description", hideOnMobile: true,
                      render: (t) => <span className="block max-w-[300px] truncate">{t.description}</span> },
                    { key: "inflow", label: "Inflow", numeric: true, sortable: true,
                      render: (t) => <span className={t.inflow ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}>{t.inflow ? fmtRp(t.inflow) : "-"}</span> },
                    { key: "outflow", label: "Outflow", numeric: true, sortable: true,
                      render: (t) => <span className={t.outflow ? "text-red-700 dark:text-red-400" : "text-muted-foreground"}>{t.outflow ? fmtRp(t.outflow) : "-"}</span> },
                  ]}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function sumInflow(d) { return Object.values(d.by_category).reduce((s, c) => s + c.inflow, 0); }
function sumOutflow(d) { return Object.values(d.by_category).reduce((s, c) => s + c.outflow, 0); }

function KpiTile({ label, value, sub, icon: Icon, tone = "neutral" }) {
  const cls = { neutral: "", emerald: "text-emerald-700 dark:text-emerald-400", red: "text-red-700 dark:text-red-400" }[tone] || "";
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon className={cn("h-4 w-4", cls)} />}
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      </div>
      <div className={cn("text-xl font-bold tabular-nums mt-1", cls)}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function DailyChart({ daily, opening }) {
  const balances = daily.map(d => d.balance);
  const allVals = [opening, ...balances];
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const range = Math.max(max - min, 1);
  const height = 160;
  const width = Math.max(daily.length * 32, 320);
  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height + 40} className="text-foreground">
        {/* opening line */}
        <line x1={0} y1={((max - opening) / range) * height} x2={width} y2={((max - opening) / range) * height}
          stroke="currentColor" strokeDasharray="3,3" strokeOpacity="0.2" />
        {daily.map((d, i) => {
          const x = i * 32 + 16;
          const y = ((max - d.balance) / range) * height;
          const prevY = i === 0 ? ((max - opening) / range) * height : ((max - daily[i - 1].balance) / range) * height;
          const prevX = i === 0 ? 0 : (i - 1) * 32 + 16;
          return (
            <g key={d.date}>
              <line x1={prevX} y1={prevY} x2={x} y2={y} stroke="currentColor" strokeOpacity="0.5" strokeWidth="2" />
              <circle cx={x} cy={y} r={3} fill="currentColor" />
              <text x={x} y={height + 16} fontSize="9" textAnchor="middle" fill="currentColor" opacity="0.6">{d.date.slice(-2)}</text>
            </g>
          );
        })}
      </svg>
      <div className="text-[10px] text-muted-foreground mt-1">
        Y-axis: Rp {(min / 1e6).toFixed(0)}jt — {(max / 1e6).toFixed(0)}jt · dashed = opening balance
      </div>
    </div>
  );
}
