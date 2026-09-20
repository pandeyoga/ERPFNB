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
 */
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { DollarSign, Receipt, Gift, Ticket, Coffee, Wallet, PiggyBank } from "lucide-react";
import { cn } from "@/lib/utils";
import { InlineHelp } from "@/components/shared/InlineHelp";
import PayrollList from "./PayrollList";
import ServiceChargeList from "./ServiceChargeList";
import IncentiveList from "./IncentiveList";
import VoucherList from "./VoucherList";
import FOCList from "./FOCList";
import AdvancesList from "./AdvancesList";
import LBFundLedger from "./LBFundLedger";

const TABS = [
  { id: "payroll",        name: "Payroll",          icon: DollarSign, desc: "Penggajian bulanan", render: () => <PayrollList /> },
  { id: "service-charge", name: "Service Charge",   icon: Receipt,    desc: "Distribusi service charge", render: () => <ServiceChargeList /> },
  { id: "incentive",      name: "Incentive",        icon: Gift,       desc: "Program insentif & bonus", render: () => <IncentiveList /> },
  { id: "voucher",        name: "Voucher",          icon: Ticket,     desc: "Voucher karyawan", render: () => <VoucherList /> },
  { id: "foc",            name: "FOC",              icon: Coffee,     desc: "Free of Charge meal allowance", render: () => <FOCList /> },
  { id: "advances",       name: "Advances",         icon: Wallet,     desc: "Kasbon karyawan", render: () => <AdvancesList /> },
  { id: "lb-fund",        name: "LB Fund",          icon: PiggyBank,  desc: "Lebaran & bonus fund ledger", render: () => <LBFundLedger /> },
];

export default function CompensationHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") || "payroll").toLowerCase();
  const activeTab = TABS.find(t => t.id === tab) || TABS[0];

  const setTab = (id) => setSearchParams({ tab: id }, { replace: true });

  return (
    <div className="space-y-4" data-testid="compensation-hub">
      <div className="glass-card overflow-hidden">
        <div className="px-5 pt-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl grad-aurora-soft flex items-center justify-center">
              <activeTab.icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold leading-tight">Compensation & Benefits</h2>
              <p className="text-xs text-muted-foreground">{activeTab.desc}</p>
            </div>
            <InlineHelp id="hr-compensation-hub" size="sm" />
          </div>
        </div>
        <div
          className="flex items-center gap-1 px-5 pt-4 border-b border-border/40 -mb-px overflow-x-auto"
          data-testid="comp-tabs"
          role="tablist"
        >
          {TABS.map(t => {
            const isActive = t.id === activeTab.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative inline-flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap",
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                data-testid={`comp-tab-${t.id}`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t.name}</span>
                {isActive && (
                  <motion.div
                    layoutId="comp-tab-underline"
                    className="absolute inset-x-0 -bottom-px h-0.5 bg-foreground"
                    transition={{ type: "spring", duration: 0.4 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div data-testid={`comp-content-${activeTab.id}`}>
        {activeTab.render()}
      </div>
    </div>
  );
}
