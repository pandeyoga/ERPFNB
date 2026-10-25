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
import { Sparkles } from "lucide-react";
import CashPosition from "@/portals/finance/CashPosition";
import ConversationalQA from "@/components/shared/ConversationalQA";
import PageHeader from "@/components/shared/PageHeader";

/** /owner/ai-assistant — Business Q&A. ConversationalQA sudah ber-surface glass-card,
 *  jadi tidak dibungkus kartu lagi (hindari card-in-card). */
function OwnerBusinessQA() {
  return (
    <div className="space-y-3 lg:space-y-4" data-testid="owner-ai-assistant-page">
      <PageHeader
        icon={Sparkles}
        title="Business Q&A"
        subtitle="Tanya kondisi bisnis & keuangan group lewat teks atau suara — dijawab dalam Bahasa Indonesia."
        className="mb-0 md:mb-0"
      />
      <ConversationalQA scopeLabel="Owner" />
    </div>
  );
}

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
      <Route path="ai-assistant" element={<OwnerBusinessQA />} />
      <Route path="digest-settings" element={g("owner.digest.manage", <DigestSettings />)} />
      <Route path="*" element={<Navigate to="/owner" replace />} />
      </Routes>
    </div>
  );
}
