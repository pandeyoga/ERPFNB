/**
 * AdminSetupHub — Unified system setup workspace (IA consolidation, plan.md Phase 1c).
 * Number Series + Tax Config + Bulk Excel Import in one tabbed page.
 * URL param: ?tab=number-series (default).
 */
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Hash, Calculator, Upload, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

import NumberSeries from "./NumberSeries";
import TaxConfig from "./TaxConfig";
import BulkImport from "./BulkImport";

const TABS = [
  { id: "number-series", label: "Number Series",     short: "Numbering", icon: Hash,       component: NumberSeries },
  { id: "tax-config",    label: "Tax Config",        short: "Tax",       icon: Calculator, component: TaxConfig },
  { id: "bulk-import",   label: "Bulk Excel Import", short: "Import",    icon: Upload,     component: BulkImport },
];

export default function AdminSetupHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "number-series");

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
    <div className="space-y-0" data-testid="admin-setup-hub">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-xl font-bold">Setup &amp; Numbering</h2>
        <div className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
          <span className="text-muted-foreground/60">Configuration</span>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium">{TABS.find(t => t.id === activeTab)?.label}</span>
        </div>
      </div>

      <div
        className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-border/50 mb-5"
        data-testid="setup-hub-tabs"
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
              data-testid={`setup-tab-${tab.id}`}
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

      <div data-testid="setup-hub-content" role="tabpanel">
        <ActiveComponent />
      </div>
    </div>
  );
}
