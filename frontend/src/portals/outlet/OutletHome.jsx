/** Outlet Home — Today workbench: tasks, sales status, PC balance, urgent etc. */
import { Link } from "react-router-dom";
import {
  Receipt, Wallet, ShoppingBag, ClipboardCheck, ArrowRight,
  CheckCircle2, AlertTriangle, Clock, FileText, Plus,
  ChefHat, Wine, CheckSquare, LayoutDashboard,
} from "lucide-react";
import { useOutletHome } from "@/hooks/useOutletDashboard";
import CompactStatCard from "@/components/shared/CompactStatCard";
import PageHeader from "@/components/shared/PageHeader";
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

  const firstName = user?.full_name?.split(" ")[0] || "";

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="outlet-home-page">
      <PageHeader
        icon={LayoutDashboard}
        title="Overview"
        subtitle={`Halo${firstName ? `, ${firstName}` : ""} — ringkasan operasional ${fmtDate(today)} · ${scopeLabel}`}
        testId="outlet-welcome"
        className="mb-0 md:mb-0"
        actions={
          <>
            {isAggregate && scopeOutletCount > 1 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-800 dark:text-blue-400 font-medium border border-blue-500/20">
                Data digabung
              </span>
            )}
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 font-medium">
              Live
            </span>
          </>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="outlet-kpi-strip">
        <CompactStatCard
          label="Sales Hari Ini"
          value={salesToday ? fmtRp(salesToday.grand_total || 0) : fmtRp(0)}
          sub={
            salesToday
              ? `Status: ${formatStatus(salesToday.status)}${salesToday.is_aggregate ? ` (${salesToday.outlet_count} outlet)` : ""}`
              : "Belum ada draft hari ini"
          }
          icon={Receipt}
          color="aurora-1"
          testId="kpi-sales-hari-ini"
        />
        <CompactStatCard
          label="Saldo Petty Cash"
          value={fmtRp(totalPC)}
          sub={`${Object.keys(pcBalances).length} outlet`}
          icon={Wallet}
          color="aurora-3"
          testId="kpi-saldo-petty-cash"
        />
        <CompactStatCard
          label="Pending PR"
          value={home?.pending_pr_count ?? 0}
          sub="Menunggu approval"
          icon={FileText}
          color="aurora-5"
          testId="kpi-pending-pr"
        />
        <CompactStatCard
          label="Urgent Purchase Open"
          value={home?.open_urgent_purchase_count ?? 0}
          sub="Perlu approval finance"
          icon={ShoppingBag}
          color="aurora-6"
          testId="kpi-urgent-purchase-open"
        />
      </div>

      {/* Outlet Operational Budget mini widget */}
      <OutletBudgetMiniWidget scope="monthly" />

      {/* Today task list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4" data-testid="outlet-today-tasks">
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
              <DataRow label="Jumlah Transaksi" value={salesToday.transaction_count || 0} />
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
          actionLabel={salesYesterday?.id ? "Lihat detail" : "Tidak ada"}
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
      <section data-testid="outlet-quick-actions">
        <h2 className="text-base md:text-lg font-semibold mb-2">Aksi Cepat</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <QuickActionTile to="/outlet/daily-sales/new" icon={Receipt} label="Buat Daily Sales" testId="qa-ds" />
          <QuickActionTile to="/outlet/petty-cash" icon={Wallet} label="Catat Petty Cash" testId="qa-pc" />
          <QuickActionTile to="/outlet/daily-orders?type=kdo" icon={ChefHat} label="Buat KDO" testId="qa-kdo" />
          <QuickActionTile to="/outlet/daily-orders?type=bdo" icon={Wine} label="Buat BDO" testId="qa-bdo" />
          <QuickActionTile to="/outlet/urgent-purchase" icon={ShoppingBag} label="Urgent Purchase" testId="qa-up" />
          <QuickActionTile to="/outlet/end-of-day" icon={CheckSquare} label="End of Day" testId="qa-dc" />
          <QuickActionTile to="/inventory/opname" icon={ClipboardCheck} label="Mulai Opname" testId="qa-opname" />
        </div>
      </section>

      {/* Petty Cash per outlet */}
      {Object.keys(pcBalances).length > 0 && (
        <section className="glass-card p-4" data-testid="outlet-pc-balances">
          <h2 className="text-base md:text-lg font-semibold mb-3">Saldo Petty Cash per Outlet</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(pcBalances).map(([oid, bal]) => {
              const low = bal < 500000;
              return (
                <div key={oid} className="rounded-lg border border-border/60 p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground truncate">{outletNames[oid] || oid}</div>
                    <div className="text-base font-semibold tabular-nums">{fmtRp(bal)}</div>
                  </div>
                  {low ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-400 font-medium flex items-center gap-1 shrink-0">
                      <AlertTriangle className="h-3 w-3" /> Saldo Rendah
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 font-medium flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="h-3 w-3" /> Cukup
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
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
    <div className="glass-card p-4 flex flex-col gap-3" data-testid={testId}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="h-9 w-9 rounded-[calc(var(--radius)-2px)] flex items-center justify-center"
            style={{ background: `hsl(var(--${accent}) / 0.15)`, color: `hsl(var(--${accent}))` }}
          >
            <Icon className="h-4 w-4" />
          </div>
          <h3 className="text-sm md:text-base font-semibold">{title}</h3>
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
      className="glass-card-hover p-3 group flex items-center gap-3"
      data-testid={testId}
    >
      <div className="h-9 w-9 rounded-[calc(var(--radius)-2px)] grad-aurora-soft flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{label}</div>
      </div>
      <Plus className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
    </Link>
  );
}
