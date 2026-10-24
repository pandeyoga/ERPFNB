/** navigationSchema/finance.js — Finance portal navigation. */

import { LayoutDashboard, Receipt, CreditCard, Landmark, FileCheck, Calendar, FileText, BookOpen } from "lucide-react";

export const financeNav = {
  id: "finance",
  name: "Finance Portal",
  // Operasi harian dulu (validasi → jurnal → pembayaran), analitik (Reports) setelahnya,
  // konfigurasi (CoA) terakhir.
  sections: [
    {
      id: "overview",
      name: "Overview",
      icon: LayoutDashboard,
      items: [
        { id: "dashboard", name: "Overview", path: "/finance" },
      ],
    },
    {
      id: "transactions",
      name: "Transactions",
      icon: Receipt,
      items: [
        { id: "validation", name: "Sales Validation", path: "/finance/validation" },
        { id: "journals", name: "Journals", path: "/finance/journals" },
        { id: "manual-je", name: "Manual Journal", path: "/finance/manual-journal" },
      ],
    },
    {
      id: "payments",
      name: "Payments",
      icon: CreditCard,
      items: [
        { id: "payments-hub", name: "Payments", path: "/finance/payments-hub", matchPaths: ["/finance/payments", "/finance/payment-runs", "/finance/payment-run-templates", "/finance/payment-requests", "/finance/ap-aging", "/finance/ar-invoices", "/finance/bank-recon", "/finance/cash-position", "/finance/reservation-deposits", "/finance/vendor-scorecard"] },
        // Payment Requests · Accounts Payable · Payments · Payment Runs · Run Templates
        // · Bank Reconciliation · AR Invoices · Deposit Reservasi are in-page TABS of
        // /finance/payments-hub (consolidated to keep Finance sidebar <=12 items).
      ],
    },
    {
      id: "assets-budget",
      name: "Assets & Budget",
      icon: Landmark,
      items: [
        { id: "assets", name: "Fixed Assets", path: "/finance/assets" },
        { id: "budget-hub", name: "Budget", path: "/finance/budget-hub", matchPaths: ["/finance/budget", "/finance/forecasting"] },
        // Budget vs Actual · Budget Management · Forecasting are in-page TABS of
        // /finance/budget-hub (consolidated to keep Finance sidebar <=12 items).
      ],
    },
    {
      id: "tax",
      name: "Tax & Compliance",
      icon: FileCheck,
      items: [
        { id: "tax", name: "Tax & Compliance", path: "/finance/tax", matchPaths: ["/finance/tax-center", "/finance/efaktur", "/finance/ebupot"] },
        // e-Faktur · e-Bupot are in-page TABS of /finance/tax (Tax Hub).
      ],
    },
    {
      id: "period",
      name: "Period Closing",
      icon: Calendar,
      items: [
        { id: "period-closing-hub", name: "Period Closing", path: "/finance/period-closing", matchPaths: ["/finance/periods", "/finance/anomalies"] },
        // Periods (List) & Anomaly Feed are built-in PHASES of the Period Closing
        // workflow (/finance/period-closing) — standalone routes kept for deep-links.
      ],
    },
    {
      id: "reports",
      name: "Reports",
      icon: FileText,
      items: [
        { id: "reports-hub", name: "Reports", path: "/finance/reports" },
        // Trial Balance · P&L · Balance Sheet · Cashflow · Period Compare · Custom Reports
        // · Pivot are in-page TABS of /finance/reports (removed from sidebar to dedupe IA).
      ],
    },
    {
      id: "finance-config",
      name: "Chart of Accounts",
      icon: BookOpen,
      items: [
        { id: "coa", name: "Chart of Accounts", path: "/finance/coa" },
      ],
    },
  ],
};
