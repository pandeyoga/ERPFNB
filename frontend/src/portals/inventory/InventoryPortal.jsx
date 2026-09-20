/** Inventory Portal shell — Navigation Restructuring: PortalSubNav removed, AppShell Sidebar+Subnav handles navigation.
 *
 * PART Q Phase 2 (2026-07-18): defense-in-depth route-level RBAC via `Gate`. */
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { makeGate } from "@/lib/portalGate";
import InventoryHome from "./InventoryHome";
import StockBalance from "./StockBalance";
import Movements from "./Movements";
import StockMovementsHub from "./StockMovementsHub";
import TransferList from "./TransferList";
import TransferDetail from "./TransferDetail";
import AdjustmentList from "./AdjustmentList";
import OpnameList from "./OpnameList";
import OpnameSession from "./OpnameSession";
import Valuation from "./Valuation";
import LowStockAlert from "./LowStockAlert";
import MarketListPage from "./MarketListPage";

export default function InventoryPortal() {
  const { user } = useAuth();
  if (!user) return null;
  const g = makeGate(user);
  return (
    <div data-testid="inventory-portal">
      <Routes>
        <Route index element={<InventoryHome />} />
      <Route path="balance" element={g(["inventory.balance.read", "inventory.view"], <StockBalance />)} />
      <Route path="low-stock" element={g(["inventory.balance.read", "inventory.view"], <LowStockAlert />)} />
      <Route path="movements-hub" element={g(["inventory.movement.read", "inventory.view"], <StockMovementsHub />)} />
      <Route path="movements" element={<Navigate to="/inventory/movements-hub?type=history" replace />} />
      <Route path="transfers" element={g("inventory.transfer", <TransferList />)} />
      <Route path="transfers/:id" element={g("inventory.transfer", <TransferDetail />)} />
      <Route path="adjustments" element={g("inventory.adjustment", <AdjustmentList />)} />
      <Route path="opname" element={g("inventory.opname", <OpnameList />)} />
      <Route path="opname/:id" element={g("inventory.opname", <OpnameSession />)} />
      <Route path="valuation" element={g("inventory.valuation.read", <Valuation />)} />
      <Route path="market-list" element={g(["procurement.market_list.manage", "inventory.view"], <MarketListPage />)} />
      <Route path="*" element={<Navigate to="/inventory" replace />} />
      </Routes>
    </div>
  );
}
