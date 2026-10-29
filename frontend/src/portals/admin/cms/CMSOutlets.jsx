/**
 * CMS Outlets — Sprint G Admin CMS
 */
import PageHeader from "@/components/shared/PageHeader";
import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, MapPin, Phone, Loader2, Copy } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import api from "@/lib/api";
import ImageUpload from "@/components/shared/ImageUpload";
import CMSScheduleFields from "@/components/shared/CMSScheduleFields";
import EmptyState from "@/components/shared/EmptyState";
import SegmentedFilter from "@/components/shared/SegmentedFilter";

const ALL_FEATURES = [
  "Dine In", "Takeaway", "Delivery", "Bar", "Coworking",
  "Pet Friendly", "Private Dining", "Events", "Rooftop",
  "Wine Bar", "Live Jazz", "Fresh Baked Daily", "Coffee",
  "Sunset View",
];

const EMPTY_FORM = {
  brand_id: "", code: "", name: "", address: "", area: "",
  phone: "", email: "", hours_weekday: "11:00 – 22:00",
  hours_weekend: "11:00 – 22:00", features: [],
  map_url: "", lat: "", lng: "", status: "draft",
  image: "", publish_at: null, unpublish_at: null,
};

export default function CMSOutlets() {
  const [items, setItems] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterBrand, setFilterBrand] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [cloningId, setCloningId] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [oR, bR] = await Promise.all([
        api.get("/admin/cms/outlets"),
        api.get("/admin/cms/brands"),
      ]);
      setItems(oR.data?.data || []);
      setBrands(bR.data?.data || []);
    } catch { toast.error("Gagal memuat data"); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setFormOpen(true); };
  const openEdit = (item) => {
    setEditing(item.id);
    setForm({ ...item, lat: item.lat || "", lng: item.lng || "", features: item.features || [] });
    setFormOpen(true);
  };

  const handleClone = async (item) => {
    setCloningId(item.id);
    try {
      await api.post(`/admin/cms/outlets/${item.id}/clone`);
      toast.success(`"${item.name}" berhasil di-clone sebagai Draft`);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal clone outlet");
    } finally {
      setCloningId(null);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Nama outlet wajib diisi"); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        lat: form.lat ? parseFloat(form.lat) : null,
        lng: form.lng ? parseFloat(form.lng) : null,
        hours: { weekday: form.hours_weekday, weekend: form.hours_weekend },
      };
      if (editing) {
        await api.put(`/admin/cms/outlets/${editing}`, payload);
        toast.success("Outlet diperbarui");
      } else {
        await api.post("/admin/cms/outlets", payload);
        toast.success("Outlet dibuat");
      }
      setFormOpen(false);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal menyimpan");
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/admin/cms/outlets/${deleteId}`);
      toast.success("Outlet dihapus");
      setDeleteId(null);
      await load();
    } catch { toast.error("Gagal menghapus"); }
  };

  const handleBulkAction = async (action) => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      const r = await api.post("/admin/cms/outlet/bulk-action", { action, ids: [...selected] });
      const res = r.data?.data;
      toast.success(`${res?.success?.length || 0} berhasil, ${res?.failed?.length || 0} gagal`);
      setSelected(new Set()); await load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Bulk action gagal");
    } finally { setBulkLoading(false); }
  };

  const toggleFeature = (feat) => {
    setForm(f => ({
      ...f,
      features: f.features.includes(feat)
        ? f.features.filter(x => x !== feat)
        : [...f.features, feat],
    }));
  };

  const filtered = items.filter(o => {
    const matchesBrand = filterBrand === "all" || o.brand_id === filterBrand;
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    const matchesSearch = !searchQuery ||
      o.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.area?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.address?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesBrand && matchesStatus && matchesSearch;
  });

  const getBrandName = (id) => brands.find(b => b.id === id)?.name || id || "-";

  return (
    <div className="space-y-3" data-testid="cms-outlets-page">
      {/* Di dalam CMS Studio, PageHeader mengisi subtitle & aksi header hub (DESIGN_SYSTEM §10.1). */}
      <PageHeader
        title="Outlets"
        subtitle="Kelola data outlet untuk halaman Lokasi di website."
        actions={<>
          <Button onClick={openCreate} data-testid="create-outlet-btn">
            <Plus className="h-4 w-4" /> Tambah Outlet
          </Button>
        </>}
      />

      {/* Search, Brand & Status Filter */}
      <div className="flex gap-3 items-center flex-wrap">
        <Input
          placeholder="Cari nama outlet, area, atau alamat..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
          aria-label="Cari outlet"
          data-testid="outlet-search-input"
        />
        <Select value={filterBrand} onValueChange={setFilterBrand}>
          <SelectTrigger className="w-40" aria-label="Filter brand" data-testid="outlet-brand-filter"><SelectValue placeholder="Semua Brand" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Brand</SelectItem>
            {brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <SegmentedFilter
          value={statusFilter}
          onChange={setStatusFilter}
          ariaLabel="Filter status outlet"
          options={[
            { value: "all", label: "Semua", testId: "outlet-filter-all" },
            { value: "published", label: "Published", testId: "outlet-filter-published" },
            { value: "draft", label: "Draft", testId: "outlet-filter-draft" },
          ]}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="glass-card">
          <EmptyState icon={MapPin} title="Belum ada outlet" description="Klik Tambah Outlet atau ubah filter pencarian." />
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(item => (
            <div key={item.id} className="glass-card p-4 flex gap-4 hover:shadow-md transition-shadow"
                 data-testid={`outlet-row-${item.id}`}>
              <MapPin className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm md:text-base font-semibold">{item.name}</h3>
                  <Badge variant="outline" className="text-xs">{getBrandName(item.brand_id)}</Badge>
                  <Badge variant={item.status === "published" ? "default" : "secondary"} className="text-xs">
                    {item.status === "published" ? "Published" : "Draft"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{item.address}</p>
                <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                  {item.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {item.phone}</span>}
                  {item.area && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {item.area}</span>}
                </div>
                <div className="flex gap-1 mt-2 flex-wrap">
                  {(item.features || []).map(f => (
                    <Badge key={f} variant="outline" className="text-xs">{f}</Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  size="icon" variant="ghost"
                  title="Clone sebagai Draft"
                  aria-label="Clone outlet sebagai draft"
                  onClick={() => handleClone(item)}
                  disabled={cloningId === item.id}
                  data-testid={`clone-outlet-${item.id}`}
                >
                  {cloningId === item.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Copy className="h-4 w-4 text-muted-foreground" />}
                </Button>
                <Button size="icon" variant="ghost" aria-label="Edit outlet" onClick={() => openEdit(item)}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label="Hapus outlet" className="text-destructive" onClick={() => setDeleteId(item.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="outlet-form-dialog">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Outlet" : "Tambah Outlet"}</DialogTitle>
            <DialogDescription>Data ini tampil di halaman Lokasi website compro.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="outlet-form-brand">Brand *</Label>
                <Select value={form.brand_id} onValueChange={v => setForm(f=>({...f,brand_id:v}))}>
                  <SelectTrigger id="outlet-form-brand" data-testid="outlet-brand"><SelectValue placeholder="Pilih brand..." /></SelectTrigger>
                  <SelectContent>{brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="outlet-form-kode-outlet">Kode Outlet</Label>
                <Input id="outlet-form-kode-outlet" value={form.code} onChange={e => setForm(f=>({...f,code:e.target.value}))} placeholder="the-coffeeshop-sudirman" />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="outlet-form-nama-outlet">Nama Outlet *</Label>
              <Input id="outlet-form-nama-outlet" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} data-testid="outlet-name" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="outlet-form-alamat">Alamat</Label>
              <Textarea id="outlet-form-alamat" rows={2} value={form.address} onChange={e => setForm(f=>({...f,address:e.target.value}))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="outlet-form-area">Area</Label>
                <Input id="outlet-form-area" value={form.area} onChange={e => setForm(f=>({...f,area:e.target.value}))} placeholder="Jakarta Selatan" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="outlet-form-phone">Phone</Label>
                <Input id="outlet-form-phone" value={form.phone} onChange={e => setForm(f=>({...f,phone:e.target.value}))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="outlet-form-email">Email</Label>
                <Input id="outlet-form-email" value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="outlet-form-jam-weekday">Jam Weekday</Label>
                <Input id="outlet-form-jam-weekday" value={form.hours_weekday} onChange={e => setForm(f=>({...f,hours_weekday:e.target.value}))} placeholder="11:00 – 22:00" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="outlet-form-jam-weekend">Jam Weekend</Label>
                <Input id="outlet-form-jam-weekend" value={form.hours_weekend} onChange={e => setForm(f=>({...f,hours_weekend:e.target.value}))} placeholder="11:00 – 23:00" />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="outlet-form-map-url">Map URL</Label>
              <Input id="outlet-form-map-url" value={form.map_url} onChange={e => setForm(f=>({...f,map_url:e.target.value}))} placeholder="https://maps.google.com/..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="outlet-form-latitude">Latitude</Label>
                <Input id="outlet-form-latitude" type="number" step="0.0001" value={form.lat} onChange={e => setForm(f=>({...f,lat:e.target.value}))} placeholder="-6.2088" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="outlet-form-longitude">Longitude</Label>
                <Input id="outlet-form-longitude" type="number" step="0.0001" value={form.lng} onChange={e => setForm(f=>({...f,lng:e.target.value}))} placeholder="106.8456" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Fasilitas</Label>
              <div className="flex flex-wrap gap-2">
                {ALL_FEATURES.map(feat => (
                  <Button key={feat} type="button" size="sm"
                          variant={form.features.includes(feat) ? "default" : "outline"}
                          onClick={() => toggleFeature(feat)}
                          aria-pressed={form.features.includes(feat)}>
                    {feat}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="outlet-form-status">Status</Label>
              <Switch id="outlet-form-status" checked={form.status === "published"}
                      onCheckedChange={v => setForm(f=>({...f,status:v?"published":"draft"}))} />
              <span className="text-sm">{form.status === "published" ? "Published" : "Draft"}</span>
            </div>
            <Separator />
            <ImageUpload
              label="Foto Outlet"
              value={form.image || ""}
              onChange={(url) => setForm(f => ({ ...f, image: url }))}
            />
            <Separator />
            <CMSScheduleFields
              form={form}
              onChange={(field, value) => setForm(f => ({ ...f, [field]: value }))}
              currentStatus={form.status}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving} data-testid="save-outlet">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Outlet?</AlertDialogTitle>
            <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className={buttonVariants({ variant: "destructive" })}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
