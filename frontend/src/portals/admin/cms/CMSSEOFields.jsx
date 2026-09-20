/**
 * SEO Fields Form Component
 * Reusable SEO metadata section for CMS Brand/News editors.
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Globe, Hash, AlignLeft, Image } from "lucide-react";

export default function CMSSEOFields({ form, onChange }) {
  return (
    <div className="space-y-4 rounded-lg border border-dashed border-border/60 p-4 bg-muted/20">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Globe className="h-4 w-4 text-primary" />
        SEO & Open Graph
      </div>

      <div className="grid grid-cols-1 gap-3">
        {/* SEO Slug */}
        <div>
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Hash className="h-3 w-3" /> URL Slug
          </Label>
          <Input
            value={form.seo_slug || ""}
            onChange={(e) => onChange("seo_slug", e.target.value)}
            placeholder="contoh: the-coffeeshop-coffee-jakarta"
            className="mt-1"
            data-testid="seo-slug-input"
          />
          <p className="text-xs text-muted-foreground mt-1">
            URL publik: /brands/<span className="font-mono">{form.seo_slug || "slug-halaman"}</span>
          </p>
        </div>

        {/* SEO Title */}
        <div>
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <AlignLeft className="h-3 w-3" /> Meta Title
          </Label>
          <Input
            value={form.seo_title || ""}
            onChange={(e) => onChange("seo_title", e.target.value)}
            placeholder={`${form.name || "Nama brand"} | FnB Group`}
            maxLength={70}
            className="mt-1"
            data-testid="seo-title-input"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {(form.seo_title || "").length}/70 karakter (ideal: 50–60)
          </p>
        </div>

        {/* SEO Description */}
        <div>
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <AlignLeft className="h-3 w-3" /> Meta Description
          </Label>
          <Textarea
            value={form.seo_description || ""}
            onChange={(e) => onChange("seo_description", e.target.value)}
            placeholder="Deskripsi singkat yang muncul di hasil pencarian Google..."
            maxLength={160}
            rows={2}
            className="mt-1 text-sm resize-none"
            data-testid="seo-description-input"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {(form.seo_description || "").length}/160 karakter (ideal: 120–160)
          </p>
        </div>

        {/* OG Image */}
        <div>
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Image className="h-3 w-3" /> OG Image URL
          </Label>
          <Input
            value={form.seo_og_image || ""}
            onChange={(e) => onChange("seo_og_image", e.target.value)}
            placeholder="https://...  (1200×630px recommended)"
            className="mt-1 font-mono text-xs"
            data-testid="seo-og-image-input"
          />
        </div>
      </div>
    </div>
  );
}
