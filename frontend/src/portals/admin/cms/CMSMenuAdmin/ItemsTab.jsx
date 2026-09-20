/** CMSMenu/ItemsTab.jsx — menu items management tab. */
/**
 * CMS E-Menu — Admin CMS for managing brand menu items, categories, and PDF menus.
 * Uses new admin_menu.py API: /api/admin/cms/menu/items|categories|pdfs|upload-image|upload-pdf
 */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Edit2, Trash2, UtensilsCrossed, Upload, FileText,
  Tag, Image as ImageIcon, Loader2, X, ChevronDown, Eye, EyeOff,
  Download, Star, AlertCircle, Search, Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import api from "@/lib/api";
import DataTable from "@/components/shared/DataTable";

import { BACKEND_URL, formatCurrency, MenuImage, EMPTY_ITEM, DIETARY_OPTIONS } from "./helpers";

function ItemsTab({ brands, selectedBrandId, onBrandChange }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_ITEM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const load = useCallback(async () => {
    if (!selectedBrandId) return;
    setLoading(true);
    try {
      const r = await api.get("/admin/cms/menu/items", { params: { brand_id: selectedBrandId, per_page: 100 } });
      setItems(r.data?.data || []);
    } catch { toast.error("Gagal memuat menu items"); }
    finally { setLoading(false); }
  }, [selectedBrandId]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_ITEM, brand_id: selectedBrandId });
    setFormOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item.id);
    setForm({ ...item, dietary_tags: item.dietary_tags || [] });
    setFormOpen(true);
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post("/admin/cms/menu/upload-image", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url = r.data?.data?.url;
      if (url) setForm(f => ({ ...f, image_url: url }));
      toast.success("Gambar berhasil diupload");
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Upload gagal");
    } finally { setUploading(false); }
  };

  const toggleTag = (tag) => {
    setForm(f => ({
      ...f,
      dietary_tags: f.dietary_tags.includes(tag)
        ? f.dietary_tags.filter(t => t !== tag)
        : [...f.dietary_tags, tag],
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Nama menu wajib diisi"); return; }
    if (!form.brand_id) { toast.error("Brand wajib dipilih"); return; }
    if (!form.price || isNaN(parseFloat(form.price))) { toast.error("Harga tidak valid"); return; }
    setSaving(true);
    try {
      const payload = { ...form, price: parseFloat(form.price) };
      if (editing) {
        await api.put(`/admin/cms/menu/items/${editing}`, payload);
        toast.success("Menu item diperbarui");
      } else {
        await api.post("/admin/cms/menu/items", payload);
        toast.success("Menu item ditambahkan");
      }
      setFormOpen(false);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal menyimpan");
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/admin/cms/menu/items/${deleteId}`);
      toast.success("Menu item dihapus");
      setDeleteId(null);
      await load();
    } catch { toast.error("Gagal menghapus"); }
  };

  const categories = [...new Set(items.map(i => i.category).filter(Boolean))];

  const filtered = items.filter(i => {
    const matchQ = !q || i.name.toLowerCase().includes(q.toLowerCase()) || (i.description || "").toLowerCase().includes(q.toLowerCase());
    const matchCat = catFilter === "all" || i.category === catFilter;
    return matchQ && matchCat;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap" data-testid="admin-menu-toolbar">
        <div className="flex gap-2 flex-1 min-w-0" data-testid="admin-menu-search-group">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Cari nama menu..." value={q} onChange={e => setQ(e.target.value)} data-testid="admin-menu-search" />
          </div>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-40" data-testid="admin-menu-filter-category">
              <SelectValue placeholder="Semua Kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kategori</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openCreate} disabled={!selectedBrandId} data-testid="admin-menu-create-button">
          <Plus className="h-4 w-4 mr-2" /> Tambah Item
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <UtensilsCrossed className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>Belum ada menu item untuk brand ini.</p>
          {selectedBrandId && <Button className="mt-3" onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Tambah Item Pertama</Button>}
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden bg-white" data-testid="admin-menu-table">
          <DataTable
            rows={filtered}
            keyField="id"
            rowTestIdPrefix="menu-row"
            columns={[
              { key: "image", label: "", hideOnMobile: true,
                render: (item) => <MenuImage src={item.image_url} alt={item.name} className="h-10 w-10 rounded-lg" /> },
              { key: "name", label: "Nama", primary: true, sortable: true, render: (item) => (
                <div>
                  <div className="font-medium">{item.name}</div>
                  {item.dietary_tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.dietary_tags.slice(0, 3).map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs py-0 px-1.5 h-4">{tag}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              ) },
              { key: "category", label: "Kategori", sortable: true, hideOnMobile: true,
                render: (item) => <span className="text-muted-foreground">{item.category}</span> },
              { key: "price", label: "Harga", numeric: true, sortable: true,
                render: (item) => <span className="font-medium">{formatCurrency(item.price)}</span> },
              { key: "is_available", label: "Tersedia", align: "center", hideOnMobile: true,
                render: (item) => <Badge variant={item.is_available ? "default" : "secondary"} className="text-xs">{item.is_available ? "Ya" : "Tidak"}</Badge> },
              { key: "is_featured", label: "Featured", align: "center", hideOnMobile: true,
                render: (item) => item.is_featured ? <Star className="h-4 w-4 text-amber-500 mx-auto fill-amber-500" /> : null },
            ]}
            rowAction={(item) => (
              <div className="flex gap-1 justify-end" data-testid={`admin-menu-row-actions-${item.id}`}>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(item)} title="Edit">
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(item.id)} title="Hapus">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          />
          <div className="px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
            {filtered.length} item{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Menu Item" : "Tambah Menu Item"}</DialogTitle>
            <DialogDescription>Isi detail menu item untuk ditampilkan di website.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Brand *</Label>
                <Select value={form.brand_id} onValueChange={v => setForm(f => ({ ...f, brand_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Pilih brand..." /></SelectTrigger>
                  <SelectContent>{brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Kategori *</Label>
                <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  placeholder="Coffee, Brunch, Mains..." />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Nama Menu *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Deskripsi</Label>
              <Textarea rows={2} value={form.description || ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Harga (Rp) *</Label>
                <Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="65000" />
              </div>
              <div className="space-y-1">
                <Label>Sort Order</Label>
                <Input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Foto Menu</Label>
              <div className="flex gap-3 items-start">
                <div className="border rounded-lg overflow-hidden w-20 h-20 flex-shrink-0">
                  <MenuImage src={form.image_url} alt="preview" className="w-full h-full" />
                </div>
                <div className="flex-1 space-y-2">
                  <Input
                    placeholder="URL gambar atau upload..."
                    value={form.image_url || ""}
                    onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                  />
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => handleImageUpload(e.target.files?.[0])} />
                  <Button type="button" variant="outline" size="sm" className="w-full"
                    onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-2" />}
                    {uploading ? "Mengupload..." : "Upload Gambar"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Dietary Tags */}
            <div className="space-y-2">
              <Label>Dietary Tags</Label>
              <div className="flex flex-wrap gap-2">
                {DIETARY_OPTIONS.map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => toggleTag(opt.value)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      form.dietary_tags.includes(opt.value)
                        ? "text-white border-transparent" : "text-muted-foreground border-border hover:border-foreground/30"
                    }`}
                    style={form.dietary_tags.includes(opt.value) ? { backgroundColor: opt.color, borderColor: opt.color } : {}}
                    data-testid={`tag-${opt.value}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <Separator />
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_available} onCheckedChange={v => setForm(f => ({ ...f, is_available: v }))} />
                <Label>Tersedia</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_featured} onCheckedChange={v => setForm(f => ({ ...f, is_featured: v }))} />
                <Label>Featured</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving} data-testid="admin-menu-edit-submit-button">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Menu Item?</AlertDialogTitle>
            <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
              data-testid="admin-menu-delete-confirm-button">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =================== CATEGORIES TAB ===================

export default ItemsTab;
