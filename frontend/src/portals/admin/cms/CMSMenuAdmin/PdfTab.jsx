/** CMSMenu/PdfTab.jsx — PDF menu management tab. */
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

import { BACKEND_URL } from "./helpers";

function PdfTab({ brands, selectedBrandId }) {
  const [pdfs, setPdfs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [version, setVersion] = useState("");
  const [previewUrl, setPreviewUrl] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const fileInputRef = useRef(null);
  const BACKEND_URL_INNER = process.env.REACT_APP_BACKEND_URL || "";

  const load = useCallback(async () => {
    if (!selectedBrandId) return;
    setLoading(true);
    try {
      const r = await api.get("/admin/cms/menu/pdfs", { params: { brand_id: selectedBrandId } });
      setPdfs(r.data?.data || []);
    } catch { toast.error("Gagal memuat PDF list"); }
    finally { setLoading(false); }
  }, [selectedBrandId]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (file) => {
    if (!file || !selectedBrandId) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("brand_id", selectedBrandId);
      if (version) fd.append("version", version);
      await api.post("/admin/cms/menu/upload-pdf", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("PDF berhasil diupload dan set sebagai aktif");
      setVersion("");
      await load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Upload PDF gagal");
    } finally { setUploading(false); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/admin/cms/menu/pdfs/${deleteId}`);
      toast.success("PDF dihapus");
      setDeleteId(null);
      await load();
    } catch { toast.error("Gagal menghapus PDF"); }
  };

  const getFullUrl = (url) => url && url.startsWith("/") ? `${BACKEND_URL_INNER}${url}` : url;

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="border-2 border-dashed border-border rounded-xl p-6">
        <div className="text-center space-y-3">
          <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">Upload Menu PDF</p>
            <p className="text-sm text-muted-foreground mt-1">PDF baru otomatis menjadi versi aktif untuk brand ini. Format: PDF, maks 10MB.</p>
          </div>
          <div className="flex gap-2 justify-center items-center">
            <Input className="max-w-xs" placeholder="Versi (misal: 2026-Q2, Summer 2026)" value={version} onChange={e => setVersion(e.target.value)} />
          </div>
          <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden"
            onChange={e => handleUpload(e.target.files?.[0])} />
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading || !selectedBrandId}>
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {uploading ? "Mengupload..." : "Pilih & Upload PDF"}
          </Button>
        </div>
      </div>

      {/* PDF List */}
      {loading ? (
        <div className="space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : pdfs.length === 0 ? (
        <p className="text-center text-muted-foreground text-sm py-6">Belum ada PDF untuk brand ini.</p>
      ) : (
        <div className="border rounded-xl overflow-hidden bg-white">
          {pdfs.map((pdf, idx) => (
            <div key={pdf.id} className={`flex items-center justify-between px-4 py-3 ${idx > 0 ? "border-t" : ""} hover:bg-muted/20`}>
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{pdf.filename}</span>
                    {pdf.is_active && <Badge variant="default" className="text-xs">Aktif</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Versi: {pdf.version} · {pdf.created_at ? new Date(pdf.created_at).toLocaleDateString("id-ID") : "-"}
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => setPreviewUrl(getFullUrl(pdf.pdf_url))} title="Preview">
                  <Eye className="h-3.5 w-3.5 mr-1" /> Preview
                </Button>
                <Button size="sm" variant="outline" asChild title="Download">
                  <a href={getFullUrl(pdf.pdf_url)} download target="_blank" rel="noreferrer">
                    <Download className="h-3.5 w-3.5" />
                  </a>
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label="Hapus PDF menu" onClick={() => setDeleteId(pdf.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PDF Preview Modal */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl w-full h-[80vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
            <DialogTitle>Preview PDF Menu</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden px-6 pb-6">
            <iframe
              src={previewUrl}
              title="PDF Preview"
              className="w-full h-full border rounded-lg"
              frameBorder="0"
            />
          </div>
          <div className="px-6 pb-6 flex justify-end gap-2 flex-shrink-0">
            <Button variant="outline" asChild>
              <a href={previewUrl} download target="_blank" rel="noreferrer">
                <Download className="h-4 w-4 mr-2" /> Download
              </a>
            </Button>
            <Button variant="ghost" onClick={() => setPreviewUrl(null)}>Tutup</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus PDF?</AlertDialogTitle>
            <AlertDialogDescription>File PDF akan dihapus dari sistem.</AlertDialogDescription>
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

// =================== MAIN COMPONENT ===================

export default PdfTab;
