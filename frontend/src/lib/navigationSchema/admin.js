/** navigationSchema/admin.js — Admin portal navigation. */

import { LayoutDashboard, Users, Package, Shield, Star, FileText, Sparkles, Activity, Settings } from "lucide-react";

export const adminNav = {
  id: "admin",
  name: "Admin Portal",
  sections: [
    {
      id: "dashboard",
      name: "Overview",
      icon: LayoutDashboard,
      items: [
        { id: "overview", name: "Overview", path: "/admin" },
      ],
    },
    {
      id: "user-management",
      name: "Users & Roles",
      icon: Users,
      reqPerm: "admin.user",
      items: [
        { id: "user-mgmt-hub", name: "Users & Roles", path: "/admin/user-management" },
        // All Users · Roles & Permissions · Activity Log are in-page TABS of
        // /admin/user-management (User Management Hub).
      ],
    },
    {
      id: "master-data",
      name: "Master Data",
      icon: Package,
      reqPerm: "admin.master_data",
      items: [
        { id: "master-data-hub", name: "Master Data", path: "/admin/master-data", matchPaths: ["/admin/master"] },
      ],
    },
    {
      id: "configuration",
      name: "Configuration",
      icon: Shield,
      reqPerm: "admin.business_rules",
      items: [
        { id: "business-rules", name: "Business Rules", path: "/admin/configuration", matchPaths: ["/admin/configuration"] },
        { id: "approval-matrix", name: "Approval Matrix", path: "/admin/approvals" },
        { id: "integrations", name: "Integrations", path: "/admin/integrations", matchPaths: ["/admin/integrations"] },
        { id: "setup", name: "Setup & Numbering", path: "/admin/setup" },
        // Number Series · Tax Config · Bulk Excel Import are in-page TABS of /admin/setup.
      ],
    },
    {
      id: "loyalty-admin",
      name: "Loyalty Program",
      icon: Star,
      items: [
        { id: "loyalty-hub", name: "Loyalty Program", path: "/admin/loyalty", matchPaths: ["/admin/loyalty"] },
        // Overview · Customers · Rewards Catalog · Redemptions · CRM Analytics are
        // in-page TABS of /admin/loyalty (Loyalty Hub).
      ],
    },
    {
      id: "cms",
      name: "CMS Studio",
      icon: FileText,
      reqPerm: "admin.cms",
      items: [
        { id: "cms-studio", name: "CMS Studio", path: "/admin/cms/brands", matchPaths: ["/admin/cms"] },
      ],
    },
    {
      id: "seo",
      name: "Smart SEO",
      icon: Sparkles,
      reqPerm: "admin.cms",
      items: [
        { id: "smart-seo", name: "Smart SEO", path: "/admin/smart-seo", badge: "AI" },
      ],
    },
    {
      id: "operations-monitoring",
      name: "Monitoring",
      icon: Activity,
      reqPerm: "admin.audit_log",
      items: [
        { id: "ops-hub", name: "Monitoring", path: "/admin/operations", matchPaths: ["/admin/operations"] },
        // System Metrics · Logs · Scheduler · Archival · Rate Limits · Laporan Terjadwal
        // · Manajemen Data · Tour Analytics are in-page TABS of /admin/operations.
      ],
    },
    {
      id: "settings",
      name: "System Settings",
      icon: Settings,
      reqPerm: "admin.system_settings",
      items: [
        { id: "general", name: "System Settings", path: "/admin/settings" },
      ],
    },
  ],
};
