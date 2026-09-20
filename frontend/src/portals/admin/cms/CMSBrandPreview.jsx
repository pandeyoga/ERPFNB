/**
 * CMSBrandPreview
 * Live preview of a brand page using current form data.
 * Renders a styled mini Brand Detail page inside a Dialog.
 */
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Phone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import DOMPurify from "dompurify";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
const resolveUrl = (u) => u?.startsWith("/") ? `${BACKEND_URL}${u}` : (u || "");

function SafeHTML({ html, className }) {
  if (!html) return null;
  const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  // Check if it's plain text (no HTML tags)
  const isPlain = !/<[a-z][\s\S]*>/i.test(clean);
  if (isPlain) return <p className={className}>{html}</p>;
  return <div className={`prose prose-sm max-w-none ${className || ""}`} dangerouslySetInnerHTML={{ __html: clean }} />;
}

export default function CMSBrandPreview({ open, onClose, form }) {
  if (!form) return null;

  const heroImg = resolveUrl(form.hero_image);
  const cardImg = resolveUrl(form.card_image);
  const brandColor = form.color || "#C8A96E";
  const dishes = (form.signature_dishes || []).filter(d => d?.name?.trim());
  const tags = typeof form.tags === "string"
    ? form.tags.split(",").map(t => t.trim()).filter(Boolean)
    : (form.tags || []);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-y-auto p-0">
        {/* Preview banner */}
        <div className="sticky top-0 z-50 flex items-center justify-between px-4 py-2 bg-amber-500 text-white text-sm font-medium">
          <span>👁 Preview — Tampilan publik (belum disimpan/dipublikasi)</span>
          <Button variant="ghost" size="icon" aria-label="Tutup preview" className="h-7 w-7 text-white hover:bg-amber-600" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Hero */}
        <div
          className="relative h-64 md:h-80 flex items-end"
          style={{
            background: heroImg
              ? `linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.7)), url(${heroImg}) center/cover no-repeat`
              : brandColor,
          }}
        >
          <div className="p-6 text-white">
            <h1 className="text-3xl md:text-4xl font-bold mb-1">{form.name || "Nama Brand"}</h1>
            <p className="text-white/80 text-sm">{form.tagline}</p>
          </div>
        </div>

        <div className="px-6 py-8 space-y-8">
          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((t, i) => (
                <Badge key={i} variant="secondary">{t}</Badge>
              ))}
              {form.established && (
                <Badge variant="outline">Est. {form.established}</Badge>
              )}
            </div>
          )}

          {/* Short description */}
          {form.short_desc && (
            <p className="text-muted-foreground text-base leading-relaxed">{form.short_desc}</p>
          )}

          {/* Story */}
          {form.story && (
            <div>
              <h2 className="text-xl font-semibold mb-3">Our Story</h2>
              <SafeHTML html={form.story} className="text-muted-foreground leading-relaxed" />
            </div>
          )}

          {/* Signature Dishes */}
          {dishes.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Signature Dishes</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {dishes.map((d, i) => (
                  <div key={i} className="border border-border rounded-lg p-4">
                    <p className="font-semibold">{d.name}</p>
                    {d.desc && <p className="text-sm text-muted-foreground mt-1">{d.desc}</p>}
                    {d.price && <p className="text-sm font-medium mt-2" style={{ color: brandColor }}>{d.price}</p>}
                  </div>
                ))}
              </div>
            </div>
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
