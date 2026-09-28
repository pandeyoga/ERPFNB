/** SmartSEO/index.jsx — Smart SEO management page. */
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
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Search, Sparkles, Save, RefreshCw, Eye, Globe, Settings,
  TrendingUp, Target, Zap, ChevronDown, ChevronUp, Check, AlertCircle,
  Plus, Trash2, ExternalLink, BarChart3, Tag, FileText, Share2, Clock,
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

import { CharCounter, IntentBadge, SerpPreview, OgPreview } from "./PreviewComponents";
import BulkOptimizeDialog from "./BulkOptimizeDialog";

export default function SmartSEO() {
  const [seoMap, setSeoMap] = useState({}); // path → seo doc
  const [selected, setSelected] = useState(PUBLIC_PAGES[0]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "",
    og_title: "", og_description: "", og_image: "",
    keywords: "", focus_keywords: [],
    canonical_path: "", noindex: false,
    notes: "",
  });
  const [inputKeywords, setInputKeywords] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [generated, setGenerated] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiPowered, setAiPowered] = useState(null);
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [aiElapsed, setAiElapsed] = useState(0);
  const aiTimerRef = useRef(null);

  // Start/stop elapsed timer for AI operations
  const startAiTimer = useCallback(() => {
    setAiElapsed(0);
    aiTimerRef.current = setInterval(() => setAiElapsed(s => s + 1), 1000);
  }, []);
  const stopAiTimer = useCallback(() => {
    if (aiTimerRef.current) {
      clearInterval(aiTimerRef.current);
      aiTimerRef.current = null;
    }
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (aiTimerRef.current) clearInterval(aiTimerRef.current);
    };
  }, []);

  // Load all SEO settings
  useEffect(() => {
    api.get("/seo/pages").then(r => {
      const map = {};
      (r.data?.data || []).forEach(d => { map[d.path] = d; });
      setSeoMap(map);
    }).catch(() => {});
  }, []);

  // When selected page changes, prefill form
  useEffect(() => {
    const existing = seoMap[selected.path];
    if (existing) {
      setForm({
        title: existing.title || "",
        description: existing.description || "",
        og_title: existing.og_title || "",
        og_description: existing.og_description || "",
        og_image: existing.og_image || "",
        keywords: existing.keywords || "",
        focus_keywords: existing.focus_keywords || [],
        canonical_path: existing.canonical_path || selected.path,
        noindex: existing.noindex || false,
        notes: existing.notes || "",
      });
      setAnalysis(existing.ai_analysis || null);
    } else {
      setForm({
        title: "", description: "",
        og_title: "", og_description: "", og_image: "",
        keywords: "", focus_keywords: [],
        canonical_path: selected.path, noindex: false, notes: "",
      });
      setAnalysis(null);
    }
    setGenerated(null);
    setInputKeywords("");
  }, [selected.path, seoMap]); // eslint-disable-line

  const handleAnalyze = useCallback(async () => {
    if (!inputKeywords.trim()) {
      toast.error("Masukkan minimal 1 keyword terlebih dahulu");
      return;
    }
    setAnalyzing(true);
    startAiTimer();
    try {
      const r = await api.post("/seo/ai/analyze", {
        path: selected.path,
        page_key: selected.page_key,
        page_name: selected.page_name,
        keywords: inputKeywords,
        page_context: selected.context,
      }, { timeout: 45000 });
      const data = r.data?.data;
      setAnalysis(data);
      setAiPowered(r.data?.meta?.ai_powered === true);
      setShowAnalysis(true);
      if (!r.data?.meta?.ai_powered) {
        toast.info(r.data?.meta?.message || "AI tidak aktif, menggunakan analisis dasar");
      } else {
        toast.success("Analisis SEO selesai!");
      }
    } catch (e) {
      toast.error("Gagal menganalisis keyword");
    } finally {
      setAnalyzing(false);
      stopAiTimer();
    }
  }, [selected, inputKeywords, startAiTimer, stopAiTimer]);

  const handleGenerate = useCallback(async () => {
    const kw = inputKeywords.trim() || form.keywords;
    if (!kw) {
      toast.error("Masukkan keyword terlebih dahulu");
      return;
    }
    setGenerating(true);
    startAiTimer();
    try {
      const r = await api.post("/seo/ai/generate", {
        path: selected.path,
        page_key: selected.page_key,
        page_name: selected.page_name,
        keywords: kw,
        intent: analysis?.primary_intent,
        suggestions: analysis?.keyword_clusters,
        page_context: selected.context,
      }, { timeout: 45000 });
      const data = r.data?.data;
      setGenerated(data);
      setAiPowered(r.data?.meta?.ai_powered === true);
      // Auto-fill form with generated content
      setForm(f => ({
        ...f,
        title: data.title || f.title,
        description: data.description || f.description,
        og_title: data.og_title || f.og_title,
        og_description: data.og_description || f.og_description,
        keywords: kw,
        focus_keywords: data.focus_keywords || f.focus_keywords,
      }));
      if (!r.data?.meta?.ai_powered) {
        toast.info(r.data?.meta?.message || "AI tidak aktif, menggunakan template dasar");
      } else {
        toast.success("Konten SEO berhasil di-generate!");
      }
    } catch (e) {
      toast.error("Gagal generate konten SEO");
    } finally {
      setGenerating(false);
      stopAiTimer();
    }
  }, [selected, inputKeywords, form.keywords, analysis, startAiTimer, stopAiTimer]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        path: selected.path,
        page_key: selected.page_key,
        ...form,
        ai_analysis: analysis || null,
      };
      const r = await api.post("/seo/pages", payload);
      setSeoMap(m => ({ ...m, [selected.path]: r.data?.data }));
      toast.success("SEO settings disimpan!");
    } catch (e) {
      toast.error("Gagal menyimpan SEO settings");
    } finally { setSaving(false); }
  }, [selected, form, analysis]);

  const handleApplyGenerated = () => {
    if (!generated) return;
    setForm(f => ({
      ...f,
      title: generated.title || f.title,
      description: generated.description || f.description,
      og_title: generated.og_title || f.og_title,
      og_description: generated.og_description || f.og_description,
      focus_keywords: generated.focus_keywords || f.focus_keywords,
    }));
    toast.success("AI suggestions diterapkan ke form!");
  };

  const hasSeoSaved = !!seoMap[selected.path];

  return (
    <div className="space-y-6" data-testid="smart-seo-page">
      {/* Header */}
      <div className="glass-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Smart SEO Optimization</h2>
              <p className="text-sm text-muted-foreground">AI-powered keyword analysis & meta tag generator untuk website publik FnB Group</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {aiPowered === true && (
              <Badge className="bg-violet-100 text-violet-700 border-violet-200">
                <Sparkles className="w-3 h-3 mr-1" /> AI Aktif
              </Badge>
            )}
            {aiPowered === false && (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                Mode Dasar
              </Badge>
            )}
            <Button
              onClick={() => setBulkOpen(true)}
              size="sm"
              data-testid="bulk-optimize-open-btn"
              className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white"
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              Optimize Semua
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Sidebar — page list */}
        <div className="col-span-12 lg:col-span-3 space-y-1">
          <div className="glass-card p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold px-2 mb-2">Halaman Publik</p>
            {PUBLIC_PAGES.map(pg => {
              const saved = !!seoMap[pg.path];
              const isActive = selected.path === pg.path;
              return (
                <button
                  key={pg.path}
                  onClick={() => setSelected(pg)}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-sm transition-all",
                    isActive
                      ? "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 font-semibold"
                      : "hover:bg-muted/50 text-foreground"
                  )}
                  data-testid={`seo-page-${pg.page_key}`}
                >
                  <span className="truncate">{pg.page_name}</span>
                  {saved ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main editor */}
        <div className="col-span-12 lg:col-span-9 space-y-4">
          {/* Page header */}
          <div className="glass-card p-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-base">{selected.page_name}</p>
              <p className="text-xs text-muted-foreground font-mono">{selected.path}</p>
            </div>
            <div className="flex items-center gap-2">
              {hasSeoSaved && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs"><Check className="w-3 h-3 mr-1" />Tersimpan</Badge>}
              <Button size="sm" onClick={handleSave} disabled={saving} data-testid="seo-save-btn">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span className="ml-1.5">Simpan</span>
              </Button>
            </div>
          </div>

          {/* AI Keyword Input */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-violet-500" />
              <h3 className="font-semibold text-sm">AI Keyword Analysis</h3>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Keywords (pisahkan dengan koma)</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    placeholder="restoran bandung, cafe premium, fine dining bandung..."
                    value={inputKeywords}
                    onChange={e => setInputKeywords(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleAnalyze(); }}
                    data-testid="seo-keywords-input"
                    disabled={analyzing || generating}
                  />
                  <Button
                    variant="outline"
                    onClick={handleAnalyze}
                    disabled={analyzing || generating}
                    data-testid="seo-analyze-btn"
                    className="flex-shrink-0"
                  >
                    {analyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                    <span className="ml-1.5 hidden sm:inline">Analisa</span>
                  </Button>
                  <Button
                    onClick={handleGenerate}
                    disabled={generating || analyzing}
                    data-testid="seo-generate-btn"
                    className="flex-shrink-0 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                  >
                    {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    <span className="ml-1.5 hidden sm:inline">Generate</span>
                  </Button>
                </div>
              </div>

              {/* AI Processing Banner */}
              {(analyzing || generating) && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200" data-testid="ai-processing-banner">
                  <RefreshCw className="w-4 h-4 animate-spin text-violet-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">
                      {analyzing ? "AI menganalisis keyword..." : "AI generate konten SEO..."}
                    </p>
                    <p className="text-[11px] text-violet-500">Harap tunggu, proses AI membutuhkan ~15-25 detik</p>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-violet-500 font-mono flex-shrink-0">
                    <Clock className="w-3.5 h-3.5" />
                    {aiElapsed}s
                  </span>
                </div>
              )}

              {/* Analysis Results */}
              {analysis && !analyzing && (
                <div className="rounded-xl border border-violet-200 bg-violet-50/50 dark:bg-violet-950/20 p-4">
                  <button
                    className="flex items-center justify-between w-full"
                    onClick={() => setShowAnalysis(v => !v)}
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-violet-500" />
                      <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">Hasil Analisis AI</span>
                      <IntentBadge intent={analysis.primary_intent} />
                    </div>
                    {showAnalysis ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {showAnalysis && (
                    <div className="mt-3 space-y-3">
                      {analysis.intent_explanation && (
                        <p className="text-xs text-muted-foreground italic">{analysis.intent_explanation}</p>
                      )}
                      {analysis.search_intent_analysis && (
                        <p className="text-xs text-foreground/80">{analysis.search_intent_analysis}</p>
                      )}

                      {/* Keyword Clusters */}
                      {analysis.keyword_clusters?.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Keyword Clusters</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {analysis.keyword_clusters.slice(0, 4).map((cluster, i) => (
                              <div key={i} className="bg-white dark:bg-background/50 rounded-lg p-2.5 border border-border/50">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-semibold">{cluster.cluster_name}</span>
                                  <IntentBadge intent={cluster.intent} />
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {cluster.keywords?.slice(0, 4).map((kw, j) => (
                                    <span key={j} className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">{kw}</span>
                                  ))}
                                </div>
                                <div className="flex gap-2 mt-1.5">
                                  <span className="text-[10px] text-muted-foreground">Vol: <span className="font-medium capitalize">{cluster.estimated_volume}</span></span>
                                  <span className="text-[10px] text-muted-foreground">Comp: <span className="font-medium capitalize">{cluster.competition}</span></span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Quick Wins */}
                      {analysis.quick_wins?.length > 0 && (
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">Quick Wins</p>
                          <ul className="space-y-1">
                            {analysis.quick_wins.map((win, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-xs">
                                <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                                {win}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Suggestions preview */}
                      {(analysis.suggested_title || analysis.suggested_description) && (
                        <div className="space-y-1">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">AI Suggestions</p>
                          {analysis.suggested_title && <p className="text-xs"><span className="font-medium">Title:</span> {analysis.suggested_title}</p>}
                          {analysis.suggested_description && <p className="text-xs"><span className="font-medium">Desc:</span> {analysis.suggested_description}</p>}
                          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => {
                            setForm(f => ({
                              ...f,
                              title: analysis.suggested_title || f.title,
                              description: analysis.suggested_description || f.description,
                              og_title: analysis.suggested_og_title || f.og_title,
                              og_description: analysis.suggested_og_description || f.og_description,
                              keywords: inputKeywords || f.keywords,
                              focus_keywords: analysis.focus_keywords || f.focus_keywords,
                            }));
                            toast.success("Suggestions diterapkan!");
                          }}>
                            <Check className="w-3 h-3 mr-1" />Apply Suggestions
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* SEO Fields Editor */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">SEO Fields</h3>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {/* Title */}
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Title Tag *</Label>
                  <CharCounter value={form.title} {...CHAR_LIMITS.title} />
                </div>
                <Input
                  className="mt-1 font-mono text-sm"
                  placeholder="Contoh: The Coffeeshop Coffee & Dining Bandung | FnB Group"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  data-testid="seo-title-input"
                />
                <p className="text-[11px] text-muted-foreground mt-0.5">Ideal: 50–60 karakter (tampil di tab browser & SERP)</p>
              </div>

              {/* Meta Description */}
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Meta Description *</Label>
                  <CharCounter value={form.description} {...CHAR_LIMITS.description} />
                </div>
                <Textarea
                  className="mt-1 font-mono text-sm resize-none"
                  rows={3}
                  placeholder="Nikmati pengalaman kuliner premium FnB Group di Bandung. Dari specialty coffee hingga fine dining..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  data-testid="seo-description-input"
                />
                <p className="text-[11px] text-muted-foreground mt-0.5">Ideal: 148–160 karakter (tampil di SERP snippet)</p>
              </div>

              {/* Keywords */}
              <div>
                <Label className="text-xs">Meta Keywords</Label>
                <Input
                  className="mt-1 font-mono text-sm"
                  placeholder="restoran bandung, cafe premium bandung, fine dining bandung..."
                  value={form.keywords}
                  onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}
                  data-testid="seo-meta-keywords"
                />
              </div>

              <hr className="border-border/50" />

              {/* OG Title */}
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">OG Title (Social)</Label>
                  <CharCounter value={form.og_title} {...CHAR_LIMITS.og_title} />
                </div>
                <Input
                  className="mt-1 font-mono text-sm"
                  placeholder="OG title untuk social sharing (lebih engaging dari title tag)"
                  value={form.og_title}
                  onChange={e => setForm(f => ({ ...f, og_title: e.target.value }))}
                  data-testid="seo-og-title"
                />
              </div>

              {/* OG Description */}
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">OG Description (Social)</Label>
                  <CharCounter value={form.og_description} {...CHAR_LIMITS.og_description} />
                </div>
                <Textarea
                  className="mt-1 font-mono text-sm resize-none"
                  rows={2}
                  placeholder="OG description untuk social media preview"
                  value={form.og_description}
                  onChange={e => setForm(f => ({ ...f, og_description: e.target.value }))}
                  data-testid="seo-og-description"
                />
              </div>

              {/* OG Image URL */}
              <div>
                <Label className="text-xs">OG Image URL</Label>
                <Input
                  className="mt-1 font-mono text-xs"
                  placeholder="https://... (1200×630px recommended)"
                  value={form.og_image}
                  onChange={e => setForm(f => ({ ...f, og_image: e.target.value }))}
                  data-testid="seo-og-image"
                />
              </div>

              {/* Canonical + noindex */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Canonical Path</Label>
                  <Input
                    className="mt-1 font-mono text-sm"
                    value={form.canonical_path}
                    onChange={e => setForm(f => ({ ...f, canonical_path: e.target.value }))}
                  />
                </div>
                <div className="flex items-end gap-2 pb-0.5">
                  <input
                    type="checkbox"
                    id="noindex"
                    checked={form.noindex}
                    onChange={e => setForm(f => ({ ...f, noindex: e.target.checked }))}
                    className="w-4 h-4 rounded"
                  />
                  <Label htmlFor="noindex" className="text-xs cursor-pointer">
                    Noindex (hindari indexing halaman ini)
                  </Label>
                </div>
              </div>

              {/* Focus keywords (tags) */}
              {form.focus_keywords?.length > 0 && (
                <div>
                  <Label className="text-xs">Focus Keywords (dari AI)</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {form.focus_keywords.map((kw, i) => (
                      <span key={i} className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full text-xs flex items-center gap-1">
                        {kw}
                        <button onClick={() => setForm(f => ({ ...f, focus_keywords: f.focus_keywords.filter((_, j) => j !== i) }))}>
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Preview */}
          <div className="glass-card p-5">
            <button
              className="flex items-center justify-between w-full mb-3"
              onClick={() => setShowPreview(v => !v)}
            >
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">Preview</h3>
              </div>
              {showPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showPreview && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <SerpPreview title={form.title} description={form.description} path={selected.path} />
                <OgPreview
                  ogTitle={form.og_title || form.title}
                  ogDescription={form.og_description || form.description}
                  ogImage={form.og_image}
                  pageName={selected.page_name}
                />
              </div>
            )}
          </div>

          {/* JSON-LD info */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Structured Data (JSON-LD)</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              JSON-LD schema (Organization, LocalBusiness, Restaurant) sudah otomatis diterapkan
              di setiap halaman publik berdasarkan tipe konten. Untuk override custom, hubungi developer.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {["Organization", "WebSite", "Restaurant", "LocalBusiness", "BreadcrumbList"].map(s => (
                <span key={s} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-medium">
                  ✓ {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Bulk Optimize Dialog ─── */}
      <BulkOptimizeDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        pages={PUBLIC_PAGES}
        seoMap={seoMap}
        onComplete={() => {
          // Refresh map from server to reflect newly saved settings
          api.get("/seo/pages").then(r => {
            const map = {};
            (r.data?.data || []).forEach(d => { map[d.path] = d; });
            setSeoMap(map);
          }).catch(() => {});
        }}
      />
    </div>
  );
}
