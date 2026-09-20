/**
 * FinancePaymentsHub — Unified payments workspace (IA consolidation, plan.md Phase 1c).
 * 8 payment sub-pages in one tabbed page so the Finance sidebar stays <=12 items.
 * URL param: ?tab=payment-requests (default). Mirrors the proven FinanceReportsHub pattern.
 */
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FileText, Receipt, Banknote, Layers, ClipboardList,
  Landmark, FileSpreadsheet, CalendarCheck, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

import PaymentRequestList from "./PaymentRequestList";
import APAging from "./APAging";
import PaymentList from "./PaymentList";
import PaymentRunList from "./PaymentRunList";
import PaymentRunTemplateList from "./PaymentRunTemplateList";
import BankRecon from "./BankRecon";
import ARInvoiceList from "./ARInvoiceList";
import ReservationDeposits from "./ReservationDeposits";

const TABS = [
  { id: "payment-requests", label: "Payment Requests", short: "Requests", icon: FileText,        component: PaymentRequestList },
  { id: "ap-aging",         label: "Accounts Payable", short: "AP",       icon: Receipt,         component: APAging },
  { id: "payments",         label: "Payments",         short: "Pay",      icon: Banknote,        component: PaymentList },
  { id: "payment-runs",     label: "Payment Runs",     short: "Runs",     icon: Layers,          component: PaymentRunList },
  { id: "run-templates",    label: "Run Templates",    short: "Tmpl",     icon: ClipboardList,   component: PaymentRunTemplateList },
  { id: "bank-recon",       label: "Bank Reconciliation", short: "Recon", icon: Landmark,       component: BankRecon },
  { id: "ar-invoices",      label: "AR Invoices",      short: "AR",      icon: FileSpreadsheet, component: ARInvoiceList },
  { id: "deposits",         label: "Deposit Reservasi", short: "Deposit", icon: CalendarCheck,  component: ReservationDeposits },
];

export default function FinancePaymentsHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "payment-requests");

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
    <div className="space-y-0" data-testid="finance-payments-hub">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-xl font-bold">Payments</h2>
        <div className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
          <span className="text-muted-foreground/60">Payments</span>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium">{TABS.find(t => t.id === activeTab)?.label}</span>
        </div>
      </div>

      <div
        className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-border/50 mb-5"
        data-testid="payments-hub-tabs"
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
              data-testid={`payments-tab-${tab.id}`}
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

      <div data-testid="payments-hub-content" role="tabpanel">
        <ActiveComponent />
      </div>
    </div>
  );
}
