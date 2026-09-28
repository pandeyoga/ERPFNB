/** navigationSchema/procurement.js — Procurement portal navigation. */

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
export const procurementNav = {
  id: "procurement",
  name: "Procurement Portal",
  sections: [
    {
      id: "dashboard",
      name: "Dashboard",
      icon: LayoutDashboard,
      items: [
        { id: "overview", name: "Overview", path: "/procurement" },
        { id: "approval-center-proc", name: "Approval Center", path: "/procurement/approvals" },
      ],
    },
    {
      id: "requests",
      name: "Requests",
      icon: ClipboardList,
      items: [
        { id: "pr", name: "Purchase Requests", path: "/procurement/pr" },
        { id: "consolidation", name: "PR Consolidation", path: "/procurement/consolidation" },
      ],
    },
    {
      id: "purchase-orders",
      name: "Purchase Orders",
      icon: ShoppingCart,
      items: [
        { id: "po", name: "All POs", path: "/procurement/po" },
        { id: "comparison", name: "PO Comparison", path: "/procurement/po-comparison" },
      ],
    },
    {
      id: "goods-receipt",
      name: "Goods Receipt",
      icon: Truck,
      items: [
        { id: "gr", name: "All GRs", path: "/procurement/gr" },
      ],
    },
    {
      id: "vendors",
      name: "Vendors",
      icon: Store,
      items: [
        { id: "vendors", name: "All Vendors", path: "/procurement/vendors" },
        // Vendor Scorecard · Comparison · AI Recommend · Item Catalog are pill-links
        // inside /procurement/vendors (removed from sidebar to dedupe IA).
      ],
    },
    {
      id: "workflow",
      name: "Workflow",
      icon: Workflow,
      items: [
        { id: "kanban", name: "PO Kanban Board", path: "/procurement/kanban" },
        { id: "rfq", name: "RFQ History", path: "/procurement/rfq" },
      ],
    },
    {
      id: "smart-procurement",
      name: "Smart Procurement",
      icon: BarChart3,
      items: [
        { id: "price-intelligence", name: "Price Intelligence", path: "/procurement/price-intelligence" },
        // Vendor Item Catalog · AI Vendor Recommend are pill-links inside
        // /procurement/vendors (removed from sidebar to dedupe IA).
      ],
    },
  ],
};
