/** Vendor Item Catalog — Smart Procurement
 * Shows per-vendor item catalog with actual prices, price history,
 * and comparison vs Market List reference price.
 */
import { toast } from "sonner";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import DataTable from "@/components/shared/DataTable";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { confirmDialog } from "@/components/shared/confirmDialog";
import {
  TrendingUp, TrendingDown, RefreshCw, Package,
  History, ChevronLeft, ChevronRight, Building2, BookOpen,
  CheckCircle, XCircle
} from "lucide-react";

import { fmtNumber } from "@/lib/format";
const fmt = (n) => fmtNumber(n); // DUP-10: shared formatter

const DeviationBadge = ({ pct }) => {
  if (pct == null) return <span className="text-muted-foreground text-xs">Tanpa ref</span>;
  const cls = pct > 10 ? "bg-red-500/15 text-red-700 dark:text-red-300" : pct < -10 ? "bg-green-500/15 text-green-700 dark:text-green-300" : pct > 0 ? "bg-orange-500/15 text-orange-700 dark:text-orange-300" : "bg-blue-500/15 text-blue-700 dark:text-blue-300";
  const icon = pct > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded-full ${cls}`}>
      {icon}{pct > 0 ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
};

const AvailBadge = ({ status }) => {
  if (status === "available") return (
    <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
      <CheckCircle className="h-3 w-3" />Tersedia
    </span>
  );
  if (status === "unavailable") return (
    <span className="inline-flex items-center gap-1 text-xs text-red-700 dark:text-red-400">
      <XCircle className="h-3 w-3" />Tidak tersedia
    </span>
  );
  return (
    <span className="text-xs text-muted-foreground">Discontinued</span>
  );
};

export default function VendorCatalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const qVendor = searchParams.get("vendor") || "";
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [catalogMeta, setCatalogMeta] = useState({ total: 0 });
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [vendorLoading, setVendorLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedVendorItem, setSelectedVendorItem] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [vendorSearch, setVendorSearch] = useState("");

  const fetchVendors = useCallback(async () => {
    setVendorLoading(true);
    try {
      const res = await api.get("/master/vendors?per_page=100");
      setVendors(res.data.data || []);
    } finally { setVendorLoading(false); }
  }, []);

  const fetchCatalog = useCallback(async () => {
    if (!selectedVendor) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: catalogPage,
        per_page: 30,
        ...(catalogSearch && { search: catalogSearch }),
      });
      const res = await api.get(`/vendor-items/vendor/${selectedVendor.id}?${params}`);
      setCatalog(res.data.data || []);
      setCatalogMeta(res.data.meta || {});
    } finally { setLoading(false); }
  }, [selectedVendor, catalogPage, catalogSearch]);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  // Deep-link dari halaman Vendors: ?vendor=<id> langsung membuka katalog vendor tsb
  useEffect(() => {
    if (!qVendor || selectedVendor?.id === qVendor) return;
    const v = vendors.find(x => x.id === qVendor);
    if (v) { setSelectedVendor(v); setCatalogPage(1); setCatalogSearch(""); }
  }, [qVendor, vendors]); // eslint-disable-line

  const selectVendor = (v) => {
    setSelectedVendor(v); setCatalogPage(1); setCatalogSearch("");
    const next = new URLSearchParams(searchParams);
    next.set("vendor", v.id);
    setSearchParams(next, { replace: true });
  };
  useEffect(() => { fetchCatalog(); }, [fetchCatalog]);

  const openHistory = async (item) => {
    setSelectedVendorItem(item);
    try {
      const res = await api.get(`/vendor-items/history/${selectedVendor.id}/${item.item_id}?limit=20`);
      setPriceHistory(res.data.data || []);
      setShowHistory(true);
    } catch (e) {
      toast.error("Gagal memuat histori harga");
    }
  };

  const toggleAvailability = async (item) => {
    const isAvail = item.availability_status === "available";
    const action = isAvail ? "unavailable" : "available";
    if (!(await confirmDialog(`${isAvail ? "Tandai tidak tersedia" : "Tandai tersedia"}: ${item.item_name}?`))) return;
    try {
      await api.post(`/vendor-items/vendor/${selectedVendor.id}/item/${item.item_id}/${action}`, {});
      await fetchCatalog();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal mengubah status ketersediaan");
    }
  };

  const filteredVendors = vendors.filter(v =>
    !vendorSearch || (v.name || "").toLowerCase().includes(vendorSearch.toLowerCase()) ||
    (v.code || "").toLowerCase().includes(vendorSearch.toLowerCase())
  );

  const sourceTag = (source) => {
    const map = {
      po: { cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300", label: "PO" },
      gr: { cls: "bg-green-500/15 text-green-700 dark:text-green-300", label: "GR" },
      manual: { cls: "bg-purple-500/15 text-purple-700 dark:text-purple-300", label: "Manual" },
    };
    const t = map[source] || { cls: "bg-foreground/10 text-muted-foreground", label: source };
    return <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${t.cls}`}>{t.label}</span>;
  };

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="vendor-catalog-page">
      <PageHeader
        icon={BookOpen}
        title="Vendor Item Catalog"
        subtitle="Harga aktual per vendor — diperbarui otomatis dari PO & GR, dibandingkan dengan harga referensi Market List."
        actions={
          <Button variant="outline" onClick={() => { fetchVendors(); fetchCatalog(); }} data-testid="vendor-catalog-refresh">
            <RefreshCw className={loading || vendorLoading ? "animate-spin" : ""} /> Muat ulang
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 lg:gap-4">
        {/* Vendor List */}
        <div className="lg:col-span-1">
          <Card className="h-full" data-testid="vendor-catalog-vendor-list">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Daftar vendor
              </CardTitle>
              <Input
                placeholder="Cari vendor…"
                aria-label="Cari vendor"
                className="mt-2 glass-input"
                value={vendorSearch}
                onChange={e => setVendorSearch(e.target.value)}
                data-testid="vendor-catalog-vendor-search"
              />
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-y-auto max-h-[600px]">
                {vendorLoading ? (
                  <div className="text-center py-4 text-muted-foreground text-sm" data-testid="vendor-catalog-vendor-loading">Memuat…</div>
                ) : filteredVendors.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-sm" data-testid="vendor-catalog-vendor-empty">Tidak ada vendor</div>
                ) : filteredVendors.map(v => (
                  <button
                    key={v.id}
                    type="button"
                    aria-pressed={selectedVendor?.id === v.id}
                    onClick={() => selectVendor(v)}
                    className={`w-full text-left px-4 py-2.5 border-b border-border/40 last:border-b-0 transition-colors ${
                      selectedVendor?.id === v.id
                        ? "bg-primary/5 border-r-2 border-r-primary"
                        : "hover:bg-foreground/5"
                    }`}
                    data-testid={`vendor-catalog-vendor-${v.id}`}
                  >
                    <div className="font-medium text-sm">{v.name}</div>
                    <div className="text-xs text-muted-foreground">{v.code}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Catalog */}
        <div className="lg:col-span-3">
          {!selectedVendor ? (
            <Card data-testid="vendor-catalog-no-vendor">
              <EmptyState icon={Building2} title="Pilih vendor" description="Pilih vendor di daftar sebelah kiri untuk melihat katalog item & harganya." />
            </Card>
          ) : (
            <Card data-testid="vendor-catalog-detail-card">
              <CardHeader>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <CardTitle data-testid="vendor-catalog-selected-name">{selectedVendor.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {catalogMeta.total || 0} item terlacak
                      {selectedVendor.phone && ` · ${selectedVendor.phone}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Cari item…"
                      aria-label="Cari item di katalog"
                      className="glass-input w-56"
                      value={catalogSearch}
                      onChange={e => { setCatalogSearch(e.target.value); setCatalogPage(1); }}
                      data-testid="vendor-catalog-item-search"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <DataTable
                  rows={catalog}
                  keyField="item_id"
                  loading={loading}
                  rowTestIdPrefix="vendor-catalog-row"
                  rowClassName={(item) => item.availability_status === "unavailable" ? "bg-red-500/5 opacity-80" : ""}
                  empty={(
                    <div data-testid="vendor-catalog-empty">
                      <EmptyState icon={Package} title="Belum ada item di katalog vendor ini" description="Data akan otomatis terisi saat PO/GR dibuat." />
                    </div>
                  )}
                  columns={[
                    { key: "item_name", label: "Item", primary: true, sortable: true,
                      render: (item) => (
                        <div>
                          <div className="font-medium text-sm">{item.item_name}</div>
                          <div className="text-xs text-muted-foreground">{item.item_code}</div>
                        </div>
                      ) },
                    { key: "category_name", label: "Kategori",
                      render: (item) => <span className="text-xs text-muted-foreground">{item.category_name || "—"}</span> },
                    { key: "unit", label: "Unit", render: (item) => <span className="text-sm">{item.unit}</span> },
                    { key: "current_price", label: "Harga aktual", numeric: true, sortable: true,
                      render: (item) => (
                        <div>
                          <span className="font-semibold">
                            {item.current_price > 0 ? `Rp ${fmt(item.current_price)}` : "—"}
                          </span>
                          {item.last_gr_date && <div className="text-xs text-green-600 dark:text-green-400">dari GR {item.last_gr_date}</div>}
                        </div>
                      ) },
                    { key: "ref_price", label: "Harga ref. market", numeric: true,
                      render: (item) => (
                        <div>
                          {item.ref_price ? (
                            <span className="text-muted-foreground text-sm">Rp {fmt(item.ref_price)}</span>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                          {item.ref_quarter_label && <div className="text-xs text-muted-foreground">{item.ref_quarter_label}</div>}
                        </div>
                      ) },
                    { key: "deviation_pct", label: "Deviasi", align: "center", sortable: true,
                      render: (item) => <DeviationBadge pct={item.deviation_pct} /> },
                    { key: "availability_status", label: "Status", align: "center",
                      render: (item) => <AvailBadge status={item.availability_status} /> },
                    { key: "source", label: "Sumber terakhir",
                      render: (item) => (
                        <div>
                          <div className="flex items-center gap-1">
                            {item.last_po_no && sourceTag("po")}
                            {item.last_gr_no && sourceTag("gr")}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {item.last_gr_date || item.last_po_date || "—"}
                          </div>
                        </div>
                      ) },
                  ]}
                  rowAction={(item) => (
                    <div className="flex gap-1 justify-end" data-testid={`vendor-catalog-row-actions-${item.item_id}`}>
                      <Button size="icon-sm" variant="ghost" onClick={() => openHistory(item)}
                        title="Histori harga" aria-label={`Histori harga ${item.item_name}`}
                        data-testid={`vendor-catalog-history-${item.item_id}`}>
                        <History />
                      </Button>
                      <Button size="icon-sm" variant="ghost" onClick={() => toggleAvailability(item)}
                        title={item.availability_status === "available" ? "Tandai tidak tersedia" : "Tandai tersedia"}
                        aria-label={`${item.availability_status === "available" ? "Tandai tidak tersedia" : "Tandai tersedia"}: ${item.item_name}`}
                        className={item.availability_status === "available" ? "text-muted-foreground hover:text-red-500" : "text-red-500 hover:text-green-500"}
                        data-testid={`vendor-catalog-toggle-${item.item_id}`}>
                        {item.availability_status === "available"
                          ? <XCircle />
                          : <CheckCircle />}
                      </Button>
                    </div>
                  )}
                />
                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/50" data-testid="vendor-catalog-pagination">
                  <div className="text-xs text-muted-foreground">{catalogMeta.total || 0} item</div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="icon-sm" disabled={catalogPage <= 1} onClick={() => setCatalogPage(p => p - 1)} aria-label="Halaman sebelumnya" data-testid="vendor-catalog-prev">
                      <ChevronLeft />
                    </Button>
                    <Button variant="outline" size="icon-sm" disabled={catalogPage * 30 >= (catalogMeta.total || 0)} onClick={() => setCatalogPage(p => p + 1)} aria-label="Halaman berikutnya" data-testid="vendor-catalog-next">
                      <ChevronRight />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Price History Modal */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-2xl" data-testid="vendor-catalog-history-dialog">
          <DialogHeader>
            <DialogTitle>
              Histori harga: {selectedVendorItem?.item_name}
              <span className="text-sm font-normal text-muted-foreground ml-2">@ {selectedVendor?.name}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {priceHistory.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8" data-testid="vendor-catalog-history-empty">Belum ada histori perubahan harga</div>
            ) : (
              <DataTable
                rows={priceHistory.map((h, idx) => ({ ...h, _idx: idx }))}
                keyField="_idx"
                stickyHeader={false}
                rowTestIdPrefix="vendor-catalog-history-row"
                columns={[
                  { key: "effective_date", label: "Tanggal", primary: true,
                    render: (h) => <span className="text-sm">{h.effective_date}</span> },
                  { key: "old_price", label: "Harga Lama", numeric: true,
                    render: (h) => <span className="text-muted-foreground text-sm">{h.old_price > 0 ? `Rp ${fmt(h.old_price)}` : "—"}</span> },
                  { key: "new_price", label: "Harga Baru", numeric: true,
                    render: (h) => <span className="font-semibold text-sm">Rp {fmt(h.new_price)}</span> },
                  { key: "change_pct", label: "Perubahan", align: "center",
                    render: (h) => h.change_pct != null ? (
                      <span className={`text-xs font-semibold ${h.change_pct > 0 ? "text-red-600" : h.change_pct < 0 ? "text-green-600" : "text-muted-foreground"}`}>
                        {h.change_pct > 0 ? "+" : ""}{h.change_pct?.toFixed(1)}%
                      </span>
                    ) : "-" },
                  { key: "source", label: "Sumber",
                    render: (h) => (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        h.source === "gr" ? "bg-green-500/15 text-green-700 dark:text-green-300" :
                        h.source === "po" ? "bg-blue-500/15 text-blue-700 dark:text-blue-300" :
                        "bg-purple-500/15 text-purple-700 dark:text-purple-300"
                      }`}>{h.source?.toUpperCase()}</span>
                    ) },
                  { key: "source_doc_no", label: "Dokumen",
                    render: (h) => <span className="text-xs tabular-nums text-muted-foreground">{h.source_doc_no || "—"}</span> },
                ]}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
