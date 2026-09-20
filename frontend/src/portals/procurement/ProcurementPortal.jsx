/** Procurement Portal shell — Navigation Restructuring + ApprovalCenter (Sprint B).
 *
 * PART Q Phase 2 (2026-07-18): defense-in-depth route-level RBAC via `Gate`. */
import { Routes, Route, Navigate } from "react-router-dom";
import { ClipboardList, ShoppingCart, Store, Award } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { makeGate } from "@/lib/portalGate";
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
import POComparison from "./POComparison";
import AllVendors from "./AllVendors";
import VendorScorecardList from "./VendorScorecardList";
import ApprovalCenter from "../shared/ApprovalCenter";
import ComingSoonPage from "@/components/shared/ComingSoonPage";

// Procurement portal hanya melihat approval tipe PR & PO
const PROC_TYPES = ["purchase_request", "purchase_order"];

export default function ProcurementPortal() {
  const { user } = useAuth();
  if (!user) return null;
  const g = makeGate(user);
  return (
    <div data-testid="procurement-portal">
      <Routes>
        <Route index element={<ProcurementHome />} />
      <Route path="kanban" element={g(["procurement.view", "procurement.pr", "procurement.po"], <KanbanWorkboard />)} />
      <Route path="vendor-comparison" element={g(["procurement.view", "procurement.vendor.read"], <VendorComparison />)} />
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
      <Route path="po-comparison" element={g("procurement.po", <POComparison />)} />
      <Route path="vendors" element={g(["procurement.view", "procurement.vendor.read"], <AllVendors />)} />
      <Route path="vendor-scorecard" element={g(["procurement.view", "procurement.vendor.read"], <VendorScorecardList />)} />

      <Route
        path="approvals"
        element={
          <ApprovalCenter
            restrictedTypes={PROC_TYPES}
            title="Procurement Approval Center"
            subtitle="Antrian persetujuan PR dan PO"
          />
        }
      />
      <Route path="*" element={<Navigate to="/procurement" replace />} />
      </Routes>
    </div>
  );
}
