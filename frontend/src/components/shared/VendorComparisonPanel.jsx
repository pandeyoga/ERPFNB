/**
 * VendorComparisonPanel — Phase 9B side widget.
 * Shows vendor pricing matrix for given item_ids. Used in:
 *   - POForm (right-rail panel) : compact mode
 *   - VendorComparison standalone page : full mode
 */
import { useEffect, useMemo, useState } from "react";
import { Award, Sparkles, TrendingDown, TrendingUp, History, X, Crown } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { fmtRp, fmtDate } from "@/lib/format";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import DataTable from "@/components/shared/DataTable";

export default function VendorComparisonPanel({
  itemIds = [],
  days = 180,
  compact = false,
  onSelectVendor,                // (vendorId, item) => void  — used by POForm
  className = "",
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [openHistory, setOpenHistory] = useState(null); // { itemId, vendorId }

  const validIds = useMemo(
    () => itemIds.filter(Boolean),
    [itemIds],
  );

  useEffect(() => {
    if (validIds.length === 0) { setData(null); return; }
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null);
      try {
        const params = {
          item_ids: validIds.join(","),
          days,
          top_vendors_per_item: compact ? 5 : 8,
        };
        const res = await api.get("/procurement/vendor-comparison", { params });
        if (!cancelled) setData(unwrap(res));
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.errors?.[0]?.message || "Gagal load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [validIds.join("|"), days, compact]); // eslint-disable-line

  if (validIds.length === 0) {
    return (
      <div className={`glass-card p-5 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-foreground/70" />
          <h3 className="font-semibold text-sm">Vendor Comparison</h3>
        </div>
        <p className="text-xs text-muted-foreground italic">
          Pilih item di atas untuk melihat perbandingan harga vendor.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`glass-card p-5 ${className}`}>
        <LoadingState rows={3} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`glass-card p-5 ${className}`}>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className={`glass-card p-5 ${className}`}>
        <EmptyState
          icon={Award}
          title="Belum ada data vendor"
          description="Item ini belum punya history pembelian."
        />
      </div>
    );
  }

  return (
    <div className={`glass-card p-5 ${className}`} data-testid="vendor-comparison-panel">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-foreground/70" />
          <h3 className="font-semibold text-sm">Vendor Comparison</h3>
          <span className="text-[10px] text-muted-foreground">
            ({data.period_days}d, {data.items.length} item{data.items.length>1?"s":""})
          </span>
        </div>
      </div>

      <div className="space-y-5">
        {data.items.map((item) => (
          <ItemBlock
            key={item.item_id}
            item={item}
            compact={compact}
            onSelectVendor={onSelectVendor}
            onShowHistory={(vid) => setOpenHistory({ itemId: item.item_id, vendorId: vid })}
            history={openHistory?.itemId === item.item_id ? openHistory : null}
            onCloseHistory={() => setOpenHistory(null)}
          />
        ))}
      </div>
    </div>
  );
}

function ItemBlock({ item, compact, onSelectVendor, onShowHistory, history, onCloseHistory }) {
  if (item.vendors.length === 0) {
    return (
      <div className="rounded-lg border border-border/50 p-4 bg-foreground/[0.02]">
        <div className="text-sm font-medium">{item.item_name}</div>
        <div className="text-xs text-muted-foreground mt-1 italic">
          Belum ada history pembelian (180 hari).
        </div>
      </div>
    );
  }

  const cheapest = item.vendors[0];

  return (
    <div className="rounded-xl border border-border/60 p-3 bg-foreground/[0.02]" data-testid={`vc-item-${item.item_id}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <div>
          <div className="font-medium text-sm">{item.item_name}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {item.total_vendors} vendor · spread <strong>{item.spread_pct}%</strong>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Best price</div>
          <div className="text-sm font-bold tabular-nums">{fmtRp(item.best_price || 0)}</div>
        </div>
      </div>

      <div className="space-y-1.5">
        {item.vendors.map((v, idx) => {
          const isCheapest = v.vendor_id === cheapest.vendor_id;
          const diffFromCheapest = v.last_unit_cost - cheapest.last_unit_cost;
          const diffPct = cheapest.last_unit_cost > 0
            ? (diffFromCheapest / cheapest.last_unit_cost) * 100
            : 0;
          return (
            <div key={v.vendor_id}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors ${
                isCheapest
                  ? "bg-emerald-500/10 border border-emerald-500/30"
                  : "hover:bg-foreground/5 border border-transparent"
              }`}
              data-testid={`vc-row-${v.vendor_id}`}
            >
              <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                isCheapest ? "bg-emerald-500/20" : "bg-foreground/5"
              }`}>
                {isCheapest ? <Crown className="h-4 w-4 text-emerald-700 dark:text-emerald-400" /> :
                  <span className="text-xs font-bold text-muted-foreground">#{idx+1}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{v.vendor_name}</div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span>{v.purchase_count}× beli</span>
                  <span>·</span>
                  <span>{fmtDate(v.last_purchase_date)}</span>
                  {!compact && v.score && (
                    <>
                      <span>·</span>
                      <span className="text-foreground/70">score {v.score}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-semibold tabular-nums">{fmtRp(v.last_unit_cost)}</div>
                {!isCheapest && (
                  <div className={`text-[11px] tabular-nums flex items-center justify-end gap-0.5 ${
                    diffFromCheapest > 0 ? "text-orange-600 dark:text-orange-400" : "text-emerald-600 dark:text-emerald-400"
                  }`}>
                    {diffFromCheapest > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {diffPct >= 0 ? "+" : ""}{diffPct.toFixed(1)}%
                  </div>
                )}
                {isCheapest && (
                  <div className="text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-400 font-bold">Termurah</div>
                )}
              </div>
              <div className="flex flex-col gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => onShowHistory(v.vendor_id)}
                  className="h-7 w-7 rounded-md hover:bg-foreground/10 flex items-center justify-center"
                  aria-label="Lihat history"
                  data-testid={`vc-history-${v.vendor_id}`}
                >
                  <History className="h-3.5 w-3.5" />
                </button>
                {onSelectVendor && (
                  <Button
                    size="sm"
                    variant={isCheapest ? "default" : "outline"}
                    onClick={() => onSelectVendor(v.vendor_id, item, v)}
                    className={`h-7 text-[11px] px-2 rounded-md ${isCheapest ? "pill-active" : ""}`}
                    data-testid={`vc-select-${v.vendor_id}`}
                  >
                    Pilih
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {history?.itemId === item.item_id && (
        <HistoryBlock
          item={item}
          vendorId={history.vendorId}
          onClose={onCloseHistory}
        />
      )}
    </div>
  );
}

function HistoryBlock({ item, vendorId, onClose }) {
  const v = item.vendors.find(x => x.vendor_id === vendorId);
  if (!v) return null;
  return (
    <div className="mt-3 rounded-lg border border-border/60 bg-background p-3" data-testid="vc-history-block">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold flex items-center gap-1.5">
          <History className="h-3 w-3" />
          History {v.vendor_name}
        </div>
        <button
          onClick={onClose}
          className="h-6 w-6 rounded hover:bg-foreground/10 flex items-center justify-center"
          aria-label="Tutup"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <DataTable
        rows={(v.history || []).map((h, i) => ({ ...h, _key: i }))}
        keyField="_key"
        rowTestIdPrefix="vc-history-row"
        className="text-xs"
        columns={[
          { key: "date", label: "Tanggal", primary: true, render: (h) => fmtDate(h.date) },
          { key: "qty", label: "Qty", numeric: true },
          { key: "unit_cost", label: "Unit Cost", numeric: true, render: (h) => <span className="font-medium">{fmtRp(h.unit_cost)}</span> },
          { key: "doc_no", label: "Doc", render: (h) => <span className="text-muted-foreground font-mono text-[10px]">{h.doc_no}</span> },
        ]}
      />
      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground border-t border-border/30 pt-2">
        <span>Min: <strong className="text-foreground">{fmtRp(v.min_unit_cost)}</strong></span>
        <span>Avg: <strong className="text-foreground">{fmtRp(v.avg_unit_cost)}</strong></span>
        <span>Max: <strong className="text-foreground">{fmtRp(v.max_unit_cost)}</strong></span>
      </div>
    </div>
  );
}
