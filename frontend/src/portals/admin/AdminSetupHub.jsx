/**
 * AdminSetupHub — Unified system setup workspace (IA consolidation, plan.md Phase 1c).
 * Number Series + Tax Config + Bulk Excel Import in one tabbed page.
 * URL param: ?tab=number-series (default).
 *
 * Judul halaman (satu <h1>) = nama menu "Setup & Numbering"; halaman anak dirender
 * dengan `embedded` sehingga tidak menampilkan judul besar kedua.
 */
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Hash, Calculator, Upload, Wrench } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import NumberSeries from "./NumberSeries";
import TaxConfig from "./TaxConfig";
import BulkImport from "./BulkImport";

const TABS = [
  { id: "number-series", label: "Number series",     icon: Hash,       component: NumberSeries },
  { id: "tax-config",    label: "Tax config",        icon: Calculator, component: TaxConfig },
  { id: "bulk-import",   label: "Bulk Excel import", icon: Upload,     component: BulkImport },
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

  const current = TABS.some((t) => t.id === activeTab) ? activeTab : TABS[0].id;

  return (
    <div data-testid="admin-setup-hub">
      <PageHeader
        icon={Wrench}
        title="Setup & Numbering"
        subtitle="Penomoran dokumen, status pajak, dan import master data massal."
      />

      <Tabs value={current} onValueChange={handleTabChange}>
        <TabsList data-testid="setup-hub-tabs">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.id} value={tab.id} data-testid={`setup-tab-${tab.id}`}>
                <Icon /> {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {TABS.map((tab) => {
          const Comp = tab.component;
          return (
            <TabsContent key={tab.id} value={tab.id} data-testid="setup-hub-content">
              <Comp embedded />
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
