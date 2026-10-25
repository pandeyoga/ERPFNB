/** Phase 12D — Telegram test panel (right rail). */
import { useState } from "react";
import { CheckCircle2, ExternalLink, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { promptDialog } from "@/components/shared/confirmDialog";

export default function TelegramTestPanel({ onReload }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [ephemToken, setEphemToken] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");

  async function test(useEphemeral) {
    setBusy(true);
    try {
      const body = useEphemeral && ephemToken ? { token: ephemToken.trim() } : {};
      const r = await api.post("/system-settings/test/telegram", body);
      const res = unwrap(r);
      setResult(res);
      if (res.ok) toast.success(`Bot @${res.bot?.username} aktif`);
      else toast.error(res.reason || "Bot tidak terjangkau");
    } catch {
      toast.error("Test bot gagal");
    } finally { setBusy(false); }
  }

  async function setupWebhook() {
    // URL dipakai langsung dari variabel lokal — sebelumnya nilai hasil prompt di-set ke state
    // lalu request tetap memakai state lama (kosong), sehingga URL yang diketik tidak terkirim.
    let url = webhookUrl.trim();
    if (!url) {
      const baseHint = window.location.origin.replace(/\/$/, "");
      const entered = await promptDialog({
        title: "Daftarkan webhook Telegram",
        description: "Masukkan URL backend publik. Path '/api/telegram/webhook' akan ditambahkan otomatis.",
        label: "URL backend publik",
        placeholder: "https://app.example.com",
        defaultValue: baseHint || "",
        confirmText: "Daftarkan",
      });
      if (!entered || !entered.trim()) return;
      url = entered.trim();
      setWebhookUrl(url);
    }
    setBusy(true);
    try {
      const r = await api.post("/system-settings/telegram/set-webhook", { url: url || undefined });
      const res = unwrap(r);
      if (res.ok) {
        toast.success(`Webhook terdaftar: ${res.url}`);
        onReload?.();
      } else {
        toast.error(res.reason || res.description || "Set webhook gagal");
      }
    } catch (e) {
      toast.error(e?.response?.data?.errors?.[0]?.message || "Set webhook gagal");
    } finally { setBusy(false); }
  }

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-8 w-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
          <MessageSquare className="h-4 w-4" />
        </span>
        <div>
          <h3 className="font-semibold text-sm">Tes Telegram</h3>
          <p className="text-[11px] text-muted-foreground">Panggil getMe & daftarkan webhook</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs md:text-sm font-medium">Verifikasi token tersimpan</p>
          <Button
            size="sm" onClick={() => test(false)} disabled={busy}
            className="w-full mt-1" data-testid="telegram-test-saved">
            <CheckCircle2 />
            {busy ? "Menguji…" : "Tes Token Tersimpan"}
          </Button>
        </div>

        <div>
          <Label htmlFor="telegram-ephemeral-input" className="text-xs md:text-sm font-medium">Tes token sementara (tidak disimpan)</Label>
          <Input
            id="telegram-ephemeral-input"
            value={ephemToken} onChange={(e) => setEphemToken(e.target.value)}
            placeholder="123456:ABC-..."
            className="font-mono text-xs mt-1"
            data-testid="telegram-ephemeral-input"
          />
          <Button
            size="sm" variant="outline" onClick={() => test(true)}
            disabled={busy || !ephemToken.trim()}
            className="w-full mt-2" data-testid="telegram-test-ephemeral">
            Tes (tanpa simpan)
          </Button>
        </div>

        <div>
          <Label htmlFor="telegram-webhook-url" className="text-xs md:text-sm font-medium">URL webhook publik (opsional)</Label>
          <Input
            id="telegram-webhook-url"
            value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://app.example.com"
            className="text-xs mt-1"
            data-testid="telegram-webhook-url"
          />
          <Button
            size="sm" variant="outline" onClick={setupWebhook} disabled={busy}
            className="w-full mt-2" data-testid="telegram-setup-webhook">
            <ExternalLink /> Daftarkan Webhook
          </Button>
        </div>

        {result && (
          <pre className="mt-2 p-2 rounded bg-muted text-[11px] overflow-x-auto max-h-40">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}

        <p className="text-[11px] text-muted-foreground">
          Cara dapat token: chat <a className="underline" href="https://t.me/BotFather" target="_blank" rel="noreferrer">@BotFather</a> → /newbot
        </p>
      </div>
    </div>
  );
}
