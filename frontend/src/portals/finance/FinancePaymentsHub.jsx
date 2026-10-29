/**
 * FinancePaymentsHub — Unified payments workspace (IA consolidation, plan.md Phase 1c).
 * Payment sub-pages in one tabbed page so the Finance sidebar stays <=12 items.
 * URL param: ?tab=payments (default; legacy payment-requests retired, P0-04). Mirrors the proven FinanceReportsHub pattern.
 *
 * Archetype "hub_with_tabs" (design_guidelines): PageHeader hub (satu-satunya <h1>) →
 * Tabs pill tepat di bawahnya → tiap tab merender halaman dengan `embedded` sehingga
 * halaman tersebut TIDAK menampilkan judul besar kedua, hanya toolbar ringkas.
 */
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Receipt, Banknote, Layers, ClipboardList,
  Landmark, FileSpreadsheet, CalendarCheck, Wallet, CreditCard,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader, { HubHeaderProvider } from "@/components/shared/PageHeader";
import { useVisibleTabs } from "@/lib/portalGate";

import APAging from "./APAging";
import PaymentList from "./PaymentList";
import PaymentRunList from "./PaymentRunList";
import PaymentRunTemplateList from "./PaymentRunTemplateList";
import BankRecon from "./BankRecon";
import ARInvoiceList from "./ARInvoiceList";
import ReservationDeposits from "./ReservationDeposits";
import CashPosition from "./CashPosition";

// perm = izin route lama tab tersebut (route lama kini redirect ke ?tab=…)
const TABS = [
  { id: "ap-aging",         label: "AP aging",             icon: Receipt,         component: APAging,                perm: "finance.ap.read" },
  { id: "payments",         label: "Payments",             icon: Banknote,        component: PaymentList,            perm: "finance.payment" },
  { id: "payment-runs",     label: "Payment runs",         icon: Layers,          component: PaymentRunList,         perm: "finance.payment" },
  { id: "run-templates",    label: "Run templates",        icon: ClipboardList,   component: PaymentRunTemplateList, perm: "finance.payment" },
  { id: "bank-recon",       label: "Bank reconciliation",  icon: Landmark,        component: BankRecon,              perm: "finance.bank_reconciliation" },
  { id: "cash-position",    label: "Cash position",        icon: Wallet,          component: CashPosition,           perm: "finance.cash.read" },
  { id: "ar-invoices",      label: "AR invoices",          icon: FileSpreadsheet, component: ARInvoiceList,          perm: "finance.ar" },
  { id: "deposits",         label: "Reservation deposits", icon: CalendarCheck,   component: ReservationDeposits,    perm: "finance.ar" },
];

export default function FinancePaymentsHub() {
  const tabs = useVisibleTabs(TABS);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "payments");

  useEffect(() => {
    const p = searchParams.get("tab");
    if (p && p !== activeTab) setActiveTab(p);
  }, [searchParams]); // eslint-disable-line

  function handleTabChange(id) {
    setActiveTab(id);
    setSearchParams({ tab: id }, { replace: true });
  }

  const current = tabs.find(t => t.id === activeTab) || tabs.find(t => t.id === "payments") || tabs[0];
  const ActiveComponent = current.component;

  return (
    <HubHeaderProvider>
      <div className="space-y-3 lg:space-y-4" data-testid="finance-payments-hub">
        <PageHeader hub
          icon={CreditCard}
          title="Payments"
          subtitle="Hutang (AP), pembayaran, payment run, rekonsiliasi bank, posisi kas, dan piutang (AR) dalam satu tempat."
        />

        <Tabs value={current.id} onValueChange={handleTabChange}>
          <TabsList data-testid="payments-hub-tabs">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.id} value={tab.id} data-testid={`payments-tab-${tab.id}`}>
                  <Icon />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        <div data-testid="payments-hub-content" role="tabpanel" aria-label={current.label}>
          <ActiveComponent embedded />
        </div>
      </div>
    </HubHeaderProvider>
  );
}
