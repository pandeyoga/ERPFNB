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
import CompactStatCard from "@/components/shared/CompactStatCard";
import PageHeader from "@/components/shared/PageHeader";
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

  // Kembali ke halaman asal (brand drilldown / Sales Analytics / briefing); fallback ke Sales Analytics.
  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/executive/analytics");
  };

  if (loading) return <div><LoadingState rows={6} /></div>;
  if (error) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" onClick={goBack} data-testid="outlet-back-error">
          <ArrowLeft /> Kembali
        </Button>
        <div className="glass-card"><EmptyState title="Gagal memuat" description={error} /></div>
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
    <div className="space-y-3 lg:space-y-4" data-testid="outlet-drilldown-page">
      <PageHeader
        icon={Building2}
        className="mb-0 md:mb-0"
        title={
          <span className="inline-flex items-center gap-2">
            {h.outlet_name}
            {h.outlet_code && <span className="text-xs font-mono font-medium text-muted-foreground bg-foreground/10 px-2 py-0.5 rounded-full">{h.outlet_code}</span>}
          </span>
        }
        subtitle={
          <>
            {h.brand_name && (
              <Link to={`/executive/brand/${h.brand_id}`} className="hover:text-foreground underline-offset-2 hover:underline">
                {h.brand_name}
              </Link>
            )} · {h.address || "—"} · {h.open_time}–{h.close_time}
          </>
        }
        actions={
          <>
            <Button variant="ghost" onClick={goBack} data-testid="outlet-back">
              <ArrowLeft /> Kembali
            </Button>
            <PeriodPicker value="month" onChange={(meta) => setPeriod(meta.period)} />
          </>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="outlet-kpi-strip">
        <CompactStatCard testIdPrefix="kpi" label="Revenue Period" value={fmtRp(pl.revenue)}
          sub={`${fmtNumber(pl.transaction_count)} trx · ${pl.days_active} hari`} icon={Receipt} color="aurora-1" />
        <CompactStatCard testIdPrefix="kpi" label="GP %" value={`${pl.gp_pct?.toFixed?.(1) ?? "0"}%`}
          sub={`COGS ${fmtRp(pl.cogs)}`} icon={TrendingUp} color="aurora-2" />
        <CompactStatCard testIdPrefix="kpi" label="Net" value={fmtRp(pl.net)}
          sub={`Margin ${pl.net_margin_pct?.toFixed?.(1) ?? "0"}%`} icon={Wallet} color="aurora-4" />
        <CompactStatCard testIdPrefix="kpi" label="Rata-rata/Hari" value={fmtRp(pl.avg_daily_sales)}
          sub="Rata-rata sales harian" icon={TrendingUp} color="aurora-5" />
      </div>

      <Tabs defaultValue="daily" className="w-full">
        <TabsList>
          <TabsTrigger value="daily" data-testid="tab-daily">Daily ops</TabsTrigger>
          <TabsTrigger value="pl" data-testid="tab-pl">P&amp;L</TabsTrigger>
          <TabsTrigger value="inv" data-testid="tab-inv">Inventory</TabsTrigger>
          <TabsTrigger value="staff" data-testid="tab-staff">Staff</TabsTrigger>
        </TabsList>

        {/* DAILY OPS */}
        <TabsContent value="daily" className="space-y-3 lg:space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3" data-testid="outlet-daily-ops">
            <CompactStatCard size="sm" testId="outlet-ops-today-sales" icon={ClipboardCheck} color="aurora-1"
              label="Daily Sales hari ini" value={fmtRp(ops.today_grand_total)}
              sub={ops.today_sales_status ? <StatusPill status={ops.today_sales_status} /> : "Belum input"} />
            <CompactStatCard size="sm" testId="outlet-ops-petty-cash" icon={Wallet} color="aurora-4"
              label="Petty Cash" value={fmtRp(ops.petty_cash_balance)}
              sub={ops.petty_cash_pending > 0 ? `${ops.petty_cash_pending} draft pending` : undefined}
              tone={ops.petty_cash_pending > 0 ? "warning" : "default"} />
            <CompactStatCard size="sm" testId="outlet-ops-opname" icon={Package} color="aurora-3"
              label="Opname aktif" value={fmtNumber(ops.opname_active)} />
            <CompactStatCard size="sm" testId="outlet-ops-kdo" icon={ClipboardCheck} color="aurora-5"
              label="KDO menunggu" value={fmtNumber(ops.kdo_pending)} sub="Buka KDO →"
              onClick={() => navigate("/outlet/kdo")} />
            <CompactStatCard size="sm" testId="outlet-ops-bdo" icon={ClipboardCheck} color="aurora-2"
              label="BDO menunggu" value={fmtNumber(ops.bdo_pending)} sub="Buka BDO →"
              onClick={() => navigate("/outlet/bdo")} />
            <CompactStatCard size="sm" testId="outlet-ops-last-close" icon={Building2} color="aurora-6"
              label="Last daily close" value={ops.last_close_date ? fmtDate(ops.last_close_date) : "Belum pernah"} />
          </div>
          <div className="glass-card p-4">
            <h3 className="text-sm md:text-base font-semibold mb-2">Trend 30 hari</h3>
            <SalesTrendChart series={trend} height={160} />
          </div>
        </TabsContent>

        {/* P&L */}
        <TabsContent value="pl" className="glass-card p-4">
          <PLBreakdown pl={pl} />
        </TabsContent>

        {/* INVENTORY */}
        <TabsContent value="inv" className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <CompactStatCard testIdPrefix="kpi" label="Nilai Inventory" value={fmtRp(inv.valuation)} icon={Package} color="aurora-1" />
            <CompactStatCard testIdPrefix="kpi" label="Jumlah Item" value={fmtNumber(inv.item_count)} icon={Package} color="aurora-2" />
            <CompactStatCard testIdPrefix="kpi" label="Low Stock" value={fmtNumber(inv.low_stock_count)}
              sub={inv.low_stock_count > 0 ? "perlu restock" : "sehat"}
              tone={inv.low_stock_count > 0 ? "danger" : "default"}
              icon={Package} color={inv.low_stock_count > 0 ? "aurora-6" : "aurora-5"} />
          </div>
          <div className="flex justify-end">
            <Link to="/inventory/balance" className="text-xs text-muted-foreground hover:text-foreground">
              Buka Stock Balance →
            </Link>
          </div>
        </TabsContent>

        {/* STAFF */}
        <TabsContent value="staff" className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <CompactStatCard testIdPrefix="kpi" label="Karyawan" value={fmtNumber(staff.employee_count)} icon={Users} color="aurora-3" />
            <CompactStatCard testIdPrefix="kpi" label="Incentive Period" value={fmtRp(staff.incentive_period_total)} icon={Sparkles} color="aurora-4"
              sub="Dari incentive run" />
            <CompactStatCard testIdPrefix="kpi" label="Service Charge" value={fmtRp(staff.service_charge_distributed)}
              sub={`Status: ${staff.service_charge_status}`} icon={Wallet} color="aurora-5" />
          </div>
          <div className="flex justify-end">
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
    { label: "COGS (GR)", value: -pl.cogs, color: "text-amber-800 dark:text-amber-400" },
    { label: "Gross Profit", value: pl.gross_profit, bold: true, color: pl.gross_profit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400" },
    { label: "OpEx — Petty Cash", value: -pl.petty_cash_expense, color: "text-red-700 dark:text-red-400" },
    { label: "OpEx — Urgent Purchase", value: -pl.urgent_purchase_expense, color: "text-red-700 dark:text-red-400" },
    { label: "Net", value: pl.net, bold: true, color: pl.net >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400" },
  ];
  return (
    <div className="space-y-3" data-testid="outlet-pl">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between text-sm pb-2 border-b border-border/30">
          <span className={cn(r.color, r.bold ? "font-semibold" : "font-medium")}>{r.label}</span>
          <span className={cn("tabular-nums", r.color, r.bold ? "font-semibold" : "")}>{fmtRp(r.value)}</span>
        </div>
      ))}
      <div className="pt-3 grid grid-cols-2 gap-4 text-xs text-muted-foreground">
        <div>
          <div>Service Charge: <span className="text-foreground tabular-nums">{fmtRp(pl.service)}</span></div>
          <div>Tax: <span className="text-foreground tabular-nums">{fmtRp(pl.tax)}</span></div>
        </div>
        <div>
          <div>Net Margin: <span className="text-foreground font-semibold">{fmtPct(pl.net_margin_pct)}</span></div>
          <div>GP %: <span className="text-foreground font-semibold">{fmtPct(pl.gp_pct)}</span></div>
        </div>
      </div>
    </div>
  );
}
