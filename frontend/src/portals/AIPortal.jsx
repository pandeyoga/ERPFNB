/** Asisten AI (/ai) — percakapan layar penuh, persetujuan usulan aksi AI, pemakaian & pengaturan.
 * Panel Asisten AI di TopNav memakai sesi yang sama. Rencana: docs/ai/AGENTIC_AI_PLAN_2026-11-25.md. */
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { makeGate } from "@/lib/portalGate";
import AIChatPage from "@/portals/ai/AIChatPage";
import AIActionsPage from "@/portals/ai/AIActionsPage";
import AISettingsPage from "@/portals/ai/AISettingsPage";

export default function AIPortal() {
  const { user } = useAuth();
  if (!user) return null;
  const g = makeGate(user);
  return (
    <div data-testid="ai-portal">
      <Routes>
        <Route index element={g("ai.agent.use", <AIChatPage />)} />
      <Route path="approvals" element={g("ai.agent.use", <AIActionsPage />)} />
      <Route path="settings" element={g("ai.agent.admin", <AISettingsPage />)} />
      <Route path="*" element={<Navigate to="/ai" replace />} />
      </Routes>
    </div>
  );
}
