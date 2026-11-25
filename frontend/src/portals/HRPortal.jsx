/** HR Portal shell — Navigation Restructuring: PortalSubNav removed, AppShell Sidebar+Subnav handles navigation.
 *
 * PART Q Phase 2 (2026-07-18): defense-in-depth route-level RBAC via `Gate`.
 * SUPER_ADMIN always passes. Non-sensitive shell pages remain accessible to any
 * user with the portal prefix (`hr.*`) — those are gated by App.js. */
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { makeGate } from "@/lib/portalGate";
import LegacyRedirect from "@/components/shared/LegacyRedirect";
import HRHome from "./hr/HRHome";
import LeaveRequests from "./hr/LeaveRequests";
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
        <Route path="compensation" element={g(["hr.incentive", "hr.service_charge", "hr.voucher", "hr.foc", "hr.lb_fund", "hr.advance", "hr.read", "hr.write"], <CompensationHub />)} />
        <Route path="advances" element={<LegacyRedirect to="/hr/compensation?tab=advances" />} />
        <Route path="service-charge" element={<LegacyRedirect to="/hr/compensation?tab=service-charge" />} />
        <Route path="incentive" element={<LegacyRedirect to="/hr/compensation?tab=incentive" />} />
        <Route path="voucher" element={<LegacyRedirect to="/hr/compensation?tab=voucher" />} />
        <Route path="foc" element={<LegacyRedirect to="/hr/compensation?tab=foc" />} />
        <Route path="lb-fund" element={<LegacyRedirect to="/hr/compensation?tab=lb-fund" />} />
        <Route path="payroll" element={<LegacyRedirect to="/hr/compensation?tab=payroll" rename={{ tab: "view" }} />} />
        {/* Leaves: any authenticated user may see/manage their OWN leaves; deep
            data access is server-enforced by _assert_can_view_employee_leave. */}
        <Route path="leaves" element={<LeaveRequests />} />
        <Route path="approvals" element={<Navigate to="/my-approvals" replace />} />
        <Route path="job-applications" element={g(["hr.read", "hr.write"], <JobApplications />)} />
        <Route path="job-listings" element={g(["hr.read", "hr.write"], <JobListings />)} />
        <Route path="*" element={<Navigate to="/hr" replace />} />
      </Routes>
    </div>
  );
}
