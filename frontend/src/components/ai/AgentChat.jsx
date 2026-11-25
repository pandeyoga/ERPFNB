/** AgentChat — isi percakapan Asisten AI, gaya chatbot (mirip antarmuka Claude).
 *
 * variant:
 *  - "page"  : halaman /ai layar penuh — kolom percakapan di tengah (maks. ±768px), layar sambutan dengan kotak tulis
 *              di tengah + saran, jawaban AI tanpa gelembung (avatar + teks), pesan pengguna dalam gelembung.
 *  - "panel" : panel samping TopNav — tata letak sama, ukuran lebih rapat.
 * Isi jawaban: markdown aman, jejak langkah agen, grafik (bisa disematkan), kartu usulan aksi (Setujui/Tolak/Ubah isi),
 * tombol tautan halaman (+tour), file hasil. Kotak tulis: lampiran foto/PDF/Excel, Enter kirim, Shift+Enter baris baru.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Bot, Paperclip, ArrowUp, X, ExternalLink, FileDown, Loader2, ListChecks, ChevronDown, ChevronRight,
  CheckCheck, Pin, Copy, Check, FileText, ThumbsUp, ThumbsDown,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useScope } from "@/contexts/ScopeContext";
import { useTour } from "@/contexts/tour";
import { cn } from "@/lib/utils";
import api, { unwrapError } from "@/lib/api";
import { canOpenPath } from "@/lib/unifiedNav";
import { useAuth } from "@/lib/auth";
import Markdown from "./Markdown";
import ActionCard from "./ActionCard";
import ChartBlock from "./ChartBlock";
import { downloadAgentFile } from "./useAgentChat";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,application/pdf,.csv,.xlsx,.xls,text/csv";

export const SUGGESTIONS = [
  { label: "Bandingkan sales per toko minggu ini vs lalu", icon: "📊" },
  { label: "Apa yang perlu saya setujui hari ini?", icon: "✅" },
  { label: "Buat laporan PDF penjualan bulan ini", icon: "📄" },
  { label: "Buat reservasi 4 orang besok jam 19.00", icon: "🗓️" },
  { label: "Cek harga beli daging sapi vs harga pasar", icon: "🔎" },
  { label: "Bagaimana cara membuat purchase order?", icon: "🧭" },
];

function greeting(name) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Jakarta" }).format(new Date()));
  const part = h < 11 ? "pagi" : h < 15 ? "siang" : h < 18 ? "sore" : "malam";
  const first = String(name || "").replace(/^(pak|bu|bapak|ibu)\s+/i, "").split(/\s+/)[0];
  return `Selamat ${part}${first ? `, ${first}` : ""}`;
}

function Avatar({ small }) {
  return (
    <span className={cn("shrink-0 rounded-lg grad-aurora flex items-center justify-center", small ? "h-6 w-6" : "h-7 w-7")} aria-hidden>
      <Bot className={cn("text-white", small ? "h-3.5 w-3.5" : "h-4 w-4")} />
    </span>
  );
}

function Steps({ steps }) {
  const [open, setOpen] = useState(false);
  if (!steps?.length) return null;
  return (
    <div className="text-xs text-muted-foreground">
      <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <ListChecks className="h-3.5 w-3.5" /> {steps.length} langkah kerja AI
      </button>
      {open && (
        <ol className="mt-1 pl-6 list-decimal space-y-0.5">
          {steps.map((s, i) => <li key={i}>{s.label || s}</li>)}
        </ol>
      )}
    </div>
  );
}

function ChartCard({ spec, sessionId }) {
  const { user } = useAuth();
  const [pinned, setPinned] = useState(false);
  const pin = async () => {
    try {
      await api.post("/ai/agent/pins", { spec, session_id: sessionId });
      setPinned(true);
      toast.success("Disematkan ke Dashboard AI");
    } catch (e) {
      toast.error(unwrapError(e));
    }
  };
  return (
    <div className="rounded-xl border border-border bg-background p-3 space-y-2" data-testid="ai-chart-card">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">{spec.title}</p>
        {canOpenPath(user, "/ai/dashboard") && (
          <Button size="sm" variant="ghost" onClick={pin} disabled={pinned} data-testid="ai-chart-pin">
            <Pin className="h-3.5 w-3.5" /> {pinned ? "Tersemat" : "Sematkan"}
          </Button>
        )}
      </div>
      <ChartBlock spec={spec} height={240} />
    </div>
  );
}

function CopyButton({ text }) {
  const [done, setDone] = useState(false);
  if (!text) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      toast.error("Tidak bisa menyalin");
    }
  };
  return (
    <Button size="icon-sm" variant="ghost" onClick={copy} aria-label={done ? "Tersalin" : "Salin jawaban"} title="Salin" data-testid="ai-copy">
      {done ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

/** 👍/👎 per jawaban → /ai/agent/feedback (dipakai dashboard kualitas). 👎 bisa disertai catatan singkat. */
function FeedbackButtons({ runId }) {
  const [rating, setRating] = useState(null);
  const [asking, setAsking] = useState(false);
  const [comment, setComment] = useState("");
  if (!runId) return null;
  const send = async (r, c = "") => {
    try {
      await api.post("/ai/agent/feedback", { run_id: runId, rating: r, comment: c });
      setRating(r); setAsking(false);
      if (r === "down") toast.success("Terima kasih — masukan dicatat");
    } catch (e) { toast.error(unwrapError(e)); }
  };
  return (
    <>
      <Button size="icon-sm" variant="ghost" onClick={() => send("up")} aria-label="Jawaban membantu" aria-pressed={rating === "up"} title="Membantu" data-testid="ai-feedback-up">
        <ThumbsUp className={cn("h-4 w-4", rating === "up" && "fill-current")} />
      </Button>
      <Button size="icon-sm" variant="ghost" onClick={() => setAsking((v) => !v)} aria-label="Jawaban kurang tepat" aria-pressed={rating === "down"} title="Kurang tepat" data-testid="ai-feedback-down">
        <ThumbsDown className={cn("h-4 w-4", rating === "down" && "fill-current")} />
      </Button>
      {asking && (
        <div className="flex w-full items-center gap-2 pt-1">
          <Textarea rows={1} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Apa yang kurang tepat? (opsional)"
            className="min-h-[36px] text-sm" aria-label="Catatan umpan balik" />
          <Button size="sm" variant="outline" onClick={() => send("down", comment)} data-testid="ai-feedback-send">Kirim</Button>
        </div>
      )}
    </>
  );
}

function AssistantMessage({ d, actions, onDecide, onDecideBatch, onNavigate, busy, sessionId, page }) {
  const { startTour } = useTour();
  const ui = d.ui || [];
  const acts = ui.filter((u) => u.type === "action").map((u) => actions?.[u.action_id]).filter(Boolean);
  const pendingIds = acts.filter((a) => a.status === "pending").map((a) => a.id);
  const links = ui.filter((u) => u.type === "link");
  const files = ui.filter((u) => u.type === "file");
  const charts = ui.filter((u) => u.type === "chart");
  return (
    <div className="flex gap-3" data-testid="ai-msg-assistant">
      <Avatar small={!page} />
      <div className="flex-1 min-w-0 space-y-3">
        <Steps steps={d.steps} />
        {d.text && <Markdown text={d.text} onNavigate={onNavigate} className={page ? "text-[15px] leading-7 space-y-3" : "leading-6"} />}
        {d.error && <p className="text-xs text-rose-700 dark:text-rose-400">{d.error}</p>}
        {charts.map((c, i) => <ChartCard key={`c${i}`} spec={c.spec} sessionId={sessionId} />)}
        {acts.length > 0 && (
          <div className="space-y-2">
            {acts.map((a) => <ActionCard key={a.id} action={a} onDecide={onDecide} disabled={busy} />)}
            {pendingIds.length > 1 && (
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => onDecideBatch(pendingIds, "approve")} disabled={busy} data-testid="ai-approve-all">
                  <CheckCheck className="h-3.5 w-3.5" /> Setujui semua ({pendingIds.length})
                </Button>
              </div>
            )}
          </div>
        )}
        {(links.length > 0 || files.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {links.map((l, i) => (
              <Button key={`l${i}`} size="sm" variant="outline" data-testid="ai-link"
                onClick={() => { onNavigate(l.path); if (l.tour_id) setTimeout(() => startTour(l.tour_id), 700); }}>
                <ExternalLink className="h-3.5 w-3.5" /> {l.label}
              </Button>
            ))}
            {files.map((f) => (
              <Button key={f.file_id || f.id} size="sm" variant="outline" onClick={() => downloadAgentFile(f)} data-testid="ai-file">
                <FileDown className="h-3.5 w-3.5" /> {f.filename}
              </Button>
            ))}
          </div>
        )}
        {d.text && <div className="-ml-2 flex flex-wrap items-center gap-0.5"><CopyButton text={d.text} /><FeedbackButtons runId={d.run_id} /></div>}
      </div>
    </div>
  );
}

function UserMessage({ text, files, page }) {
  return (
    <div className="flex justify-end" data-testid="ai-msg-user">
      <div className={cn("max-w-[85%] rounded-2xl bg-muted px-4 py-2.5 whitespace-pre-wrap break-words", page ? "text-[15px] leading-7" : "text-sm")}>
        {text}
        {files?.length > 0 && (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><FileText className="h-3.5 w-3.5" /> {files.join(", ")}</p>
        )}
      </div>
    </div>
  );
}

/** Kotak tulis gaya Claude: lampiran di atas, textarea tumbuh otomatis, tombol lampiran kiri & kirim kanan. */
function Composer({ onSubmit, busy, page, autoFocus, placeholder }) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const fileRef = useRef(null);
  const taRef = useRef(null);

  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [text]);
  useEffect(() => { if (autoFocus) taRef.current?.focus(); }, [autoFocus]);

  const submit = () => {
    const m = text.trim();
    if ((!m && !files.length) || busy) return;
    onSubmit(m, files);
    setText("");
    setFiles([]);
  };

  return (
    <div className="rounded-2xl border border-border bg-background shadow-sm focus-within:border-ring/60 transition-colors" data-testid="ai-composer">
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pt-3">
          {files.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 h-7 text-xs max-w-[220px]">
              <FileText className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{f.name}</span>
              <button type="button" aria-label={`Hapus lampiran ${f.name}`} onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Textarea ref={taRef} value={text} onChange={(e) => setText(e.target.value)} rows={1}
        placeholder={placeholder || "Tanya, analisis, atau minta dikerjakan…"}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
        className={cn("min-h-0 resize-none border-0 shadow-none bg-transparent focus-visible:ring-0 px-4",
          page ? "pt-4 pb-2 md:text-[15px] max-h-56" : "pt-3 pb-1 max-h-44")}
        aria-label="Pesan untuk Asisten AI" data-testid="ai-input" />
      <div className="flex items-center justify-between gap-2 px-2 pb-2">
        <input ref={fileRef} type="file" multiple accept={ACCEPT} className="hidden" data-testid="ai-file-input"
          onChange={(e) => { setFiles((x) => [...x, ...Array.from(e.target.files || [])].slice(0, 10)); e.target.value = ""; }} />
        <Button size="icon-sm" variant="ghost" onClick={() => fileRef.current?.click()} aria-label="Lampirkan file (foto, PDF, Excel)" title="Lampirkan foto, PDF, atau Excel" data-testid="ai-attach">
          <Paperclip className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          {page && <span className="hidden md:inline text-xs text-muted-foreground">Enter kirim · Shift+Enter baris baru</span>}
          <Button size="icon-sm" onClick={submit} disabled={busy || (!text.trim() && !files.length)} aria-label="Kirim" data-testid="ai-send">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AgentChat({ chat, variant, compact = false, onNavigated }) {
  const page = (variant || (compact ? "panel" : "page")) === "page";
  const navigate = useNavigate();
  const location = useLocation();
  const scope = useScope();
  const { user } = useAuth();
  const scrollRef = useRef(null);
  const { session, busy, steps, pending, error, send, decide, decideBatch, loading } = chat;
  const display = useMemo(() => (session?.display || []).filter((d) => !(d.role === "user" && d.auto)), [session]);
  const empty = !loading && !display.length && !pending;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [display.length, steps.length, pending, busy]);

  const go = (path) => { navigate(path); onNavigated?.(path); };

  const submit = async (m, fs = []) => {
    const sp = scope.outlet ? { outlet_id: scope.outlet.id, outlet_name: scope.outlet.name }
      : scope.brand ? { brand_id: scope.brand.id, brand_name: scope.brand.name } : null;
    await send({ message: m, files: fs, context: { path: location.pathname + location.search, title: document.title }, scope: sp });
  };

  const fileNames = (d) => ((d.attachments || []).length ? [`${d.attachments.length} lampiran`] : []);
  const col = page ? "w-full max-w-3xl mx-auto px-4" : "w-full px-4";
  const disclaimer = (
    <p className="text-xs text-muted-foreground text-center">AI bisa keliru — periksa angka penting. Aksi tulis selalu menunggu persetujuan Anda.</p>
  );

  // Layar sambutan: kotak tulis di tengah (gaya Claude)
  if (empty) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col" data-testid="ai-chat-log">
        <div className={cn(col, "flex-1 flex flex-col justify-center gap-5 py-8")}>
          <div className={cn("flex items-center gap-3", page ? "justify-center" : "")}>
            <Avatar />
            <div>
              <h2 className={cn("font-semibold tracking-tight", page ? "text-2xl md:text-3xl" : "text-lg")}>{greeting(user?.full_name)}</h2>
              <p className="text-sm text-muted-foreground">Apa yang bisa saya bantu hari ini?</p>
            </div>
          </div>
          <Composer onSubmit={submit} busy={busy} page={page} autoFocus={page} />
          <div className={cn("flex flex-wrap gap-2", page ? "justify-center" : "")}>
            {SUGGESTIONS.slice(0, page ? 6 : 4).map((s) => (
              <Button key={s.label} size="sm" variant="outline" onClick={() => submit(s.label)} disabled={busy} data-testid="ai-suggestion">
                <span aria-hidden>{s.icon}</span> {s.label}
              </Button>
            ))}
          </div>
          {page && (
            <p className="text-xs text-muted-foreground text-center max-w-xl mx-auto">
              Membaca data sesuai izin Anda di semua modul, mencari di web, membaca foto struk/PDF/Excel, membuat grafik &amp;
              laporan Excel/PDF, merujuk SOP perusahaan, mengingat preferensi Anda, menjalankan laporan &amp; pemantauan terjadwal,
              dan menyiapkan aksi (buat/ubah/hapus) yang Anda setujui dulu.
            </p>
          )}
          {error && <p className="text-sm text-rose-700 dark:text-rose-400 text-center" role="alert">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto" data-testid="ai-chat-log" aria-live="polite">
        <div className={cn(col, page ? "py-6 space-y-7" : "py-4 space-y-5")}>
          {loading && <p className="text-sm text-muted-foreground">Memuat percakapan…</p>}
          {display.map((d, i) => (d.role === "user"
            ? <UserMessage key={i} text={d.text} files={fileNames(d)} page={page} />
            : <AssistantMessage key={i} d={d} actions={session?.actions} onDecide={decide} onDecideBatch={decideBatch}
                onNavigate={go} busy={busy} sessionId={session?.id} page={page} />))}
          {pending && <UserMessage text={pending.text} files={pending.files} page={page} />}
          {busy && (
            <div className="flex gap-3" data-testid="ai-working">
              <Avatar small={!page} />
              <div className="space-y-1 text-sm text-muted-foreground pt-0.5">
                <p className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> AI sedang bekerja…</p>
                {steps.slice(-4).map((s, i) => <p key={i} className="text-xs pl-6">{s}</p>)}
              </div>
            </div>
          )}
          {error && <p className="text-sm text-rose-700 dark:text-rose-400" role="alert">{error}</p>}
        </div>
      </div>
      <div className={cn(col, page ? "pb-4 pt-2 space-y-2" : "pb-3 pt-2 space-y-1.5")}>
        <Composer onSubmit={submit} busy={busy} page={page} placeholder="Balas Asisten AI…" />
        {disclaimer}
      </div>
    </div>
  );
}
