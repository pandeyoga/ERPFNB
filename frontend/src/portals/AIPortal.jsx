/** Asisten AI (/ai) — percakapan layar penuh, Dashboard AI (grafik tersemat), persetujuan usulan aksi AI,
 * pemakaian & pengaturan.
 * Panel Asisten AI di TopNav memakai sesi yang sama. Rencana: docs/ai/AGENTIC_AI_PLAN_2026-11-25.md. */
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { makeGate } from "@/lib/portalGate";
import AIChatPage from "@/portals/ai/AIChatPage";
import AIActionsPage from "@/portals/ai/AIActionsPage";
import AISettingsPage from "@/portals/ai/AISettingsPage";
import AIDashboardPage from "@/portals/ai/AIDashboardPage";
import AIImportPage from "@/portals/ai/AIImportPage";
import AIWhatsAppPage from "@/portals/ai/AIWhatsAppPage";

export default function AIPortal() {
  const { user } = useAuth();
  if (!user) return null;
  const g = makeGate(user);
  return (
    // "contents": halaman chat /ai mengisi tinggi layar (flex dari AppShell diteruskan ke halaman)
    <div data-testid="ai-portal" className="contents">
      <Routes>
        <Route index element={g("ai.agent.use", <AIChatPage />)} />
      <Route path="dashboard" element={g("ai.agent.use", <AIDashboardPage />)} />
      <Route path="import" element={g("import.smart.use", <AIImportPage />)} />
      <Route path="whatsapp" element={g("ai.wa.use", <AIWhatsAppPage />)} />
      <Route path="approvals" element={g("ai.agent.use", <AIActionsPage />)} />
      <Route path="settings" element={g("ai.agent.admin", <AISettingsPage />)} />
      <Route path="*" element={<Navigate to="/ai" replace />} />
      </Routes>
    </div>
  );
}
