/** FileDropZone — generic file upload component for Phase 8B+.
 *
 * Features:
 * - Drag & drop or click to browse
 * - Live progress indicator (uses axios upload progress)
 * - Type & size validation client-side
 * - Calls POST /api/uploads with the configured category
 * - Shows uploaded file as a chip with thumbnail (for images) or icon (for docs)
 * - onUploaded(attachment) callback returns the full attachment record
 * - Optional initialAttachment to render existing file (controlled-ish)
 *
 * Props:
 *   category          — string, e.g. "deposit_slip", "receipt", "invoice"
 *   accept            — string (HTML accept) e.g. "image/*,application/pdf"
 *   maxSizeMB         — number (default 10)
 *   sourceType        — optional metadata (string)
 *   sourceId          — optional metadata (string)
 *   onUploaded(att)   — callback after successful upload
 *   onCleared()       — callback when user removes
 *   value             — attachment object (id + url + filename + content_type)
 *   compact           — boolean for tighter layout
 *   label             — dropzone label text (e.g. "Upload struk")
 *   description       — secondary text
 *   testId            — string for data-testid
 */
import { useRef, useState, useCallback } from "react";
import { Upload, X, Camera, FileText, Image as ImageIcon, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import api, { unwrap, unwrapError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function FileDropZone({
  category = "general",
  accept = "image/jpeg,image/png,image/webp,application/pdf",
  maxSizeMB = 10,
  sourceType,
  sourceId,
  onUploaded,
  onCleared,
  value,
  compact = false,
  label = "Upload file",
  description,
  testId = "filedropzone",
  showCamera = true,
}) {
  const fileRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [internal, setInternal] = useState(null); // when uncontrolled

  const att = value || internal;

  const reset = useCallback(() => {
    setInternal(null);
    setError(null);
    setProgress(0);
    if (fileRef.current) fileRef.current.value = "";
    if (onCleared) onCleared();
  }, [onCleared]);

  const validate = (file) => {
    if (!file) return "Tidak ada file";
    const sizeMB = file.size / 1024 / 1024;
    if (sizeMB > maxSizeMB) {
      return `Ukuran ${sizeMB.toFixed(1)}MB melebihi batas ${maxSizeMB}MB`;
    }
    // Loose accept check: if accept set, validate that the file type starts with one of accepts
    if (accept) {
      const allowed = accept.split(",").map(s => s.trim().toLowerCase());
      const ft = (file.type || "").toLowerCase();
      const ok = allowed.some(a => {
        if (a.endsWith("/*")) return ft.startsWith(a.replace("/*", "/"));
        return ft === a;
      });
      if (!ok) return `Tipe file '${file.type || "unknown"}' tidak diizinkan. Gunakan: ${accept}`;
    }
    return null;
  };

  const upload = async (file) => {
    setError(null);
    const v = validate(file);
    if (v) {
      setError(v);
      toast.error(v);
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", category);
      if (sourceType) fd.append("source_type", sourceType);
      if (sourceId) fd.append("source_id", sourceId);
      const res = await api.post("/uploads", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      const data = unwrap(res);
      if (!value) setInternal(data);
      if (onUploaded) onUploaded(data);
      toast.success("File berhasil diunggah");
    } catch (e) {
      const msg = unwrapError(e);
      setError(msg);
      toast.error(`Upload gagal: ${msg}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleFile = (file) => {
    if (file) upload(file);
  };

  // Render uploaded chip
  if (att) {
    const isImage = (att.content_type || "").startsWith("image/");
    const fileUrl = att.url
      ? `${process.env.REACT_APP_BACKEND_URL}${att.url}`
      : null;
    return (
      <div
        className={cn(
          "glass-card-hover flex items-center gap-3 p-3 border border-emerald-500/30 bg-emerald-500/5",
          compact && "p-2 gap-2",
        )}
        data-testid={`${testId}-chip`}
      >
        <div className={cn(
          "rounded-lg overflow-hidden bg-foreground/5 flex items-center justify-center shrink-0",
          compact ? "h-10 w-10" : "h-14 w-14",
        )}>
          {isImage && fileUrl ? (
            <a href={fileUrl} target="_blank" rel="noopener noreferrer">
              <img
                src={fileUrl}
                alt={att.filename}
                className={cn("object-cover", compact ? "h-10 w-10" : "h-14 w-14")}
                data-testid={`${testId}-thumb`}
              />
            </a>
          ) : (
            <FileText className={cn("text-muted-foreground", compact ? "h-5 w-5" : "h-6 w-6")} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span className="font-medium text-sm truncate">{att.filename || "file"}</span>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            {att.size_bytes != null && (
              <span>{(att.size_bytes / 1024).toFixed(1)} KB</span>
            )}
            {att.content_type && (
              <span className="px-1.5 py-0 rounded-full bg-foreground/5 text-[10px]">
                {att.content_type.split("/")[1]}
              </span>
            )}
            {fileUrl && (
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:underline"
                data-testid={`${testId}-view`}
              >
                View
              </a>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={reset}
          className="h-7 px-2"
          aria-label="Hapus file"
          data-testid={`${testId}-remove`}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  // Render dropzone
  return (
    <div
      className={cn(
        "glass-card-hover border-2 border-dashed border-foreground/15 text-center cursor-pointer transition-all",
        compact ? "p-3" : "p-5",
        dragOver && "border-aurora-3 bg-aurora-3/5 scale-[1.01]",
        uploading && "pointer-events-none opacity-90",
      )}
      onClick={() => !uploading && fileRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) handleFile(f);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileRef.current?.click(); }}
      data-testid={`${testId}-zone`}
    >
      <div className={cn(
        "rounded-xl grad-aurora-soft flex items-center justify-center mx-auto",
        compact ? "h-9 w-9 mb-1.5" : "h-12 w-12 mb-2",
      )}>
        {uploading
          ? <Loader2 className={cn("animate-spin", compact ? "h-4 w-4" : "h-5 w-5")} />
          : <Upload className={cn("", compact ? "h-4 w-4" : "h-5 w-5")} />
        }
      </div>
      <div className="text-sm font-semibold mb-0.5">{uploading ? "Mengunggah…" : label}</div>
      <div className="text-xs text-muted-foreground mb-2">
        {uploading ? `${progress}%` : (description || `Drop file di sini, klik untuk browse — maks ${maxSizeMB}MB`)}
      </div>
      {!uploading && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-full touch-target"
            onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
            data-testid={`${testId}-browse"`}
          >
            <Upload className="h-3.5 w-3.5 mr-1" /> Browse
          </Button>
          {showCamera && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full touch-target"
              onClick={(e) => {
                e.stopPropagation();
                if (fileRef.current) {
                  fileRef.current.setAttribute("capture", "environment");
                  fileRef.current.click();
                }
              }}
              data-testid={`${testId}-camera"`}
            >
              <Camera className="h-3.5 w-3.5 mr-1" /> Camera
            </Button>
          )}
        </div>
      )}
      {uploading && (
        <div className="mt-3 w-full max-w-xs mx-auto h-1.5 rounded-full bg-foreground/10 overflow-hidden">
          <div
            className="h-full grad-aurora rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {error && (
        <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-red-600">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
        data-testid={`${testId}-input`}
      />
    </div>
  );
}
