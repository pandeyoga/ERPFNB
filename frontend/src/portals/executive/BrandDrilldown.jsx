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
import KpiCard from "@/components/shared/KpiCard";
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

  if (loading) return <div className="max-w-7xl mx-auto"><LoadingState rows={6} /></div>;
  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <BackButton onClick={() => navigate("/executive")} />
        <EmptyState title="Gagal memuat" description={error} />
      </div>
    );
  }
  if (!data) return null;

  const brand = data.brand;
  const k = data.kpis;
  const cs = data.cost_structure;

  return (
    <div className="max-w-7xl mx-auto" data-testid="brand-drilldown-page">
      <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate("/executive")} className="glass-input rounded-full gap-1" data-testid="brand-back">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Button>
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center text-white"
            style={{ background: brand.color || "linear-gradient(135deg, #5B5FE3, #8B5CF6)" }}
          >
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight flex items-center gap-2">
              {brand.name}
              <span className="text-xs font-mono text-muted-foreground bg-foreground/10 px-2 py-0.5 rounded-full">{brand.code}</span>
            </h1>
            <p className="text-sm text-muted-foreground">Brand Drilldown — Period {data.period}</p>
          </div>
        </div>
        <PeriodPicker value="month" onChange={(meta) => setPeriod(meta.period)} />
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5" data-testid="brand-drilldown-kpi">
        <KpiCard label="Revenue MTD" value={fmtRp(k.revenue_mtd)} icon={Receipt} color="aurora-1"
          hint={`${k.trx} trx`} />
        <KpiCard label="GP %" value={`${k.gp_pct?.toFixed?.(1) ?? "0"}%`}
          hint={`COGS: ${fmtRp(k.cogs)}`} icon={TrendingUp} color="aurora-2" />
        <KpiCard label="Net (MTD)" value={fmtRp(k.net)}
          hint="Revenue - COGS - OpEx" icon={Wallet} color="aurora-4" />
        <KpiCard label="Outlets" value={`${k.active_outlets}/${k.outlet_count}`}
          hint="active / total" icon={Layers} color="aurora-5" />
      </div>

      <Tabs defaultValue="outlets" className="w-full">
        <TabsList className="glass-card p-1 mb-4">
          <TabsTrigger value="outlets" data-testid="tab-outlets">Outlets</TabsTrigger>
          <TabsTrigger value="cost" data-testid="tab-cost">Cost Structure</TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-trends">Trends</TabsTrigger>
        </TabsList>

        {/* OUTLETS TAB */}
        <TabsContent value="outlets" className="glass-card p-5">
          {data.outlets.length === 0 ? (
            <EmptyState title="Belum ada data outlet" description="Belum ada penjualan tervalidasi untuk brand ini di period ini." />
          ) : (
            <div className="space-y-2">
              {data.outlets.map((o, i) => (
                <button
                  key={o.outlet_id}
                  onClick={() => navigate(`/executive/outlet/${o.outlet_id}`)}
                  className="w-full text-left glass-input rounded-xl p-3 hover:bg-foreground/5 transition-colors"
                  data-testid={`brand-outlet-${o.outlet_id}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-mono text-muted-foreground w-6">#{i + 1}</span>
                      <span className="font-medium truncate">{o.outlet_name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">· {o.days} hari · {fmtNumber(o.trx)} trx</span>
                    </div>
                    <span className="font-bold tabular-nums shrink-0 ml-2">{fmtRp(o.total)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                    <div className="h-full grad-aurora" style={{ width: `${Math.min(100, o.share_pct).toFixed(1)}%` }} />
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {(o.share_pct ?? 0).toFixed(1)}% · klik untuk detail outlet
                  </div>
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        {/* COST STRUCTURE TAB */}
        <TabsContent value="cost" className="glass-card p-5">
          <CostStructureTable cs={cs} />
        </TabsContent>

        {/* TRENDS TAB */}
        <TabsContent value="trends" className="glass-card p-5">
          <BrandTrendsView trends={data.trends} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BackButton({ onClick }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} className="glass-input rounded-full gap-1">
      <ArrowLeft className="h-4 w-4" /> Kembali
    </Button>
  );
}

function CostStructureTable({ cs }) {
  const rows = [
    { label: "Revenue", value: cs.revenue, color: "text-foreground" },
    { label: "COGS", value: cs.cogs, color: "text-amber-600" },
    { label: "Gross Profit", value: cs.revenue - cs.cogs, color: "text-emerald-600", bold: true },
    { label: "OpEx", value: cs.opex, color: "text-red-600" },
    { label: "Service Charge (in revenue)", value: cs.service, color: "text-muted-foreground", muted: true },
    { label: "Tax (in revenue)", value: cs.tax, color: "text-muted-foreground", muted: true },
    { label: "Net", value: cs.net, color: cs.net >= 0 ? "text-emerald-600" : "text-red-600", bold: true },
  ];
  const max = Math.max(...rows.map(r => Math.abs(r.value || 0)), 1);
  return (
    <div className="space-y-3" data-testid="cost-structure">
      {rows.map((r, i) => {
        const pct = (Math.abs(r.value || 0) / max) * 100;
        return (
          <div key={i}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className={cn(r.color, r.bold ? "font-bold" : "font-medium", r.muted && "italic")}>
                {r.label}
              </span>
              <span className={cn("tabular-nums", r.color, r.bold ? "font-bold" : "")}>
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
        Net Margin: <span className="text-foreground font-bold">{fmtPct(cs.revenue ? (cs.net / cs.revenue) * 100 : 0)}</span>
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
            className="flex items-center justify-between glass-input rounded-xl p-3 hover:bg-foreground/5 transition-colors"
            data-testid={`brand-trend-outlet-${srs.outlet_id}`}
          >
            <span className="font-medium">{srs.outlet_name}</span>
            <span className="font-bold tabular-nums">{fmtRp(srs.total)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
