/** Phase 12D — Telegram test panel (right rail). */
import { useState } from "react";
import { CheckCircle2, ExternalLink, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    if (!webhookUrl.trim()) {
      const baseHint = window.location.origin.replace(/\/$/, "");
      const url = window.prompt(
        "Masukkan public backend URL (mis. https://app.example.com).\nPath '/api/telegram/webhook' akan otomatis ditambahkan.",
        baseHint || "",
      );
      if (!url) return;
      setWebhookUrl(url);
    }
    setBusy(true);
    try {
      const r = await api.post("/system-settings/telegram/set-webhook", { url: webhookUrl.trim() || undefined });
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
          <h3 className="font-semibold text-sm">Test Telegram</h3>
          <p className="text-[10px] text-muted-foreground">Panggil getMe & setup webhook</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs">Verify saved token</Label>
          <Button
            size="sm" onClick={() => test(false)} disabled={busy}
            className="w-full gap-1 mt-1" data-testid="telegram-test-saved">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {busy ? "Testing…" : "Test Saved Token"}
          </Button>
        </div>

        <div>
          <Label className="text-xs">Test ephemeral token (no save)</Label>
          <Input
            value={ephemToken} onChange={(e) => setEphemToken(e.target.value)}
            placeholder="123456:ABC-..."
            className="font-mono text-xs mt-1"
            data-testid="telegram-ephemeral-input"
          />
          <Button
            size="sm" variant="outline" onClick={() => test(true)}
            disabled={busy || !ephemToken.trim()}
            className="w-full mt-2" data-testid="telegram-test-ephemeral">
            Test (don’t save)
          </Button>
        </div>

        <div>
          <Label className="text-xs">Public webhook URL (optional)</Label>
          <Input
            value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://app.example.com"
            className="font-mono text-xs mt-1"
          />
          <Button
            size="sm" variant="outline" onClick={setupWebhook} disabled={busy}
            className="w-full mt-2 gap-1" data-testid="telegram-setup-webhook">
            <ExternalLink className="h-3.5 w-3.5" /> Setup Webhook
          </Button>
        </div>

        {result && (
          <pre className="mt-2 p-2 rounded bg-muted text-[10px] overflow-x-auto max-h-40">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}

        <p className="text-[10px] text-muted-foreground">
          💡 Cara dapat token: chat <a className="underline" href="https://t.me/BotFather" target="_blank" rel="noreferrer">@BotFather</a> → /newbot
        </p>
      </div>
    </div>
  );
}
