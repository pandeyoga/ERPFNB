/** StockMovementsHub — Phase D UX consolidation 2026-05-26.
 *
 * Single page for inventory stock movements. Previously these were 3 separate
 * sidebar items:
 *   - Movement History
 *   - Transfers
 *   - Adjustments
 *
 * All 3 are conceptually "stock moving from one place/state to another", so
 * they belong in one hub with tabs. Old routes still work (redirects).
 *
 * URL: /inventory/movements-hub?type=history|transfers|adjustments
 */
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { History, ArrowLeftRight, Edit3 } from "lucide-react";
import { cn } from "@/lib/utils";
import Movements from "./Movements";
import TransferList from "./TransferList";
import AdjustmentList from "./AdjustmentList";

const TABS = [
  { id: "history",     name: "Riwayat",    icon: History,        desc: "Semua pergerakan stock" },
  { id: "transfers",   name: "Transfer",   icon: ArrowLeftRight, desc: "Antar outlet / lokasi" },
  { id: "adjustments", name: "Adjustment", icon: Edit3,          desc: "Penyesuaian stock manual" },
];

export default function StockMovementsHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const type = (searchParams.get("type") || "history").toLowerCase();
  const activeTab = TABS.find(t => t.id === type) || TABS[0];

  const setTab = (id) => setSearchParams({ type: id }, { replace: true });

  return (
    <div className="space-y-4" data-testid="stock-movements-hub">
      <div className="glass-card overflow-hidden">
        <div className="px-5 pt-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl grad-aurora-soft flex items-center justify-center">
              <activeTab.icon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold leading-tight">Stock Movements</h2>
              <p className="text-xs text-muted-foreground">{activeTab.desc}</p>
            </div>
          </div>
        </div>
        <div
          className="flex items-center gap-1 px-5 pt-4 border-b border-border/40 -mb-px overflow-x-auto"
          data-testid="movements-tabs"
          role="tablist"
        >
          {TABS.map(t => {
            const isActive = t.id === activeTab.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap",
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                data-testid={`mov-tab-${t.id}`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t.name}</span>
                {isActive && (
                  <motion.div
                    layoutId="movements-tab-underline"
                    className="absolute inset-x-0 -bottom-px h-0.5 bg-foreground"
                    transition={{ type: "spring", duration: 0.4 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div data-testid={`movements-content-${activeTab.id}`}>
        {activeTab.id === "history" && <Movements />}
        {activeTab.id === "transfers" && <TransferList />}
        {activeTab.id === "adjustments" && <AdjustmentList />}
      </div>
    </div>
  );
}
