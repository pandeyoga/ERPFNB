/** Fixed Assets List — Sprint B (complete: add form + row click + register summary) */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Plus, Loader2, Wallet, BookOpen, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DataTable from "@/components/shared/DataTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import EmptyState from "@/components/shared/EmptyState";
import StatusPill, { statusLabel } from "@/components/shared/StatusPill";
import api from "@/lib/api";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import ListToolbar from "@/components/shared/ListToolbar";

/** Status aset — label & warna dari kamus global StatusPill. */
const ASSET_STATUSES = ["active", "fully_depreciated", "disposed", "revalued"];

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
    <div data-testid="fixed-asset-list">
      <PageHeader
        icon={Building2}
        title="Fixed Assets"
        subtitle="Register aset tetap, depresiasi, dan disposal"
        actions={(
          <Button onClick={() => setAddOpen(true)} data-testid="add-asset-btn">
            <Plus /> Tambah Aset
          </Button>
        )}
      />

      <div className="space-y-3 lg:space-y-4">
      {/* Summary Bar */}
      {assets.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="asset-summary-cards">
          <CompactStatCard testId="asset-summary-cost" label="Total harga perolehan" icon={Wallet} color="aurora-1"
            value={<span data-testid="asset-total-cost">{formatCurrency(totalCost)}</span>}
            sub={`${assets.length} aset`} />
          <CompactStatCard testId="asset-summary-book" label="Total nilai buku" icon={BookOpen} color="aurora-4" tone="success"
            value={<span data-testid="asset-total-book">{formatCurrency(totalBook)}</span>}
            sub={`${100 - depPct}% dari harga perolehan`} />
          <CompactStatCard testId="asset-summary-dep" label="Total akum. depresiasi" icon={TrendingDown} color="aurora-6" tone="danger"
            value={<span data-testid="asset-total-dep">({formatCurrency(totalCost - totalBook)})</span>}
            sub={`${depPct}% telah disusutkan`} />
        </div>
      )}

      {/* Filters */}
      <Card data-testid="assets-table-card" className="overflow-hidden">
        {/* Filter menempel pada tabel yang difilternya (DESIGN_SYSTEM §10.3). */}
        <ListToolbar testId="asset-filters-card">
            <Select value={filter.category || "all"} onValueChange={(v) => setFilter(f => ({ ...f, category: v === "all" ? "" : v }))}>
              <SelectTrigger className="w-full sm:w-60" aria-label="Filter kategori" data-testid="category-filter">
                <SelectValue placeholder="Semua Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filter.status || "all"} onValueChange={(v) => setFilter(f => ({ ...f, status: v === "all" ? "" : v }))}>
              <SelectTrigger className="w-full sm:w-52" aria-label="Filter status" data-testid="status-filter">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                {ASSET_STATUSES.map(v => (
                  <SelectItem key={v} value={v}>{statusLabel(v)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
        </ListToolbar>
        <CardContent className="p-0">
          <DataTable
            columns={[
              { key: "asset_code", label: "Kode", primary: true, sortable: true,
                render: (a) => <span className="text-sm font-medium tabular-nums" data-testid={`asset-code-${a.asset_code}`}>{a.asset_code}</span> },
              { key: "name", label: "Nama", sortable: true,
                render: (a) => <span className="font-medium" data-testid={`asset-name-${a.asset_code}`}>{a.name}</span> },
              { key: "category", label: "Kategori", render: (a) => <Badge variant="outline">{a.category}</Badge> },
              { key: "purchase_cost", label: "Harga Perolehan", numeric: true, sortable: true,
                render: (a) => <span data-testid={`asset-cost-${a.asset_code}`}>{formatCurrency(a.purchase_cost)}</span> },
              { key: "book_value", label: "Nilai Buku", numeric: true, sortable: true,
                render: (a) => <span className="font-semibold" data-testid={`asset-book-${a.asset_code}`}>{formatCurrency(a.book_value)}</span> },
              { key: "status", label: "Status",
                render: (a) => <span data-testid={`asset-status-${a.asset_code}`}><StatusPill status={a.status} /></span> },
            ]}
            rows={assets}
            keyField="id"
            loading={loading}
            onRowClick={(a) => navigate(`/finance/assets/${a.id}`)}
            rowTestIdPrefix="asset-row"
            defaultSort={{ key: "book_value", dir: "desc" }}
            empty={
              <div data-testid="assets-empty">
                <EmptyState
                  icon={Building2}
                  title={(filter.category && filter.category !== "all") || (filter.status && filter.status !== "all")
                    ? "Tidak ada aset untuk filter ini" : "Belum ada aset tetap"}
                  description="Registrasikan aset tetap untuk mulai menghitung depresiasi otomatis."
                  action={<Button variant="outline" size="sm" onClick={() => setAddOpen(true)} data-testid="add-first-asset-btn">Tambah Aset Pertama</Button>}
                />
              </div>
            }
          />
        </CardContent>
      </Card>
      </div>

      {/* Add Asset Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl" data-testid="add-asset-dialog">
          <DialogHeader>
            <DialogTitle>Tambah Aset Tetap</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-1">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="asset-name-input">Nama Aset *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Contoh: Espresso Machine" id="asset-name-input" data-testid="asset-name-input" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asset-category-select">Kategori *</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger id="asset-category-select" data-testid="asset-category-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dep-method-select">Metode Depresiasi</Label>
              <Select value={form.dep_method} onValueChange={v => setForm(f => ({ ...f, dep_method: v }))}>
                <SelectTrigger id="dep-method-select" data-testid="dep-method-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="straight_line">Garis Lurus (Straight Line)</SelectItem>
                  <SelectItem value="declining_balance">Saldo Menurun (Declining Balance)</SelectItem>
                  <SelectItem value="sum_of_years_digits">Jumlah Angka Tahun (SYD)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asset-purchase-date">Tanggal Perolehan *</Label>
              <Input type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))}
                id="asset-purchase-date" data-testid="asset-purchase-date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asset-useful-life-input">Masa Manfaat (tahun)</Label>
              <Input type="number" value={form.useful_life_years} onChange={e => setForm(f => ({ ...f, useful_life_years: e.target.value }))}
                min={1} max={50} id="asset-useful-life-input" data-testid="asset-useful-life-input" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asset-cost-input">Harga Perolehan (Rp) *</Label>
              <Input type="number" value={form.purchase_cost} onChange={e => setForm(f => ({ ...f, purchase_cost: e.target.value }))}
                placeholder="0" id="asset-cost-input" data-testid="asset-cost-input" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asset-salvage-input">Nilai Residu (Rp)</Label>
              <Input type="number" value={form.salvage_value} onChange={e => setForm(f => ({ ...f, salvage_value: e.target.value }))}
                placeholder="0" id="asset-salvage-input" data-testid="asset-salvage-input" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asset-location-input">Lokasi</Label>
              <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder="Contoh: Kitchen - Bar Area" id="asset-location-input" data-testid="asset-location-input" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asset-invoice-input">No. Invoice</Label>
              <Input value={form.invoice_no} onChange={e => setForm(f => ({ ...f, invoice_no: e.target.value }))}
                placeholder="INV/2024/001" id="asset-invoice-input" data-testid="asset-invoice-input" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="asset-notes-input">Catatan</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Catatan tambahan..." id="asset-notes-input" data-testid="asset-notes-input" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} data-testid="cancel-add-asset">Batal</Button>
            <Button onClick={handleCreate} disabled={submitting} data-testid="confirm-add-asset">
              {submitting && <Loader2 className="animate-spin" />}
              Simpan Aset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
