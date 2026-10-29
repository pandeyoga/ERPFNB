/** Phase 11C — Owner Digest Settings (Telegram + In-app + Email) + Bot Token config (11C++).  */
import { useEffect, useState } from "react";
import {
  Bell, BellRing, MessageCircle, Mail, Phone, Trash2, Check, X, ExternalLink, Send,
} from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import PageHeader from "@/components/shared/PageHeader";
import SystemSettingsCard from "@/components/shared/SystemSettingsCard";
import { fmtDateTime } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { confirmDialog } from "@/components/shared/confirmDialog";

const CHANNEL_META = {
  telegram: { icon: MessageCircle, label: "Telegram",   placeholder: "Chat ID (mis. 123456789)", tone: "text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40" },
  whatsapp: { icon: Phone,         label: "WhatsApp",   placeholder: "Nomor (mis. +628123456789)", tone: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40" },
  inapp:    { icon: Bell,          label: "In-App Notification", placeholder: "akan muncul di bell icon", tone: "text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40" },
  email:    { icon: Mail,          label: "Email",      placeholder: "owner@email.com (butuh RESEND_API_KEY)", tone: "text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40" },
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
    } catch { toast.error("Gagal memuat preview"); }
  }

  async function add(channel) {
    if (!target.trim()) { toast.error("Target wajib diisi"); return; }
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
      toast.error(e?.response?.data?.errors?.[0]?.message || "Gagal menambah subscription");
    } finally { setBusy(false); }
  }

  async function toggle(sub) {
    setBusy(true);
    try {
      await api.post("/owner/digest/subscriptions", {
        channel: sub.channel, target: sub.target, enabled: !sub.enabled,
      });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.errors?.[0]?.message || "Gagal mengubah status subscription");
    } finally { setBusy(false); }
  }

  async function remove(sub) {
    if (!(await confirmDialog(`Hapus subscription ${sub.channel}?`))) return;
    setBusy(true);
    try {
      await api.delete(`/owner/digest/subscriptions/${sub.id}`);
      toast.success("Subscription dihapus"); load();
    } catch (e) {
      toast.error(e?.response?.data?.errors?.[0]?.message || "Gagal menghapus subscription");
    } finally { setBusy(false); }
  }

  async function sendNow() {
    setBusy(true);
    try {
      const r = await api.post("/owner/digest/send-now");
      const res = unwrap(r);
      toast.success(`Terkirim ke: ${res.channels?.join(", ") || "—"}`);
    } catch (e) {
      toast.error(e?.response?.data?.errors?.[0]?.message || "Gagal mengirim digest");
    } finally { setBusy(false); }
  }

  const headerActions = (
    <>
      <Button variant="outline" onClick={loadPreview} data-testid="owner-preview-btn">
        <ExternalLink /> Pratinjau Digest
      </Button>
      <Button onClick={sendNow} disabled={busy} data-testid="owner-send-now">
        <Send /> Kirim Sekarang
      </Button>
    </>
  );
  const header = (
    <div data-testid="digest-header">
      <PageHeader
        icon={BellRing}
        title="Alert Settings"
        subtitle="Tiap pagi 06:00 WIB Anda akan menerima ringkasan keuangan group (daily digest) via channel di bawah."
        actions={headerActions}
        className="mb-0 md:mb-0"
      />
    </div>
  );

  if (loading) return (
    <div className="space-y-3 lg:space-y-4" data-testid="digest-settings-page">
      {header}
      <LoadingState message="Memuat pengaturan…" />
    </div>
  );

  const telegramConfigured = tgInfo?.configured;
  const botUsername = tgInfo?.bot?.result?.username;

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="digest-settings-page">
      {header}

      {/* Subscriptions list + add form (satu kartu: daftar → tambah) */}
      <div className="glass-card p-4" data-testid="digest-subscriptions-card">
        <h2 className="text-sm md:text-base font-semibold mb-2">Subscription Aktif</h2>

        {subs.length === 0 ? (
          <EmptyState icon={Bell} title="Belum ada subscription" description="Tambahkan channel pertama Anda di bawah." />
        ) : (
          <ul className="divide-y divide-border/40">
            {subs.map((s) => {
              const meta = CHANNEL_META[s.channel] || CHANNEL_META.inapp;
              const Icon = meta.icon;
              return (
                <li key={s.id} className="flex items-center gap-3 py-2.5" data-testid={`digest-sub-${s.id}`}>
                  <span className={cn("h-8 w-8 rounded-[calc(var(--radius)-2px)] flex items-center justify-center shrink-0", meta.tone)}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold flex items-center gap-2">
                      {meta.label}
                      {s.enabled
                        ? <Badge variant="default" className="text-xs">Aktif</Badge>
                        : <Badge variant="outline" className="text-xs">Dijeda</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      Target: <span className="font-mono">{s.target}</span>
                      {s.last_sent_at && <> • Terakhir dikirim: {fmtDateTime(s.last_sent_at)}</>}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => toggle(s)} disabled={busy} data-testid={`digest-toggle-${s.id}`}>
                    {s.enabled ? "Jeda" : "Lanjutkan"}
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => remove(s)} disabled={busy}
                          aria-label={`Hapus subscription ${meta.label}`} title="Hapus" data-testid={`digest-delete-${s.id}`}>
                    <Trash2 className="text-rose-700 dark:text-rose-400" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Add subscription */}
        <div className="mt-3 pt-3 border-t border-border/50">
          <h3 className="text-sm font-semibold mb-2">Tambah Subscription</h3>
          {!adding ? (
            <div className="flex flex-wrap gap-2">
              {Object.keys(CHANNEL_META).map((c) => {
                const m = CHANNEL_META[c];
                const Icon = m.icon;
                return (
                  <Button key={c} variant="outline" onClick={() => { setAdding(c); setTarget(""); }}
                          data-testid={`owner-add-${c}`}>
                    <Icon /> {m.label}
                  </Button>
                );
              })}
            </div>
          ) : (
            <form
              className="space-y-3 max-w-xl"
              onSubmit={(e) => { e.preventDefault(); add(adding); }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs md:text-sm font-medium">Channel:</span>
                <Badge>{CHANNEL_META[adding].label}</Badge>
                <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(null)}>
                  Ganti
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="digest-target" className="text-xs md:text-sm font-medium">Target <span className="text-rose-700 dark:text-rose-400">*</span></Label>
                <Input id="digest-target" value={target} onChange={(e) => setTarget(e.target.value)}
                       placeholder={CHANNEL_META[adding].placeholder} data-testid="owner-target-input" required />
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => setAdding(null)}>Batal</Button>
                <Button type="submit" disabled={busy || !target.trim()} data-testid="owner-add-save">
                  <Check /> Simpan
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Preview */}
      {preview && (
        <div className="glass-card p-4" data-testid="digest-preview-card">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="text-sm md:text-base font-semibold">Preview Digest (Telegram)</h2>
            <Button variant="ghost" size="icon-sm" onClick={() => setPreview(null)} aria-label="Tutup preview">
              <X />
            </Button>
          </div>
          <pre className="text-xs whitespace-pre-wrap font-mono p-3 rounded-md bg-muted/40 border">
            {preview.telegram_text}
          </pre>
        </div>
      )}

      {/* Telegram setup walkthrough */}
      <div className="glass-card p-4" data-testid="telegram-setup-card">
        <div className="flex items-center gap-2 mb-2">
          <span className="h-8 w-8 rounded-[calc(var(--radius)-2px)] bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 flex items-center justify-center shrink-0">
            <MessageCircle className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm md:text-base font-semibold">Cara Setup Telegram Bot</h2>
            <div className="text-xs text-muted-foreground">
              Status: {telegramConfigured
                ? <span className="text-emerald-700 dark:text-emerald-400">Terkonfigurasi • @{botUsername || "bot"}</span>
                : <span className="text-amber-800 dark:text-amber-400">Belum dikonfigurasi</span>}
            </div>
          </div>
        </div>
        <ol className="text-xs space-y-1.5 list-decimal list-inside text-muted-foreground">
          <li>Buka Telegram, cari <span className="font-mono text-foreground">@BotFather</span>.</li>
          <li>Ketik <span className="font-mono text-foreground">/newbot</span>, beri nama (mis. "FnB ERP Owner Bot").</li>
          <li>BotFather akan memberi <strong>token</strong> berformat <span className="font-mono text-foreground">1234567890:ABC-DEF...</span></li>
          <li><strong>Tempel token tersebut di kartu "Telegram Bot Configuration" di bawah</strong> → klik Simpan & Verify. Bot akan otomatis dicek.</li>
          <li>Setelah terverifikasi, ketik <span className="font-mono text-foreground">/start</span> ke bot → bot memberi <strong>chat_id</strong> Anda.</li>
          <li>Tempel chat_id di form "Tambah Subscription" → Telegram di atas.</li>
          <li>(Opsional) Klik "Setup Webhook" supaya bot bisa menerima command real-time — butuh public URL backend.</li>
        </ol>
      </div>

      {/* System Settings (Phase 11C++) — Telegram token config */}
      {canManageSystem && (
        <SystemSettingsCard
          filterCategory="telegram"
          title="Telegram Bot Configuration"
        />
      )}
    </div>
  );
}
