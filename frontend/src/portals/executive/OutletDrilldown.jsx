/**
 * OutletDrilldown — outlet-level breakdown.
 * Tabs: Daily Ops / P&L / Inventory / Staff.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft, TrendingUp, Wallet, Receipt, Package, Users, Building2, ClipboardCheck, Sparkles,
} from "lucide-react";
import api, { unwrap } from "@/lib/api";
import KpiCard from "@/components/shared/KpiCard";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import PeriodPicker from "@/components/shared/PeriodPicker";
import SalesTrendChart from "@/components/shared/SalesTrendChart";
import StatusPill from "@/components/shared/StatusPill";
import { Button } from "@/components/ui/button";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { fmtRp, fmtNumber, fmtPct, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function OutletDrilldown() {
  const { outletId } = useParams();
  const navigate = useNavigate();
  const [period, setPeriod] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/executive/outlet/${outletId}/drilldown`, {
        params: period ? { period } : {},
      });
      setData(unwrap(res));
    } catch (e) {
      setError(e?.response?.data?.errors?.[0]?.message || e?.message || "Gagal memuat data outlet.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outletId, period]);

  if (loading) return <div className="max-w-7xl mx-auto"><LoadingState rows={6} /></div>;
  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <Button variant="outline" size="sm" onClick={() => navigate("/executive")} className="glass-input rounded-full gap-1">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>
        <EmptyState title="Gagal memuat" description={error} />
      </div>
    );
  }
  if (!data) return null;

  const h = data.header;
  const ops = data.daily_ops;
  const pl = data.pl;
  const inv = data.inventory;
  const staff = data.staff;
  const trend = data.trend || [];

  return (
    <div className="max-w-7xl mx-auto" data-testid="outlet-drilldown-page">
      <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="glass-input rounded-full gap-1" data-testid="outlet-back">
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Button>
          <div className="h-10 w-10 rounded-xl grad-aurora flex items-center justify-center text-white">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight flex items-center gap-2">
              {h.outlet_name}
              <span className="text-xs font-mono text-muted-foreground bg-foreground/10 px-2 py-0.5 rounded-full">{h.outlet_code}</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              {h.brand_name && (
                <Link to={`/executive/brand/${h.brand_id}`} className="hover:text-foreground underline-offset-2 hover:underline">
                  {h.brand_name}
                </Link>
              )} · {h.address || "—"} · {h.open_time}–{h.close_time}
            </p>
          </div>
        </div>
        <PeriodPicker value="month" onChange={(meta) => setPeriod(meta.period)} />
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5" data-testid="outlet-kpi-strip">
        <KpiCard label="Revenue Period" value={fmtRp(pl.revenue)}
          hint={`${pl.transaction_count} trx · ${pl.days_active} hari`} icon={Receipt} color="aurora-1" />
        <KpiCard label="GP %" value={`${pl.gp_pct?.toFixed?.(1) ?? "0"}%`}
          hint={`COGS ${fmtRp(pl.cogs)}`} icon={TrendingUp} color="aurora-2" />
        <KpiCard label="Net" value={fmtRp(pl.net)}
          hint={`Margin ${pl.net_margin_pct?.toFixed?.(1) ?? "0"}%`} icon={Wallet} color="aurora-4" />
        <KpiCard label="Avg/Day" value={fmtRp(pl.avg_daily_sales)}
          hint="Rata-rata sales harian" icon={TrendingUp} color="aurora-5" />
      </div>

      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="glass-card p-1 mb-4 flex-wrap">
          <TabsTrigger value="daily" data-testid="tab-daily">Daily Ops</TabsTrigger>
          <TabsTrigger value="pl" data-testid="tab-pl">P&amp;L</TabsTrigger>
          <TabsTrigger value="inv" data-testid="tab-inv">Inventory</TabsTrigger>
          <TabsTrigger value="staff" data-testid="tab-staff">Staff</TabsTrigger>
        </TabsList>

        {/* DAILY OPS */}
        <TabsContent value="daily" className="glass-card p-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-3">
              <div className="glass-input rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Daily Sales hari ini</span>
                </div>
                <div className="text-right">
                  {ops.today_sales_status
                    ? <StatusPill status={ops.today_sales_status} />
                    : <span className="text-xs text-muted-foreground italic">Belum input</span>}
                  <div className="text-sm font-bold tabular-nums">{fmtRp(ops.today_grand_total)}</div>
                </div>
              </div>
              <div className="glass-input rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Petty Cash</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold tabular-nums">{fmtRp(ops.petty_cash_balance)}</div>
                  {ops.petty_cash_pending > 0 && (
                    <div className="text-[11px] text-amber-600">{ops.petty_cash_pending} draft pending</div>
                  )}
                </div>
              </div>
              <div className="glass-input rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Opname Aktif</span>
                </div>
                <span className="text-sm font-bold">{ops.opname_active}</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="glass-input rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase text-muted-foreground">KDO Pending</div>
                  <div className="text-lg font-bold">{ops.kdo_pending}</div>
                </div>
                <Link to="/outlet/kdo" className="text-xs text-muted-foreground hover:text-foreground">
                  Buka KDO →
                </Link>
              </div>
              <div className="glass-input rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase text-muted-foreground">BDO Pending</div>
                  <div className="text-lg font-bold">{ops.bdo_pending}</div>
                </div>
                <Link to="/outlet/bdo" className="text-xs text-muted-foreground hover:text-foreground">
                  Buka BDO →
                </Link>
              </div>
              <div className="glass-input rounded-xl p-4">
                <div className="text-xs uppercase text-muted-foreground mb-1">Last Daily Close</div>
                <div className="text-sm font-bold">
                  {ops.last_close_date ? fmtDate(ops.last_close_date) : "— belum pernah close"}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-5 pt-4 border-t border-border/50">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Trend 30 Hari</div>
            <SalesTrendChart series={trend} height={140} />
          </div>
        </TabsContent>

        {/* P&L */}
        <TabsContent value="pl" className="glass-card p-5">
          <PLBreakdown pl={pl} />
        </TabsContent>

        {/* INVENTORY */}
        <TabsContent value="inv" className="glass-card p-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <KpiCard label="Inventory Value" value={fmtRp(inv.valuation)} icon={Package} color="aurora-1" />
            <KpiCard label="Item Count" value={fmtNumber(inv.item_count)} icon={Package} color="aurora-2" />
            <KpiCard label="Low Stock" value={inv.low_stock_count}
              hint={inv.low_stock_count > 0 ? "perlu restock" : "sehat"}
              icon={Package} color={inv.low_stock_count > 0 ? "aurora-6" : "aurora-5"} />
          </div>
          <div className="mt-5 flex justify-end">
            <Link to="/inventory/balance" className="text-xs text-muted-foreground hover:text-foreground">
              Buka Stock Balance →
            </Link>
          </div>
        </TabsContent>

        {/* STAFF */}
        <TabsContent value="staff" className="glass-card p-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <KpiCard label="Karyawan" value={fmtNumber(staff.employee_count)} icon={Users} color="aurora-3" />
            <KpiCard label="Incentive Period" value={fmtRp(staff.incentive_period_total)} icon={Sparkles} color="aurora-4"
              hint="Dari incentive run" />
            <KpiCard label="Service Charge" value={fmtRp(staff.service_charge_distributed)}
              hint={`Status: ${staff.service_charge_status}`} icon={Wallet} color="aurora-5" />
          </div>
          <div className="mt-5 flex justify-end">
            <Link to="/hr" className="text-xs text-muted-foreground hover:text-foreground">
              Buka HR Portal →
            </Link>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PLBreakdown({ pl }) {
  const rows = [
    { label: "Revenue", value: pl.revenue, bold: true, color: "text-foreground" },
    { label: "COGS (GR)", value: -pl.cogs, color: "text-amber-600" },
    { label: "Gross Profit", value: pl.gross_profit, bold: true, color: pl.gross_profit >= 0 ? "text-emerald-600" : "text-red-600" },
    { label: "OpEx — Petty Cash", value: -pl.petty_cash_expense, color: "text-red-600" },
    { label: "OpEx — Urgent Purchase", value: -pl.urgent_purchase_expense, color: "text-red-600" },
    { label: "Net", value: pl.net, bold: true, color: pl.net >= 0 ? "text-emerald-600" : "text-red-600" },
  ];
  return (
    <div className="space-y-3" data-testid="outlet-pl">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between text-sm pb-2 border-b border-border/30">
          <span className={cn(r.color, r.bold ? "font-bold" : "font-medium")}>{r.label}</span>
          <span className={cn("tabular-nums", r.color, r.bold ? "font-bold" : "")}>{fmtRp(r.value)}</span>
        </div>
      ))}
      <div className="pt-3 grid grid-cols-2 gap-4 text-xs text-muted-foreground">
        <div>
          <div>Service Charge: <span className="text-foreground tabular-nums">{fmtRp(pl.service)}</span></div>
          <div>Tax: <span className="text-foreground tabular-nums">{fmtRp(pl.tax)}</span></div>
        </div>
        <div>
          <div>Net Margin: <span className="text-foreground font-bold">{fmtPct(pl.net_margin_pct)}</span></div>
          <div>GP %: <span className="text-foreground font-bold">{fmtPct(pl.gp_pct)}</span></div>
        </div>
      </div>
    </div>
  );
}
