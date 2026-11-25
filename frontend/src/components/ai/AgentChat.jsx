/** AgentChat — isi percakapan Asisten AI (dipakai panel TopNav & halaman /ai).
 *
 * Menampilkan jawaban (markdown aman), jejak langkah agen, kartu usulan aksi (Setujui/Tolak/ubah isi), tombol tautan
 * halaman (+tour), file hasil, dan composer dengan lampiran (foto struk, PDF, Excel/CSV).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bot, Paperclip, SendHorizonal, X, ExternalLink, FileDown, Loader2, ListChecks, ChevronDown, ChevronRight, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import EmptyState from "@/components/shared/EmptyState";
import { useScope } from "@/contexts/ScopeContext";
import { useTour } from "@/contexts/tour";
import { cn } from "@/lib/utils";
import Markdown from "./Markdown";
import ActionCard from "./ActionCard";
import { downloadAgentFile } from "./useAgentChat";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,application/pdf,.csv,.xlsx,.xls,text/csv";

const SUGGESTIONS = [
  "Bandingkan sales per toko minggu ini vs lalu",
  "Apa yang perlu saya setujui hari ini?",
  "Buat reservasi 4 orang besok jam 19.00",
  "Bagaimana cara membuat purchase order?",
];

function Steps({ steps }) {
  const [open, setOpen] = useState(false);
  if (!steps?.length) return null;
  return (
    <div className="text-xs text-muted-foreground">
      <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setOpen((o) => !o)}>
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

function AssistantMessage({ d, actions, onDecide, onDecideBatch, onNavigate, busy }) {
  const { startTour } = useTour();
  const ui = d.ui || [];
  const acts = ui.filter((u) => u.type === "action").map((u) => actions?.[u.action_id]).filter(Boolean);
  const pendingIds = acts.filter((a) => a.status === "pending").map((a) => a.id);
  const links = ui.filter((u) => u.type === "link");
  const files = ui.filter((u) => u.type === "file");
  return (
    <div className="space-y-2" data-testid="ai-msg-assistant">
      <Steps steps={d.steps} />
      {d.text && <Markdown text={d.text} onNavigate={onNavigate} />}
      {d.error && <p className="text-xs text-rose-700 dark:text-rose-400">{d.error}</p>}
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
            <Button key={f.id} size="sm" variant="outline" onClick={() => downloadAgentFile(f)} data-testid="ai-file">
              <FileDown className="h-3.5 w-3.5" /> {f.filename}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function UserMessage({ text, files }) {
  return (
    <div className="flex justify-end" data-testid="ai-msg-user">
      <div className="max-w-[85%] rounded-lg bg-primary/10 px-3 py-2 text-sm whitespace-pre-wrap break-words">
        {text}
        {files?.length > 0 && <p className="mt-1 text-xs text-muted-foreground">📎 {files.join(", ")}</p>}
      </div>
    </div>
  );
}

export default function AgentChat({ chat, compact = false, onNavigated }) {
  const navigate = useNavigate();
  const location = useLocation();
  const scope = useScope();
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const fileRef = useRef(null);
  const endRef = useRef(null);
  const { session, busy, steps, pending, error, send, decide, decideBatch, loading } = chat;
  const display = useMemo(() => (session?.display || []).filter((d) => !(d.role === "user" && d.auto)), [session]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [display.length, steps.length, pending]);

  const go = (path) => { navigate(path); onNavigated?.(path); };

  const submit = async (msg) => {
    const m = (msg ?? text).trim();
    if ((!m && !files.length) || busy) return;
    const fs = files;
    setText(""); setFiles([]);
    const sp = scope.outlet ? { outlet_id: scope.outlet.id, outlet_name: scope.outlet.name }
      : scope.brand ? { brand_id: scope.brand.id, brand_name: scope.brand.name } : null;
    await send({ message: m, files: fs, context: { path: location.pathname + location.search, title: document.title }, scope: sp });
  };

  const fileNames = (d) => (d.attachments || []).length ? [`${d.attachments.length} lampiran`] : [];

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className={cn("flex-1 min-h-0 overflow-y-auto space-y-4", compact ? "px-4 py-3" : "px-1 py-2")} data-testid="ai-chat-log" aria-live="polite">
        {loading && <p className="text-sm text-muted-foreground">Memuat percakapan…</p>}
        {!loading && !display.length && !pending && (
          <div className="space-y-3">
            <EmptyState icon={Bot} title="Tanya, analisis, atau minta dikerjakan"
              description="AI bisa membaca data sesuai izin Anda, mencari di web, membaca foto/PDF/Excel, dan menyiapkan aksi (buat/ubah/hapus) yang Anda setujui dulu." />
            <div className="flex flex-col gap-1.5">
              {SUGGESTIONS.map((s) => (
                <Button key={s} size="sm" variant="outline" className="justify-start truncate" onClick={() => submit(s)} data-testid="ai-suggestion">
                  {s}
                </Button>
              ))}
            </div>
          </div>
        )}
        {display.map((d, i) => (d.role === "user"
          ? <UserMessage key={i} text={d.text} files={fileNames(d)} />
          : <AssistantMessage key={i} d={d} actions={session?.actions} onDecide={decide} onDecideBatch={decideBatch} onNavigate={go} busy={busy} />))}
        {pending && <UserMessage text={pending.text} files={pending.files} />}
        {busy && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground" data-testid="ai-working">
            <Loader2 className="h-4 w-4 animate-spin mt-0.5" />
            <div className="space-y-0.5">
              <p>AI sedang bekerja…</p>
              {steps.slice(-4).map((s, i) => <p key={i} className="text-xs">• {s}</p>)}
            </div>
          </div>
        )}
        {error && <p className="text-sm text-rose-700 dark:text-rose-400" role="alert">{error}</p>}
        <div ref={endRef} />
      </div>

      <div className={cn("border-t border-border space-y-2", compact ? "p-3" : "pt-3")}>
        {files.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {files.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 h-6 text-xs">
                {f.name}
                <button type="button" aria-label={`Hapus lampiran ${f.name}`} onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <input ref={fileRef} type="file" multiple accept={ACCEPT} className="hidden" data-testid="ai-file-input"
            onChange={(e) => { setFiles((x) => [...x, ...Array.from(e.target.files || [])].slice(0, 10)); e.target.value = ""; }} />
          <Button size="icon" variant="ghost" onClick={() => fileRef.current?.click()} aria-label="Lampirkan file (foto, PDF, Excel)" data-testid="ai-attach">
            <Paperclip className="h-4 w-4" />
          </Button>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={compact ? 2 : 3}
            placeholder="Tulis pertanyaan atau perintah… (Enter kirim, Shift+Enter baris baru)"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            className="flex-1 resize-none" aria-label="Pesan untuk Asisten AI" data-testid="ai-input" />
          <Button size="icon" onClick={() => submit()} disabled={busy || (!text.trim() && !files.length)} aria-label="Kirim" data-testid="ai-send">
            <SendHorizonal className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">AI bisa keliru — periksa angka penting. Aksi tulis selalu menunggu persetujuan Anda.</p>
      </div>
    </div>
  );
}
