/** Cashflow report (Direct Method). */
import { useEffect, useState } from "react";
import { Wallet, TrendingUp, TrendingDown, Download, Landmark, Scale } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import CompactStatCard from "@/components/shared/CompactStatCard";
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
    <div data-testid="cashflow-report-page" className="space-y-3 lg:space-y-4">
      <div data-testid="cf-filter-card" className="flex flex-wrap items-end gap-3">
        <div className="min-w-[160px]">
          <Label htmlFor="cf-period" className="text-xs font-medium text-muted-foreground">Periode</Label>
          <Input id="cf-period" type="month" value={period} onChange={e => setPeriod(e.target.value)}
            className="glass-input mt-1 h-9" data-testid="cf-period" />
        </div>
        <Button onClick={exportCsv} variant="outline" className="ml-auto" disabled={!data} data-testid="cf-export">
          <Download /> Ekspor CSV
        </Button>
      </div>

      {loading && <LoadingState rows={6} />}
      {!loading && data && (
        <>
          <div data-testid="cf-kpi-cards" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <CompactStatCard label="Opening balance" value={fmtRp(data.opening_balance)} icon={Landmark} color="aurora-1" testId="cf-kpi-opening" />
            <CompactStatCard label="Total inflow" value={fmtRp(sumInflow(data))} icon={TrendingUp} tone="success" color="aurora-4" testId="cf-kpi-inflow" />
            <CompactStatCard label="Total outflow" value={fmtRp(sumOutflow(data))} icon={TrendingDown} tone="danger" color="aurora-6" testId="cf-kpi-outflow" />
            <CompactStatCard label="Closing balance" value={fmtRp(data.closing_balance)}
              sub={`Net ${data.net_flow >= 0 ? "+" : ""}${fmtRp(data.net_flow)}`}
              icon={Scale} tone={data.net_flow >= 0 ? "success" : "danger"} color="aurora-2" testId="cf-kpi-closing" />
          </div>

          <div className="grid lg:grid-cols-2 gap-3 lg:gap-4">
            <div data-testid="cf-by-category-card" className="glass-card p-4">
              <h3 className="text-sm md:text-base font-semibold mb-3">Per kategori</h3>
              <div className="space-y-2">
                {Object.entries(data.by_category).map(([key, cat]) => (
                  <button key={key} type="button" aria-expanded={expandedCat === key}
                    onClick={() => setExpandedCat(expandedCat === key ? null : key)}
                    className={cn("w-full text-left p-3 rounded-md border transition",
                      expandedCat === key ? "bg-foreground/5 border-foreground/30" : "border-border/30 hover:bg-foreground/5")}
                    data-testid={`cf-cat-${key}`}>
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{cat.label}</div>
                      <div className={cn("text-sm font-bold tabular-nums", cat.net >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>
                        {cat.net >= 0 ? "+" : ""}{fmtRp(cat.net)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                      <span>Masuk: {fmtRp(cat.inflow)}</span>
                      <span>Keluar: {fmtRp(cat.outflow)}</span>
                      <span className="ml-auto">{cat.rows.length} transaksi</span>
                    </div>
                    {expandedCat === key && cat.rows.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/30 space-y-1 text-xs">
                        {cat.rows.slice(0, 10).map(r => (
                          <div key={r.je_id} className="flex items-center gap-2">
                            <span className="text-muted-foreground w-20">{fmtDate(r.entry_date)}</span>
                            <span className="flex-1 truncate">{r.description}</span>
                            <span className={cn("tabular-nums", r.net >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>
                              {r.net >= 0 ? "+" : ""}{fmtRp(r.net)}
                            </span>
                          </div>
                        ))}
                        {cat.rows.length > 10 && <div className="text-xs text-muted-foreground">+{cat.rows.length - 10} lagi</div>}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div data-testid="cf-daily-chart-card" className="glass-card p-4">
              <h3 className="text-sm md:text-base font-semibold mb-3">Saldo harian berjalan</h3>
              {data.daily.length === 0
                ? <EmptyState icon={Wallet} title="Tidak ada pergerakan cash bulan ini" description="Semua hari tanpa transaksi cash." />
                : <DailyChart daily={data.daily} opening={data.opening_balance} />}
            </div>
          </div>

          {data.transactions.length > 0 && (
            <div data-testid="cf-transactions-card" className="glass-card overflow-hidden">
              <h3 className="px-4 py-3 border-b border-border/40 text-sm md:text-base font-semibold">
                Transaksi terbaru (50 teratas)
              </h3>
              <div className="max-h-[460px] overflow-y-auto">
                <DataTable
                  rows={data.transactions.slice(0, 50)}
                  keyField="je_id"
                  rowTestIdPrefix="cf-txn"
                  columns={[
                    { key: "entry_date", label: "Tanggal", sortable: true, primary: true,
                      render: (t) => fmtDate(t.entry_date) },
                    { key: "doc_no", label: "Doc No",
                      render: (t) => <span className="text-xs font-medium tabular-nums">{t.doc_no}</span> },
                    { key: "source_type", label: "Source",
                      render: (t) => <span className="text-muted-foreground">{t.source_type}</span> },
                    { key: "description", label: "Deskripsi", hideOnMobile: true,
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
              <text x={x} y={height + 16} fontSize="12" textAnchor="middle" fill="currentColor" opacity="0.6">{d.date.slice(-2)}</text>
            </g>
          );
        })}
      </svg>
      <div className="text-xs text-muted-foreground mt-1">
        Sumbu Y: Rp {(min / 1e6).toFixed(0)}jt — {(max / 1e6).toFixed(0)}jt · garis putus-putus = saldo awal
      </div>
    </div>
  );
}
