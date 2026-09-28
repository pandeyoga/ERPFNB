/**
 * Media Library Page
 * Browse, upload, and manage images in the CMS media library.
 */
import { useState, useEffect, useCallback } from "react";
import {
  Upload, Search, Trash2, Copy, CheckCircle2, Loader2,
  Image as ImageIcon, RefreshCw, Grid2x2, List, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import api from "@/lib/api";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function MediaCard({ item, onDelete, onCopy, viewMode }) {
  const [imgError, setImgError] = useState(false);
  const imgUrl = item.url?.startsWith("/") ? `${BACKEND_URL}${item.url}` : item.url;

  if (viewMode === "list") {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/20 transition-colors group">
        <div className="w-12 h-12 rounded-md overflow-hidden bg-muted shrink-0">
          {imgError ? (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
            </div>
          ) : (
            <img src={imgUrl} alt={item.alt_text} className="w-full h-full object-cover" loading="lazy" decoding="async" onError={() => setImgError(true)} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.title || item.original_filename}</p>
          <p className="text-xs text-muted-foreground">{formatBytes(item.file_size)} · {item.content_type}</p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onCopy(item.url)}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(item.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative rounded-lg overflow-hidden border border-border bg-card hover:border-primary/50 transition-all">
      <div className="aspect-square bg-muted">
        {imgError ? (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          </div>
        ) : (
          <img src={imgUrl} alt={item.alt_text} className="w-full h-full object-cover" loading="lazy" decoding="async" onError={() => setImgError(true)} />
        )}
      </div>
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        <Button
          size="icon"
          variant="secondary"
          className="h-8 w-8"
          aria-label="Copy URL media"
          onClick={() => onCopy(item.url)}
          data-testid={`copy-media-${item.id}`}
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="destructive"
          className="h-8 w-8"
          aria-label="Hapus media"
          onClick={() => onDelete(item.id)}
          data-testid={`delete-media-${item.id}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-2">
        <p className="text-xs font-medium truncate">{item.title || item.original_filename}</p>
        <p className="text-xs text-muted-foreground">{formatBytes(item.file_size)}</p>
      </div>
    </div>
  );
}

export default function MediaLibrary() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [viewMode, setViewMode] = useState("grid");
  const [copiedUrl, setCopiedUrl] = useState(null);

  const PAGE_SIZE = 20;

  const load = useCallback(async (pg = 1, q = "") => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: pg, page_size: PAGE_SIZE });
      if (q) params.set("search", q);
      const r = await api.get(`/admin/cms/media?${params}`);
      const data = r.data?.data || {};
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch {
      toast.error("Gagal memuat media library");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(1, search); setPage(1); }, [search]); // eslint-disable-line
  useEffect(() => { load(page, search); }, [page]); // eslint-disable-line

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    let successCount = 0;
    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        await api.post("/admin/cms/media", formData, { headers: { "Content-Type": "multipart/form-data" } });
        successCount++;
      } catch (err) {
        toast.error(`Gagal upload ${file.name}: ${err.response?.data?.errors?.[0]?.message || err.message}`);
      }
    }
    if (successCount > 0) toast.success(`${successCount} file berhasil diupload`);
    setUploading(false);
    load(1, search);
    setPage(1);
    e.target.value = "";
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/admin/cms/media/${deleteId}`);
      toast.success("Media dihapus");
      setDeleteId(null);
      load(page, search);
    } catch (e) {
      toast.error("Gagal menghapus media");
    }
  };

  const handleCopy = (url) => {
    const fullUrl = url?.startsWith("/") ? `${BACKEND_URL}${url}` : url;
    navigator.clipboard?.writeText(fullUrl).then(() => {
      setCopiedUrl(url);
      toast.success("URL disalin ke clipboard");
      setTimeout(() => setCopiedUrl(null), 2000);
    });
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Media Library</h1>
          <p className="text-sm text-muted-foreground">{total} file tersimpan</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Refresh media library"
            onClick={() => load(page, search)}
            disabled={loading}
            data-testid="media-refresh-btn"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <label>
            <Button
              asChild
              disabled={uploading}
              data-testid="media-upload-btn"
            >
              <span className="cursor-pointer">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                Upload
              </span>
            </Button>
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {/* Search + view toggle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Cari file..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="media-search-input"
          />
        </div>
        <div className="flex items-center gap-1 border border-border rounded-lg p-0.5">
          <Button
            variant={viewMode === "grid" ? "default" : "ghost"}
            size="icon"
            className="h-7 w-7"
            aria-label="Tampilan grid"
            onClick={() => setViewMode("grid")}
          >
            <Grid2x2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="icon"
            className="h-7 w-7"
            aria-label="Tampilan list"
            onClick={() => setViewMode("list")}
          >
            <List className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Upload hint */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>Format didukung: JPEG, PNG, WebP · Maks. 5MB per file · Klik kanan gambar untuk salin URL-nya</span>
      </div>

      {/* Grid/List */}
      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <ImageIcon className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm">{search ? "Tidak ada media yang cocok" : "Belum ada media diupload"}</p>
          {!search && <p className="text-xs mt-1">Klik 'Upload' untuk menambahkan gambar pertama</p>}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {items.map((item) => (
            <MediaCard key={item.id} item={item} onDelete={setDeleteId} onCopy={handleCopy} viewMode="grid" />
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((item) => (
            <MediaCard key={item.id} item={item} onDelete={setDeleteId} onCopy={handleCopy} viewMode="list" />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            Prev
          </Button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
            Next
          </Button>
        </div>
      )}

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus media?</AlertDialogTitle>
            <AlertDialogDescription>
              File akan ditandai sebagai dihapus. Pastikan gambar ini tidak digunakan di konten lain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
