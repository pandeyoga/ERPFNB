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
  Scale,
  Check,
} from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import VendorComparisonPanel from "@/components/shared/VendorComparisonPanel";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import { toast } from "sonner";
import { fetchAll } from "@/lib/api";
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
      fetchAll("/master/items"),
      fetchAll("/master/vendors"),
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
        toast.info("Maksimal 10 item dapat dipilih sekaligus");
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
      toast.error("Gagal memuat scorecard vendor");
    } finally { setScorecardLoading(false); }
  }

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="vendor-comparison-page">
      <PageHeader
        icon={Scale}
        title="Vendor Comparison"
        subtitle="Bandingkan harga vendor untuk beberapa item sekaligus, lalu lihat scorecard performa vendor."
        actions={
          <SimpleSelect
            value={days}
            onValueChange={(v) => setDays(Number(v))}
            options={[
              { value: 30, label: "30 hari terakhir" },
              { value: 90, label: "90 hari terakhir" },
              { value: 180, label: "180 hari terakhir" },
              { value: 365, label: "365 hari terakhir" },
            ]}
            ariaLabel="Periode"
            className="glass-input w-[170px]"
            testId="vc-days"
          />
        }
      />

      <div className="glass-card p-4" data-testid="vc-header-card">
        {/* Item search */}
        <div className="space-y-2" data-testid="vc-search-section">
          <Label htmlFor="vc-search" className="text-xs md:text-sm font-medium">
            Cari item (<span data-testid="vc-selected-count">{items.length}</span>/10 dipilih)
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              id="vc-search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Ketik nama / kode item…"
              className="glass-input pl-9 pr-3"
              data-testid="vc-search"
            />
          </div>
          {filtered.length > 0 && (
            <div className="flex flex-wrap gap-1.5 max-h-[180px] overflow-y-auto py-1" data-testid="vc-search-results">
              {filtered.map(it => {
                const sel = items.some(x => x.id === it.id);
                return (
                  <Button
                    key={it.id}
                    type="button"
                    size="sm"
                    variant={sel ? "default" : "outline"}
                    aria-pressed={sel}
                    onClick={() => toggleItem(it)}
                    data-testid={`vc-search-item-${it.id}`}
                  >
                    {sel && <Check />}{it.name}
                  </Button>
                );
              })}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-3 border-t border-border/40" data-testid="vc-selected-items">
            <span className="text-xs text-muted-foreground mr-1">Dipilih:</span>
            {items.map(it => (
              <span key={it.id}
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-foreground/10"
                data-testid={`vc-selected-${it.id}`}>
                {it.name}
                <button type="button" onClick={() => toggleItem(it)} className="hover:opacity-60" data-testid={`vc-remove-${it.id}`} aria-label={`Hapus ${it.name} dari perbandingan`}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <Button onClick={clearAll} variant="ghost" size="sm" className="ml-1" data-testid="vc-clear">
              Hapus semua
            </Button>
          </div>
        )}
      </div>

      {/* Comparison panel */}
      {items.length === 0 ? (
        <div className="glass-card" data-testid="vc-empty-prompt">
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
        <div className="glass-card p-4" data-testid="vc-scorecard">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <Award className="h-4 w-4 text-foreground/70 shrink-0" />
              <h2 className="text-base md:text-lg font-semibold">
                Scorecard performa vendor
              </h2>
              <span className="text-sm text-muted-foreground" data-testid="vc-scorecard-name">
                · {vendors.find(v => v.id === selectedVendor)?.name || "—"}
              </span>
            </div>
            <Button onClick={() => loadScorecard(selectedVendor)} size="sm"
              variant="outline" disabled={scorecardLoading}
              data-testid="vc-scorecard-refresh">
              <RefreshCw className={scorecardLoading ? "animate-spin" : ""} />
              Muat ulang
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

const TONE_MAP = { green: "success", amber: "warning", red: "danger", muted: "default" };

function ScorecardGrid({ scorecard: s }) {
  const tiles = [
    {
      label: "Rata-rata lead time",
      value: s.avg_lead_time_days != null ? `${s.avg_lead_time_days} hari` : "—",
      icon: Truck,
      tone: s.avg_lead_time_days == null ? "muted" :
            s.avg_lead_time_days <= 3 ? "green" :
            s.avg_lead_time_days <= 7 ? "amber" : "red",
      hint: "Dari tanggal order sampai diterima",
    },
    {
      label: "On-time delivery",
      value: s.on_time_pct != null ? `${s.on_time_pct}%` : "—",
      icon: ShieldCheck,
      tone: s.on_time_pct == null ? "muted" :
            s.on_time_pct >= 90 ? "green" :
            s.on_time_pct >= 70 ? "amber" : "red",
      hint: "Dibanding estimasi tiba di PO",
    },
    {
      label: "Defect / selisih",
      value: `${s.defect_rate_pct}%`,
      icon: Award,
      tone: s.defect_rate_pct <= 1 ? "green" :
            s.defect_rate_pct <= 5 ? "amber" : "red",
      hint: "Qty tidak diterima vs dipesan",
    },
    {
      label: "Stabilitas harga",
      value: s.price_stability_pct != null ? `${s.price_stability_pct}%` : "—",
      icon: TrendUp,
      tone: s.price_stability_pct == null ? "muted" :
            s.price_stability_pct >= 90 ? "green" :
            s.price_stability_pct >= 70 ? "amber" : "red",
      hint: "Rendah = harga sering berubah",
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="vc-scorecard-kpis">
        {tiles.map(t => (
          <CompactStatCard key={t.label} label={t.label} value={t.value} sub={t.hint}
            icon={t.icon} tone={TONE_MAP[t.tone]} testIdPrefix="vc-score" />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <Field label="Jumlah PO" value={s.po_count} />
        <Field label="Jumlah GR" value={s.gr_count} />
        <Field label="Total qty dipesan" value={s.total_qty_ordered} />
        <Field label="Total qty diterima" value={s.total_qty_received} />
      </div>
    </>
  );
}

function Field({ label, value }) {
  return (
    <div className="rounded-lg border border-border/40 p-2.5">
      <div className="text-[11px] uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className="font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}
