/** Procurement Portal shell. Approval PR/PO ada di Pusat Persetujuan (/my-approvals).
 *
 * PART Q Phase 2 (2026-07-18): defense-in-depth route-level RBAC via `Gate`. */
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { makeGate } from "@/lib/portalGate";
import LegacyRedirect from "@/components/shared/LegacyRedirect";
import ProcurementHome from "./ProcurementHome";
import KanbanWorkboard from "./KanbanWorkboard";
import VendorComparison from "./VendorComparison";
import PRList from "./PRList";
import PRForm from "./PRForm";
import PRDetail from "./PRDetail";
import POList from "./POList";
import POForm from "./POForm";
import PODetail from "./PODetail";
import GRList from "./GRList";
import GRForm from "./GRForm";
import VendorRecommendPage from "./VendorRecommendPage";
import RFQList from "./RFQList";
import RFQDetail, { RFQForm } from "./RFQDetail";
import PriceIntelligence from "./PriceIntelligence";
import VendorCatalog from "./VendorCatalog";
import PRConsolidation from "./PRConsolidation";
import AllVendors from "./AllVendors";
import VendorScorecardList from "./VendorScorecardList";

export default function ProcurementPortal() {
  const { user } = useAuth();
  if (!user) return null;
  const g = makeGate(user);
  return (
    <div data-testid="procurement-portal">
      <Routes>
        <Route index element={<ProcurementHome />} />
      <Route path="kanban" element={g(["procurement.view", "procurement.pr", "procurement.po"], <KanbanWorkboard />)} />
      {/* Gate = gabungan izin tab (Per item / Per PO). */}
      <Route path="vendor-comparison" element={g(["procurement.view", "procurement.vendor.read", "procurement.po"], <VendorComparison />)} />
      <Route path="vendor-recommend" element={g(["procurement.view", "procurement.vendor.read"], <VendorRecommendPage />)} />
      <Route path="price-intelligence" element={g(["procurement.view", "procurement.vendor.read"], <PriceIntelligence />)} />
      <Route path="vendor-catalog" element={g(["procurement.view", "procurement.vendor.read"], <VendorCatalog />)} />
      <Route path="rfq" element={g("procurement.rfq", <RFQList />)} />
      <Route path="rfq/new" element={g("procurement.rfq.create", <RFQForm />)} />
      <Route path="rfq/:id" element={g("procurement.rfq", <RFQDetail />)} />
      <Route path="pr" element={g("procurement.pr", <PRList />)} />
      <Route path="pr/new" element={g("procurement.pr.create", <PRForm />)} />
      <Route path="pr/:id" element={g("procurement.pr", <PRDetail />)} />
      <Route path="po" element={g("procurement.po", <POList />)} />
      <Route path="po/new" element={g("procurement.po.create", <POForm />)} />
      <Route path="po/:id" element={g("procurement.po", <PODetail />)} />
      <Route path="gr" element={g("procurement.gr", <GRList />)} />
      <Route path="gr/new" element={g("procurement.gr.create", <GRForm />)} />

      {/* Real pages: Consolidation, PO Comparison, Vendors, Scorecard */}
      <Route path="consolidation" element={g("procurement.pr", <PRConsolidation />)} />
      <Route path="po-comparison" element={<LegacyRedirect to="/procurement/vendor-comparison?tab=po" />} />
      <Route path="vendors" element={g(["procurement.view", "procurement.vendor.read"], <AllVendors />)} />
      <Route path="vendor-scorecard" element={g(["procurement.view", "procurement.vendor.read"], <VendorScorecardList />)} />

      <Route path="*" element={<Navigate to="/procurement" replace />} />
      </Routes>
    </div>
  );
}
