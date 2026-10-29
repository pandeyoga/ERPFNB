/** Phase 12D — Email (Resend) test panel. */
import { useState } from "react";
import { Mail, Send } from "lucide-react";
import { toast } from "sonner";

import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";

export default function EmailTestPanel() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [to, setTo] = useState(user?.email || "");
  const [ephemKey, setEphemKey] = useState("");
  const [ephemFrom, setEphemFrom] = useState("");

  async function test(useEphemeral) {
    if (!to.trim()) { toast.error("Masukkan alamat tujuan email"); return; }
    setBusy(true);
    try {
      const body = { to: to.trim() };
      if (useEphemeral) {
        if (ephemKey.trim()) body.api_key = ephemKey.trim();
        if (ephemFrom.trim()) body.from = ephemFrom.trim();
      }
      const r = await api.post("/system-settings/test/resend", body);
      const res = unwrap(r);
      setResult(res);
      if (res.status === "sent") toast.success(`Email terkirim! id=${res.provider_message_id}`);
      else if (res.status === "mocked") toast.warning("Mode simulasi — RESEND_API_KEY belum diisi");
      else toast.error(res.error || "Gagal kirim");
    } catch (e) {
      toast.error(e?.response?.data?.errors?.[0]?.message || "Gagal");
    } finally { setBusy(false); }
  }

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-8 w-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
          <Mail className="h-4 w-4" />
        </span>
        <div>
          <h3 className="font-semibold text-sm">Tes Email (Resend)</h3>
          <p className="text-xs text-muted-foreground">Kirim email uji ke alamat mana pun</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Label htmlFor="email-test-to" className="text-xs md:text-sm font-medium">Penerima (To)</Label>
          <Input
            id="email-test-to"
            type="email" value={to} onChange={(e) => setTo(e.target.value)}
            className="text-xs mt-1" data-testid="email-test-to"
          />
        </div>

        <Button
          size="sm" onClick={() => test(false)} disabled={busy || !to.trim()}
          className="w-full" data-testid="email-test-saved">
          <Send />
          {busy ? "Mengirim…" : "Kirim Tes (Konfigurasi Tersimpan)"}
        </Button>

        <details className="text-xs">
          <summary className="cursor-pointer font-medium">Tes API key sementara (tidak disimpan)</summary>
          <div className="space-y-2 mt-2">
            <Input value={ephemKey} onChange={(e) => setEphemKey(e.target.value)}
                   aria-label="API key Resend sementara"
                   placeholder="re_XXXX (sementara)" className="font-mono text-xs" />
            <Input value={ephemFrom} onChange={(e) => setEphemFrom(e.target.value)}
                   aria-label="Alamat pengirim (override From)"
                   placeholder="sender@yourdomain.com (override From)" className="text-xs" />
            <Button size="sm" variant="outline" onClick={() => test(true)}
                    disabled={busy || !ephemKey.trim()} className="w-full">
              Tes key sementara
            </Button>
          </div>
        </details>

        {result && (
          <pre className="p-2 rounded bg-muted text-xs overflow-x-auto max-h-40">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}

        <p className="text-xs text-muted-foreground">
          Pengirim sandbox Resend <code>onboarding@resend.dev</code> hanya bisa kirim ke email pemilik akun.
          Verify domain di <a href="https://resend.com/domains" target="_blank" rel="noreferrer" className="underline">resend.com/domains</a> untuk kirim ke siapapun.
        </p>
      </div>
    </div>
  );
}
