/**
 * LoyaltyHub — Unified Loyalty Program workspace (IA consolidation, plan.md Phase 1c).
 * Overview + Customers + Rewards + Redemptions + CRM Analytics in one tabbed page so the
 * Admin sidebar stays compact. URL param: ?tab=overview (default).
 * Note: per-customer detail (/admin/loyalty/customers/:id) remains a standalone route.
 */
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Star, Users, Gift, Ticket, BarChart3, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

import LoyaltyAdminHome from "./LoyaltyAdminHome";
import LoyaltyAdminCustomers from "./LoyaltyAdminCustomers";
import LoyaltyAdminRewards from "./LoyaltyAdminRewards";
import LoyaltyAdminRedemptions from "./LoyaltyAdminRedemptions";
import CRMAnalytics from "./CRMAnalytics";

const TABS = [
  { id: "overview",    label: "Loyalty Overview", short: "Overview", icon: Star,      component: LoyaltyAdminHome },
  { id: "customers",   label: "Customers",        short: "Cust",     icon: Users,     component: LoyaltyAdminCustomers },
  { id: "rewards",     label: "Rewards Catalog",  short: "Rewards",  icon: Gift,      component: LoyaltyAdminRewards },
  { id: "redemptions", label: "Redemptions",      short: "Redeem",   icon: Ticket,    component: LoyaltyAdminRedemptions },
  { id: "analytics",   label: "CRM Analytics",    short: "Analytics", icon: BarChart3, component: CRMAnalytics },
];

export default function LoyaltyHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "overview");

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
    <div className="space-y-0" data-testid="loyalty-hub">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-xl font-bold">Loyalty Program</h2>
        <div className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
          <span className="text-muted-foreground/60">Loyalty</span>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium">{TABS.find(t => t.id === activeTab)?.label}</span>
        </div>
      </div>

      <div
        className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-border/50 mb-5"
        data-testid="loyalty-hub-tabs"
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
              data-testid={`loyalty-tab-${tab.id}`}
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

      <div data-testid="loyalty-hub-content" role="tabpanel">
        <ActiveComponent />
      </div>
    </div>
  );
}
