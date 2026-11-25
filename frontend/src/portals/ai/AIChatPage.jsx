/** /ai — Asisten AI layar penuh, gaya chatbot (mirip antarmuka Claude).
 *
 * Kiri: riwayat percakapan (cari, dikelompokkan per waktu, hapus) + pintasan Dashboard AI / Persetujuan AI.
 * Tengah: percakapan (AgentChat variant="page"). "Layar penuh" menyembunyikan TopNav & sidebar aplikasi
 * (AppShell mendengarkan event "aurora-ai-focus"; Esc untuk keluar). `?session=<id>` membuka percakapan tertentu
 * — sama dengan panel Asisten AI di TopNav.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PanelLeft, SquarePen, Search, Trash2, Maximize2, Minimize2, LayoutDashboard, ShieldCheck, Settings2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { confirmDialog } from "@/components/shared/confirmDialog";
import api, { unwrap } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useNavigation } from "@/contexts/NavigationContext";
import { canOpenPath } from "@/lib/unifiedNav";
import { cn } from "@/lib/utils";
import AgentChat from "@/components/ai/AgentChat";
import { useAgentChat } from "@/components/ai/useAgentChat";

const HISTORY_KEY = "aurora_ai_history_open";

function groupOf(iso) {
  const d = new Date(iso);
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = (start - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000;
  if (diff <= 0) return "Hari ini";
  if (diff === 1) return "Kemarin";
  if (diff < 7) return "7 hari terakhir";
  if (diff < 30) return "30 hari terakhir";
  return "Lebih lama";
}

function History({ sessions, activeId, onOpen, onNew, onDelete, busy, query, setQuery, user, onNavigate }) {
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = [];
    sessions.filter((s) => !q || (s.title || "").toLowerCase().includes(q)).forEach((s) => {
      const g = groupOf(s.updated_at);
      let bucket = out.find((x) => x.name === g);
      if (!bucket) { bucket = { name: g, items: [] }; out.push(bucket); }
      bucket.items.push(s);
    });
    return out;
  }, [sessions, query]);
  const links = [
    { path: "/ai/dashboard", label: "Dashboard AI", icon: LayoutDashboard },
    { path: "/ai/approvals", label: "Persetujuan AI", icon: ShieldCheck },
    { path: "/ai/settings", label: "Pemakaian & Pengaturan", icon: Settings2 },
  ].filter((l) => canOpenPath(user, l.path));

  return (
    <div className="flex h-full flex-col">
      <div className="p-3 space-y-2">
        <Button variant="outline" className="w-full justify-start" onClick={onNew} disabled={busy} data-testid="ai-new-chat">
          <SquarePen className="h-4 w-4" /> Percakapan baru
        </Button>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari percakapan" className="pl-8" aria-label="Cari percakapan" data-testid="ai-session-search" />
        </div>
      </div>
      <nav className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 space-y-3" aria-label="Riwayat percakapan" data-testid="ai-session-list">
        {!sessions.length && <p className="px-2 text-xs text-muted-foreground">Belum ada percakapan.</p>}
        {groups.map((g) => (
          <div key={g.name}>
            <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{g.name}</p>
            <ul className="space-y-0.5">
              {g.items.map((s) => {
                const active = s.id === activeId;
                return (
                  <li key={s.id} className={cn("group flex items-center rounded-lg", active ? "bg-muted" : "hover:bg-muted/60")}>
                    <button type="button" onClick={() => onOpen(s.id)} className="flex-1 min-w-0 text-left px-2 py-1.5 text-sm truncate"
                      aria-current={active ? "page" : undefined} title={s.title}>
                      {s.channel && s.channel !== "web" ? `[${s.channel.toUpperCase()}] ` : ""}{s.title}
                    </button>
                    <Button size="icon-sm" variant="ghost" aria-label={`Hapus percakapan ${s.title}`} onClick={() => onDelete(s)}
                      className={cn(!active && "invisible group-hover:visible group-focus-within:visible")}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      {links.length > 0 && (
        <div className="border-t border-border p-2 space-y-0.5">
          {links.map((l) => (
            <Button key={l.path} asChild variant="ghost" className="w-full justify-start">
              <Link to={l.path} onClick={onNavigate}><l.icon className="h-4 w-4" /> {l.label}</Link>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AIChatPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const chat = useAgentChat(params.get("session"));
  const [sessions, setSessions] = useState([]);
  const [query, setQuery] = useState("");
  const [historyOpen, setHistoryOpen] = useState(() => {
    try { return localStorage.getItem(HISTORY_KEY) !== "0"; } catch { return true; }
  });
  const [mobileHistory, setMobileHistory] = useState(false);
  const [focus, setFocus] = useState(false);
  const { sidebarCollapsed, setSidebarCollapsed } = useNavigation();

  // Satu sidebar lebar saja (riwayat percakapan, gaya Claude): sidebar aplikasi diciutkan sementara selama di /ai
  // (tidak disimpan ke preferensi) dan dikembalikan saat keluar.
  useEffect(() => {
    const wasCollapsed = sidebarCollapsed;
    if (!wasCollapsed) setSidebarCollapsed(true);
    return () => { if (!wasCollapsed) setSidebarCollapsed(false); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSessions = useCallback(async () => {
    try { setSessions(unwrap(await api.get("/ai/agent/sessions", { scope: false })) || []); } catch { /* daftar opsional */ }
  }, []);
  useEffect(() => { loadSessions(); }, [loadSessions, chat.sessionId, chat.busy]);
  useEffect(() => {
    if (chat.sessionId && chat.sessionId !== params.get("session")) setParams({ session: chat.sessionId }, { replace: true });
  }, [chat.sessionId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    try { localStorage.setItem(HISTORY_KEY, historyOpen ? "1" : "0"); } catch { /* abaikan */ }
  }, [historyOpen]);

  // Layar penuh: sembunyikan TopNav & sidebar aplikasi (AppShell), Esc untuk keluar; reset saat meninggalkan halaman.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("aurora-ai-focus", { detail: focus }));
    if (!focus) return undefined;
    const onKey = (e) => { if (e.key === "Escape" && !document.querySelector("[role='dialog']")) setFocus(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus]);
  useEffect(() => () => window.dispatchEvent(new CustomEvent("aurora-ai-focus", { detail: false })), []);

  const openSession = (id) => {
    chat.open(id);
    setParams(id ? { session: id } : {}, { replace: true });
    setMobileHistory(false);
  };
  const remove = async (s) => {
    const ok = await confirmDialog({ title: "Hapus percakapan?", description: `"${s.title}" akan dihapus dari riwayat.`, confirmText: "Hapus", destructive: true });
    if (!ok) return;
    await api.delete(`/ai/agent/sessions/${s.id}`);
    if (s.id === chat.sessionId) openSession(null);
    loadSessions();
  };

  const historyProps = {
    sessions, activeId: chat.sessionId, onOpen: openSession, onNew: () => openSession(null), onDelete: remove,
    busy: chat.busy, query, setQuery, user, onNavigate: () => setFocus(false),
  };

  return (
    <div className="flex-1 min-h-0 flex bg-background" data-testid="ai-chat-page">
      {historyOpen && (
        <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-muted/30" aria-label="Riwayat percakapan">
          <History {...historyProps} />
        </aside>
      )}
      <Sheet open={mobileHistory} onOpenChange={setMobileHistory}>
        <SheetContent side="left" className="p-0 w-72 flex flex-col">
          <SheetTitle className="sr-only">Riwayat percakapan</SheetTitle>
          <History {...historyProps} />
        </SheetContent>
      </Sheet>

      <section className="flex-1 min-w-0 flex flex-col">
        <header className="h-12 shrink-0 flex items-center gap-1 px-2 border-b border-border">
          <Button size="icon-sm" variant="ghost" className="hidden md:inline-flex" onClick={() => setHistoryOpen((o) => !o)}
            aria-label={historyOpen ? "Sembunyikan riwayat" : "Tampilkan riwayat"} aria-pressed={historyOpen} data-testid="ai-toggle-history">
            <PanelLeft className="h-4 w-4" />
          </Button>
          <Button size="icon-sm" variant="ghost" className="md:hidden" onClick={() => setMobileHistory(true)} aria-label="Riwayat percakapan">
            <MessageSquare className="h-4 w-4" />
          </Button>
          <h1 className="flex-1 min-w-0 truncate px-1 text-sm font-medium" data-testid="ai-chat-title">
            {chat.session?.title || "Asisten AI"}
          </h1>
          <Button size="icon-sm" variant="ghost" onClick={() => openSession(null)} disabled={chat.busy} aria-label="Percakapan baru" title="Percakapan baru">
            <SquarePen className="h-4 w-4" />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={() => setFocus((f) => !f)} aria-pressed={focus}
            aria-label={focus ? "Keluar layar penuh (Esc)" : "Layar penuh"} title={focus ? "Keluar layar penuh (Esc)" : "Layar penuh"} data-testid="ai-fullscreen">
            {focus ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </header>
        <AgentChat chat={chat} variant="page" onNavigated={() => setFocus(false)} />
      </section>
    </div>
  );
}
