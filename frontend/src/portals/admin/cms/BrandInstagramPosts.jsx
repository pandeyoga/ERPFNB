/**
 * BrandInstagramPosts.jsx — Manage Instagram posts per brand
 * Used as a sub-tab inside CMSBrands.jsx
 */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Instagram, Plus, Trash2, Pin, PinOff, Eye, EyeOff,
  ExternalLink, Heart, MessageCircle, Loader2, AlertTriangle,
  CheckCircle, X, Image as ImageIcon, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import SimpleSelect from "@/components/shared/SimpleSelect";
import api from "@/lib/api";

const POST_TYPE_OPTIONS = [
  { value: "photo", label: "📷 Photo" },
  { value: "video", label: "🎥 Video" },
  { value: "reel", label: "🎬 Reel" },
  { value: "carousel", label: "🖼️ Carousel" },
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
      toast.error(e.response?.data?.detail || "Gagal menyimpan");
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Instagram className="w-5 h-5 text-pink-500" />
          <div>
            <h3 className="font-semibold text-sm text-gray-900">
              Instagram Posts — {brand.instagram || `@${brand.code}`}
            </h3>
            <p className="text-xs text-gray-500">{posts.length} posts terdaftar</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setForm(EMPTY_FORM); setImgPreview(""); setFormOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" /> Tambah Post
          </button>
        </div>
      </div>

      {/* Instagram branding hint */}
      <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 border border-pink-100 rounded-xl">
        <Instagram className="w-4 h-4 text-pink-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-gray-600">
          Tambahkan post Instagram brand ini secara manual dengan URL gambar dan caption. Posts akan tampil di halaman brand publik sebagai Instagram Feed section.
          {brand.instagram && (
            <a href={`https://instagram.com/${brand.instagram?.replace("@", "")}`} target="_blank" rel="noopener noreferrer"
               className="ml-1 text-pink-500 hover:underline inline-flex items-center gap-1">
              Lihat profil {brand.instagram} <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}

      {/* Empty state */}
      {!loading && posts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-gray-200 rounded-xl">
          <Instagram className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">Belum ada IG posts untuk {brand.name}</p>
          <p className="text-xs text-gray-400 mt-1">Klik "Tambah Post" untuk menambahkan</p>
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
                post.active !== false ? "border-transparent" : "border-gray-200 opacity-50"
              }`}
            >
              {/* Image */}
              <div className="relative aspect-square bg-gray-100">
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
                    <span className="bg-yellow-400 text-yellow-900 text-[9px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                      <Pin className="w-2.5 h-2.5" /> PIN
                    </span>
                  )}
                  {post.active === false && (
                    <span className="bg-gray-800/80 text-white text-[9px] px-1.5 py-0.5 rounded-full">Hidden</span>
                  )}
                </div>

                {/* Overlay actions */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-200 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => handlePin(post.id)}
                    className={`p-2 rounded-full transition-colors ${
                      post.is_pinned ? "bg-yellow-400 text-yellow-900" : "bg-white/20 text-white hover:bg-white/40"
                    }`}
                    title={post.is_pinned ? "Unpin" : "Pin post"}
                  >
                    {post.is_pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => handleToggleActive(post)}
                    className="p-2 bg-white/20 text-white hover:bg-white/40 rounded-full transition-colors"
                    title={post.active !== false ? "Sembunyikan" : "Tampilkan"}
                  >
                    {post.active !== false ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => setDeleteId(post.id)}
                    className="p-2 bg-red-500/80 text-white hover:bg-red-600 rounded-full transition-colors"
                    title="Hapus"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Caption + stats */}
              <div className="p-2 bg-white">
                <p className="text-xs text-gray-700 line-clamp-2 leading-relaxed">{post.caption}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="flex items-center gap-1 text-[10px] text-gray-400">
                    <Heart className="w-3 h-3" /> {post.likes?.toLocaleString("id-ID")}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-gray-400">
                    <MessageCircle className="w-3 h-3" /> {post.comments?.toLocaleString("id-ID")}
                  </span>
                  <span className="text-[10px] text-gray-300 ml-auto">{fmtDate(post.posted_at)}</span>
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
              className="w-full max-w-2xl bg-white rounded-2xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b bg-gradient-to-r from-purple-50 to-pink-50">
                <div className="flex items-center gap-2">
                  <Instagram className="w-5 h-5 text-pink-500" />
                  <h3 className="font-semibold text-gray-900">Tambah Instagram Post — {brand.name}</h3>
                </div>
                <button onClick={() => setFormOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 grid sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
                {/* Image preview */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">URL Gambar Utama *</label>
                  <div className="flex gap-2">
                    <input
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
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">URL Thumbnail (opsional)</label>
                  <input
                    type="url"
                    value={form.thumbnail_url}
                    onChange={(e) => setForm(f => ({ ...f, thumbnail_url: e.target.value }))}
                    placeholder="Kosongkan = sama dengan gambar utama"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">URL Post Instagram (opsional)</label>
                  <input
                    type="url"
                    value={form.post_url}
                    onChange={(e) => setForm(f => ({ ...f, post_url: e.target.value }))}
                    placeholder="https://www.instagram.com/p/..."
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Caption *</label>
                  <textarea
                    value={form.caption}
                    onChange={(e) => setForm(f => ({ ...f, caption: e.target.value }))}
                    rows={4}
                    placeholder="Tulis caption Instagram di sini, lengkap dengan hashtag..."
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Jumlah Likes</label>
                  <input
                    type="number"
                    value={form.likes}
                    onChange={(e) => setForm(f => ({ ...f, likes: e.target.value }))}
                    min={0}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Jumlah Komentar</label>
                  <input
                    type="number"
                    value={form.comments}
                    onChange={(e) => setForm(f => ({ ...f, comments: e.target.value }))}
                    min={0}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Tipe Post</label>
                  <SimpleSelect
                    value={form.post_type}
                    onValueChange={(v) => setForm(f => ({ ...f, post_type: v }))}
                    options={POST_TYPE_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                    testId="bip-post-type"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Tanggal Post</label>
                  <input
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
                    <span className="text-sm text-gray-700">📌 Pin post ini (tampil di urutan teratas)</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 p-5 border-t bg-gray-50">
                <button onClick={() => setFormOpen(false)} className="flex-1 py-2.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors">
                  Batal
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
                >
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</> : <><Plus className="w-4 h-4" /> Tambah Post</>}
                </button>
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
              className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Hapus Post?</h3>
                  <p className="text-xs text-gray-500">Post akan disembunyikan dari website</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} className="flex-1 py-2 border rounded-lg text-sm hover:bg-gray-50 transition-colors">Batal</button>
                <button
                  onClick={() => handleDelete(deleteId)}
                  disabled={deleting}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Hapus
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
