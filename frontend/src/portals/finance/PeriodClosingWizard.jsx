/** PeriodClosingWizard — 8-step closing checklist with run-checks, close/lock action. */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, CheckCircle2, AlertTriangle, XCircle, Info, RefreshCw,
  Lock, ExternalLink, ListChecks, ChevronRight, Sparkles, ShieldAlert, CalendarCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { promptDialog } from "@/components/shared/confirmDialog";
import StatusPill from "@/components/shared/StatusPill";
import LoadingState from "@/components/shared/LoadingState";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import { fmtRp } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Backend mengirim fix_link "/procurement/prs" (route tidak ada → redirect ke beranda Procurement).
 * Cek "PR/PO menunggu approval" diarahkan ke Pusat Persetujuan. */
const FIX_LINK_ALIASES = { "/procurement/prs": "/my-approvals" };
const fixLink = (l) => FIX_LINK_ALIASES[l] || l;

export default function PeriodClosingWizard() {
  const { period } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
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
      toast.error("Gagal memuat checklist closing");
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
    const isLock = kind === "lock";
    const note = await promptDialog({
      title: `${isLock ? "Kunci" : "Tutup"} periode ${period}?`,
      description: isLock
        ? "Periode terkunci akan menolak semua posting jurnal (manual maupun otomatis). Buka kembali tetap dapat dilakukan dengan alasan tertulis."
        : "Tutup periode adalah soft-close. Anda masih dapat membukanya kembali tanpa konsekuensi sistem.",
      label: "Catatan (opsional)",
      placeholder: "Mis: closing reguler April 2026",
      required: false,
      multiline: true,
      confirmText: isLock ? "Kunci periode" : "Tutup periode",
    });
    if (note === null) return; // dibatalkan
    try {
      setActing(true);
      await api.post(`/finance/periods/${period}/${kind}`, { reason: note || `${kind} via wizard` });
      toast.success(kind === "close" ? `Periode ${period} ditutup (soft-close)` : `Periode ${period} dikunci`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || (kind === "close" ? "Gagal menutup periode" : "Gagal mengunci periode"));
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
    <div data-testid="closing-wizard-page">
      <Button variant="ghost" size="sm" className="-ml-2 mb-1 text-muted-foreground"
        onClick={() => navigate("/finance/period-closing")} data-testid="wiz-back">
        <ArrowLeft /> Kembali ke Period Closing
      </Button>
      <PageHeader
        icon={ListChecks}
        testId="wiz-header"
        title={`Closing Wizard · ${period}`}
        subtitle="Checklist 8 langkah sebelum menutup (soft-close) atau mengunci periode"
        actions={(
          <>
            <Button variant="outline" onClick={load} disabled={loading} data-testid="wiz-refresh">
              <RefreshCw className={cn(loading && "animate-spin")} /> Jalankan cek
            </Button>
            {!isLocked && can("finance.period.close_step") && cur === "open" && (
              <Button variant="outline" onClick={() => doAction("close")}
                disabled={!summary.ready_to_close || acting} data-testid="wiz-close">
                Tutup periode
              </Button>
            )}
            {!isLocked && can("finance.period.lock") && (
              <Button onClick={() => doAction("lock")}
                disabled={!summary.ready_to_lock || acting} data-testid="wiz-lock">
                <Lock /> Kunci periode
              </Button>
            )}
          </>
        )}
      >
        <StatusPill status={cur} />
      </PageHeader>

      <div className="space-y-3 lg:space-y-4">
      {/* Progress strip */}
      <div data-testid="wiz-progress-strip" className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CompactStatCard size="sm" label="Cek OK" icon={CheckCircle2} color="aurora-4" tone="success"
          value={`${progressPct}%`}
          sub={`${checks.filter(c => c.status === "ok" || c.status === "info").length}/${checks.length} langkah`}
          testId="wiz-stat-ok" />
        <CompactStatCard size="sm" label="Peringatan" icon={AlertTriangle} color="aurora-5"
          tone={summary.warnings ? "warning" : "default"} value={summary.warnings ?? 0} sub="tidak memblokir" testId="wiz-stat-warnings" />
        <CompactStatCard size="sm" label="Blocker" icon={ShieldAlert} color="aurora-6"
          tone={summary.blockers ? "danger" : "success"} value={summary.blockers ?? 0} sub="wajib diselesaikan" testId="wiz-stat-blockers" />
        <CompactStatCard size="sm" label="Status periode" icon={CalendarCheck} color="aurora-1"
          tone={isLocked ? "danger" : (summary.ready_to_lock ? "success" : "warning")}
          value={<span className="capitalize">{cur}</span>}
          sub={isLocked ? "sudah dikunci" : summary.ready_to_lock ? "siap dikunci" : "belum siap"} testId="wiz-stat-status" />
      </div>

      {/* Tax Settlement Preview (before closing) */}
      {cur === "open" && taxPreview && (
        <div className={`glass-card p-4 border-l-4 ${taxPreview.will_create ? "border-l-amber-500" : "border-l-slate-400"}`}
          data-testid="tax-settlement-preview">
          <div className="flex items-start gap-3">
            <Sparkles className={`h-5 w-5 mt-0.5 ${taxPreview.will_create ? "text-amber-800 dark:text-amber-400" : "text-muted-foreground"}`} />
            <div className="flex-1">
              <h3 className="text-sm md:text-base font-semibold">Preview Tax Settlement</h3>
              {taxPreview.will_create ? (
                <>
                  <p className="text-xs text-muted-foreground mt-1">
                    Saat periode ditutup, JE settlement PPN akan dibuat otomatis:
                  </p>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="rounded-lg bg-muted p-2 text-center">
                      <div className="text-muted-foreground">PPN Keluaran (Output)</div>
                      <div className="font-semibold text-base mt-0.5 tabular-nums">
                        {fmtRp(taxPreview.ppn_out || 0)}
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted p-2 text-center">
                      <div className="text-muted-foreground">PPN Masukan (Input)</div>
                      <div className="font-semibold text-base mt-0.5 tabular-nums">
                        {fmtRp(taxPreview.ppn_in || 0)}
                      </div>
                    </div>
                    <div className={`rounded-lg p-2 text-center ${
                      (taxPreview.ppn_payable || 0) >= 0
                        ? "bg-amber-50 dark:bg-amber-950/20"
                        : "bg-green-50 dark:bg-green-950/20"
                    }`}>
                      <div className="text-muted-foreground">PPN {(taxPreview.ppn_payable || 0) >= 0 ? "Terutang" : "Lebih Bayar"}</div>
                      <div className={`font-semibold text-base mt-0.5 tabular-nums ${
                        (taxPreview.ppn_payable || 0) >= 0 ? "text-amber-700 dark:text-amber-400" : "text-green-700 dark:text-green-400"
                      }`}>
                        {fmtRp(Math.abs(taxPreview.ppn_payable || 0))}
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
        <div className="glass-card p-4 border-l-4 border-l-blue-500" data-testid="tax-settlement-info">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-blue-700 dark:text-blue-400 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm md:text-base font-semibold">Tax Settlement dibuat otomatis</h3>
              <p className="text-xs text-muted-foreground mt-1">
                JE {taxSettlement.je_number || taxSettlement.doc_no} telah dibuat otomatis untuk settlement PPN periode {period}
              </p>
              <div className="mt-3 flex gap-3 flex-wrap text-xs">
                <div>
                  <span className="text-muted-foreground">Jumlah baris:</span>{" "}
                  <span className="font-semibold">{taxSettlement.lines?.length || 0}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  <StatusPill status={taxSettlement.status} size="sm" />
                </div>
                <div>
                  <span className="text-muted-foreground">Diposting:</span>{" "}
                  <span className="font-semibold">
                    {taxSettlement.posted_at ? new Date(taxSettlement.posted_at).toLocaleDateString("id-ID") : "-"}
                  </span>
                </div>
              </div>
              <Link
                to={`/finance/journals/${taxSettlement.id}`}
                className="inline-flex items-center gap-1 mt-3 text-xs text-blue-700 dark:text-blue-400 hover:underline"
                data-testid="tax-settlement-je-link"
              >
                Lihat detail JE <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Steps + Detail */}
      {loading ? <LoadingState rows={6} /> : (
        <div data-testid="wiz-steps-container" className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
          {/* Sidebar */}
          <div data-testid="wiz-checklist-sidebar" className="glass-card p-3 lg:col-span-1">
            <h3 className="flex items-center gap-2 px-2 py-1.5 text-sm font-semibold">
              <ListChecks className="h-3.5 w-3.5 text-muted-foreground" /> Checklist {checks.length} langkah
            </h3>
            <div className="space-y-1">
              {checks.map((c, i) => (
                <button key={c.id} type="button"
                  onClick={() => setActiveIdx(i)}
                  aria-current={activeIdx === i ? "step" : undefined}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-colors",
                    activeIdx === i ? "bg-foreground/5" : "hover:bg-foreground/5",
                  )}
                  data-testid={`wiz-step-${c.id}`}>
                  <CheckIcon status={c.status} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate">{i + 1}. {c.label}</div>
                    <div className="text-xs text-muted-foreground truncate">{c.detail}</div>
                  </div>
                  {activeIdx === i && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              ))}
            </div>
          </div>

          {/* Main */}
          <div data-testid="wiz-step-detail" className="lg:col-span-2 space-y-3 lg:space-y-4">
            <AnimatePresence mode="wait">
              {active && (
                <motion.div
                  key={active.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="glass-card p-4">
                  <div className="flex items-start gap-3">
                    <CheckIcon status={active.status} large />
                    <div className="flex-1">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Langkah {activeIdx + 1} dari {checks.length}</div>
                      <h3 className="text-sm md:text-base font-semibold mt-0.5">{active.label}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{active.detail}</p>
                      {active.blocker && active.status === "fail" && (
                        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/15 text-red-800 dark:text-red-400 text-xs font-semibold">
                          <AlertTriangle className="h-3.5 w-3.5" /> Blocker — wajib diselesaikan sebelum close/lock
                        </div>
                      )}
                      <div className="mt-3 flex gap-2 flex-wrap">
                        {active.fix_link && (
                          <Button variant="outline" size="sm" asChild>
                            <Link to={fixLink(active.fix_link)} data-testid="wiz-step-fix">
                              <ExternalLink /> Buka halaman terkait
                            </Link>
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={load} data-testid="wiz-step-recheck">
                          <RefreshCw className={cn(loading && "animate-spin")} /> Cek ulang
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Summary footer card */}
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-aurora-3" />
                <h3 className="text-sm md:text-base font-semibold">Ringkasan &amp; rekomendasi</h3>
              </div>
              {isLocked ? (
                <p className="text-sm text-muted-foreground">
                  Periode {period} sudah <b>dikunci</b>. Untuk koreksi mendesak, gunakan tombol <i>Buka kembali</i> di Period Closing → Fase 1 (tercatat di audit log).
                </p>
              ) : summary.blockers ? (
                <p className="text-sm text-red-700 dark:text-red-400">
                  Ada <b>{summary.blockers}</b> cek blocker. Selesaikan terlebih dahulu sebelum mengunci periode.
                </p>
              ) : summary.ready_to_lock ? (
                <p className="text-sm text-emerald-700 dark:text-emerald-400">
                  Semua cek blocker OK. Periode siap untuk <b>dikunci</b>.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Klik Cek ulang untuk melihat status terbaru.</p>
              )}
            </div>
          </div>
        </div>
      )}
      </div>

    </div>
  );
}

function CheckIcon({ status, large = false }) {
  const size = large ? "h-9 w-9" : "h-7 w-7";
  const inner = large ? "h-4 w-4" : "h-3.5 w-3.5";
  if (status === "ok")    return <span className={`${size} rounded-full flex items-center justify-center bg-emerald-500/15 text-emerald-800 dark:text-emerald-400`}><CheckCircle2 className={inner} /></span>;
  if (status === "warn")  return <span className={`${size} rounded-full flex items-center justify-center bg-amber-500/15 text-amber-800 dark:text-amber-400`}><AlertTriangle className={inner} /></span>;
  if (status === "fail")  return <span className={`${size} rounded-full flex items-center justify-center bg-red-500/15 text-red-800 dark:text-red-400`}><XCircle className={inner} /></span>;
  return <span className={`${size} rounded-full flex items-center justify-center bg-blue-500/15 text-blue-800 dark:text-blue-400`}><Info className={inner} /></span>;
}
