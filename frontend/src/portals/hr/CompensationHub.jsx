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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PageHeader from "@/components/shared/PageHeader";
import { InlineHelp } from "@/components/shared/InlineHelp";
import PayrollList from "./PayrollList";
import ServiceChargeList from "./ServiceChargeList";
import IncentiveList from "./IncentiveList";
import VoucherList from "./VoucherList";
import FOCList from "./FOCList";
import AdvancesList from "./AdvancesList";
import LBFundLedger from "./LBFundLedger";

const TABS = [
  { id: "payroll",        name: "Payroll",        icon: DollarSign, desc: "Penggajian bulanan & salary master karyawan", render: () => <PayrollList embedded /> },
  { id: "service-charge", name: "Service Charge", icon: Receipt,    desc: "Distribusi service charge per outlet & periode", render: () => <ServiceChargeList embedded /> },
  { id: "incentive",      name: "Incentive",      icon: Gift,       desc: "Program insentif & bonus karyawan", render: () => <IncentiveList embedded /> },
  { id: "voucher",        name: "Voucher",        icon: Ticket,     desc: "Penerbitan & penukaran voucher", render: () => <VoucherList embedded /> },
  { id: "foc",            name: "FOC",            icon: Coffee,     desc: "Pencatatan Free of Charge (staff meal, marketing, kompensasi)", render: () => <FOCList embedded /> },
  { id: "advances",       name: "Advances",       icon: Wallet,     desc: "Kasbon karyawan & jadwal cicilan", render: () => <AdvancesList embedded /> },
  { id: "lb-fund",        name: "LB Fund",        icon: PiggyBank,  desc: "Buku besar dana Loss & Breakage", render: () => <LBFundLedger embedded /> },
];

export default function CompensationHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") || "payroll").toLowerCase();
  const activeTab = TABS.find(t => t.id === tab) || TABS[0];

  const setTab = (id) => setSearchParams({ tab: id }, { replace: true });

  return (
    <div data-testid="compensation-hub">
      <PageHeader
        icon={activeTab.icon}
        title="Compensation"
        subtitle={activeTab.desc}
        actions={<InlineHelp id="hr-compensation-hub" size="sm" />}
      />
      <Tabs value={activeTab.id} onValueChange={setTab}>
        <TabsList data-testid="comp-tabs">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <TabsTrigger key={t.id} value={t.id} data-testid={`comp-tab-${t.id}`}>
                <Icon /> {t.name}
              </TabsTrigger>
            );
          })}
        </TabsList>
        <TabsContent value={activeTab.id} data-testid={`comp-content-${activeTab.id}`}>
          {activeTab.render()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
