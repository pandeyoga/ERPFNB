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
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChefHat, Wine, Utensils } from "lucide-react";
import { cn } from "@/lib/utils";
import KdoBdoList from "./KdoBdoList";
import FdoPage from "./FdoPage";

const TABS = [
  { id: "kdo", name: "Kitchen",  full: "KDO — Kitchen Daily Order", icon: ChefHat,  desc: "Permintaan bahan dapur harian" },
  { id: "bdo", name: "Bar",      full: "BDO — Bar Daily Order",     icon: Wine,     desc: "Permintaan bahan bar harian" },
  { id: "fdo", name: "Floor",    full: "FDO — Floor Daily Order",   icon: Utensils, desc: "Permintaan floor/service harian" },
];

export default function DailyOrdersHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const type = (searchParams.get("type") || "kdo").toLowerCase();
  const activeTab = TABS.find(t => t.id === type) || TABS[0];

  const setTab = (id) => {
    setSearchParams({ type: id }, { replace: true });
  };

  return (
    <div className="space-y-4" data-testid="daily-orders-hub">
      {/* Hub header + tabs */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 pt-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl grad-aurora-soft flex items-center justify-center">
              <activeTab.icon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold leading-tight">Daily Orders</h2>
              <p className="text-xs text-muted-foreground">
                Permintaan harian per station — Kitchen / Bar / Floor
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div
          className="flex items-center gap-1 px-5 pt-4 border-b border-border/40 -mb-px overflow-x-auto"
          data-testid="daily-orders-tabs"
          role="tablist"
          aria-label="Station"
        >
          {TABS.map((t) => {
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
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                data-testid={`tab-${t.id}`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t.name}</span>
                {isActive && (
                  <motion.div
                    layoutId="daily-orders-tab-underline"
                    className="absolute inset-x-0 -bottom-px h-0.5 bg-foreground"
                    transition={{ type: "spring", duration: 0.4 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active tab content */}
      <div data-testid={`daily-orders-content-${activeTab.id}`}>
        {activeTab.id === "fdo" ? (
          <FdoPage />
        ) : (
          <KdoBdoList kind={activeTab.id} />
        )}
      </div>
    </div>
  );
}
