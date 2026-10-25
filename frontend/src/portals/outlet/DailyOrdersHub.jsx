/** DailyOrdersHub — Phase D UX consolidation 2026-05-26.
 *
 * Single page for Kitchen Daily Order (KDO), Bar Daily Order (BDO), and
 * Floor Daily Order (FDO). Previously these were 3 separate menu items with
 * functionally identical layouts — a textbook "split flow" anti-pattern.
 *
 * Now: One page with tabs at the top. URL params control which tab is active:
 *   - /outlet/daily-orders         → defaults to Kitchen
 *   - /outlet/daily-orders?type=bdo → Bar
 *   - /outlet/daily-orders?type=fdo → Floor (uses separate FdoPage component)
 *
 * Old routes /outlet/kdo, /outlet/bdo, /outlet/fdo remain working but now
 * redirect to this hub (via OutletPortal.jsx route config).
 */
import { useSearchParams } from "react-router-dom";
import { ChefHat, Wine, Utensils, ClipboardList } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/shared/PageHeader";
import KdoBdoList from "./KdoBdoList";
import FdoPage from "./FdoPage";

const TABS = [
  { id: "kdo", name: "Kitchen",  full: "KDO — Kitchen Daily Order", icon: ChefHat,  desc: "Permintaan bahan dapur harian" },
  { id: "bdo", name: "Bar",      full: "BDO — Bar Daily Order",     icon: Wine,     desc: "Permintaan bahan bar harian" },
  { id: "fdo", name: "Floor",    full: "FDO — Floor Daily Order",   icon: Utensils, desc: "Permintaan floor/service harian" },
];

export default function DailyOrdersHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const type = (searchParams.get("type") || "kdo").toLowerCase();
  const activeTab = TABS.find(t => t.id === type) || TABS[0];

  const setTab = (id) => {
    setSearchParams({ type: id }, { replace: true });
  };

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="daily-orders-hub">
      <PageHeader
        icon={ClipboardList}
        title="Daily Orders"
        subtitle="Permintaan harian per station — Kitchen (KDO), Bar (BDO), Floor (FDO)."
        className="mb-0 md:mb-0"
      />

      {/* Station tabs (URL ?type=kdo|bdo|fdo) */}
      <Tabs value={activeTab.id} onValueChange={setTab}>
        <TabsList aria-label="Station" data-testid="daily-orders-tabs">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <TabsTrigger key={t.id} value={t.id} data-testid={`tab-${t.id}`}>
                <Icon /> {t.name}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Active tab content */}
      <div data-testid={`daily-orders-content-${activeTab.id}`}>
        {activeTab.id === "fdo" ? (
          <FdoPage />
        ) : (
          <KdoBdoList key={activeTab.id} kind={activeTab.id} />
        )}
      </div>
    </div>
  );
}
