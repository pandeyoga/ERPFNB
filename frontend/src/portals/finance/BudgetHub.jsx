/**
 * BudgetHub — Unified Budget workspace ("Budget" di sidebar Finance).
 * Budget vs Actual + Budget Management + Forecasting dalam satu halaman bertab.
 * URL param: ?tab=vs-actual (default). Halaman tab dirender `embedded` (tanpa judul sendiri).
 */
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { BarChart3, Settings2, LineChart, Target } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import BudgetVsActual from "./BudgetVsActual";
import BudgetManagement from "./BudgetManagement";
import Forecasting from "./Forecasting";

const TABS = [
  { id: "vs-actual",   label: "Budget vs Actual",  icon: BarChart3, component: BudgetVsActual },
  { id: "manage",      label: "Budget management", icon: Settings2, component: BudgetManagement },
  { id: "forecasting", label: "Forecasting",       icon: LineChart, component: Forecasting },
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

  const active = TABS.find(t => t.id === activeTab) || TABS[0];
  const ActiveComponent = active.component;

  return (
    <div data-testid="finance-budget-hub">
      <PageHeader
        icon={Target}
        title="Budget"
        subtitle="Bandingkan anggaran vs realisasi, kelola budget per COA, dan proyeksikan tren"
      />

      <Tabs value={active.id} onValueChange={handleTabChange}>
        <TabsList data-testid="budget-hub-tabs">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.id} value={tab.id} data-testid={`budget-tab-${tab.id}`}>
                <Icon />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
        <TabsContent value={active.id} data-testid="budget-hub-content">
          <ActiveComponent embedded onSwitchTab={handleTabChange} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
