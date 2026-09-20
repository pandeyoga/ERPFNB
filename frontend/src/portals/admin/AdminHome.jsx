import {
  Users as UsersIcon, Shield, Database, ScrollText,
  ArrowRight, Activity, Plug, BarChart3, FileSpreadsheet,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAdminHome } from "@/hooks/useAdminDashboard";
import KpiCard from "@/components/shared/KpiCard";
import { fmtNumber } from "@/lib/format";
import { useAuth } from "@/lib/auth";

const MASTER_TILES = [
  { entity: "items",            label: "Items",           col: "items" },
  { entity: "vendors",          label: "Vendors",         col: "vendors" },
  { entity: "employees",        label: "Employees",       col: "employees" },
  { entity: "chart-of-accounts", label: "GL Accounts",   col: "chart_of_accounts" },
  { entity: "brands",           label: "Brands",          col: "brands" },
  { entity: "outlets",          label: "Outlets",         col: "outlets" },
  { entity: "categories",       label: "Categories",      col: "categories" },
  { entity: "payment-methods",  label: "Payment Methods", col: "payment_methods" },
];

export default function AdminHome() {
  const { user } = useAuth();

  const perms = user?.permissions || [];
  const isFullAdmin = perms.includes("*");
  const canViewUsers = isFullAdmin || perms.some(p =>
    p.startsWith("admin.users") || p.startsWith("admin.audit_log") || p.startsWith("admin.roles")
  );
  const canBulkImport = isFullAdmin || perms.includes("admin.master_data.write");

  const { data: stats = {}, isLoading: loading } = useAdminHome(canViewUsers);

  return (
    <div className="space-y-6" data-testid="admin-home-page">
      {/* Welcome */}
      <div className="glass-card p-6 lg:p-8" data-testid="admin-welcome">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold mb-1">Halo, {user?.full_name?.split(" ")[0]} 👋</h2>
            <p className="text-sm text-muted-foreground">
              Sistem FnB Group ERP siap melayani. Sprint D aktif — Bulk Import & Tax Settlement.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-medium">
              • Online
            </span>
            <span>v0.3.0</span>
          </div>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="admin-kpi-strip">
        {canViewUsers && (
          <KpiCard label="Users"     value={loading ? "…" : fmtNumber(stats.users || 0)}
                    hint="Active users" icon={UsersIcon} color="aurora-1" />
        )}
        {canViewUsers && (
          <KpiCard label="Roles"     value={loading ? "…" : fmtNumber(stats.roles || 0)}
                    hint="System & custom" icon={Shield} color="aurora-2" />
        )}
        {canViewUsers && (
          <KpiCard label="Audit Log" value={loading ? "…" : fmtNumber(stats.audit || 0)}
                    hint="Recorded events" icon={ScrollText} color="aurora-3" />
        )}
        <KpiCard label="Master Records" value={loading ? "…" : fmtNumber(
            MASTER_TILES.reduce((sum, t) => sum + (stats[t.entity] || 0), 0)
          )} hint="All masters" icon={Database} color="aurora-4" />
      </div>

      {/* Bulk Import Feature Card */}
      {canBulkImport && (
        <div data-testid="admin-bulk-import-section">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Import & Data
          </h3>
          <Link
            to="/admin/bulk-import"
            className="glass-card-hover p-5 flex items-center justify-between group block"
            data-testid="tile-bulk-import"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500/15 to-cyan-500/15 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Bulk Excel Import</span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-400 text-xs font-medium">New</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Items · Vendors · Employees · COA · Customers — template + preview + upsert
                </div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      )}

      {/* Master tiles */}
      <div data-testid="admin-master-tiles">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Master Data
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {MASTER_TILES.map((t) => (
            <Link
              key={t.entity}
              to={`/admin/master/${t.entity}`}
              className="glass-card-hover p-4 group"
              data-testid={`tile-${t.entity}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">{t.label}</div>
                  <div className="text-2xl font-bold mt-1 tabular-nums">
                    {loading ? "…" : fmtNumber(stats[t.entity] || 0)}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Operations link */}
      {(user?.permissions?.includes("*") || user?.permissions?.includes("system.metrics.read")) && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            System Operations
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Link
              to="/admin/operations"
              className="glass-card-hover p-5 flex items-center justify-between group"
              data-testid="tile-operations"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl grad-aurora-soft flex items-center justify-center">
                  <Activity className="h-6 w-6 text-foreground" />
                </div>
                <div>
                  <div className="font-semibold">Operations Console</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Metrics · Logs · Scheduler · Archival · Rate Limits
                  </div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </Link>
            {(user?.permissions?.includes("*") || user?.permissions?.includes("system.settings.read")) && (
              <Link
                to="/admin/integrations"
                className="glass-card-hover p-5 flex items-center justify-between group"
                data-testid="tile-integrations"
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl grad-aurora flex items-center justify-center text-white">
                    <Plug className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="font-semibold">Integrations Hub</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Telegram · WhatsApp · Email · AI / LLM · Branding
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </Link>
            )}
            <Link
              to="/admin/tour-analytics"
              className="glass-card-hover p-5 flex items-center justify-between group"
              data-testid="tile-tour-analytics"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500/15 to-pink-500/15 flex items-center justify-center text-purple-600 dark:text-purple-300">
                  <BarChart3 className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-semibold">Tour Analytics</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Lacak penggunaan & efektivitas Help & Tour
                  </div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
