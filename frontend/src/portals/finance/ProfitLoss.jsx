/** Profit & Loss report with prev-period compare.
 *
 * Bug fix 2026-05-26: Defensive against backend schema variations.
 * Backend returns: { period, revenue:{rows,total,prev_total}, expense:{...},
 *                   cogs?, net_income, net_income_prev }
 * Older frontend expected: { totals:{revenue,gross_profit,...}, sections:{...},
 *                            compare:{...} }
 * We now normalize whichever shape we receive into the same internal model
 * so the component renders without crashing.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { Button } from "@/components/ui/button";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import KpiCard from "@/components/shared/KpiCard";
import { fmtRp, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";
import useOutletScope from "@/hooks/useOutletScope";

const LABEL = "text-xs font-medium text-muted-foreground";

/** Δ% vs periode sebelumnya (null bila tidak ada pembanding). */
function deltaPct(value, compare) {
  if (compare == null || compare === 0) return null;
  return (((value || 0) - compare) / Math.abs(compare)) * 100;
}

const SECTION_LABELS = { revenue: "Revenue", cogs: "Cost of Goods Sold (COGS)", expense: "Operating Expenses" };

/**
 * Normalize either shape of P&L API response into a uniform internal model:
 *   {
 *     totals: { revenue, cogs, expense, gross_profit, net_income, gross_margin_pct, net_margin_pct },
 *     sections: { revenue: [...], cogs: [...], expense: [...] },
 *     compare:  { revenue, cogs, expense, gross_profit, net_income },
 *   }
 */
function normalizeData(raw) {
  if (!raw) return null;
  // Already in the legacy shape (with `totals` + `sections`)?
  if (raw.totals && raw.sections) {
    return {
      totals: {
        revenue: raw.totals.revenue || 0,
        cogs: raw.totals.cogs || 0,
        expense: raw.totals.expense || 0,
        gross_profit: raw.totals.gross_profit ?? ((raw.totals.revenue || 0) - (raw.totals.cogs || 0)),
        net_income: raw.totals.net_income ?? ((raw.totals.revenue || 0) - (raw.totals.cogs || 0) - (raw.totals.expense || 0)),
        gross_margin_pct: raw.totals.gross_margin_pct ?? 0,
        net_margin_pct: raw.totals.net_margin_pct ?? 0,
      },
      sections: {
        revenue: raw.sections.revenue || [],
        cogs: raw.sections.cogs || [],
        expense: raw.sections.expense || [],
      },
      compare: raw.compare || {},
    };
  }

  // New / actual shape from /api/finance/profit-loss
  const revenueTotal = raw.revenue?.total || 0;
  const cogsTotal = raw.cogs?.total || 0;
  const expenseTotal = raw.expense?.total || 0;
  const grossProfit = revenueTotal - cogsTotal;
  const netIncome = raw.net_income ?? (grossProfit - expenseTotal);

  return {
    totals: {
      revenue: revenueTotal,
      cogs: cogsTotal,
      expense: expenseTotal,
      gross_profit: grossProfit,
      net_income: netIncome,
      gross_margin_pct: revenueTotal > 0 ? Math.round((grossProfit / revenueTotal) * 100) : 0,
      net_margin_pct: revenueTotal > 0 ? Math.round((netIncome / revenueTotal) * 100) : 0,
    },
    sections: {
      revenue: raw.revenue?.rows || [],
      cogs: raw.cogs?.rows || [],
      expense: raw.expense?.rows || [],
    },
    compare: {
      revenue: raw.revenue?.prev_total ?? 0,
      cogs: raw.cogs?.prev_total ?? 0,
      expense: raw.expense?.prev_total ?? 0,
      gross_profit: (raw.revenue?.prev_total ?? 0) - (raw.cogs?.prev_total ?? 0),
      net_income: raw.net_income_prev ?? 0,
    },
  };
}

export default function ProfitLoss() {
  const [period, setPeriod] = useState(() => todayJakartaISO().slice(0, 7));
  const { outletId, setOutletId, scopedOutlets } = useOutletScope();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const params = { period, compare_prev: true };
      if (outletId) params.dim_outlet = outletId;
      const res = await api.get("/finance/profit-loss", { params });
      setData(normalizeData(unwrap(res)));
    } catch (e) {
      toast.error("Gagal memuat Profit & Loss");
      setData(null);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [period, outletId]); // eslint-disable-line

  function exportCsv() {
    if (!data) return;
    const lines = ["Section,Code,Name,Amount"];
    ["revenue", "cogs", "expense"].forEach(sec => {
      (data.sections[sec] || []).forEach(r => {
        lines.push(`${sec},${r.code || ""},"${r.name || ""}",${r.amount || 0}`);
      });
    });
    lines.push(`,,Gross Profit,${data.totals.gross_profit}`);
    lines.push(`,,Net Income,${data.totals.net_income}`);
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `PL-${period}${outletId ? `-${outletId.slice(0, 6)}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasAnyData = data && (
    (data.sections.revenue?.length || 0) +
    (data.sections.cogs?.length || 0) +
    (data.sections.expense?.length || 0)
  ) > 0;

  return (
    <div data-testid="profit-loss-page" className="space-y-3 lg:space-y-4">
      <div data-testid="pl-filter-card" className="glass-card p-3 flex flex-wrap gap-3 items-end">
        <div className="min-w-[140px]">
          <Label htmlFor="pl-period" className={LABEL}>Periode</Label>
          <Input id="pl-period" type="month" value={period} onChange={e => setPeriod(e.target.value)}
            className="glass-input mt-1 h-9" data-testid="pl-period" />
        </div>
        <div className="min-w-[180px]">
          <Label className={LABEL}>Outlet</Label>
          <SimpleSelect value={outletId} onValueChange={setOutletId} ariaLabel="Outlet"
            options={[{ value: "", label: "Consolidated" }, ...(scopedOutlets || []).map(o => ({ value: o.id, label: o.name }))]}
            placeholder="Consolidated"
            className="glass-input rounded-lg w-full h-9 text-sm mt-1" testId="pl-outlet" />
        </div>
        <Button onClick={exportCsv} variant="outline" className="ml-auto" data-testid="pl-export" disabled={!data}>
          <Download /> Ekspor CSV
        </Button>
      </div>

      {loading && <LoadingState rows={6} />}

      {!loading && data && (
        <>
          <div data-testid="pl-summary-cards" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <PlKpi label="Revenue" value={data.totals.revenue} compare={data.compare?.revenue} testId="pl-kpi-revenue" />
            <PlKpi label="Gross Profit" value={data.totals.gross_profit} compare={data.compare?.gross_profit}
              hint={`Margin ${data.totals.gross_margin_pct}%`} testId="pl-kpi-gross-profit" />
            <PlKpi label="Operating Expense" value={data.totals.expense} compare={data.compare?.expense} invertDelta testId="pl-kpi-expense" />
            <PlKpi label="Net Income" value={data.totals.net_income} compare={data.compare?.net_income}
              hint={`Margin ${data.totals.net_margin_pct}%`} testId="pl-kpi-net-income" />
          </div>

          {!hasAnyData ? (
            <EmptyState
              title="Belum ada data P&L untuk periode ini"
              description="Validasi sales atau jurnal pada periode ini belum diposting. Coba periode lain atau cek Daily Sales."
            />
          ) : (
            ["revenue", "cogs", "expense"].map(sec => {
              const items = data.sections[sec] || [];
              const total = items.reduce((s, r) => s + (r.amount || 0), 0);
              if (items.length === 0 && sec === "cogs") return null; // hide empty cogs entirely
              return (
                <div key={sec} data-testid={`pl-section-${sec}`} className="glass-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm md:text-base font-semibold">{SECTION_LABELS[sec]}</h3>
                    <span className="font-semibold tabular-nums">{fmtRp(total)}</span>
                  </div>
                  {items.length === 0 ? (
                    <div className="text-sm text-muted-foreground italic">—</div>
                  ) : (
                    <DataTable
                      rows={items}
                      keyField="code"
                      rowTestIdPrefix={`pl-${sec}-row`}
                      empty={<div className="text-sm text-muted-foreground italic px-1 py-2">—</div>}
                      columns={[
                        { key: "code", label: "Kode", primary: true,
                          render: (r) => <span className="text-xs font-medium tabular-nums text-muted-foreground">{r.code}</span> },
                        { key: "name", label: "Akun",
                          render: (r) => (
                            <Link to={`/finance/journals?period=${period}${r.coa_id ? `&coa_id=${r.coa_id}` : ""}`}
                              className="hover:text-foreground hover:underline" data-testid={`pl-coa-${r.code}`}>
                              {r.name}
                            </Link>
                          ) },
                        { key: "amount", label: "Jumlah", numeric: true, sortable: true,
                          render: (r) => fmtRp(r.amount || 0) },
                      ]}
                    />
                  )}
                </div>
              );
            })
          )}

          <div data-testid="pl-totals-card" className="glass-card p-4 grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4 text-sm">
            <div className="flex justify-between font-semibold">
              <span>Gross Profit</span>
              <span className="tabular-nums">{fmtRp(data.totals.gross_profit)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span>Net Income</span>
              <span className="tabular-nums">{fmtRp(data.totals.net_income)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** KPI P&L dengan delta vs periode lalu → shared KpiCard (bukan tile lokal). */
function PlKpi({ label, value, compare, hint, testId, invertDelta }) {
  const d = deltaPct(value, compare);
  const deltaLabel = d != null ? (hint ? `vs bln lalu · ${hint}` : "vs bulan lalu") : hint;
  return <KpiCard label={label} value={fmtRp(value || 0)} delta={d} deltaLabel={deltaLabel} invertDelta={invertDelta} testId={testId} />;
}
