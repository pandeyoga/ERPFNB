/**
 * VendorComparison — Phase 9B standalone tool.
 *
 * Page for procurement managers to:
 *   1. Search & multi-select items
 *   2. Compare vendor pricing across selected items
 *   3. View vendor scorecard for a specific vendor (lead time, on-time%, defect, price stability)
 */
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  X,
  Award,
  Truck,
  ShieldCheck,
  TrendingUp as TrendUp,
  Package,
  RefreshCw,
} from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import VendorComparisonPanel from "@/components/shared/VendorComparisonPanel";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import { fmtRp } from "@/lib/format";
import { toast } from "sonner";

export default function VendorComparison() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [allItems, setAllItems] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [scorecard, setScorecard] = useState(null);
  const [scorecardLoading, setScorecardLoading] = useState(false);
  const [days, setDays] = useState(180);

  useEffect(() => {
    Promise.all([
      api.get("/master/items", { params: { per_page: 500 } }),
      api.get("/master/vendors", { params: { per_page: 200 } }),
    ]).then(([i, v]) => {
      setAllItems(unwrap(i) || []);
      setVendors(unwrap(v) || []);
    }).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allItems.slice(0, 25);
    return allItems.filter(it =>
      (it.name || "").toLowerCase().includes(q) ||
      (it.code || "").toLowerCase().includes(q),
    ).slice(0, 25);
  }, [allItems, search]);

  function toggleItem(it) {
    setItems(prev => {
      const exists = prev.some(x => x.id === it.id);
      if (exists) return prev.filter(x => x.id !== it.id);
      if (prev.length >= 10) {
        toast.info("Max 10 item dapat dipilih sekaligus");
        return prev;
      }
      return [...prev, it];
    });
  }

  function clearAll() {
    setItems([]); setSearch("");
  }

  async function loadScorecard(vid) {
    setSelectedVendor(vid); setScorecardLoading(true);
    try {
      const res = await api.get(`/procurement/vendors/${vid}/scorecard`, { params: { days } });
      setScorecard(unwrap(res));
    } catch (e) {
      toast.error("Gagal load scorecard");
    } finally { setScorecardLoading(false); }
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto" data-testid="vendor-comparison-page">
      <div className="glass-card p-5" data-testid="vc-header-card">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold">Vendor Comparison</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Bandingkan harga vendor untuk multi-item, atau lihat performance scorecard per vendor.
            </p>
          </div>
          <SimpleSelect
            value={days}
            onValueChange={(v) => setDays(Number(v))}
            options={[
              { value: 30, label: "30 hari" },
              { value: 90, label: "90 hari" },
              { value: 180, label: "180 hari" },
              { value: 365, label: "365 hari" },
            ]}
            ariaLabel="Periode"
            className="glass-input rounded-lg h-9 text-xs"
            testId="vc-days"
          />
        </div>

        {/* Item search */}
        <div className="space-y-2" data-testid="vc-search-section">
          <Label className="text-xs uppercase font-semibold text-muted-foreground">
            Cari Item (<span data-testid="vc-selected-count">{items.length}</span>/10 selected)
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Ketik nama / kode item…"
              className="glass-input pl-9 pr-3 h-10"
              data-testid="vc-search"
            />
          </div>
          {filtered.length > 0 && (
            <div className="flex flex-wrap gap-1.5 max-h-[180px] overflow-y-auto py-1" data-testid="vc-search-results">
              {filtered.map(it => {
                const sel = items.some(x => x.id === it.id);
                return (
                  <button
                    key={it.id}
                    onClick={() => toggleItem(it)}
                    className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                      sel ? "pill-active" : "glass-input hover:bg-foreground/10"
                    }`}
                    data-testid={`vc-search-item-${it.id}`}
                  >
                    {sel && "✓ "}{it.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-3 border-t border-border/40" data-testid="vc-selected-items">
            <span className="text-[11px] text-muted-foreground mr-1">Selected:</span>
            {items.map(it => (
              <span key={it.id}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-foreground/10"
                data-testid={`vc-selected-${it.id}`}>
                {it.name}
                <button onClick={() => toggleItem(it)} className="hover:opacity-60" data-testid={`vc-remove-${it.id}`} aria-label="Remove">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <Button onClick={clearAll} variant="ghost" size="sm"
              className="ml-1 h-6 text-[11px] rounded-full px-2"
              data-testid="vc-clear">
              Clear
            </Button>
          </div>
        )}
      </div>

      {/* Comparison panel */}
      {items.length === 0 ? (
        <div className="glass-card p-10" data-testid="vc-empty-prompt">
          <EmptyState
            icon={Package}
            title="Pilih item untuk mulai membandingkan"
            description="Cari & pilih hingga 10 item dari pencarian di atas."
          />
        </div>
      ) : (
        <div data-testid="vc-comparison-panel">
          <VendorComparisonPanel
            itemIds={items.map(i => i.id)}
            days={days}
            onSelectVendor={(vid) => loadScorecard(vid)}
          />
        </div>
      )}

      {/* Scorecard panel */}
      {selectedVendor && (
        <div className="glass-card p-5" data-testid="vc-scorecard">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-foreground/70" />
              <h3 className="font-bold text-base">
                Vendor Performance Scorecard
              </h3>
              <span className="text-sm text-muted-foreground" data-testid="vc-scorecard-name">
                · {vendors.find(v => v.id === selectedVendor)?.name || "—"}
              </span>
            </div>
            <Button onClick={() => loadScorecard(selectedVendor)} size="sm"
              variant="outline" className="rounded-full gap-1" disabled={scorecardLoading}
              data-testid="vc-scorecard-refresh">
              <RefreshCw className={`h-3.5 w-3.5 ${scorecardLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
          {scorecardLoading ? (
            <div data-testid="vc-scorecard-loading"><LoadingState rows={2} /></div>
          ) : scorecard ? (
            <ScorecardGrid scorecard={scorecard} />
          ) : null}
        </div>
      )}
    </div>
  );
}

function ScorecardGrid({ scorecard: s }) {
  const tiles = [
    {
      label: "Avg Lead Time",
      value: s.avg_lead_time_days != null ? `${s.avg_lead_time_days} hari` : "—",
      icon: Truck,
      tone: s.avg_lead_time_days == null ? "muted" :
            s.avg_lead_time_days <= 3 ? "green" :
            s.avg_lead_time_days <= 7 ? "amber" : "red",
      hint: "Dari order_date sampai receive_date",
    },
    {
      label: "On-Time Delivery",
      value: s.on_time_pct != null ? `${s.on_time_pct}%` : "—",
      icon: ShieldCheck,
      tone: s.on_time_pct == null ? "muted" :
            s.on_time_pct >= 90 ? "green" :
            s.on_time_pct >= 70 ? "amber" : "red",
      hint: "vs expected_delivery_date",
    },
    {
      label: "Defect / Variance",
      value: `${s.defect_rate_pct}%`,
      icon: Award,
      tone: s.defect_rate_pct <= 1 ? "green" :
            s.defect_rate_pct <= 5 ? "amber" : "red",
      hint: "Qty tidak diterima vs ordered",
    },
    {
      label: "Price Stability",
      value: s.price_stability_pct != null ? `${s.price_stability_pct}%` : "—",
      icon: TrendUp,
      tone: s.price_stability_pct == null ? "muted" :
            s.price_stability_pct >= 90 ? "green" :
            s.price_stability_pct >= 70 ? "amber" : "red",
      hint: "Rendah = harga sering berubah",
    },
  ];
  const toneCls = {
    green: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    amber: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    red: "bg-red-500/10 text-red-700 dark:text-red-400",
    muted: "bg-foreground/5 text-foreground/60",
  };

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map(t => {
          const Icon = t.icon;
          return (
            <div key={t.label} className={`rounded-xl p-4 ${toneCls[t.tone]}`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className="h-4 w-4" />
                <span className="text-[11px] uppercase tracking-wide font-semibold">{t.label}</span>
              </div>
              <div className="text-2xl font-extrabold tabular-nums">{t.value}</div>
              <div className="text-[10px] mt-0.5 opacity-70">{t.hint}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <Field label="PO Count" value={s.po_count} />
        <Field label="GR Count" value={s.gr_count} />
        <Field label="Total Qty Ordered" value={s.total_qty_ordered} />
        <Field label="Total Qty Received" value={s.total_qty_received} />
      </div>
    </>
  );
}

function Field({ label, value }) {
  return (
    <div className="rounded-lg border border-border/40 p-2.5">
      <div className="text-[10px] uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className="font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}
