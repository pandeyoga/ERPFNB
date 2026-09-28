/** PageBuilder/BlockEditors.jsx — all block editor components + BLOCK_EDITORS map. */
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
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import api from "@/lib/api";
import ImageUpload from "@/components/shared/ImageUpload";
import RichTextEditor from "@/components/shared/RichTextEditor";
import CMSSEOFields from "../CMSSEOFields";


function HeroBlockEditor({ block, onChange }) {
  const set = (k, v) => onChange({ ...block, [k]: v });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Title</Label>
          <Input value={block.title} onChange={e => set("title", e.target.value)} placeholder="Hero title" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Subtitle</Label>
          <Input value={block.subtitle} onChange={e => set("subtitle", e.target.value)} placeholder="Hero subtitle" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">CTA Text</Label>
          <Input value={block.cta_text} onChange={e => set("cta_text", e.target.value)} placeholder="Selengkapnya" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">CTA Link</Label>
          <Input value={block.cta_link} onChange={e => set("cta_link", e.target.value)} placeholder="/brands" />
        </div>
      </div>
      <ImageUpload label="Background Image" value={block.bg_image} onChange={url => set("bg_image", url)} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Overlay Opacity %</Label>
          <Input type="number" min={0} max={100} value={block.overlay_opacity} onChange={e => set("overlay_opacity", +e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Text Color</Label>
          <div className="flex gap-2 items-center">
            <input type="color" value={block.text_color} onChange={e => set("text_color", e.target.value)} className="h-9 w-12 rounded border cursor-pointer" />
            <Input value={block.text_color} onChange={e => set("text_color", e.target.value)} className="flex-1" />
          </div>
        </div>
      </div>
    </div>
  );
}

function RichTextBlockEditor({ block, onChange }) {
  return (
    <RichTextEditor
      value={block.content}
      onChange={html => onChange({ ...block, content: html })}
      minHeight={160}
      placeholder="Tulis konten blok di sini..."
    />
  );
}

function ImageBlockEditor({ block, onChange }) {
  const set = (k, v) => onChange({ ...block, [k]: v });
  return (
    <div className="space-y-3">
      <ImageUpload label="Image" value={block.url} onChange={url => set("url", url)} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Caption</Label>
          <Input value={block.caption} onChange={e => set("caption", e.target.value)} placeholder="Keterangan gambar" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Alt Text</Label>
          <Input value={block.alt} onChange={e => set("alt", e.target.value)} placeholder="Alt text" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Size</Label>
        <Select value={block.size} onValueChange={v => set("size", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="full">Full Width</SelectItem>
            <SelectItem value="medium">Medium (75%)</SelectItem>
            <SelectItem value="small">Small (50%)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function CTABlockEditor({ block, onChange }) {
  const set = (k, v) => onChange({ ...block, [k]: v });
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">Title</Label>
        <Input value={block.title} onChange={e => set("title", e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Description</Label>
        <Textarea rows={2} value={block.description} onChange={e => set("description", e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Button Text</Label>
          <Input value={block.btn_text} onChange={e => set("btn_text", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Button Link</Label>
          <Input value={block.btn_link} onChange={e => set("btn_link", e.target.value)} placeholder="/brands" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Background Color</Label>
          <div className="flex gap-2">
            <input type="color" value={block.bg_color} onChange={e => set("bg_color", e.target.value)} className="h-9 w-12 rounded border cursor-pointer" />
            <Input value={block.bg_color} onChange={e => set("bg_color", e.target.value)} className="flex-1" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Text Color</Label>
          <div className="flex gap-2">
            <input type="color" value={block.text_color} onChange={e => set("text_color", e.target.value)} className="h-9 w-12 rounded border cursor-pointer" />
            <Input value={block.text_color} onChange={e => set("text_color", e.target.value)} className="flex-1" />
          </div>
        </div>
      </div>
    </div>
  );
}

function DividerBlockEditor({ block, onChange }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">Style</Label>
      <Select value={block.style} onValueChange={v => onChange({ ...block, style: v })}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="line">Line</SelectItem>
          <SelectItem value="dots">Dots</SelectItem>
          <SelectItem value="spacer">Spacer (invisible)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function GalleryBlockEditor({ block, onChange }) {
  const set = (k, v) => onChange({ ...block, [k]: v });
  const images = block.images || [];
  
  const addImage = () => {
    set("images", [...images, { id: Date.now(), url: "", caption: "", alt: "" }]);
  };
  
  const updateImage = (idx, field, value) => {
    const updated = images.map((img, i) => i === idx ? { ...img, [field]: value } : img);
    set("images", updated);
  };
  
  const removeImage = (idx) => {
    set("images", images.filter((_, i) => i !== idx));
  };
  
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">Layout Style</Label>
        <Select value={block.layout || "grid"} onValueChange={v => set("layout", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="grid">Grid</SelectItem>
            <SelectItem value="masonry">Masonry</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-1">
        <Label className="text-xs">Columns</Label>
        <Select value={String(block.columns || 3)} onValueChange={v => set("columns", parseInt(v))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="2">2 Columns</SelectItem>
            <SelectItem value="3">3 Columns</SelectItem>
            <SelectItem value="4">4 Columns</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Images ({images.length})</Label>
          <Button type="button" size="sm" variant="outline" onClick={addImage}>
            <Plus className="h-3 w-3 mr-1" /> Add Image
          </Button>
        </div>
        
        {images.length === 0 ? (
          <div className="border-2 border-dashed rounded-lg p-4 text-center">
            <Images className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-30" />
            <p className="text-xs text-muted-foreground">No images yet. Click Add Image.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {images.map((img, idx) => (
              <div key={img.id || idx} className="border rounded-lg p-3 space-y-2 bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Image {idx + 1}</span>
                  <Button type="button" size="icon" variant="ghost" aria-label="Hapus image" className="h-6 w-6 text-destructive" 
                          onClick={() => removeImage(idx)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <ImageUpload 
                  label="Image URL" 
                  value={img.url} 
                  onChange={url => updateImage(idx, "url", url)} 
                />
                <Input 
                  placeholder="Alt text" 
                  value={img.alt || ""} 
                  onChange={e => updateImage(idx, "alt", e.target.value)}
                  className="text-xs"
                />
                <Input 
                  placeholder="Caption (optional)" 
                  value={img.caption || ""} 
                  onChange={e => updateImage(idx, "caption", e.target.value)}
                  className="text-xs"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MenuShowcaseBlockEditor({ block, onChange }) {
  const set = (k, v) => onChange({ ...block, [k]: v });
  const items = block.items || [];
  
  const addItem = () => {
    set("items", [...items, { 
      id: Date.now(), 
      name: "Menu Item", 
      description: "", 
      price: "", 
      image: "" 
    }]);
  };
  
  const updateItem = (idx, field, value) => {
    const updated = items.map((item, i) => i === idx ? { ...item, [field]: value } : item);
    set("items", updated);
  };
  
  const removeItem = (idx) => {
    set("items", items.filter((_, i) => i !== idx));
  };
  
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">Section Title</Label>
        <Input value={block.title || ""} onChange={e => set("title", e.target.value)} 
               placeholder="Menu Pilihan" />
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">CTA Text (optional)</Label>
          <Input value={block.cta_text || ""} onChange={e => set("cta_text", e.target.value)} 
                 placeholder="View Full Menu" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">CTA Link</Label>
          <Input value={block.cta_link || ""} onChange={e => set("cta_link", e.target.value)} 
                 placeholder="/menu" />
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Menu Items ({items.length})</Label>
          <Button type="button" size="sm" variant="outline" onClick={addItem}>
            <Plus className="h-3 w-3 mr-1" /> Add Item
          </Button>
        </div>
        
        {items.length === 0 ? (
          <div className="border-2 border-dashed rounded-lg p-4 text-center">
            <UtensilsCrossed className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-30" />
            <p className="text-xs text-muted-foreground">No menu items yet. Click Add Item.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {items.map((item, idx) => (
              <div key={item.id || idx} className="border rounded-lg p-3 space-y-2 bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Item {idx + 1}</span>
                  <Button type="button" size="icon" variant="ghost" aria-label="Hapus item" className="h-6 w-6 text-destructive" 
                          onClick={() => removeItem(idx)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <Input 
                  placeholder="Menu item name" 
                  value={item.name || ""} 
                  onChange={e => updateItem(idx, "name", e.target.value)}
                  className="font-medium"
                />
                <Textarea 
                  placeholder="Description" 
                  rows={2}
                  value={item.description || ""} 
                  onChange={e => updateItem(idx, "description", e.target.value)}
                  className="text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input 
                    placeholder="Price (e.g., Rp 50.000)" 
                    value={item.price || ""} 
                    onChange={e => updateItem(idx, "price", e.target.value)}
                    className="text-xs"
                  />
                  <ImageUpload 
                    label="" 
                    value={item.image || ""} 
                    onChange={url => updateItem(idx, "image", url)} 
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const BLOCK_EDITORS = {
  hero: HeroBlockEditor,
  rich_text: RichTextBlockEditor,
  image: ImageBlockEditor,
  gallery: GalleryBlockEditor,
  menu_showcase: MenuShowcaseBlockEditor,
  cta_banner: CTABlockEditor,
  divider: DividerBlockEditor,
};


export { HeroBlockEditor, RichTextBlockEditor, ImageBlockEditor, CTABlockEditor, DividerBlockEditor, GalleryBlockEditor, MenuShowcaseBlockEditor, BLOCK_EDITORS };
