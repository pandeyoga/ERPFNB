/** CompensationHub — Phase D4 UX consolidation 2026-05-26.
 *
 * HR Compensation & Benefits was spread across 3 sidebar sections with 7 menu items.
 * Now consolidated to a single tabbed hub.
 *
 * URL: /hr/compensation         → default Payroll tab
 *      /hr/compensation?tab=...  → deep link
 *
 * Old routes (/hr/payroll, /hr/service-charge, /hr/incentive, /hr/voucher,
 * /hr/foc, /hr/advances, /hr/lb-fund) remain working for backwards compat.
 *
 * UI pass 2026-10: hub owns the ONLY <h1> (PageHeader "Compensation") and uses the
 * unified Tabs primitive. Every tab page is rendered with `embedded` so it does not
 * render its own PageHeader inside the hub.
 */
import { useSearchParams } from "react-router-dom";
import { DollarSign, Receipt, Gift, Ticket, Coffee, Wallet, PiggyBank } from "lucide-react";
import HubTabs, { groupTabs } from "@/components/shared/HubTabs";
import PageHeader, { HubHeaderProvider } from "@/components/shared/PageHeader";
import { InlineHelp } from "@/components/shared/InlineHelp";
import PayrollList from "./PayrollList";
import ServiceChargeList from "./ServiceChargeList";
import IncentiveList from "./IncentiveList";
import VoucherList from "./VoucherList";
import FOCList from "./FOCList";
import AdvancesList from "./AdvancesList";
import LBFundLedger from "./LBFundLedger";
import { useVisibleTabs } from "@/lib/portalGate";

// perm = izin route lama tab tersebut (route lama kini redirect ke tab ini)
const TABS = [
  { id: "payroll",        name: "Payroll",        icon: DollarSign, desc: "Penggajian bulanan & salary master karyawan", render: () => <PayrollList embedded />, perm: ["hr.read", "hr.write"] },
  { id: "service-charge", name: "Service Charge", icon: Receipt,    desc: "Distribusi service charge per outlet & periode", render: () => <ServiceChargeList embedded />, perm: "hr.service_charge" },
  { id: "incentive",      name: "Incentive",      icon: Gift,       desc: "Program insentif & bonus karyawan", render: () => <IncentiveList embedded />, perm: "hr.incentive" },
  { id: "voucher",        name: "Voucher",        icon: Ticket,     desc: "Penerbitan & penukaran voucher", render: () => <VoucherList embedded />, perm: "hr.voucher" },
  { id: "foc",            name: "FOC",            icon: Coffee,     desc: "Pencatatan Free of Charge (staff meal, marketing, kompensasi)", render: () => <FOCList embedded />, perm: "hr.foc" },
  { id: "advances",       name: "Advances",       icon: Wallet,     desc: "Kasbon karyawan & jadwal cicilan", render: () => <AdvancesList embedded />, perm: "hr.advance" },
  { id: "lb-fund",        name: "LB Fund",        icon: PiggyBank,  desc: "Buku besar dana Loss & Breakage", render: () => <LBFundLedger embedded />, perm: "hr.lb_fund" },
];

// Kasbon dipotong saat payroll; LB Fund diisi dari porsi service charge.
const GROUPS = [
  { id: "pay", label: "Penggajian", icon: DollarSign, ids: ["payroll", "incentive", "advances"] },
  { id: "sc", label: "Service charge & LB", icon: Receipt, ids: ["service-charge", "lb-fund"] },
  { id: "benefit", label: "Voucher & FOC", icon: Ticket, ids: ["voucher", "foc"] },
];

export default function CompensationHub() {
  const tabs = useVisibleTabs(TABS);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") || "payroll").toLowerCase();
  const activeTab = tabs.find(t => t.id === tab) || tabs[0];

  const setTab = (id) => setSearchParams({ tab: id }, { replace: true });

  return (
    <HubHeaderProvider>
      <div data-testid="compensation-hub">
        <PageHeader hub
          icon={activeTab.icon}
          title="Compensation"
          subtitle={activeTab.desc}
          actions={<InlineHelp id="hr-compensation-hub" size="sm" />}
        />
        {/* 7 halaman → 3 kelompok + sub-tab (DESIGN_SYSTEM §10.8) */}
        <HubTabs
          groups={groupTabs(tabs.map(t => ({ ...t, label: t.name })), GROUPS)}
          value={activeTab.id}
          onChange={setTab}
          testId="comp-tabs"
          itemTestId={(id) => `comp-tab-${id}`}
          groupTestId={(id) => `comp-group-${id}`}
        />
        <div className="mt-3" data-testid={`comp-content-${activeTab.id}`} role="tabpanel" aria-label={activeTab.name}>
          {activeTab.render()}
        </div>
      </div>
    </HubHeaderProvider>
  );
}
