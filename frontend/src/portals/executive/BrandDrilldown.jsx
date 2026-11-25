/**
 * BrandDrilldown — brand-level breakdown.
 * Tabs: Overview / Outlets / Cost Structure / Trends.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft, TrendingUp, Wallet, Receipt, Layers, Building2,
} from "lucide-react";
import api, { unwrap } from "@/lib/api";
import CompactStatCard from "@/components/shared/CompactStatCard";
import PageHeader from "@/components/shared/PageHeader";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import PeriodPicker from "@/components/shared/PeriodPicker";
import SalesTrendChart from "@/components/shared/SalesTrendChart";
import { Button } from "@/components/ui/button";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { fmtRp, fmtNumber, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function BrandDrilldown() {
  const { brandId } = useParams();
  const navigate = useNavigate();
  const [period, setPeriod] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/executive/brand/${brandId}/drilldown`, {
        params: period ? { period } : {},
      });
      setData(unwrap(res));
    } catch (e) {
      setError(e?.response?.data?.errors?.[0]?.message || e?.message || "Gagal memuat data brand.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, period]);

  // Kembali ke halaman asal (Brand Mix / Sales Analytics); fallback ke Performance Analytics.
  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/executive/analytics-hub?tab=brand");
  };

  if (loading) return <div><LoadingState rows={6} /></div>;
  if (error) {
    return (
      <div className="space-y-3">
        <BackButton onClick={goBack} />
        <div className="glass-card"><EmptyState title="Gagal memuat" description={error} /></div>
      </div>
    );
  }
  if (!data) return null;

  const brand = data.brand;
  const k = data.kpis;
  const cs = data.cost_structure;

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="brand-drilldown-page">
      <PageHeader
        icon={Building2}
        className="mb-0 md:mb-0"
        title={
          <span className="inline-flex items-center gap-2">
            {brand.name}
            {brand.code && <span className="text-xs font-mono font-medium text-muted-foreground bg-foreground/10 px-2 py-0.5 rounded-full">{brand.code}</span>}
          </span>
        }
        subtitle={`Brand drilldown — periode ${data.period}`}
        actions={
          <>
            <Button variant="ghost" onClick={goBack} data-testid="brand-back">
              <ArrowLeft /> Kembali
            </Button>
            <PeriodPicker value="month" onChange={(meta) => setPeriod(meta.period)} />
          </>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="brand-drilldown-kpi">
        <CompactStatCard testIdPrefix="kpi" label="Revenue MTD" value={fmtRp(k.revenue_mtd)} icon={Receipt} color="aurora-1"
          sub={`${fmtNumber(k.trx)} trx`} />
        <CompactStatCard testIdPrefix="kpi" label="GP %" value={`${k.gp_pct?.toFixed?.(1) ?? "0"}%`}
          sub={`COGS: ${fmtRp(k.cogs)}`} icon={TrendingUp} color="aurora-2" />
        <CompactStatCard testIdPrefix="kpi" label="Net (MTD)" value={fmtRp(k.net)}
          sub="Revenue - COGS - OpEx" icon={Wallet} color="aurora-4" />
        <CompactStatCard testIdPrefix="kpi" label="Outlets" value={`${k.active_outlets}/${k.outlet_count}`}
          sub="aktif / total" icon={Layers} color="aurora-5" />
      </div>

      <Tabs defaultValue="outlets" className="w-full">
        <TabsList>
          <TabsTrigger value="outlets" data-testid="tab-outlets">Outlets</TabsTrigger>
          <TabsTrigger value="cost" data-testid="tab-cost">Cost structure</TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-trends">Trends</TabsTrigger>
        </TabsList>

        {/* OUTLETS TAB */}
        <TabsContent value="outlets" className="glass-card p-4">
          {data.outlets.length === 0 ? (
            <EmptyState title="Belum ada data outlet" description="Belum ada penjualan tervalidasi untuk brand ini di period ini." />
          ) : (
            <div className="space-y-2">
              {data.outlets.map((o, i) => (
                <button
                  type="button"
                  key={o.outlet_id}
                  onClick={() => navigate(`/executive/outlet/${o.outlet_id}`)}
                  className="w-full text-left rounded-[calc(var(--radius)-2px)] border border-border/60 p-3 hover:bg-foreground/5 transition-colors"
                  data-testid={`brand-outlet-${o.outlet_id}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-mono text-muted-foreground w-6">#{i + 1}</span>
                      <span className="font-medium truncate">{o.outlet_name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">· {o.days} hari · {fmtNumber(o.trx)} trx</span>
                    </div>
                    <span className="font-semibold tabular-nums shrink-0 ml-2">{fmtRp(o.total)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                    <div className="h-full grad-aurora" style={{ width: `${Math.min(100, o.share_pct).toFixed(1)}%` }} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {(o.share_pct ?? 0).toFixed(1)}% · klik untuk detail outlet
                  </div>
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        {/* COST STRUCTURE TAB */}
        <TabsContent value="cost" className="glass-card p-4">
          <CostStructureTable cs={cs} />
        </TabsContent>

        {/* TRENDS TAB */}
        <TabsContent value="trends" className="glass-card p-4">
          <BrandTrendsView trends={data.trends} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BackButton({ onClick }) {
  return (
    <Button variant="ghost" onClick={onClick} data-testid="brand-back-error">
      <ArrowLeft /> Kembali
    </Button>
  );
}

function CostStructureTable({ cs }) {
  const rows = [
    { label: "Revenue", value: cs.revenue, color: "text-foreground" },
    { label: "COGS", value: cs.cogs, color: "text-amber-800 dark:text-amber-400" },
    { label: "Gross Profit", value: cs.revenue - cs.cogs, color: "text-emerald-700 dark:text-emerald-400", bold: true },
    { label: "OpEx", value: cs.opex, color: "text-red-700 dark:text-red-400" },
    { label: "Service Charge (in revenue)", value: cs.service, color: "text-muted-foreground", muted: true },
    { label: "Tax (in revenue)", value: cs.tax, color: "text-muted-foreground", muted: true },
    { label: "Net", value: cs.net, color: cs.net >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400", bold: true },
  ];
  const max = Math.max(...rows.map(r => Math.abs(r.value || 0)), 1);
  return (
    <div className="space-y-3" data-testid="cost-structure">
      {rows.map((r, i) => {
        const pct = (Math.abs(r.value || 0) / max) * 100;
        return (
          <div key={i}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className={cn(r.color, r.bold ? "font-semibold" : "font-medium", r.muted && "italic")}>
                {r.label}
              </span>
              <span className={cn("tabular-nums", r.color, r.bold ? "font-semibold" : "")}>
                {fmtRp(r.value)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-foreground/10 overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all",
                  (r.value || 0) >= 0 ? "bg-emerald-500/60" : "bg-red-500/60",
                )}
                style={{ width: `${pct.toFixed(1)}%` }}
              />
            </div>
          </div>
        );
      })}
      <div className="pt-3 mt-3 border-t border-border/50 text-xs text-muted-foreground">
        Net Margin: <span className="text-foreground font-semibold">{fmtPct(cs.revenue ? (cs.net / cs.revenue) * 100 : 0)}</span>
      </div>
    </div>
  );
}

function BrandTrendsView({ trends }) {
  // Convert per-outlet daily series → composite + per-outlet stacked
  const dates = trends?.dates || [];
  const series = trends?.series || [];
  const composite = useMemo(() => {
    return dates.map((d, i) => {
      const total = series.reduce((s, srs) => s + (srs.daily?.[i] || 0), 0);
      return { date: d, total, trx: 0 };
    });
  }, [dates, series]);

  if (!dates.length) {
    return <EmptyState title="Belum ada data trend" description="Belum ada penjualan untuk brand ini." />;
  }

  return (
    <div className="space-y-4" data-testid="brand-trends">
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Total Brand (30 hari terakhir)</div>
        <SalesTrendChart series={composite} height={180} />
      </div>
      <div className="space-y-2 pt-3 border-t border-border/50">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Per Outlet</div>
        {series.map(srs => (
          <Link
            key={srs.outlet_id}
            to={`/executive/outlet/${srs.outlet_id}`}
            className="flex items-center justify-between rounded-[calc(var(--radius)-2px)] border border-border/60 p-3 hover:bg-foreground/5 transition-colors"
            data-testid={`brand-trend-outlet-${srs.outlet_id}`}
          >
            <span className="font-medium">{srs.outlet_name}</span>
            <span className="font-semibold tabular-nums">{fmtRp(srs.total)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
