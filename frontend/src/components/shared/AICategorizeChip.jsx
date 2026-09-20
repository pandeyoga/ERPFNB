/** AI Categorize chip — Phase 9D.
 *
 * Watches a description string; debounces 600ms; calls /api/ai/categorize.
 * Shows a suggestion chip (chosen GL + optional outlet cost center) with
 * confidence badge. Click → apply. "Belajar" → saves a rule.
 *
 * Props:
 *   description (string)         — the input to classify
 *   amount      (number, opt)    — amount for context
 *   outletId    (string, opt)    — hint for cost-center
 *   confidenceThreshold (0-1)    — only show if conf >= threshold (default 0.7)
 *   onApply     (fn)             — called with { gl_id, gl_code, gl_name, cost_center_outlet_id?, cost_center_outlet_name? }
 *   testId      (string, opt)
 */
import { useEffect, useState, useRef } from "react";
import { Sparkles, Check, X, BookOpen, Loader2 } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function AICategorizeChip({
  description, amount = 0, outletId,
  confidenceThreshold = 0.7,
  onApply,
  testId = "ai-categ-chip",
  showAlways = false,
}) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [learning, setLearning] = useState(false);
  const lastDescRef = useRef("");

  useEffect(() => {
    const d = (description || "").trim();
    setDismissed(false);
    setRevealed(false);
    if (d.length < 4) { setSuggestion(null); return; }
    if (d === lastDescRef.current) return;
    const t = setTimeout(async () => {
      lastDescRef.current = d;
      setLoading(true);
      try {
        const res = await api.post("/ai/categorize", {
          description: d, amount: Number(amount) || 0,
          outlet_id: outletId || undefined,
        });
        const data = unwrap(res);
        if (data && data.gl_code) {
          setSuggestion(data);
        } else {
          setSuggestion(null);
        }
      } catch (e) {
        // Silent: don't disrupt user typing flow
        setSuggestion(null);
      } finally { setLoading(false); }
    }, 600);
    return () => clearTimeout(t);
  }, [description, amount, outletId]);

  if (loading) {
    return (
      <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground italic" data-testid={`${testId}-loading`}>
        <Loader2 className="h-3 w-3 animate-spin" /> Menganalisa…
      </div>
    );
  }
  if (!suggestion || dismissed) return null;
  const confPct = Math.round((suggestion.confidence || 0) * 100);
  const passesThreshold = (suggestion.confidence || 0) >= confidenceThreshold;
  if (!passesThreshold && !revealed && !showAlways) {
    return (
      <button
        type="button"
        onClick={() => setRevealed(true)}
        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground italic"
        data-testid={`${testId}-low-conf`}
      >
        <Sparkles className="h-3 w-3" /> Saran AI tersedia (conf {confPct}%) — klik untuk lihat
      </button>
    );
  }
  const confColorClass = passesThreshold
    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
    : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";

  async function handleLearn() {
    setLearning(true);
    try {
      // Use the keywords (first ~3 significant tokens) as a learn pattern
      const tokens = (description || "").toLowerCase()
        .replace(/[^a-z0-9 \u00C0-\u017F]/g, " ")
        .split(/\s+/)
        .filter(t => t.length > 2);
      if (tokens.length < 1) {
        toast.error("Deskripsi terlalu pendek untuk dijadikan rule");
        return;
      }
      const pattern = tokens.slice(0, 3).join(".*");
      await api.post("/ai/categorize/learn", {
        pattern,
        gl_account_id: suggestion.gl_id,
      });
      toast.success(`Tersimpan: "${pattern}" → ${suggestion.gl_code}`);
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal belajar");
    } finally { setLearning(false); }
  }

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full border bg-background/80 backdrop-blur text-[11px]"
      data-testid={testId}
    >
      <Sparkles className="h-3 w-3 text-violet-500 shrink-0" />
      <span className="text-muted-foreground">Saran:</span>
      <span className="font-semibold tabular-nums">{suggestion.gl_code}</span>
      <span className="text-foreground/80 truncate max-w-[160px]">{suggestion.gl_name}</span>
      {suggestion.cost_center_outlet_name && (
        <span className="text-[10px] text-muted-foreground">
          · {suggestion.cost_center_outlet_name}
        </span>
      )}
      <span className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded border ${confColorClass}`}>
        {confPct}%
      </span>
      <button
        type="button"
        title="Terapkan saran"
        onClick={() => {
          onApply?.(suggestion);
          toast.success(`Terapkan ${suggestion.gl_code}`);
          setDismissed(true);
        }}
        className="inline-flex items-center gap-0.5 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 rounded px-1"
        data-testid={`${testId}-apply`}
      >
        <Check className="h-3 w-3" />
      </button>
      <button
        type="button"
        title="Belajar pola ini"
        onClick={handleLearn}
        disabled={learning || suggestion.source === "rule"}
        className="inline-flex items-center gap-0.5 text-violet-700 dark:text-violet-300 hover:bg-violet-500/10 rounded px-1 disabled:opacity-40"
        data-testid={`${testId}-learn`}
      >
        {learning ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookOpen className="h-3 w-3" />}
      </button>
      <button
        type="button"
        title="Tutup"
        onClick={() => setDismissed(true)}
        className="inline-flex items-center gap-0.5 text-muted-foreground hover:bg-foreground/10 rounded px-1"
        data-testid={`${testId}-dismiss`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
