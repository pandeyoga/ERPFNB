/**
 * CMSNewsPreview
 * Live preview of a news article using current form data.
 */
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Calendar, Tag } from "lucide-react";
import DOMPurify from "dompurify";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
const resolveUrl = (u) => u?.startsWith("/") ? `${BACKEND_URL}${u}` : (u || "");

function SafeHTML({ html, className }) {
  if (!html) return null;
  const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  const isPlain = !/<[a-z][\s\S]*>/i.test(clean);
  if (isPlain) return <p className={className}>{html}</p>;
  return <div className={`prose prose-sm prose-headings:font-bold prose-a:text-primary max-w-none ${className || ""}`} dangerouslySetInnerHTML={{ __html: clean }} />;
}

export default function CMSNewsPreview({ open, onClose, form, brandName }) {
  if (!form) return null;

  const imgSrc = resolveUrl(form.image);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl w-full max-h-[90vh] overflow-y-auto p-0">
        {/* Preview banner */}
        <div className="sticky top-0 z-50 flex items-center justify-between px-4 py-2 bg-amber-500 text-white text-sm font-medium">
          <span>👁 Preview — Tampilan publik (belum disimpan/dipublikasi)</span>
          <Button variant="ghost" size="icon" aria-label="Tutup preview" className="h-7 w-7 text-white hover:bg-amber-600" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Cover Image */}
        {imgSrc && (
          <div className="h-56 md:h-72 overflow-hidden">
            <img src={imgSrc} alt={form.title} className="w-full h-full object-cover" loading="lazy" decoding="async" />
          </div>
        )}

        <div className="px-6 py-8 space-y-6">
          {/* Meta */}
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {form.category && <Badge variant="secondary">{form.category}</Badge>}
            {brandName && <Badge variant="outline">{brandName}</Badge>}
            {form.date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(form.date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-2xl md:text-3xl font-bold leading-snug">
            {form.title || "Judul Artikel"}
          </h1>

          {/* Excerpt */}
          {form.excerpt && (
            <p className="text-base text-muted-foreground border-l-4 border-primary/40 pl-4 italic leading-relaxed">
              {form.excerpt}
            </p>
          )}

          {/* Content */}
          {form.content ? (
            <SafeHTML html={form.content} className="text-foreground/85 leading-relaxed" />
          ) : (
            <p className="text-muted-foreground italic">Konten artikel belum diisi.</p>
          )}

          {/* Status note */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <strong>Status:</strong> {form.status === "published" ? "Published ✅" : `Draft — ${form.publish_at ? `Scheduled: ${new Date(form.publish_at).toLocaleString("id-ID")}` : "belum dijadwalkan"}`}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
