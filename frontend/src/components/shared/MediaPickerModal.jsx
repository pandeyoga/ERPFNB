/**
 * MediaPickerModal
 * Browse + select an image from the Media Library in a modal.
 * Usage:
 *   <MediaPickerModal open={open} onClose={() => setOpen(false)} onSelect={(url) => setForm({...form, image: url})} />
 */
import { useState, useEffect, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Loader2, Check, Image as ImageIcon, Upload } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";

function thumb(url) {
  if (!url) return null;
  return url.startsWith("/") ? `${BACKEND_URL}${url}` : url;
}

export default function MediaPickerModal({ open, onClose, onSelect }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState(null);
  const [uploading, setUploading] = useState(false);

  const PAGE_SIZE = 24;

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
      toast.error("Gagal memuat media");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) { setSearch(""); setPage(1); setSelected(null); load(1, ""); }
  }, [open, load]);

  useEffect(() => { if (open) load(page, search); }, [page]); // eslint-disable-line

  // Debounced search
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => { setPage(1); load(1, search); }, 300);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line

  const handleQuickUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", files[0]);
      const r = await api.post("/admin/cms/media", formData, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("File diupload, pilih dari library di bawah");
      load(1, search);
      setPage(1);
      // Auto-select the newly uploaded file
      const url = r.data?.data?.url;
      if (url) setSelected(url);
    } catch (err) {
      toast.error(`Upload gagal: ${err.response?.data?.errors?.[0]?.message || err.message}`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleConfirm = () => {
    if (selected) { onSelect(selected); onClose(); }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl w-full" data-testid="media-picker-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" /> Media Library
          </DialogTitle>
          <DialogDescription>Pilih gambar atau upload baru</DialogDescription>
        </DialogHeader>

        {/* Search + Quick Upload */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Cari media..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="media-picker-search"
            />
          </div>
          <label>
            <Button asChild variant="outline" disabled={uploading} size="sm" data-testid="media-picker-upload-btn">
              <span className="cursor-pointer">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
                Upload Baru
              </span>
            </Button>
            <input type="file" accept="image/*" className="hidden" onChange={handleQuickUpload} disabled={uploading} data-testid="media-picker-upload-input" />
          </label>
        </div>

        {/* Grid */}
        <ScrollArea className="h-[380px]" data-testid="media-picker-grid-scroll">
          {loading ? (
            <div className="flex items-center justify-center h-full" data-testid="media-picker-loading">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2" data-testid="media-picker-empty">
              <ImageIcon className="h-10 w-10 opacity-30" />
              <p className="text-sm">{search ? "Tidak ada hasil" : "Belum ada media — upload dulu"}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 pr-2" data-testid="media-picker-grid">
              {items.map((item) => {
                const imgUrl = thumb(item.url);
                const isSelected = selected === item.url;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelected(item.url)}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:opacity-90 focus:outline-none ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-border hover:border-primary/40"
                    }`}
                    data-testid={`media-picker-item-${item.id}`}
                  >
                    <img src={imgUrl} alt={item.alt_text || item.title} className="w-full h-full object-cover" />
                    {isSelected && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <div className="bg-primary rounded-full p-0.5">
                          <Check className="h-3.5 w-3.5 text-primary-foreground" />
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground" data-testid="media-picker-pagination">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} data-testid="media-picker-prev">
              Prev
            </Button>
            <span>{page} / {totalPages} &nbsp;({total} file)</span>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} data-testid="media-picker-next">
              Next
            </Button>
          </div>
        )}

        {/* Selected Preview + Confirm */}
        {selected && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-primary/20" data-testid="media-picker-selected-preview">
            <img src={thumb(selected)} alt="selected" className="w-12 h-12 object-cover rounded-md border" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground truncate font-mono">{selected}</p>
              <Badge variant="secondary" className="mt-0.5 text-xs">Dipilih</Badge>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} data-testid="media-picker-cancel">Batal</Button>
          <Button onClick={handleConfirm} disabled={!selected} data-testid="media-picker-confirm">
            <Check className="h-4 w-4 mr-1.5" /> Gunakan Gambar Ini
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
