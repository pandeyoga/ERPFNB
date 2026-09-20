/** PeriodClosingWizard — 8-step closing checklist with run-checks, close/lock action. */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, CheckCircle2, AlertTriangle, XCircle, Info, RefreshCw,
  Lock, ExternalLink, ListChecks, ChevronRight, Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import StatusPill from "@/components/shared/StatusPill";
import LoadingState from "@/components/shared/LoadingState";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function PeriodClosingWizard() {
  const { period } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const [confirmDlg, setConfirmDlg] = useState(null); // 'close' | 'lock'
  const [reason, setReason] = useState("");
  const [acting, setActing] = useState(false);
  const [taxSettlement, setTaxSettlement] = useState(null);
  const [taxPreview, setTaxPreview] = useState(null);
  const [loadingTax, setLoadingTax] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get(`/finance/periods/${period}/closing-checks`);
      setData(unwrap(res));
    } catch {
      toast.error("Gagal load checklist");
    } finally { setLoading(false); }
  }
  
  async function loadTaxSettlement() {
    if (data?.current_status === "open") {
      // Load preview (what WILL be settled)
      setLoadingTax(true);
      try {
        const res = await api.get(`/finance/periods/${period}/tax-settlement/preview`);
        setTaxPreview(unwrap(res));
      } catch {
        // Silent fail
      } finally { setLoadingTax(false); }
      return;
    }
    // Already closed/locked — load actual settlement JE
    setLoadingTax(true);
    try {
      const res = await api.get(`/finance/periods/${period}/tax-settlement`);
      setTaxSettlement(unwrap(res));
    } catch {
      // Silent fail - tax settlement may not exist
    } finally { setLoadingTax(false); }
  }
  
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [period]);
  useEffect(() => { if (data) loadTaxSettlement(); /* eslint-disable-next-line */ }, [data?.current_status]);

  async function doAction(kind) {
    try {
      setActing(true);
      await api.post(`/finance/periods/${period}/${kind}`, { reason: reason.trim() || `${kind} via wizard` });
      toast.success(kind === "close" ? `Period ${period} closed` : `Period ${period} locked`);
      setConfirmDlg(null); setReason("");
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || `Gagal ${kind}`);
    } finally { setActing(false); }
  }

  const checks = data?.checks || [];
  const summary = data?.summary || {};
  const cur = data?.current_status || "open";
  const isLocked = cur === "locked";

  const progressPct = useMemo(() => {
    if (!checks.length) return 0;
    const ok = checks.filter(c => c.status === "ok" || c.status === "info").length;
    return Math.round((ok / checks.length) * 100);
  }, [checks]);

  const active = checks[activeIdx];

  return (
    <div data-testid="closing-wizard-page" className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div data-testid="wiz-header" className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" onClick={() => navigate("/finance/periods")} className="rounded-full gap-2" data-testid="wiz-back">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>
        <h2 className="text-xl font-bold">Closing Wizard · {period}</h2>
        <StatusPill status={cur} />
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" onClick={load} disabled={loading} className="rounded-full gap-2 h-9" data-testid="wiz-refresh">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Run Checks
          </Button>
          {!isLocked && can("finance.period.close_step") && cur === "open" && (
            <Button variant="outline" onClick={() => { setConfirmDlg("close"); setReason(""); }}
              disabled={!summary.ready_to_close} className="rounded-full gap-2 h-9" data-testid="wiz-close">
              Close Period
            </Button>
          )}
          {!isLocked && can("finance.period.lock") && (
            <Button onClick={() => { setConfirmDlg("lock"); setReason(""); }}
              disabled={!summary.ready_to_lock} className="pill-active rounded-full gap-2 h-9" data-testid="wiz-lock">
              <Lock className="h-4 w-4" /> Lock Period
            </Button>
          )}
        </div>
      </div>

      {/* Progress strip */}
      <div data-testid="wiz-progress-strip" className="glass-card p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
        <ProgressTile label="Checks ok"
          value={`${progressPct}%`}
          hint={`${checks.filter(c => c.status === "ok" || c.status === "info").length}/${checks.length}`}
          tone="emerald" />
        <ProgressTile label="Warnings" value={summary.warnings ?? 0} hint="non-blocking" tone="amber" />
        <ProgressTile label="Blockers" value={summary.blockers ?? 0} hint="must-fix" tone={summary.blockers ? "red" : "emerald"} />
        <ProgressTile label="Period status" value={cur} hint={summary.ready_to_lock ? "siap lock" : "belum siap"} tone={isLocked ? "red" : (summary.ready_to_lock ? "emerald" : "amber")} />
      </div>

      {/* Tax Settlement Preview (before closing) */}
      {cur === "open" && taxPreview && (
        <div className={`glass-card p-5 border-l-4 ${taxPreview.will_create ? "border-l-amber-500" : "border-l-slate-400"}`}
          data-testid="tax-settlement-preview">
          <div className="flex items-start gap-3">
            <Sparkles className={`h-5 w-5 mt-0.5 ${taxPreview.will_create ? "text-amber-500" : "text-muted-foreground"}`} />
            <div className="flex-1">
              <h3 className="font-semibold text-sm">Tax Settlement Preview</h3>
              {taxPreview.will_create ? (
                <>
                  <p className="text-xs text-muted-foreground mt-1">
                    Saat Close Period, JE settlement PPN akan dibuat otomatis:
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                    <div className="rounded-lg bg-muted p-2 text-center">
                      <div className="text-muted-foreground">PPN Keluaran (Output)</div>
                      <div className="font-bold text-base mt-0.5">
                        Rp {(taxPreview.ppn_out || 0).toLocaleString("id-ID")}
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted p-2 text-center">
                      <div className="text-muted-foreground">PPN Masukan (Input)</div>
                      <div className="font-bold text-base mt-0.5">
                        Rp {(taxPreview.ppn_in || 0).toLocaleString("id-ID")}
                      </div>
                    </div>
                    <div className={`rounded-lg p-2 text-center ${
                      (taxPreview.ppn_payable || 0) >= 0
                        ? "bg-amber-50 dark:bg-amber-950/20"
                        : "bg-green-50 dark:bg-green-950/20"
                    }`}>
                      <div className="text-muted-foreground">PPN {(taxPreview.ppn_payable || 0) >= 0 ? "Terutang" : "Lebih Bayar"}</div>
                      <div className={`font-bold text-base mt-0.5 ${
                        (taxPreview.ppn_payable || 0) >= 0 ? "text-amber-700 dark:text-amber-400" : "text-green-700 dark:text-green-400"
                      }`}>
                        Rp {Math.abs(taxPreview.ppn_payable || 0).toLocaleString("id-ID")}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  {taxPreview.ppn_enabled === false
                    ? "PPN tidak aktif — tidak ada settlement JE yang akan dibuat."
                    : taxPreview.reason || "Tidak ada data PPN untuk periode ini."}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tax Settlement Info (if closed/locked) */}
      {(cur === "closed" || cur === "locked") && taxSettlement && (
        <div className="glass-card p-5 border-l-4 border-l-blue-500">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-blue-500 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-sm">Tax Settlement Auto-Generated</h3>
              <p className="text-xs text-muted-foreground mt-1">
                JE {taxSettlement.je_number} telah dibuat otomatis untuk settlement PPN periode {period}
              </p>
              <div className="mt-3 flex gap-3 flex-wrap text-xs">
                <div>
                  <span className="text-muted-foreground">Total Lines:</span>{" "}
                  <span className="font-semibold">{taxSettlement.lines?.length || 0}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  <StatusPill status={taxSettlement.status} size="sm" />
                </div>
                <div>
                  <span className="text-muted-foreground">Posted:</span>{" "}
                  <span className="font-semibold">
                    {taxSettlement.posted_at ? new Date(taxSettlement.posted_at).toLocaleDateString("id-ID") : "-"}
                  </span>
                </div>
              </div>
              <Link 
                to={`/finance/journal/${taxSettlement.id}`}
                className="inline-flex items-center gap-1 mt-3 text-xs text-blue-600 hover:underline"
              >
                Lihat Detail JE <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Steps + Detail */}
      {loading ? <LoadingState rows={6} /> : (
        <div data-testid="wiz-steps-container" className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Sidebar */}
          <div data-testid="wiz-checklist-sidebar" className="glass-card p-3 lg:col-span-1">
            <div className="flex items-center gap-2 px-2 py-1.5 text-xs uppercase tracking-wide text-muted-foreground font-semibold">
              <ListChecks className="h-3.5 w-3.5" /> 8-Step Checklist
            </div>
            <div className="space-y-1">
              {checks.map((c, i) => (
                <button key={c.id}
                  onClick={() => setActiveIdx(i)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-colors",
                    activeIdx === i ? "bg-foreground/5" : "hover:bg-foreground/5",
                  )}
                  data-testid={`wiz-step-${c.id}`}>
                  <CheckIcon status={c.status} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate">{i + 1}. {c.label}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{c.detail}</div>
                  </div>
                  {activeIdx === i && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              ))}
            </div>
          </div>

          {/* Main */}
          <div data-testid="wiz-step-detail" className="lg:col-span-2 space-y-4">
            <AnimatePresence mode="wait">
              {active && (
                <motion.div
                  key={active.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="glass-card p-6">
                  <div className="flex items-start gap-3">
                    <CheckIcon status={active.status} large />
                    <div className="flex-1">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Step {activeIdx + 1} of {checks.length}</div>
                      <h3 className="text-lg font-bold mt-0.5">{active.label}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{active.detail}</p>
                      {active.blocker && active.status === "fail" && (
                        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/15 text-red-700 dark:text-red-400 text-xs font-semibold">
                          <AlertTriangle className="h-3.5 w-3.5" /> Blocker — wajib diselesaikan sebelum close/lock
                        </div>
                      )}
                      <div className="mt-4 flex gap-2 flex-wrap">
                        {active.fix_link && (
                          <Link to={active.fix_link}>
                            <Button variant="outline" className="rounded-full gap-2 h-9" data-testid="wiz-step-fix">
                              <ExternalLink className="h-3.5 w-3.5" /> Buka halaman terkait
                            </Button>
                          </Link>
                        )}
                        <Button variant="outline" onClick={load} className="rounded-full gap-2 h-9">
                          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Re-check
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Summary footer card */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-aurora-3" />
                <h3 className="font-semibold">Ringkasan & rekomendasi</h3>
              </div>
              {isLocked ? (
                <p className="text-sm text-muted-foreground">
                  Period {period} sudah <b>locked</b>. Untuk koreksi mendesak, gunakan tombol <i>Reopen</i> di halaman Periods (audit-trailed).
                </p>
              ) : summary.blockers ? (
                <p className="text-sm text-red-700 dark:text-red-400">
                  Ada <b>{summary.blockers}</b> blocker check. Selesaikan terlebih dahulu sebelum lock.
                </p>
              ) : summary.ready_to_lock ? (
                <p className="text-sm text-emerald-700 dark:text-emerald-400">
                  Semua blocker check OK. Period siap untuk <b>lock</b> ✅
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Re-check untuk melihat status terbaru.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      <Dialog open={!!confirmDlg} onOpenChange={(v) => !v && setConfirmDlg(null)}>
        <DialogContent data-testid="wiz-action-dialog" className="glass-card max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmDlg === "lock" ? "Lock" : "Close"} Period {period}?</DialogTitle>
            <DialogDescription>
              {confirmDlg === "lock"
                ? "Locked period akan menolak semua post journal (manual maupun otomatis). Reopen tetap dapat dilakukan dengan alasan tertulis."
                : "Closed period adalah soft-close. Anda masih dapat reopen tanpa konsekuensi sistem."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Catatan (opsional)</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Mis: closing reguler April 2026"
              className="glass-input min-h-[80px]" data-testid="wiz-action-reason" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDlg(null)} disabled={acting}>Batal</Button>
            <Button onClick={() => doAction(confirmDlg)} disabled={acting}
              className="pill-active" data-testid="wiz-action-confirm">
              {confirmDlg === "lock" ? "Lock Period" : "Close Period"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CheckIcon({ status, large = false }) {
  const size = large ? "h-9 w-9" : "h-7 w-7";
  const inner = large ? "h-4 w-4" : "h-3.5 w-3.5";
  if (status === "ok")    return <span className={`${size} rounded-full flex items-center justify-center bg-emerald-500/15 text-emerald-700 dark:text-emerald-400`}><CheckCircle2 className={inner} /></span>;
  if (status === "warn")  return <span className={`${size} rounded-full flex items-center justify-center bg-amber-500/15 text-amber-700 dark:text-amber-400`}><AlertTriangle className={inner} /></span>;
  if (status === "fail")  return <span className={`${size} rounded-full flex items-center justify-center bg-red-500/15 text-red-700 dark:text-red-400`}><XCircle className={inner} /></span>;
  return <span className={`${size} rounded-full flex items-center justify-center bg-blue-500/15 text-blue-700 dark:text-blue-400`}><Info className={inner} /></span>;
}

function ProgressTile({ label, value, hint, tone = "emerald" }) {
  const toneCls = {
    emerald: "text-emerald-700 dark:text-emerald-400",
    amber:   "text-amber-700 dark:text-amber-400",
    red:     "text-red-700 dark:text-red-400",
  }[tone];
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold mt-0.5 ${toneCls}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}
