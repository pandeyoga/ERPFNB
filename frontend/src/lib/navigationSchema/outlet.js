/** navigationSchema/outlet.js — Outlet portal navigation. */

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
export const outletNav = {
  id: "outlet",
  name: "Outlet Portal",
  sections: [
    {
      id: "crm-hub",
      name: "CRM & Reservasi",
      icon: Sparkles,
      items: [
        { id: "crm-hub", name: "CRM & Reservasi Hub", path: "/outlet/crm" },
      ],
    },
    {
      id: "dashboard",
      name: "Dashboard",
      icon: LayoutDashboard,
      items: [
        { id: "overview", name: "Today's Summary", path: "/outlet" },
        { id: "approval-center-outlet", name: "Approval Center", path: "/outlet/approvals" },
      ],
    },
    {
      id: "daily-ops",
      name: "Daily Operations",
      icon: Receipt,
      items: [
        { id: "daily-sales", name: "Daily Sales", path: "/outlet/daily-sales" },
        { id: "urgent-purchase", name: "Urgent Purchase", path: "/outlet/urgent-purchase" },
        { id: "petty-cash", name: "Petty Cash", path: "/outlet/petty-cash" },
        { id: "budget-tracker", name: "Budget Saya", path: "/outlet/budget" },
      ],
    },
    // REMOVED: Cash Management section (single-item) - merged into Daily Operations
    // REMOVED: Budget Outlet section (single-item) - merged into Daily Operations
    {
      id: "kitchen",
      name: "Daily Orders",
      icon: ScrollText,
      items: [
        { id: "daily-orders", name: "Kitchen / Bar / Floor", path: "/outlet/daily-orders" },
      ],
    },
    {
      id: "closing",
      name: "End of Day",
      icon: History,
      items: [
        { id: "end-of-day", name: "Tutup Hari Workflow", path: "/outlet/end-of-day" },
        // REMOVED: Daily Close (Manual) - deprecated, use workflow above
      ],
    },
    // REMOVED: Loyalty section (duplikat dengan CRM & Reservasi)
    // REMOVED: Reservasi section (duplikat dengan CRM & Reservasi)
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
