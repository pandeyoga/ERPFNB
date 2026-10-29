/** Owner Daily Briefing — AI-narrated personalized morning briefing page.
 *
 * Features:
 * - Time-of-day greeting card with owner name
 * - Play/Pause voice button (Web Speech API id-ID)
 * - 4 highlight KPI cards (Yesterday Sales / MTD / Cash / AP Due) via shared KpiCard
 * - Top performer + Attention outlet visual cards
 * - Urgent actions list with quick-action buttons
 * - Outlet performance table (yesterday vs week-ago)
 * - Auto-refresh every 10 minutes (only when tab visible)
 */
import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { logger } from "@/lib/logger";
import {
  Sun, Coffee, Moon, Sunset, Volume2, Pause,
  TrendingUp, TrendingDown, Wallet, AlertTriangle, Receipt,
  ArrowRight, RefreshCw, Sparkles, Trophy, AlertCircle, Package,
  ChevronRight, Activity, Zap, BarChart3,
} from "lucide-react";
import { InlineHelp } from "@/components/shared/InlineHelp";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtRp, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import LoadingState from "@/components/shared/LoadingState";
import DataTable from "@/components/shared/DataTable";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import KpiCard from "@/components/shared/KpiCard";

const TIME_ICON = {
  pagi: Coffee,
  siang: Sun,
  sore: Sunset,
  malam: Moon,
};

const SEVERITY_STYLES = {
  high: "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-300",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  low: "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300",
};

function OutletCard({ outlet, kind = "top" }) {
  if (!outlet) return null;
  const isTop = kind === "top";
  const Icon = isTop ? Trophy : AlertCircle;
  return (
    <Link
      to={`/executive/outlet/${outlet.outlet_id}`}
      data-testid={`outlet-card-${kind}`}
      className={cn(
        "glass-card block p-4 border-l-4 transition-[box-shadow] hover:shadow-md",
        isTop ? "border-l-emerald-500" : "border-l-rose-500"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <Badge variant="secondary" className={cn(
          "uppercase tracking-wider text-[11px] font-semibold",
          isTop ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300" : "bg-rose-500/15 text-rose-800 dark:text-rose-300"
        )}>
          {isTop ? "Top Performer" : "Perlu Perhatian"}
        </Badge>
        <Icon className={cn("size-4", isTop ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400")} />
      </div>
      <h3 className="text-sm md:text-base font-semibold">{outlet.outlet_name}</h3>
      <div className="text-lg font-semibold tabular-nums mt-0.5">{fmtRp(outlet.revenue)}</div>
      <div className="flex items-center justify-between gap-2 mt-1">
        {typeof outlet.delta_pct === "number" ? (
          <span className={cn(
            "inline-flex items-center gap-1 text-xs font-medium",
            outlet.delta_pct > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
          )}>
            {outlet.delta_pct > 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
            {outlet.delta_pct > 0 ? "+" : ""}{outlet.delta_pct.toFixed(1)}% vs minggu lalu
          </span>
        ) : <span />}
        <span className="inline-flex items-center text-xs text-muted-foreground">
          Lihat detail <ChevronRight className="size-3 ml-0.5" />
        </span>
      </div>
    </Link>
  );
}

function UrgentActionRow({ action }) {
  const Icon = action.type === "low_stock" ? Package
    : action.type === "anomaly" ? AlertTriangle
    : action.type === "ap_due" ? Receipt
    : action.type === "approvals" ? Activity
    : action.type === "outlet_drop" ? TrendingDown
    : Zap;
  return (
    <Link
      to={action.action_link}
      data-testid={`urgent-action-${action.type}`}
      className={cn(
        "group flex items-center gap-3 rounded-[calc(var(--radius)-2px)] border p-3 transition-[box-shadow] hover:shadow-md",
        SEVERITY_STYLES[action.severity] || SEVERITY_STYLES.medium
      )}
    >
      <div className="size-8 rounded-md bg-background/60 flex items-center justify-center shrink-0">
        <Icon className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold leading-tight">{action.title}</div>
        {action.description && <div className="text-xs opacity-80 mt-0.5 truncate">{action.description}</div>}
      </div>
      {/* Satu target klik (seluruh baris); label aksi bukan tombol terpisah */}
      <span className="shrink-0 inline-flex items-center gap-1 text-[13px] font-medium group-hover:translate-x-0.5 transition-transform">
        {action.action_label} <ArrowRight className="size-3.5" />
      </span>
    </Link>
  );
}

export default function DailyBriefing() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const utteranceRef = useRef(null);

  const load = useCallback(async (showToast = false) => {
    if (showToast) setRefreshing(true);
    else setLoading(true);
    try {
      const r = await api.get("/owner/daily-briefing");
      const d = unwrap(r);
      setData(d);
      if (showToast) toast.success("Briefing diperbarui");
    } catch (e) {
      toast.error("Gagal memuat briefing");
      logger.error("Failed to load daily briefing data", { error: e.message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
    
    // Auto-refresh only when tab is visible (prevent unnecessary requests when user is away)
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') {
        load(false);
      }
    }, 10 * 60 * 1000); // Increased to 10 minutes (was 5 min)
    
    return () => clearInterval(t);
  }, [load]);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function playVoice() {
    if (!data || !window.speechSynthesis) {
      toast.error("Browser tidak mendukung Voice/TTS");
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(data.voice_text || data.briefing_text);
    u.lang = "id-ID";
    u.rate = 1.0;
    u.pitch = 1.0;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    utteranceRef.current = u;
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  }

  function stopVoice() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  const header = (actions) => (
    <PageHeader
      icon={Sparkles}
      className="mb-0 md:mb-0"
      title={
        <span className="inline-flex items-center gap-2">
          AI Daily Briefing
          <InlineHelp id="owner-daily-briefing" size="xs" placement="right" />
        </span>
      }
      subtitle={data ? `${fmtDate(data.today)} · Briefing harian${data.llm_used ? " · dibuat dengan AI" : ""}` : "Briefing harian untuk owner"}
      actions={actions}
    />
  );

  if (loading) return (
    <div className="space-y-3 lg:space-y-4" data-testid="daily-briefing-page">
      {header(null)}
      <LoadingState />
    </div>
  );
  if (!data) return (
    <div className="space-y-3 lg:space-y-4" data-testid="daily-briefing-page">
      {header(
        <Button variant="outline" onClick={() => load(true)} data-testid="briefing-retry-btn">
          <RefreshCw /> Muat ulang
        </Button>
      )}
      <div className="glass-card">
        <EmptyState icon={Sparkles} title="Briefing belum tersedia" description="Data briefing gagal dimuat. Coba muat ulang beberapa saat lagi." />
      </div>
    </div>
  );

  const TimeIcon = TIME_ICON[data.time_of_day] || Sun;
  const h = data.highlights;

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="daily-briefing-page">
      {header(
        <>
          <Button
            data-testid="briefing-voice-btn"
            variant={speaking ? "default" : "outline"}
            onClick={speaking ? stopVoice : playVoice}
          >
            {speaking ? <><Pause /> Berhenti</> : <><Volume2 /> Putar Suara</>}
          </Button>
          <Button
            data-testid="briefing-refresh-btn"
            variant="outline"
            size="icon"
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Muat ulang briefing"
            title="Muat ulang"
          >
            <RefreshCw className={cn(refreshing && "animate-spin")} />
          </Button>
        </>
      )}

      {/* Greeting + briefing narrative (kompak, bukan hero banner) */}
      <div data-testid="briefing-hero" className="glass-card p-4 grad-aurora-soft">
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-[calc(var(--radius)-2px)] bg-background/70 flex items-center justify-center shrink-0">
            <TimeIcon className="size-[18px] text-amber-800 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base md:text-lg font-semibold">{data.greeting}</h2>
            <p data-testid="briefing-text" className="text-sm md:text-base leading-relaxed text-foreground/90 mt-1 max-w-4xl">
              {data.briefing_text}
            </p>
          </div>
        </div>
      </div>

      {/* HIGHLIGHTS - 4 KPI (dengan delta bila ada) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          testId="stat-yesterday"
          icon={TrendingUp}
          label="Revenue Kemarin"
          value={fmtRp(h.yesterday_total)}
          delta={h.yesterday_delta_pct}
          deltaLabel={fmtDate(data.yesterday)}
          color="aurora-1"
        />
        <KpiCard
          testId="stat-mtd"
          icon={Activity}
          label="Revenue MTD"
          value={fmtRp(h.mtd_revenue)}
          delta={h.mtd_delta_pct}
          deltaLabel="Month-to-date"
          color="aurora-2"
        />
        <KpiCard
          testId="stat-cash"
          icon={Wallet}
          label="Cash Position"
          value={fmtRp(h.cash_total)}
          hint="Bank + petty cash"
          color="aurora-3"
        />
        <KpiCard
          testId="stat-ap"
          icon={Receipt}
          label={`AP Jatuh Tempo (${h.ap_due_count})`}
          value={fmtRp(h.ap_due_total)}
          hint="7 hari ke depan"
          color={h.ap_due_total > 100_000_000 ? "aurora-6" : "aurora-5"}
        />
      </div>

      {/* OUTLETS: Top + Attention */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
        <OutletCard outlet={h.top_outlet} kind="top" />
        {h.attention_outlet
          ? <OutletCard outlet={h.attention_outlet} kind="attention" />
          : (
            <div className="glass-card p-4 flex items-center justify-center text-sm text-muted-foreground" data-testid="no-attention-outlet">
              <Trophy className="size-4 mr-2 text-emerald-700 dark:text-emerald-400" /> Tidak ada outlet yang turun signifikan kemarin.
            </div>
          )
        }
      </div>

      {/* URGENT ACTIONS */}
      {data.urgent_actions?.length > 0 && (
        <section data-testid="urgent-actions-section" className="space-y-2">
          <h2 className="text-base md:text-lg font-semibold flex items-center gap-2">
            <Zap className="size-4 text-amber-800 dark:text-amber-400" /> Tindakan Prioritas ({data.urgent_actions.length})
          </h2>
          <div className="space-y-2">
            {data.urgent_actions.map((a, idx) => (
              <UrgentActionRow key={idx} action={a} />
            ))}
          </div>
        </section>
      )}

      {/* OUTLET PERFORMANCE TABLE */}
      {data.yesterday_by_outlet?.length > 0 && (
        <section data-testid="outlet-performance-section" className="space-y-2">
          <h2 className="text-base md:text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="size-4 text-muted-foreground" /> Performa Outlet Kemarin
          </h2>
          <div className="glass-card overflow-hidden">
            <DataTable
              rows={data.yesterday_by_outlet.map((o, idx) => ({ ...o, _key: o.outlet_id || idx }))}
              keyField="_key"
              rowTestIdPrefix="briefing-outlet-row"
              columns={[
                { key: "outlet_name", label: "Outlet", primary: true, render: (o) => (
                  <Link to={`/executive/outlet/${o.outlet_id}`} className="font-medium hover:text-primary hover:underline underline-offset-2">
                    {o.outlet_name}
                  </Link>
                ) },
                { key: "revenue", label: "Revenue", numeric: true, sortable: true, render: (o) => fmtRp(o.revenue) },
                { key: "transactions", label: "Trx", numeric: true, hideOnMobile: true,
                  render: (o) => <span className="text-muted-foreground">{o.transactions || "-"}</span> },
                { key: "vs_week_ago", label: "Minggu lalu", numeric: true, hideOnMobile: true,
                  render: (o) => <span className="text-muted-foreground">{fmtRp(o.vs_week_ago)}</span> },
                { key: "delta_pct", label: "Δ %", numeric: true, sortable: true, render: (o) => (
                  typeof o.delta_pct === "number" ? (
                    <span className={cn(
                      "inline-flex items-center gap-1 font-medium",
                      o.delta_pct > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
                    )}>
                      {o.delta_pct > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                      {o.delta_pct > 0 ? "+" : ""}{o.delta_pct.toFixed(1)}%
                    </span>
                  ) : "-"
                ) },
              ]}
            />
          </div>
        </section>
      )}

      {/* FOOTER */}
      <div className="text-xs text-muted-foreground text-center flex items-center justify-center gap-2">
        <Sparkles className="size-3" />
        Briefing dihasilkan {data.llm_used ? "menggunakan Gemini AI" : "secara otomatis"} · Muat ulang otomatis setiap 10 menit
      </div>
    </div>
  );
}
