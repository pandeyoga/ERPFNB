/**
 * BudgetHub — Unified Budget workspace (IA consolidation, plan.md Phase 1c).
 * Budget vs Actual + Budget Management + Forecasting in one tabbed page.
 * URL param: ?tab=vs-actual (default).
 */
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { BarChart3, Settings2, LineChart, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

import BudgetVsActual from "./BudgetVsActual";
import BudgetManagement from "./BudgetManagement";
import Forecasting from "./Forecasting";

const TABS = [
  { id: "vs-actual",   label: "Budget vs Actual", short: "vs Actual", icon: BarChart3, component: BudgetVsActual },
  { id: "manage",      label: "Budget Management", short: "Manage",   icon: Settings2,  component: BudgetManagement },
  { id: "forecasting", label: "Forecasting",       short: "Forecast", icon: LineChart,  component: Forecasting },
];

export default function BudgetHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "vs-actual");

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
    <div className="space-y-0" data-testid="finance-budget-hub">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-xl font-bold">Budget</h2>
        <div className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
          <span className="text-muted-foreground/60">Budget</span>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium">{TABS.find(t => t.id === activeTab)?.label}</span>
        </div>
      </div>

      <div
        className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-border/50 mb-5"
        data-testid="budget-hub-tabs"
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
              data-testid={`budget-tab-${tab.id}`}
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

      <div data-testid="budget-hub-content" role="tabpanel">
        <ActiveComponent />
      </div>
    </div>
  );
}
