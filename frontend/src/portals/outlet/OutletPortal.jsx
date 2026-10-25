/** Outlet Portal shell. Approval outlet ada di Pusat Persetujuan (/my-approvals).
 *
 * PART Q Phase 2 (2026-07-18): defense-in-depth route-level RBAC via `Gate`.
 * Non-sensitive shell/hub/CRM pages remain open to anyone with `outlet.*`; sensitive
 * write flows (daily-close, daily-sales, KDO/BDO/FDO create, petty cash) are gated. */
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { makeGate } from "@/lib/portalGate";
import LegacyRedirect from "@/components/shared/LegacyRedirect";
import OutletHome from "./OutletHome";
import DailySalesList from "./DailySalesList";
import DailySalesForm from "./DailySalesForm";
import DailySalesDetail from "./DailySalesDetail";
import PettyCashList from "./PettyCashList";
import UrgentPurchaseList from "./UrgentPurchaseList";
import DailyOrdersHub from "./DailyOrdersHub";
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
import { OutletScopeProvider } from "./OutletScopeContext";
import OutletScopeHeader from "./OutletScopeHeader";

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
        {/* Deprecated: Daily Close = Langkah 4 di End of Day (komponen yang sama). Rute dipertahankan
            untuk tautan lama; halaman menampilkan banner ke /outlet/end-of-day. */}
        <Route path="daily-close" element={<LegacyRedirect to="/outlet/end-of-day?step=3" />} />
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
        <Route path="*" element={<Navigate to="/outlet" replace />} />
        </Routes>
      </div>
    </OutletScopeProvider>
  );
}
