/**
 * ExecutivePortal — Phase 9A + v0.3.5 Budget Approvals multi-route shell.
 *
 * Routes:
 *   /executive             → OwnerHome (Sprint E16 — owner-focused dashboard)
 *   /executive/analytics   → ExecutiveHome (full analytics dashboard)
 *   /executive/brand/:id   → BrandDrilldown
 *   /executive/outlet/:id  → OutletDrilldown
 *   /executive/budget-approvals → BudgetApprovals
 *   /executive/approvals   → ApprovalCenter (Tier-3 / high amount only)
 *
 * PART Q Phase 2 (2026-07-18): defense-in-depth route-level RBAC via `Gate`.
 * Budget approvals + budget increase requests are gated by `executive.budget.approve`
 * to prevent partial-executive roles from reaching the write surface.
 */
import { Routes, Route, Navigate } from "react-router-dom";
import { Brain, AlertTriangle, BarChart3 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { makeGate } from "@/lib/portalGate";
import OwnerHome from "./OwnerHome";
import ExecutiveHome from "./ExecutiveHome";
import BrandDrilldown from "./BrandDrilldown";
import OutletDrilldown from "./OutletDrilldown";
import ProfitWalk from "./ProfitWalk";
import PeriodCompare from "./PeriodCompare";
import ReservationSummary from "./ReservationSummary";
import BudgetApprovals from "./BudgetApprovals";
import BrandMixOverview from "./BrandMixOverview";
import ExecutiveAnalyticsHub from "./ExecutiveAnalyticsHub";
import ExecutiveQA from "./ExecutiveQA";
import AnomalyDetection from "./AnomalyDetection";
import OutletBudgetAllocation from "./OutletBudgetAllocation";
import OutletBudgetMonitor from "./OutletBudgetMonitor";
import BudgetIncreaseRequests from "./BudgetIncreaseRequests";
import ApprovalCenter from "../shared/ApprovalCenter";
import ComingSoonPage from "@/components/shared/ComingSoonPage";

// Executive only sees high-tier approvals (>= Rp 50jt) across all entity types.
const EXEC_MIN_AMOUNT = 50_000_000;

export default function ExecutivePortal() {
  const { user } = useAuth();
  if (!user) return null;
  const g = makeGate(user);
  return (
    <div data-testid="executive-portal">
      <Routes>
        {/* Sprint E16: OwnerHome replaces ExecutiveHome as landing page */}
        <Route index element={<OwnerHome />} />
      {/* Full analytics dashboard (previously the index) */}
      <Route path="analytics" element={<ExecutiveHome />} />
      <Route path="brand/:brandId" element={<BrandDrilldown />} />
      <Route path="outlet/:outletId" element={<OutletDrilldown />} />
      <Route path="profit-walk" element={<ProfitWalk />} />
      <Route path="period-compare" element={<PeriodCompare />} />
      <Route path="reservations" element={<ReservationSummary />} />
      <Route path="budget-approvals" element={g("executive.budget.approve", <BudgetApprovals />)} />

      {/* Phase 14 — Outlet Operational Budget (KDO/FDO/BDO cost control) */}
      <Route path="outlet-budgets" element={g(["executive.budget.approve", "executive.dashboard.read"], <OutletBudgetAllocation />)} />
      <Route path="budget-monitor" element={g(["executive.budget.approve", "executive.dashboard.read"], <OutletBudgetMonitor />)} />
      <Route path="budget-increase-requests" element={g("executive.budget.approve", <BudgetIncreaseRequests />)} />

      {/* Real pages: AI Q&A, Anomaly Detection, Brand Mix overview */}
      <Route path="ai-qa" element={<ExecutiveQA />} />
      <Route path="anomaly" element={<AnomalyDetection />} />
      <Route path="brand" element={<BrandMixOverview />} />
      {/* Phase 2g — unified Performance Analytics hub (Brand Mix + Profit Walk + Period Compare) */}
      <Route path="analytics-hub" element={<ExecutiveAnalyticsHub />} />

      <Route
        path="approvals"
        element={
          <ApprovalCenter
            minAmount={EXEC_MIN_AMOUNT}
            title="Executive Approval Center"
            subtitle="Approval bernilai tinggi yang menunggu keputusan eksekutif"
          />
        }
      />
      <Route path="*" element={<Navigate to="/executive" replace />} />
      </Routes>
    </div>
  );
}
