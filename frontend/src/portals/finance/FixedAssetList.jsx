/** Fixed Assets List — Sprint B (complete: add form + row click + register summary) */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Plus, Search, ChevronRight, Loader2, X, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DataTable from "@/components/shared/DataTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import api from "@/lib/api";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";

const STATUS_BADGE = {
  active: "default",
  disposed: "destructive",
  fully_depreciated: "secondary",
  revalued: "outline",
};

const EMPTY_FORM = {
  name: "", category: "MACH", purchase_date: "", purchase_cost: "",
  salvage_value: 0, useful_life_years: 5, dep_method: "straight_line",
  location: "", invoice_no: "", notes: "",
};

export default function FixedAssetList() {
  const navigate = useNavigate();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [filter, setFilter] = useState({ category: "all", status: "all" });
  const [summary, setSummary] = useState(null);

  // Add form dialog
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadCategories(); loadAssets(); loadSummary(); }, [filter]);

  async function loadCategories() {
    try {
      const res = await api.get("/assets/categories");
      if (res.data.success) setCategories(res.data.data.categories);
    } catch {}
  }

  async function loadAssets() {
    setLoading(true);
    try {
      const params = {};
      if (filter.category && filter.category !== "all") params.category = filter.category;
      if (filter.status && filter.status !== "all") params.status = filter.status;
      const res = await api.get("/assets", { params });
      if (res.data.success) setAssets(res.data.data.items);
    } catch { toast.error("Gagal memuat aset"); }
    finally { setLoading(false); }
  }

  async function loadSummary() {
    try {
      const res = await api.get("/assets/register");
      if (res.data.success) setSummary(res.data.data);
    } catch {}
  }

  async function handleCreate() {
    if (!form.name || !form.purchase_date || !form.purchase_cost) {
      toast.error("Nama, tanggal perolehan, dan harga wajib diisi");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/assets", {
        ...form,
        purchase_cost: parseFloat(form.purchase_cost),
        salvage_value: parseFloat(form.salvage_value || 0),
        useful_life_years: parseInt(form.useful_life_years || 5),
      });
      toast.success("Aset berhasil ditambahkan");
      setAddOpen(false);
      setForm(EMPTY_FORM);
      loadAssets();
      loadSummary();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal menambah aset");
    } finally { setSubmitting(false); }
  }

  const totalCost = assets.reduce((s, a) => s + (a.purchase_cost || 0), 0);
  const totalBook = assets.reduce((s, a) => s + (a.book_value || 0), 0);
  const depPct = totalCost > 0 ? Math.round(((totalCost - totalBook) / totalCost) * 100) : 0;

  return (
    <div className="space-y-6" data-testid="fixed-asset-list">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Building2 className="h-6 w-6" /> Aset Tetap
          </h2>
          <p className="text-muted-foreground text-sm">Register aset tetap, depresiasi, dan disposal</p>
        </div>
        <Button onClick={() => setAddOpen(true)} data-testid="add-asset-btn">
          <Plus className="h-4 w-4 mr-2" /> Tambah Aset
        </Button>
      </div>

      {/* Summary Bar */}
      {assets.length > 0 && (
        <div className="grid grid-cols-3 gap-4" data-testid="asset-summary-cards">
          <Card data-testid="asset-summary-cost"><CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Total Harga Perolehan</div>
            <div className="text-lg font-bold" data-testid="asset-total-cost">{formatCurrency(totalCost)}</div>
          </CardContent></Card>
          <Card data-testid="asset-summary-book"><CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Total Nilai Buku</div>
            <div className="text-lg font-bold text-green-600" data-testid="asset-total-book">{formatCurrency(totalBook)}</div>
            <Progress value={100 - depPct} className="h-1 mt-2" />
          </CardContent></Card>
          <Card data-testid="asset-summary-dep"><CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Total Akum. Depresiasi</div>
            <div className="text-lg font-bold text-red-600" data-testid="asset-total-dep">({formatCurrency(totalCost - totalBook)})</div>
          </CardContent></Card>
        </div>
      )}

      {/* Filters */}
      <Card data-testid="asset-filters-card">
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 gap-4">
            <Select value={filter.category} onValueChange={(v) => setFilter(f => ({ ...f, category: v === "all" ? "" : v }))}>
              <SelectTrigger data-testid="category-filter">
                <SelectValue placeholder="Semua Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filter.status} onValueChange={(v) => setFilter(f => ({ ...f, status: v === "all" ? "" : v }))}>
              <SelectTrigger data-testid="status-filter">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="fully_depreciated">Fully Depreciated</SelectItem>
                <SelectItem value="disposed">Disposed</SelectItem>
                <SelectItem value="revalued">Revalued</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card data-testid="assets-table-card">
        <CardContent className="pt-4 px-0 sm:px-2">
          <DataTable
            columns={[
              { key: "asset_code", label: "Kode", primary: true, sortable: true,
                render: (a) => <span className="font-mono text-sm" data-testid={`asset-code-${a.asset_code}`}>{a.asset_code}</span> },
              { key: "name", label: "Nama", sortable: true,
                render: (a) => <span className="font-medium" data-testid={`asset-name-${a.asset_code}`}>{a.name}</span> },
              { key: "category", label: "Kategori", render: (a) => <Badge variant="outline">{a.category}</Badge> },
              { key: "purchase_cost", label: "Harga Perolehan", numeric: true, sortable: true,
                render: (a) => <span data-testid={`asset-cost-${a.asset_code}`}>{formatCurrency(a.purchase_cost)}</span> },
              { key: "book_value", label: "Nilai Buku", numeric: true, sortable: true,
                render: (a) => <span className="font-semibold" data-testid={`asset-book-${a.asset_code}`}>{formatCurrency(a.book_value)}</span> },
              { key: "status", label: "Status",
                render: (a) => <Badge variant={STATUS_BADGE[a.status] || "default"} data-testid={`asset-status-${a.asset_code}`}>{a.status}</Badge> },
            ]}
            rows={assets}
            keyField="id"
            loading={loading}
            onRowClick={(a) => navigate(`/finance/assets/${a.id}`)}
            rowTestIdPrefix="asset-row"
            defaultSort={{ key: "book_value", dir: "desc" }}
            empty={
              <div className="text-center py-12 text-muted-foreground" data-testid="assets-empty">
                <Building2 className="mx-auto h-8 w-8 mb-2" />
                <p>Belum ada aset tetap.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setAddOpen(true)} data-testid="add-first-asset-btn">Tambah Aset Pertama</Button>
              </div>
            }
          />
        </CardContent>
      </Card>

      {/* Add Asset Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl" data-testid="add-asset-dialog">
          <DialogHeader>
            <DialogTitle>Tambah Aset Tetap</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-2 col-span-2">
              <Label>Nama Aset *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Contoh: Espresso Machine" data-testid="asset-name-input" />
            </div>
            <div className="space-y-2">
              <Label>Kategori *</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger data-testid="asset-category-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Metode Depresiasi</Label>
              <Select value={form.dep_method} onValueChange={v => setForm(f => ({ ...f, dep_method: v }))}>
                <SelectTrigger data-testid="dep-method-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="straight_line">Garis Lurus (Straight Line)</SelectItem>
                  <SelectItem value="declining_balance">Saldo Menurun (Declining Balance)</SelectItem>
                  <SelectItem value="sum_of_years_digits">Jumlah Angka Tahun (SYD)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tanggal Perolehan *</Label>
              <Input type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))}
                data-testid="asset-purchase-date" />
            </div>
            <div className="space-y-2">
              <Label>Masa Manfaat (tahun)</Label>
              <Input type="number" value={form.useful_life_years} onChange={e => setForm(f => ({ ...f, useful_life_years: e.target.value }))}
                min={1} max={50} data-testid="asset-useful-life-input" />
            </div>
            <div className="space-y-2">
              <Label>Harga Perolehan (Rp) *</Label>
              <Input type="number" value={form.purchase_cost} onChange={e => setForm(f => ({ ...f, purchase_cost: e.target.value }))}
                placeholder="0" data-testid="asset-cost-input" />
            </div>
            <div className="space-y-2">
              <Label>Nilai Residu (Rp)</Label>
              <Input type="number" value={form.salvage_value} onChange={e => setForm(f => ({ ...f, salvage_value: e.target.value }))}
                placeholder="0" data-testid="asset-salvage-input" />
            </div>
            <div className="space-y-2">
              <Label>Lokasi</Label>
              <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder="Contoh: Kitchen - Bar Area" data-testid="asset-location-input" />
            </div>
            <div className="space-y-2">
              <Label>No. Invoice</Label>
              <Input value={form.invoice_no} onChange={e => setForm(f => ({ ...f, invoice_no: e.target.value }))}
                placeholder="INV/2024/001" data-testid="asset-invoice-input" />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Catatan</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Catatan tambahan..." data-testid="asset-notes-input" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} data-testid="cancel-add-asset">Batal</Button>
            <Button onClick={handleCreate} disabled={submitting} data-testid="confirm-add-asset">
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Simpan Aset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
