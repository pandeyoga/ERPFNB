/** Outlet Home — Today workbench: tasks, sales status, PC balance, urgent etc. */
import { Link } from "react-router-dom";
import {
  Receipt, Wallet, ShoppingBag, ClipboardCheck, ArrowRight,
  CheckCircle2, AlertTriangle, Clock, FileText, Plus,
  ChefHat, Wine, CheckSquare, Store, Globe2,
} from "lucide-react";
import { useOutletHome } from "@/hooks/useOutletDashboard";
import KpiCard from "@/components/shared/KpiCard";
import StatusPill from "@/components/shared/StatusPill";
import OutletBudgetMiniWidget from "./OutletBudgetMiniWidget";
import { fmtRp, fmtDate, todayJakartaISO } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { useOutletScopeCtx } from "./OutletScopeContext";

export default function OutletHome() {
  const { user } = useAuth();
  const {
    outletId,
    currentOutlet,
    scopedOutlets,
    allOutlets,
    isFullAccess,
    loaded: scopeLoaded,
  } = useOutletScopeCtx();

  const { data: home, isLoading: loading } = useOutletHome(outletId, scopeLoaded);

  if (loading || !scopeLoaded) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-32 rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const today = home?.today || todayJakartaISO();
  const salesToday = home?.sales_today; // object | null
  const salesYesterday = home?.sales_yesterday; // object | null
  const pcBalances = home?.petty_cash_balance || {};
  const totalPC = Object.values(pcBalances).reduce((s, v) => s + (v || 0), 0);
  const outletNames = Object.fromEntries(allOutlets.map(o => [o.id, o.name]));

  // Build a precise welcome subtitle reflecting the active scope
  const scope = home?.scope || {};
  const scopeOutletCount = scope?.outlet_ids?.length || scopedOutlets.length;
  const isAggregate = !!scope?.is_aggregate;
  const scopeLabel = currentOutlet
    ? currentOutlet.name +
      (currentOutlet.brand_name ? ` · ${currentOutlet.brand_name}` : "")
    : isFullAccess
      ? `Semua Outlet (${scopedOutlets.length})`
      : scopeOutletCount > 1
        ? `Semua ${scopeOutletCount} outlet dalam scope Anda`
        : "Tidak ada outlet";

  return (
    <div className="space-y-6" data-testid="outlet-home-page">
      {/* Welcome */}
      <div className="glass-card p-6 lg:p-8" data-testid="outlet-welcome">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h2 className="text-xl font-bold mb-1">
              Halo, {user?.full_name?.split(" ")[0]} — selamat datang di outlet hari ini.
            </h2>
            <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
              <span>Hari ini: <span className="font-medium">{fmtDate(today)}</span></span>
              <span className="text-muted-foreground/50">·</span>
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                {currentOutlet ? <Store className="h-3.5 w-3.5" /> : <Globe2 className="h-3.5 w-3.5" />}
                {scopeLabel}
              </span>
              {isAggregate && scopeOutletCount > 1 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium border border-blue-500/20">
                  Data digabung
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-medium">
              • Live
            </span>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="outlet-kpi-strip">
        <KpiCard
          label="Sales Hari Ini"
          value={salesToday ? fmtRp(salesToday.grand_total || 0) : fmtRp(0)}
          hint={
            salesToday
              ? `Status: ${formatStatus(salesToday.status)}${salesToday.is_aggregate ? ` (${salesToday.outlet_count} outlet)` : ""}`
              : "Belum ada draft hari ini"
          }
          icon={Receipt}
          color="aurora-1"
        />
        <KpiCard
          label="Saldo Petty Cash"
          value={fmtRp(totalPC)}
          hint={`${Object.keys(pcBalances).length} outlet`}
          icon={Wallet}
          color="aurora-3"
        />
        <KpiCard
          label="Pending PR"
          value={home?.pending_pr_count ?? 0}
          hint="Menunggu approval"
          icon={FileText}
          color="aurora-5"
        />
        <KpiCard
          label="Urgent Purchase Open"
          value={home?.open_urgent_purchase_count ?? 0}
          hint="Perlu approval finance"
          icon={ShoppingBag}
          color="aurora-6"
        />
      </div>

      {/* Outlet Operational Budget mini widget */}
      <OutletBudgetMiniWidget scope="monthly" />

      {/* Today task list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="outlet-today-tasks">
        <TodayTaskCard
          icon={Receipt}
          title="Daily Sales Hari Ini"
          status={salesToday?.status}
          accent="aurora-1"
          actionLabel={salesToday?.id ? "Lanjutkan / Lihat" : "Buat Draft"}
          actionTo={salesToday?.id ? `/outlet/daily-sales/${salesToday.id}` : `/outlet/daily-sales/new`}
          testId="task-daily-sales"
        >
          {salesToday ? (
            <>
              <DataRow
                label="Outlet"
                value={
                  salesToday.is_aggregate
                    ? `Gabungan ${salesToday.outlet_count} outlet`
                    : outletNames[salesToday.outlet_id] || salesToday.outlet_id || "—"
                }
              />
              <DataRow label="Grand Total" value={fmtRp(salesToday.grand_total || 0)} />
              <DataRow label="Trx Count" value={salesToday.transaction_count || 0} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Belum ada draft daily sales untuk hari ini. Buat draft sekarang agar finance bisa validasi.
            </p>
          )}
        </TodayTaskCard>

        <TodayTaskCard
          icon={Clock}
          title="Daily Sales Kemarin"
          status={salesYesterday?.status}
          accent="aurora-2"
          actionLabel={salesYesterday?.id ? "Lihat" : "Tidak ada"}
          actionTo={salesYesterday?.id ? `/outlet/daily-sales/${salesYesterday.id}` : null}
          testId="task-daily-sales-yesterday"
        >
          {salesYesterday ? (
            <>
              <DataRow
                label="Outlet"
                value={
                  salesYesterday.is_aggregate
                    ? `Gabungan ${salesYesterday.outlet_count} outlet`
                    : outletNames[salesYesterday.outlet_id] || salesYesterday.outlet_id || "—"
                }
              />
              <DataRow label="Grand Total" value={fmtRp(salesYesterday.grand_total || 0)} />
              <DataRow label="Status" value={<StatusPill status={salesYesterday.status} />} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Tidak ada daily sales tercatat untuk kemarin. Pastikan submit dilakukan tepat waktu.
            </p>
          )}
        </TodayTaskCard>
      </div>

      {/* Quick actions */}
      <div data-testid="outlet-quick-actions">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <QuickActionTile to="/outlet/daily-sales/new" icon={Receipt} label="Daily Sales Baru" testId="qa-ds" />
          <QuickActionTile to="/outlet/petty-cash" icon={Wallet} label="Catat Petty Cash" testId="qa-pc" />
          <QuickActionTile to="/outlet/kdo" icon={ChefHat} label="KDO Baru" testId="qa-kdo" />
          <QuickActionTile to="/outlet/bdo" icon={Wine} label="BDO Baru" testId="qa-bdo" />
          <QuickActionTile to="/outlet/urgent-purchase" icon={ShoppingBag} label="Urgent Purchase" testId="qa-up" />
          <QuickActionTile to="/outlet/daily-close" icon={CheckSquare} label="Daily Close" testId="qa-dc" />
          <QuickActionTile to="/inventory/opname" icon={ClipboardCheck} label="Mulai Opname" testId="qa-opname" />
        </div>
      </div>

      {/* Petty Cash per outlet */}
      {Object.keys(pcBalances).length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Saldo Petty Cash per Outlet
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(pcBalances).map(([oid, bal]) => {
              const low = bal < 500000;
              return (
                <div key={oid} className="glass-input rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">{outletNames[oid] || oid}</div>
                    <div className="text-lg font-bold tabular-nums">{fmtRp(bal)}</div>
                  </div>
                  {low ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Saldo Rendah
                    </span>
                  ) : (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Cukup
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function formatStatus(s) {
  if (!s) return "—";
  const map = {
    draft: "Draft",
    pending_validation: "Menunggu Validasi",
    validated: "Tervalidasi",
    rejected: "Ditolak",
  };
  return map[s] || s;
}

function TodayTaskCard({ icon: Icon, title, status, accent, actionLabel, actionTo, children, testId }) {
  return (
    <div className="glass-card p-5 flex flex-col gap-3" data-testid={testId}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center"
            style={{ background: `hsl(var(--${accent}) / 0.15)`, color: `hsl(var(--${accent}))` }}
          >
            <Icon className="h-4 w-4" />
          </div>
          <h4 className="font-semibold">{title}</h4>
        </div>
        {status && <StatusPill status={status} />}
      </div>
      <div className="text-sm space-y-1.5">{children}</div>
      {actionTo ? (
        <Link
          to={actionTo}
          className="text-sm text-foreground/80 hover:text-foreground inline-flex items-center gap-1 mt-1 font-medium"
        >
          {actionLabel} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      ) : (
        <span className="text-xs text-muted-foreground">{actionLabel}</span>
      )}
    </div>
  );
}

function DataRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function QuickActionTile({ to, icon: Icon, label, testId }) {
  return (
    <Link
      to={to}
      className="glass-card-hover p-4 group flex items-center gap-3"
      data-testid={testId}
    >
      <div className="h-10 w-10 rounded-xl grad-aurora-soft flex items-center justify-center">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{label}</div>
      </div>
      <Plus className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
    </Link>
  );
}
