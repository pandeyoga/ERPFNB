import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import EmptyState from "@/components/shared/EmptyState";
import StatusPill, { statusLabel } from "@/components/shared/StatusPill";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import DataTable from "@/components/shared/DataTable";
import { confirmDialog } from "@/components/shared/confirmDialog";
import {
  TrendingUp, TrendingDown, Minus, Download, Plus, Search,
  RefreshCw, CheckCircle, Clock, ChevronLeft, ChevronRight,
  BarChart2, Star, Package, Tags, CalendarRange, Layers,
} from "lucide-react";


import { fmtNumber } from "@/lib/format";
// PERFORMANCE OPTIMIZATION: Debounce hook for search
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = React.useState(value);
  
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(handler);
  }, [value, delay]);
  
  return debouncedValue;
}

const fmt = (n) => fmtNumber(n); // DUP-10: shared formatter

const VarianceBadge = ({ pct }) => {
  if (pct == null) return <span className="text-muted-foreground text-xs">-</span>;
  const abs = Math.abs(pct);
  // AUDIT FIX: Color coding untuk variance - red untuk naik (bad), green untuk turun (good)
  if (pct > 5) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-700 dark:text-red-300 font-semibold text-xs">
      <TrendingUp className="h-3 w-3" />+{pct.toFixed(1)}%
    </span>
  );
  if (pct < -5) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold text-xs">
      <TrendingDown className="h-3 w-3" />{pct.toFixed(1)}%
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-foreground/5 text-muted-foreground text-xs">
      <Minus className="h-3 w-3" />~0%
    </span>
  );
};

// Status item market list memakai kamus StatusPill global (active / pending_review).
const StatusBadge = ({ status }) => <StatusPill status={status || "active"} />;

export default function MarketListPage() {
  const { user } = useAuth();
  // Deep link dari Inventory Overview: /inventory/market-list?ml_status=pending_review
  // (sebelumnya parameter ini diabaikan, jadi link "Tinjau sekarang" tidak memfilter apa pun).
  const [searchParams] = useSearchParams();

  const [quarters, setQuarters] = useState([]);
  const [activeQuarter, setActiveQuarter] = useState(null);
  const [selectedQuarter, setSelectedQuarter] = useState("");
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, per_page: 50 });
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [filters, setFilters] = useState(() => ({
    search: "", category_id: "", brand: "",
    ml_status: ["active", "pending_review"].includes(searchParams.get("ml_status")) ? searchParams.get("ml_status") : "",
  }));
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  
  // PERFORMANCE OPTIMIZATION: Debounce search input (300ms delay)
  const debouncedSearch = useDebounce(filters.search, 300);


  // Modals
  const [showCreateQuarter, setShowCreateQuarter] = useState(false);
  const [showSetPrice, setShowSetPrice] = useState(false);
  const [showApprove, setShowApprove] = useState(false);
  const [showQuarterHistory, setShowQuarterHistory] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemHistory, setItemHistory] = useState([]);
  const [newQuarter, setNewQuarter] = useState({ year: 2026, quarter: 2 });
  const [priceForm, setPriceForm] = useState({ unit: "", ref_price: "", notes: "" });
  const [approveForm, setApproveForm] = useState({ category_id: "", ref_price: "" });
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const canManage = user?.permissions?.includes("*") || user?.permissions?.includes("procurement.market_list.manage");

  const fetchQuarters = useCallback(async () => {
    const res = await api.get("/market-list/quarters");
    setQuarters(res.data.data || []);
    const aq = res.data.data?.find(q => q.status === "active");
    setActiveQuarter(aq || null);
    if (!selectedQuarter && aq) setSelectedQuarter(aq.id);
  }, [selectedQuarter]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page, per_page: 50,
        ...(selectedQuarter && { quarter_id: selectedQuarter }),
        ...(debouncedSearch && { search: debouncedSearch }),  // PERFORMANCE: Use debounced search
        ...(filters.category_id && { category_id: filters.category_id }),
        ...(filters.ml_status && { ml_status: filters.ml_status }),
        ...(filters.brand && { brand: filters.brand }),
      });
      const res = await api.get(`/market-list/items?${params}`);
      setItems(res.data.data || []);
      setMeta(res.data.meta || {});
    } finally {
      setLoading(false);
    }
  }, [page, selectedQuarter, debouncedSearch, filters.category_id, filters.ml_status, filters.brand]);

  const fetchCategories = useCallback(async () => {
    const res = await api.get("/master/categories?per_page=100");
    setCategories(res.data.data || []);
  }, []);

  const fetchBrands = useCallback(async () => {
    const res = await api.get("/master/brands?per_page=100");
    setBrands(res.data.data || []);
  }, []);

  useEffect(() => { fetchQuarters(); fetchCategories(); fetchBrands(); }, [fetchQuarters, fetchCategories, fetchBrands]);
  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleCreateQuarter = async () => {
    setSaving(true);
    try {
      await api.post("/market-list/quarters", newQuarter);
      await fetchQuarters();
      setShowCreateQuarter(false);
      toast.success("Quarter dibuat");
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal membuat quarter");
    } finally { setSaving(false); }
  };

  const handleActivateQuarter = async (qId) => {
    // AUDIT FIX: Confirmation dialog untuk destructive action
    if (!(await confirmDialog("Aktifkan quarter ini?\n\nQuarter aktif sebelumnya akan ditutup (closed) dan quarter ini menjadi referensi untuk semua harga baru.\n\nLanjutkan?"))) return;
    try {
      await api.post(`/market-list/quarters/${qId}/activate`, {});
      await fetchQuarters();
      toast.success("Quarter diaktifkan");
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal mengaktifkan quarter");
    }
  };

  const openSetPrice = (item) => {
    setSelectedItem(item);
    setPriceForm({ unit: item.unit_default || "pcs", ref_price: item.ref_price || "", notes: "" });
    setShowSetPrice(true);
  };

  const handleSetPrice = async () => {
    if (!selectedQuarter) return toast.error("Pilih quarter terlebih dahulu");
    // AUDIT FIX: Validate ref_price > 0
    const price = parseFloat(priceForm.ref_price);
    if (isNaN(price) || price <= 0) {
      toast.error("Harga referensi harus lebih besar dari 0");
      return;
    }
    
    // PRIORITY 2 FIX: Check extreme variance (>20%)
    if (selectedItem.ref_price) {
      const oldPrice = selectedItem.ref_price;
      const variance = ((price - oldPrice) / oldPrice) * 100;
      if (Math.abs(variance) > 20) {
        const ok = await confirmDialog({
          title: "Selisih harga ekstrem",
          description:
            `Item: ${selectedItem.name}\n` +
            `Sebelumnya: Rp ${oldPrice.toLocaleString()}\n` +
            `Baru: Rp ${price.toLocaleString()}\n` +
            `Selisih: ${variance > 0 ? '+' : ''}${variance.toFixed(1)}%\n\n` +
            `Selisih lebih dari 20%. Yakin ingin menyimpan?\n` +
            `(Kemungkinan ada masalah supplier atau salah input)`,
          destructive: true,
        });
        if (!ok) return;
      }
    }
    
    setSaving(true);
    try {
      await api.post("/market-list/prices", {
        quarter_id: selectedQuarter,
        item_id: selectedItem.id,
        unit: priceForm.unit,
        ref_price: price,
        notes: priceForm.notes || undefined,
      });
      setShowSetPrice(false);
      toast.success("Harga referensi disimpan");
      await fetchItems();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal menyimpan harga");
    } finally { setSaving(false); }
  };

  const openApprove = (item) => {
    setSelectedItem(item);
    setApproveForm({ category_id: "", ref_price: "" });
    setShowApprove(true);
  };

  const handleApprove = async () => {
    setSaving(true);
    try {
      await api.post(`/market-list/items/${selectedItem.id}/approve`, {
        category_id: approveForm.category_id,
        ref_price: approveForm.ref_price ? parseFloat(approveForm.ref_price) : undefined,
      });
      setShowApprove(false);
      toast.success("Item disetujui");
      await fetchItems();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal menyetujui item");
    } finally { setSaving(false); }
  };

  const openHistory = async (item) => {
    setSelectedItem(item);
    const res = await api.get(`/market-list/items/${item.id}/prices`);
    setItemHistory(res.data.data || []);
    setShowQuarterHistory(true);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const year = activeQuarter?.year || 2026;
      const { API_BASE } = await import("@/lib/api");
      const res = await fetch(`${API_BASE}/market-list/export.xlsx?year=${year}`, { credentials: "include" });
      // Sebelumnya respons error (403/500) tetap diunduh sebagai file .xlsx rusak.
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `market_list_${year}.xlsx`;
      a.click();
    } catch (e) {
      toast.error("Gagal mengekspor market list");
    } finally { setExporting(false); }
  };

  // dari API: seluruh hasil filter (dulu hanya baris di halaman aktif)
  const pendingCount = meta.pending_review_count ?? items.filter(i => i.ml_status === "pending_review").length;

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="market-list-page">
      {/* Header */}
      <div data-testid="market-list-header">
        <PageHeader
          icon={Tags}
          title="Market Price List"
          subtitle="Harga acuan kuartalan — referensi untuk KDO/BDO/FDO."
          className="mb-0 md:mb-0"
          actions={
            <>
              <Button variant="outline" size="icon" onClick={fetchItems} aria-label="Muat ulang" title="Muat ulang" data-testid="market-list-refresh">
                <RefreshCw />
              </Button>
              <Button variant="outline" onClick={handleExport} disabled={exporting} data-testid="market-list-export">
                <Download /> {exporting ? "Mengekspor…" : "Ekspor Excel"}
              </Button>
              {canManage && (
                <Button onClick={() => setShowCreateQuarter(true)} data-testid="market-list-create-quarter-btn">
                  <Plus /> Buat Quarter
                </Button>
              )}
            </>
          }
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="market-list-stats">
        <CompactStatCard size="sm" label="Total item" value={meta.total || 0} icon={Package} color="aurora-1" testId="market-list-stat-total" />
        <CompactStatCard
          size="sm"
          label={statusLabel("pending_review")}
          value={pendingCount}
          tone={pendingCount > 0 ? "warning" : "default"}
          icon={Clock}
          color="aurora-5"
          testId="market-list-stat-pending"
          sub={pendingCount > 0 ? (
            <button
              type="button"
              onClick={() => { setFilters(f => ({ ...f, ml_status: "pending_review" })); setPage(1); }}
              className="text-xs font-medium text-amber-700 dark:text-amber-300 hover:underline"
              data-testid="market-list-review-now"
            >
              Tinjau sekarang →
            </button>
          ) : undefined}
        />
        <CompactStatCard size="sm" label="Quarter aktif" value={activeQuarter?.label || "—"} icon={CalendarRange} color="aurora-4" testId="market-list-stat-active-quarter" />
        <CompactStatCard size="sm" label="Total quarter" value={quarters.length} icon={Layers} color="aurora-2" testId="market-list-stat-total-quarter" />
      </div>

      {/* Quarter selector + filters (satu kartu filter) */}
      <Card data-testid="market-list-filters">
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap" data-testid="market-list-quarter-selector" role="group" aria-labelledby="ml-quarter-label">
            <span id="ml-quarter-label" className="text-xs md:text-sm font-medium mr-1">Tampilkan harga untuk</span>
            {quarters.length === 0 ? (
              <span className="text-xs md:text-sm text-muted-foreground" data-testid="market-list-no-quarter">
                Belum ada quarter.{canManage ? " Klik Buat Quarter untuk mulai mengisi harga acuan." : ""}
              </span>
            ) : quarters.map(q => (
              <Button
                key={q.id}
                type="button"
                size="sm"
                variant={selectedQuarter === q.id ? "default" : "outline"}
                aria-pressed={selectedQuarter === q.id}
                onClick={() => { setSelectedQuarter(q.id); setPage(1); }}
                data-testid={`market-list-quarter-chip-${q.id}`}
              >
                {q.label}
                {q.status === "active" && (
                  <span className="text-[11px] font-semibold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1 rounded">Aktif</span>
                )}
              </Button>
            ))}
            {canManage && selectedQuarter && selectedQuarter !== activeQuarter?.id && (
              <Button
                size="sm"
                variant="outline"
                className="ml-auto"
                onClick={() => handleActivateQuarter(selectedQuarter)}
                data-testid="market-list-activate-quarter"
              >
                <CheckCircle /> Aktifkan quarter ini
              </Button>
            )}
          </div>

          <div className="flex gap-3 flex-wrap pt-3 border-t border-border/50">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
              <Input
                placeholder="Cari item…"
                aria-label="Cari item"
                className="pl-9"
                value={filters.search}
                onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1); }}
                data-testid="market-list-search"
              />
            </div>
            <Select value={filters.category_id} onValueChange={v => { setFilters(f => ({ ...f, category_id: v === "all" ? "" : v })); setPage(1); }}>
              <SelectTrigger className="w-[180px]" aria-label="Filter kategori" data-testid="market-list-filter-category"><SelectValue placeholder="Semua kategori" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua kategori</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.ml_status} onValueChange={v => { setFilters(f => ({ ...f, ml_status: v === "all" ? "" : v })); setPage(1); }}>
              <SelectTrigger className="w-[160px]" aria-label="Filter status" data-testid="market-list-filter-status"><SelectValue placeholder="Semua status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua status</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="pending_review">{statusLabel("pending_review")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.brand} onValueChange={v => { setFilters(f => ({ ...f, brand: v === "all" ? "" : v })); setPage(1); }}>
              <SelectTrigger className="w-[140px]" aria-label="Filter brand" data-testid="market-list-filter-brand"><SelectValue placeholder="Semua brand" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua brand</SelectItem>
                {brands.map(b => <SelectItem key={b.id} value={b.code}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden" data-testid="market-list-table-card">
        <div data-testid="market-list-table">
          <DataTable
            rows={items.map((item, idx) => ({ ...item, _rownum: (page - 1) * 50 + idx + 1 }))}
            keyField="id"
            loading={loading}
            rowTestIdPrefix="market-list-row"
            rowClassName={(item) => item.ml_status === "pending_review" ? "bg-amber-500/10" : ""}
            empty={
              <div data-testid="market-list-empty">
                <EmptyState
                  icon={Package}
                  title="Tidak ada item ditemukan"
                  description={filters.search || filters.category_id || filters.ml_status || filters.brand
                    ? "Ubah kata kunci atau filter untuk melihat item lain."
                    : "Belum ada item di market list."}
                />
              </div>
            }
            columns={[
              { key: "_rownum", label: "#", render: (item) => <span className="text-muted-foreground text-sm tabular-nums">{item._rownum}</span> },
              { key: "name", label: "Item", primary: true, sortable: true, render: (item) => (
                <div>
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-muted-foreground">{item.code}</div>
                </div>
              ) },
              { key: "category_name", label: "Kategori", sortable: true,
                render: (item) => <span className="text-sm text-muted-foreground">{item.category_name || "-"}</span> },
              { key: "unit_default", label: "Unit", render: (item) => <span className="text-sm">{item.unit_default || "-"}</span> },
              { key: "ml_status", label: "Status", render: (item) => <StatusBadge status={item.ml_status} /> },
              { key: "ref_price", label: "Harga Referensi", numeric: true, sortable: true, render: (item) => (
                <>
                  {item.ref_price != null ? (
                    <span className="font-semibold">Rp {fmt(item.ref_price)}</span>
                  ) : (
                    <span className="text-muted-foreground text-sm">Belum ada</span>
                  )}
                  {item.ref_price_unit && <div className="text-xs text-muted-foreground">{item.ref_quarter_label}</div>}
                </>
              ) },
              { key: "prev_ref_price", label: "Harga Sebelumnya", numeric: true, render: (item) => (
                <>
                  {item.prev_ref_price ? (
                    <span className="text-muted-foreground text-sm">Rp {fmt(item.prev_ref_price)}</span>
                  ) : <span className="text-muted-foreground/60 text-sm">-</span>}
                  {item.prev_quarter_label && <div className="text-xs text-muted-foreground">{item.prev_quarter_label}</div>}
                </>
              ) },
              { key: "ref_variance_pct", label: "Variance", align: "center",
                render: (item) => <VarianceBadge pct={item.ref_variance_pct} /> },
              { key: "brand", label: "Brand", render: (item) => (
                <div className="flex gap-1 flex-wrap">
                  {(item.brand_availability || []).map(b => (
                    <span key={b} className="text-xs bg-sky-500/10 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 rounded">{b.toUpperCase()}</span>
                  ))}
                </div>
              ) },
            ]}
            rowAction={(item) => (
              <div className="flex gap-1 justify-end" data-testid={`market-list-row-actions-${item.id}`}>
                <Button size="icon-sm" variant="ghost" onClick={() => openHistory(item)} title="Histori harga" aria-label={`Histori harga ${item.name}`} data-testid={`market-list-history-${item.id}`}>
                  <BarChart2 />
                </Button>
                {canManage && item.ml_status !== "pending_review" && (
                  <Button size="icon-sm" variant="ghost" onClick={() => openSetPrice(item)} title="Set harga referensi" aria-label={`Set harga referensi ${item.name}`} data-testid={`market-list-set-price-${item.id}`}>
                    <Star />
                  </Button>
                )}
                {canManage && item.ml_status === "pending_review" && (
                  <Button size="sm" onClick={() => openApprove(item)} data-testid={`market-list-approve-${item.id}`}>
                    <CheckCircle /> Setujui
                  </Button>
                )}
              </div>
            )}
          />
        </div>
        {/* Pagination */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border/50" data-testid="market-list-pagination">
          <div className="text-xs md:text-sm text-muted-foreground">
            {meta.total > 0 ? `Menampilkan ${(page-1)*50+1}–${Math.min(page*50, meta.total)} dari ${meta.total} item` : ""}
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="Halaman sebelumnya" data-testid="market-list-prev-page">
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="icon-sm" disabled={page * 50 >= (meta.total || 0)} onClick={() => setPage(p => p + 1)} aria-label="Halaman berikutnya" data-testid="market-list-next-page">
              <ChevronRight />
            </Button>
          </div>
        </div>
      </Card>
      {/* Create Quarter Modal */}
      <Dialog open={showCreateQuarter} onOpenChange={setShowCreateQuarter}>
        <DialogContent data-testid="quarter-form-dialog">
          <DialogHeader>
            <DialogTitle>Buat Quarter Baru</DialogTitle>
            <DialogDescription>Quarter baru dibuat sebagai draft; aktifkan setelah harga acuan diisi.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="quarter-form-year-input" className="text-xs md:text-sm font-medium">Tahun <span className="text-destructive">*</span></Label>
              <Input id="quarter-form-year-input" type="number" value={newQuarter.year} onChange={e => setNewQuarter(q => ({ ...q, year: parseInt(e.target.value) }))} data-testid="quarter-form-year" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quarter-form-quarter-input" className="text-xs md:text-sm font-medium">Quarter <span className="text-destructive">*</span></Label>
              <Select value={String(newQuarter.quarter)} onValueChange={v => setNewQuarter(q => ({ ...q, quarter: parseInt(v) }))}>
                <SelectTrigger id="quarter-form-quarter-input" data-testid="quarter-form-quarter"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Q1 (Jan–Mar)</SelectItem>
                  <SelectItem value="2">Q2 (Apr–Jun)</SelectItem>
                  <SelectItem value="3">Q3 (Jul–Sep)</SelectItem>
                  <SelectItem value="4">Q4 (Okt–Des)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateQuarter(false)} data-testid="quarter-form-cancel">Batal</Button>
            <Button onClick={handleCreateQuarter} disabled={saving} data-testid="quarter-form-save">
              {saving ? "Menyimpan…" : "Buat Quarter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Price Modal */}
      <Dialog open={showSetPrice} onOpenChange={setShowSetPrice}>
        <DialogContent data-testid="price-form-dialog">
          <DialogHeader>
            <DialogTitle>Set Harga Referensi</DialogTitle>
            <DialogDescription>
              Item: <strong>{selectedItem?.name}</strong> · Quarter: <strong>{quarters.find(q => q.id === selectedQuarter)?.label || "—"}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="price-form-unit-input" className="text-xs md:text-sm font-medium">Unit</Label>
              <Input id="price-form-unit-input" value={priceForm.unit} onChange={e => setPriceForm(f => ({ ...f, unit: e.target.value }))} data-testid="price-form-unit" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price-form-ref-price-input" className="text-xs md:text-sm font-medium">Harga referensi (Rp) <span className="text-destructive">*</span></Label>
              <Input id="price-form-ref-price-input" type="number" value={priceForm.ref_price} onChange={e => setPriceForm(f => ({ ...f, ref_price: e.target.value }))} placeholder="0" data-testid="price-form-ref-price" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price-form-notes-input" className="text-xs md:text-sm font-medium">Catatan (opsional)</Label>
              <Input id="price-form-notes-input" value={priceForm.notes} onChange={e => setPriceForm(f => ({ ...f, notes: e.target.value }))} data-testid="price-form-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSetPrice(false)} data-testid="price-form-cancel">Batal</Button>
            <Button onClick={handleSetPrice} disabled={saving} data-testid="price-form-save">
              {saving ? "Menyimpan…" : "Simpan harga"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Modal */}
      <Dialog open={showApprove} onOpenChange={setShowApprove}>
        <DialogContent data-testid="approve-form-dialog">
          <DialogHeader>
            <DialogTitle>Setujui Item Baru</DialogTitle>
            <DialogDescription>
              <strong>{selectedItem?.name}</strong> ditambahkan oleh KDO/BDO/FDO dan perlu disetujui sebelum dipakai.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="approve-form-category-input" className="text-xs md:text-sm font-medium">Kategori <span className="text-destructive">*</span></Label>
              <Select value={approveForm.category_id} onValueChange={v => setApproveForm(f => ({ ...f, category_id: v }))}>
                <SelectTrigger id="approve-form-category-input" data-testid="approve-form-category"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="approve-form-ref-price-input" className="text-xs md:text-sm font-medium">Harga referensi quarter aktif (opsional)</Label>
              <Input id="approve-form-ref-price-input" type="number" value={approveForm.ref_price} onChange={e => setApproveForm(f => ({ ...f, ref_price: e.target.value }))} placeholder="0" data-testid="approve-form-ref-price" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprove(false)} data-testid="approve-form-cancel">Batal</Button>
            <Button onClick={handleApprove} disabled={saving || !approveForm.category_id} data-testid="approve-form-save">
              {saving ? "Menyimpan…" : "Setujui item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quarter History Modal */}
      <Dialog open={showQuarterHistory} onOpenChange={setShowQuarterHistory}>
        <DialogContent className="max-w-2xl" data-testid="history-dialog">
          <DialogHeader>
            <DialogTitle>Histori Harga: {selectedItem?.name}</DialogTitle>
            <DialogDescription>Harga referensi per quarter untuk item ini.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {itemHistory.length === 0 ? (
              <div data-testid="history-empty"><EmptyState icon={BarChart2} title="Belum ada histori harga" description="Histori muncul setelah harga referensi di-set untuk suatu quarter." /></div>
            ) : (
              <div data-testid="history-table">
                <DataTable
                  rows={itemHistory.map((h, idx) => ({ ...h, _key: idx }))}
                  keyField="_key"
                  rowTestIdPrefix="history-row"
                  columns={[
                    { key: "quarter_label", label: "Quarter", primary: true,
                      render: (h) => <span className="font-medium">{h.quarter_label}</span> },
                    { key: "unit", label: "Unit" },
                    { key: "ref_price", label: "Harga Referensi", numeric: true,
                      render: (h) => <span className="font-semibold">Rp {fmt(h.ref_price)}</span> },
                    { key: "previous_ref_price", label: "Harga Sebelumnya", numeric: true,
                      render: (h) => <span className="text-muted-foreground">{h.previous_ref_price ? `Rp ${fmt(h.previous_ref_price)}` : "-"}</span> },
                    { key: "variance_pct", label: "Variance", align: "center",
                      render: (h) => <VarianceBadge pct={h.variance_pct} /> },
                  ]}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuarterHistory(false)} data-testid="history-close">Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
