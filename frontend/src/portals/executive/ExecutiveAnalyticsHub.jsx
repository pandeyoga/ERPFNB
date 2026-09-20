/**
 * ExecutiveAnalyticsHub — Unified executive performance analytics (plan.md Phase 2g).
 * Brand Mix + Profit Walk + Period Compare in one tabbed page so the Executive
 * sidebar stays <=12 items. URL param: ?tab=brand (default).
 */
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Star, TrendingUp, GitCompareArrows, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

import BrandMixOverview from "./BrandMixOverview";
import ProfitWalk from "./ProfitWalk";
import PeriodCompare from "./PeriodCompare";

const TABS = [
  { id: "brand",          label: "Brand Mix",      short: "Brand",   icon: Star,             component: BrandMixOverview },
  { id: "profit-walk",    label: "Profit Walk",    short: "Profit",  icon: TrendingUp,       component: ProfitWalk },
  { id: "period-compare", label: "Period Compare", short: "Compare", icon: GitCompareArrows, component: PeriodCompare },
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

  const ActiveComponent = TABS.find(t => t.id === activeTab)?.component || TABS[0].component;

  return (
    <div className="space-y-0" data-testid="executive-analytics-hub">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-xl font-bold">Performance Analytics</h2>
        <div className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
          <span className="text-muted-foreground/60">Analytics</span>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium">{TABS.find(t => t.id === activeTab)?.label}</span>
        </div>
      </div>

      <div
        className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-border/50 mb-5"
        data-testid="exec-analytics-tabs"
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
              data-testid={`exec-analytics-tab-${tab.id}`}
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

      <div data-testid="exec-analytics-content" role="tabpanel">
        <ActiveComponent />
      </div>
    </div>
  );
}
