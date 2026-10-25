/**
 * OwnerHome — Sprint E16 (Executive → Overview, route /executive)
 *
 * Owner-focused portal homepage.
 * Shows: KPI summary, anomaly alerts, pending approvals,
 * quick shortcuts to all sub-modules, and recent notifications.
 *
 * API: /api/executive/home · /api/anomalies/summary
 *      /api/approvals/counts · /api/notifications
 */
import { useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  TrendingUp, AlertTriangle, CheckSquare, Bell,
  BarChart3, Users, ShoppingCart, Package,
  CreditCard, Building2, Crown, RefreshCw,
  ArrowRight, ChevronRight, Wallet, FileText,
  ClipboardList, Activity, Settings,
  Star, Zap, CircleAlert, ArrowUpRight, GitCompareArrows,
} from "lucide-react";

import { useOwnerHome } from "@/hooks/useOwnerDashboard";
import { fmtRp, fmtRelative } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
function ShortcutCard({ to, icon: Icon, label, color, count, testid, crossPortal }) {
  return (
    <Link
      to={to}
      data-testid={testid || `shortcut-${label?.toLowerCase().replace(/\s+/g, "-")}`}
      title={crossPortal ? `Buka portal ${label} (pindah portal)` : label}
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
      {/* Cross-portal affordance: indicate this shortcut leaves the current portal */}
      {crossPortal && !(count > 0) && (
        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 group-hover:text-foreground transition-colors" aria-label="Pindah portal" />
      )}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Anomaly Row
// ---------------------------------------------------------------------------
function AnomalyRow({ anomaly }) {
  const sev = anomaly.severity || "mild";
  const sevColor = (sev === "severe" || sev === "critical")
    ? "text-red-600 bg-red-500/10 border-red-500/30 dark:text-red-400"
    : (sev === "warning" || sev === "high")
      ? "text-amber-600 bg-amber-500/10 border-amber-500/30 dark:text-amber-400"
      : "text-blue-600 bg-blue-500/10 border-blue-500/30 dark:text-blue-400";
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0">
      <CircleAlert className={cn("h-4 w-4 mt-0.5 flex-shrink-0", sev === "severe" || sev === "critical" ? "text-red-500" : "text-amber-500")} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium line-clamp-1">{anomaly.description || anomaly.type}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {anomaly.outlet_name || anomaly.outlet_id || "Semua outlet"}
          {anomaly.detected_at && ` · ${fmtRelative(anomaly.detected_at)}`}
        </p>
      </div>
      <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0", sevColor)}>
        {sev}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Approval Row
// ---------------------------------------------------------------------------
function ApprovalRow({ label, count, to }) {
  if (!count) return null;
  return (
    <Link
      to={to}
      className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0 hover:bg-muted/30 -mx-2 px-2 rounded-md transition-colors group"
    >
      <span className="text-sm font-medium group-hover:text-primary transition-colors">{label}</span>
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="font-mono">{count}</Badge>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
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
  // /executive/home → summary.top_outlets[] = { outlet_id, outlet_name, total, trx, days }
  const outletRevenue = (o) => Number(o?.revenue ?? o?.total ?? 0);
  const topOutlets = summary.top_outlets || [];
  const topRevenue = outletRevenue(topOutlets[0]) || 1;

  const approvalByEntity = approvalCounts?.by_entity || {};
  const ENTITY_LABELS = {
    purchase_request:  { label: "Purchase Request",  to: "/procurement/requests" },
    purchase_order:    { label: "Purchase Order",     to: "/procurement/orders" },
    stock_adjustment:  { label: "Stok Adjustment",    to: "/inventory/adjustments" },
    employee_advance:  { label: "Kasbon Karyawan",    to: "/hr/advances" },
    payment_request:   { label: "Payment Request",    to: "/finance/payments" },
    budget:            { label: "Budget",             to: "/executive/budget-approvals" },
    leave_request:     { label: "Cuti Karyawan",      to: "/hr/leave" },
    stock_transfer:    { label: "Transfer Stok",      to: "/inventory/transfers" },
    ar_invoice:        { label: "AR Invoice",         to: "/finance/ar" },
  };

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
            <InlineHelp id="exec-kpi-overview" size="xs" placement="right" />
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

      {/* ── KPI Row ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 md:grid-cols-3 gap-3"
        data-testid="owner-kpi-row"
      >
        <CompactStatCard
          testIdPrefix="owner-kpi"
          label="Revenue Hari Ini"
          value={fmtRp(summary.sales_today || 0)}
          sub="Daily sales tervalidasi"
          icon={TrendingUp}
          color="aurora-1"
          loading={loading}
          onClick={() => navigate("/executive/analytics")}
        />
        <CompactStatCard
          testIdPrefix="owner-kpi"
          label="Revenue Minggu Ini"
          value={fmtRp(summary.sales_wtd || 0)}
          sub="Week to date"
          icon={Activity}
          color="aurora-2"
          loading={loading}
          onClick={() => navigate("/executive/analytics")}
        />
        <CompactStatCard
          testIdPrefix="owner-kpi"
          label="Revenue Bulan Ini"
          value={fmtRp(summary.sales_mtd || 0)}
          sub="Month to date"
          icon={Star}
          color="aurora-3"
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
          sub="Menunggu keputusan"
          icon={CheckSquare}
          color="aurora-6"
          badge={totalPending}
          loading={loading}
          onClick={() => navigate("/my-approvals")}
        />
      </motion.div>

      {/* ── Middle Row: Anomalies + Approvals ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4"
      >
        {/* Anomaly Panel */}
        <Panel
          title="Anomali Prioritas"
          icon={AlertTriangle}
          testid="owner-anomaly-panel"
          actionLabel="Semua"
          actionTo="/executive/anomaly"
        >
          {loading ? (
            <PanelSkeleton />
          ) : (anomalySummary?.recent?.length ?? 0) === 0 ? (
            <EmptyState icon={AlertTriangle} title="Tidak ada anomali aktif" description="Semua metrik dalam batas normal." />
          ) : (
            <div>
              {anomalySummary.recent.slice(0, 4).map(a => (
                <AnomalyRow key={a.id} anomaly={a} />
              ))}
            </div>
          )}
        </Panel>

        {/* Approvals Panel */}
        <Panel
          title="Persetujuan Tertunda"
          icon={CheckSquare}
          testid="owner-approvals-panel"
          actionLabel="Lihat semua"
          actionTo="/my-approvals"
        >
          {loading ? (
            <PanelSkeleton />
          ) : totalPending === 0 ? (
            <EmptyState icon={CheckSquare} title="Semua approval sudah diproses" description="Tidak ada yang menunggu keputusan." />
          ) : (
            <div className="pt-1">
              {Object.entries(approvalByEntity)
                .filter(([, count]) => count > 0)
                .sort(([, a], [, b]) => b - a)
                .map(([entity, count]) => {
                  const meta = ENTITY_LABELS[entity];
                  return (
                    <ApprovalRow
                      key={entity}
                      label={meta?.label || entity}
                      count={count}
                      to={meta?.to || "/my-approvals"}
                    />
                  );
                })}
            </div>
          )}
        </Panel>
      </motion.div>

      {/* ── Quick Shortcuts ── */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        aria-labelledby="owner-shortcuts-title"
      >
        <div className="flex items-center gap-2 mb-2">
          <Zap className="h-4 w-4 text-muted-foreground" />
          <h2 id="owner-shortcuts-title" className="text-sm md:text-base font-semibold">Akses Cepat</h2>
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <ArrowUpRight className="h-3 w-3" /> pindah ke portal lain
          </span>
        </div>
        <div
          className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2"
          data-testid="owner-shortcuts"
        >
          <ShortcutCard to="/executive/analytics"  icon={BarChart3}    label="Sales Analytics"  color="aurora-1" testid="shortcut-analytics" />
          <ShortcutCard to="/executive/anomaly"     icon={AlertTriangle} label="Anomali"         color="aurora-4" count={openAnomalies} />
          <ShortcutCard to="/my-approvals"          icon={CheckSquare}  label="Approvals"        color="aurora-6" count={totalPending} />
          <ShortcutCard to="/finance"               icon={CreditCard}   label="Finance"          color="aurora-2" crossPortal />
          <ShortcutCard to="/finance/ap"            icon={FileText}     label="AP Invoice"       color="aurora-3" crossPortal />
          <ShortcutCard to="/finance/ar"            icon={FileText}     label="AR Invoice"       color="aurora-5" crossPortal />
          <ShortcutCard to="/procurement"           icon={ShoppingCart} label="Procurement"      color="aurora-1" crossPortal />
          <ShortcutCard to="/inventory"             icon={Package}      label="Inventory"        color="aurora-2" crossPortal />
          <ShortcutCard to="/hr"                    icon={Users}        label="HR"               color="aurora-3" crossPortal />
          <ShortcutCard to="/outlet"                icon={Building2}    label="Outlet"           color="aurora-4" crossPortal />
          <ShortcutCard to="/executive/budget-approvals" icon={ClipboardList} label="Budget Approvals" color="aurora-5" testid="shortcut-budget-approval" />
          <ShortcutCard to="/executive/budget-monitor"   icon={Activity}      label="Budget Monitor"  color="aurora-6" />
          <ShortcutCard to="/executive/analytics-hub?tab=profit-walk"    icon={TrendingUp}       label="Profit Walk"    color="aurora-1" />
          <ShortcutCard to="/executive/analytics-hub?tab=period-compare" icon={GitCompareArrows} label="Period Compare" color="aurora-2" />
          <ShortcutCard to="/executive/analytics-hub?tab=brand"          icon={Star}             label="Brand Mix"      color="aurora-3" />
          <ShortcutCard to="/admin"                 icon={Settings}     label="Admin"            color="aurora-4" testid="shortcut-admin" crossPortal />
        </div>
      </motion.section>

      {/* ── Bottom Row: Top Outlets + Notifications ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4"
      >
        {/* Top Outlets */}
        <Panel
          title="Performa Outlet (MTD)"
          icon={Building2}
          testid="owner-outlets-panel"
          actionLabel="Detail"
          actionTo="/executive/analytics"
        >
          {loading ? (
            <PanelSkeleton h="h-10" />
          ) : topOutlets.length === 0 ? (
            <EmptyState icon={Building2} title="Belum ada data penjualan" description="Data akan muncul setelah daily close." />
          ) : (
            <div className="space-y-2.5 pt-2">
              {topOutlets.slice(0, 5).map((o, idx) => (
                <Link
                  key={o.outlet_id || idx}
                  to={o.outlet_id ? `/executive/outlet/${o.outlet_id}` : "/executive/analytics"}
                  className="flex items-center gap-3 rounded-md -mx-2 px-2 py-1 hover:bg-muted/30 transition-colors"
                  data-testid={`owner-top-outlet-${idx + 1}`}
                >
                  <span className="text-xs font-mono text-muted-foreground w-4">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{o.outlet_name || o.outlet_id}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">{fmtRp(outletRevenue(o))}</div>
                  </div>
                  <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden shrink-0">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (outletRevenue(o) / topRevenue) * 100)}%`,
                        background: "hsl(var(--aurora-1))",
                      }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        {/* Notifications */}
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
              {notifications.map(n => (
                <NotifRow key={n.id} notif={n} />
              ))}
            </div>
          )}
        </Panel>
      </motion.div>

    </div>
  );
}
