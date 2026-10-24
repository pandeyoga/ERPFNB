/** Static portal config — used by TopNav + RBAC. */
import {
  LayoutDashboard,
  Store,
  ShoppingCart,
  Package,
  Banknote,
  Users as UsersIcon,
  Settings,
  Crown,
  FileSpreadsheet,
} from "lucide-react";

/** Report Center (/reports) — sama dengan _REPORT_READ_PERMS di backend routers/reports.py. */
export const REPORT_CENTER_PERMS = [
  "finance.report.profit_loss",
  "executive.dashboard.read",
  "procurement.vendor.scorecard",
];

export const PORTALS = [
  {
    id: "owner",
    name: "Owner",
    path: "/owner",
    icon: Crown,
    perms: ["owner.cockpit.access"],
  },
  {
    id: "executive",
    name: "Executive",
    path: "/executive",
    icon: LayoutDashboard,
    perms: ["executive.dashboard.read"],
  },
  {
    id: "outlet",
    name: "Outlet",
    path: "/outlet",
    icon: Store,
    perms: ["outlet.daily_sales.read"],
  },
  {
    id: "procurement",
    name: "Procurement",
    path: "/procurement",
    icon: ShoppingCart,
    perms: ["procurement.pr.read"],
  },
  {
    id: "inventory",
    name: "Inventory",
    path: "/inventory",
    icon: Package,
    perms: ["inventory.balance.read"],
  },
  {
    id: "finance",
    name: "Finance",
    path: "/finance",
    icon: Banknote,
    perms: ["finance.ap.read", "finance.sales.validate", "finance.journal_entry.read"],
  },
  {
    // Katalog laporan Excel lintas modul. Sebelumnya tidak ada di navigasi sama sekali
    // (hanya bisa dibuka lewat URL) dan diblokir untuk semua role selain Super Admin.
    id: "reports",
    name: "Report Center",
    path: "/reports",
    icon: FileSpreadsheet,
    perms: REPORT_CENTER_PERMS,
  },
  {
    id: "hr",
    name: "HR",
    path: "/hr",
    icon: UsersIcon,
    perms: ["hr.advance.read"],
  },
  {
    id: "admin",
    name: "Admin",
    path: "/admin",
    icon: Settings,
    perms: [
      "admin.user.read",
      "admin.role.manage",
      "admin.master_data.manage",
      "admin.audit_log.read",
    ],
  },
];

export function visiblePortalsFor(user) {
  if (!user) return [];
  const perms = new Set(user.permissions || []);
  if (perms.has("*")) return PORTALS;
  return PORTALS.filter((p) => p.perms.some((perm) => perms.has(perm)));
}
