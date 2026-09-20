/** Phase 11C — Owner Digest Settings (Telegram + In-app + Email) + Bot Token config (11C++).  */
import { useEffect, useState } from "react";
import {
  Bell, MessageCircle, Mail, Phone, Trash2, Plus, Check, X, ExternalLink, Send,
} from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import SystemSettingsCard from "@/components/shared/SystemSettingsCard";
import { fmtDateTime } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { confirmDialog } from "@/components/shared/confirmDialog";

const CHANNEL_META = {
  telegram: { icon: MessageCircle, label: "Telegram",   placeholder: "Chat ID (mis. 123456789)", tone: "text-sky-600 bg-sky-50 dark:bg-sky-950/40" },
  whatsapp: { icon: Phone,         label: "WhatsApp",   placeholder: "Nomor (mis. +628123456789)", tone: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" },
  inapp:    { icon: Bell,          label: "In-App Notification", placeholder: "akan muncul di bell icon", tone: "text-violet-600 bg-violet-50 dark:bg-violet-950/40" },
  email:    { icon: Mail,          label: "Email",      placeholder: "owner@email.com (butuh RESEND_API_KEY)", tone: "text-amber-600 bg-amber-50 dark:bg-amber-950/40" },
};

export default function DigestSettings() {
  const { can } = useAuth();
  const canManageSystem = can("system.settings.manage");
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tgInfo, setTgInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [adding, setAdding] = useState(null);
  const [target, setTarget] = useState("");

  async function load() {
    setLoading(true);
    try {
      // Load critical data first (subscriptions)
      const subsRes = await api.get("/owner/digest/subscriptions");
      setSubs(unwrap(subsRes) || []);
      
      // Then load non-critical data (telegram info)
      try {
        const tgRes = await api.get("/owner/telegram/info");
        setTgInfo(unwrap(tgRes));
      } catch {
        // Telegram info is optional, don't block UI
        setTgInfo(null);
      }
    } catch {
      toast.error("Gagal memuat digest settings");
    } finally { 
      setLoading(false); 
    }
  }

  useEffect(() => { load(); }, []);

  async function loadPreview() {
    try {
      const r = await api.get("/owner/digest/preview");
      setPreview(unwrap(r));
    } catch { toast.error("Gagal load preview"); }
  }

  async function add(channel) {
    if (!target.trim()) { toast.error("Target wajib"); return; }
    setBusy(true);
    try {
      await api.post("/owner/digest/subscriptions", {
        channel, target: target.trim(),
        enabled: true, schedule_cron: "0 6 * * *",
      });
      toast.success("Subscription ditambahkan");
      setAdding(null); setTarget("");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.errors?.[0]?.message || "Gagal");
    } finally { setBusy(false); }
  }

  async function toggle(sub) {
    setBusy(true);
    try {
      await api.post("/owner/digest/subscriptions", {
        channel: sub.channel, target: sub.target, enabled: !sub.enabled,
      });
      load();
    } finally { setBusy(false); }
  }

  async function remove(sub) {
    if (!(await confirmDialog(`Hapus subscription ${sub.channel}?`))) return;
    setBusy(true);
    try {
      await api.delete(`/owner/digest/subscriptions/${sub.id}`);
      toast.success("Subscription dihapus"); load();
    } finally { setBusy(false); }
  }

  async function sendNow() {
    setBusy(true);
    try {
      const r = await api.post("/owner/digest/send-now");
      const res = unwrap(r);
      toast.success(`Terkirim ke: ${res.channels?.join(", ") || "—"}`);
    } finally { setBusy(false); }
  }

  if (loading) return (
    <div className="space-y-6" data-testid="digest-settings-page">
      <LoadingState message="Loading settings…" />
    </div>
  );

  const telegramConfigured = tgInfo?.configured;
  const botUsername = tgInfo?.bot?.result?.username;

  return (
    <div className="space-y-6" data-testid="digest-settings-page">
      {/* Header */}
      <div className="glass-card p-5" data-testid="digest-header">
        <h3 className="font-semibold mb-1">Daily Digest Subscriptions</h3>
        <p className="text-xs text-muted-foreground">
          Tiap pagi 06:00 WIB Anda akan menerima ringkasan keuangan group via channel di bawah.
        </p>
      </div>

      {/* System Settings (Phase 11C++) — Telegram token config */}
      {canManageSystem && (
        <SystemSettingsCard
          filterCategory="telegram"
          title="Telegram Bot Configuration"
        />
      )}

      {/* Telegram setup walkthrough */}
      <div className="glass-card p-5" data-testid="telegram-setup-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="h-9 w-9 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 flex items-center justify-center">
              <MessageCircle className="h-4 w-4" />
            </span>
            <div>
              <div className="font-semibold">Cara Setup Telegram Bot</div>
              <div className="text-[11px] text-muted-foreground">
                Status: {telegramConfigured
                  ? <span className="text-emerald-600">Configured • @{botUsername || "bot"}</span>
                  : <span className="text-amber-600">Belum dikonfigurasi</span>}
              </div>
            </div>
          </div>
        </div>
        <ol className="text-xs space-y-1.5 list-decimal list-inside text-muted-foreground">
          <li>Buka Telegram, cari <span className="font-mono text-foreground">@BotFather</span>.</li>
          <li>Ketik <span className="font-mono text-foreground">/newbot</span>, beri nama (mis. "FnB ERP Owner Bot").</li>
          <li>BotFather akan kasih <strong>token</strong> formatnya <span className="font-mono text-foreground">1234567890:ABC-DEF...</span></li>
          <li><strong>Paste token tersebut di kotak "Telegram Bot Configuration" di atas</strong> → klik Simpan & Verify. Bot akan otomatis dicek.</li>
          <li>Setelah verified, ketik <span className="font-mono text-foreground">/start</span> ke bot → bot kasih <strong>chat_id</strong> Anda.</li>
          <li>Paste chat_id di subscription form di bawah.</li>
          <li>(Opsional) Klik "Setup Webhook" supaya bot bisa receive command real-time — butuh public URL backend.</li>
        </ol>
      </div>

      {/* Subscriptions list */}
      <div className="glass-card p-5" data-testid="digest-subscriptions-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Subscriptions Aktif</h3>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadPreview} className="gap-1" data-testid="owner-preview-btn">
              <ExternalLink className="h-3 w-3" /> Preview Digest
            </Button>
            <Button size="sm" onClick={sendNow} disabled={busy} className="gap-1" data-testid="owner-send-now">
              <Send className="h-3 w-3" /> Kirim Sekarang
            </Button>
          </div>
        </div>

        {subs.length === 0 ? (
          <EmptyState title="Belum ada subscription" description="Tambah satu di bawah." />
        ) : (
          <ul className="space-y-2">
            {subs.map((s) => {
              const meta = CHANNEL_META[s.channel] || CHANNEL_META.inapp;
              const Icon = meta.icon;
              return (
                <li key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border">
                  <span className={cn("h-9 w-9 rounded-xl flex items-center justify-center", meta.tone)}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold flex items-center gap-2">
                      {meta.label}
                      {s.enabled
                        ? <Badge variant="default" className="text-[10px]">Active</Badge>
                        : <Badge variant="outline" className="text-[10px]">Paused</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Target: <span className="font-mono">{s.target}</span>
                      {s.last_sent_at && <> • Last sent: {fmtDateTime(s.last_sent_at)}</>}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => toggle(s)} disabled={busy}>
                    {s.enabled ? "Pause" : "Resume"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(s)} disabled={busy}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Add subscription */}
      <div className="glass-card p-5">
        <h3 className="font-semibold mb-3">Tambah Subscription</h3>
        {!adding ? (
          <div className="flex flex-wrap gap-2">
            {Object.keys(CHANNEL_META).map((c) => {
              const m = CHANNEL_META[c];
              const Icon = m.icon;
              return (
                <Button key={c} variant="outline" onClick={() => { setAdding(c); setTarget(""); }}
                        className="gap-2" data-testid={`owner-add-${c}`}>
                  <Icon className="h-4 w-4" /> {m.label}
                </Button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>Channel</Label>
              <div className="flex items-center gap-2 mt-1">
                <Badge>{CHANNEL_META[adding].label}</Badge>
                <Button size="sm" variant="ghost" onClick={() => setAdding(null)}>
                  <X className="h-3 w-3" /> ganti
                </Button>
              </div>
            </div>
            <div>
              <Label>Target</Label>
              <Input value={target} onChange={(e) => setTarget(e.target.value)}
                     placeholder={CHANNEL_META[adding].placeholder} data-testid="owner-target-input" />
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => add(adding)} disabled={busy || !target.trim()} className="gap-1">
                <Check className="h-3.5 w-3.5" /> Simpan
              </Button>
              <Button variant="outline" onClick={() => setAdding(null)}>Batal</Button>
            </div>
          </div>
        )}
      </div>

      {/* Preview */}
      {preview && (
        <div className="glass-card p-5">
          <h3 className="font-semibold mb-2">Telegram Preview</h3>
          <pre className="text-xs whitespace-pre-wrap font-mono p-4 rounded-lg bg-muted/40 border">
            {preview.telegram_text}
          </pre>
        </div>
      )}
    </div>
  );
}
