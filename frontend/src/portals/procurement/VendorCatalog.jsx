/** Vendor Item Catalog — Smart Procurement
 * Shows per-vendor item catalog with actual prices, price history,
 * and comparison vs Market List reference price.
 */
import React, { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "../../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "../../components/ui/select";
import DataTable from "@/components/shared/DataTable";
import { confirmDialog } from "@/components/shared/confirmDialog";
import {
  TrendingUp, TrendingDown, Search, RefreshCw, Package,
  History, ChevronLeft, ChevronRight, Building2, Star,
  AlertTriangle, CheckCircle, XCircle
} from "lucide-react";

const fmt = (n) => n != null ? new Intl.NumberFormat("id-ID").format(n) : "-";

const DeviationBadge = ({ pct }) => {
  if (pct == null) return <span className="text-gray-400 text-xs">No ref</span>;
  const cls = pct > 10 ? "bg-red-100 text-red-700" : pct < -10 ? "bg-green-100 text-green-700" : pct > 0 ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700";
  const icon = pct > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded-full ${cls}`}>
      {icon}{pct > 0 ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
};

const AvailBadge = ({ status }) => {
  if (status === "available") return (
    <span className="inline-flex items-center gap-1 text-xs text-green-700">
      <CheckCircle className="h-3 w-3" />Tersedia
    </span>
  );
  if (status === "unavailable") return (
    <span className="inline-flex items-center gap-1 text-xs text-red-700">
      <XCircle className="h-3 w-3" />Tidak Tersedia
    </span>
  );
  return (
    <span className="text-xs text-gray-400">Discontinued</span>
  );
};

export default function VendorCatalog() {
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
  useEffect(() => { fetchCatalog(); }, [fetchCatalog]);

  const openHistory = async (item) => {
    setSelectedVendorItem(item);
    const res = await api.get(`/vendor-items/history/${selectedVendor.id}/${item.item_id}?limit=20`);
    setPriceHistory(res.data.data || []);
    setShowHistory(true);
  };

  const toggleAvailability = async (item) => {
    const isAvail = item.availability_status === "available";
    const action = isAvail ? "unavailable" : "available";
    if (!(await confirmDialog(`${isAvail ? "Tandai tidak tersedia" : "Tandai tersedia"}: ${item.item_name}?`))) return;
    try {
      await api.post(`/vendor-items/vendor/${selectedVendor.id}/item/${item.item_id}/${action}`, {});
      await fetchCatalog();
    } catch (e) {
      alert(e.response?.data?.errors?.[0]?.message || "Gagal");
    }
  };

  const filteredVendors = vendors.filter(v =>
    !vendorSearch || v.name.toLowerCase().includes(vendorSearch.toLowerCase()) ||
    v.code.toLowerCase().includes(vendorSearch.toLowerCase())
  );

  const sourceTag = (source) => {
    const map = {
      po: { cls: "bg-blue-100 text-blue-700", label: "PO" },
      gr: { cls: "bg-green-100 text-green-700", label: "GR" },
      manual: { cls: "bg-purple-100 text-purple-700", label: "Manual" },
    };
    const t = map[source] || { cls: "bg-gray-100 text-gray-600", label: source };
    return <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${t.cls}`}>{t.label}</span>;
  };

  return (
    <div className="p-6 max-w-full" data-testid="vendor-catalog-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendor Item Catalog</h1>
          <p className="text-sm text-gray-500 mt-1">
            Harga aktual per vendor — diupdate otomatis dari PO & GR
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchVendors(); fetchCatalog(); }} data-testid="vendor-catalog-refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Vendor List */}
        <div className="col-span-1">
          <Card className="h-full" data-testid="vendor-catalog-vendor-list">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-600" />
                Daftar Vendor
              </CardTitle>
              <Input
                placeholder="Cari vendor..."
                className="mt-2 h-8 text-sm"
                value={vendorSearch}
                onChange={e => setVendorSearch(e.target.value)}
                data-testid="vendor-catalog-vendor-search"
              />
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-y-auto max-h-[600px]">
                {vendorLoading ? (
                  <div className="text-center py-4 text-gray-400 text-sm" data-testid="vendor-catalog-vendor-loading">Memuat...</div>
                ) : filteredVendors.length === 0 ? (
                  <div className="text-center py-4 text-gray-400 text-sm" data-testid="vendor-catalog-vendor-empty">Tidak ada vendor</div>
                ) : filteredVendors.map(v => (
                  <button
                    key={v.id}
                    onClick={() => { setSelectedVendor(v); setCatalogPage(1); setCatalogSearch(""); }}
                    className={`w-full text-left px-4 py-3 border-b last:border-b-0 transition-colors ${
                      selectedVendor?.id === v.id
                        ? "bg-blue-50 border-r-2 border-r-blue-500"
                        : "hover:bg-gray-50"
                    }`}
                    data-testid={`vendor-catalog-vendor-${v.id}`}
                  >
                    <div className="font-medium text-sm text-gray-900">{v.name}</div>
                    <div className="text-xs text-gray-400">{v.code}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Catalog */}
        <div className="col-span-3">
          {!selectedVendor ? (
            <Card className="h-64 flex items-center justify-center" data-testid="vendor-catalog-no-vendor">
              <div className="text-center text-gray-400">
                <Building2 className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <div className="text-sm">Pilih vendor di sebelah kiri</div>
              </div>
            </Card>
          ) : (
            <Card data-testid="vendor-catalog-detail-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base" data-testid="vendor-catalog-selected-name">{selectedVendor.name}</CardTitle>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {catalogMeta.total || 0} item terlacak
                      {selectedVendor.phone && ` · ${selectedVendor.phone}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Cari item..."
                      className="h-8 w-48 text-sm"
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
                  rowClassName={(item) => item.availability_status === "unavailable" ? "bg-red-50 opacity-80" : ""}
                  empty={(
                    <div className="text-center py-12 text-gray-400" data-testid="vendor-catalog-empty">
                      <Package className="h-12 w-12 mx-auto mb-2 opacity-30" />
                      <div className="text-sm">Belum ada item di katalog vendor ini</div>
                      <div className="text-xs mt-1">Data akan otomatis terisi saat PO/GR dibuat</div>
                    </div>
                  )}
                  columns={[
                    { key: "item_name", label: "Item", primary: true, sortable: true,
                      render: (item) => (
                        <div>
                          <div className="font-medium text-sm">{item.item_name}</div>
                          <div className="text-xs text-gray-400">{item.item_code}</div>
                        </div>
                      ) },
                    { key: "category_name", label: "Kategori",
                      render: (item) => <span className="text-xs text-gray-500">{item.category_name || "-"}</span> },
                    { key: "unit", label: "Unit", render: (item) => <span className="text-sm">{item.unit}</span> },
                    { key: "current_price", label: "Harga Aktual", numeric: true, sortable: true,
                      render: (item) => (
                        <div>
                          <span className="font-semibold text-gray-900">
                            {item.current_price > 0 ? `Rp ${fmt(item.current_price)}` : "-"}
                          </span>
                          {item.last_gr_date && <div className="text-xs text-green-600">dari GR {item.last_gr_date}</div>}
                        </div>
                      ) },
                    { key: "ref_price", label: "Harga Ref. Market", numeric: true,
                      render: (item) => (
                        <div>
                          {item.ref_price ? (
                            <span className="text-gray-500 text-sm">Rp {fmt(item.ref_price)}</span>
                          ) : <span className="text-gray-300 text-xs">-</span>}
                          {item.ref_quarter_label && <div className="text-xs text-gray-400">{item.ref_quarter_label}</div>}
                        </div>
                      ) },
                    { key: "deviation_pct", label: "Deviasi", align: "center", sortable: true,
                      render: (item) => <DeviationBadge pct={item.deviation_pct} /> },
                    { key: "availability_status", label: "Status", align: "center",
                      render: (item) => <AvailBadge status={item.availability_status} /> },
                    { key: "source", label: "Sumber Terakhir",
                      render: (item) => (
                        <div>
                          <div className="flex items-center gap-1">
                            {item.last_po_no && sourceTag("po")}
                            {item.last_gr_no && sourceTag("gr")}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {item.last_gr_date || item.last_po_date || "-"}
                          </div>
                        </div>
                      ) },
                  ]}
                  rowAction={(item) => (
                    <div className="flex gap-1 justify-end" data-testid={`vendor-catalog-row-actions-${item.item_id}`}>
                      <Button size="sm" variant="ghost" onClick={() => openHistory(item)}
                        title="Histori Harga" data-testid={`vendor-catalog-history-${item.item_id}`}>
                        <History className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleAvailability(item)}
                        title={item.availability_status === "available" ? "Tandai Tidak Tersedia" : "Tandai Tersedia"}
                        className={item.availability_status === "available" ? "text-gray-500 hover:text-red-500" : "text-red-500 hover:text-green-500"}
                        data-testid={`vendor-catalog-toggle-${item.item_id}`}>
                        {item.availability_status === "available"
                          ? <XCircle className="h-4 w-4" />
                          : <CheckCircle className="h-4 w-4" />}
                      </Button>
                    </div>
                  )}
                />
                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t" data-testid="vendor-catalog-pagination">
                  <div className="text-sm text-gray-500">{catalogMeta.total || 0} item</div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" disabled={catalogPage <= 1} onClick={() => setCatalogPage(p => p - 1)} data-testid="vendor-catalog-prev">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={catalogPage * 30 >= (catalogMeta.total || 0)} onClick={() => setCatalogPage(p => p + 1)} data-testid="vendor-catalog-next">
                      <ChevronRight className="h-4 w-4" />
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
              Histori Harga: {selectedVendorItem?.item_name}
              <span className="text-sm font-normal text-gray-500 ml-2">@ {selectedVendor?.name}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {priceHistory.length === 0 ? (
              <div className="text-center text-gray-400 py-8" data-testid="vendor-catalog-history-empty">Belum ada histori perubahan harga</div>
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
                    render: (h) => <span className="text-gray-500 text-sm">{h.old_price > 0 ? `Rp ${fmt(h.old_price)}` : "-"}</span> },
                  { key: "new_price", label: "Harga Baru", numeric: true,
                    render: (h) => <span className="font-semibold text-sm">Rp {fmt(h.new_price)}</span> },
                  { key: "change_pct", label: "Perubahan", align: "center",
                    render: (h) => h.change_pct != null ? (
                      <span className={`text-xs font-semibold ${h.change_pct > 0 ? "text-red-600" : h.change_pct < 0 ? "text-green-600" : "text-gray-500"}`}>
                        {h.change_pct > 0 ? "+" : ""}{h.change_pct?.toFixed(1)}%
                      </span>
                    ) : "-" },
                  { key: "source", label: "Sumber",
                    render: (h) => (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        h.source === "gr" ? "bg-green-100 text-green-700" :
                        h.source === "po" ? "bg-blue-100 text-blue-700" :
                        "bg-purple-100 text-purple-700"
                      }`}>{h.source?.toUpperCase()}</span>
                    ) },
                  { key: "source_doc_no", label: "Dokumen",
                    render: (h) => <span className="text-xs font-mono text-gray-500">{h.source_doc_no || "-"}</span> },
                ]}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
