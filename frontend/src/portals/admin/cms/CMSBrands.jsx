/**
 * CMS Brands — Sprint G + I + Sprint I-L (Workflow + Bulk Ops)
 */
import { useState, useEffect } from "react";
import {
  Plus, Edit2, Trash2, Eye, EyeOff, Image, Globe,
  Loader2, History, Copy, ExternalLink,
  CheckSquare, Square, Instagram, X,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import api from "@/lib/api";
import ImageUpload from "@/components/shared/ImageUpload";
import CMSVersionHistory from "./CMSVersionHistory";
import CMSSEOFields from "./CMSSEOFields";
import CMSScheduleFields from "@/components/shared/CMSScheduleFields";
import RichTextEditor from "@/components/shared/RichTextEditor";
import CMSBrandPreview from "./CMSBrandPreview";
import CMSWorkflow, { WorkflowBadge } from "./CMSWorkflow";
import BrandInstagramPosts from "./BrandInstagramPosts";
import SegmentedFilter from "@/components/shared/SegmentedFilter";
import EmptyState from "@/components/shared/EmptyState";

const EMPTY_FORM = {
  code: "", name: "", tagline: "", short_desc: "", story: "",
  color: "#C8A96E", tags: "", hero_image: "", card_image: "",
  established: "", status: "draft",
  signature_dishes: [{name:"",desc:"",price:""},{name:"",desc:"",price:""},{name:"",desc:"",price:""}],
  seo_title: "", seo_description: "", seo_og_image: "", seo_slug: "",
  publish_at: null, unpublish_at: null,
  workflow_status: "draft",
};

export default function CMSBrands() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [versionOpen, setVersionOpen] = useState(false);
  const [versionTarget, setVersionTarget] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [cloningId, setCloningId] = useState(null);
  // IG Posts panel
  const [igBrand, setIgBrand] = useState(null);
  // Bulk selection
  const [selected, setSelected] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/admin/cms/brands");
      setItems(r.data?.data || []);
    } catch { toast.error("Gagal memuat brands"); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item.id);
    setForm({
      ...item,
      tags: Array.isArray(item.tags) ? item.tags.join(", ") : (item.tags || ""),
      signature_dishes: item.signature_dishes?.length
        ? item.signature_dishes
        : [{name:"",desc:"",price:""},{name:"",desc:"",price:""},{name:"",desc:"",price:""}],
      seo_title: item.seo_title || "",
      seo_description: item.seo_description || "",
      seo_og_image: item.seo_og_image || "",
      seo_slug: item.seo_slug || "",
      publish_at: item.publish_at || null,
      unpublish_at: item.unpublish_at || null,
      workflow_status: item.workflow_status || "draft",
    });
    setFormOpen(true);
  };

  const handleSEOChange = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const handleScheduleChange = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleClone = async (item) => {
    setCloningId(item.id);
    try {
      await api.post(`/admin/cms/brands/${item.id}/clone`);
      toast.success(`"${item.name}" berhasil di-clone sebagai Draft`);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal clone brand");
    } finally { setCloningId(null); }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Nama brand wajib diisi"); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
        signature_dishes: form.signature_dishes.filter(d => d.name.trim()),
      };
      if (editing) {
        await api.put(`/admin/cms/brands/${editing}`, payload);
        toast.success("Brand diperbarui");
      } else {
        await api.post("/admin/cms/brands", payload);
        toast.success("Brand dibuat");
      }
      setFormOpen(false);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal menyimpan");
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/admin/cms/brands/${deleteId}`);
      toast.success("Brand dihapus");
      setDeleteId(null);
      await load();
    } catch { toast.error("Gagal menghapus"); }
  };

  const toggleStatus = async (item) => {
    try {
      const newStatus = item.status === "published" ? "draft" : "published";
      await api.put(`/admin/cms/brands/${item.id}`, { ...item, status: newStatus, tags: item.tags || [] });
      toast.success(`Brand ${newStatus === "published" ? "dipublish" : "dijadikan draft"}`);
      await load();
    } catch { toast.error("Gagal mengubah status"); }
  };

  const updateDish = (idx, field, val) => {
    setForm(f => ({
      ...f,
      signature_dishes: f.signature_dishes.map((d, i) => i === idx ? { ...d, [field]: val } : d),
    }));
  };

  // Bulk operations
  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleSelectAll = () => {
    if (selected.size === filteredItems.length) setSelected(new Set());
    else setSelected(new Set(filteredItems.map(i => i.id)));
  };

  const handleBulkAction = async (action) => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      const r = await api.post("/admin/cms/brand/bulk-action", { action, ids: [...selected] });
      const res = r.data?.data;
      toast.success(`${res?.success?.length || 0} item berhasil, ${res?.failed?.length || 0} gagal`);
      setSelected(new Set());
      await load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Bulk action gagal");
    } finally { setBulkLoading(false); }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = !searchQuery ||
      item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.code?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-3" data-testid="cms-brands-page">
      {/* Toolbar: deskripsi seksi + aksi utama (judul sudah di PageHeader/tab CMS Studio) */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">Kelola konten brand untuk halaman publik compro.</p>
        <Button onClick={openCreate} data-testid="create-brand-btn">
          <Plus className="h-4 w-4" /> Tambah Brand
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-3 items-center flex-wrap">
        <Input
          placeholder="Cari nama atau kode brand..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
          aria-label="Cari brand"
          data-testid="brand-search-input"
        />
        <SegmentedFilter
          value={statusFilter}
          onChange={setStatusFilter}
          ariaLabel="Filter status brand"
          options={["all", "published", "draft"].map(s => ({
            value: s,
            label: s === "all" ? "Semua" : s.charAt(0).toUpperCase() + s.slice(1),
            testId: `filter-${s}`,
          }))}
        />
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg flex-wrap">
          <span className="text-sm font-medium">{selected.size} dipilih</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => handleBulkAction("publish")} disabled={bulkLoading}>
              <Eye className="h-3.5 w-3.5" /> Publish
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkAction("unpublish")} disabled={bulkLoading}>
              <EyeOff className="h-3.5 w-3.5" /> Unpublish
            </Button>
            <Button size="sm" variant="outline" className="text-destructive border-destructive/30" onClick={() => handleBulkAction("delete")} disabled={bulkLoading}>
              <Trash2 className="h-3.5 w-3.5" /> Hapus
            </Button>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} className="ml-auto">
            Batal
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filteredItems.length === 0 ? (
        <div className="glass-card">
          <EmptyState
            icon={Globe}
            title={items.length === 0 ? "Belum ada brand" : "Tidak ada brand yang cocok"}
            description={items.length === 0 ? "Klik Tambah Brand untuk membuat konten brand pertama." : "Ubah kata kunci atau filter status."}
          />
        </div>
      ) : (
        <div className="grid gap-3">
          {/* Select all */}
          <button
            type="button"
            onClick={toggleSelectAll}
            className="flex items-center gap-2 w-fit text-xs text-muted-foreground hover:text-foreground"
            aria-pressed={selected.size === filteredItems.length && filteredItems.length > 0}
            data-testid="brand-select-all"
          >
            {selected.size === filteredItems.length && filteredItems.length > 0
              ? <CheckSquare className="h-4 w-4 text-primary" />
              : <Square className="h-4 w-4" />}
            Pilih semua
          </button>

          {filteredItems.map(item => (
            <div key={item.id}
                 className={`glass-card p-4 flex items-start gap-4 hover:shadow-md transition-shadow ${selected.has(item.id) ? "ring-2 ring-primary/30" : ""}`}
                 data-testid={`brand-row-${item.id}`}>
              {/* Checkbox */}
              <button type="button" onClick={() => toggleSelect(item.id)} className="flex-shrink-0 mt-1"
                      aria-label={`Pilih ${item.name}`} aria-pressed={selected.has(item.id)}>
                {selected.has(item.id)
                  ? <CheckSquare className="h-4 w-4 text-primary" />
                  : <Square className="h-4 w-4 text-muted-foreground" />}
              </button>
              {/* Color/image */}
              <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border"
                   style={{ background: item.color || "#f0f0f0" }}>
                {item.card_image && (
                  // dekoratif (nama tampil di sebelahnya); gambar gagal → tampil kotak warna brand, bukan teks alt
                  <img src={item.card_image} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async"
                       onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm md:text-base font-semibold">{item.name}</h3>
                  <Badge variant={item.status === "published" ? "default" : "secondary"} className="text-xs">
                    {item.status === "published" ? "Published" : item.status === "scheduled" ? "Scheduled" : "Draft"}
                  </Badge>
                  {item.workflow_status && item.workflow_status !== "draft" && item.workflow_status !== "published" && (
                    <WorkflowBadge status={item.workflow_status} />
                  )}
                  {item.publish_at && item.status !== "published" && new Date(item.publish_at) > new Date() && (
                    <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                      Scheduled
                    </Badge>
                  )}
                  {item.established && <span className="text-xs text-muted-foreground">Est. {item.established}</span>}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5 italic">{item.tagline}</p>
                <p className="text-sm mt-1 line-clamp-2">{item.short_desc}</p>
                <div className="flex gap-1 mt-2 flex-wrap">
                  {(item.tags || []).map(t => (
                    <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button size="icon" variant="ghost" title="Version History" aria-label="Lihat riwayat versi"
                        onClick={() => { setVersionTarget(item); setVersionOpen(true); }}
                        data-testid={`history-brand-${item.id}`}>
                  <History className="h-4 w-4 text-muted-foreground" />
                </Button>
                <Button size="icon" variant="ghost" title="Clone" aria-label="Clone brand" onClick={() => handleClone(item)}
                        disabled={cloningId === item.id} data-testid={`clone-brand-${item.id}`}>
                  {cloningId === item.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Copy className="h-4 w-4 text-muted-foreground" />}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => toggleStatus(item)}
                        aria-label={item.status === "published" ? "Jadikan draft" : "Publish brand"}
                        title={item.status === "published" ? "Jadikan Draft" : "Publish"}>
                  {item.status === "published"
                    ? <Eye className="h-4 w-4 text-green-600" />
                    : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                </Button>
                <Button size="icon" variant="ghost" aria-label="Edit brand" onClick={() => openEdit(item)}
                        data-testid={`edit-brand-${item.id}`}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="text-pink-500 hover:text-pink-700 hover:bg-pink-50"
                        onClick={() => setIgBrand(item)}
                        title="Kelola Instagram Posts"
                        aria-label="Kelola Instagram Posts"
                        data-testid={`ig-brand-${item.id}`}>
                  <Instagram className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label="Hapus brand" className="text-destructive"
                        onClick={() => setDeleteId(item.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="brand-form-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 pr-6">
              <span>{editing ? "Edit Brand" : "Tambah Brand"}</span>
              <div className="flex items-center gap-2">
                {editing && (
                  <CMSWorkflow
                    contentType="brand"
                    itemId={editing}
                    workflowStatus={form.workflow_status}
                    onStatusChange={ws => setForm(f => ({...f, workflow_status: ws, status: ws === "published" ? "published" : f.status}))}
                  />
                )}
                {editing && (
                  <Button variant="outline" size="sm"
                          onClick={() => setPreviewOpen(true)} type="button" data-testid="preview-brand-btn">
                    <ExternalLink className="h-3.5 w-3.5" /> Preview
                  </Button>
                )}
              </div>
            </DialogTitle>
            <DialogDescription>Konten ini akan muncul di halaman publik website compro.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="brand-form-kode-brand">Kode Brand *</Label>
                <Input id="brand-form-kode-brand" value={form.code} onChange={e => setForm(f=>({...f,code:e.target.value}))} placeholder="the-coffeeshop" data-testid="brand-code" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="brand-form-nama-brand">Nama Brand *</Label>
                <Input id="brand-form-nama-brand" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="The Coffeeshop" data-testid="brand-name" />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="brand-form-tagline">Tagline</Label>
              <Input id="brand-form-tagline" value={form.tagline} onChange={e => setForm(f=>({...f,tagline:e.target.value}))} placeholder="Specialty Coffee & All-Day Dining" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="brand-form-deskripsi-singkat">Deskripsi Singkat</Label>
              <Textarea id="brand-form-deskripsi-singkat" rows={2} value={form.short_desc} onChange={e => setForm(f=>({...f,short_desc:e.target.value}))} />
            </div>
            <div className="space-y-1">
              <Label>Story / About</Label>
              <RichTextEditor
                value={form.story}
                onChange={(html) => setForm(f => ({ ...f, story: html }))}
                placeholder="Ceritakan kisah di balik brand ini..."
                minHeight={180}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="brand-form-brand-color">Brand Color</Label>
                <div className="flex gap-2 items-center">
                  <input id="brand-form-brand-color" type="color" value={form.color || "#C8A96E"}
                         onChange={e => setForm(f=>({...f,color:e.target.value}))}
                         aria-label="Pilih warna brand"
                         className="h-9 w-12 rounded border cursor-pointer" />
                  <Input value={form.color} onChange={e => setForm(f=>({...f,color:e.target.value}))} className="flex-1" aria-label="Kode warna brand (hex)" placeholder="#C8A96E" />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="brand-form-tahun-berdiri">Tahun Berdiri</Label>
                <Input id="brand-form-tahun-berdiri" value={form.established} onChange={e => setForm(f=>({...f,established:e.target.value}))} placeholder="2018" />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="brand-form-tags">Tags (pisahkan dengan koma)</Label>
              <Input id="brand-form-tags" value={form.tags} onChange={e => setForm(f=>({...f,tags:e.target.value}))} placeholder="Coffee, All-Day Dining" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ImageUpload label="Hero Image" value={form.hero_image} onChange={(url) => setForm(f => ({...f, hero_image: url}))} />
              <ImageUpload label="Card Image" value={form.card_image} onChange={(url) => setForm(f => ({...f, card_image: url}))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand-form-signature-dishes">Signature Dishes (3 hidangan unggulan)</Label>
              {form.signature_dishes.map((dish, idx) => (
                <div key={idx} className="grid grid-cols-3 gap-2">
                  <Input id="brand-form-signature-dishes" value={dish.name} onChange={e => updateDish(idx, "name", e.target.value)} placeholder={`Hidangan ${idx+1}`} aria-label={`Nama hidangan ${idx+1}`} />
                  <Input value={dish.desc} onChange={e => updateDish(idx, "desc", e.target.value)} placeholder="Deskripsi" aria-label={`Deskripsi hidangan ${idx+1}`} />
                  <Input value={dish.price} onChange={e => updateDish(idx, "price", e.target.value)} placeholder="Rp 65.000" aria-label={`Harga hidangan ${idx+1}`} />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="brand-form-status">Status</Label>
              <Switch id="brand-form-status" checked={form.status === "published"}
                      onCheckedChange={v => setForm(f=>({...f,status:v?"published":"draft"}))} />
              <span className="text-sm">{form.status === "published" ? "Published" : "Draft"}</span>
            </div>
            <Separator />
            <CMSScheduleFields form={form} onChange={handleScheduleChange} currentStatus={form.status} />
            <Separator />
            <CMSSEOFields form={form} onChange={handleSEOChange} />
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving} data-testid="save-brand">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CMSVersionHistory
        open={versionOpen} onClose={() => { setVersionOpen(false); setVersionTarget(null); }}
        contentType="brand" itemId={versionTarget?.id} itemName={versionTarget?.name} onRestored={load}
      />
      <CMSBrandPreview open={previewOpen} onClose={() => setPreviewOpen(false)} form={form} />

      {/* Instagram Posts Slideover */}
      {igBrand && (
        <div className="fixed inset-0 z-40 flex" data-testid="ig-posts-panel">
          <div className="flex-1 bg-black/30" onClick={() => setIgBrand(null)} />
          <div className="w-full max-w-xl bg-background shadow-2xl flex flex-col overflow-hidden" role="dialog" aria-modal="true" aria-label={`Instagram Posts ${igBrand.name}`}>
            <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-purple-50 to-pink-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: igBrand.color || "#888" }}>
                  {igBrand.name?.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-gray-900">Instagram Posts</h3>
                  <p className="text-xs text-gray-500">{igBrand.name} · {igBrand.instagram || `@${igBrand.code}`}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIgBrand(null)} aria-label="Tutup panel Instagram" data-testid="ig-posts-close">
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <BrandInstagramPosts brand={igBrand} />
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Brand?</AlertDialogTitle>
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
