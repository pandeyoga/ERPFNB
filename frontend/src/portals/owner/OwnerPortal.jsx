/** Owner Portal shell — Navigation Restructuring: PortalSubNav removed, AppShell Sidebar+Subnav handles navigation.
 *
 * PART Q Phase 2 (2026-07-18): defense-in-depth route-level RBAC via `Gate`.
 * Owner-only surfaces (cockpit, digest settings) gate on `owner.cockpit.access` /
 * `owner.digest.manage`. Approvals + AI assistant stay open (any user with portal
 * prefix or already routed here). */
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { makeGate } from "@/lib/portalGate";
import OwnerCockpit from "./OwnerCockpit";
import DailyBriefing from "./DailyBriefing";
import DigestSettings from "./DigestSettings";
import CashPosition from "@/portals/finance/CashPosition";
import MyApprovals from "@/pages/MyApprovals";
import ConversationalQA from "@/components/shared/ConversationalQA";

export default function OwnerPortal() {
  const { user } = useAuth();
  if (!user) return null;
  const g = makeGate(user);
  return (
    <div data-testid="owner-portal">
      <Routes>
        <Route index element={<OwnerCockpit />} />
      <Route path="cockpit" element={g("owner.cockpit.access", <OwnerCockpit />)} />
      <Route path="briefing" element={g("owner.cockpit.access", <DailyBriefing />)} />
      <Route path="cash" element={g(["finance.cash.read", "owner.cockpit.access"], <CashPosition />)} />
      <Route path="approvals" element={<MyApprovals />} />
      <Route path="ai-assistant" element={
        <div className="glass-card p-5">
          <ConversationalQA scopeLabel="Owner" />
        </div>
      } />
      <Route path="digest-settings" element={g("owner.digest.manage", <DigestSettings />)} />
      <Route path="*" element={<Navigate to="/owner" replace />} />
      </Routes>
    </div>
  );
}
