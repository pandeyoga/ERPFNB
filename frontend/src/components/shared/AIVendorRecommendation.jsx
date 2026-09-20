/** AI Vendor Recommendation — Phase 9D.
 *
 * Either inline tile (compact) or full modal.
 * Props:
 *   itemId      (string)  — required (or prId)
 *   prId        (string)  — optional, recommend per-line
 *   topK        (number)  — default 3
 *   onSelect    (fn)      — called with chosen vendor object {vendor_id, vendor_name, ...}
 *   variant     ("inline"|"modal") default inline
 *   triggerLabel (string) only used when variant=modal
 */
import { useEffect, useState } from "react";
import { Sparkles, Trophy, Award, Medal, Loader2, X, ChevronRight } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { fmtRp } from "@/lib/format";
import { toast } from "sonner";

function RankBadge({ rank }) {
  const Icon = rank === 0 ? Trophy : rank === 1 ? Award : Medal;
  const cls =
    rank === 0 ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30" :
    rank === 1 ? "bg-zinc-400/20 text-zinc-700 dark:text-zinc-300 border-zinc-400/30" :
                 "bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30";
  return (
    <div className={`h-7 w-7 rounded-full flex items-center justify-center border ${cls} shrink-0`}>
      <Icon className="h-3.5 w-3.5" />
    </div>
  );
}

function Candidates({ data, onSelect, compact = false }) {
  if (!data) return null;
  if (data.error) {
    return <div className="text-xs text-rose-600 italic">{data.error}</div>;
  }
  if (!data.candidates || data.candidates.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic">
        {data.note || "Belum ada riwayat pembelian untuk item ini."}
      </div>
    );
  }
  return (
    <div className="space-y-1.5" data-testid="vrec-candidates">
      {data.candidates.map((c, i) => (
        <div
          key={c.vendor_id}
          className="glass-input rounded-xl p-2.5 flex items-start gap-2.5"
          data-testid={`vrec-cand-${c.vendor_id}`}
        >
          <RankBadge rank={i} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold text-sm truncate">{c.vendor_name}</div>
              <div className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded border bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30 tabular-nums">
                {(c.score * 100).toFixed(0)}%
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground tabular-nums mt-0.5 flex flex-wrap gap-x-2">
              <span>avg {fmtRp(c.metrics?.avg_cost || 0)}</span>
              <span>last {fmtRp(c.metrics?.last_cost || 0)}</span>
              {c.metrics?.lead_time_avg != null && (
                <span>{c.metrics.lead_time_avg}d lead</span>
              )}
              <span>{c.metrics?.gr_count || 0} GR</span>
              {c.metrics?.scorecard > 0 && (
                <span>★ {c.metrics.scorecard.toFixed(1)}/5</span>
              )}
            </div>
            {!compact && c.rationale && (
              <div className="text-[11px] text-foreground/80 mt-1 italic leading-snug">
                “{c.rationale}”
              </div>
            )}
            {onSelect && (
              <Button
                size="sm" variant="outline"
                className="mt-1.5 h-6 px-2 text-[10px] rounded-full gap-1"
                onClick={() => onSelect(c)}
                data-testid={`vrec-select-${c.vendor_id}`}
              >
                Pilih <ChevronRight className="h-2.5 w-2.5" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AIVendorRecommendationInline({ itemId, prId, topK = 3, onSelect, compact = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!itemId && !prId) { setData(null); return; }
    setLoading(true);
    const body = itemId ? { item_id: itemId, top_k: topK } : { pr_id: prId, top_k: topK };
    api.post("/ai/vendor-recommend", body)
      .then(r => setData(unwrap(r)))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [itemId, prId, topK]);

  if (loading) {
    return (
      <div className="text-[11px] text-muted-foreground italic inline-flex items-center gap-1" data-testid="vrec-loading">
        <Loader2 className="h-3 w-3 animate-spin" /> Mencari rekomendasi vendor…
      </div>
    );
  }
  if (!data) return null;
  return (
    <div className="glass-card p-2.5 border-l-2 border-violet-500" data-testid="vrec-inline">
      <div className="text-[11px] uppercase tracking-wide font-semibold text-violet-700 dark:text-violet-300 mb-1.5 inline-flex items-center gap-1.5">
        <Sparkles className="h-3 w-3" /> Rekomendasi Vendor (AI)
      </div>
      <Candidates data={data} onSelect={onSelect} compact={compact} />
    </div>
  );
}

export function AIVendorRecommendationModal({ itemId, prId, topK = 3, onSelect, triggerLabel = "Rekomendasi" }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!itemId && !prId) {
      toast.error("Pilih item dulu");
      return;
    }
    setOpen(true);
    setLoading(true);
    try {
      const body = itemId ? { item_id: itemId, top_k: topK } : { pr_id: prId, top_k: topK };
      const res = await api.post("/ai/vendor-recommend", body);
      setData(unwrap(res));
    } catch (e) {
      toast.error("Gagal mengambil rekomendasi");
    } finally { setLoading(false); }
  }

  return (
    <>
      <Button
        size="sm" variant="outline"
        className="rounded-full gap-1.5 text-xs h-7 border-violet-500/30 bg-violet-500/5 hover:bg-violet-500/15 text-violet-700 dark:text-violet-300"
        onClick={load}
        data-testid="vrec-modal-trigger"
      >
        <Sparkles className="h-3 w-3" /> {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-card max-w-xl" data-testid="vrec-modal">
          <DialogHeader>
            <DialogTitle className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              Rekomendasi Vendor (AI)
            </DialogTitle>
            <DialogDescription>
              {data?.item_name && <>Untuk item: <b>{data.item_name}</b></>}
              {prId && <>Untuk PR: <b>{data?.pr_doc_no || prId}</b></>}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {loading && (
              <div className="text-sm text-muted-foreground italic flex items-center gap-2 p-4">
                <Loader2 className="h-4 w-4 animate-spin" /> Sedang menganalisa data…
              </div>
            )}
            {!loading && data && data.candidates !== undefined && (
              <Candidates
                data={data}
                onSelect={(c) => {
                  onSelect?.(c);
                  setOpen(false);
                }}
              />
            )}
            {!loading && data?.consensus?.length > 0 && (
              <div className="mt-4 p-3 rounded-lg border border-violet-500/30 bg-violet-500/5">
                <div className="text-[11px] uppercase tracking-wide font-semibold text-violet-700 dark:text-violet-300 mb-1">
                  Konsensus PR
                </div>
                <div className="text-xs">
                  Vendor yang muncul paling sering sebagai #1:
                  {" "}
                  {data.consensus.map((v, i) => (
                    <span key={v.vendor_id} className="font-semibold">
                      {i > 0 && ", "}{v.vendor_name} ({v.wins}×)
                    </span>
                  ))}
                </div>
              </div>
            )}
            {!loading && data?.weights && (
              <div className="mt-3 text-[10px] text-muted-foreground text-center">
                Bobot: harga {(data.weights.price * 100).toFixed(0)}% ·
                lead time {(data.weights.lead_time * 100).toFixed(0)}% ·
                scorecard {(data.weights.scorecard * 100).toFixed(0)}% ·
                recency {(data.weights.recency * 100).toFixed(0)}%
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
