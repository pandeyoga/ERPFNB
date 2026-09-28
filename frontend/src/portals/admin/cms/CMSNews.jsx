/**
 * CMS News & Events — Sprint G + Sprint I-L (Workflow + Bulk Ops)
 */
import { useState, useEffect } from "react";
import {
  Plus, Edit2, Trash2, Newspaper, Eye, EyeOff, Loader2, CalendarDays, History, Copy, ExternalLink,
  CheckSquare, Square,
} from "lucide-react";
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
import CMSVersionHistory from "./CMSVersionHistory";
import CMSSEOFields from "./CMSSEOFields";
import CMSScheduleFields from "@/components/shared/CMSScheduleFields";
import RichTextEditor from "@/components/shared/RichTextEditor";
import CMSNewsPreview from "./CMSNewsPreview";
import CMSWorkflow, { WorkflowBadge } from "./CMSWorkflow";

const CATEGORIES = ["Opening", "Events", "Award", "Story", "Announcement", "Promo"];
const EMPTY_FORM = {
  title: "", excerpt: "", content: "", date: new Date().toISOString().slice(0,10),
  category: "Announcement", brand_id: "", image: "", status: "draft",
  seo_title: "", seo_description: "", seo_og_image: "", seo_slug: "",
  publish_at: null, unpublish_at: null, workflow_status: "draft",
};

export default function CMSNews() {
  const [items, setItems] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [versionOpen, setVersionOpen] = useState(false);
  const [versionTarget, setVersionTarget] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [cloningId, setCloningId] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [nR, bR] = await Promise.all([api.get("/admin/cms/news"), api.get("/admin/cms/brands")]);
      setItems(nR.data?.data || []);
      setBrands(bR.data?.data || []);
    } catch { toast.error("Gagal memuat data"); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setFormOpen(true); };
  const openEdit = (item) => {
    setEditing(item.id);
    setForm({
      ...item, brand_id: item.brand_id || "",
      seo_title: item.seo_title || "", seo_description: item.seo_description || "",
      seo_og_image: item.seo_og_image || "", seo_slug: item.seo_slug || "",
      publish_at: item.publish_at || null, unpublish_at: item.unpublish_at || null,
      workflow_status: item.workflow_status || "draft",
    });
    setFormOpen(true);
  };

  const handleSEOChange = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const handleScheduleChange = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleClone = async (item) => {
    setCloningId(item.id);
    try {
      await api.post(`/admin/cms/news/${item.id}/clone`);
      toast.success(`"${item.title}" berhasil di-clone sebagai Draft`);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal clone artikel");
    } finally { setCloningId(null); }
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Judul wajib diisi"); return; }
    setSaving(true);
    try {
      const payload = { ...form, brand_id: form.brand_id || null };
      if (editing) {
        await api.put(`/admin/cms/news/${editing}`, payload);
        toast.success("Artikel diperbarui");
      } else {
        await api.post("/admin/cms/news", payload);
        toast.success("Artikel dibuat");
      }
      setFormOpen(false);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal menyimpan");
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/admin/cms/news/${deleteId}`);
      toast.success("Artikel dihapus"); setDeleteId(null); await load();
    } catch { toast.error("Gagal menghapus"); }
  };

  const getBrandName = (id) => brands.find(b => b.id === id)?.name || "";

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const handleBulkAction = async (action) => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      const r = await api.post("/admin/cms/news/bulk-action", { action, ids: [...selected] });
      const res = r.data?.data;
      toast.success(`${res?.success?.length || 0} berhasil, ${res?.failed?.length || 0} gagal`);
      setSelected(new Set()); await load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Bulk action gagal");
    } finally { setBulkLoading(false); }
  };

  const filtered = items.filter(item => {
    const matchesSearch = !searchQuery ||
      item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.excerpt?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const categories = [...new Set(items.map(i => i.category))];

  return (
    <div className="space-y-4" data-testid="cms-news-page">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold">News & Events</h3>
          <p className="text-sm text-muted-foreground">Kelola artikel, berita, dan event untuk website compro.</p>
        </div>
        <Button onClick={openCreate} data-testid="create-news-btn">
          <Plus className="h-4 w-4 mr-2" /> Tambah Artikel
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-3 items-center flex-wrap">
        <Input placeholder="Cari judul..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
               className="max-w-sm" data-testid="news-search-input" />
        <div className="flex gap-2">
          {["all","published","draft"].map(s => (
            <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)}>
              {s === "all" ? "Semua" : s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>
        {categories.length > 0 && (
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kategori</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <span className="text-sm font-medium">{selected.size} dipilih</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => handleBulkAction("publish")} disabled={bulkLoading}>
              <Eye className="h-3.5 w-3.5 mr-1.5" /> Publish
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkAction("unpublish")} disabled={bulkLoading}>
              <EyeOff className="h-3.5 w-3.5 mr-1.5" /> Unpublish
            </Button>
            <Button size="sm" variant="outline" className="text-destructive border-destructive/30"
                    onClick={() => handleBulkAction("delete")} disabled={bulkLoading}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Hapus
            </Button>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} className="ml-auto">Batal</Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Newspaper className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{items.length === 0 ? "Belum ada artikel." : "Tidak ada artikel yang cocok."}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {/* Select all */}
          <div className="flex items-center gap-2">
            <button onClick={() => selected.size === filtered.length ? setSelected(new Set()) : setSelected(new Set(filtered.map(i=>i.id)))} className="p-1">
              {selected.size === filtered.length && filtered.length > 0
                ? <CheckSquare className="h-4 w-4 text-primary" />
                : <Square className="h-4 w-4 text-muted-foreground" />}
            </button>
            <span className="text-xs text-muted-foreground">Pilih semua</span>
          </div>

          {filtered.map(item => (
            <div key={item.id}
                 className={`border rounded-xl p-4 flex gap-3 bg-white hover:shadow-md transition-shadow ${selected.has(item.id) ? "ring-2 ring-primary/30" : ""}`}
                 data-testid={`news-row-${item.id}`}>
              <button onClick={() => toggleSelect(item.id)} className="flex-shrink-0 mt-1">
                {selected.has(item.id)
                  ? <CheckSquare className="h-4 w-4 text-primary" />
                  : <Square className="h-4 w-4 text-muted-foreground" />}
              </button>
              {item.image && (
                <img src={item.image} alt={item.title} className="w-16 h-16 object-cover rounded-lg flex-shrink-0" loading="lazy" decoding="async" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold line-clamp-1">{item.title}</span>
                  <Badge className="text-xs">{item.category}</Badge>
                  {item.brand_id && <Badge variant="outline" className="text-xs">{getBrandName(item.brand_id)}</Badge>}
                  <Badge variant={item.status === "published" ? "default" : "secondary"} className="text-xs">
                    {item.status === "published" ? "Published" : "Draft"}
                  </Badge>
                  {item.workflow_status && item.workflow_status !== "draft" && item.workflow_status !== "published" && (
                    <WorkflowBadge status={item.workflow_status} />
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.excerpt}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.date}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button size="icon" variant="ghost" title="Version History" aria-label="Lihat riwayat versi"
                        onClick={() => { setVersionTarget(item); setVersionOpen(true); }}
                        data-testid={`history-news-${item.id}`}>
                  <History className="h-4 w-4 text-muted-foreground" />
                </Button>
                <Button size="icon" variant="ghost" title="Clone" aria-label="Clone berita" onClick={() => handleClone(item)}
                        disabled={cloningId === item.id} data-testid={`clone-news-${item.id}`}>
                  {cloningId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                </Button>
                <Button size="icon" variant="ghost" aria-label="Edit berita" onClick={() => openEdit(item)} data-testid={`edit-news-${item.id}`}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label="Hapus berita" className="text-destructive" onClick={() => setDeleteId(item.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="news-form-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <span>{editing ? "Edit Artikel" : "Tambah Artikel"}</span>
              <div className="flex items-center gap-2">
                {editing && (
                  <CMSWorkflow contentType="news" itemId={editing}
                               workflowStatus={form.workflow_status}
                               onStatusChange={ws => setForm(f => ({...f, workflow_status: ws, status: ws === "published" ? "published" : f.status}))} />
                )}
                <Button variant="outline" size="sm" className="gap-1.5 text-xs"
                        onClick={() => setPreviewOpen(true)} type="button" data-testid="preview-news-btn">
                  <ExternalLink className="h-3.5 w-3.5" /> Preview
                </Button>
              </div>
            </DialogTitle>
            <DialogDescription>Konten tampil di halaman News & Events website compro.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Judul *</Label>
              <Input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} data-testid="news-title" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Tanggal</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))} />
              </div>
              <div className="space-y-1">
                <Label>Kategori</Label>
                <Select value={form.category} onValueChange={v => setForm(f=>({...f,category:v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Brand (opsional)</Label>
                <Select value={form.brand_id || "none"} onValueChange={v => setForm(f=>({...f,brand_id:v==="none"?"":v}))}>
                  <SelectTrigger><SelectValue placeholder="— None —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Excerpt</Label>
              <Textarea rows={2} value={form.excerpt} onChange={e => setForm(f=>({...f,excerpt:e.target.value}))} />
            </div>
            <div className="space-y-1">
              <Label>Konten Lengkap</Label>
              <RichTextEditor value={form.content} onChange={html => setForm(f=>({...f,content:html}))}
                              placeholder="Tulis isi artikel..." minHeight={200} />
            </div>
            <ImageUpload label="Article Image" value={form.image} onChange={url => setForm(f=>({...f,image:url}))} />
            <div className="flex items-center gap-3">
              <Label>Status</Label>
              <Switch checked={form.status === "published"} onCheckedChange={v => setForm(f=>({...f,status:v?"published":"draft"}))} />
              <span className="text-sm">{form.status === "published" ? "Published" : "Draft"}</span>
            </div>
            <Separator />
            <CMSScheduleFields form={form} onChange={handleScheduleChange} currentStatus={form.status} />
            <Separator />
            <CMSSEOFields form={form} onChange={handleSEOChange} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving} data-testid="save-news">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CMSNewsPreview open={previewOpen} onClose={() => setPreviewOpen(false)} form={form} />
      <CMSVersionHistory open={versionOpen} onClose={() => { setVersionOpen(false); setVersionTarget(null); }}
                         contentType="news" itemId={versionTarget?.id} itemName={versionTarget?.title} onRestored={load} />
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Artikel?</AlertDialogTitle>
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
