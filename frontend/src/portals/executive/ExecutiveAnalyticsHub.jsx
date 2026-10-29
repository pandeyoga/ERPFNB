/**
 * ExecutiveAnalyticsHub — Unified executive performance analytics (plan.md Phase 2g).
 * Brand Mix + Profit Walk + Period Compare in one tabbed page so the Executive
 * sidebar stays <=12 items. URL param: ?tab=brand (default).
 *
 * Halaman tab dirender dengan prop `embedded` → mereka tidak menampilkan <h1>
 * sendiri (hanya satu PageHeader per halaman).
 */
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Star, TrendingUp, GitCompareArrows, LineChart } from "lucide-react";
import PageHeader, { HubHeaderProvider } from "@/components/shared/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import BrandMixOverview from "./BrandMixOverview";
import ProfitWalk from "./ProfitWalk";
import PeriodCompare from "./PeriodCompare";

const TABS = [
  { id: "brand",          label: "Brand Mix",      icon: Star,             component: BrandMixOverview },
  { id: "profit-walk",    label: "Profit Walk",    icon: TrendingUp,       component: ProfitWalk },
  { id: "period-compare", label: "Period Compare", icon: GitCompareArrows, component: PeriodCompare },
];

export default function ExecutiveAnalyticsHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "brand");

  useEffect(() => {
    const p = searchParams.get("tab");
    if (p && p !== activeTab) setActiveTab(p);
  }, [searchParams]); // eslint-disable-line

  function handleTabChange(id) {
    setActiveTab(id);
    setSearchParams({ tab: id }, { replace: true });
  }

  const current = TABS.find(t => t.id === activeTab) || TABS[0];

  return (
    <HubHeaderProvider>
      <div className="space-y-3 lg:space-y-4" data-testid="executive-analytics-hub">
        <PageHeader hub
          icon={LineChart}
          title="Performance Analytics"
          subtitle="Brand mix, profit walk & perbandingan periode untuk seluruh group"
          className="mb-0 md:mb-0"
        />

        <Tabs value={current.id} onValueChange={handleTabChange}>
          <TabsList data-testid="exec-analytics-tabs">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.id} value={tab.id} data-testid={`exec-analytics-tab-${tab.id}`}>
                  <Icon /> {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <div data-testid="exec-analytics-content">
            {/* Radix hanya me-mount TabsContent yang aktif */}
            {TABS.map(tab => {
              const Comp = tab.component;
              return (
                <TabsContent key={tab.id} value={tab.id}>
                  <Comp embedded />
                </TabsContent>
              );
            })}
          </div>
        </Tabs>
      </div>
    </HubHeaderProvider>
  );
}
