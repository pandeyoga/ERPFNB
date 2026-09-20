/**
 * ExecutiveHome — dashboard with KPIs, sales trend, brand mix donut, AP aging widget,
 * filters (period + brand multi-select + outlet multi-select), live mode, export PDF.
 *
 * Phase 9A polish.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Crown, ArrowRight, TrendingUp, Wallet, ClipboardCheck,
  Receipt, Building2, Layers, Activity, Pause, Play, FileText,
  GitCompareArrows,
} from "lucide-react";
import html2canvas from "html2canvas";
import { InlineHelp } from "@/components/shared/InlineHelp";
import jsPDF from "jspdf";
import api, { unwrap } from "@/lib/api";
import {
  useBrands,
  useOutlets,
  useExecutiveKPIs,
  useSalesTrend,
  useBrandMix,
  useAPAgingSummary,
  useDashboardPreset,
} from "@/hooks/useExecutiveDashboard";
import KpiCard from "@/components/shared/KpiCard";
import AIInsightsCard from "@/components/shared/AIInsightsCard";
import ConversationalQA from "@/components/shared/ConversationalQA";
import SalesTrendChart from "@/components/shared/SalesTrendChart";
import ForecastGuardWidget from "@/components/shared/ForecastGuardWidget";
import AnomalyOverviewWidget from "@/components/shared/AnomalyOverviewWidget";
import SalesHeatmapWidget from "@/components/shared/SalesHeatmapWidget";
import LoadingState from "@/components/shared/LoadingState";
import DataTable from "@/components/shared/DataTable";
import PeriodPicker from "@/components/shared/PeriodPicker";
import MultiSelectFilter from "@/components/shared/MultiSelectFilter";
import BrandMixDonut from "@/components/shared/BrandMixDonut";
import APAgingStackedBar from "@/components/shared/APAgingStackedBar";
import CashPositionWidget from "@/components/shared/CashPositionWidget";
import DashboardPresetSelector from "@/components/shared/DashboardPresetSelector";
import CollapsibleSection from "@/components/shared/CollapsibleSection";
import { Button } from "@/components/ui/button";
import { fmtRp, fmtNumber, fmtDate } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import useOutletScope from "@/hooks/useOutletScope";

const RANGES = [
  { v: 7, l: "7d" },
  { v: 14, l: "14d" },
  { v: 30, l: "30d" },
  { v: 60, l: "60d" },
];

const BRAND_PALETTE = [
  "#5B5FE3", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#06B6D4", "#EC4899", "#84CC16",
];

// Phase F3 — preset → which sections to render
const PRESET_SECTIONS = {
  kpi_overview:      { ai: true,  cash: true,  filters: true, kpiRow: true,  trend: true,  brandMix: true,  apAging: true,  guard: true,  anomaly: true  },
  brand_performance: { ai: false, cash: false, filters: true, kpiRow: true,  trend: true,  brandMix: true,  apAging: false, guard: false, anomaly: false },
  anomaly_watch:     { ai: true,  cash: false, filters: true, kpiRow: true,  trend: false, brandMix: false, apAging: false, guard: true,  anomaly: true  },
  finance_view:      { ai: false, cash: true,  filters: true, kpiRow: true,  trend: false, brandMix: false, apAging: true,  guard: true,  anomaly: false },
};
const DEFAULT_EXEC_PRESET = "kpi_overview";

export default function ExecutiveHome() {
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const exportRef = useRef(null);
  const queryClient = useQueryClient();

  const [periodMeta, setPeriodMeta] = useState({ preset: "month", period: null });
  const [brandIds, setBrandIds] = useState([]);
  const [outletIds, setOutletIds] = useState([]);
  const [days, setDays] = useState(30);

  const [liveMode, setLiveMode] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [activePreset, setActivePreset] = useState(DEFAULT_EXEC_PRESET);

  // React Query hooks - replaces manual useState + useEffect
  const { data: brandList = [], isLoading: loadingBrands } = useBrands();
  const { data: outletList = [], isLoading: loadingOutlets } = useOutlets();
  const { data: presetData } = useDashboardPreset("dashboard_preset_executive");

  // Load saved preset from user preferences
  useEffect(() => {
    if (presetData && PRESET_SECTIONS[presetData]) {
      setActivePreset(presetData);
    }
  }, [presetData]);

  const sections = PRESET_SECTIONS[activePreset] || PRESET_SECTIONS[DEFAULT_EXEC_PRESET];

  const filterParams = useMemo(() => {
    const p = {};
    if (periodMeta?.period) p.period = periodMeta.period;
    if (brandIds.length) p.brand_ids = brandIds.join(",");
    if (outletIds.length) p.outlet_ids = outletIds.join(",");
    return p;
  }, [periodMeta, brandIds, outletIds]);

  // React Query hooks for dashboard data
  const { data: kpis, isLoading: loadingK, refetch: refetchKpis } = useExecutiveKPIs(filterParams, sections.kpiRow);
  const { data: trend, isLoading: loadingT, refetch: refetchTrend } = useSalesTrend(filterParams, days, sections.trend);
  const { data: brandMix, isLoading: loadingMix, refetch: refetchBrandMix } = useBrandMix(filterParams, sections.brandMix);
  const { data: apAging, isLoading: loadingAp, refetch: refetchApAging } = useAPAgingSummary(sections.apAging);

  // Manual refetch all for live mode
  async function reloadAll() {
    await Promise.all([
      refetchKpis(),
      refetchTrend(),
      refetchBrandMix(),
      refetchApAging(),
    ]);
    setLastRefresh(new Date());
  }

  // Live mode auto-refresh every 60s
  useEffect(() => {
    if (!liveMode) return;
    const id = setInterval(() => reloadAll(), 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveMode]);

  // Filtered outlet options based on selected brands
  const outletOptions = useMemo(() => {
    if (brandIds.length === 0) return outletList;
    return outletList.filter(o => brandIds.includes(o.brand_id));
  }, [outletList, brandIds]);

  async function exportPdf() {
    if (!exportRef.current) return;
    setExporting(true);
    try {
      const node = exportRef.current;
      const canvas = await html2canvas(node, {
        backgroundColor: getComputedStyle(document.documentElement)
          .getPropertyValue("--background") || "#fff",
        scale: 2,
        useCORS: true,
        windowWidth: node.scrollWidth,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      const fname = `executive-dashboard-${periodMeta.period || "period"}.pdf`;
      pdf.save(fname);
    } finally {
      setExporting(false);
    }
  }

  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto" ref={exportRef} data-testid="executive-home-page">
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap" data-testid="executive-header">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl grad-aurora flex items-center justify-center">
            <Crown className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-2">
              Executive Dashboard
              <InlineHelp id="exec-kpi-overview" size="xs" placement="right" />
            </h1>
            <p className="text-sm text-muted-foreground">
              Realtime KPI, trend &amp; AI insights untuk seluruh group.
            </p>
          </div>
        </div>
      </div>

      {/* AI assistant — collapsible (default collapsed) so it doesn't dominate the dashboard */}
      {(can("ai.chat.use") || can("ai.exec_qa.use")) && (
        <div className="mb-5" data-testid="exec-ai-row">
          <ConversationalQA collapsible showKpi={false} />
        </div>
      )}

      {/* Filter bar */}
      <div className="mb-5 glass-card p-3 flex flex-wrap items-center gap-2" data-testid="exec-filterbar">
        <PeriodPicker
          value={periodMeta.preset}
          onChange={setPeriodMeta}
        />
        <MultiSelectFilter
          label="Brand"
          options={brandList}
          value={brandIds}
          onChange={ids => {
            setBrandIds(ids);
            // If brand filter restricts outlets, reset outlet selection that's no longer valid
            if (ids.length > 0) {
              setOutletIds(prev => prev.filter(oid => {
                const o = outletList.find(x => x.id === oid);
                return o && ids.includes(o.brand_id);
              }));
            }
          }}
          testId="exec-brand-filter"
        />
        <MultiSelectFilter
          label="Outlet"
          options={outletOptions}
          value={outletIds}
          onChange={setOutletIds}
          testId="exec-outlet-filter"
          width={240}
        />
        {(brandIds.length > 0 || outletIds.length > 0) && (
          <button
            onClick={() => { setBrandIds([]); setOutletIds([]); }}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-full hover:bg-foreground/5 inline-flex items-center gap-1"
            data-testid="exec-filters-clear"
          >
            <span className="text-base leading-none">×</span> Reset filter
          </button>
        )}
        <div className="flex-1 min-w-0" />
        <Link to="/executive/profit-walk">
          <Button size="sm" variant="outline" className="rounded-full gap-1.5 h-9" data-testid="exec-link-profit-walk">
            <TrendingUp className="h-3.5 w-3.5" /> Profit Walk
          </Button>
        </Link>
        <Link to="/executive/period-compare">
          <Button size="sm" variant="outline" className="rounded-full gap-1.5 h-9" data-testid="exec-link-period-compare">
            <GitCompareArrows className="h-3.5 w-3.5" /> Period Compare
          </Button>
        </Link>
        <Button
          size="sm"
          variant={liveMode ? "default" : "outline"}
          className={cn(
            "rounded-full gap-1.5 h-9",
            liveMode && "pill-active",
          )}
          onClick={() => setLiveMode(!liveMode)}
          data-testid="exec-live-toggle"
        >
          {liveMode ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {liveMode ? "Live" : "Live Off"}
          {liveMode && <Activity className="h-3 w-3 text-emerald-300 animate-pulse" />}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="glass-input rounded-full gap-1.5 h-9"
          onClick={exportPdf}
          disabled={exporting}
          data-testid="exec-export-pdf"
        >
          <FileText className="h-3.5 w-3.5" />
          {exporting ? "Exporting…" : "Export PDF"}
        </Button>
      </div>
      {lastRefresh && (
        <div className="text-[11px] text-muted-foreground mb-3 -mt-2 px-1" data-testid="exec-last-refresh">
          Refresh terakhir: {fmtDate(lastRefresh.toISOString(), "DD MMM YYYY HH:mm")} {liveMode && "(auto 60s)"}
        </div>
      )}

      {/* Phase F3 — Dashboard preset selector */}
      <div className="mb-5">
        <DashboardPresetSelector
          portal="executive"
          activePreset={activePreset}
          onSelect={setActivePreset}
        />
      </div>

      {loadingK && <LoadingState rows={4} />}

      {!loadingK && kpis && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5" data-testid="exec-kpi-strip-primary">
            <KpiCard label="Sales Hari Ini" value={fmtRp(kpis.sales_today)}
              hint="Validated only" icon={Receipt} color="aurora-1"
              onClick={() => window.location.assign("/outlet/daily-sales")} />
            <KpiCard label="Sales WTD" value={fmtRp(kpis.sales_wtd)}
              hint={`Sejak ${kpis.week_start}`} icon={TrendingUp} color="aurora-2" />
            <KpiCard label="Sales MTD" value={fmtRp(kpis.sales_mtd)}
              hint={`Period ${kpis.period}`} icon={TrendingUp} color="aurora-4" />
            <KpiCard label="Inventory Value" value={fmtRp(kpis.inventory_value)}
              hint={`${fmtNumber(kpis.inventory_item_count)} item`} icon={Layers} color="aurora-5"
              onClick={() => window.location.assign("/inventory/valuation")} />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            <KpiCard label="AP Exposure" value={fmtRp(kpis.ap_exposure)}
              hint="Unpaid GR" icon={Wallet} color="aurora-6"
              onClick={() => window.location.assign("/finance/ap-aging")} />
            <KpiCard label="Pending Validation" value={kpis.pending_validations}
              hint="Daily sales submitted" icon={ClipboardCheck} color="aurora-3"
              onClick={() => window.location.assign("/finance/validation")} />
            <KpiCard label="Opname Aktif" value={kpis.opname_pending}
              hint="In progress" icon={Building2} color="aurora-1"
              onClick={() => window.location.assign("/inventory/opname")} />
            <Link to="/finance/profit-loss" className="glass-card-hover p-4 flex items-center gap-3" data-testid="exec-pl-link">
              <div className="h-10 w-10 rounded-xl grad-aurora flex items-center justify-center text-white">
                <ArrowRight className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="text-xs uppercase text-muted-foreground">Buka P&amp;L</div>
                <div className="text-sm font-semibold">Period {kpis.period}</div>
              </div>
            </Link>
          </div>

          {/* Brand Mix donut + AP Aging widget + Cash Position widget (priority above-the-fold) */}
          {(sections.brandMix || sections.cash || sections.apAging) && (
          <CollapsibleSection id="exec_mid_row" title="Brand & Cash" icon={Layers} className="mb-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5" data-testid="exec-mid-row">
            {sections.brandMix && (
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Brand Mix</h3>
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Period {kpis.period}
                </span>
              </div>
              {loadingMix ? (
                <div className="h-48 skeleton rounded-xl" />
              ) : (
                <BrandMixDonut
                  rows={brandMix?.rows || []}
                  onSliceClick={(brandId) => navigate(`/executive/brand/${brandId}`)}
                />
              )}
            </div>
            )}
            {sections.cash && (
            <div className="lg:col-span-1">
              {can("finance.cash.read") ? (
                <CashPositionWidget />
              ) : (
                <div className="glass-card p-5 text-xs text-muted-foreground">Cash Position requires permission.</div>
              )}
            </div>
            )}
            {sections.apAging && (
            <div className="lg:col-span-1">
              {loadingAp ? (
                <div className="h-48 skeleton rounded-xl" />
              ) : (
                <APAgingStackedBar
                  buckets={apAging?.buckets || {}}
                  grand_total={apAging?.grand_total || 0}
                  top_vendors={apAging?.top_vendors || []}
                />
              )}
            </div>
            )}
          </div>
          </CollapsibleSection>
          )}

          {/* Sales Trend + AI Insights */}
          {(sections.trend || sections.ai) && (
          <CollapsibleSection id="exec_trend_row" title="Trend & AI Insights" icon={TrendingUp} className="mb-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5" data-testid="exec-trend-row">
            {sections.trend && (
            <div className="glass-card p-5 lg:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Sales Trend</h3>
                <div className="flex items-center gap-1">
                  {RANGES.map(r => (
                    <button key={r.v} onClick={() => setDays(r.v)}
                      className={cn("px-3 py-1 rounded-full text-xs transition-colors",
                        days === r.v ? "pill-active" : "hover:bg-foreground/5 text-muted-foreground")}
                      data-testid={`exec-range-${r.v}`}
                    >{r.l}</button>
                  ))}
                </div>
              </div>
              {loadingT ? (
                <div className="h-40 skeleton rounded-xl" />
              ) : (
                <SalesTrendChart series={trend?.series || []} height={180} />
              )}
              {trend && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50 text-sm">
                  <span className="text-muted-foreground">Total {days} hari</span>
                  <span className="font-bold tabular-nums">{fmtRp(trend.total)}</span>
                </div>
              )}
            </div>
            )}
            {sections.ai && <AIInsightsCard />}
          </div>
          </CollapsibleSection>
          )}

          {/* Forecast Guard + Anomaly Overview + Sales Heatmap (Phase 4B) */}
          {(sections.guard || sections.anomaly) && (
          <CollapsibleSection id="exec_monitor_row" title="Monitoring" icon={Activity} className="mb-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5" data-testid="exec-monitor-row">
              {sections.guard && <ForecastGuardWidget />}
              {sections.anomaly && <AnomalyOverviewWidget />}
            </div>
            {/* Phase 4B: Sales Heatmap Widget */}
            <div className="mt-5">
              <SalesHeatmapWidget
                period={periodMeta?.period}
                brandIds={brandIds}
                outletIds={outletIds}
              />
            </div>
          </CollapsibleSection>
          )}

          {/* Top Outlets (Phase 4E: Enhanced table view) */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Top Outlets — Sales {kpis.period}</h3>
              <Link to="/outlet/daily-sales" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                Lihat detail <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {(() => {
              const ranked = (kpis.top_outlets || []).map((o, i) => {
                const pct = kpis.sales_mtd > 0 ? (o.total / kpis.sales_mtd) * 100 : 0;
                const avgTicket = o.trx > 0 ? o.total / o.trx : 0;
                return { ...o, rank: i + 1, pct, avgTicket };
              });
              return (
                <DataTable
                  columns={[
                    { key: "rank", label: "#", render: (o) => <span className="text-xs font-mono text-muted-foreground">#{o.rank}</span> },
                    { key: "outlet_name", label: "Outlet", primary: true, sortable: true, render: (o) => (
                      <div>
                        <div className="font-medium">{o.outlet_name}</div>
                        <div className="text-xs text-muted-foreground">{o.days} hari</div>
                      </div>
                    ) },
                    { key: "total", label: "Revenue", numeric: true, sortable: true, render: (o) => <span className="font-bold">{fmtRp(o.total)}</span> },
                    { key: "trx", label: "Trx", numeric: true, sortable: true, hideOnMobile: true, render: (o) => <span className="text-muted-foreground">{fmtNumber(o.trx)}</span> },
                    { key: "avgTicket", label: "Avg Ticket", numeric: true, sortable: true, hideOnMobile: true, render: (o) => fmtRp(o.avgTicket) },
                    { key: "pct", label: "Share %", numeric: true, sortable: true, render: (o) => <span className="font-semibold">{o.pct.toFixed(1)}%</span> },
                  ]}
                  rows={ranked}
                  keyField="outlet_id"
                  defaultSort={{ key: "total", dir: "desc" }}
                  onRowClick={(o) => navigate(`/executive/outlet/${o.outlet_id}`)}
                  empty={<div className="text-sm text-muted-foreground italic" data-testid="exec-top-outlets-empty">Belum ada data sales bulan ini.</div>}
                  rowTestIdPrefix="exec-top-outlet"
                />
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}
