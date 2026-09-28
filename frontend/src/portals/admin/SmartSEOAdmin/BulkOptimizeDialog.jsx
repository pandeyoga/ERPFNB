/**
 * BulkOptimizeDialog — batch AI SEO optimizer for all public pages.
 *
 * Flow:
 *  1) Admin picks filter (all / empty / no-ai) + mode (full / fast)
 *  2) Frontend loops sequentially, calling /api/seo/ai/generate per page,
 *     then POST /api/seo/pages to persist.
 *  3) Live per-page progress is rendered with status icons.
 *  4) Admin can cancel mid-flow (graceful stop) or retry failed pages.
 *
 * Notes:
 *  - We orchestrate from the frontend for live UX & easy cancel.
 *  - Backend endpoints are reused; no new server route required.
 */
import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import {
  Sparkles, Zap, X, Check, AlertCircle, Loader2, Play,
  RefreshCw, ListChecks, Filter, BadgeCheck, RotateCcw,
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  RadioGroup, RadioGroupItem,
} from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";

// ─── Status enum ───────────────────────────────────────────────────────────────
const STATUS = {
  IDLE:       "idle",
  QUEUED:     "queued",
  PROCESSING: "processing",
  DONE:       "done",
  FAILED:     "failed",
  SKIPPED:    "skipped",
  CANCELLED:  "cancelled",
};

const FILTER_OPTIONS = [
  { value: "all",   label: "Semua halaman",          desc: "Optimize semua halaman publik (timpa yang sudah ada)" },
  { value: "empty", label: "Halaman tanpa SEO",       desc: "Hanya yang belum punya pengaturan SEO" },
  { value: "no-ai", label: "Halaman tanpa AI analysis", desc: "Belum pernah diproses AI sebelumnya" },
];

const MODE_OPTIONS = [
  { value: "fast", label: "Cepat",   desc: "AI Generate + Save (skip keyword analysis)", icon: Zap },
  { value: "full", label: "Lengkap", desc: "AI Analyze + Generate + Save (rekomendasi)", icon: Sparkles },
];

// Auto-derive keywords from page meta when user has nothing saved
function deriveKeywords(page, globalSeed) {
  const seed = (globalSeed || "").trim();
  const seedList = seed ? seed.split(",").map(s => s.trim()).filter(Boolean) : [];
  const base = [
    page.page_name.toLowerCase(),
    `${page.page_name.toLowerCase()} bandung`,
    "fnbgroup group",
    ...seedList,
  ];
  // Dedupe while preserving order
  return Array.from(new Set(base)).slice(0, 6).join(", ");
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function BulkOptimizeDialog({
  open,
  onOpenChange,
  pages,       // PUBLIC_PAGES array
  seoMap,      // current saved SEO by path
  onComplete,  // (results) => void   called when batch finishes
}) {
  const [filter, setFilter]         = useState("all");
  const [mode, setMode]             = useState("full");
  const [globalSeed, setGlobalSeed] = useState("fnb bandung, restoran premium bandung");
  const [running, setRunning]       = useState(false);
  const [finished, setFinished]     = useState(false);
  const [statusMap, setStatusMap]   = useState({}); // path → { status, message }
  const [currentPath, setCurrentPath] = useState(null);

  const cancelRef = useRef(false);

  // Reset state whenever dialog re-opens
  useEffect(() => {
    if (open) {
      setStatusMap({});
      setCurrentPath(null);
      setRunning(false);
      setFinished(false);
      cancelRef.current = false;
    }
  }, [open]);

  // ─── Filtered pages ─────────────────────────────────────────────────────────
  const filteredPages = useMemo(() => {
    if (!pages) return [];
    if (filter === "empty") {
      return pages.filter(p => !seoMap[p.path]);
    }
    if (filter === "no-ai") {
      return pages.filter(p => !seoMap[p.path]?.ai_analysis);
    }
    return pages;
  }, [pages, seoMap, filter]);

  // ─── Progress stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const values = Object.values(statusMap);
    const done   = values.filter(v => v.status === STATUS.DONE).length;
    const failed = values.filter(v => v.status === STATUS.FAILED).length;
    const aiCount = values.filter(v => v.status === STATUS.DONE && v.aiPowered).length;
    const total  = filteredPages.length;
    const pct    = total > 0 ? Math.round(((done + failed) / total) * 100) : 0;
    return { done, failed, total, pct, aiCount };
  }, [statusMap, filteredPages]);

  // ─── Update one page status (live) ──────────────────────────────────────────
  const setPageStatus = useCallback((path, status, message = "", aiPowered = null) => {
    setStatusMap(prev => ({ ...prev, [path]: { status, message, aiPowered } }));
  }, []);

  // ─── Process one page ───────────────────────────────────────────────────────
  const PER_CALL_TIMEOUT_MS = 45000;  // 45s per LLM call; matches frontend axios timeout

  const processPage = useCallback(async (page) => {
    setPageStatus(page.path, STATUS.PROCESSING, "AI sedang memproses...");
    setCurrentPath(page.path);

    const existing = seoMap[page.path] || {};
    const baseKeywords = existing.keywords || deriveKeywords(page, globalSeed);

    let analysis = existing.ai_analysis || null;

    try {
      // 1) Optional: run AI Analyze first (full mode)
      if (mode === "full") {
        try {
          const analyzeRes = await api.post("/seo/ai/analyze", {
            path: page.path,
            page_key: page.page_key,
            page_name: page.page_name,
            keywords: baseKeywords,
            page_context: page.context,
          }, { timeout: PER_CALL_TIMEOUT_MS });
          analysis = analyzeRes.data?.data || analysis;
        } catch (e) {
          // Non-fatal — continue to generate
          console.warn(`[BulkOptimize] analyze failed for ${page.path}:`, e);
        }
      }

      // 2) AI Generate
      const genRes = await api.post("/seo/ai/generate", {
        path: page.path,
        page_key: page.page_key,
        page_name: page.page_name,
        keywords: baseKeywords,
        intent: analysis?.primary_intent || null,
        suggestions: analysis?.keyword_clusters || null,
        page_context: page.context,
      }, { timeout: PER_CALL_TIMEOUT_MS });
      const gen = genRes.data?.data;
      if (!gen) {
        throw new Error("Tidak ada konten yang dihasilkan AI");
      }
      const aiPowered = genRes.data?.meta?.ai_powered === true;

      // 3) Save to DB
      await api.post("/seo/pages", {
        path: page.path,
        page_key: page.page_key,
        title: gen.title || existing.title || "",
        description: gen.description || existing.description || "",
        og_title: gen.og_title || existing.og_title || "",
        og_description: gen.og_description || existing.og_description || "",
        og_image: existing.og_image || "",
        keywords: baseKeywords,
        focus_keywords: gen.focus_keywords || existing.focus_keywords || [],
        canonical_path: existing.canonical_path || page.path,
        noindex: existing.noindex || false,
        notes: existing.notes || "",
        ai_analysis: analysis || null,
      }, { timeout: 10000 });

      const msg = aiPowered ? "AI-powered" : "Template dasar";
      setPageStatus(page.path, STATUS.DONE, msg, aiPowered);
      return { ok: true, page, aiPowered };
    } catch (err) {
      const isTimeout = err?.code === "ECONNABORTED" || /timeout/i.test(err?.message || "");
      const message = isTimeout
        ? `Timeout >${Math.round(PER_CALL_TIMEOUT_MS / 1000)}s`
        : (err?.response?.data?.detail || err?.message || "Gagal");
      setPageStatus(page.path, STATUS.FAILED, message);
      return { ok: false, page, error: message };
    }
  }, [mode, globalSeed, seoMap, setPageStatus]);

  // ─── Run the batch ─────────────────────────────────────────────────────────
  const runBatch = useCallback(async (targetPages) => {
    cancelRef.current = false;
    setRunning(true);
    setFinished(false);

    // Initialize all to QUEUED
    const initial = {};
    targetPages.forEach(p => {
      initial[p.path] = { status: STATUS.QUEUED, message: "Menunggu giliran..." };
    });
    setStatusMap(initial);

    const results = [];

    for (const page of targetPages) {
      if (cancelRef.current) {
        setPageStatus(page.path, STATUS.CANCELLED, "Dibatalkan oleh user");
        results.push({ ok: false, page, error: "cancelled" });
        continue;
      }
      const r = await processPage(page);
      results.push(r);
    }

    setRunning(false);
    setFinished(true);
    setCurrentPath(null);

    const okCount = results.filter(r => r.ok).length;
    const failCount = results.filter(r => !r.ok).length;
    if (failCount === 0) {
      toast.success(`Bulk optimize selesai — ${okCount} halaman dioptimasi`);
    } else if (okCount > 0) {
      toast.warning(`Selesai dengan ${failCount} kegagalan dari ${results.length} halaman`);
    } else {
      toast.error("Bulk optimize gagal — silakan coba lagi");
    }
    onComplete?.(results);
  }, [processPage, setPageStatus, onComplete]);

  // ─── Start / Cancel / Retry ─────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    if (filteredPages.length === 0) {
      toast.error("Tidak ada halaman yang sesuai dengan filter");
      return;
    }
    runBatch(filteredPages);
  }, [filteredPages, runBatch]);

  const handleCancel = useCallback(() => {
    cancelRef.current = true;
    toast.info("Membatalkan... menunggu halaman aktif selesai");
  }, []);

  const handleRetryFailed = useCallback(() => {
    const failedPaths = Object.entries(statusMap)
      .filter(([, v]) => v.status === STATUS.FAILED)
      .map(([k]) => k);
    const retryList = filteredPages.filter(p => failedPaths.includes(p.path));
    if (retryList.length === 0) {
      toast.info("Tidak ada halaman gagal untuk di-retry");
      return;
    }
    runBatch(retryList);
  }, [statusMap, filteredPages, runBatch]);

  const handleClose = useCallback(() => {
    if (running) {
      // Force cancel + close
      cancelRef.current = true;
    }
    onOpenChange?.(false);
  }, [running, onOpenChange]);

  // ─── Render helpers ─────────────────────────────────────────────────────────
  const renderStatusIcon = (status) => {
    switch (status) {
      case STATUS.DONE:
        return <Check className="w-4 h-4 text-emerald-500" />;
      case STATUS.FAILED:
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case STATUS.PROCESSING:
        return <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />;
      case STATUS.CANCELLED:
        return <X className="w-4 h-4 text-amber-500" />;
      case STATUS.QUEUED:
        return <div className="w-2 h-2 rounded-full bg-amber-400 mx-1" />;
      default:
        return <div className="w-2 h-2 rounded-full bg-muted mx-1" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        data-testid="bulk-optimize-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            Bulk AI SEO Optimization
          </DialogTitle>
          <DialogDescription>
            Optimasi semua halaman publik sekaligus dengan AI. Pilih cakupan, mode, lalu mulai.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-1 px-1">
          <div className="space-y-5 py-2">

            {/* ─── Filter selector ─── */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide flex items-center gap-1.5">
                <Filter className="w-3 h-3" /> Cakupan
              </Label>
              <RadioGroup
                value={filter}
                onValueChange={setFilter}
                disabled={running}
                className="grid grid-cols-1 sm:grid-cols-3 gap-2"
                data-testid="bulk-filter-group"
              >
                {FILTER_OPTIONS.map(opt => (
                  <label
                    key={opt.value}
                    htmlFor={`filter-${opt.value}`}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border p-3 cursor-pointer transition-all",
                      filter === opt.value
                        ? "border-violet-400 bg-violet-50/50 dark:bg-violet-950/20"
                        : "border-border hover:border-foreground/30",
                      running && "opacity-60 cursor-not-allowed"
                    )}
                    data-testid={`bulk-filter-${opt.value}`}
                  >
                    <RadioGroupItem
                      value={opt.value}
                      id={`filter-${opt.value}`}
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold">{opt.label}</p>
                      <p className="text-[11px] text-muted-foreground leading-snug">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
              <p className="text-[11px] text-muted-foreground">
                <span className="font-semibold">{filteredPages.length}</span> halaman terpilih dari {pages?.length || 0} total
              </p>
            </div>

            {/* ─── Mode selector ─── */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide flex items-center gap-1.5">
                <Zap className="w-3 h-3" /> Mode AI
              </Label>
              <RadioGroup
                value={mode}
                onValueChange={setMode}
                disabled={running}
                className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                data-testid="bulk-mode-group"
              >
                {MODE_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  return (
                    <label
                      key={opt.value}
                      htmlFor={`mode-${opt.value}`}
                      className={cn(
                        "flex items-start gap-2 rounded-lg border p-3 cursor-pointer transition-all",
                        mode === opt.value
                          ? "border-violet-400 bg-violet-50/50 dark:bg-violet-950/20"
                          : "border-border hover:border-foreground/30",
                        running && "opacity-60 cursor-not-allowed"
                      )}
                      data-testid={`bulk-mode-${opt.value}`}
                    >
                      <RadioGroupItem
                        value={opt.value}
                        id={`mode-${opt.value}`}
                        className="mt-0.5"
                      />
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold flex items-center gap-1">
                          <Icon className="w-3 h-3 text-violet-500" />
                          {opt.label}
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-snug">{opt.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </RadioGroup>
            </div>

            {/* ─── Global keyword seed ─── */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide flex items-center gap-1.5" htmlFor="bulk-seed">
                <ListChecks className="w-3 h-3" /> Keyword Theme Global (opsional)
              </Label>
              <Input
                id="bulk-seed"
                value={globalSeed}
                onChange={e => setGlobalSeed(e.target.value)}
                disabled={running}
                placeholder="fnb bandung, kuliner premium..."
                className="font-mono text-sm"
                data-testid="bulk-global-seed"
              />
              <p className="text-[11px] text-muted-foreground">
                Akan ditambahkan ke keyword tiap halaman yang belum punya pengaturan.
              </p>
            </div>

            {/* ─── Progress + per-page list ─── */}
            {(running || finished) && (
              <div className="space-y-2" data-testid="bulk-progress">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">Progress</span>
                  <span className="text-muted-foreground">
                    {stats.done + stats.failed}/{stats.total} • {stats.pct}%
                  </span>
                </div>
                <Progress value={stats.pct} className="h-1.5" />
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-500" />
                    {stats.done} sukses
                  </span>
                  <span className="flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-red-500" />
                    {stats.failed} gagal
                  </span>
                  {stats.aiCount > 0 && (
                    <span className="flex items-center gap-1 text-violet-600 dark:text-violet-300">
                      <Sparkles className="w-3 h-3" />
                      {stats.aiCount} AI
                    </span>
                  )}
                </div>

                <div className="rounded-lg border border-border/60 max-h-64 overflow-y-auto divide-y divide-border/30">
                  {filteredPages.map(p => {
                    const s = statusMap[p.path] || { status: STATUS.IDLE };
                    const isCurrent = currentPath === p.path;
                    return (
                      <div
                        key={p.path}
                        className={cn(
                          "flex items-center justify-between gap-3 px-3 py-2 text-xs transition-colors",
                          isCurrent && "bg-violet-50 dark:bg-violet-950/20"
                        )}
                        data-testid={`bulk-progress-row-${p.page_key}`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="flex-shrink-0 w-5 flex justify-center">
                            {renderStatusIcon(s.status)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{p.page_name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono truncate">{p.path}</p>
                          </div>
                        </div>
                        {s.message && (
                          <span className={cn(
                            "text-[10px] truncate max-w-[180px] flex items-center gap-1",
                            s.status === STATUS.FAILED ? "text-red-500" :
                            s.status === STATUS.DONE
                              ? (s.aiPowered ? "text-violet-600 dark:text-violet-300 font-medium" : "text-emerald-600")
                              : "text-muted-foreground"
                          )}>
                            {s.status === STATUS.DONE && s.aiPowered && (
                              <Sparkles className="w-3 h-3 flex-shrink-0" />
                            )}
                            {s.message}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─── Summary card after finish ─── */}
            {finished && !running && (
              <div className={cn(
                "rounded-lg border p-3 flex items-start gap-3",
                stats.failed === 0
                  ? "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20"
                  : "border-amber-200 bg-amber-50/50 dark:bg-amber-950/20"
              )}>
                {stats.failed === 0 ? (
                  <BadgeCheck className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                )}
                <div className="text-xs">
                  <p className="font-semibold">
                    {stats.failed === 0
                      ? `Semua halaman berhasil dioptimasi (${stats.done}/${stats.total})`
                      : `Selesai dengan ${stats.failed} kegagalan`}
                  </p>
                  <p className="text-muted-foreground mt-0.5">
                    {stats.failed === 0
                      ? "Pengaturan SEO telah disimpan ke database & langsung aktif di website publik."
                      : "Klik 'Coba Lagi yang Gagal' untuk retry halaman yang gagal."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="border-t pt-3 mt-2">
          {!running && !finished && (
            <>
              <Button
                variant="outline"
                onClick={handleClose}
                data-testid="bulk-cancel-btn"
              >
                Batal
              </Button>
              <Button
                onClick={handleStart}
                disabled={filteredPages.length === 0}
                data-testid="bulk-start-btn"
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
              >
                <Play className="w-4 h-4 mr-1.5" />
                Mulai Optimasi ({filteredPages.length})
              </Button>
            </>
          )}

          {running && (
            <>
              <div className="flex-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Sedang memproses {stats.done + stats.failed + 1}/{stats.total}...
              </div>
              <Button
                variant="outline"
                onClick={handleCancel}
                data-testid="bulk-stop-btn"
              >
                <X className="w-4 h-4 mr-1.5" />
                Hentikan
              </Button>
            </>
          )}

          {finished && !running && (
            <>
              {stats.failed > 0 && (
                <Button
                  variant="outline"
                  onClick={handleRetryFailed}
                  data-testid="bulk-retry-btn"
                >
                  <RotateCcw className="w-4 h-4 mr-1.5" />
                  Coba Lagi yang Gagal ({stats.failed})
                </Button>
              )}
              <Badge variant="secondary" className="px-2 py-1 text-[11px]">
                {stats.done}/{stats.total} sukses
              </Badge>
              <Button
                onClick={handleClose}
                data-testid="bulk-done-btn"
              >
                <Check className="w-4 h-4 mr-1.5" />
                Selesai
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
