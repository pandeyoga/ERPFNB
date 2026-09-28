/** Phase 9D + 11E — Tool-calling Executive Q&A chat panel.
 *
 * Phase 11E enhancements:
 *  - Role-aware suggested questions (Owner gets owner-friendly chips)
 *  - Voice input via Web Speech API (id-ID)
 *  - Optional KPI snapshot strip at top (showKpi=true)
 *  - Persistent chat session via session_id
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Send, Sparkles, RotateCcw, Loader2, Wrench, ChevronDown, ChevronUp,
} from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import VoiceInputButton from "@/components/shared/VoiceInputButton";
import KpiSnapshotStrip from "@/components/shared/KpiSnapshotStrip";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const SUGGESTIONS_OWNER = [
  "Cash kita aman gak buat 30 hari ke depan?",
  "Outlet mana yang revenue-nya turun minggu ini?",
  "Top 3 vendor yang paling banyak kita bayar bulan ini?",
  "Brand mana yang paling untung MTD?",
  "Anomalies apa aja 24 jam terakhir?",
  "AP yang jatuh tempo minggu ini berapa total?",
];

const SUGGESTIONS_EXEC = [
  "Berapa pendapatan bulan ini?",
  "Tampilkan tren penjualan 14 hari terakhir.",
  "Vendor mana yang paling banyak kita bayar bulan ini?",
  "Apakah ada hari yang penjualannya jauh lebih rendah dari biasanya?",
  "Bagaimana kontribusi setiap brand bulan berjalan?",
  "Berapa item yang stoknya di bawah par?",
];

export default function ConversationalQA({ scopeLabel, showKpi = true, collapsible = false }) {
  const { user, can } = useAuth();
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [expandedTools, setExpandedTools] = useState({});
  const [collapsed, setCollapsed] = useState(() => {
    if (!collapsible) return false;
    try {
      const v = localStorage.getItem("aurora_ai_qa_collapsed");
      return v == null ? true : v === "1";
    } catch { return true; }
  });
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const isOwner = !!can?.("owner.cockpit.access");
  const SUGGESTIONS = useMemo(() => isOwner ? SUGGESTIONS_OWNER : SUGGESTIONS_EXEC, [isOwner]);

  function toggleCollapsed() {
    setCollapsed(c => {
      const next = !c;
      try { localStorage.setItem("aurora_ai_qa_collapsed", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history.length, busy]);

  async function send(q) {
    const text = (q || question || "").trim();
    if (!text || busy) return;
    setQuestion("");
    const optimistic = [...history, {
      role: "user", content: text, timestamp: new Date().toISOString(),
    }];
    setHistory(optimistic);
    setBusy(true);
    try {
      const res = await api.post("/ai/exec-qa", {
        question: text,
        session_id: sessionId,
      });
      const data = unwrap(res) || {};
      setSessionId(data.session_id || sessionId);
      if (Array.isArray(data.history)) setHistory(data.history);
      else if (data.answer) {
        setHistory(h => [...h, {
          role: "assistant", content: data.answer,
          tool_calls: data.tool_calls || [],
          timestamp: new Date().toISOString(),
        }]);
      }
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal menghubungi asisten AI");
    } finally { setBusy(false); }
  }

  function handleVoiceTranscript(text) {
    setQuestion(text);
    // Auto-send slight delay for visual
    setTimeout(() => send(text), 350);
  }

  function reset() {
    setHistory([]);
    setSessionId(null);
    setExpandedTools({});
  }

  return (
    <>
    {collapsible && collapsed ? (
      <button
        type="button"
        onClick={toggleCollapsed}
        className="glass-card w-full px-4 h-11 flex items-center gap-2 hover:bg-foreground/5 transition text-left"
        data-testid="exec-qa-collapsed"
        aria-expanded={false}
      >
        <Sparkles className="h-4 w-4 text-violet-500 shrink-0" />
        <span className="text-sm font-semibold">Asisten AI {scopeLabel || "Eksekutif"}</span>
        <span className="text-xs text-muted-foreground hidden sm:inline truncate">— tanya KPI, anomali, vendor, cashflow…</span>
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
          Buka <ChevronDown className="h-4 w-4" />
        </span>
      </button>
    ) : (
    <div className={cn("glass-card p-5 flex flex-col", collapsible ? "h-[460px]" : "h-[560px]")} data-testid="exec-qa">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" /> Asisten AI {scopeLabel || "Eksekutif"}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tanya pakai teks atau voice (id-ID) — dijawab dalam Bahasa Indonesia.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <Button size="sm" variant="outline"
              onClick={reset} className="h-8 rounded-full gap-1"
              data-testid="exec-qa-reset">
              <RotateCcw className="h-3 w-3" /> Sesi Baru
            </Button>
          )}
          {collapsible && (
            <Button size="sm" variant="ghost"
              onClick={toggleCollapsed} className="h-8 rounded-full gap-1"
              data-testid="exec-qa-collapse">
              <ChevronUp className="h-3 w-3" /> Tutup
            </Button>
          )}
        </div>
      </div>

      {showKpi && <div className="mb-3"><KpiSnapshotStrip /></div>}

      {history.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center" data-testid="exec-qa-empty">
          <div className="h-14 w-14 rounded-2xl grad-aurora-soft flex items-center justify-center">
            <Sparkles className="h-6 w-6" />
          </div>
          <p className="text-sm text-muted-foreground max-w-md">
            {isOwner
              ? "Sebagai Owner, Anda bisa tanya apapun tentang keuangan group. Coba salah satu chip di bawah:"
              : "Tanyakan KPI, performa brand/outlet, anomali, vendor terbaik, dan lainnya. Coba salah satu di bawah:"}
          </p>
          <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => send(s)}
                disabled={busy}
                className="text-xs px-3 py-1.5 rounded-full border border-border/60 bg-background hover:bg-foreground/5 transition"
                data-testid={`exec-qa-suggest-${i}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2.5 pr-1" data-testid="exec-qa-history">
          {history.map((m, i) => {
            const isUser = m.role === "user";
            const expandedKey = `tools-${i}`;
            const isToolsExpanded = expandedTools[expandedKey];
            return (
              <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    isUser
                      ? "bg-foreground text-background"
                      : "bg-foreground/5 text-foreground border border-border/40"
                  }`}
                  data-testid={`exec-qa-msg-${i}`}
                >
                  <div className="whitespace-pre-wrap">{m.content}</div>
                  {!isUser && Array.isArray(m.tool_calls) && m.tool_calls.length > 0 && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => setExpandedTools(s => ({ ...s, [expandedKey]: !s[expandedKey] }))}
                        className="text-[10px] inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                        data-testid={`exec-qa-tool-toggle-${i}`}
                      >
                        <Wrench className="h-3 w-3" />
                        {m.tool_calls.length} tool call{m.tool_calls.length > 1 ? "s" : ""}
                        {isToolsExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                      {isToolsExpanded && (
                        <div className="mt-1 space-y-1">
                          {m.tool_calls.map((tc, ti) => (
                            <div key={ti} className="text-[10px] text-muted-foreground bg-background/60 rounded px-2 py-1 border border-border/40">
                              <span className="font-mono font-semibold text-violet-700 dark:text-violet-300">{tc.tool}</span>
                              {tc.params && Object.keys(tc.params).length > 0 && (
                                <span> · <span className="font-mono">{JSON.stringify(tc.params)}</span></span>
                              )}
                              {tc.reason && (
                                <div className="italic mt-0.5">{tc.reason}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {busy && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl px-3 py-2 text-sm bg-foreground/5 border border-border/40 inline-flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-muted-foreground italic">Mencari jawaban…</span>
              </div>
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="mt-3 flex items-center gap-2"
      >
        <input
          ref={inputRef}
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={isOwner ? "Tanya apapun, atau klik mic untuk voice..." : "Tanya KPI, performa brand, vendor, anomali..."}
          className="glass-input flex-1 h-10 px-3 rounded-full text-sm"
          disabled={busy}
          data-testid="exec-qa-input"
        />
        <VoiceInputButton onTranscript={handleVoiceTranscript} disabled={busy} />
        <Button type="submit" disabled={busy || !question.trim()}
          className="rounded-full pill-active gap-1.5 h-10 px-4"
          data-testid="exec-qa-send">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Kirim
        </Button>
      </form>
    </div>
    )}
    </>
  );
}
