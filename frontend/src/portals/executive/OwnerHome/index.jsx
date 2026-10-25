/**
 * OwnerHome — Executive → Overview (route /executive)
 *
 * Ringkasan satu layar (keputusan IA 25 Okt, EXE-OV-08): KPI hari ini, pintasan eksekutif,
 * dan notifikasi terbaru. KPI WTD/MTD + top outlet ada di Sales Analytics; detail
 * approval & anomali ada di Pusat Persetujuan, Anomaly Detection dan Owner Cockpit —
 * di sini cukup angka + tautan.
 *
 * API: /api/executive/home · /api/anomalies/summary
 *      /api/approvals/counts · /api/notifications
 */
import { useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  TrendingUp, AlertTriangle, CheckSquare, Bell, BarChart3, Crown, RefreshCw,
  ArrowRight, Wallet, ClipboardList, Activity, Zap, MessageSquare, CalendarDays,
} from "lucide-react";

import { useOwnerHome } from "@/hooks/useOwnerDashboard";
import { fmtRp, fmtRelative } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { permitted } from "@/lib/portalGate";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { InlineHelp } from "@/components/shared/InlineHelp";
import CompactStatCard from "@/components/shared/CompactStatCard";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Selamat malam";
  if (h < 12) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 19) return "Selamat sore";
  return "Selamat malam";
}

const todayStr = () => {
  const d = new Date();
  return d.toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
};

// ---------------------------------------------------------------------------
// Shortcut — compact tile (icon + label), satu target klik.
// ---------------------------------------------------------------------------
function ShortcutCard({ to, icon: Icon, label, color, count, testid }) {
  return (
    <Link
      to={to}
      data-testid={testid || `shortcut-${label?.toLowerCase().replace(/\s+/g, "-")}`}
      title={label}
      className={cn(
        "glass-card relative flex items-center gap-2.5 p-2.5 min-w-0",
        "hover:shadow-md hover:border-primary/30 transition-[box-shadow,border-color] group",
      )}
    >
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 h-5 min-w-5 rounded-full bg-red-500 text-white text-[11px] font-semibold flex items-center justify-center px-1">
          {count > 99 ? "99+" : count}
        </span>
      )}
      <div
        className="h-8 w-8 shrink-0 rounded-[calc(var(--radius)-2px)] flex items-center justify-center"
        style={{
          background: `hsl(var(--${color ?? "aurora-1"}) / 0.12)`,
          color: `hsl(var(--${color ?? "aurora-1"}))`,
        }}
      >
        {Icon && <Icon className="h-4 w-4" />}
      </div>
      <span className="flex-1 min-w-0 text-xs md:text-[13px] font-medium text-foreground/80 group-hover:text-foreground transition-colors leading-tight line-clamp-2">
        {label}
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Notification Row
// ---------------------------------------------------------------------------
function NotifRow({ notif }) {
  return (
    <div className={cn("flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0", !notif.read_at && "bg-primary/[0.03] -mx-2 px-2 rounded-md")}>
      <Bell className="h-3.5 w-3.5 mt-1 flex-shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm line-clamp-1", !notif.read_at && "font-semibold")}>{notif.title}</p>
        {notif.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.body}</p>}
      </div>
      <span className="text-xs text-muted-foreground flex-shrink-0 mt-0.5">{fmtRelative(notif.created_at)}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section panel wrapper — glass-card, header px-4 pt-4 pb-2, content px-4 pb-4
// ---------------------------------------------------------------------------
function Panel({ title, icon: Icon, actionLabel, actionTo, actionTestId, children, testid }) {
  return (
    <div className="glass-card overflow-hidden" data-testid={testid}>
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2 border-b border-border/40">
        <h3 className="flex items-center gap-2 text-sm md:text-base font-semibold">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
          {title}
        </h3>
        {actionTo && (
          <Button variant="ghost" size="sm" asChild data-testid={actionTestId}>
            <Link to={actionTo}>
              {actionLabel} <ArrowRight />
            </Link>
          </Button>
        )}
      </div>
      <div className="px-4 pb-3 pt-1">{children}</div>
    </div>
  );
}

function PanelSkeleton({ h = "h-12" }) {
  return (
    <div className="space-y-2 pt-2">
      {[1, 2, 3].map(i => <Skeleton key={i} className={cn(h, "w-full rounded-lg")} />)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function OwnerHome() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading: loading, refetch } = useOwnerHome();

  const home = data?.home || null;
  const anomalySummary = data?.anomalySummary || null;
  const approvalCounts = data?.approvalCounts || null;
  const notifications = data?.notifications || [];

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Derived
  const summary = home?.summary || {};
  const openAnomalies = anomalySummary?.counts?.open ?? 0;
  const severeAnomalies = anomalySummary?.counts?.severe ?? 0;
  const totalPending = approvalCounts?.total ?? 0;

  // Pintasan eksekutif saja (portal lain ada di sidebar), disaring sesuai izin route-nya.
  const shortcuts = [
    { to: "/executive/analytics", icon: BarChart3, label: "Sales Analytics", color: "aurora-1", testid: "shortcut-analytics" },
    { to: "/executive/analytics-hub", icon: TrendingUp, label: "Performance Analytics", color: "aurora-2" },
    { to: "/executive/budget-monitor", icon: Activity, label: "Budget Monitor", color: "aurora-6",
      perm: ["executive.budget.approve", "executive.dashboard.read"] },
    { to: "/executive/budget-approvals", icon: ClipboardList, label: "Budget Approvals", color: "aurora-5",
      testid: "shortcut-budget-approval", perm: "executive.budget.approve" },
    { to: "/executive/ai-qa", icon: MessageSquare, label: "Executive Q&A", color: "aurora-3" },
    { to: "/executive/reservations", icon: CalendarDays, label: "Reservasi", color: "aurora-4" },
  ].filter(s => !s.perm || permitted(user, s.perm));

  const firstName = user?.name?.split(" ")[0] || user?.full_name?.split(" ")[0] || "Owner";

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="owner-home">

      {/* ── Header ── */}
      <PageHeader
        icon={Crown}
        className="mb-0 md:mb-0"
        title={
          <span className="inline-flex items-center gap-2">
            Overview
            <InlineHelp id="exec-overview" size="xs" placement="right" />
          </span>
        }
        subtitle={`${greeting()}, ${firstName} · ${todayStr()}`}
        actions={
          <>
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={loading}
              data-testid="owner-home-refresh"
            >
              <RefreshCw className={cn(loading && "animate-spin")} />
              Muat ulang
            </Button>
            <Button
              onClick={() => navigate("/executive/analytics")}
              data-testid="owner-home-full-analytics"
            >
              <BarChart3 />
              Sales Analytics
            </Button>
          </>
        }
      />

      {/* ── KPI hari ini — tiap kartu membuka halaman detailnya ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
        data-testid="owner-kpi-row"
      >
        <CompactStatCard
          testIdPrefix="owner-kpi"
          label="Revenue Hari Ini"
          value={fmtRp(summary.sales_today || 0)}
          sub="WTD/MTD di Sales Analytics"
          icon={TrendingUp}
          color="aurora-1"
          loading={loading}
          onClick={() => navigate("/executive/analytics")}
        />
        <CompactStatCard
          testIdPrefix="owner-kpi"
          label="AP Exposure"
          value={fmtRp(summary.ap_exposure || 0)}
          sub="Hutang dagang"
          icon={Wallet}
          color="aurora-5"
          loading={loading}
          onClick={() => navigate("/finance/ap")}
        />
        <CompactStatCard
          testIdPrefix="owner-kpi"
          label="Anomali Aktif"
          value={openAnomalies}
          sub={severeAnomalies > 0 ? `${severeAnomalies} severe` : "Tidak ada masalah kritis"}
          icon={AlertTriangle}
          color="aurora-4"
          tone={severeAnomalies > 0 ? "danger" : "default"}
          badge={severeAnomalies}
          loading={loading}
          onClick={() => navigate("/executive/anomaly")}
        />
        <CompactStatCard
          testIdPrefix="owner-kpi"
          label="Pending Approval"
          value={totalPending}
          sub="Buka Pusat Persetujuan"
          icon={CheckSquare}
          color="aurora-6"
          badge={totalPending}
          loading={loading}
          onClick={() => navigate("/my-approvals")}
        />
      </motion.div>

      {/* ── Pintasan + Notifikasi ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4"
      >
        <section aria-labelledby="owner-shortcuts-title">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <h2 id="owner-shortcuts-title" className="text-sm md:text-base font-semibold">Pintasan Eksekutif</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" data-testid="owner-shortcuts">
            {shortcuts.map(s => (
              <ShortcutCard key={s.to} to={s.to} icon={s.icon} label={s.label} color={s.color} testid={s.testid} />
            ))}
          </div>
        </section>

        <Panel
          title="Notifikasi Terbaru"
          icon={Bell}
          testid="owner-notif-panel"
          actionLabel="Semua"
          actionTo="/notifications"
        >
          {loading ? (
            <PanelSkeleton h="h-14" />
          ) : notifications.length === 0 ? (
            <EmptyState icon={Bell} title="Tidak ada notifikasi" />
          ) : (
            <div>
              {notifications.slice(0, 5).map(n => (
                <NotifRow key={n.id} notif={n} />
              ))}
            </div>
          )}
        </Panel>
      </motion.div>

    </div>
  );
}
