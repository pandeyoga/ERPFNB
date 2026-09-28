/**
 * CMS Outlets — Sprint G Admin CMS
 */
import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, MapPin, Phone, Clock, Eye, EyeOff, Loader2, Copy, CheckSquare, Square } from "lucide-react";
import { WorkflowBadge } from "./CMSWorkflow";
import { Button } from "@/components/ui/button";
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
    <div className="space-y-4" data-testid="cms-outlets-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-xl font-bold">Outlets / Lokasi</h3>
          <p className="text-sm text-muted-foreground">Kelola data outlet untuk halaman Lokasi di website.</p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={filterBrand} onValueChange={setFilterBrand}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Semua Brand" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Brand</SelectItem>
              {brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={openCreate} data-testid="create-outlet-btn">
            <Plus className="h-4 w-4 mr-2" /> Tambah Outlet
          </Button>
        </div>
      </div>

      {/* Search and Status Filter */}
      <div className="flex gap-3 items-center">
        <Input
          placeholder="Cari nama outlet, area, atau alamat..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
          data-testid="outlet-search-input"
        />
        <div className="flex gap-2">
          <Button
            variant={statusFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("all")}
          >
            Semua
          </Button>
          <Button
            variant={statusFilter === "published" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("published")}
          >
            Published
          </Button>
          <Button
            variant={statusFilter === "draft" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("draft")}
          >
            Draft
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <MapPin className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Belum ada outlet.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(item => (
            <div key={item.id} className="border rounded-xl p-4 flex gap-4 bg-white hover:shadow-md transition-shadow"
                 data-testid={`outlet-row-${item.id}`}>
              <MapPin className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{item.name}</span>
                  <Badge variant="outline" className="text-xs">{getBrandName(item.brand_id)}</Badge>
                  <Badge variant={item.status === "published" ? "default" : "secondary"} className="text-xs">
                    {item.status === "published" ? "Published" : "Draft"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{item.address}</p>
                <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                  {item.phone && <span>📞 {item.phone}</span>}
                  {item.area && <span>📍 {item.area}</span>}
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
                <Label>Brand *</Label>
                <Select value={form.brand_id} onValueChange={v => setForm(f=>({...f,brand_id:v}))}>
                  <SelectTrigger data-testid="outlet-brand"><SelectValue placeholder="Pilih brand..." /></SelectTrigger>
                  <SelectContent>{brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Kode Outlet</Label>
                <Input value={form.code} onChange={e => setForm(f=>({...f,code:e.target.value}))} placeholder="the-coffeeshop-sudirman" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Nama Outlet *</Label>
              <Input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} data-testid="outlet-name" />
            </div>
            <div className="space-y-1">
              <Label>Alamat</Label>
              <Textarea rows={2} value={form.address} onChange={e => setForm(f=>({...f,address:e.target.value}))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Area</Label>
                <Input value={form.area} onChange={e => setForm(f=>({...f,area:e.target.value}))} placeholder="Jakarta Selatan" />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => setForm(f=>({...f,phone:e.target.value}))} />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Jam Weekday</Label>
                <Input value={form.hours_weekday} onChange={e => setForm(f=>({...f,hours_weekday:e.target.value}))} placeholder="11:00 – 22:00" />
              </div>
              <div className="space-y-1">
                <Label>Jam Weekend</Label>
                <Input value={form.hours_weekend} onChange={e => setForm(f=>({...f,hours_weekend:e.target.value}))} placeholder="11:00 – 23:00" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Map URL</Label>
              <Input value={form.map_url} onChange={e => setForm(f=>({...f,map_url:e.target.value}))} placeholder="https://maps.google.com/..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Latitude</Label>
                <Input type="number" step="0.0001" value={form.lat} onChange={e => setForm(f=>({...f,lat:e.target.value}))} placeholder="-6.2088" />
              </div>
              <div className="space-y-1">
                <Label>Longitude</Label>
                <Input type="number" step="0.0001" value={form.lng} onChange={e => setForm(f=>({...f,lng:e.target.value}))} placeholder="106.8456" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Fasilitas</Label>
              <div className="flex flex-wrap gap-2">
                {ALL_FEATURES.map(feat => (
                  <button key={feat} type="button"
                          onClick={() => toggleFeature(feat)}
                          className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                            form.features.includes(feat)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background border-muted-foreground/30 text-muted-foreground hover:border-primary"
                          }`}>
                    {feat}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Label>Status</Label>
              <Switch checked={form.status === "published"}
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
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving} data-testid="save-outlet">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Simpan
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
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
