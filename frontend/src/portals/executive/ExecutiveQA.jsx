/** Executive Q&A — conversational AI for executive insights.
 * Uses /api/executive/qa or /api/ai/exec-qa endpoints.
 */
import { useEffect, useRef, useState } from "react";
import { Brain, Send, Sparkles, Bot, User as UserIcon, Loader2, History } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const SUGGESTIONS = [
  "Bagaimana revenue FnB Group bulan ini dibanding bulan lalu?",
  "Outlet mana yang paling profit MTD?",
  "Brand mana yang share-nya turun signifikan?",
  "Apa anomali biaya terbesar minggu ini?",
  "Rekomendasi vendor terbaik untuk kategori daging?",
];

export default function ExecutiveQA() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Halo! Saya Asisten Eksekutif FnB Group. Saya bisa bantu jawab pertanyaan tentang revenue, biaya, GP, brand mix, vendor, dan anomali bisnis. Coba salah satu saran di bawah, atau ketik pertanyaan Anda.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function ask(q) {
    const question = (q ?? input).trim();
    if (!question) return;
    setMessages((ms) => [...ms, { role: "user", content: question }]);
    setInput("");
    setLoading(true);
    let answered = false;
    try {
      // Try /api/executive/qa first
      const res = await api.post("/executive/qa", { question });
      const data = unwrap(res);
      const answer = data?.answer || data?.response || data?.text || JSON.stringify(data);
      setMessages((ms) => [...ms, { role: "assistant", content: answer, sources: data?.sources, latency: data?.latency_ms }]);
      answered = true;
    } catch (_) {
      try {
        const res2 = await api.post("/ai/exec-qa", { question });
        const d2 = unwrap(res2);
        const answer = d2?.answer || d2?.response || d2?.text || JSON.stringify(d2);
        setMessages((ms) => [...ms, { role: "assistant", content: answer, sources: d2?.sources, latency: d2?.latency_ms }]);
        answered = true;
      } catch (e2) {
        const status = e2.response?.status;
        const reason = e2.response?.data?.errors?.[0]?.message;
        if (status === 503 || /not[_\s]configured/i.test(reason || "")) {
          setMessages((ms) => [
            ...ms,
            {
              role: "assistant",
              content:
                "Maaf, AI/LLM belum dikonfigurasi. Admin dapat menambahkan API key di Admin → Integrations → AI / LLM untuk mengaktifkan fitur ini.",
              warning: true,
            },
          ]);
        } else {
          setMessages((ms) => [
            ...ms,
            { role: "assistant", content: `Maaf, gagal memproses pertanyaan: ${reason || e2.message}`, warning: true },
          ]);
        }
      }
    } finally {
      setLoading(false);
      if (!answered) toast.error("AI belum bisa menjawab — cek konfigurasi LLM.");
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 flex flex-col h-[calc(100vh-180px)]" data-testid="executive-qa-page">
      <PageHeader
        icon={Brain}
        title="Executive Q&A"
        subtitle="Tanya AI tentang performa bisnis Anda"
        action={
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => setMessages(messages.slice(0, 1))}>
            <History className="h-3.5 w-3.5" /> Reset
          </Button>
        }
      />

      {/* Chat container */}
      <div ref={scrollRef} className="glass-card flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} content={m.content} warning={m.warning} sources={m.sources} latency={m.latency} />
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> AI sedang berpikir...
          </div>
        )}
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && !loading && (
        <div className="glass-card p-3">
          <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Coba salah satu pertanyaan ini:
          </div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="text-xs px-3 py-1.5 rounded-full glass-input hover:shadow-md transition"
                data-testid="qa-suggestion"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); ask(); }}
        className="glass-card p-3 flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tanyakan apapun tentang bisnis Anda..."
          className="flex-1 bg-transparent outline-none text-sm px-3 h-10"
          disabled={loading}
          data-testid="qa-input"
        />
        <Button type="submit" disabled={loading || !input.trim()} className="rounded-full pill-active gap-2 h-10" data-testid="qa-send">
          <Send className="h-4 w-4" /> Tanya
        </Button>
      </form>
    </div>
  );
}

function Bubble({ role, content, warning, sources, latency }) {
  const isUser = role === "user";
  return (
    <div className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="h-8 w-8 rounded-full grad-aurora flex items-center justify-center shrink-0">
          <Bot className="h-4 w-4 text-white" />
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
          isUser ? "grad-aurora text-white" : warning ? "bg-amber-500/10 border border-amber-500/30" : "glass-input"
        }`}
      >
        <div className="whitespace-pre-line">{content}</div>
        {sources && sources.length > 0 && (
          <div className="mt-2 pt-2 border-t border-current/20 text-xs opacity-70">
            <strong>Sources:</strong> {sources.slice(0, 3).map((s) => s.label || s.id).join(", ")}
          </div>
        )}
        {latency && <div className="text-[10px] opacity-60 mt-1">{latency}ms</div>}
      </div>
      {isUser && (
        <div className="h-8 w-8 rounded-full bg-foreground/10 flex items-center justify-center shrink-0">
          <UserIcon className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
