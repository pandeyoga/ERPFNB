/** navigationSchema/outlet.js — Outlet portal navigation. */

import { LayoutDashboard, Receipt, History, PiggyBank, Sparkles, Boxes } from "lucide-react";

export const outletNav = {
  id: "outlet",
  name: "Outlet Portal",
  // Urutan mengikuti alur kerja harian outlet (design_guidelines → navigation_and_ia):
  // ringkasan → operasi harian → tutup hari → budget → CRM → inventori.
  sections: [
    {
      id: "dashboard",
      name: "Overview",
      icon: LayoutDashboard,
      items: [
        { id: "overview", name: "Overview", path: "/outlet" },
      ],
    },
    {
      id: "daily-ops",
      name: "Daily Operations",
      icon: Receipt,
      items: [
        { id: "daily-sales", name: "Daily Sales", path: "/outlet/daily-sales" },
        { id: "daily-orders", name: "Daily Orders", path: "/outlet/daily-orders" },
        { id: "petty-cash", name: "Petty Cash", path: "/outlet/petty-cash" },
        { id: "urgent-purchase", name: "Urgent Purchase", path: "/outlet/urgent-purchase" },
      ],
    },
    {
      id: "closing",
      name: "End of Day",
      icon: History,
      items: [
        { id: "end-of-day", name: "End of Day", path: "/outlet/end-of-day", matchPaths: ["/outlet/daily-close"] },
      ],
    },
    {
      id: "budget",
      name: "Outlet Budget",
      icon: PiggyBank,
      items: [
        { id: "budget-tracker", name: "Outlet Budget", path: "/outlet/budget" },
      ],
    },
    {
      id: "crm-hub",
      name: "CRM & Reservations",
      icon: Sparkles,
      items: [
        { id: "crm-hub", name: "CRM & Reservations", path: "/outlet/crm", matchPaths: ["/outlet/reservations", "/outlet/voucher-redeem", "/outlet/loyalty"] },
      ],
    },
    {
      id: "inventory",
      name: "Outlet Inventory",
      icon: Boxes,
      items: [
        { id: "stock-check", name: "Stock Check", path: "/outlet/inventory/stock-check" },
        { id: "transfers", name: "Stock Transfers", path: "/outlet/inventory/transfers" },
        { id: "usage", name: "Usage Log", path: "/outlet/inventory/usage" },
      ],
    },
  ],
};
