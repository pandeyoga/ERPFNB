/**
 * UserManagementHub — Unified User Management workspace (IA consolidation, plan.md Phase 1c).
 * All Users + Roles & Permissions + Activity Log in one tabbed page.
 * URL param: ?tab=users (default).
 */
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Users as UsersIcon, Shield, ScrollText, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

import Users from "./Users";
import Roles from "./Roles";
import AuditLog from "./AuditLog";

const TABS = [
  { id: "users",     label: "All Users",            short: "Users", icon: UsersIcon,  component: Users },
  { id: "roles",     label: "Roles & Permissions",  short: "Roles", icon: Shield,     component: Roles },
  { id: "audit-log", label: "Activity Log",         short: "Log",   icon: ScrollText, component: AuditLog },
];

export default function UserManagementHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "users");

  useEffect(() => {
    const p = searchParams.get("tab");
    if (p && p !== activeTab) setActiveTab(p);
  }, [searchParams]); // eslint-disable-line

  function handleTabChange(id) {
    setActiveTab(id);
    setSearchParams({ tab: id }, { replace: true });
  }

  const ActiveComponent = TABS.find(t => t.id === activeTab)?.component || TABS[0].component;

  return (
    <div className="space-y-0" data-testid="admin-user-management-hub">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-xl font-bold">User Management</h2>
        <div className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
          <span className="text-muted-foreground/60">User Management</span>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium">{TABS.find(t => t.id === activeTab)?.label}</span>
        </div>
      </div>

      <div
        className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-border/50 mb-5"
        data-testid="user-mgmt-hub-tabs"
        role="tablist"
      >
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              data-testid={`user-mgmt-tab-${tab.id}`}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-all whitespace-nowrap",
                active
                  ? "border-aurora text-aurora bg-aurora/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-foreground/5",
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.short}</span>
            </button>
          );
        })}
      </div>

      <div data-testid="user-mgmt-hub-content" role="tabpanel">
        <ActiveComponent />
      </div>
    </div>
  );
}
