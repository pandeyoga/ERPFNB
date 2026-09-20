/** HR Portal shell — Navigation Restructuring: PortalSubNav removed, AppShell Sidebar+Subnav handles navigation.
 *
 * PART Q Phase 2 (2026-07-18): defense-in-depth route-level RBAC via `Gate`.
 * SUPER_ADMIN always passes. Non-sensitive shell pages remain accessible to any
 * user with the portal prefix (`hr.*`) — those are gated by App.js. */
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { makeGate } from "@/lib/portalGate";
import HRHome from "./hr/HRHome";
import AdvancesList from "./hr/AdvancesList";
import FOCList from "./hr/FOCList";
import IncentiveList from "./hr/IncentiveList";
import LBFundLedger from "./hr/LBFundLedger";
import PayrollList from "./hr/PayrollList";
import ServiceChargeList from "./hr/ServiceChargeList";
import VoucherList from "./hr/VoucherList";
import LeaveRequests from "./hr/LeaveRequests";
import ApprovalCenter from "./shared/ApprovalCenter";
import JobApplications from "./hr/JobApplications";
import JobListings from "./hr/JobListings";
import CompensationHub from "./hr/CompensationHub";

export default function HRPortal() {
  const { user } = useAuth();
  if (!user) return null;
  const g = makeGate(user);
  return (
    <div data-testid="hr-portal">
      <Routes>
        <Route index element={<HRHome />} />
        <Route path="compensation" element={g(["hr.incentive", "hr.service_charge", "hr.voucher", "hr.foc", "hr.lb_fund", "hr.read", "hr.write"], <CompensationHub />)} />
        <Route path="advances" element={g("hr.advance", <AdvancesList />)} />
        <Route path="service-charge" element={g("hr.service_charge", <ServiceChargeList />)} />
        <Route path="incentive" element={g("hr.incentive", <IncentiveList />)} />
        <Route path="voucher" element={g("hr.voucher", <VoucherList />)} />
        <Route path="foc" element={g("hr.foc", <FOCList />)} />
        <Route path="lb-fund" element={g("hr.lb_fund", <LBFundLedger />)} />
        <Route path="payroll" element={g(["hr.read", "hr.write"], <PayrollList />)} />
        {/* Leaves: any authenticated user may see/manage their OWN leaves; deep
            data access is server-enforced by _assert_can_view_employee_leave. */}
        <Route path="leaves" element={<LeaveRequests />} />
        <Route path="approvals" element={<ApprovalCenter />} />
        <Route path="job-applications" element={g(["hr.read", "hr.write"], <JobApplications />)} />
        <Route path="job-listings" element={g(["hr.read", "hr.write"], <JobListings />)} />
        <Route path="*" element={<Navigate to="/hr" replace />} />
      </Routes>
    </div>
  );
}
