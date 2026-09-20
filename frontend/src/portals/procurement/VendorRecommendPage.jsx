/** Vendor Recommendation — standalone deep-link page (Phase 3 nice-to-have).
 *
 * Routes:
 *   /procurement/vendor-recommend                 — search bar
 *   /procurement/vendor-recommend?item_id=...     — auto-load for item
 *   /procurement/vendor-recommend?pr_id=...       — auto-load for PR
 *
 * Lets a user search any item, see top vendors with rationale, copy a
 * shareable URL, and click "Buat PO ke vendor ini" deep-link to PO form.
 */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  Sparkles, Search, Trophy, Award, Medal, ArrowRight, Copy, ExternalLink,
  Loader2,
} from "lucide-react";
import api, { unwrap } from "@/lib/api";
import ItemAutocomplete from "@/components/shared/ItemAutocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmtRp } from "@/lib/format";
import { toast } from "sonner";

function RankBadge({ rank }) {
  const Icon = rank === 0 ? Trophy : rank === 1 ? Award : Medal;
  const cls =
    rank === 0 ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30" :
    rank === 1 ? "bg-zinc-400/20 text-zinc-700 dark:text-zinc-300 border-zinc-400/30" :
                 "bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30";
  return (
    <div className={`h-8 w-8 rounded-full flex items-center justify-center border ${cls} shrink-0`}>
      <Icon className="h-4 w-4" />
    </div>
  );
}

export default function VendorRecommendPage() {
  const [params, setParams] = useSearchParams();
  const [item, setItem] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const itemId = params.get("item_id") || "";
  const prId = params.get("pr_id") || "";

  // Auto-load when params change
  useEffect(() => {
    if (!itemId && !prId) { setData(null); return; }
    setLoading(true);
    setData(null);
    const body = itemId ? { item_id: itemId, top_k: 3 } : { pr_id: prId, top_k: 3 };
    api.post("/ai/vendor-recommend", body)
      .then(r => setData(unwrap(r)))
      .catch(() => toast.error("Gagal memuat rekomendasi"))
      .finally(() => setLoading(false));
  }, [itemId, prId]);

  function handleSelectItem(it) {
    setItem(it);
    const next = new URLSearchParams(params);
    next.set("item_id", it.id);
    next.delete("pr_id");
    setParams(next);
  }

  function copyDeepLink() {
    const url = window.location.href;
    navigator.clipboard?.writeText(url);
    toast.success("Link disalin ke clipboard");
  }

  const headerLabel = useMemo(() => {
    if (data?.item_name) return data.item_name;
    if (data?.pr_doc_no) return `PR ${data.pr_doc_no}`;
    if (item?.name) return item.name;
    return null;
  }, [data, item]);

  return (
    <div className="max-w-4xl mx-auto space-y-5 py-2" data-testid="vrec-page">
      <div className="glass-card p-5 flex items-center gap-3" data-testid="vrec-header">
        <div className="h-12 w-12 rounded-2xl grad-aurora-soft flex items-center justify-center">
          <Sparkles className="h-6 w-6 text-violet-600" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Rekomendasi Vendor (AI)</h1>
          <p className="text-xs text-muted-foreground">
            Cari item atau buka deep-link untuk lihat top vendor + rasional otomatis (Bahasa Indonesia).
          </p>
        </div>
        {(itemId || prId) && (
          <Button variant="outline" size="sm" onClick={copyDeepLink}
            className="rounded-full gap-1.5" data-testid="vrec-copy-link">
            <Copy className="h-3.5 w-3.5" /> Copy Link
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="glass-card p-4" data-testid="vrec-search-card">
        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
          Cari item
        </Label>
        <div className="mt-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
          <ItemAutocomplete
            value={item?.name || ""}
            onSelect={handleSelectItem}
            placeholder="Ketik nama item, kode, atau SKU…"
            className="pl-9"
            dataTestId="vrec-search"
          />
        </div>
        {(itemId || prId) && headerLabel && (
          <div className="mt-3 text-xs text-muted-foreground inline-flex items-center gap-2" data-testid="vrec-header-info">
            Menampilkan rekomendasi untuk:
            <span className="font-semibold text-foreground" data-testid="vrec-header-label">
              {headerLabel}
            </span>
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground" data-testid="vrec-loading">
          <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />
          Sedang menganalisa data harga, lead time, dan scorecard…
        </div>
      )}

      {/* Single-item candidates */}
      {!loading && data && data.candidates !== undefined && (
        <div className="glass-card p-5 space-y-3" data-testid="vrec-page-candidates">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" /> Top Vendor
          </h2>
          {data.candidates.length === 0 && (
            <div className="text-sm text-muted-foreground italic" data-testid="vrec-empty-candidates">
              {data.note || "Belum ada riwayat pembelian untuk item ini."}
            </div>
          )}
          {data.candidates.map((c, i) => (
            <div key={c.vendor_id} className="glass-input rounded-2xl p-4 flex items-start gap-3"
              data-testid={`vrec-page-cand-${c.vendor_id}`}>
              <RankBadge rank={i} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="font-semibold" data-testid={`vrec-cand-name-${c.vendor_id}`}>{c.vendor_name}</div>
                  <div className="text-[11px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded border bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30 tabular-nums" data-testid={`vrec-cand-score-${c.vendor_id}`}>
                    Score {(c.score * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="text-xs text-muted-foreground tabular-nums mt-1 flex flex-wrap gap-x-3">
                  <span>Avg: <b className="text-foreground">{fmtRp(c.metrics?.avg_cost || 0)}</b></span>
                  <span>Last: <b className="text-foreground">{fmtRp(c.metrics?.last_cost || 0)}</b></span>
                  {c.metrics?.lead_time_avg != null && (
                    <span>Lead time: <b className="text-foreground">{c.metrics.lead_time_avg} hari</b></span>
                  )}
                  <span>GR: <b className="text-foreground">{c.metrics?.gr_count || 0}</b></span>
                  {c.metrics?.scorecard > 0 && (
                    <span>Scorecard: <b className="text-foreground">{c.metrics.scorecard.toFixed(1)}/5</b></span>
                  )}
                  {c.metrics?.recency_days != null && (
                    <span>Last receipt: <b className="text-foreground">{c.metrics.recency_days} hari lalu</b></span>
                  )}
                </div>
                {c.rationale && (
                  <div className="text-sm italic mt-2 text-foreground/90 leading-snug" data-testid={`vrec-cand-rationale-${c.vendor_id}`}>
                    “{c.rationale}”
                  </div>
                )}
                <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                  <Button asChild size="sm" variant="outline" className="rounded-full gap-1">
                    <Link to={`/procurement/po/new?vendor_id=${c.vendor_id}${itemId ? `&item_id=${itemId}` : ""}`} data-testid={`vrec-cand-create-po-${c.vendor_id}`}>
                      Buat PO <ArrowRight className="h-3 w-3" />
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost" className="rounded-full gap-1 text-[11px] text-muted-foreground">
                    <Link to={`/admin/vendors/${c.vendor_id}`} data-testid={`vrec-cand-detail-${c.vendor_id}`}>
                      Detail vendor <ExternalLink className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {data.weights && (
            <div className="text-[10px] text-muted-foreground text-center pt-2" data-testid="vrec-weights">
              Bobot: harga {(data.weights.price * 100).toFixed(0)}% ·
              lead time {(data.weights.lead_time * 100).toFixed(0)}% ·
              scorecard {(data.weights.scorecard * 100).toFixed(0)}% ·
              recency {(data.weights.recency * 100).toFixed(0)}%
            </div>
          )}
        </div>
      )}

      {/* PR mode */}
      {!loading && data && data.lines !== undefined && (
        <div className="glass-card p-5 space-y-4" data-testid="vrec-page-pr">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" /> Rekomendasi per Item dalam PR
          </h2>
          {data.consensus?.length > 0 && (
            <div className="p-3 rounded-lg border border-violet-500/30 bg-violet-500/5" data-testid="vrec-consensus">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-violet-700 dark:text-violet-300 mb-1">
                Konsensus
              </div>
              <div className="text-sm">
                {data.consensus.map((v, i) => (
                  <span key={v.vendor_id}>
                    {i > 0 && ", "}<b>{v.vendor_name}</b> ({v.wins} item)
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-3" data-testid="vrec-pr-lines">
            {data.lines.map((ln) => (
              <div key={(ln.item_id || ln.item_name) + ""} className="rounded-xl border border-border/40 p-3"
                data-testid={`vrec-pr-line-${ln.item_id || ln.item_name}`}>
                <div className="font-medium text-sm">{ln.item_name}</div>
                {ln.candidates?.length === 0 && (
                  <div className="text-[11px] text-muted-foreground italic mt-1">
                    {ln.note || "Belum ada riwayat"}
                  </div>
                )}
                {(ln.candidates || []).slice(0, 3).map((c, i) => (
                  <div key={c.vendor_id} className="flex items-center gap-2 mt-1.5 text-xs">
                    <span className="text-[10px] tabular-nums w-6 text-muted-foreground">#{i + 1}</span>
                    <span className="flex-1 truncate">{c.vendor_name}</span>
                    <span className="tabular-nums text-muted-foreground">{fmtRp(c.metrics?.avg_cost || 0)}</span>
                    <span className="tabular-nums text-violet-700 dark:text-violet-300 font-semibold">
                      {(c.score * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && !data && !itemId && !prId && (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground" data-testid="vrec-empty-state">
          Cari item di atas, atau buka link dengan parameter <code>?item_id=</code> / <code>?pr_id=</code>.
        </div>
      )}
    </div>
  );
}
