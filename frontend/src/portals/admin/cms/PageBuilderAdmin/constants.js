/** PageBuilder/constants.js — block type definitions and helpers. */
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


const BLOCK_TYPES = [
  { id: "hero",          label: "Hero Banner",     icon: Megaphone,        desc: "Full-width hero section with title, subtitle, CTA button" },
  { id: "rich_text",     label: "Text / HTML",     icon: Type,             desc: "Rich text content block with formatting" },
  { id: "image",         label: "Image",           icon: Image,            desc: "Single image with optional caption" },
  { id: "gallery",       label: "Gallery",         icon: Images,           desc: "Image gallery with responsive grid layout" },
  { id: "menu_showcase", label: "Menu Showcase",   icon: UtensilsCrossed,  desc: "Featured menu items with images and descriptions" },
  { id: "cta_banner",    label: "CTA Banner",      icon: Megaphone,        desc: "Call-to-action banner with button" },
  { id: "divider",       label: "Divider",         icon: Minus,            desc: "Visual section separator" },
];

const EMPTY_PAGE = {
  title: "", slug: "", description: "", status: "draft",
  blocks: [],
  seo_title: "", seo_description: "", seo_og_image: "",
};

function makeBlock(type) {
  const base = { id: `block_${Date.now()}_${Math.random().toString(36).slice(2)}`, type };
  switch (type) {
    case "hero":          return { ...base, title: "Selamat Datang", subtitle: "Tagline yang menginspirasi", cta_text: "Selengkapnya", cta_link: "/brands", bg_image: "", overlay_opacity: 60, text_color: "#ffffff" };
    case "rich_text":     return { ...base, content: "<p>Tulis konten Anda di sini...</p>" };
    case "image":         return { ...base, url: "", caption: "", size: "full", alt: "" };
    case "gallery":       return { ...base, images: [], layout: "grid", columns: 3 };
    case "menu_showcase": return { ...base, title: "Menu Pilihan", items: [], cta_text: "", cta_link: "" };
    case "cta_banner":    return { ...base, title: "Judul CTA", description: "Deskripsi singkat", btn_text: "Klik Di Sini", btn_link: "/", bg_color: "#1a1a2e", text_color: "#ffffff" };
    case "divider":       return { ...base, style: "line" };
    default:              return base;
  }
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").trim();
}

// ── Block editors ──────────────────────────────────────────────────────────

export { BLOCK_TYPES, makeBlock, slugify, EMPTY_PAGE };
