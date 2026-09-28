/** navigationSchema/finance.js — Finance portal navigation. */

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
export const financeNav = {
  id: "finance",
  name: "Finance Portal",
  sections: [
    {
      id: "overview",
      name: "Overview",
      icon: LayoutDashboard,
      items: [
        { id: "dashboard", name: "Dashboard", path: "/finance" },
        { id: "approval-center-finance", name: "Approval Center", path: "/finance/approvals" },
      ],
    },
    {
      id: "transactions",
      name: "Transactions",
      icon: Receipt,
      items: [
        { id: "validation", name: "Sales Validation", path: "/finance/validation" },
        { id: "journals", name: "Journals", path: "/finance/journals" },
        { id: "manual-je", name: "Manual JE", path: "/finance/manual-journal" },
      ],
    },
    {
      id: "payments",
      name: "Payments",
      icon: CreditCard,
      items: [
        { id: "payments-hub", name: "Payments", path: "/finance/payments-hub" },
        // Payment Requests · Accounts Payable · Payments · Payment Runs · Run Templates
        // · Bank Reconciliation · AR Invoices · Deposit Reservasi are in-page TABS of
        // /finance/payments-hub (consolidated to keep Finance sidebar <=12 items).
      ],
    },
    {
      id: "reports",
      name: "Reports",
      icon: FileText,
      items: [
        { id: "reports-hub", name: "Reports Hub", path: "/finance/reports" },
        // Trial Balance · P&L · Balance Sheet · Cashflow · Period Compare · Custom Reports
        // · Pivot are in-page TABS of /finance/reports (removed from sidebar to dedupe IA).
      ],
    },
    {
      id: "tax",
      name: "Tax & Compliance",
      icon: FileCheck,
      items: [
        { id: "tax", name: "Tax Center", path: "/finance/tax" },
        // e-Faktur · e-Bupot are in-page TABS of /finance/tax (Tax Hub).
      ],
    },
    {
      id: "assets-budget",
      name: "Assets & Budget",
      icon: Landmark,
      items: [
        { id: "assets", name: "Fixed Assets", path: "/finance/assets" },
        { id: "budget-hub", name: "Budget", path: "/finance/budget-hub" },
        // Budget vs Actual · Budget Management · Forecasting are in-page TABS of
        // /finance/budget-hub (consolidated to keep Finance sidebar <=12 items).
      ],
    },
    {
      id: "period",
      name: "Period Closing",
      icon: Calendar,
      items: [
        { id: "period-closing-hub", name: "Period Closing", path: "/finance/period-closing", badge: "NEW" },
        // Periods (List) & Anomaly Feed are built-in PHASES of the Period Closing
        // workflow (/finance/period-closing) — standalone routes kept for deep-links.
      ],
    },
    {
      id: "finance-config",
      name: "Finance Config",
      icon: BookOpen,
      items: [
        { id: "coa", name: "Chart of Accounts", path: "/finance/coa" },
        // REMOVED: Vendor Scorecard - duplicate, keep only in Procurement portal
      ],
    },
    // REMOVED: Reservasi section (single-item) - merged into Payments section above
  ],
};
