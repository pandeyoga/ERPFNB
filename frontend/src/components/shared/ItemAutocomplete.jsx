/** AI-powered Item autocomplete. Calls /api/ai/items/suggest.
 *
 *  Phase 9C — shows "Last vendor / unit cost / X days ago" hint
 *  when item has a recent posted Goods Receipt.
 *
 *  Smart Procurement — shows Market List reference price hint for KDO/BDO/FDO.
 */
import { useState, useEffect, useRef } from "react";
import { Package, Sparkles, Clock, Store, Tag } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { fmtRp } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function describeDaysAgo(days) {
  if (days == null) return null;
  const n = Number(days);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n === 0) return "hari ini";
  if (n === 1) return "1 hari lalu";
  if (n < 7) return `${n} hari lalu`;
  if (n < 30) return `${Math.floor(n / 7)} minggu lalu`;
  if (n < 365) return `${Math.floor(n / 30)} bulan lalu`;
  return `${Math.floor(n / 365)} tahun lalu`;
}

export default function ItemAutocomplete({
  value, onChange, onSelect, placeholder = "Cari item…", className,
  showLastPrice = true, showVendorHint = true, showMarketRef = false, outletId, dataTestId,
}) {
  const [query, setQuery] = useState(value || "");
  const [results, setResults] = useState([]);
  const [refPriceMap, setRefPriceMap] = useState({});
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  useEffect(() => { setQuery(value || ""); }, [value]);

  useEffect(() => {
    if (!open || query.length < 1) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = { q: query, limit: 8 };
        if (outletId) params.outlet_id = outletId;
        const res = await api.get("/ai/items/suggest", { params });
        const items = unwrap(res) || [];
        setResults(items);
        // Fetch market ref prices if enabled
        if (showMarketRef && items.length > 0) {
          try {
            const ids = items.map(i => i.id).join(",");
            const refRes = await api.get(`/market-list/ref-prices/bulk?item_ids=${ids}`);
            setRefPriceMap(refRes.data.data || {});
          } catch (_) {}
        }
      } finally { setLoading(false); }
    }, 200);
    return () => clearTimeout(t);
  }, [query, open, outletId, showMarketRef]);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <Input
        value={query}
        onChange={(e) => { setQuery(e.target.value); onChange?.(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="glass-input"
        data-testid={dataTestId}
      />
      {open && (results.length > 0 || loading) && (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-30 glass-card max-h-80 overflow-y-auto"
          data-testid="ia-results"
        >
          {loading && <div className="px-3 py-2 text-xs text-muted-foreground">Mencari…</div>}
          {results.map((it) => {
            const lastCost = it.last_unit_cost ?? it.last_price ?? null;
            const daysAgoText = describeDaysAgo(it.last_purchase_days_ago);
            const hasHint = showVendorHint && (it.last_vendor_name || lastCost);
            const refPrice = refPriceMap[it.id];
            return (
              <button
                type="button"
                key={it.id}
                onClick={() => { onSelect?.(it); setQuery(it.name); setOpen(false); }}
                className="w-full px-3 py-2 hover:bg-foreground/5 text-left flex items-start gap-2.5 border-b border-border/40 last:border-0"
                data-testid={`ia-result-${it.id}`}
              >
                <div className="h-8 w-8 rounded-lg grad-aurora-soft flex items-center justify-center shrink-0 mt-0.5">
                  <Package className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{it.name}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <span>{it.code}</span>
                    <span>·</span>
                    <span>{it.unit}</span>
                    {showLastPrice && lastCost != null && !it.last_vendor_name && (
                      <>
                        <span>·</span>
                        <Sparkles className="h-2.5 w-2.5" />
                        <span>{fmtRp(lastCost)}</span>
                      </>
                    )}
                  </div>
                  {/* Market List Reference Price hint */}
                  {showMarketRef && refPrice && (
                    <div className="text-[11px] text-blue-600 dark:text-blue-400 flex items-center gap-1.5 mt-0.5">
                      <Tag className="h-2.5 w-2.5 shrink-0" />
                      <span>Ref <b>{refPrice.quarter_label}</b>: <span className="font-semibold">{fmtRp(refPrice.ref_price)}</span>{it.unit ? `/${it.unit}` : ""}</span>
                    </div>
                  )}
                  {hasHint && (
                    <div
                      className="text-[11px] text-emerald-700 dark:text-emerald-300/90 flex items-center gap-1.5 mt-0.5"
                      data-testid={`ia-hint-${it.id}`}
                    >
                      <Store className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">
                        Terakhir: <b>{it.last_vendor_name || "—"}</b>
                        {lastCost != null && (
                          <> · <span className="font-semibold">{fmtRp(lastCost)}</span>{it.unit ? `/${it.unit}` : ""}</>
                        )}
                      </span>
                      {daysAgoText && (
                        <>
                          <span className="text-muted-foreground">·</span>
                          <Clock className="h-2.5 w-2.5 shrink-0" />
                          <span className="text-muted-foreground">{daysAgoText}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
