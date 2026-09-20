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
import {
  Plus, Trash2, Search, Star, ChevronLeft, ChevronRight,
  RefreshCw, Send, Package, Info, TrendingUp, TrendingDown
} from "lucide-react";
import { useOutletScopeCtx } from "./OutletScopeContext";

const fmt = (n) => n != null ? new Intl.NumberFormat("id-ID").format(n) : "-";

export default function FdoPage() {
  const { user } = useAuth();
  // Bug fix 2026-05-26: `setSelectedOutlet` was not destructured from context.
  // Context exposes `setOutletId` — alias it to match the variable name used below.
  const { outletId: selectedOutlet, setOutletId: setSelectedOutlet, scopedOutlets: outlets } = useOutletScopeCtx();
  const [fdoList, setFdoList] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [page, setPage] = useState(1);
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
      const res = await api.get(`/outlet/fdo?${params}`);
      setFdoList(res.data.data || []);
      setMeta(res.data.meta || {});
    } finally { setLoading(false); }
  }, [selectedOutlet, page]);

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
    if (!selectedOutlet) return alert("Pilih outlet");
    if (lines.length === 0) return alert("Tambahkan minimal 1 item");
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

  const statusBadge = (status) => {
    const map = {
      draft: "bg-gray-100 text-gray-700",
      submitted: "bg-blue-100 text-blue-700",
      approved: "bg-green-100 text-green-700",
      rejected: "bg-red-100 text-red-700",
      converted: "bg-purple-100 text-purple-700",
    };
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] || "bg-gray-100 text-gray-700"}`}>{status?.toUpperCase()}</span>;
  };

  return (
    <div className="p-6 max-w-full" data-testid="fdo-page">
      <div className="flex items-center justify-between mb-6" data-testid="fdo-header">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">FDO — Floor Daily Order</h1>
          <p className="text-sm text-gray-500 mt-1">Permintaan harian untuk floor/service department</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchFdoList} data-testid="fdo-refresh"><RefreshCw className="h-4 w-4" /></Button>
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setShowForm(true)} disabled={!selectedOutlet} data-testid="fdo-create-btn">
            <Plus className="h-4 w-4 mr-1" />Buat FDO
          </Button>
        </div>
      </div>

      {/* Favorites */}
      {favorites.length > 0 && (
        <Card className="mb-4" data-testid="fdo-favorites-card">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />Item Sering Dipesan
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex gap-2 flex-wrap" data-testid="fdo-favorites-list">
              {favorites.map((fav, i) => (
                <button
                  key={i}
                  onClick={() => { setShowForm(true); setTimeout(() => addFavorite(fav), 100); }}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-indigo-50 hover:border-indigo-300 border border-gray-200 rounded-lg text-sm text-gray-700 transition-colors"
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
              <div className="text-center py-12 text-gray-400" data-testid="fdo-list-empty">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <div>Belum ada FDO</div>
              </div>
            )}
            columns={[
              { key: "request_date", label: "Tanggal", primary: true, sortable: true,
                render: (fdo) => fdo.request_date || fdo.created_at?.slice(0, 10) },
              { key: "doc_no", label: "No. Dokumen", sortable: true,
                render: (fdo) => <span className="font-mono text-sm">{fdo.doc_no || "-"}</span> },
              { key: "outlet_id", label: "Outlet",
                render: (fdo) => outletMap[fdo.outlet_id] || fdo.outlet_id },
              { key: "lines", label: "Jumlah Item", align: "center",
                sortAccessor: (fdo) => fdo.lines?.length || 0,
                render: (fdo) => fdo.lines?.length || 0 },
              { key: "status", label: "Status", render: (fdo) => statusBadge(fdo.status) },
              { key: "notes", label: "Catatan",
                render: (fdo) => <span className="text-sm text-gray-500">{fdo.notes || "-"}</span> },
            ]}
          />
          <div className="flex items-center justify-between px-4 py-3 border-t" data-testid="fdo-pagination">
            <div className="text-sm text-gray-500">{meta.total || 0} FDO</div>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} data-testid="fdo-prev-page"><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" disabled={page * 20 >= (meta.total || 0)} onClick={() => setPage(p => p + 1)} data-testid="fdo-next-page"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FDO Form Modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="fdo-form-dialog">
          <DialogHeader>
            <DialogTitle>Buat FDO — Floor Daily Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Outlet <span className="text-red-500">*</span></label>
                <Select value={selectedOutlet} onValueChange={setSelectedOutlet}>
                  <SelectTrigger className="mt-1" data-testid="fdo-form-outlet"><SelectValue /></SelectTrigger>
                  <SelectContent>{outlets.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Tanggal Request <span className="text-red-500">*</span></label>
                <Input type="date" value={reqDate} onChange={e => setReqDate(e.target.value)} className="mt-1" data-testid="fdo-form-date" />
              </div>
            </div>

            {/* Item search */}
            <div>
              <label className="text-sm font-medium">Tambah Item</label>
              <div className="relative mt-1" ref={searchRef}>
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Cari item dari market list..."
                  className="pl-9"
                  value={itemSearch}
                  onChange={e => setItemSearch(e.target.value)}
                  onFocus={() => setShowDropdown(true)}
                  data-testid="fdo-form-item-search"
                />
                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-lg z-50 mt-1 max-h-64 overflow-y-auto" data-testid="fdo-form-search-dropdown">
                    {searchResults.map(item => (
                      <button
                        key={item.id}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-start justify-between border-b last:border-b-0"
                        onClick={() => addLine(item)}
                        data-testid={`fdo-form-add-item-${item.id}`}
                      >
                        <div>
                          <div className="font-medium text-sm">{item.name}</div>
                          <div className="text-xs text-gray-400">{item.unit_default} · {item.category_name || "Tanpa Kategori"}</div>
                        </div>
                        {item._ref_price && (
                          <div className="text-right tabular-nums">
                            <div className="text-xs font-medium text-blue-700">Rp {fmt(item._ref_price.ref_price)}</div>
                            <div className="text-xs text-gray-400">{item._ref_price.quarter_label}</div>
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
                <label className="text-sm font-medium mb-2 block">Item yang Dipesan</label>
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
                              <div className="text-xs text-blue-600 flex items-center gap-1 mt-0.5">
                                <Info className="h-3 w-3" />Ref {ln.ref_quarter}: Rp {fmt(ln.ref_price)}
                              </div>
                            )}
                          </div>
                        ) },
                      { key: "qty", label: "Qty", numeric: true,
                        render: (ln) => (
                          <Input type="number" value={ln.qty}
                            onChange={e => updateLine(ln._idx, "qty", e.target.value)}
                            className="h-8 text-center w-20" min="0.01"
                            data-testid={`fdo-form-line-${ln._idx}-qty`} />
                        ) },
                      { key: "unit", label: "Unit",
                        render: (ln) => (
                          <Input value={ln.unit}
                            onChange={e => updateLine(ln._idx, "unit", e.target.value)}
                            className="h-8 w-20" data-testid={`fdo-form-line-${ln._idx}-unit`} />
                        ) },
                      { key: "ref_price", label: "Harga Ref.", numeric: true,
                        render: (ln) => ln.ref_price
                          ? <span className="text-xs text-blue-700 font-medium">Rp {fmt(ln.ref_price)}</span>
                          : <span className="text-xs text-gray-400">-</span> },
                    ]}
                    rowAction={(ln) => (
                      <button onClick={() => removeLine(ln._idx)} className="text-red-400 hover:text-red-600" data-testid={`fdo-form-line-${ln._idx}-remove`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Catatan</label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} className="mt-1" placeholder="Catatan tambahan..." data-testid="fdo-form-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)} data-testid="fdo-form-cancel">Batal</Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || lines.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              data-testid="fdo-form-submit"
            >
              <Send className="h-4 w-4 mr-1" />
              {saving ? "Mengirim..." : "Submit FDO"}
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
