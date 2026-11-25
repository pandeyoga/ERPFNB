/** Tes koneksi Claude (Anthropic) — memakai kunci & model tersimpan, atau kunci/model sementara (tidak disimpan). */
import { useState } from "react";
import { Brain, Sparkles } from "lucide-react";
import { toast } from "sonner";

import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const PROMPTS = [
  "Balas satu kata: OK",
  "Halo, balas dengan 1 kalimat singkat dalam bahasa Indonesia.",
  "Apa nama ibukota Indonesia? Jawab dalam 1 kata.",
];

const REASONS = {
  no_api_key: "ANTHROPIC_API_KEY belum diisi.",
  ai_disabled_policy: "AI dimatikan lewat tombol darurat (AI Hub → Pengaturan).",
  ai_disabled_env: "AI dimatikan di server (FEATURE_AI_ENABLED=false).",
  llm_error: "Claude menolak permintaan atau terjadi galat jaringan.",
};

export default function LlmTestPanel() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [prompt, setPrompt] = useState(PROMPTS[0]);
  const [ephemKey, setEphemKey] = useState("");
  const [ephemModel, setEphemModel] = useState("");

  async function test(useEphemeral) {
    setBusy(true);
    try {
      const body = { prompt: prompt.trim() };
      if (useEphemeral) {
        if (ephemKey.trim()) body.api_key = ephemKey.trim();
        if (ephemModel.trim()) body.model = ephemModel.trim();
      }
      const res = unwrap(await api.post("/system-settings/test/llm", body));
      setResult(res);
      if (res.ok) toast.success(`Claude OK — ${res.elapsed_ms} ms (${res.model})`);
      else toast.error(REASONS[res.reason] || res.error || "Tes gagal");
    } catch (e) {
      toast.error(e?.response?.data?.errors?.[0]?.message || "Tes gagal");
    } finally { setBusy(false); }
  }

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
          <Brain className="h-4 w-4" />
        </span>
        <div>
          <h3 className="font-semibold text-base">Tes Claude</h3>
          <p className="text-xs text-muted-foreground">Verifikasi API key dan model</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Label htmlFor="llm-test-prompt" className="text-xs md:text-sm font-medium">Prompt uji</Label>
          <div className="flex gap-1 flex-wrap mt-1 mb-1">
            {PROMPTS.map((p) => (
              <Button key={p} type="button" size="sm" variant="outline" aria-pressed={prompt === p}
                onClick={() => setPrompt(p)} title={p}>
                {p.slice(0, 24)}…
              </Button>
            ))}
          </div>
          <Textarea id="llm-test-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)}
            rows={2} className="text-xs" data-testid="llm-test-prompt" />
        </div>

        <Button size="sm" onClick={() => test(false)} disabled={busy || !prompt.trim()}
          className="w-full" data-testid="llm-test-saved">
          <Sparkles />
          {busy ? "Menguji…" : "Tes Konfigurasi Tersimpan"}
        </Button>

        <details className="text-xs">
          <summary className="cursor-pointer font-medium">Tes key sementara (tidak disimpan)</summary>
          <div className="space-y-2 mt-2">
            <Input value={ephemKey} onChange={(e) => setEphemKey(e.target.value)} aria-label="API key sementara"
              placeholder="sk-ant-… (key sementara)" className="font-mono text-xs" />
            <Input value={ephemModel} onChange={(e) => setEphemModel(e.target.value)} aria-label="Model"
              placeholder="claude-opus-5-5" className="text-xs" />
            <Button size="sm" variant="outline" onClick={() => test(true)} disabled={busy} className="w-full">
              Tes key sementara
            </Button>
          </div>
        </details>

        {result && (
          <div className="rounded-lg border border-border p-2 text-xs" data-testid="llm-test-result">
            {result.ok ? (
              <>
                <div className="text-emerald-700 dark:text-emerald-400 font-semibold mb-1">Berhasil ({result.elapsed_ms} ms)</div>
                <div className="text-muted-foreground mb-1">{result.model}</div>
                <div>{result.response}</div>
              </>
            ) : (
              <>
                <div className="text-red-700 dark:text-red-400 font-semibold mb-1">Gagal</div>
                <div>{REASONS[result.reason] || result.reason} {result.error}</div>
              </>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Semua fitur AI memakai Claude lewat <code>ANTHROPIC_API_KEY</code>. Model diatur di <code>AI_MODEL</code>
          (default <code>claude-opus-5-5</code>).
        </p>
      </div>
    </div>
  );
}
