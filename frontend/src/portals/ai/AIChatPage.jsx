/** /ai — Percakapan Asisten AI (layar penuh): daftar percakapan + chat. `?session=<id>` membuka percakapan tertentu. */
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bot, Plus, Trash2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { confirmDialog } from "@/components/shared/confirmDialog";
import api, { unwrap } from "@/lib/api";
import { fmtRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import AgentChat from "@/components/ai/AgentChat";
import { useAgentChat } from "@/components/ai/useAgentChat";

export default function AIChatPage() {
  const [params, setParams] = useSearchParams();
  const chat = useAgentChat(params.get("session"));
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadSessions = useCallback(async () => {
    try { setSessions(unwrap(await api.get("/ai/agent/sessions", { scope: false })) || []); } finally { setLoading(false); }
  }, []);
  useEffect(() => { loadSessions(); }, [loadSessions, chat.sessionId, chat.busy]);
  useEffect(() => {
    const cur = params.get("session");
    if (chat.sessionId && chat.sessionId !== cur) setParams({ session: chat.sessionId }, { replace: true });
  }, [chat.sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const openSession = (id) => { chat.open(id); setParams(id ? { session: id } : {}, { replace: true }); };
  const remove = async (s) => {
    const ok = await confirmDialog({ title: "Hapus percakapan?", description: `"${s.title}" akan dihapus dari daftar.`, confirmText: "Hapus", destructive: true });
    if (!ok) return;
    await api.delete(`/ai/agent/sessions/${s.id}`);
    if (s.id === chat.sessionId) openSession(null);
    loadSessions();
  };

  return (
    <div className="space-y-3 md:space-y-4" data-testid="ai-chat-page">
      <PageHeader icon={Bot} title="Asisten AI" subtitle="Tanya, analisis lintas modul, baca foto/PDF/Excel, dan siapkan aksi yang Anda setujui"
        actions={<Button onClick={() => openSession(null)} disabled={chat.busy} data-testid="ai-new-chat"><Plus className="h-4 w-4" /> Percakapan baru</Button>} />
      <div className="grid gap-3 md:gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="p-0 lg:h-[calc(100vh-190px)] flex flex-col">
          <CardHeader className="p-3 pb-2"><CardTitle className="text-base">Percakapan</CardTitle></CardHeader>
          <CardContent className="p-2 pt-0 flex-1 min-h-0 overflow-y-auto">
            {!loading && !sessions.length && <EmptyState icon={MessageSquare} title="Belum ada percakapan" />}
            <ul className="space-y-0.5" data-testid="ai-session-list">
              {sessions.map((s) => (
                <li key={s.id} className={cn("flex items-center gap-1 rounded-md", s.id === chat.sessionId && "bg-muted")}>
                  <button type="button" onClick={() => openSession(s.id)} className="flex-1 min-w-0 text-left px-2 py-1.5">
                    <p className="text-sm truncate">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{fmtRelative(s.updated_at)}{s.channel && s.channel !== "web" ? ` · ${s.channel}` : ""}</p>
                  </button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Hapus percakapan ${s.title}`} onClick={() => remove(s)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card className="p-4 h-[calc(100vh-190px)] min-h-[480px] flex flex-col">
          <AgentChat chat={chat} />
        </Card>
      </div>
    </div>
  );
}
