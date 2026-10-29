/**
 * VendorComparison — satu tempat perbandingan harga di Procurement (keputusan IA 25 Okt).
 *
 * Tab (?tab=):
 *   items (default) — harga per item lintas vendor (maks. 10 item) — izin procurement.view / vendor.read
 *   po              — PO berdampingan (maks. 4), sebelumnya halaman /procurement/po-comparison — izin procurement.po
 *
 * Performa vendor (lead time, on-time, defect) ada di Procurement › Vendor Scorecard — halaman
 * ini hanya menautkannya (sebelumnya ada panel scorecard duplikat, PRC-VC-06).
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, X, Package, Scale, Check, Award, ArrowRight, ShoppingCart } from "lucide-react";
import { unwrap, fetchAll } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import VendorComparisonPanel from "@/components/shared/VendorComparisonPanel";
import PageHeader, { HubHeaderProvider } from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { useVisibleTabs } from "@/lib/portalGate";
import { toast } from "sonner";
import POComparison from "./POComparison";

// perm = izin route lama tab tersebut (/procurement/po-comparison kini redirect ke ?tab=po)
const TABS = [
  { id: "items", label: "Per item (lintas vendor)", icon: Package, perm: ["procurement.view", "procurement.vendor.read"] },
  { id: "po",    label: "Per PO",                   icon: ShoppingCart, perm: "procurement.po" },
];

const DAY_OPTIONS = [
  { value: 30, label: "30 hari terakhir" },
  { value: 90, label: "90 hari terakhir" },
  { value: 180, label: "180 hari terakhir" },
  { value: 365, label: "365 hari terakhir" },
];

export default function VendorComparison() {
  const tabs = useVisibleTabs(TABS);
  const [searchParams, setSearchParams] = useSearchParams();
  const active = tabs.find(t => t.id === searchParams.get("tab")) || tabs[0];
  const [days, setDays] = useState(180);

  return (
    <HubHeaderProvider>
      <div className="space-y-3 lg:space-y-4" data-testid="vendor-comparison-page">
        <PageHeader hub
          icon={Scale}
          title="Vendor Comparison"
          subtitle="Bandingkan harga per item lintas vendor, atau beberapa PO berdampingan."
          actions={active.id === "items" ? (
            <SimpleSelect
              value={days}
              onValueChange={(v) => setDays(Number(v))}
              options={DAY_OPTIONS}
              ariaLabel="Periode"
              className="glass-input w-[170px]"
              testId="vc-days"
            />
          ) : null}
        />

        <Tabs value={active.id} onValueChange={(id) => setSearchParams({ tab: id }, { replace: true })}>
          {tabs.length > 1 && (
            <TabsList aria-label="Jenis perbandingan" data-testid="vc-tabs">
              {tabs.map(({ id, label, icon: Icon }) => (
                <TabsTrigger key={id} value={id} data-testid={`vc-tab-${id}`}>
                  <Icon /> {label}
                </TabsTrigger>
              ))}
            </TabsList>
          )}
          <TabsContent value={active.id} className="space-y-3 lg:space-y-4">
            {active.id === "po" ? <POComparison embedded /> : <ItemComparison days={days} />}
          </TabsContent>
        </Tabs>
      </div>
    </HubHeaderProvider>
  );
}

/** Tab "Per item": pilih hingga 10 item → matrix harga per vendor. */
function ItemComparison({ days }) {

  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [allItems, setAllItems] = useState([]);

  useEffect(() => {
    fetchAll("/master/items").then(i => setAllItems(unwrap(i) || [])).catch(() => {});
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

  return (
    <>
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
          <VendorComparisonPanel itemIds={items.map(i => i.id)} days={days} />
        </div>
      )}

      {/* Performa vendor ada di Vendor Scorecard (satu sumber) — cukup tautan. */}
      <div className="glass-card p-3 flex flex-wrap items-center gap-2 text-sm" data-testid="vc-scorecard-link-card">
        <Award className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-muted-foreground">Lead time, on-time delivery, defect & skor vendor ada di</span>
        <Button asChild variant="outline" size="sm" className="ml-auto" data-testid="vc-scorecard-link">
          <Link to="/procurement/vendor-scorecard">Vendor Scorecard <ArrowRight /></Link>
        </Button>
      </div>
    </>
  );
}
