import { useLocation, Link, Navigate } from "react-router-dom";
import { Activity, ScrollText as LogIcon, Calendar as CalIcon, Archive as ArchiveIcon, Gauge, CalendarClock, Database, MousePointerClick } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

import MetricsView from "./operations/MetricsView";
import LogsView from "./operations/LogsView";
import SchedulerView from "./operations/SchedulerView";
import ArchivalView from "./operations/ArchivalView";
import RateLimitsView from "./operations/RateLimitsView";
import ReportSchedules from "./ReportSchedules";
import DataManagement from "./DataManagement";
import TourAnalytics from "./TourAnalytics";

const SUB_PAGES = [
  { path: "", exact: true, label: "Metrics", icon: Gauge, render: () => <MetricsView /> },
  { path: "logs", label: "Logs", icon: LogIcon, render: () => <LogsView /> },
  { path: "scheduler", label: "Scheduler", icon: CalIcon, render: () => <SchedulerView /> },
  { path: "archival", label: "Archival", icon: ArchiveIcon, render: () => <ArchivalView /> },
  { path: "rate-limits", label: "Rate Limits", icon: Activity, render: () => <RateLimitsView /> },
  { path: "report-schedules", label: "Laporan Terjadwal", icon: CalendarClock, render: () => <ReportSchedules /> },
  { path: "data-management", label: "Manajemen Data", icon: Database, render: () => <DataManagement /> },
  { path: "tour-analytics", label: "Tour Analytics", icon: MousePointerClick, render: () => <TourAnalytics /> },
];

export default function Operations() {
  const location = useLocation();
  
  // Match /admin/operations or /admin/operations/xxx
  const match = location.pathname.match(/^\/admin\/operations\/?(.*)$/);
  const subPath = match ? match[1] : "";
  
  // Find active page
  const activePage = SUB_PAGES.find(p => {
    if (p.exact) return subPath === "";
    return subPath === p.path;
  });

  // Redirect to default if no match
  if (!activePage) {
    return <Navigate to="/admin/operations" replace />;
  }

  return (
    <div className="space-y-5" data-testid="operations-page">
      {/* SubNav Tabs */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 pt-4 pb-0 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl grad-aurora-soft flex items-center justify-center">
            <Gauge className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold leading-tight">Operations & Monitoring</h2>
            <p className="text-[11px] text-muted-foreground">
              System metrics, logs, scheduler, dan archival management
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 px-3 pt-3 -mb-px overflow-x-auto border-b border-border/40" role="tablist">
          {SUB_PAGES.map((page) => {
            const isActive = activePage.path === page.path;
            const Icon = page.icon;
            const targetPath = page.exact ? "/admin/operations" : `/admin/operations/${page.path}`;
            
            return (
              <Link
                key={page.path || "index"}
                to={targetPath}
                role="tab"
                aria-selected={isActive}
                className={cn(
                  "relative inline-flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                data-testid={`operations-tab-${page.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{page.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="operations-tab-underline"
                    className="absolute inset-x-0 -bottom-px h-0.5 bg-foreground"
                    transition={{ type: "spring", duration: 0.4 }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Render active component with key to force remount on navigation */}
      <div 
        key={activePage.path || "index"}
        data-testid={`operations-content-${activePage.label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        {activePage.render()}
      </div>
    </div>
  );
}
