/**
 * FinanceReportsHub — Unified reports workspace.
 * 7 report tabs in one page: TB, P&L, BS, Cashflow, Comparatives, Builder, Pivot.
 * URL param: ?tab=trial-balance (default)
 */
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BarChart3, TrendingUp, Scale, Droplets, GitCompareArrows,
  Wand2, Table2, ChevronRight, ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { InlineHelp } from "@/components/shared/InlineHelp";

// Lazy-load heavy report components
import TrialBalance from "./TrialBalance";
import ProfitLoss from "./ProfitLoss";
import BalanceSheet from "./BalanceSheet";
import CashflowReport from "./CashflowReport";
import Comparatives from "./Comparatives";
import ReportBuilder from "./ReportBuilder";
import PivotReport from "./PivotReport";
import ProcurementReportsTab from "./ProcurementReportsTab";

const TABS = [
  { id: "trial-balance",       label: "Trial Balance",       icon: BarChart3,        short: "TB",   component: TrialBalance },
  { id: "profit-loss",         label: "Profit & Loss",       icon: TrendingUp,       short: "P&L",  component: ProfitLoss },
  { id: "balance-sheet",       label: "Balance Sheet",       icon: Scale,            short: "BS",   component: BalanceSheet },
  { id: "cashflow",            label: "Cashflow",             icon: Droplets,         short: "CF",   component: CashflowReport },
  { id: "comparatives",        label: "Period Compare",       icon: GitCompareArrows, short: "Comp", component: Comparatives },
  { id: "report-builder",      label: "Custom Reports",       icon: Wand2,            short: "CB",   component: ReportBuilder },
  { id: "pivot",               label: "Pivot Analysis",       icon: Table2,           short: "Pvt",  component: PivotReport },
  { id: "procurement-reports", label: "Procurement Reports",  icon: ShoppingCart,     short: "Proc", component: ProcurementReportsTab },
];

export default function FinanceReportsHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "trial-balance");

  // Sync activeTab ↔ URL param
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
    <div className="space-y-0" data-testid="finance-reports-hub">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-xl font-bold">Financial Reports</h2>
        <InlineHelp id="finance-reports-hub" size="xs" placement="right" />
        <div className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
          <span className="text-muted-foreground/60">Reports</span>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium">{TABS.find(t => t.id === activeTab)?.label}</span>
        </div>
      </div>

      {/* Tab bar */}
      <div
        className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-border/50 mb-5"
        data-testid="reports-hub-tabs"
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
              data-testid={`reports-tab-${tab.id}`}
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

      {/* Active report content */}
      <div data-testid="reports-hub-content" role="tabpanel">
        <ActiveComponent />
      </div>
    </div>
  );
}
