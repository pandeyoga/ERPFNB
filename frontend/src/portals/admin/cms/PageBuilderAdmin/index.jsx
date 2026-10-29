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
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import EmptyState from "@/components/shared/EmptyState";
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
    <div className="space-y-3" data-testid="cms-page-builder">
      {/* Toolbar: deskripsi seksi + aksi utama (judul sudah di PageHeader/tab CMS Studio) */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">Buat halaman kustom dengan blok konten yang fleksibel.</p>
        <Button onClick={openCreate} data-testid="create-page-btn">
          <Plus className="h-4 w-4" /> Buat Halaman Baru
        </Button>
      </div>

      {/* Page list */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : pages.length === 0 ? (
        <div className="glass-card">
          <EmptyState icon={LayoutTemplate} title="Belum ada halaman" description="Klik Buat Halaman Baru untuk menyusun halaman kustom pertama." />
        </div>
      ) : (
        <div className="grid gap-3">
          {pages.map(page => (
            <div key={page.id}
                 className="glass-card p-4 flex items-start gap-4 hover:shadow-md transition-shadow"
                 data-testid={`page-row-${page.id}`}>
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                <LayoutTemplate className="h-5 w-5 text-purple-700 dark:text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm md:text-base font-semibold">{page.title}</h3>
                  <Badge variant={page.status === "published" ? "default" : "secondary"} className="text-xs">
                    {page.status === "published" ? "Published" : "Draft"}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-medium tabular-nums">/{page.slug}</span>
                </div>
                {page.description && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{page.description}</p>}
                <p className="text-xs text-muted-foreground mt-1">
                  {(page.blocks?.length || 0)} blok &middot; Updated {page.updated_at ? new Date(page.updated_at).toLocaleString("id-ID", { dateStyle: "short" }) : "—"}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {page.status === "published" && (
                  <Button asChild size="icon" variant="ghost" title="Lihat di publik" aria-label="Lihat di publik">
                    <a href={`/pages/${page.slug}`} target="_blank" rel="noreferrer" aria-label="Lihat halaman di publik">
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </a>
                  </Button>
                )}
                <Button size="icon" variant="ghost" onClick={() => handleToggleStatus(page)}
                        title={page.status === "published" ? "Jadikan Draft" : "Publish"} aria-label={page.status === "published" ? "Jadikan Draft" : "Publish"}>
                  {page.status === "published"
                    ? <Eye className="h-4 w-4 text-green-700 dark:text-green-400" />
                    : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => openEdit(page)} aria-label="Edit halaman"
                        data-testid={`edit-page-${page.id}`}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="text-destructive" aria-label="Hapus halaman"
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
          <DialogHeader className="px-5 pt-5 pb-3 border-b">
            <DialogTitle className="flex items-center justify-between pr-6">
              <span>{editing ? "Edit Halaman" : "Buat Halaman Baru"}</span>
              <div className="flex items-center gap-2">
                {editing && form.status === "published" && (
                  <Button asChild variant="outline" size="sm">
                    <a href={`/pages/${form.slug}`} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" /> Preview
                    </a>
                  </Button>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <Tabs defaultValue="content" className="w-full">
              <div className="px-5 pt-3">
                <TabsList data-testid="page-form-tabs">
                  <TabsTrigger value="content">Konten &amp; blok</TabsTrigger>
                  <TabsTrigger value="settings">Pengaturan</TabsTrigger>
                  <TabsTrigger value="seo">SEO</TabsTrigger>
                </TabsList>
              </div>

              {/* Content tab */}
              <TabsContent value="content" className="p-5 space-y-3 mt-0">
                <div className="space-y-1">
                  <Label htmlFor="page-form-judul-halaman">Judul Halaman *</Label>
                  <Input id="page-form-judul-halaman" value={form.title} onChange={e => handleTitleChange(e.target.value)}
                         placeholder="Halaman Promo Lebaran 2026" data-testid="page-title-input" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="page-form-deskripsi">Deskripsi (opsional)</Label>
                  <Textarea id="page-form-deskripsi" rows={2} value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
                            placeholder="Deskripsi singkat halaman..." />
                </div>

                <Separator />

                {/* Block list */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm md:text-base font-semibold">Blok Konten ({(form.blocks || []).length})</h3>
                    <Button variant="outline" size="sm" onClick={() => setAddBlockOpen(true)}
                            data-testid="add-block-btn">
                      <Plus className="h-3.5 w-3.5" /> Tambah Blok
                    </Button>
                  </div>

                  {(form.blocks || []).length === 0 && (
                    <div className="border-2 border-dashed rounded-xl p-4 text-center">
                      <LayoutTemplate className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                      <p className="text-sm text-muted-foreground">Belum ada blok. Klik Tambah Blok untuk mulai membangun halaman.</p>
                      <Button className="mt-3" variant="outline" size="sm" onClick={() => setAddBlockOpen(true)}>
                        <Plus className="h-3.5 w-3.5" /> Tambah Blok Pertama
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
              <TabsContent value="settings" className="p-5 space-y-3 mt-0">
                <div className="space-y-1">
                  <Label htmlFor="page-form-slug-url">Slug URL *</Label>
                  <div className="flex gap-2 items-center">
                    <span className="text-sm text-muted-foreground">/pages/</span>
                    <Input id="page-form-slug-url"
                      value={form.slug}
                      onChange={e => { setSlugManual(true); setForm(f => ({...f, slug: e.target.value})); }}
                      placeholder="nama-halaman"
                      className="flex-1 text-sm"
                      data-testid="page-slug-input"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">URL publik: /pages/{form.slug || "..."}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Label htmlFor="page-form-status">Status</Label>
                  <Switch id="page-form-status" checked={form.status === "published"}
                          onCheckedChange={v => setForm(f => ({...f, status: v ? "published" : "draft"}))} />
                  <span className="text-sm">{form.status === "published" ? "Published" : "Draft"}</span>
                </div>
              </TabsContent>

              {/* SEO tab */}
              <TabsContent value="seo" className="p-5 mt-0">
                <CMSSEOFields form={form} onChange={handleSEOChange} />
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="px-5 py-3 border-t">
            <Button variant="outline" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving} data-testid="save-page-btn">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
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
                <button key={bt.id} type="button"
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
            <AlertDialogAction onClick={handleDelete} className={buttonVariants({ variant: "destructive" })}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
