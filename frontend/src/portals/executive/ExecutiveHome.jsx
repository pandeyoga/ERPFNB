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
  BarChart3, ArrowRight, TrendingUp, Wallet, ClipboardCheck,
  Receipt, Building2, Layers, Activity, Pause, Play, FileText,
  GitCompareArrows, X,
} from "lucide-react";
import html2canvas from "html2canvas";
import { InlineHelp } from "@/components/shared/InlineHelp";
import jsPDF from "jspdf";
import { toast } from "sonner";
import {
  useBrands,
  useOutlets,
  useExecutiveKPIs,
  useSalesTrend,
  useBrandMix,
  useAPAgingSummary,
  useDashboardPreset,
} from "@/hooks/useExecutiveDashboard";
import CompactStatCard from "@/components/shared/CompactStatCard";
import PageHeader from "@/components/shared/PageHeader";
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
import SegmentedFilter from "@/components/shared/SegmentedFilter";
import { fmtRp, fmtNumber, fmtDate } from "@/lib/format";
import { useAuth } from "@/lib/auth";

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
      // `--background` is a raw HSL token ("240 20% 98%"), not a CSS colour — html2canvas threw
      // "Error parsing CSS component value" and the export silently produced nothing.
      const bg = getComputedStyle(document.body).backgroundColor || "#ffffff";
      const canvas = await html2canvas(node, { backgroundColor: bg, scale: 2, useCORS: true, windowWidth: node.scrollWidth });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pageW) / canvas.width;
      // tall dashboards span several A4 pages instead of being cut after the first
      pdf.addImage(imgData, "PNG", 0, 0, pageW, imgH);
      for (let left = imgH - pageH; left > 0; left -= pageH) {
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, left - imgH, pageW, imgH);
      }
      pdf.save(`sales-analytics-${periodMeta.period || "period"}.pdf`);
    } catch (e) {
      toast.error("Gagal membuat PDF. Coba lagi atau gunakan cetak browser.");
    } finally {
      setExporting(false);
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-3 lg:space-y-4" ref={exportRef} data-testid="executive-home-page">
      <div data-testid="executive-header">
        <PageHeader
          icon={BarChart3}
          className="mb-0 md:mb-0"
          title={
            <span className="inline-flex items-center gap-2">
              Sales Analytics
              <InlineHelp id="exec-kpi-overview" size="xs" placement="right" />
            </span>
          }
          subtitle="KPI realtime, trend & AI insights untuk seluruh group"
          actions={
            <>
              <Button
                variant={liveMode ? "default" : "outline"}
                onClick={() => setLiveMode(!liveMode)}
                aria-pressed={liveMode}
                data-testid="exec-live-toggle"
              >
                {liveMode ? <Pause /> : <Play />}
                {liveMode ? "Live aktif" : "Live mati"}
                {liveMode && <Activity className="text-emerald-300 animate-pulse" />}
              </Button>
              <Button
                onClick={exportPdf}
                disabled={exporting}
                data-testid="exec-export-pdf"
              >
                <FileText />
                {exporting ? "Mengekspor…" : "Ekspor PDF"}
              </Button>
            </>
          }
        />
      </div>

      {/* Filter bar */}
      <div className="glass-card p-3 flex flex-wrap items-center gap-2" data-testid="exec-filterbar">
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setBrandIds([]); setOutletIds([]); }}
            data-testid="exec-filters-clear"
          >
            <X /> Reset filter
          </Button>
        )}
        <div className="flex-1 min-w-0" />
        <Button variant="outline" asChild data-testid="exec-link-profit-walk">
          <Link to="/executive/analytics-hub?tab=profit-walk">
            <TrendingUp /> Profit Walk
          </Link>
        </Button>
        <Button variant="outline" asChild data-testid="exec-link-period-compare">
          <Link to="/executive/analytics-hub?tab=period-compare">
            <GitCompareArrows /> Period Compare
          </Link>
        </Button>
      </div>
      {lastRefresh && (
        <div className="text-xs text-muted-foreground -mt-1 px-1" data-testid="exec-last-refresh">
          Refresh terakhir: {fmtDate(lastRefresh.toISOString(), "DD MMM YYYY HH:mm")} {liveMode && "(auto 60s)"}
        </div>
      )}

      {/* Phase F3 — Dashboard preset selector */}
      <DashboardPresetSelector
        portal="executive"
        activePreset={activePreset}
        onSelect={setActivePreset}
      />

      {loadingK && <LoadingState rows={4} />}

      {!loadingK && kpis && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="exec-kpi-strip-primary">
            <CompactStatCard testIdPrefix="kpi" label="Sales Hari Ini" value={fmtRp(kpis.sales_today)}
              sub="Hanya yang tervalidasi" icon={Receipt} color="aurora-1"
              onClick={() => navigate("/outlet/daily-sales")} />
            <CompactStatCard testIdPrefix="kpi" label="Sales WTD" value={fmtRp(kpis.sales_wtd)}
              sub={`Sejak ${kpis.week_start}`} icon={TrendingUp} color="aurora-2" />
            <CompactStatCard testIdPrefix="kpi" label="Sales MTD" value={fmtRp(kpis.sales_mtd)}
              sub={`Periode ${kpis.period}`} icon={TrendingUp} color="aurora-4" />
            <CompactStatCard testIdPrefix="kpi" label="Inventory Value" value={fmtRp(kpis.inventory_value)}
              sub={`${fmtNumber(kpis.inventory_item_count)} item`} icon={Layers} color="aurora-5"
              onClick={() => navigate("/inventory/valuation")} />
            {/* Satu grup KPI (8 kartu, 2 baris) = ringkasan halaman tanpa judul (DESIGN_SYSTEM §10.2). */}
            <div className="contents" data-testid="exec-kpi-strip-secondary">
            <CompactStatCard testIdPrefix="kpi" label="AP Exposure" value={fmtRp(kpis.ap_exposure)}
              sub="Hutang belum dibayar" icon={Wallet} color="aurora-6"
              onClick={() => navigate("/finance/payments-hub?tab=ap-aging")} />
            <CompactStatCard testIdPrefix="kpi" label="Pending Validation" value={fmtNumber(kpis.pending_validations)}
              sub="Daily sales menunggu validasi" icon={ClipboardCheck} color="aurora-3"
              onClick={() => navigate("/finance/validation")} />
            <CompactStatCard testIdPrefix="kpi" label="Opname Aktif" value={fmtNumber(kpis.opname_pending)}
              sub="Sedang berjalan" icon={Building2} color="aurora-1"
              onClick={() => navigate("/inventory/opname")} />
            <CompactStatCard testId="exec-pl-link" label="Buka P&L" value={`Periode ${kpis.period}`}
              sub="Laporan laba rugi" icon={ArrowRight} color="aurora-2"
              onClick={() => navigate("/finance/profit-loss")} />
          </div>
          </div>

          {/* AI assistant — collapsible (default collapsed) & placed below the KPIs so it doesn't dominate the dashboard */}
          {(can("ai.chat.use") || can("ai.exec_qa.use")) && (
            <div data-testid="exec-ai-row">
              <ConversationalQA collapsible showKpi={false} />
            </div>
          )}

          {/* Brand Mix donut + AP Aging widget + Cash Position widget (priority above-the-fold) */}
          {(sections.brandMix || sections.cash || sections.apAging) && (
          <CollapsibleSection id="exec_mid_row" title="Brand & Cash" icon={Layers}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4" data-testid="exec-mid-row">
            {sections.brandMix && (
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm md:text-base font-semibold">Brand Mix</h3>
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
                <div className="glass-card p-4 text-xs text-muted-foreground">Butuh izin Cash Position (finance.cash.read).</div>
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
          <CollapsibleSection id="exec_trend_row" title="Trend & AI Insights" icon={TrendingUp}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4" data-testid="exec-trend-row">
            {sections.trend && (
            <div className="glass-card p-4 lg:col-span-2">
              <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                <h3 className="text-sm md:text-base font-semibold">Sales Trend</h3>
                <SegmentedFilter
                  value={days}
                  onChange={(v) => setDays(Number(v))}
                  ariaLabel="Rentang hari"
                  options={RANGES.map(r => ({ value: r.v, label: r.l, testId: `exec-range-${r.v}` }))}
                />
              </div>
              {loadingT ? (
                <div className="h-40 skeleton rounded-xl" />
              ) : (
                <SalesTrendChart series={trend?.series || []} height={180} />
              )}
              {trend && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50 text-sm">
                  <span className="text-muted-foreground">Total {days} hari</span>
                  <span className="font-semibold tabular-nums">{fmtRp(trend.total)}</span>
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
          <CollapsibleSection id="exec_monitor_row" title="Monitoring" icon={Activity}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4" data-testid="exec-monitor-row">
              {sections.guard && <ForecastGuardWidget />}
              {sections.anomaly && <AnomalyOverviewWidget />}
            </div>
            {/* Phase 4B: Sales Heatmap Widget */}
            <div className="mt-3 lg:mt-4">
              <SalesHeatmapWidget
                period={periodMeta?.period}
                brandIds={brandIds}
                outletIds={outletIds}
              />
            </div>
          </CollapsibleSection>
          )}

          {/* Top Outlets (Phase 4E: Enhanced table view) */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm md:text-base font-semibold">Top Outlets — Sales {kpis.period}</h3>
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
                    { key: "total", label: "Revenue", numeric: true, sortable: true, render: (o) => <span className="font-semibold">{fmtRp(o.total)}</span> },
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
