/**
 * BrandInstagramPosts.jsx — Manage Instagram posts per brand
 * Used as a sub-tab inside CMSBrands.jsx
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Instagram, Plus, Trash2, Pin, PinOff, Eye, EyeOff,
  ExternalLink, Heart, MessageCircle, Loader2, AlertTriangle,
  X, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import SimpleSelect from "@/components/shared/SimpleSelect";
import api from "@/lib/api";

const POST_TYPE_OPTIONS = [
  { value: "photo", label: "Photo" },
  { value: "video", label: "Video" },
  { value: "reel", label: "Reel" },
  { value: "carousel", label: "Carousel" },
];

const EMPTY_FORM = {
  post_url: "",
  image_url: "",
  thumbnail_url: "",
  caption: "",
  likes: 0,
  comments: 0,
  post_type: "photo",
  is_pinned: false,
  posted_at: "",
};

export default function BrandInstagramPosts({ brand }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [imgPreview, setImgPreview] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/cms/brands/${brand.id}/instagram`);
      setPosts(res.data?.data || []);
    } catch (e) {
      toast.error("Gagal memuat IG posts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [brand.id]);

  const handleSave = async () => {
    if (!form.image_url) { toast.error("URL gambar wajib diisi"); return; }
    if (!form.caption) { toast.error("Caption wajib diisi"); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        likes: Number(form.likes) || 0,
        comments: Number(form.comments) || 0,
        thumbnail_url: form.thumbnail_url || form.image_url,
        posted_at: form.posted_at || new Date().toISOString(),
      };
      await api.post(`/admin/cms/brands/${brand.id}/instagram`, payload);
      toast.success("IG post berhasil ditambahkan!");
      setFormOpen(false);
      setForm(EMPTY_FORM);
      setImgPreview("");
      load();
    } catch (e) {
      toast.error((e.response?.data?.errors?.[0]?.message || e.response?.data?.detail) || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (postId) => {
    setDeleting(true);
    try {
      await api.delete(`/admin/cms/brands/${brand.id}/instagram/${postId}`);
      toast.success("Post dihapus");
      setDeleteId(null);
      load();
    } catch (e) {
      toast.error("Gagal menghapus post");
    } finally {
      setDeleting(false);
    }
  };

  const handlePin = async (postId) => {
    try {
      await api.patch(`/admin/cms/brands/${brand.id}/instagram/${postId}/pin`);
      toast.success("Status pin diupdate");
      load();
    } catch (e) {
      toast.error("Gagal update pin");
    }
  };

  const handleToggleActive = async (post) => {
    try {
      await api.put(`/admin/cms/brands/${brand.id}/instagram/${post.id}`, { active: !post.active });
      toast.success(post.active ? "Post disembunyikan" : "Post ditampilkan");
      load();
    } catch (e) {
      toast.error("Gagal update status");
    }
  };

  const fmtDate = (iso) => {
    try {
      return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
    } catch { return "-"; }
  };

  return (
    <div className="space-y-4" data-testid="brand-instagram-mgmt">
      {/* Header */}
      {/* Toolbar (judul panel sudah di header slide-over CMSBrands) */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{posts.length} posts terdaftar</p>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={load} aria-label="Muat ulang" title="Muat ulang" data-testid="ig-posts-refresh">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => { setForm(EMPTY_FORM); setImgPreview(""); setFormOpen(true); }}
            data-testid="ig-posts-add"
          >
            <Plus className="w-4 h-4" /> Tambah Post
          </Button>
        </div>
      </div>

      {/* Instagram branding hint */}
      <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 border border-pink-100 rounded-xl">
        <Instagram className="w-4 h-4 text-pink-700 dark:text-pink-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground">
          Tambahkan post Instagram brand ini secara manual dengan URL gambar dan caption. Posts akan tampil di halaman brand publik sebagai Instagram Feed section.
          {brand.instagram && (
            <a href={`https://instagram.com/${brand.instagram?.replace("@", "")}`} target="_blank" rel="noopener noreferrer"
               className="ml-1 text-pink-700 dark:text-pink-400 hover:underline inline-flex items-center gap-1">
              Lihat profil {brand.instagram} <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!loading && posts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-border rounded-xl">
          <Instagram className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Belum ada IG posts untuk {brand.name}</p>
          <p className="text-xs text-muted-foreground mt-1">Klik "Tambah Post" untuk menambahkan</p>
        </div>
      )}

      {/* Posts grid */}
      {!loading && posts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {posts.map((post) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`relative rounded-xl overflow-hidden border-2 group ${
                post.active !== false ? "border-transparent" : "border-border opacity-50"
              }`}
            >
              {/* Image */}
              <div className="relative aspect-square bg-muted/40">
                <img
                  src={post.thumbnail_url || post.image_url}
                  alt={post.caption?.slice(0, 30)}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => { e.target.src = ""; }}
                />

                {/* Badges */}
                <div className="absolute top-2 left-2 flex gap-1">
                  {post.is_pinned && (
                    <span className="bg-yellow-400 text-yellow-900 dark:text-yellow-400 text-xs px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                      <Pin className="w-2.5 h-2.5" /> PIN
                    </span>
                  )}
                  {post.active === false && (
                    <span className="bg-gray-800/80 text-white text-xs px-1.5 py-0.5 rounded-full">Hidden</span>
                  )}
                </div>

                {/* Overlay actions */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-200 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => handlePin(post.id)}
                    className={`p-2 rounded-full transition-colors ${
                      post.is_pinned ? "bg-yellow-400 text-yellow-900 dark:text-yellow-400" : "bg-white/20 text-white hover:bg-white/40"
                    }`}
                    title={post.is_pinned ? "Unpin" : "Pin post"}
                    aria-label={post.is_pinned ? "Lepas pin post" : "Pin post"}
                  >
                    {post.is_pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => handleToggleActive(post)}
                    className="p-2 bg-white/20 text-white hover:bg-white/40 rounded-full transition-colors"
                    title={post.active !== false ? "Sembunyikan" : "Tampilkan"}
                    aria-label={post.active !== false ? "Sembunyikan post" : "Tampilkan post"}
                  >
                    {post.active !== false ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => setDeleteId(post.id)}
                    className="p-2 bg-red-500/80 text-white hover:bg-red-600 rounded-full transition-colors"
                    title="Hapus"
                    aria-label="Hapus post"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Caption + stats */}
              <div className="p-2 bg-background">
                <p className="text-xs text-foreground line-clamp-2 leading-relaxed">{post.caption}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Heart className="w-3 h-3" /> {post.likes?.toLocaleString("id-ID")}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MessageCircle className="w-3 h-3" /> {post.comments?.toLocaleString("id-ID")}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">{fmtDate(post.posted_at)}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Post Form Modal */}
      <AnimatePresence>
        {formOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => setFormOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="w-full max-w-2xl bg-background rounded-2xl overflow-hidden shadow-2xl"
              role="dialog" aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-500/10 dark:to-pink-500/10">
                <div className="flex items-center gap-2">
                  <Instagram className="w-5 h-5 text-pink-700 dark:text-pink-400" />
                  <h3 className="font-semibold text-foreground">Tambah Instagram Post — {brand.name}</h3>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => setFormOpen(false)} aria-label="Tutup">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="p-4 grid sm:grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto">
                {/* Image preview */}
                <div className="sm:col-span-2">
                  <label htmlFor="ig-post-url-gambar-utama" className="block text-xs font-medium text-foreground mb-1.5">URL Gambar Utama *</label>
                  <div className="flex gap-2">
                    <input id="ig-post-url-gambar-utama"
                      type="url"
                      value={form.image_url}
                      onChange={(e) => setForm(f => ({ ...f, image_url: e.target.value }))}
                      onBlur={(e) => setImgPreview(e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                      className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                    />
                  </div>
                  {imgPreview && (
                    <div className="mt-2 relative w-32 h-32 rounded-lg overflow-hidden border">
                      <img src={imgPreview} alt="preview" className="w-full h-full object-cover"
                        loading="lazy" decoding="async" onError={(e) => { e.target.src = ""; setImgPreview(""); }} />
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="ig-post-url-thumbnail" className="block text-xs font-medium text-foreground mb-1.5">URL Thumbnail (opsional)</label>
                  <input id="ig-post-url-thumbnail"
                    type="url"
                    value={form.thumbnail_url}
                    onChange={(e) => setForm(f => ({ ...f, thumbnail_url: e.target.value }))}
                    placeholder="Kosongkan = sama dengan gambar utama"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                  />
                </div>

                <div>
                  <label htmlFor="ig-post-url-post-instagram" className="block text-xs font-medium text-foreground mb-1.5">URL Post Instagram (opsional)</label>
                  <input id="ig-post-url-post-instagram"
                    type="url"
                    value={form.post_url}
                    onChange={(e) => setForm(f => ({ ...f, post_url: e.target.value }))}
                    placeholder="https://www.instagram.com/p/..."
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="ig-post-caption" className="block text-xs font-medium text-foreground mb-1.5">Caption *</label>
                  <textarea id="ig-post-caption"
                    value={form.caption}
                    onChange={(e) => setForm(f => ({ ...f, caption: e.target.value }))}
                    rows={4}
                    placeholder="Tulis caption Instagram di sini, lengkap dengan hashtag..."
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 resize-none"
                  />
                </div>

                <div>
                  <label htmlFor="ig-post-jumlah-likes" className="block text-xs font-medium text-foreground mb-1.5">Jumlah Likes</label>
                  <input id="ig-post-jumlah-likes"
                    type="number"
                    value={form.likes}
                    onChange={(e) => setForm(f => ({ ...f, likes: e.target.value }))}
                    min={0}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                  />
                </div>

                <div>
                  <label htmlFor="ig-post-jumlah-komentar" className="block text-xs font-medium text-foreground mb-1.5">Jumlah Komentar</label>
                  <input id="ig-post-jumlah-komentar"
                    type="number"
                    value={form.comments}
                    onChange={(e) => setForm(f => ({ ...f, comments: e.target.value }))}
                    min={0}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Tipe Post</label>
                  <SimpleSelect
                    value={form.post_type}
                    onValueChange={(v) => setForm(f => ({ ...f, post_type: v }))}
                    options={POST_TYPE_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                    testId="bip-post-type"
                  />
                </div>

                <div>
                  <label htmlFor="ig-post-tanggal-post" className="block text-xs font-medium text-foreground mb-1.5">Tanggal Post</label>
                  <input id="ig-post-tanggal-post"
                    type="date"
                    value={form.posted_at ? form.posted_at.slice(0, 10) : ""}
                    onChange={(e) => setForm(f => ({ ...f, posted_at: e.target.value ? new Date(e.target.value).toISOString() : "" }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_pinned}
                      onChange={(e) => setForm(f => ({ ...f, is_pinned: e.target.checked }))}
                      className="rounded"
                    />
                    <span className="text-sm text-foreground">Pin post ini (tampil di urutan teratas)</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 p-4 border-t">
                <Button variant="outline" onClick={() => setFormOpen(false)}>
                  Batal
                </Button>
                <Button onClick={handleSave} disabled={saving} data-testid="ig-post-save">
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</> : <><Plus className="w-4 h-4" /> Tambah Post</>}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      <AnimatePresence>
        {deleteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="bg-background rounded-2xl p-5 max-w-sm w-full shadow-2xl"
              role="alertdialog" aria-modal="true"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-700 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Hapus Post?</h3>
                  <p className="text-xs text-muted-foreground">Post akan disembunyikan dari website</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteId(null)}>Batal</Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(deleteId)}
                  disabled={deleting}
                  data-testid="ig-post-delete-confirm"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Hapus
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
