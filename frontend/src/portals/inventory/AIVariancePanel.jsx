/** AI Variance Explainer Panel — LLM-powered insight for OpnameSession.
 *
 * Non-blocking: button to trigger; result rendered below.
 * Auth: requires `ai.variance.explain` permission (or fallback `outlet.opname.execute`).
 */
import { memo, useState } from "react";
import { Sparkles, AlertCircle, CheckCircle2, Lightbulb, Loader2, RefreshCw } from "lucide-react";
import api, { unwrap, unwrapError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";

function AIVariancePanel({ sessionId, hasVariance, disabled }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(`/ai/opname/${sessionId}/explain-variance`, {});
      const data = unwrap(res) || {};
      if (data.error) {
        setError(data.error);
        toast.error(data.error);
      } else {
        setResult(data);
        toast.success("Analisis variance siap");
      }
    } catch (e) {
      const msg = unwrapError(e);
      setError(msg);
      logger.warn("AI variance failed", { error: msg });
      toast.error(`Gagal: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  if (disabled) return null;

  return (
    <div className="glass-card p-5 space-y-3" data-testid="ai-variance-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl grad-aurora-soft flex items-center justify-center">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm inline-flex items-center gap-2">
              AI Variance Explainer
              <Badge variant="secondary" className="text-[10px] gap-1">
                <Sparkles className="h-2.5 w-2.5" />
                Beta
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground">
              Analisis cepat penyebab variance + rekomendasi tindak lanjut.
            </p>
          </div>
        </div>
        {!result && (
          <Button
            onClick={run}
            disabled={loading || !hasVariance}
            className="rounded-full gap-2 pill-active"
            data-testid="ai-variance-run"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Menganalisis…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Analisis dengan AI
              </>
            )}
          </Button>
        )}
        {result && (
          <Button
            onClick={run}
            disabled={loading}
            variant="outline"
            size="sm"
            className="rounded-full gap-2"
            data-testid="ai-variance-rerun"
          >
            <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
            Re-analisis
          </Button>
        )}
      </div>

      {!hasVariance && !result && (
        <div className="text-xs text-muted-foreground italic flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          Tidak ada variance terdeteksi pada sesi ini. AI explainer tidak diperlukan.
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-xs text-red-600 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="space-y-3 pt-2 border-t border-border/40" data-testid="ai-variance-result">
          {/* Summary */}
          {result.summary && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Ringkasan
                </span>
                {result.confidence != null && (
                  <Badge variant="secondary" className={cn(
                    "text-[10px]",
                    result.confidence >= 0.7 ? "text-emerald-600" :
                    result.confidence >= 0.4 ? "text-amber-600" : "text-rose-600",
                  )}>
                    {(result.confidence * 100).toFixed(0)}% confidence
                  </Badge>
                )}
              </div>
              <p className="text-sm leading-relaxed" data-testid="ai-variance-summary">{result.summary}</p>
            </div>
          )}

          {/* Top drivers */}
          {result.top_drivers && result.top_drivers.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Top Drivers ({result.top_drivers.length})
              </div>
              <div className="space-y-1.5">
                {result.top_drivers.map((d, idx) => (
                  <div
                    key={idx}
                    className="glass-input rounded-lg px-3 py-2 text-xs space-y-0.5"
                    data-testid={`ai-variance-driver-${idx}`}
                  >
                    <div className="font-semibold">{d.item_name}</div>
                    {d.finding && (
                      <div className="text-muted-foreground">{d.finding}</div>
                    )}
                    {d.suspect && (
                      <div className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300">
                        <Lightbulb className="h-3 w-3" />
                        {d.suspect}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended actions */}
          {result.recommended_actions && result.recommended_actions.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Rekomendasi Tindak Lanjut
              </div>
              <ul className="space-y-1">
                {result.recommended_actions.map((a, idx) => (
                  <li
                    key={idx}
                    className="text-xs flex items-start gap-1.5"
                    data-testid={`ai-variance-action-${idx}`}
                  >
                    <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0 text-emerald-600" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(AIVariancePanel);
