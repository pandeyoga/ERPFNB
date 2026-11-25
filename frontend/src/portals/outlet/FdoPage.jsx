import React, { useState, useEffect, useCallback, useRef } from "react";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import BudgetBlockDialog from "@/components/shared/BudgetBlockDialog";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "../../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "../../components/ui/select";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import StatusPill from "@/components/shared/StatusPill";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { DAILY_ORDER_STATUS_OPTIONS } from "./KdoBdoList";
import { Label } from "../../components/ui/label";
import {
  Plus, Trash2, Search, Star, ChevronLeft, ChevronRight,
  RefreshCw, Send, Package, Info, TrendingUp, TrendingDown, Utensils
} from "lucide-react";
import { useOutletScopeCtx } from "./OutletScopeContext";

import { fmtNumber } from "@/lib/format";
const fmt = (n) => fmtNumber(n); // DUP-10: shared formatter

export default function FdoPage() {
  const { user } = useAuth();
  // Bug fix 2026-05-26: `setSelectedOutlet` was not destructured from context.
  // Context exposes `setOutletId` — alias it to match the variable name used below.
  const { outletId: selectedOutlet, setOutletId: setSelectedOutlet, scopedOutlets: outlets } = useOutletScopeCtx();
  const [fdoList, setFdoList] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [lines, setLines] = useState([]);
  const [reqDate, setReqDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [budgetBlock, setBudgetBlock] = useState(null);

  // Item search
  const [itemSearch, setItemSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeLineIdx, setActiveLineIdx] = useState(null);
  const searchRef = useRef(null);

  const fetchFdoList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, per_page: 20 });
      if (selectedOutlet) params.set("outlet_id", selectedOutlet);
      if (status) params.set("status", status);
      const res = await api.get(`/outlet/fdo?${params}`);
      setFdoList(res.data.data || []);
      setMeta(res.data.meta || {});
    } finally { setLoading(false); }
  }, [selectedOutlet, page, status]);

  const fetchFavorites = useCallback(async () => {
    if (!selectedOutlet) { setFavorites([]); return; }
    const res = await api.get(`/outlet/fdo/favorites?outlet_id=${selectedOutlet}&limit=8`);
    setFavorites(res.data.data || []);
  }, [selectedOutlet]);

  useEffect(() => { fetchFdoList(); fetchFavorites(); }, [fetchFdoList, fetchFavorites]);

  // Map for outlet name display
  const outletMap = Object.fromEntries((outlets || []).map(o => [o.id, o.name]));

  const searchItems = useCallback(async (q) => {
    if (!q || q.length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const res = await api.get(`/search?q=${encodeURIComponent(q)}&per_page=8`);
      const resultItems = (res.data.data?.items || res.data.data || []);
      // Fetch market ref prices for found items
      if (resultItems.length > 0) {
        const itemIds = resultItems.map(i => i.id).join(",");
        try {
          const refRes = await api.get(`/market-list/ref-prices/bulk?item_ids=${itemIds}`);
          const refMap = refRes.data.data || {};
          resultItems.forEach(item => {
            item._ref_price = refMap[item.id];
          });
        } catch (_) {}
      }
      setSearchResults(resultItems);
      setShowDropdown(true);
    } finally { setSearchLoading(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchItems(itemSearch), 300);
    return () => clearTimeout(t);
  }, [itemSearch, searchItems]);

  const addLine = (item) => {
    const ref = item._ref_price;
    setLines(prev => [...prev, {
      item_id: item.id,
      name: item.name,
      unit: item.unit_default || "pcs",
      qty: 1,
      notes: "",
      ref_price: ref?.ref_price || null,
      ref_quarter: ref?.quarter_label || null,
    }]);
    setItemSearch("");
    setShowDropdown(false);
  };

  const addFavorite = (fav) => {
    if (lines.some(l => l.item_id === fav.item_id)) return;
    setLines(prev => [...prev, {
      item_id: fav.item_id,
      name: fav.item_name || fav.name,
      unit: fav.unit || "pcs",
      qty: 1,
      notes: "",
      ref_price: null,
      ref_quarter: null,
    }]);
  };

  const removeLine = (idx) => setLines(prev => prev.filter((_, i) => i !== idx));
  const updateLine = (idx, field, value) => setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));

  const handleSubmit = async () => {
    if (!selectedOutlet) return toast.error("Pilih outlet");
    if (lines.length === 0) return toast.error("Tambahkan minimal 1 item");
    setSaving(true);
    try {
      await api.post("/outlet/fdo", {
        outlet_id: selectedOutlet,
        request_date: reqDate,
        notes,
        lines: lines.map(l => ({
          item_id: l.item_id,
          name: l.name,
          unit: l.unit,
          qty: parseFloat(l.qty),
          notes: l.notes,
        })),
      });
      setShowForm(false);
      setLines([]);
      setNotes("");
      toast.success("FDO berhasil di-submit");
      await fetchFdoList();
    } catch (e) {
      const errs = e.response?.data?.errors || [];
      const code = errs[0]?.code;
      if (code === "OUTLET_BUDGET_BLOCK") {
        try {
          const verdictRes = await api.post("/outlet-budget/precheck-pr", {
            outlet_id: selectedOutlet,
            source: "fdo",
            lines: lines.map(l => ({
              item_id: l.item_id, name: l.name, unit: l.unit,
              qty: parseFloat(l.qty),
            })),
            request_date: reqDate,
          });
          setBudgetBlock(verdictRes.data.data);
        } catch (_) {
          setBudgetBlock({ bucket: "fdo", pr_total: 0, reason: errs[0]?.field || "OVER_BUDGET", message: errs[0]?.message });
        }
      } else {
        toast.error(errs[0]?.message || "Gagal submit FDO");
      }
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-3" data-testid="fdo-page">
      {/* Section toolbar — sama dengan KDO/BDO (judul h2, bukan h1: halaman induk punya PageHeader) */}
      <div className="glass-card p-3 flex flex-col sm:flex-row sm:items-center gap-3" data-testid="fdo-header">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="h-8 w-8 rounded-[calc(var(--radius)-2px)] grad-aurora-soft flex items-center justify-center shrink-0">
            <Utensils className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base md:text-lg font-semibold leading-tight">FDO — Floor Daily Order</h2>
            <p className="text-xs text-muted-foreground">
              Permintaan harian untuk floor/service department.
              {!selectedOutlet && " Pilih outlet di formulir atau di pemilih outlet (kanan atas)."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-full sm:w-48">
            <SimpleSelect
              value={status}
              onValueChange={(v) => { setStatus(v); setPage(1); }}
              options={DAILY_ORDER_STATUS_OPTIONS}
              placeholder="Semua status"
              className="glass-input w-full"
              ariaLabel="Filter status"
              testId="fdo-status"
            />
          </div>
          <Button variant="outline" size="icon" onClick={fetchFdoList} aria-label="Muat ulang daftar FDO" title="Muat ulang" data-testid="fdo-refresh"><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={() => setShowForm(true)} data-testid="fdo-create-btn">
            <Plus className="h-4 w-4" /> Buat FDO
          </Button>
        </div>
      </div>

      {/* Favorites */}
      {favorites.length > 0 && (
        <Card data-testid="fdo-favorites-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-800 dark:text-amber-400" />Item Sering Dipesan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap" data-testid="fdo-favorites-list">
              {favorites.map((fav, i) => (
                <button
                  key={i}
                  onClick={() => { setShowForm(true); setTimeout(() => addFavorite(fav), 100); }}
                  type="button"
                  className="glass-input rounded-full h-8 px-2.5 text-xs hover:bg-foreground/10 inline-flex items-center gap-1.5"
                  data-testid={`fdo-favorite-${i}`}
                >
                  {fav.item_name || fav.name}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      <Card data-testid="fdo-list-card">
        <CardContent className="p-0">
          <DataTable
            rows={fdoList}
            keyField="id"
            loading={loading}
            rowTestIdPrefix="fdo-row"
            empty={(
              <div data-testid="fdo-list-empty">
                <EmptyState
                  icon={Utensils}
                  title={status ? "Tidak ada FDO dengan status ini" : "Belum ada FDO"}
                  description="Buat FDO untuk mengajukan kebutuhan floor/service harian ke purchasing."
                  action={<Button size="sm" variant="outline" onClick={() => setShowForm(true)}>Buat FDO</Button>}
                />
              </div>
            )}
            columns={[
              { key: "request_date", label: "Tanggal", primary: true, sortable: true,
                render: (fdo) => fdo.request_date || fdo.created_at?.slice(0, 10) },
              { key: "doc_no", label: "No. Dokumen", sortable: true,
                render: (fdo) => <span className="text-xs font-medium tabular-nums">{fdo.doc_no || "-"}</span> },
              { key: "outlet_id", label: "Outlet",
                render: (fdo) => outletMap[fdo.outlet_id] || fdo.outlet_id },
              { key: "lines", label: "Jumlah Item", align: "center",
                sortAccessor: (fdo) => fdo.lines?.length || 0,
                render: (fdo) => fdo.lines?.length || 0 },
              { key: "status", label: "Status", render: (fdo) => <StatusPill status={fdo.status} /> },
              { key: "notes", label: "Catatan",
                render: (fdo) => <span className="text-sm text-muted-foreground">{fdo.notes || "-"}</span> },
            ]}
          />
          {(meta.total || 0) > 20 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/50" data-testid="fdo-pagination">
              <div className="text-xs text-muted-foreground">Total: {meta.total || 0}</div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="Halaman sebelumnya" data-testid="fdo-prev-page"><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon-sm" disabled={page * 20 >= (meta.total || 0)} onClick={() => setPage(p => p + 1)} aria-label="Halaman berikutnya" data-testid="fdo-next-page"><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* FDO Form Modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl" data-testid="fdo-form-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Utensils className="h-4 w-4" /> FDO Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fdo-form-outlet-trigger" className="text-xs md:text-sm font-medium">Outlet *</Label>
                <Select value={selectedOutlet} onValueChange={setSelectedOutlet}>
                  <SelectTrigger id="fdo-form-outlet-trigger" className="mt-1" data-testid="fdo-form-outlet"><SelectValue placeholder="Pilih outlet" /></SelectTrigger>
                  <SelectContent>{outlets.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="fdo-form-date-input" className="text-xs md:text-sm font-medium">Tanggal request *</Label>
                <Input id="fdo-form-date-input" type="date" value={reqDate} onChange={e => setReqDate(e.target.value)} className="mt-1" data-testid="fdo-form-date" />
              </div>
            </div>

            {/* Item search */}
            <div>
              <Label htmlFor="fdo-form-item-search-input" className="text-xs md:text-sm font-medium">Tambah item</Label>
              <div className="relative mt-1" ref={searchRef}>
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="fdo-form-item-search-input"
                  placeholder="Cari item dari market list..."
                  className="pl-9"
                  value={itemSearch}
                  onChange={e => setItemSearch(e.target.value)}
                  onFocus={() => setShowDropdown(true)}
                  data-testid="fdo-form-item-search"
                />
                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-popover text-popover-foreground border rounded-lg shadow-lg z-50 mt-1 max-h-64 overflow-y-auto" data-testid="fdo-form-search-dropdown">
                    {searchResults.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        className="w-full text-left px-4 py-3 hover:bg-muted/60 flex items-start justify-between border-b last:border-b-0"
                        onClick={() => addLine(item)}
                        data-testid={`fdo-form-add-item-${item.id}`}
                      >
                        <div>
                          <div className="font-medium text-sm">{item.name}</div>
                          <div className="text-xs text-muted-foreground">{item.unit_default} · {item.category_name || "Tanpa Kategori"}</div>
                        </div>
                        {item._ref_price && (
                          <div className="text-right tabular-nums">
                            <div className="text-xs font-medium text-blue-700 dark:text-blue-400">Rp {fmt(item._ref_price.ref_price)}</div>
                            <div className="text-xs text-muted-foreground">{item._ref_price.quarter_label}</div>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Lines table */}
            {lines.length > 0 && (
              <div>
                <h3 className="text-sm md:text-base font-semibold mb-2">Item yang dipesan</h3>
                <div className="border rounded-lg overflow-hidden">
                  <DataTable
                    rows={lines.map((ln, idx) => ({ ...ln, _idx: idx }))}
                    keyField="_idx"
                    stickyHeader={false}
                    rowTestIdPrefix="fdo-form-line"
                    empty={<EmptyState title="Belum ada item" description="Cari & tambahkan item di atas." />}
                    columns={[
                      { key: "name", label: "Item", primary: true,
                        render: (ln) => (
                          <div>
                            <div className="font-medium text-sm">{ln.name}</div>
                            {ln.ref_price && (
                              <div className="text-xs text-blue-700 dark:text-blue-400 flex items-center gap-1 mt-0.5">
                                <Info className="h-3 w-3" />Ref {ln.ref_quarter}: Rp {fmt(ln.ref_price)}
                              </div>
                            )}
                          </div>
                        ) },
                      { key: "qty", label: "Qty", numeric: true,
                        render: (ln) => (
                          <Input type="number" value={ln.qty}
                            onChange={e => updateLine(ln._idx, "qty", e.target.value)}
                            className="text-center w-20 ml-auto" min="0.01"
                            aria-label={`Qty ${ln.name}`}
                            data-testid={`fdo-form-line-${ln._idx}-qty`} />
                        ) },
                      { key: "unit", label: "Unit",
                        render: (ln) => (
                          <Input value={ln.unit}
                            onChange={e => updateLine(ln._idx, "unit", e.target.value)}
                            className="w-20" aria-label={`Satuan ${ln.name}`} data-testid={`fdo-form-line-${ln._idx}-unit`} />
                        ) },
                      { key: "ref_price", label: "Harga Ref.", numeric: true,
                        render: (ln) => ln.ref_price
                          ? <span className="text-xs text-blue-700 dark:text-blue-400 font-medium">Rp {fmt(ln.ref_price)}</span>
                          : <span className="text-xs text-muted-foreground">-</span> },
                    ]}
                    rowAction={(ln) => (
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeLine(ln._idx)} className="text-red-700 dark:text-red-400 hover:text-red-600" aria-label={`Hapus ${ln.name}`} data-testid={`fdo-form-line-${ln._idx}-remove`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  />
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="fdo-form-notes-input" className="text-xs md:text-sm font-medium">Catatan</Label>
              <Input id="fdo-form-notes-input" value={notes} onChange={e => setNotes(e.target.value)} className="mt-1" placeholder="Catatan tambahan (opsional)…" data-testid="fdo-form-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)} data-testid="fdo-form-cancel">Batal</Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || lines.length === 0}
              data-testid="fdo-form-submit"
            >
              <Send className="h-4 w-4" />
              {saving ? "Mengirim…" : "Submit FDO"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <BudgetBlockDialog
        open={!!budgetBlock}
        onClose={() => setBudgetBlock(null)}
        verdict={budgetBlock}
        outletId={selectedOutlet}
        onSubmitted={() => { setBudgetBlock(null); setShowForm(false); toast.info("Request terkirim. PR akan bisa di-submit setelah Executive approve."); }}
      />
    </div>
  );
}
