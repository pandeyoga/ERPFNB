/** Sourcing — hub harga untuk keputusan beli (Procurement).
 *
 * Tab (?tab=): overview (default) · benchmarks · offers · settings. Analisis per item: /procurement/sourcing/items/:id.
 * Menggantikan Market Price List (Inventory) & Price Intelligence (redirect ke sini).
 */
import { useSearchParams } from "react-router-dom";
import { Scale } from "lucide-react";
import PageHeader, { HubHeaderProvider } from "@/components/shared/PageHeader";
import HubTabs from "@/components/shared/HubTabs";
import SourcingOverview from "./SourcingOverview";
import BenchmarkWorksheet from "./BenchmarkWorksheet";
import SupplierOffers from "./SupplierOffers";
import SourcingSettings from "./SourcingSettings";

const TABS = [
  { id: "overview", label: "Ringkasan", render: () => <SourcingOverview /> },
  { id: "benchmarks", label: "Harga acuan", render: () => <BenchmarkWorksheet /> },
  { id: "offers", label: "Penawaran supplier", render: () => <SupplierOffers /> },
  { id: "settings", label: "Pengaturan", render: () => <SourcingSettings /> },
];

export default function SourcingHub() {
  const [params, setParams] = useSearchParams();
  const active = TABS.find((t) => t.id === params.get("tab")) || TABS[0];
  return (
    <HubHeaderProvider>
      <div className="space-y-3 lg:space-y-4" data-testid="sourcing-hub">
        <PageHeader hub icon={Scale} title="Sourcing"
          subtitle="Harga acuan, penawaran supplier, dan harga beli dalam satu tempat." />
        <HubTabs
          groups={TABS.map((t) => ({ id: t.id, label: t.label, items: [{ id: t.id, label: t.label }] }))}
          value={active.id}
          onChange={(id) => setParams(id === "overview" ? {} : { tab: id }, { replace: true })}
          testId="sourcing-tabs"
          itemTestId={(id) => `sourcing-tab-${id}`}
          ariaLabel="Bagian Sourcing"
        />
        <div key={active.id}>{active.render()}</div>
      </div>
    </HubHeaderProvider>
  );
}
