/**
 * UserManagementHub — Unified User Management workspace (IA consolidation, plan.md Phase 1c).
 * All Users + Roles & Permissions + Activity Log in one tabbed page.
 * URL param: ?tab=users (default).
 *
 * Judul halaman (satu <h1>) = nama menu "Users & Roles"; halaman anak dirender
 * dengan `embedded` sehingga tidak menampilkan judul besar kedua.
 */
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Users as UsersIcon, Shield, ScrollText } from "lucide-react";
import PageHeader, { HubHeaderProvider } from "@/components/shared/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import Users from "./Users";
import Roles from "./Roles";
import AuditLog from "./AuditLog";
import { useVisibleTabs } from "@/lib/portalGate";

// perm = izin route lama tab tersebut (route lama kini redirect ke tab ini)
const TABS = [
  { id: "users",     label: "Users",           icon: UsersIcon,  component: Users, perm: "admin.user" },
  { id: "roles",     label: "Roles & permissions", icon: Shield,     component: Roles, perm: "admin.user" },
  { id: "audit-log", label: "Activity log",        icon: ScrollText, component: AuditLog, perm: "admin.audit_log" },
];

export default function UserManagementHub() {
  const tabs = useVisibleTabs(TABS);
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

  const current = tabs.some((t) => t.id === activeTab) ? activeTab : tabs[0].id;

  return (
    <HubHeaderProvider>
      <div data-testid="admin-user-management-hub">
        <PageHeader hub
          icon={UsersIcon}
          title="Users & Roles"
          subtitle="Kelola akun user, role & permission, serta jejak aktivitas sistem."
        />

        <Tabs value={current} onValueChange={handleTabChange}>
          <TabsList data-testid="user-mgmt-hub-tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.id} value={tab.id} data-testid={`user-mgmt-tab-${tab.id}`}>
                  <Icon /> {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {tabs.map((tab) => {
            const Comp = tab.component;
            return (
              <TabsContent key={tab.id} value={tab.id} data-testid="user-mgmt-hub-content">
                <Comp embedded />
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </HubHeaderProvider>
  );
}
