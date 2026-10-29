/** PeriodClosingHub — Phase D4 UX continuous workflow 2026-05-26.
 *
 * Finance period closing was previously scattered across 3 separate menu items:
 *   - Periods
 *   - Closing Wizard
 *   - Anomaly Feed
 *
 * This hub consolidates them into a single continuous workflow with vertical
 * phases. Users see the complete picture and can navigate forward/backward
 * without losing context.
 *
 * Phases:
 *   1. Periods         — review open/closed periods + reopen if needed
 *   2. Anomaly Check   — review flagged transactions before closing
 *   3. Closing Wizard  — step-by-step close (reconcile, lock, post adjustments)
 *   4. Locked Period   — confirmation + audit trail
 *
 * URL: /finance/period-closing
 *      /finance/period-closing?phase=2  (deep link)
 */
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Calendar, AlertTriangle, ClipboardCheck, Lock,
  ChevronRight, ChevronDown, ArrowRight, ArrowLeft, CircleDot, Circle, CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PeriodList from "./PeriodList";
import AnomalyFeed from "./AnomalyFeed";
import { InlineHelp } from "@/components/shared/InlineHelp";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";

const PHASES = [
  {
    id: "periods",
    name: "Review Periods",
    desc: "Lihat status periode (open / locked) dan buka kembali jika perlu penyesuaian historis",
    icon: Calendar,
    accent: "from-violet-500/20 to-violet-500/5",
    helpId: "period-status",
    render: () => <PeriodList embedded />,
  },
  {
    id: "anomaly",
    name: "Anomaly Check",
    desc: "Tinjau transaksi yang ditandai sistem sebelum closing (saldo negatif, GL tidak seimbang, vendor duplikat, dll.)",
    icon: AlertTriangle,
    accent: "from-amber-500/20 to-amber-500/5",
    helpId: "finance-period-anomaly",
    render: () => <AnomalyFeed embedded />,
  },
  {
    id: "wizard",
    name: "Closing Wizard",
    desc: "Rekonsiliasi bank, depresiasi, accrual, adjustment, hingga penguncian periode",
    icon: ClipboardCheck,
    accent: "from-emerald-500/20 to-emerald-500/5",
    helpId: "finance-period-closing-je",
    render: ({ goTo }) => <ClosingWizardPlaceholder goTo={goTo} />,
  },
  {
    id: "locked",
    name: "Lock & Audit Trail",
    desc: "Periode sudah dikunci — tinjau audit trail dan buat laporan closing",
    icon: Lock,
    accent: "from-rose-500/20 to-rose-500/5",
    helpId: "finance-period-lock",
    render: ({ goTo }) => <LockedPhasePlaceholder goTo={goTo} />,
  },
];

/** Fase 3/4 tidak punya konten sendiri: arahkan ke Fase 1 (daftar periode + tombol Wizard)
 * di halaman ini — bukan ke /finance/periods yang merupakan duplikat Fase 1. */
function ClosingWizardPlaceholder({ goTo }) {
  return (
    <div className="p-1">
      <EmptyState
        icon={ClipboardCheck}
        title="Jalankan Closing Wizard per periode"
        description="Pilih periode di Fase 1 lalu klik tombol Wizard pada baris periode yang ingin ditutup."
        action={(
          <Button variant="outline" size="sm" onClick={() => goTo(0)} data-testid="pc-goto-periods-from-wizard">
            Ke Fase 1: Review Periods <ArrowRight />
          </Button>
        )}
      />
    </div>
  );
}

function LockedPhasePlaceholder({ goTo }) {
  return (
    <div className="p-1">
      <EmptyState
        icon={Lock}
        title="Period Lock & Audit Trail"
        description="Setelah Closing Wizard selesai, periode akan terkunci otomatis. Status kunci & waktu penguncian terlihat di Fase 1."
        action={(
          <Button variant="outline" size="sm" onClick={() => goTo(0)} data-testid="pc-goto-periods-from-lock">
            Ke Fase 1: Review Periods <ArrowRight />
          </Button>
        )}
      />
    </div>
  );
}

export default function PeriodClosingHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPhase = Math.max(0, Math.min(PHASES.length - 1, Number(searchParams.get("phase") || 0)));
  const [activeIdx, setActiveIdx] = useState(initialPhase);
  const [completed, setCompleted] = useState(() => {
    try {
      const raw = localStorage.getItem("aurora_period_closing_progress");
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });

  // Pertahankan param lain (mis. ?id= dari Anomaly Feed di Fase 2) saat menyimpan fase aktif.
  useEffect(() => {
    setSearchParams((p) => {
      const n = new URLSearchParams(p);
      n.set("phase", String(activeIdx));
      return n;
    }, { replace: true });
  }, [activeIdx, setSearchParams]);

  useEffect(() => {
    try { localStorage.setItem("aurora_period_closing_progress", JSON.stringify(completed)); } catch { /* storage diblokir */ }
  }, [completed]);

  const markComplete = (idx) => setCompleted(c => ({ ...c, [PHASES[idx].id]: true }));
  const goNext = () => { markComplete(activeIdx); if (activeIdx < PHASES.length - 1) setActiveIdx(activeIdx + 1); };
  const goPrev = () => { if (activeIdx > 0) setActiveIdx(activeIdx - 1); };
  const allDone = PHASES.every(p => completed[p.id]);
  const doneCount = Object.keys(completed).filter(k => completed[k]).length;

  return (
    <div data-testid="period-closing-hub">
      <PageHeader
        icon={ClipboardCheck}
        title="Period Closing"
        subtitle="4 fase berurutan — Review Periods → Anomaly Check → Closing Wizard → Lock"
        actions={(
          <>
            {allDone && (
              <Badge variant="secondary" className="gap-1.5 text-emerald-800 dark:text-emerald-300 bg-emerald-500/15 border-emerald-500/30">
                <CheckCircle2 className="h-3.5 w-3.5" /> Period closing selesai
              </Badge>
            )}
            <InlineHelp id="period-status" placement="bottom-end" />
          </>
        )}
      >
        <div className="flex items-center gap-3 max-w-xl" data-testid="pc-progress">
          <div className="h-1.5 flex-1 rounded-full bg-foreground/10 overflow-hidden" role="progressbar"
            aria-valuemin={0} aria-valuemax={PHASES.length} aria-valuenow={doneCount} aria-label="Progres period closing">
            <motion.div className="h-full grad-aurora" initial={false}
              animate={{ width: `${(doneCount / PHASES.length) * 100}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }} />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
            {doneCount} / {PHASES.length} fase selesai
          </span>
        </div>
      </PageHeader>

      <div className="space-y-3">
        {PHASES.map((phase, idx) => {
          const Icon = phase.icon;
          const isActive = idx === activeIdx;
          const isDone = !!completed[phase.id];
          return (
            <div key={phase.id}
              className={cn("glass-card overflow-hidden transition-all", isActive && "ring-2 ring-foreground/20")}
              data-testid={`pc-phase-${phase.id}`}
            >
              <div className="w-full flex items-center gap-3 p-3 hover:bg-foreground/3 transition-colors relative">
                <button onClick={() => setActiveIdx(idx)}
                  type="button"
                  className="absolute inset-0 w-full h-full z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[inherit]"
                  aria-expanded={isActive}
                  aria-label={`Buka fase ${idx + 1}: ${phase.name}`}
                  data-testid={`pc-phase-toggle-${phase.id}`}
                />
                <div className="shrink-0 relative z-10 pointer-events-none">
                  {isDone ? (
                    <div className="h-9 w-9 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
                    </div>
                  ) : isActive ? (
                    <div className={cn("h-9 w-9 rounded-full flex items-center justify-center bg-gradient-to-br border border-border/40", phase.accent)}>
                      <CircleDot className="h-5 w-5" />
                    </div>
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-foreground/5 border border-border/40 flex items-center justify-center">
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 relative z-10 pointer-events-none">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Fase {idx + 1}</span>
                    {isDone && <Badge variant="secondary" className="h-5 text-xs px-1.5 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30">Selesai</Badge>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold text-sm md:text-base">{phase.name}</h3>
                    {phase.helpId && <span className="pointer-events-auto"><InlineHelp id={phase.helpId} size="xs" placement="right" /></span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{phase.desc}</p>
                </div>
                <div className="shrink-0 relative z-10 pointer-events-none">
                  {isActive ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>

              <AnimatePresence initial={false}>
                {isActive && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden">
                    <div className="px-3 pb-3 pt-3 border-t border-border/30">
                      <div className="pb-3 nested-cards">{phase.render({ goTo: setActiveIdx })}</div>
                      <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/30">
                        <Button variant="ghost" onClick={goPrev} disabled={activeIdx === 0}
                          data-testid={`pc-prev-${phase.id}`}><ArrowLeft /> Sebelumnya</Button>
                        <div className="flex items-center gap-2">
                          {!isDone && (
                            <Button variant="outline" onClick={() => markComplete(idx)}
                              data-testid={`pc-mark-done-${phase.id}`}>
                              <CheckCircle2 /> Tandai Selesai
                            </Button>
                          )}
                          {idx < PHASES.length - 1 && (
                            <Button onClick={goNext} data-testid={`pc-next-${phase.id}`}>
                              Lanjut <ArrowRight />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
