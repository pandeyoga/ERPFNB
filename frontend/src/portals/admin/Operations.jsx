/** Operations — hub "Monitoring" (nav Admin › Monitoring).
 *
 * UI pass: PageHeader (satu-satunya <h1>, judul = nama nav "Monitoring") + Tabs terpadu
 * yang di-route per sub-path (/admin/operations/<tab>). Sub-halaman yang juga punya
 * route mandiri (ReportSchedules, DataManagement, TourAnalytics) dirender dengan
 * `embedded` agar tidak menampilkan judul halaman kedua.
 * data-testid lama (operations-tab-<label lama>, operations-content-<label lama>) dipertahankan.
 */
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { Activity } from "lucide-react";
import HubTabs, { groupTabs } from "@/components/shared/HubTabs";
import { useAuth } from "@/lib/auth";
import { permitted } from "@/lib/portalGate";
import PageHeader, { HubHeaderProvider } from "@/components/shared/PageHeader";

import MetricsView from "./operations/MetricsView";
import LogsView from "./operations/LogsView";
import SchedulerView from "./operations/SchedulerView";
import ArchivalView from "./operations/ArchivalView";
import RateLimitsView from "./operations/RateLimitsView";
import ReportSchedules from "./ReportSchedules";
import DataManagement from "./DataManagement";
import TourAnalytics from "./TourAnalytics";

// `perm` = izin API tab itu (routers/admin_ops.py dst.); "*" = khusus Super Admin. Tab tanpa izin tidak tampil.
const SUB_PAGES = [
  { path: "", exact: true, label: "Metrics", tid: "metrics", perm: "system.metrics.read", render: () => <MetricsView /> },
  { path: "logs", label: "Logs", tid: "logs", perm: "system.logs.read", render: () => <LogsView /> },
  { path: "scheduler", label: "Scheduler", tid: "scheduler", perm: "system.scheduler.manage", render: () => <SchedulerView /> },
  { path: "archival", label: "Archival", tid: "archival", perm: "system.archival.manage", render: () => <ArchivalView /> },
  { path: "rate-limits", label: "Rate limits", tid: "rate-limits", perm: "system.metrics.read", render: () => <RateLimitsView /> },
  { path: "report-schedules", label: "Report schedules", tid: "laporan-terjadwal", perm: "report_schedules.manage", render: () => <ReportSchedules embedded /> },
  { path: "data-management", label: "Data management", tid: "manajemen-data", perm: "*", render: () => <DataManagement embedded /> },
  { path: "tour-analytics", label: "Tour analytics", tid: "tour-analytics", perm: ["admin.audit_log.read", "admin.settings"], render: () => <TourAnalytics embedded /> },
];

const GROUPS = [
  { id: "monitor", label: "Pemantauan", ids: ["index", "logs", "rate-limits"] },
  { id: "jobs", label: "Jadwal & job", ids: ["scheduler", "report-schedules", "archival"] },
  { id: "data", label: "Data management", ids: ["data-management"] },
  { id: "tour", label: "Tour analytics", ids: ["tour-analytics"] },
];

export default function Operations() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Match /admin/operations or /admin/operations/xxx
  const match = location.pathname.match(/^\/admin\/operations\/?(.*)$/);
  const subPath = match ? match[1].replace(/\/$/, "") : "";

  const pages = SUB_PAGES.filter((p) => permitted(user, p.perm));
  const activePage = pages.find(p => (p.exact ? subPath === "" : subPath === p.path));

  // Tidak ada tab yang diizinkan → /no-access; tab tidak cocok/tidak diizinkan → tab pertama yang diizinkan
  if (!pages.length) return <Navigate to="/no-access" replace />;
  if (!activePage) {
    const first = pages[0].path;
    return <Navigate to={first ? `/admin/operations/${first}` : "/admin/operations"} replace />;
  }

  const tabValue = activePage.path || "index";

  return (
    <HubHeaderProvider>
      <div data-testid="operations-page">
        <PageHeader hub
          icon={Activity}
          title="Monitoring"
          subtitle="Metrics, logs, scheduler, archival, rate limit, laporan terjadwal, manajemen data, dan tour analytics."
        />

        {/* 8 halaman → 4 kelompok + sub-tab (DESIGN_SYSTEM §10.8) */}
        <HubTabs
          groups={groupTabs(pages.map((pg) => ({ id: pg.path || "index", label: pg.label })), GROUPS)}
          value={tabValue}
          onChange={(v) => navigate(v === "index" ? "/admin/operations" : `/admin/operations/${v}`)}
          testId="operations-tabs"
          itemTestId={(id) => `operations-tab-${SUB_PAGES.find((pg) => (pg.path || "index") === id)?.tid || id}`}
          groupTestId={(id) => `operations-group-${id}`}
        />

        {/* Render active component with key to force remount on navigation */}
        <div
          key={tabValue}
          className="mt-3"
          data-testid={`operations-content-${activePage.tid}`}
        >
          {activePage.render()}
        </div>
      </div>
    </HubHeaderProvider>
  );
}
