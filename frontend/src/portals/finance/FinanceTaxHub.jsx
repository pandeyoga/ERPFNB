/**
 * FinanceTaxHub — Unified Tax & Compliance workspace ("Tax & Compliance" di sidebar).
 *
 * Satu baris tab (tidak bertumpuk): PPN · PPh 21 · PPh 23 · PPh 4(2) · e-Faktur · e-Bupot.
 * Panel PPN/PPh dirender oleh TaxCenter (mode embedded, tanpa judul/tab sendiri).
 * URL param: ?tab=tax (default = PPN, dipertahankan untuk deep-link lama), pph21, pph23,
 * pph42, efaktur, ebupot. ?tab=ppn diterima sebagai alias "tax".
 */
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Receipt, Users, Briefcase, Building, FileText, ScrollText, FileCheck } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import TaxCenter from "./TaxCenter";
import EFakturExport from "./EFakturExport";
import EBupotExport from "./EBupotExport";

const TABS = [
  { id: "tax",     label: "PPN",      icon: Receipt,    section: "ppn" },
  { id: "pph21",   label: "PPh 21",   icon: Users,      section: "pph21" },
  { id: "pph23",   label: "PPh 23",   icon: Briefcase,  section: "pph23" },
  { id: "pph42",   label: "PPh 4(2)", icon: Building,   section: "pph42" },
  { id: "efaktur", label: "e-Faktur", icon: FileText,   component: EFakturExport },
  { id: "ebupot",  label: "e-Bupot",  icon: ScrollText, component: EBupotExport },
];

const normalizeTab = (p) => (p === "ppn" ? "tax" : p);

export default function FinanceTaxHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => normalizeTab(searchParams.get("tab")) || "tax");

  useEffect(() => {
    const p = normalizeTab(searchParams.get("tab"));
    if (p && p !== activeTab) setActiveTab(p);
  }, [searchParams]); // eslint-disable-line

  function handleTabChange(id) {
    setActiveTab(id);
    setSearchParams({ tab: id }, { replace: true });
  }

  const active = TABS.find(t => t.id === activeTab) || TABS[0];
  const ActiveComponent = active.component;

  return (
    <div data-testid="finance-tax-hub">
      <PageHeader
        icon={FileCheck}
        title="Tax & Compliance"
        subtitle="Konfigurasi PPN & PPh, kalkulator pemotongan, dan ekspor e-Faktur / e-Bupot ke DJP"
      />

      <Tabs value={active.id} onValueChange={handleTabChange}>
        <TabsList data-testid="tax-hub-tabs">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.id} value={tab.id} data-testid={`tax-tab-${tab.id}`}>
                <Icon />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
        <TabsContent value={active.id} data-testid="tax-hub-content">
          {active.section
            ? <TaxCenter embedded section={active.section} />
            : <ActiveComponent embedded />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
