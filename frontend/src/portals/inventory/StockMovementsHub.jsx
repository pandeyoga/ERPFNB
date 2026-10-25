/** StockMovementsHub — Phase D UX consolidation 2026-05-26.
 *
 * Single page for inventory stock movements. Previously these were 3 separate
 * sidebar items:
 *   - Movement History
 *   - Transfers
 *   - Adjustments
 *
 * All 3 are conceptually "stock moving from one place/state to another", so
 * they belong in one hub with tabs. Old routes still work (/inventory/movements
 * redirects here; /inventory/transfers & /inventory/adjustments render the same
 * list stand-alone).
 *
 * URL: /inventory/movements-hub?type=history|transfers|adjustments
 */
import { Link, useSearchParams } from "react-router-dom";
import { History, ArrowLeftRight, Edit3, FileSpreadsheet } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { permitted, useVisibleTabs } from "@/lib/portalGate";
import { REPORT_CENTER_PERMS } from "@/lib/portals";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/shared/PageHeader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Movements from "./Movements";
import TransferList from "./TransferList";
import AdjustmentList from "./AdjustmentList";

// perm = izin route lama tab tersebut (route lama kini redirect ke tab ini)
const TABS = [
  { id: "history",     name: "Riwayat",    icon: History,        desc: "Semua pergerakan stok masuk & keluar per outlet.", perm: ["inventory.movement.read", "inventory.view"] },
  { id: "transfers",   name: "Transfer",   icon: ArrowLeftRight, desc: "Transfer stok antar outlet / lokasi.", perm: "inventory.transfer" },
  { id: "adjustments", name: "Adjustment", icon: Edit3,          desc: "Penyesuaian stok manual (waste, rusak, koreksi).", perm: "inventory.adjustment" },
];

export default function StockMovementsHub() {
  const tabs = useVisibleTabs(TABS);
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const type = (searchParams.get("type") || "history").toLowerCase();
  const activeTab = tabs.find(t => t.id === type) || tabs[0];

  const setTab = (id) => setSearchParams({ type: id }, { replace: true });

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="stock-movements-hub">
      <PageHeader
        icon={activeTab.icon}
        title="Stock Movements"
        subtitle={activeTab.desc}
        className="mb-0 md:mb-0"
        actions={activeTab.id === "history" && permitted(user, REPORT_CENTER_PERMS) ? (
          // Ekspor Excel riwayat pergerakan ada di Report Center (/reports/stock-movement).
          <Button asChild variant="outline" data-testid="mov-export-link">
            <Link to="/reports/stock-movement"><FileSpreadsheet /> Ekspor Excel</Link>
          </Button>
        ) : null}
      />

      <Tabs value={activeTab.id} onValueChange={setTab}>
        <TabsList data-testid="movements-tabs" aria-label="Jenis pergerakan stok">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <TabsTrigger key={t.id} value={t.id} data-testid={`mov-tab-${t.id}`}>
                <Icon /> {t.name}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      <div data-testid={`movements-content-${activeTab.id}`}>
        {activeTab.id === "history" && <Movements />}
        {activeTab.id === "transfers" && <TransferList embedded />}
        {activeTab.id === "adjustments" && <AdjustmentList embedded />}
      </div>
    </div>
  );
}
