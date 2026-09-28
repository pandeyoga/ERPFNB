/** SmartSEO/PreviewComponents.jsx — SEO preview helper components. */
/**
 * SmartSEO — AI-powered SEO Management Dashboard
 * Admin portal: /admin/smart-seo
 *
 * Features:
 * - Per-page SEO settings (title, description, OG, keywords)
 * - AI keyword analysis (search intent, clusters, suggestions)
 * - AI content generation (title, description, OG copy)
 * - Live Google SERP preview
 * - JSON-LD structured data overview
 */
import { useEffect, useState, useCallback } from "react";
import {
  Search, Sparkles, Save, RefreshCw, Eye, Globe, Settings,
  TrendingUp, Target, Zap, ChevronDown, ChevronUp, Check, AlertCircle,
  Plus, Trash2, ExternalLink, BarChart3, Tag, FileText, Share2,
} from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Page Registry ─────────────────────────────────────────────────────────────
const PUBLIC_PAGES = [
  { path: "/",                   page_key: "home",           page_name: "Home",           icon: Globe, context: "Halaman utama website FnB Group, menampilkan brand dan tagline utama" },
  { path: "/brands",            page_key: "brands",         page_name: "Brands",         icon: Tag,   context: "Halaman list semua brand FnB Group: The Coffeeshop, The Restaurant, The Bistro, The Lounge, The Bakery" },
  { path: "/brands/the-coffeeshop",     page_key: "brand-the-coffeeshop",   page_name: "The Coffeeshop",         icon: Tag,   context: "The Coffeeshop - specialty coffee & all-day dining. Konsep coffeeshop premium Bandung" },
  { path: "/brands/the-restaurant",  page_key: "brand-the-restaurant",page_name: "The Restaurant",      icon: Tag,   context: "The Restaurant - modern Latin & Mediterranean fine dining di Bandung" },
  { path: "/brands/the-bistro",    page_key: "brand-the-bistro",  page_name: "The Bistro",        icon: Tag,   context: "The Bistro - European bistro & wine bar di Bandung" },
  { path: "/brands/the-lounge",page_key: "brand-lounge",   page_name: "The Lounge",    icon: Tag,   context: "The Lounge - American smokehouse & sports bar di Bandung" },
  { path: "/brands/the-bakery",    page_key: "brand-the-bakery",  page_name: "The Bakery",        icon: Tag,   context: "The Bakery - artisan bakery & café di Bandung" },
  { path: "/menu",              page_key: "menu",           page_name: "Menu",           icon: FileText, context: "Halaman menu semua brand FnB Group" },
  { path: "/locations",         page_key: "locations",      page_name: "Locations",      icon: Globe, context: "Lokasi semua outlet FnB Group di Bandung" },
  { path: "/about",             page_key: "about",          page_name: "About",          icon: FileText, context: "Tentang FnB Group - cerita, visi misi, tim" },
  { path: "/news",              page_key: "news",           page_name: "News & Events",  icon: FileText, context: "Berita, event, dan update terbaru dari FnB Group" },
  { path: "/careers",          page_key: "careers",        page_name: "Careers",        icon: BarChart3, context: "Lowongan kerja dan karir di FnB Group" },
  { path: "/contact",          page_key: "contact",        page_name: "Contact",        icon: Share2, context: "Halaman kontak FnB Group" },
  { path: "/reservation",      page_key: "reservation",    page_name: "Reservasi",      icon: BarChart3, context: "Halaman reservasi meja untuk semua brand FnB Group" },
];

const CHAR_LIMITS = {
  title: { min: 50, max: 60 },
  description: { min: 148, max: 160 },
  og_title: { min: 40, max: 70 },
  og_description: { min: 100, max: 200 },
};


function CharCounter({ value = "", min, max }) {
  const len = value.length;
  const ok = len >= min && len <= max;
  const over = len > max;
  return (
    <span className={cn(
      "text-[11px] font-mono ml-1",
      ok ? "text-emerald-500" : over ? "text-red-500" : "text-amber-500"
    )}>
      {len}/{max}
    </span>
  );
}

function IntentBadge({ intent }) {
  const map = {
    informational: { label: "Informational", cls: "bg-blue-100 text-blue-700 border-blue-200" },
    navigational:  { label: "Navigational",  cls: "bg-purple-100 text-purple-700 border-purple-200" },
    commercial:    { label: "Commercial",    cls: "bg-amber-100 text-amber-700 border-amber-200" },
    transactional: { label: "Transactional", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  };
  const { label, cls } = map[intent] || { label: intent, cls: "bg-gray-100 text-gray-700" };
  return <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold border", cls)}>{label}</span>;
}

function SerpPreview({ title, description, path }) {
  const fullTitle = title ? `${title} | FnB Group` : "FnB Group — F&B Terbaik Bandung";
  const displayUrl = `fnbgroup.id${path}`;
  return (
    <div className="rounded-xl border border-border/50 bg-white p-4 shadow-sm font-sans">
      <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wide">Google SERP Preview</p>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex-shrink-0" />
        <div>
          <p className="text-[13px] text-gray-600">{displayUrl}</p>
        </div>
      </div>
      <p className="text-blue-600 text-lg font-medium hover:underline cursor-pointer leading-tight">
        {fullTitle.slice(0, 65)}{fullTitle.length > 65 ? "..." : ""}
      </p>
      <p className="text-gray-600 text-sm mt-1 leading-snug">
        {description ? description.slice(0, 165) + (description.length > 165 ? "..." : "") : (
          <span className="text-gray-400 italic">Meta description belum diisi...</span>
        )}
      </p>
    </div>
  );
}

function OgPreview({ ogTitle, ogDescription, ogImage, pageName }) {
  const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&h=314&fit=crop";
  return (
    <div className="rounded-xl border border-border/50 overflow-hidden shadow-sm bg-white">
      <p className="text-xs text-muted-foreground px-4 pt-3 pb-1 font-semibold uppercase tracking-wide">Social (OG) Preview</p>
      <img src={ogImage || DEFAULT_IMAGE} alt="OG Preview" className="w-full h-36 object-cover" loading="lazy" decoding="async" onError={e => { e.target.src = DEFAULT_IMAGE; }} />
      <div className="p-3 bg-[#f2f3f5]">
        <p className="text-[11px] text-gray-500 uppercase">fnbgroup.id</p>
        <p className="text-sm font-semibold text-gray-900 leading-tight">{ogTitle || pageName}</p>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{ogDescription || "..."}</p>
      </div>
    </div>
  );
}


export { CharCounter, IntentBadge, SerpPreview, OgPreview };
