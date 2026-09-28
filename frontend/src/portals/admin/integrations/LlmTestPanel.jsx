/** Phase 12D — LLM test panel (verifies key + provider + model).  */
import { useState } from "react";
import { Brain, Sparkles } from "lucide-react";
import { toast } from "sonner";

import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const PROMPTS = [
  "Reply with the single word: OK",
  "Halo, balas dengan 1 kalimat singkat dalam bahasa Indonesia.",
  "Apa nama ibukota Indonesia? Jawab dalam 1 kata.",
];

export default function LlmTestPanel() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [prompt, setPrompt] = useState(PROMPTS[0]);
  const [ephemKey, setEphemKey] = useState("");
  const [ephemProvider, setEphemProvider] = useState("");
  const [ephemModel, setEphemModel] = useState("");

  async function test(useEphemeral) {
    setBusy(true);
    try {
      const body = { prompt: prompt.trim() };
      if (useEphemeral) {
        if (ephemKey.trim()) body.api_key = ephemKey.trim();
        if (ephemProvider.trim()) body.provider = ephemProvider.trim();
        if (ephemModel.trim()) body.model = ephemModel.trim();
      }
      const r = await api.post("/system-settings/test/llm", body);
      const res = unwrap(r);
      setResult(res);
      if (res.ok) toast.success(`LLM OK — ${res.elapsed_ms}ms (${res.provider}/${res.model})`);
      else toast.error(res.reason || res.error || "LLM gagal");
    } catch (e) {
      toast.error(e?.response?.data?.errors?.[0]?.message || "Test LLM gagal");
    } finally { setBusy(false); }
  }

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-8 w-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
          <Brain className="h-4 w-4" />
        </span>
        <div>
          <h3 className="font-semibold text-sm">Test LLM</h3>
          <p className="text-[10px] text-muted-foreground">Verify API key, provider, model</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs">Test Prompt</Label>
          <div className="flex gap-1 flex-wrap mt-1 mb-1">
            {PROMPTS.map((p) => (
              <button key={p} onClick={() => setPrompt(p)}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-muted hover:bg-muted/70">
                {p.slice(0, 24)}…
              </button>
            ))}
          </div>
          <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
                    rows={2} className="text-xs" data-testid="llm-test-prompt" />
        </div>

        <Button size="sm" onClick={() => test(false)} disabled={busy || !prompt.trim()}
                className="w-full gap-1" data-testid="llm-test-saved">
          <Sparkles className="h-3.5 w-3.5" />
          {busy ? "Testing…" : "Test Saved Config"}
        </Button>

        <details className="text-xs">
          <summary className="cursor-pointer font-medium">Test ephemeral (no save)</summary>
          <div className="space-y-2 mt-2">
            <Input value={ephemKey} onChange={(e) => setEphemKey(e.target.value)}
                   placeholder="sk-... (ephemeral key)" className="font-mono text-xs" />
            <Input value={ephemProvider} onChange={(e) => setEphemProvider(e.target.value)}
                   placeholder="provider (gemini/openai/anthropic)" className="font-mono text-xs" />
            <Input value={ephemModel} onChange={(e) => setEphemModel(e.target.value)}
                   placeholder="model (gemini-2.5-flash)" className="font-mono text-xs" />
            <Button size="sm" variant="outline" onClick={() => test(true)}
                    disabled={busy} className="w-full">Test ephemeral</Button>
          </div>
        </details>

        {result && (
          <div className="space-y-2">
            {result.ok ? (
              <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-xs">
                <div className="text-emerald-700 font-semibold mb-1">✓ OK ({result.elapsed_ms}ms)</div>
                <div className="text-[10px] text-muted-foreground mb-1">
                  {result.provider} / {result.model}
                </div>
                <div className="font-mono text-xs">{result.response}</div>
              </div>
            ) : (
              <div className="p-2 rounded bg-rose-50 border border-rose-200 text-xs">
                <div className="text-rose-700 font-semibold mb-1">✗ Failed</div>
                <div className="text-[10px]">{result.reason} {result.error}</div>
              </div>
            )}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground">
          💡 Default pakai Emergent Universal Key. Set <code>OPENAI_API_KEY</code>/<code>ANTHROPIC_API_KEY</code>/<code>GEMINI_API_KEY</code>
          + ubah <code>LLM_PROVIDER_PRIMARY</code> untuk pakai key langsung.
        </p>
      </div>
    </div>
  );
}
