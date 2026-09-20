/** Owner Daily Briefing — AI-narrated personalized morning briefing page.
 *
 * Features:
 * - Time-of-day greeting card with owner name
 * - Play/Pause voice button (Web Speech API id-ID)
 * - 4 highlight stat cards (Yesterday Sales / MTD / Cash / AP Due)
 * - Top performer + Attention outlet visual cards
 * - Urgent actions list with quick-action buttons
 * - Outlet performance table (yesterday vs week-ago)
 * - Auto-refresh every 5 minutes
 */
import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { logger } from "@/lib/logger";
import {
  Sun, Coffee, Moon, Sunset, Volume2, VolumeX, Pause, Play,
  TrendingUp, TrendingDown, Wallet, AlertTriangle, Receipt,
  ArrowRight, RefreshCw, Sparkles, Trophy, AlertCircle, Package,
  ChevronRight, Activity, Zap,
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

const TIME_ICON = {
  pagi: Coffee,
  siang: Sun,
  sore: Sunset,
  malam: Moon,
};

const SEVERITY_STYLES = {
  high: "border-rose-300 bg-rose-50 text-rose-900",
  medium: "border-amber-300 bg-amber-50 text-amber-900",
  low: "border-blue-200 bg-blue-50 text-blue-900",
};

function StatTile({ icon: Icon, label, value, sublabel, trend, accent, testid }) {
  const positive = typeof trend === "number" && trend > 0;
  const negative = typeof trend === "number" && trend < 0;
  return (
    <div
      data-testid={testid}
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-white/70 backdrop-blur-sm p-5 transition-all hover:shadow-lg hover:-translate-y-0.5",
        accent === "emerald" && "border-emerald-200",
        accent === "rose" && "border-rose-200",
        accent === "amber" && "border-amber-200",
        accent === "blue" && "border-blue-200",
        accent === "indigo" && "border-indigo-200",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">{label}</div>
          <div className="text-2xl font-semibold text-slate-900 leading-tight">{value}</div>
          {sublabel && <div className="text-xs text-slate-500 mt-1">{sublabel}</div>}
        </div>
        <div className={cn(
          "size-10 rounded-xl flex items-center justify-center shrink-0",
          accent === "emerald" && "bg-emerald-100 text-emerald-700",
          accent === "rose" && "bg-rose-100 text-rose-700",
          accent === "amber" && "bg-amber-100 text-amber-700",
          accent === "blue" && "bg-blue-100 text-blue-700",
          accent === "indigo" && "bg-indigo-100 text-indigo-700",
        )}>
          <Icon className="size-5" />
        </div>
      </div>
      {typeof trend === "number" && (
        <div className={cn(
          "absolute bottom-2 right-3 flex items-center gap-1 text-xs font-medium",
          positive && "text-emerald-700",
          negative && "text-rose-700",
        )}>
          {positive && <TrendingUp className="size-3" />}
          {negative && <TrendingDown className="size-3" />}
          {trend > 0 ? "+" : ""}{trend.toFixed(1)}%
        </div>
      )}
    </div>
  );
}

function OutletCard({ outlet, kind = "top" }) {
  if (!outlet) return null;
  const isTop = kind === "top";
  const Icon = isTop ? Trophy : AlertCircle;
  return (
    <Link
      to={`/executive/outlet/${outlet.outlet_id}`}
      data-testid={`outlet-card-${kind}`}
      className={cn(
        "block rounded-2xl border p-5 transition-all hover:shadow-md hover:-translate-y-0.5",
        isTop ? "bg-emerald-50 border-emerald-200 hover:border-emerald-400" : "bg-rose-50 border-rose-200 hover:border-rose-400"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <Badge variant="secondary" className={cn(
          "uppercase tracking-wider text-[10px] font-bold",
          isTop ? "bg-emerald-200 text-emerald-900" : "bg-rose-200 text-rose-900"
        )}>
          {isTop ? "Top Performer" : "Perlu Perhatian"}
        </Badge>
        <Icon className={cn("size-5", isTop ? "text-emerald-700" : "text-rose-700")} />
      </div>
      <div className="text-lg font-semibold text-slate-900">{outlet.outlet_name}</div>
      <div className="text-xl font-bold mt-1 text-slate-900">{fmtRp(outlet.revenue)}</div>
      {typeof outlet.delta_pct === "number" && (
        <div className={cn(
          "inline-flex items-center gap-1 mt-2 text-sm font-medium",
          outlet.delta_pct > 0 ? "text-emerald-700" : "text-rose-700"
        )}>
          {outlet.delta_pct > 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
          {outlet.delta_pct > 0 ? "+" : ""}{outlet.delta_pct.toFixed(1)}% vs minggu lalu
        </div>
      )}
      <div className="flex items-center text-xs text-slate-600 mt-3">
        Drilldown <ChevronRight className="size-3 ml-1" />
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
        "group flex items-center gap-4 rounded-xl border p-4 transition-all hover:shadow-md",
        SEVERITY_STYLES[action.severity] || SEVERITY_STYLES.medium
      )}
    >
      <div className="size-10 rounded-lg bg-white/60 flex items-center justify-center shrink-0">
        <Icon className="size-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold leading-tight">{action.title}</div>
        <div className="text-xs opacity-80 mt-0.5 truncate">{action.description}</div>
      </div>
      <Button variant="ghost" size="sm" className="shrink-0 group-hover:translate-x-0.5 transition-transform">
        {action.action_label} <ArrowRight className="size-3 ml-1" />
      </Button>
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

  if (loading) return (
    <div className="space-y-6 pb-12" data-testid="daily-briefing-page">
      <LoadingState />
    </div>
  );
  if (!data) return <div className="p-6 text-slate-500">No briefing data</div>;

  const TimeIcon = TIME_ICON[data.time_of_day] || Sun;
  const h = data.highlights;

  return (
    <div className="space-y-6 pb-12" data-testid="daily-briefing-page">
      {/* HERO CARD: Greeting + Voice + Briefing text */}
      <div
        data-testid="briefing-hero"
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-50 via-white to-amber-50 border border-indigo-100 p-6 md:p-8 shadow-sm"
      >
        {/* Decorative orb */}
        <div className="absolute -right-20 -top-20 size-64 rounded-full bg-amber-200/30 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 size-64 rounded-full bg-indigo-200/30 blur-3xl pointer-events-none" />

        <div className="relative flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-2xl bg-white/80 backdrop-blur flex items-center justify-center shadow-sm">
              <TimeIcon className="size-6 text-amber-600" />
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight flex items-center gap-2">
                {data.greeting}
                <InlineHelp id="owner-daily-briefing" size="xs" placement="right" />
              </div>
              <div className="text-xs text-slate-500 uppercase tracking-wider mt-0.5">
                {fmtDate(data.today)} · Briefing Harian
                {data.llm_used && (
                  <span className="ml-2 inline-flex items-center gap-1 text-indigo-600">
                    <Sparkles className="size-3" /> AI
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              data-testid="briefing-voice-btn"
              variant={speaking ? "default" : "outline"}
              size="sm"
              onClick={speaking ? stopVoice : playVoice}
              className="gap-2"
            >
              {speaking ? <><Pause className="size-4" /> Berhenti</> : <><Volume2 className="size-4" /> Putar Suara</>}
            </Button>
            <Button
              data-testid="briefing-refresh-btn"
              variant="ghost"
              size="sm"
              onClick={() => load(true)}
              disabled={refreshing}
            >
              <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            </Button>
          </div>
        </div>

        <div
          data-testid="briefing-text"
          className="relative text-base md:text-lg leading-relaxed text-slate-800 max-w-3xl"
        >
          {data.briefing_text}
        </div>
      </div>

      {/* HIGHLIGHTS - 4 Stat Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          testid="stat-yesterday"
          icon={TrendingUp}
          label="Revenue Kemarin"
          value={fmtRp(h.yesterday_total)}
          sublabel={fmtDate(data.yesterday)}
          trend={h.yesterday_delta_pct}
          accent={h.yesterday_delta_pct >= 0 ? "emerald" : "rose"}
        />
        <StatTile
          testid="stat-mtd"
          icon={Activity}
          label="Revenue MTD"
          value={fmtRp(h.mtd_revenue)}
          sublabel="Month-to-date"
          trend={h.mtd_delta_pct}
          accent={h.mtd_delta_pct >= 0 ? "emerald" : "amber"}
        />
        <StatTile
          testid="stat-cash"
          icon={Wallet}
          label="Cash Position"
          value={fmtRp(h.cash_total)}
          sublabel="Bank + Petty Cash"
          accent="indigo"
        />
        <StatTile
          testid="stat-ap"
          icon={Receipt}
          label={`AP Jatuh Tempo (${h.ap_due_count})`}
          value={fmtRp(h.ap_due_total)}
          sublabel="7 hari ke depan"
          accent={h.ap_due_total > 100_000_000 ? "rose" : "amber"}
        />
      </div>

      {/* OUTLETS: Top + Attention */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <OutletCard outlet={h.top_outlet} kind="top" />
        {h.attention_outlet
          ? <OutletCard outlet={h.attention_outlet} kind="attention" />
          : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 flex items-center justify-center text-sm text-slate-500" data-testid="no-attention-outlet">
              <Trophy className="size-4 mr-2 text-emerald-600" /> Tidak ada outlet yang turun signifikan kemarin 🎉
            </div>
          )
        }
      </div>

      {/* URGENT ACTIONS */}
      {data.urgent_actions?.length > 0 && (
        <section data-testid="urgent-actions-section" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight text-slate-900">
              ⚡ Tindakan Prioritas ({data.urgent_actions.length})
            </h2>
          </div>
          <div className="space-y-2">
            {data.urgent_actions.map((a, idx) => (
              <UrgentActionRow key={idx} action={a} />
            ))}
          </div>
        </section>
      )}

      {/* OUTLET PERFORMANCE TABLE */}
      {data.yesterday_by_outlet?.length > 0 && (
        <section data-testid="outlet-performance-section" className="space-y-3">
          <h2 className="text-base font-semibold tracking-tight text-slate-900">
            📊 Performa Outlet Kemarin
          </h2>
          <div className="rounded-2xl border bg-white overflow-hidden">
            <DataTable
              rows={data.yesterday_by_outlet.map((o, idx) => ({ ...o, _key: o.outlet_id || idx }))}
              keyField="_key"
              rowTestIdPrefix="briefing-outlet-row"
              columns={[
                { key: "outlet_name", label: "Outlet", primary: true, render: (o) => (
                  <Link to={`/executive/outlet/${o.outlet_id}`} className="font-medium text-slate-900 hover:text-indigo-600">
                    {o.outlet_name}
                  </Link>
                ) },
                { key: "revenue", label: "Revenue", numeric: true, sortable: true, render: (o) => fmtRp(o.revenue) },
                { key: "transactions", label: "Trx", numeric: true, hideOnMobile: true,
                  render: (o) => <span className="text-slate-500">{o.transactions || "-"}</span> },
                { key: "vs_week_ago", label: "vs Week-ago", numeric: true, hideOnMobile: true,
                  render: (o) => <span className="text-slate-500">{fmtRp(o.vs_week_ago)}</span> },
                { key: "delta_pct", label: "Δ %", numeric: true, sortable: true, render: (o) => (
                  typeof o.delta_pct === "number" ? (
                    <span className={cn(
                      "inline-flex items-center gap-1 font-medium",
                      o.delta_pct > 0 ? "text-emerald-700" : "text-rose-700"
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
      <div className="text-xs text-slate-400 text-center pt-2 flex items-center justify-center gap-2">
        <Sparkles className="size-3" />
        Briefing dihasilkan {data.llm_used ? "menggunakan Gemini AI" : "secara otomatis"} · Auto-refresh setiap 5 menit
      </div>
    </div>
  );
}
