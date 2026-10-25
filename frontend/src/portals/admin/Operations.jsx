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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/shared/PageHeader";

import MetricsView from "./operations/MetricsView";
import LogsView from "./operations/LogsView";
import SchedulerView from "./operations/SchedulerView";
import ArchivalView from "./operations/ArchivalView";
import RateLimitsView from "./operations/RateLimitsView";
import ReportSchedules from "./ReportSchedules";
import DataManagement from "./DataManagement";
import TourAnalytics from "./TourAnalytics";

const SUB_PAGES = [
  { path: "", exact: true, label: "Metrics", tid: "metrics", render: () => <MetricsView /> },
  { path: "logs", label: "Logs", tid: "logs", render: () => <LogsView /> },
  { path: "scheduler", label: "Scheduler", tid: "scheduler", render: () => <SchedulerView /> },
  { path: "archival", label: "Archival", tid: "archival", render: () => <ArchivalView /> },
  { path: "rate-limits", label: "Rate limits", tid: "rate-limits", render: () => <RateLimitsView /> },
  { path: "report-schedules", label: "Report schedules", tid: "laporan-terjadwal", render: () => <ReportSchedules embedded /> },
  { path: "data-management", label: "Data management", tid: "manajemen-data", render: () => <DataManagement embedded /> },
  { path: "tour-analytics", label: "Tour analytics", tid: "tour-analytics", render: () => <TourAnalytics embedded /> },
];

export default function Operations() {
  const location = useLocation();
  const navigate = useNavigate();

  // Match /admin/operations or /admin/operations/xxx
  const match = location.pathname.match(/^\/admin\/operations\/?(.*)$/);
  const subPath = match ? match[1].replace(/\/$/, "") : "";

  const activePage = SUB_PAGES.find(p => (p.exact ? subPath === "" : subPath === p.path));

  // Redirect to default if no match
  if (!activePage) {
    return <Navigate to="/admin/operations" replace />;
  }

  const tabValue = activePage.path || "index";

  return (
    <div data-testid="operations-page">
      <PageHeader
        icon={Activity}
        title="Monitoring"
        subtitle="Metrics, logs, scheduler, archival, rate limit, laporan terjadwal, manajemen data, dan tour analytics."
      />

      <Tabs
        value={tabValue}
        onValueChange={(v) => navigate(v === "index" ? "/admin/operations" : `/admin/operations/${v}`)}
      >
        <TabsList data-testid="operations-tabs">
          {SUB_PAGES.map((page) => (
            <TabsTrigger
              key={page.path || "index"}
              value={page.path || "index"}
              data-testid={`operations-tab-${page.tid}`}
            >
              {page.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Render active component with key to force remount on navigation */}
      <div
        key={tabValue}
        className="mt-3"
        data-testid={`operations-content-${activePage.tid}`}
      >
        {activePage.render()}
      </div>
    </div>
  );
}
