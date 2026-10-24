/**
 * LoyaltyHub — Unified Loyalty Program workspace (IA consolidation, plan.md Phase 1c).
 * Overview + Customers + Rewards + Redemptions + CRM Analytics in one tabbed page so the
 * Admin sidebar stays compact. URL param: ?tab=overview (default).
 * Note: per-customer detail (/admin/loyalty/customers/:id) remains a standalone route.
 *
 * UI pass: PageHeader (satu-satunya <h1>) + Tabs terpadu. Sub-halaman dirender dengan
 * prop `embedded` supaya tidak menampilkan judul halaman kedua.
 */
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Star, Users, Gift, Ticket, BarChart3 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/shared/PageHeader";

import LoyaltyAdminHome from "./LoyaltyAdminHome";
import LoyaltyAdminCustomers from "./LoyaltyAdminCustomers";
import LoyaltyAdminRewards from "./LoyaltyAdminRewards";
import LoyaltyAdminRedemptions from "./LoyaltyAdminRedemptions";
import CRMAnalytics from "./CRMAnalytics";

const TABS = [
  { id: "overview",    label: "Overview",        icon: Star,      component: LoyaltyAdminHome },
  { id: "customers",   label: "Customers",       icon: Users,     component: LoyaltyAdminCustomers },
  { id: "rewards",     label: "Rewards catalog", icon: Gift,      component: LoyaltyAdminRewards },
  { id: "redemptions", label: "Redemptions",     icon: Ticket,    component: LoyaltyAdminRedemptions },
  { id: "analytics",   label: "CRM analytics",   icon: BarChart3, component: CRMAnalytics },
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

  const current = TABS.find(t => t.id === activeTab) || TABS[0];
  const ActiveComponent = current.component;

  return (
    <div data-testid="loyalty-hub">
      <PageHeader
        icon={Star}
        title="Loyalty Program"
        subtitle="Member, katalog reward, penukaran poin, dan analitik CRM dalam satu tempat."
      />

      <Tabs value={current.id} onValueChange={handleTabChange}>
        <TabsList data-testid="loyalty-hub-tabs">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.id} value={tab.id} data-testid={`loyalty-tab-${tab.id}`}>
                <Icon />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      <div className="mt-3" data-testid="loyalty-hub-content" role="tabpanel">
        <ActiveComponent embedded />
      </div>
    </div>
  );
}
