/**
 * OwnerHome — Sprint E16
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
  ClipboardList, Activity, Settings, LogOut,
  Star, Zap, Clock, CircleAlert, ArrowUpRight,
} from "lucide-react";

import { useOwnerHome } from "@/hooks/useOwnerDashboard";
import { fmtRp, fmtDate, fmtRelative } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { InlineHelp } from "@/components/shared/InlineHelp";
import CompactStatCard from "@/components/shared/CompactStatCard";

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
// KPI Tile
// ---------------------------------------------------------------------------
function KpiTile({ label, value, sub, icon, color, onClick, badge, loading }) {
  // Phase 2: delegate to the canonical CompactStatCard (reduces stat-card variants),
  // preserving the owner-kpi-* testids the rest of the app relies on.
  return (
    <CompactStatCard
      label={label}
      value={value}
      sub={sub}
      icon={icon}
      color={color}
      onClick={onClick}
      badge={badge}
      loading={loading}
      testIdPrefix="owner-kpi"
    />
  );
}

// ---------------------------------------------------------------------------
// Shortcut Card
// ---------------------------------------------------------------------------
function ShortcutCard({ to, icon: Icon, label, color, count, testid, crossPortal }) {
  return (
    <Link
      to={to}
      data-testid={testid || `shortcut-${label?.toLowerCase().replace(/\s+/g, "-")}`}
      title={crossPortal ? `Buka portal ${label} (pindah portal)` : label}
      className={cn(
        "relative flex flex-col items-center gap-2 p-4 rounded-2xl border border-border/50",
        "bg-card hover:bg-muted/40 hover:border-primary/30 hover:shadow-sm",
        "transition-all duration-150 text-center group",
      )}
    >
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 h-5 min-w-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center px-1">
          {count > 99 ? "99+" : count}
        </span>
      )}
      {/* Cross-portal affordance: indicate this shortcut leaves the current portal */}
      {crossPortal && count == null && (
        <span
          className="absolute top-1.5 right-1.5 text-muted-foreground/50 group-hover:text-foreground transition-colors"
          aria-label="Pindah portal"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      )}
      <div
        className="h-11 w-11 rounded-xl flex items-center justify-center"
        style={{
          background: `hsl(var(--${color ?? "aurora-1"}) / 0.12)`,
          color: `hsl(var(--${color ?? "aurora-1"}))`,
        }}
      >
        {Icon && <Icon className="h-5 w-5" />}
      </div>
      <span className="text-xs font-medium text-foreground/80 group-hover:text-foreground transition-colors leading-tight">
        {label}
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Anomaly Row
// ---------------------------------------------------------------------------
function AnomalyRow({ anomaly }) {
  const sev = anomaly.severity || "mild";
  const sevColor = sev === "severe" ? "text-red-600 bg-red-50 border-red-200"
    : sev === "warning" ? "text-amber-600 bg-amber-50 border-amber-200"
    : "text-blue-600 bg-blue-50 border-blue-200";
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/40 last:border-0">
      <CircleAlert className={cn("h-4 w-4 mt-0.5 flex-shrink-0", sev === "severe" ? "text-red-500" : "text-amber-500")} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium line-clamp-1">{anomaly.description || anomaly.type}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {anomaly.outlet_name || anomaly.outlet_id || "Semua outlet"}
          {anomaly.detected_at && ` · ${fmtRelative(anomaly.detected_at)}`}
        </p>
      </div>
      <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border flex-shrink-0", sevColor)}>
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
      className="flex items-center justify-between py-3 border-b border-border/40 last:border-0 hover:bg-muted/30 -mx-3 px-3 rounded-lg transition-colors group"
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
    <div className={cn("flex items-start gap-3 py-3 border-b border-border/40 last:border-0", !notif.read_at && "bg-primary/3 -mx-3 px-3 rounded-lg")}>
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
// Section panel wrapper
// ---------------------------------------------------------------------------
function Panel({ title, icon: Icon, action, children, testid }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden" data-testid={testid}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
          <span className="text-sm font-semibold">{title}</span>
        </div>
        {action}
      </div>
      <div className="px-5 pb-4 pt-1">{children}</div>
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

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-screen-xl mx-auto" data-testid="owner-home">

      {/* ── Welcome Banner ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border/60 bg-gradient-to-r from-card to-muted/20 p-6 shadow-sm"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className="h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "hsl(var(--aurora-1) / 0.15)", color: "hsl(var(--aurora-1))" }}
            >
              <Crown className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                {greeting()}, {user?.name?.split(" ")[0] || "Owner"} 👋
                <InlineHelp id="exec-kpi-overview" size="xs" placement="right" />
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">{todayStr()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
              aria-label="Refresh dashboard"
              data-testid="owner-home-refresh"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => navigate("/executive/analytics")}
              data-testid="owner-home-full-analytics"
            >
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
              Full Analytics
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ── KPI Row ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
        data-testid="owner-kpi-row"
      >
        <KpiTile
          label="Revenue Hari Ini"
          value={loading ? "—" : fmtRp(summary.sales_today || 0)}
          sub="vs kemarin"
          icon={TrendingUp}
          color="aurora-1"
          loading={loading}
          onClick={() => navigate("/executive/analytics")}
        />
        <KpiTile
          label="Revenue Minggu Ini"
          value={loading ? "—" : fmtRp(summary.sales_wtd || 0)}
          sub="week to date"
          icon={Activity}
          color="aurora-2"
          loading={loading}
          onClick={() => navigate("/executive/analytics")}
        />
        <KpiTile
          label="Revenue Bulan Ini"
          value={loading ? "—" : fmtRp(summary.sales_mtd || 0)}
          sub="month to date"
          icon={Star}
          color="aurora-3"
          loading={loading}
          onClick={() => navigate("/executive/analytics")}
        />
        <KpiTile
          label="AP Exposure"
          value={loading ? "—" : fmtRp(summary.ap_exposure || 0)}
          sub="hutang dagang"
          icon={Wallet}
          color="aurora-5"
          loading={loading}
          onClick={() => navigate("/finance/ap")}
        />
        <KpiTile
          label="Anomali Aktif"
          value={loading ? "—" : openAnomalies}
          sub={severeAnomalies > 0 ? `${severeAnomalies} severe` : "tidak ada masalah kritis"}
          icon={AlertTriangle}
          color="aurora-4"
          badge={severeAnomalies}
          loading={loading}
          onClick={() => navigate("/executive/anomaly")}
        />
        <KpiTile
          label="Pending Approval"
          value={loading ? "—" : totalPending}
          sub="menunggu keputusan"
          icon={CheckSquare}
          color="aurora-6"
          badge={totalPending}
          loading={loading}
          onClick={() => navigate("/executive/approvals")}
        />
      </motion.div>

      {/* ── Middle Row: Anomalies + Approvals ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {/* Anomaly Panel */}
        <Panel
          title="Anomali Prioritas"
          icon={AlertTriangle}
          testid="owner-anomaly-panel"
          action={
            <Link to="/executive/anomaly">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                Semua <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          }
        >
          {loading ? (
            <div className="space-y-2 pt-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
            </div>
          ) : (anomalySummary?.recent?.length ?? 0) === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Tidak ada anomali aktif</p>
              <p className="text-xs mt-1 opacity-70">Semua metric dalam batas normal</p>
            </div>
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
          action={
            <Link to="/executive/approvals">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                Lihat semua <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          }
        >
          {loading ? (
            <div className="space-y-2 pt-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
            </div>
          ) : totalPending === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <CheckSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Semua approval sudah diproses</p>
              <p className="text-xs mt-1 opacity-70">Tidak ada yang menunggu keputusan</p>
            </div>
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
                      to={meta?.to || "/executive/approvals"}
                    />
                  );
                })}
            </div>
          )}
        </Panel>
      </motion.div>

      {/* ── Quick Shortcuts ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Akses Cepat</span>
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <ArrowUpRight className="h-3 w-3" /> pindah ke portal lain
          </span>
        </div>
        <div
          className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3"
          data-testid="owner-shortcuts"
        >
          <ShortcutCard to="/executive/analytics"  icon={BarChart3}    label="Analytics"        color="aurora-1" />
          <ShortcutCard to="/executive/anomaly"     icon={AlertTriangle} label="Anomali"         color="aurora-4" count={openAnomalies} />
          <ShortcutCard to="/executive/approvals"   icon={CheckSquare}  label="Approvals"        color="aurora-6" count={totalPending} />
          <ShortcutCard to="/finance"               icon={CreditCard}   label="Finance"          color="aurora-2" crossPortal />
          <ShortcutCard to="/finance/ap"            icon={FileText}     label="AP Invoice"       color="aurora-3" crossPortal />
          <ShortcutCard to="/finance/ar"            icon={FileText}     label="AR Invoice"       color="aurora-5" crossPortal />
          <ShortcutCard to="/procurement"           icon={ShoppingCart} label="Procurement"      color="aurora-1" crossPortal />
          <ShortcutCard to="/inventory"             icon={Package}      label="Inventory"        color="aurora-2" crossPortal />
          <ShortcutCard to="/hr"                    icon={Users}        label="HR"               color="aurora-3" crossPortal />
          <ShortcutCard to="/outlet"                icon={Building2}    label="Outlet"           color="aurora-4" crossPortal />
          <ShortcutCard to="/executive/budget-approvals" icon={ClipboardList} label="Budget Approval" color="aurora-5" />
          <ShortcutCard to="/executive/budget-monitor"   icon={Activity}      label="Budget Monitor"  color="aurora-6" />
          <ShortcutCard to="/executive/profit-walk" icon={TrendingUp}   label="Profit Walk"      color="aurora-1" />
          <ShortcutCard to="/executive/period-compare" icon={BarChart3} label="Period Compare"   color="aurora-2" />
          <ShortcutCard to="/executive/brand"       icon={Star}         label="Brand Mix"        color="aurora-3" />
          <ShortcutCard to="/admin"                 icon={Settings}     label="Admin"            color="aurora-4" testid="shortcut-admin" crossPortal />
        </div>
      </motion.div>

      {/* ── Bottom Row: Top Outlets + Notifications ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-6"
      >
        {/* Top Outlets */}
        <Panel
          title="Performa Outlet"
          icon={Building2}
          testid="owner-outlets-panel"
          action={
            <Link to="/executive/analytics">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                Detail <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          }
        >
          {loading ? (
            <div className="space-y-2 pt-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
            </div>
          ) : (summary.top_outlets?.length ?? 0) === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Belum ada data penjualan</p>
              <p className="text-xs mt-1 opacity-70">Data akan muncul setelah daily close</p>
            </div>
          ) : (
            <div className="space-y-2 pt-2">
              {(summary.top_outlets || []).slice(0, 5).map((o, idx) => (
                <div key={o.outlet_id || idx} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground w-4">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{o.outlet_name || o.outlet_id}</div>
                    <div className="text-xs text-muted-foreground">{fmtRp(o.revenue || 0)}</div>
                  </div>
                  <div className="text-right">
                    <div className="h-1.5 w-20 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, ((o.revenue || 0) / (summary.top_outlets[0]?.revenue || 1)) * 100)}%`,
                          background: "hsl(var(--aurora-1))",
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Notifications */}
        <Panel
          title="Notifikasi Terbaru"
          icon={Bell}
          testid="owner-notif-panel"
          action={
            <Link to="/notifications">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                Semua <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          }
        >
          {loading ? (
            <div className="space-y-2 pt-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Tidak ada notifikasi</p>
            </div>
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
