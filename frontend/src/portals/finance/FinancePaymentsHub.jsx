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
import HubTabs, { groupTabs } from "@/components/shared/HubTabs";
import PageHeader, { HubHeaderProvider } from "@/components/shared/PageHeader";
import { useVisibleTabs } from "@/lib/portalGate";
import { GroupLevelBadge } from "@/components/shared/ScopeControls";

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
  { id: "ap-aging",         label: "AP aging",             icon: Receipt,         component: APAging,                perm: "finance.ap.read", group: true },
  { id: "payments",         label: "Payments",             icon: Banknote,        component: PaymentList,            perm: "finance.payment", group: true },
  { id: "payment-runs",     label: "Payment runs",         icon: Layers,          component: PaymentRunList,         perm: "finance.payment", group: true },
  { id: "run-templates",    label: "Run templates",        icon: ClipboardList,   component: PaymentRunTemplateList, perm: "finance.payment", group: true },
  { id: "bank-recon",       label: "Bank reconciliation",  icon: Landmark,        component: BankRecon,              perm: "finance.bank_reconciliation", group: true },
  { id: "cash-position",    label: "Cash position",        icon: Wallet,          component: CashPosition,           perm: "finance.cash.read" },
  { id: "ar-invoices",      label: "AR invoices",          icon: FileSpreadsheet, component: ARInvoiceList,          perm: "finance.ar", group: true },
  { id: "deposits",         label: "Reservation deposits", icon: CalendarCheck,   component: ReservationDeposits,    perm: "finance.ar" },
];

const GROUPS = [
  { id: "ap", label: "Hutang (AP)", icon: Receipt, ids: ["ap-aging", "payments", "payment-runs", "run-templates"] },
  { id: "cash", label: "Kas & Bank", icon: Wallet, ids: ["cash-position", "bank-recon"] },
  { id: "ar", label: "Piutang (AR)", icon: FileSpreadsheet, ids: ["ar-invoices", "deposits"] },
];

// group: true = tab tingkat Group (vendor/rekening/customer milik pusat) — tidak mengikuti konteks brand/toko.
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
          actions={current.group ? <GroupLevelBadge /> : null}
        />

        {/* 8 halaman → 3 kelompok + sub-tab (DESIGN_SYSTEM §10.8) */}
        <HubTabs
          groups={groupTabs(tabs, GROUPS)}
          value={current.id}
          onChange={handleTabChange}
          testId="payments-hub-tabs"
          itemTestId={(id) => `payments-tab-${id}`}
          groupTestId={(id) => `payments-group-${id}`}
        />

        <div data-testid="payments-hub-content" role="tabpanel" aria-label={current.label}>
          <ActiveComponent embedded />
        </div>
      </div>
    </HubHeaderProvider>
  );
}
