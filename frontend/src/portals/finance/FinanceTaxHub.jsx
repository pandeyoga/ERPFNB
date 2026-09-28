/**
 * FinanceTaxHub — Unified Tax & Compliance workspace (IA consolidation, plan.md Phase 1c).
 * Tax Center + e-Faktur + e-Bupot in one tabbed page. URL param: ?tab=tax (default).
 */
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Calculator, FileText, ScrollText, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

import TaxCenter from "./TaxCenter";
import EFakturExport from "./EFakturExport";
import EBupotExport from "./EBupotExport";

const TABS = [
  { id: "tax",     label: "Tax Center", short: "Tax",     icon: Calculator,  component: TaxCenter },
  { id: "efaktur", label: "e-Faktur",   short: "e-Faktur", icon: FileText,    component: EFakturExport },
  { id: "ebupot",  label: "e-Bupot",    short: "e-Bupot",  icon: ScrollText,  component: EBupotExport },
];

export default function FinanceTaxHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "tax");

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
    <div className="space-y-0" data-testid="finance-tax-hub">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-xl font-bold">Tax &amp; Compliance</h2>
        <div className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
          <span className="text-muted-foreground/60">Tax</span>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium">{TABS.find(t => t.id === activeTab)?.label}</span>
        </div>
      </div>

      <div
        className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-border/50 mb-5"
        data-testid="tax-hub-tabs"
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
              data-testid={`tax-tab-${tab.id}`}
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

      <div data-testid="tax-hub-content" role="tabpanel">
        <ActiveComponent />
      </div>
    </div>
  );
}
