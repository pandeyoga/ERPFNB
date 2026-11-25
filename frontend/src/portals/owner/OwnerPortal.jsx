/** Owner Portal shell — Navigation Restructuring: PortalSubNav removed, AppShell Sidebar+Subnav handles navigation.
 *
 * PART Q Phase 2 (2026-07-18): defense-in-depth route-level RBAC via `Gate`.
 * Owner-only surfaces (cockpit, digest settings) gate on `owner.cockpit.access` /
 * `owner.digest.manage`. Approvals → Pusat Persetujuan; AI assistant → /executive/ai-qa (satu halaman Q&A). */
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { makeGate } from "@/lib/portalGate";
import OwnerCockpit from "./OwnerCockpit";
import DailyBriefing from "./DailyBriefing";
import DigestSettings from "./DigestSettings";
import CashPosition from "@/portals/finance/CashPosition";
import LegacyRedirect from "@/components/shared/LegacyRedirect";

export default function OwnerPortal() {
  const { user } = useAuth();
  if (!user) return null;
  const g = makeGate(user);
  return (
    <div data-testid="owner-portal">
      <Routes>
        {/* Satu URL untuk cockpit: index di-gate sama seperti /owner/cockpit sebelumnya
            (sebelumnya index terbuka, cockpit di-gate → RBAC tidak konsisten). */}
        <Route index element={g("owner.cockpit.access", <OwnerCockpit />)} />
      <Route path="cockpit" element={<Navigate to="/owner" replace />} />
      <Route path="briefing" element={g("owner.cockpit.access", <DailyBriefing />)} />
      <Route path="cash" element={g(["finance.cash.read", "owner.cockpit.access"], <CashPosition />)} />
      <Route path="approvals" element={<Navigate to="/my-approvals" replace />} />
      {/* Satu halaman Q&A AI untuk seluruh aplikasi (EXE-QA-03). */}
      <Route path="ai-assistant" element={<LegacyRedirect to="/executive/ai-qa" />} />
      <Route path="digest-settings" element={g("owner.digest.manage", <DigestSettings />)} />
      <Route path="*" element={<Navigate to="/owner" replace />} />
      </Routes>
    </div>
  );
}
