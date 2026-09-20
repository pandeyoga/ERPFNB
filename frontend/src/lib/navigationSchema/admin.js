/** navigationSchema/admin.js — Admin portal navigation. */

import {
  LayoutDashboard,
  Users,
  Building2,
  Package,
  Settings,
  FileText,
  ScrollText,
  CreditCard,
  Calculator,
  FileCheck,
  Calendar,
  Banknote,
  Receipt,
  TrendingUp,
  Wallet,
  UserCog,
  DollarSign,
  Gift,
  ClipboardList,
  ShoppingCart,
  Truck,
  Store,
  BarChart3,
  Boxes,
  ArrowLeftRight,
  ClipboardCheck,
  WrenchIcon,
  Crown,
  Sparkles,
  Brain,
  MessageSquare,
  Shield,
  Activity,
  Star,
  AlertTriangle,
  Layers,
  BookOpen,
  Archive,
  Target,
  Workflow,
  Coffee,
  ListChecks,
  History,
  BellRing,
  ChevronRight,
  Landmark,
  LineChart,
  PiggyBank,
  QrCode,
  FileSpreadsheet,
  CalendarCheck,
} from "lucide-react";

// eslint-disable-next-line no-unused-vars
export const adminNav = {
  id: "admin",
  name: "Admin Portal",
  sections: [
    {
      id: "dashboard",
      name: "Dashboard",
      icon: LayoutDashboard,
      items: [
        { id: "overview", name: "Overview", path: "/admin" },
      ],
    },
    {
      id: "user-management",
      name: "User Management",
      icon: Users,
      reqPerm: "admin.user",
      items: [
        { id: "user-mgmt-hub", name: "User Management", path: "/admin/user-management" },
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
        { id: "master-data-hub", name: "Items • Vendors • Outlets • Brands • Employees", path: "/admin/master-data" },
      ],
    },
    {
      id: "configuration",
      name: "Configuration",
      icon: Shield,
      reqPerm: "admin.business_rules",
      items: [
        { id: "business-rules", name: "Business Rules", path: "/admin/configuration" },
        { id: "approval-matrix", name: "Approval Matrix", path: "/admin/approvals", badge: "Builder" },
        { id: "integrations", name: "Integrations", path: "/admin/integrations" },
        { id: "setup", name: "Setup & Numbering", path: "/admin/setup" },
        // Number Series · Tax Config · Bulk Excel Import are in-page TABS of /admin/setup.
      ],
    },
    {
      id: "loyalty-admin",
      name: "Loyalty Program",
      icon: Star,
      items: [
        { id: "loyalty-hub", name: "Loyalty Program", path: "/admin/loyalty" },
        // Overview · Customers · Rewards Catalog · Redemptions · CRM Analytics are
        // in-page TABS of /admin/loyalty (Loyalty Hub).
      ],
    },
    {
      id: "operations-monitoring",
      name: "Operations & Monitoring",
      icon: Activity,
      reqPerm: "admin.audit_log",
      items: [
        { id: "ops-hub", name: "Operations & Monitoring", path: "/admin/operations" },
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
        { id: "general", name: "General", path: "/admin/settings" },
      ],
    },
    {
      id: "cms",
      name: "CMS Studio",
      icon: FileText,
      reqPerm: "admin.cms",
      items: [
        { id: "cms-studio", name: "Brands • News • Menu • Pages • Media", path: "/admin/cms/brands" },
      ],
    },
    {
      id: "seo",
      name: "Smart SEO",
      icon: Sparkles,
      reqPerm: "admin.cms",
      items: [
        { id: "smart-seo", name: "Smart SEO AI", path: "/admin/smart-seo", badge: "AI" },
      ],
    },
  ],
};
