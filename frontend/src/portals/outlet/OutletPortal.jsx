/** Outlet Portal shell — adds ApprovalCenter (outlet-scoped, Sprint B).
 *
 * PART Q Phase 2 (2026-07-18): defense-in-depth route-level RBAC via `Gate`.
 * Non-sensitive shell/hub/CRM pages remain open to anyone with `outlet.*`; sensitive
 * write flows (daily-close, daily-sales, KDO/BDO/FDO create, petty cash) are gated. */
import { Routes, Route, Navigate } from "react-router-dom";
import { Wand2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { makeGate } from "@/lib/portalGate";
import OutletHome from "./OutletHome";
import DailySalesList from "./DailySalesList";
import DailySalesForm from "./DailySalesForm";
import DailySalesDetail from "./DailySalesDetail";
import PettyCashList from "./PettyCashList";
import UrgentPurchaseList from "./UrgentPurchaseList";
import KdoPage from "./KdoPage";
import BdoPage from "./BdoPage";
import FdoPage from "./FdoPage";
import DailyOrdersHub from "./DailyOrdersHub";
import DailyClose from "./DailyClose";
import StockCheck from "./inventory/StockCheck";
import StockTransfers from "./inventory/StockTransfers";
import UsageLog from "./inventory/UsageLog";
import VoucherRedemption from "./VoucherRedemption";
import LoyaltyPointsEntry from "./LoyaltyPointsEntry";
import ReservationList from "./ReservationList";
import ReservationForm from "./ReservationForm";
import CRMHub from "./CRMHub";
import EndOfDayWorkflow from "./EndOfDayWorkflow";
import OutletBudgetTracker from "./OutletBudgetTracker";
import ApprovalCenter from "../shared/ApprovalCenter";
import ComingSoonPage from "@/components/shared/ComingSoonPage";
import { OutletScopeProvider } from "./OutletScopeContext";
import OutletScopeHeader from "./OutletScopeHeader";

// Outlet manager hanya lihat approval lokal: PR (urgent purchase), stock adj/transfer, payment req
const OUTLET_TYPES = [
  "purchase_request",
  "stock_adjustment",
  "stock_transfer",
  "payment_request",
];

export default function OutletPortal() {
  const { user } = useAuth();
  if (!user) return null;
  const g = makeGate(user);
  return (
    <OutletScopeProvider>
      <div data-testid="outlet-portal">
        <OutletScopeHeader />
        <Routes>
        <Route index element={<OutletHome />} />
        <Route path="crm" element={<CRMHub />} />
        <Route path="daily-sales" element={g("outlet.daily_sales.read", <DailySalesList />)} />
        <Route path="daily-sales/new" element={g("outlet.daily_sales.read", <DailySalesForm />)} />
        <Route path="daily-sales/:id" element={g("outlet.daily_sales.read", <DailySalesDetail />)} />
        <Route path="daily-sales/:id/edit" element={g("outlet.daily_sales.read", <DailySalesForm />)} />
        {/* Consolidated 2026-06: Sales Wizard merged into the full Daily Sales entry. */}
        <Route path="sales-wizard" element={<Navigate to="/outlet/daily-sales/new" replace />} />
        <Route path="petty-cash" element={g(["finance.cash.update", "finance.cash.read", "outlet.daily_close.execute"], <PettyCashList />)} />
        <Route path="daily-orders" element={g(["outlet.kdo.create", "outlet.bdo.create", "outlet.fdo.create"], <DailyOrdersHub />)} />
        <Route path="kdo" element={<Navigate to="/outlet/daily-orders?type=kdo" replace />} />
        <Route path="bdo" element={<Navigate to="/outlet/daily-orders?type=bdo" replace />} />
        <Route path="fdo" element={<Navigate to="/outlet/daily-orders?type=fdo" replace />} />
        <Route path="urgent-purchase" element={g("procurement.pr.create", <UrgentPurchaseList />)} />
        <Route path="daily-close" element={g("outlet.daily_close.execute", <DailyClose />)} />
        <Route path="end-of-day" element={g("outlet.daily_close.execute", <EndOfDayWorkflow />)} />
        <Route path="opname" element={<Navigate to="/inventory/opname" replace />} />
        <Route path="inventory/stock-check" element={g(["inventory.balance.read", "inventory.view"], <StockCheck />)} />
        <Route path="inventory/transfers" element={g("inventory.transfer", <StockTransfers />)} />
        <Route path="inventory/usage" element={g(["inventory.movement.read", "inventory.view"], <UsageLog />)} />
        <Route path="voucher-redeem" element={<VoucherRedemption />} />
        <Route path="loyalty/input-poin" element={<LoyaltyPointsEntry />} />
        <Route path="reservations" element={<ReservationList />} />
        <Route path="reservations/new" element={<ReservationForm />} />
        <Route path="reservations/:id/edit" element={<ReservationForm />} />
        {/* Phase 14 — Outlet Operational Budget tracker */}
        <Route path="budget" element={<OutletBudgetTracker />} />
        <Route
          path="approvals"
          element={
            <ApprovalCenter
              restrictedTypes={OUTLET_TYPES}
              outletOnly
              title="Outlet Approval Center"
              subtitle="Antrian persetujuan untuk outlet kamu"
            />
          }
        />
        <Route path="*" element={<Navigate to="/outlet" replace />} />
        </Routes>
      </div>
    </OutletScopeProvider>
  );
}
