/** PageBuilder/index.jsx — page builder orchestrator. */
/**
 * PageBuilder — Sprint L: Flexible content page builder
 * Block-based custom pages with multiple block types.
 */
import { useState, useEffect } from "react";
import {
  Plus, Trash2, Edit2, Eye, EyeOff, Globe, Loader2, ChevronUp, ChevronDown,
  Save, Image, Type, Megaphone, Minus, LayoutTemplate, ExternalLink, Copy, RefreshCw, X,
  Images, UtensilsCrossed
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
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import api from "@/lib/api";
import ImageUpload from "@/components/shared/ImageUpload";
import RichTextEditor from "@/components/shared/RichTextEditor";
import CMSSEOFields from "../CMSSEOFields";

import { BLOCK_TYPES, makeBlock, slugify, EMPTY_PAGE } from "./constants";
import BlockCard from "./BlockCard";

export default function PageBuilder() {
  const [pages, setPages] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_PAGE);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [addBlockOpen, setAddBlockOpen] = useState(false);
  const [slugManual, setSlugManual] = useState(false);
  const backendUrl = process.env.REACT_APP_BACKEND_URL || "";

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/admin/cms/pages");
      setPages(r.data?.data?.items || []);
      setTotal(r.data?.data?.total || 0);
    } catch { toast.error("Gagal memuat pages"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_PAGE);
    setSlugManual(false);
    setFormOpen(true);
  };

  const openEdit = async (page) => {
    try {
      const r = await api.get(`/admin/cms/pages/${page.id}`);
      setEditing(page.id);
      setForm(r.data?.data || page);
      setSlugManual(true);
      setFormOpen(true);
    } catch { toast.error("Gagal memuat halaman"); }
  };

  const handleTitleChange = (title) => {
    setForm(f => ({
      ...f,
      title,
      slug: slugManual ? f.slug : slugify(title),
    }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Judul halaman wajib diisi"); return; }
    if (!form.slug.trim()) { toast.error("Slug wajib diisi"); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/admin/cms/pages/${editing}`, form);
        toast.success("Halaman diperbarui");
      } else {
        await api.post("/admin/cms/pages", form);
        toast.success("Halaman dibuat");
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
      await api.delete(`/admin/cms/pages/${deleteId}`);
      toast.success("Halaman dihapus");
      setDeleteId(null);
      await load();
    } catch { toast.error("Gagal menghapus"); }
  };

  const handleToggleStatus = async (page) => {
    try {
      const ns = page.status === "published" ? "draft" : "published";
      await api.put(`/admin/cms/pages/${page.id}`, { ...page, status: ns });
      toast.success(ns === "published" ? "Halaman dipublish" : "Halaman dijadikan draft");
      await load();
    } catch { toast.error("Gagal mengubah status"); }
  };

  // Block management
  const addBlock = (type) => {
    setForm(f => ({ ...f, blocks: [...(f.blocks || []), makeBlock(type)] }));
    setAddBlockOpen(false);
  };

  const updateBlock = (idx, updated) => {
    setForm(f => ({ ...f, blocks: f.blocks.map((b, i) => i === idx ? updated : b) }));
  };

  const deleteBlock = (idx) => {
    setForm(f => ({ ...f, blocks: f.blocks.filter((_, i) => i !== idx) }));
  };

  const moveBlock = (idx, dir) => {
    setForm(f => {
      const arr = [...f.blocks];
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= arr.length) return f;
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return { ...f, blocks: arr };
    });
  };

  const handleSEOChange = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const previewUrl = `${backendUrl.replace("/api", "").replace("8001", "3000")}/pages/${form.slug}`;

  return (
    <div className="space-y-5" data-testid="cms-page-builder">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5 text-purple-600" />
            Page Builder
          </h3>
          <p className="text-sm text-muted-foreground">Buat halaman kustom dengan blok konten yang fleksibel.</p>
        </div>
        <Button onClick={openCreate} data-testid="create-page-btn">
          <Plus className="h-4 w-4 mr-2" /> Buat Halaman Baru
        </Button>
      </div>

      {/* Page list */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : pages.length === 0 ? (
        <div className="text-center py-16">
          <LayoutTemplate className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground">Belum ada halaman. Klik Buat Halaman Baru.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {pages.map(page => (
            <div key={page.id}
                 className="border rounded-xl p-4 flex items-start gap-4 bg-white hover:shadow-md transition-shadow"
                 data-testid={`page-row-${page.id}`}>
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                <LayoutTemplate className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{page.title}</span>
                  <Badge variant={page.status === "published" ? "default" : "secondary"} className="text-xs">
                    {page.status === "published" ? "Published" : "Draft"}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono">/{page.slug}</span>
                </div>
                {page.description && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{page.description}</p>}
                <p className="text-xs text-muted-foreground mt-1">
                  {(page.blocks?.length || 0)} blok &middot; Updated {page.updated_at ? new Date(page.updated_at).toLocaleString("id-ID", { dateStyle: "short" }) : "—"}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {page.status === "published" && (
                  <a href={`/pages/${page.slug}`} target="_blank" rel="noreferrer">
                    <Button size="icon" variant="ghost" title="Lihat di publik">
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </a>
                )}
                <Button size="icon" variant="ghost" onClick={() => handleToggleStatus(page)}
                        title={page.status === "published" ? "Jadikan Draft" : "Publish"}>
                  {page.status === "published"
                    ? <Eye className="h-4 w-4 text-green-600" />
                    : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => openEdit(page)}
                        data-testid={`edit-page-${page.id}`}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="text-destructive"
                        onClick={() => setDeleteId(page.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Page Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b">
            <DialogTitle className="flex items-center justify-between">
              <span>{editing ? "Edit Halaman" : "Buat Halaman Baru"}</span>
              <div className="flex items-center gap-2">
                {editing && form.status === "published" && (
                  <a href={`/pages/${form.slug}`} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                      <ExternalLink className="h-3.5 w-3.5" /> Preview
                    </Button>
                  </a>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <Tabs defaultValue="content" className="w-full">
              <TabsList className="w-full px-6 pt-3 pb-0 h-auto bg-transparent border-b rounded-none justify-start gap-0">
                <TabsTrigger value="content" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Konten &amp; Blok</TabsTrigger>
                <TabsTrigger value="settings" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Pengaturan</TabsTrigger>
                <TabsTrigger value="seo" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">SEO</TabsTrigger>
              </TabsList>

              {/* Content tab */}
              <TabsContent value="content" className="p-6 space-y-4 mt-0">
                <div className="space-y-1">
                  <Label>Judul Halaman *</Label>
                  <Input value={form.title} onChange={e => handleTitleChange(e.target.value)}
                         placeholder="Halaman Promo Lebaran 2026" data-testid="page-title-input" />
                </div>
                <div className="space-y-1">
                  <Label>Deskripsi (opsional)</Label>
                  <Textarea rows={2} value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
                            placeholder="Deskripsi singkat halaman..." />
                </div>

                <Separator />

                {/* Block list */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Blok Konten ({(form.blocks || []).length})</Label>
                    <Button variant="outline" size="sm" onClick={() => setAddBlockOpen(true)}
                            data-testid="add-block-btn">
                      <Plus className="h-3.5 w-3.5 mr-1.5" /> Tambah Blok
                    </Button>
                  </div>

                  {(form.blocks || []).length === 0 && (
                    <div className="border-2 border-dashed rounded-xl p-8 text-center">
                      <LayoutTemplate className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                      <p className="text-sm text-muted-foreground">Belum ada blok. Klik Tambah Blok untuk mulai membangun halaman.</p>
                      <Button className="mt-3" variant="outline" size="sm" onClick={() => setAddBlockOpen(true)}>
                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Tambah Blok Pertama
                      </Button>
                    </div>
                  )}

                  {(form.blocks || []).map((block, idx) => (
                    <BlockCard
                      key={block.id}
                      block={block}
                      index={idx}
                      total={form.blocks.length}
                      onChange={updated => updateBlock(idx, updated)}
                      onDelete={() => deleteBlock(idx)}
                      onMoveUp={() => moveBlock(idx, -1)}
                      onMoveDown={() => moveBlock(idx, 1)}
                    />
                  ))}
                </div>
              </TabsContent>

              {/* Settings tab */}
              <TabsContent value="settings" className="p-6 space-y-4 mt-0">
                <div className="space-y-1">
                  <Label>Slug URL *</Label>
                  <div className="flex gap-2 items-center">
                    <span className="text-sm text-muted-foreground">/pages/</span>
                    <Input
                      value={form.slug}
                      onChange={e => { setSlugManual(true); setForm(f => ({...f, slug: e.target.value})); }}
                      placeholder="nama-halaman"
                      className="flex-1 font-mono text-sm"
                      data-testid="page-slug-input"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">URL publik: /pages/{form.slug || "..."}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Label>Status</Label>
                  <Switch checked={form.status === "published"}
                          onCheckedChange={v => setForm(f => ({...f, status: v ? "published" : "draft"}))} />
                  <span className="text-sm">{form.status === "published" ? "Published" : "Draft"}</span>
                </div>
              </TabsContent>

              {/* SEO tab */}
              <TabsContent value="seo" className="p-6 mt-0">
                <CMSSEOFields form={form} onChange={handleSEOChange} />
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="px-6 py-4 border-t">
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving} data-testid="save-page-btn">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Block Dialog */}
      <Dialog open={addBlockOpen} onOpenChange={setAddBlockOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pilih Tipe Blok</DialogTitle>
            <DialogDescription>Pilih jenis blok konten yang ingin ditambahkan.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {BLOCK_TYPES.map(bt => {
              const Icon = bt.icon;
              return (
                <button key={bt.id}
                        onClick={() => addBlock(bt.id)}
                        className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 text-left transition-colors"
                        data-testid={`add-block-${bt.id}`}>
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{bt.label}</div>
                    <div className="text-xs text-muted-foreground">{bt.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Halaman?</AlertDialogTitle>
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
