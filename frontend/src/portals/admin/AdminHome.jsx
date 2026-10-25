import {
  Users as UsersIcon, Shield, Database, ScrollText, Settings as SettingsIcon,
  ArrowRight, Activity, Plug, BarChart3, FileSpreadsheet,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAdminHome, MASTER_TILES } from "@/hooks/useAdminDashboard";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import { fmtNumber } from "@/lib/format";
import { useAuth } from "@/lib/auth";

/** Satu gaya kartu tautan (ikon 36px, judul 14px, deskripsi 12px) untuk semua shortcut di halaman ini. */
function LinkTile({ to, icon: Icon, iconClass, title, badge, desc, testId }) {
  return (
    <Link
      to={to}
      className="glass-card-hover p-3 flex items-center justify-between gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      data-testid={testId}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`h-9 w-9 shrink-0 rounded-[calc(var(--radius)-2px)] flex items-center justify-center ${iconClass}`}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate">{title}</span>
            {badge}
          </div>
          <div className="text-xs text-muted-foreground truncate">{desc}</div>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
    </Link>
  );
}

export default function AdminHome() {
  const { user } = useAuth();

  const perms = user?.permissions || [];
  const isFullAdmin = perms.includes("*");
  const canViewUsers = isFullAdmin || perms.some(p =>
    p.startsWith("admin.user.") || p.startsWith("admin.audit_log") || p.startsWith("admin.role.")
  );
  const canBulkImport = isFullAdmin || perms.includes("admin.master_data.write");
  const canSeeOps = isFullAdmin || perms.includes("system.metrics.read");
  const canSeeIntegrations = isFullAdmin || perms.includes("system.settings.read");

  const { data: stats = {}, isLoading: loading } = useAdminHome(canViewUsers);
  const firstName = user?.full_name?.split(" ")[0];

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="admin-home-page">
      {/* Header — satu-satunya <h1>; status sistem dipindah dari kartu sambutan ke slot aksi */}
      <div data-testid="admin-welcome">
        <PageHeader
          icon={SettingsIcon}
          title="Admin Overview"
          subtitle={`Halo${firstName ? `, ${firstName}` : ""} — kelola users, roles, master data, dan konfigurasi sistem.`}
          actions={(
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-medium">
                Online
              </span>
              <span>v0.3.0</span>
            </div>
          )}
        />
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="admin-kpi-strip">
        {canViewUsers && (
          <CompactStatCard label="Users" value={fmtNumber(stats.users || 0)} loading={loading}
            sub="User aktif" icon={UsersIcon} color="aurora-1" testId="kpi-users" />
        )}
        {canViewUsers && (
          <CompactStatCard label="Roles" value={fmtNumber(stats.roles || 0)} loading={loading}
            sub="System & custom" icon={Shield} color="aurora-2" testId="kpi-roles" />
        )}
        {canViewUsers && (
          <CompactStatCard label="Audit Log" value={fmtNumber(stats.audit || 0)} loading={loading}
            sub="Event tercatat" icon={ScrollText} color="aurora-3" testId="kpi-audit-log" />
        )}
        <CompactStatCard label="Master Records" loading={loading}
          value={fmtNumber(MASTER_TILES.reduce((sum, t) => sum + (stats[t.entity] || 0), 0))}
          sub="Semua master data" icon={Database} color="aurora-4" testId="kpi-master-records" />
      </div>

      {/* Master tiles */}
      <section className="space-y-2" data-testid="admin-master-tiles">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base md:text-lg font-semibold">Master Data</h2>
          <Link to="/admin/master/items" className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline" data-testid="admin-master-see-all">
            Lihat semua
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {MASTER_TILES.map((t) => (
            <Link
              key={t.entity}
              to={`/admin/master/${t.entity}`}
              className="block rounded-[var(--radius)] transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid={`tile-${t.entity}`}
            >
              <CompactStatCard
                label={t.label}
                value={fmtNumber(stats[t.entity] || 0)}
                loading={loading}
                icon={ArrowRight}
                color="aurora-1"
                size="sm"
                testId={`tile-${t.entity}-stat`}
              />
            </Link>
          ))}
        </div>
      </section>

      {/* Shortcuts: import + operasi sistem dalam satu grid kartu tautan yang seragam */}
      {(canBulkImport || canSeeOps) && (
        <section className="space-y-2">
          <h2 className="text-base md:text-lg font-semibold">Import & System Operations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {canBulkImport && (
              <div data-testid="admin-bulk-import-section">
                <LinkTile
                  to="/admin/setup?tab=bulk-import"
                  icon={FileSpreadsheet}
                  iconClass="bg-blue-500/15 text-blue-600 dark:text-blue-400"
                  title="Bulk Excel Import"
                  badge={<span className="px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-400 text-[11px] font-medium">Baru</span>}
                  desc="Items · Vendors · Employees · COA · Customers — template, pratinjau, upsert"
                  testId="tile-bulk-import"
                />
              </div>
            )}
            {canSeeOps && (
              <LinkTile
                to="/admin/operations"
                icon={Activity}
                iconClass="grad-aurora-soft text-foreground"
                title="Operations Console"
                desc="Metrics · Logs · Scheduler · Archival · Rate Limits"
                testId="tile-operations"
              />
            )}
            {canSeeOps && canSeeIntegrations && (
              <LinkTile
                to="/admin/integrations"
                icon={Plug}
                iconClass="grad-aurora text-white"
                title="Integrations"
                desc="Telegram · WhatsApp · Email · AI / LLM · Branding"
                testId="tile-integrations"
              />
            )}
            {canSeeOps && (
              <LinkTile
                to="/admin/operations/tour-analytics"
                icon={BarChart3}
                iconClass="bg-purple-500/15 text-purple-600 dark:text-purple-300"
                title="Tour Analytics"
                desc="Lacak penggunaan & efektivitas Help & Tour"
                testId="tile-tour-analytics"
              />
            )}
          </div>
        </section>
      )}
    </div>
  );
}
