/** CMSMenu/CategoriesTab.jsx — menu categories management tab. */
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

import { BACKEND_URL, MenuImage, EMPTY_CAT } from "./helpers";

function CategoriesTab({ brands, selectedBrandId }) {
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_CAT);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const load = useCallback(async () => {
    if (!selectedBrandId) return;
    setLoading(true);
    try {
      const r = await api.get("/admin/cms/menu/categories", { params: { brand_id: selectedBrandId } });
      setCats(r.data?.data || []);
    } catch { toast.error("Gagal memuat kategori"); }
    finally { setLoading(false); }
  }, [selectedBrandId]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY_CAT, brand_id: selectedBrandId }); setFormOpen(true); };
  const openEdit = (cat) => { setEditing(cat.id); setForm({ ...cat }); setFormOpen(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Nama kategori wajib diisi"); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/admin/cms/menu/categories/${editing}`, form);
        toast.success("Kategori diperbarui");
      } else {
        await api.post("/admin/cms/menu/categories", form);
        toast.success("Kategori ditambahkan");
      }
      setFormOpen(false);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal menyimpan");
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/admin/cms/menu/categories/${deleteId}`);
      toast.success("Kategori dihapus");
      setDeleteId(null);
      await load();
    } catch { toast.error("Gagal menghapus kategori"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Kelola kategori menu per brand. Nama kategori akan tampil sebagai section header di website.</p>
        <Button size="sm" onClick={openCreate} disabled={!selectedBrandId}>
          <Plus className="h-4 w-4 mr-2" /> Tambah Kategori
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : cats.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Tag className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Belum ada kategori untuk brand ini.</p>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden bg-white">
          {cats.map((cat, idx) => (
            <div key={cat.id} className={`flex items-center justify-between px-4 py-3 ${idx > 0 ? "border-t" : ""} hover:bg-muted/20`}>
              <div>
                <div className="font-medium">{cat.name}</div>
                {cat.description && <div className="text-xs text-muted-foreground">{cat.description}</div>}
              </div>
              <div className="flex gap-1 items-center">
                <span className="text-xs text-muted-foreground mr-2">Sort: {cat.sort_order}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Edit kategori" onClick={() => openEdit(cat)}><Edit2 className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" aria-label="Hapus kategori" onClick={() => setDeleteId(cat.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Kategori" : "Tambah Kategori"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Brand *</Label>
              <Select value={form.brand_id} onValueChange={v => setForm(f => ({ ...f, brand_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Pilih brand..." /></SelectTrigger>
                <SelectContent>{brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Nama Kategori *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Specialty Coffee, Mains, Desserts..." />
            </div>
            <div className="space-y-1">
              <Label>Deskripsi</Label>
              <Input value={form.description || ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Sort Order</Label>
              <Input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Kategori?</AlertDialogTitle>
            <AlertDialogDescription>Item dalam kategori ini tidak akan terhapus, hanya label kategorinya.</AlertDialogDescription>
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

// =================== PDF TAB ===================

export default CategoriesTab;
