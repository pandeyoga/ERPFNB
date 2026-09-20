/** MasterDataHub — Phase D UX consolidation 2026-05-26.
 *
 * Single tabbed page that hosts all master-data entities (Items, Vendors,
 * Employees, Outlets, Brands, Payment Methods). Previously these were spread
 * across 2 sidebar sections (Organization + Master Data) = 6 separate items.
 *
 * Implementation: just renders horizontal tabs that link to the existing
 * `/admin/master/:entity` routes (no new component logic). This means deep
 * links still work, and the existing MasterData component is reused.
 *
 * Default tab when visiting /admin/master-data → redirect to /admin/master/items.
 */
import { useLocation, Link, Navigate } from "react-router-dom";
import { Package, Store, Building2, Users, CreditCard, Tag, Hash, Banknote, Receipt, Layers } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import MasterData from "./MasterData";

const TABS = [
  { entity: "items",             name: "Items",          icon: Package },
  { entity: "vendors",           name: "Vendors",        icon: Tag },
  { entity: "employees",         name: "Employees",      icon: Users },
  { entity: "outlets",           name: "Outlets",        icon: Store },
  { entity: "brands",            name: "Brands",         icon: Building2 },
  { entity: "categories",        name: "Categories",     icon: Layers },
  { entity: "chart-of-accounts", name: "COA",            icon: Hash },
  { entity: "payment-methods",   name: "Payment Methods", icon: CreditCard },
  { entity: "bank-accounts",     name: "Bank Accounts",  icon: Banknote },
  { entity: "tax-codes",         name: "Tax Codes",      icon: Receipt },
];

export default function MasterDataHub() {
  const location = useLocation();
  const path = location.pathname;
  // Parse current entity from /admin/master/<entity>
  const m = path.match(/^\/admin\/master\/([^\/?]+)/);
  const activeEntity = m ? m[1] : null;

  if (!activeEntity) {
    return <Navigate to="/admin/master/items" replace />;
  }

  return (
    <div className="space-y-4" data-testid="master-data-hub">
      {/* Tabs */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 pt-4 pb-0 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl grad-aurora-soft flex items-center justify-center">
            <Package className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold leading-tight">Master Data</h2>
            <p className="text-[11px] text-muted-foreground">
              Kelola semua data master dalam satu tempat — Items, Vendors, Outlets, dst.
            </p>
          </div>
        </div>
        <div
          className="flex items-center gap-1 px-3 pt-3 -mb-px overflow-x-auto border-b border-border/40"
          role="tablist"
          data-testid="master-data-tabs"
        >
          {TABS.map(t => {
            const isActive = activeEntity === t.entity;
            const Icon = t.icon;
            return (
              <Link
                key={t.entity}
                to={`/admin/master/${t.entity}`}
                role="tab"
                aria-selected={isActive}
                className={cn(
                  "relative inline-flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                data-testid={`md-tab-${t.entity}`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t.name}</span>
                {isActive && (
                  <motion.div
                    layoutId="master-data-tab-underline"
                    className="absolute inset-x-0 -bottom-px h-0.5 bg-foreground"
                    transition={{ type: "spring", duration: 0.4 }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Body — reuse existing MasterData component (hide its internal entity tabs since we provide our own) */}
      <MasterData hideEntityTabs />
    </div>
  );
}
