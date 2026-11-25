/** AssistantPanel — tombol "Asisten AI" di TopNav + panel samping (Sheet) yang tersedia di semua halaman.
 *
 * Tampil hanya untuk pengguna dengan izin `ai.agent.use`. State percakapan berada di luar Sheet sehingga tetap
 * berjalan (polling) saat panel ditutup / pindah halaman; sesi terakhir disimpan per pengguna. Konteks halaman &
 * brand/toko TopNav dikirim otomatis bersama pesan. Komponen lain bisa membuka panel lewat event "aurora-open-ai".
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, Plus, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import api, { unwrap } from "@/lib/api";
import { canOpenPath } from "@/lib/unifiedNav";
import AgentChat from "./AgentChat";
import { useAgentChat } from "./useAgentChat";

export const AI_UNAVAILABLE_REASONS = {
  ai_disabled_env: "AI dimatikan di server (FEATURE_AI_ENABLED).",
  ai_disabled_policy: "AI sedang dimatikan oleh admin (Asisten AI → Pemakaian & Pengaturan).",
  no_api_key: "Kunci API Claude belum diisi (Admin → Integrations → AI (Claude)).",
};

const keyOf = (user) => `aurora_ai_panel_session_${user?.id || "anon"}`;
function readSaved(user) {
  try { return localStorage.getItem(keyOf(user)) || null; } catch { return null; }
}

function Panel({ user }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(null);
  const chat = useAgentChat(readSaved(user));

  // Komponen lain bisa membuka panel; {detail: {prompt, attachmentIds?}} → percakapan baru langsung dengan pertanyaan itu
  useEffect(() => {
    const onOpen = (e) => {
      setOpen(true);
      const prompt = e?.detail?.prompt;
      if (prompt && !chat.busy) {
        chat.send({ message: prompt, fresh: true, attachmentIds: e.detail.attachmentIds || [],
          context: { path: window.location.pathname + window.location.search, title: document.title } });
      }
    };
    window.addEventListener("aurora-open-ai", onOpen);
    return () => window.removeEventListener("aurora-open-ai", onOpen);
  }, [chat]);
  useEffect(() => {
    if (!open) return;
    api.get("/ai/status", { scope: false }).then((r) => setStatus(unwrap(r))).catch(() => setStatus(null));
  }, [open]);
  useEffect(() => {
    try { if (chat.sessionId) localStorage.setItem(keyOf(user), chat.sessionId); } catch { /* storage tidak tersedia */ }
  }, [chat.sessionId, user]);

  const reset = () => {
    try { localStorage.removeItem(keyOf(user)); } catch { /* abaikan */ }
    chat.open(null);
  };

  return (
    <>
      {/* Layar sempit: TopNav penuh → panel lewat menu "Asisten AI" (halaman layar penuh) */}
      <div className="hidden sm:flex">
        <Button size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label="Buka Asisten AI" title="Asisten AI" data-testid="open-ai-assistant">
          <Bot className="h-4 w-4" />
        </Button>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[480px] p-0 gap-0 flex flex-col" data-testid="ai-panel">
          <div className="flex items-center gap-2 px-4 pt-4 pb-3 pr-12 border-b border-border">
            <span className="h-8 w-8 rounded-lg grad-aurora flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 text-white" />
            </span>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base leading-tight">Asisten AI</SheetTitle>
              <SheetDescription className="text-xs truncate">{chat.session?.title || "Percakapan baru"}</SheetDescription>
            </div>
            <Button size="icon-sm" variant="ghost" onClick={reset} disabled={chat.busy} aria-label="Percakapan baru" data-testid="ai-panel-new">
              <Plus className="h-4 w-4" />
            </Button>
            {canOpenPath(user, "/ai") && (
              <Button asChild size="icon-sm" variant="ghost" aria-label="Buka di halaman Asisten AI" data-testid="ai-panel-expand">
                <Link to={chat.sessionId ? `/ai?session=${chat.sessionId}` : "/ai"} onClick={() => setOpen(false)}>
                  <Maximize2 className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
          {status && !status.available ? (
            <div className="p-4 text-sm text-muted-foreground" data-testid="ai-unavailable">
              {AI_UNAVAILABLE_REASONS[status.reason] || "AI tidak tersedia."}
            </div>
          ) : (
            <AgentChat chat={chat} compact onNavigated={() => setOpen(false)} />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

export default function AssistantPanel() {
  const { user, can } = useAuth();
  if (!user || !can("ai.agent.use")) return null;
  return <Panel key={user.id} user={user} />;
}
