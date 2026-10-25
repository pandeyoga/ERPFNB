/** MasterDataHub — Phase D UX consolidation 2026-05-26.
 *
 * Single tabbed page that hosts all master-data entities (Items, Vendors,
 * Employees, Outlets, Brands, Categories, COA, Payment Methods, Bank Accounts,
 * Tax Codes). Tabs navigate to the existing `/admin/master/:entity` routes so
 * deep links keep working; the MasterData component renders the body.
 *
 * UI pass: header bespoke + tab garis-bawah (10 tab meluap di 1280px) diganti
 * PageHeader (di MasterData) + Tabs standar tanpa ikon sehingga semua tab muat.
 *
 * Default tab when visiting /admin/master-data → redirect to /admin/master/items.
 */
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MasterData from "./MasterData";

const TABS = [
  { entity: "items",             name: "Items" },
  { entity: "vendors",           name: "Vendors" },
  { entity: "employees",         name: "Employees" },
  { entity: "outlets",           name: "Outlets" },
  { entity: "brands",            name: "Brands" },
  { entity: "categories",        name: "Categories" },
  { entity: "chart-of-accounts", name: "COA", title: "Chart of Accounts" },
  { entity: "payment-methods",   name: "Payment methods" },
  { entity: "bank-accounts",     name: "Bank accounts" },
  { entity: "tax-codes",         name: "Tax codes" },
];

export default function MasterDataHub() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  // Parse current entity from /admin/master/<entity>
  const m = path.match(/^\/admin\/master\/([^/?]+)/);
  const activeEntity = m ? m[1] : null;

  if (!activeEntity) {
    return <Navigate to="/admin/master/items" replace />;
  }

  const tabs = (
    <Tabs value={activeEntity} onValueChange={(v) => navigate(`/admin/master/${v}`)}>
      <TabsList data-testid="master-data-tabs">
        {TABS.map((t) => (
          <TabsTrigger key={t.entity} value={t.entity} title={t.title} data-testid={`md-tab-${t.entity}`}>
            {t.name}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );

  return (
    <div data-testid="master-data-hub">
      <MasterData hideEntityTabs tabs={tabs} />
    </div>
  );
}
