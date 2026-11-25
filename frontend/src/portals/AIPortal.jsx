/** Asisten AI (/ai) — percakapan layar penuh, persetujuan usulan aksi, Dashboard AI, dokumen (pustaka laporan & kotak
 * masuk email), Impor Cerdas, kualitas data, monitor & otomasi, WhatsApp, memori & pengetahuan, pemakaian & pengaturan.
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
import AIDataQualityPage from "@/portals/ai/AIDataQualityPage";
import AIKnowledgePage from "@/portals/ai/AIKnowledgePage";
import AIAutomationsPage from "@/portals/ai/AIAutomationsPage";
import AIDocumentsPage from "@/portals/ai/AIDocumentsPage";

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
      <Route path="automations" element={g("ai.agent.automate", <AIAutomationsPage />)} />
      <Route path="documents" element={g("ai.agent.use", <AIDocumentsPage />)} />
      <Route path="knowledge" element={g("ai.agent.use", <AIKnowledgePage />)} />
      <Route path="data-quality" element={g(["admin.master_data.manage", "inventory.view", "procurement.vendor.read"], <AIDataQualityPage />)} />
      <Route path="approvals" element={g("ai.agent.use", <AIActionsPage />)} />
      <Route path="settings" element={g("ai.agent.admin", <AISettingsPage />)} />
      <Route path="*" element={<Navigate to="/ai" replace />} />
      </Routes>
    </div>
  );
}
