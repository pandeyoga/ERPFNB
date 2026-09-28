/** Phase 12D — WhatsApp test panel. Provider-aware. */
import { useEffect, useState } from "react";
import { Phone, Send } from "lucide-react";
import { toast } from "sonner";

import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import IntegrationStatusPill from "@/components/shared/IntegrationStatusPill";

export default function WhatsAppTestPanel() {
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState({ provider: "unset", configured: false });
  const [result, setResult] = useState(null);
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("[FnB ERP] Test WhatsApp dari Integrations Hub.");

  async function loadInfo() {
    try {
      const r = await api.get("/system-settings/whatsapp/info");
      setInfo(unwrap(r));
    } catch { /* ignore */ }
  }
  useEffect(() => { loadInfo(); }, []);

  async function test() {
    if (!to.trim()) { toast.error("Masukkan nomor tujuan"); return; }
    setBusy(true);
    try {
      const r = await api.post("/system-settings/test/whatsapp", {
        to: to.trim(),
        message: message.trim(),
      });
      const res = unwrap(r);
      setResult(res);
      if (res.sent) toast.success(`WA terkirim via ${res.provider}!`);
      else if (res.status === "not_configured") toast.warning("WhatsApp belum dikonfigurasi");
      else toast.error(res.error || res.status || "Gagal kirim");
    } catch (e) {
      toast.error(e?.response?.data?.errors?.[0]?.message || "Gagal");
    } finally { setBusy(false); }
  }

  const status = info.configured ? "configured" : (info.provider === "unset" || info.provider === "disabled" ? "unset" : "failed");

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
          <Phone className="h-4 w-4" />
        </span>
        <div className="flex-1">
          <h3 className="font-semibold text-sm">Test WhatsApp</h3>
          <p className="text-[10px] text-muted-foreground">
            Active: <span className="font-mono">{info.provider}</span>
          </p>
        </div>
        <IntegrationStatusPill status={status} size="sm" />
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs">To (phone number)</Label>
          <Input value={to} onChange={(e) => setTo(e.target.value)}
                 placeholder="+628123456789 atau 08123..."
                 className="font-mono text-xs mt-1"
                 data-testid="wa-test-to" />
        </div>

        <div>
          <Label className="text-xs">Message</Label>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)}
                    rows={2} className="text-xs mt-1" />
        </div>

        <Button size="sm" onClick={test} disabled={busy || !to.trim() || !message.trim()}
                className="w-full gap-1" data-testid="wa-test-send">
          <Send className="h-3.5 w-3.5" />
          {busy ? "Sending…" : "Send Test WhatsApp"}
        </Button>

        {result && (
          <pre className="p-2 rounded bg-muted text-[10px] overflow-x-auto max-h-40">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}

        <div className="text-[10px] text-muted-foreground space-y-1">
          <p>
            💡 Pilih provider:
          </p>
          <ul className="list-disc ml-5 space-y-0.5">
            <li><b>fonnte</b> — paling simple buat Indonesia, butuh device aktif (<a href="https://fonnte.com" target="_blank" rel="noreferrer" className="underline">fonnte.com</a>)</li>
            <li><b>twilio</b> — sandbox + paid (<a href="https://www.twilio.com/whatsapp" target="_blank" rel="noreferrer" className="underline">twilio.com/whatsapp</a>)</li>
            <li><b>meta</b> — Cloud API (free tier), butuh Meta Business setup</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
