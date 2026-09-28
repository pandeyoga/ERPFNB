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
import { useSearchParams, Link } from "react-router-dom";
import {
  Calendar, AlertTriangle, ClipboardCheck, Lock,
  ChevronRight, ChevronDown, ArrowRight, CircleDot, Circle, CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PeriodList from "./PeriodList";
import AnomalyFeed from "./AnomalyFeed";
import { InlineHelp } from "@/components/shared/InlineHelp";

const PHASES = [
  {
    id: "periods",
    name: "Review Periods",
    desc: "Lihat status period (open / locked) dan reopen jika perlu adjust historis",
    icon: Calendar,
    accent: "from-violet-500/20 to-violet-500/5",
    helpId: "period-status",
    render: () => <PeriodList />,
  },
  {
    id: "anomaly",
    name: "Anomaly Check",
    desc: "Review transaksi yang di-flag AI/system sebelum closing (saldo negatif, GL imbalance, vendor duplicate dll)",
    icon: AlertTriangle,
    accent: "from-amber-500/20 to-amber-500/5",
    helpId: "finance-period-anomaly",
    render: () => <AnomalyFeed />,
  },
  {
    id: "wizard",
    name: "Closing Wizard",
    desc: "Tahap reconcile bank, depresiasi, accrual, adjustment, hingga lock period",
    icon: ClipboardCheck,
    accent: "from-emerald-500/20 to-emerald-500/5",
    helpId: "finance-period-closing-je",
    render: () => <ClosingWizardPlaceholder />,
  },
  {
    id: "locked",
    name: "Lock & Audit Trail",
    desc: "Period sudah locked — review audit trail dan generate closing report",
    icon: Lock,
    accent: "from-rose-500/20 to-rose-500/5",
    helpId: "finance-period-lock",
    render: () => <LockedPhasePlaceholder />,
  },
];

function ClosingWizardPlaceholder() {
  return (
    <div className="glass-card p-8 text-center">
      <div className="h-14 w-14 mx-auto rounded-2xl grad-aurora-soft flex items-center justify-center mb-3">
        <ClipboardCheck className="h-7 w-7" />
      </div>
      <h3 className="font-semibold text-lg mb-1">Closing Wizard</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
        Untuk menjalankan closing wizard untuk period tertentu, buka halaman Periods dan pilih period yang ingin di-close.
      </p>
      <Link
        to="/finance/periods"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full pill-active text-sm font-medium"
      >
        Buka Halaman Periods <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function LockedPhasePlaceholder() {
  return (
    <div className="glass-card p-8 text-center">
      <div className="h-14 w-14 mx-auto rounded-2xl grad-aurora-soft flex items-center justify-center mb-3">
        <Lock className="h-7 w-7" />
      </div>
      <h3 className="font-semibold text-lg mb-1">Period Lock & Audit Trail</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
        Setelah Closing Wizard selesai, period akan otomatis ter-lock. Audit trail dapat dilihat di
        <Link to="/finance/periods" className="text-foreground underline ml-1">halaman Periods</Link>.
      </p>
      <Link
        to="/finance/periods"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full pill-active text-sm font-medium"
      >
        Buka Halaman Periods <ArrowRight className="h-3.5 w-3.5" />
      </Link>
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

  useEffect(() => {
    setSearchParams({ phase: String(activeIdx) }, { replace: true });
  }, [activeIdx, setSearchParams]);

  useEffect(() => {
    localStorage.setItem("aurora_period_closing_progress", JSON.stringify(completed));
  }, [completed]);

  const markComplete = (idx) => setCompleted(c => ({ ...c, [PHASES[idx].id]: true }));
  const goNext = () => { markComplete(activeIdx); if (activeIdx < PHASES.length - 1) setActiveIdx(activeIdx + 1); };
  const goPrev = () => { if (activeIdx > 0) setActiveIdx(activeIdx - 1); };
  const allDone = PHASES.every(p => completed[p.id]);

  return (
    <div className="space-y-4 max-w-6xl mx-auto" data-testid="period-closing-hub">
      <div className="glass-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl grad-aurora flex items-center justify-center">
              <ClipboardCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight flex items-center gap-2">
                Period Closing <InlineHelp id="period-status" placement="bottom-start" />
              </h1>
              <p className="text-xs text-muted-foreground">
                4 fase continuous — Review Periods → Anomaly → Wizard → Lock
              </p>
            </div>
          </div>
          {allDone && (
            <Badge variant="secondary" className="gap-1.5 text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 border-emerald-500/30">
              <CheckCircle2 className="h-3.5 w-3.5" /> Period closing selesai
            </Badge>
          )}
        </div>
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Progress</span>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {Object.keys(completed).filter(k => completed[k]).length} / {PHASES.length}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-foreground/10 overflow-hidden">
            <motion.div className="h-full grad-aurora" initial={false}
              animate={{ width: `${(Object.keys(completed).filter(k => completed[k]).length / PHASES.length) * 100}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }} />
          </div>
        </div>
      </div>

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
              <div className="w-full flex items-center gap-4 p-4 hover:bg-foreground/3 transition-colors relative">
                <button onClick={() => setActiveIdx(idx)}
                  className="absolute inset-0 w-full h-full z-0"
                  aria-expanded={isActive}
                  aria-label={`Toggle fase ${idx + 1}: ${phase.name}`}
                  data-testid={`pc-phase-toggle-${phase.id}`}
                />
                <div className="shrink-0 relative z-10 pointer-events-none">
                  {isDone ? (
                    <div className="h-9 w-9 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
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
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Fase {idx + 1}</span>
                    {isDone && <Badge variant="secondary" className="h-4 text-[9px] px-1.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">Selesai</Badge>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">{phase.name}</span>
                    {phase.helpId && <span className="pointer-events-auto"><InlineHelp id={phase.helpId} size="xs" placement="right" /></span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{phase.desc}</p>
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
                    <div className="px-4 pb-4 pt-2 border-t border-border/30">
                      <div className="py-3">{phase.render()}</div>
                      <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/30">
                        <Button variant="ghost" onClick={goPrev} disabled={activeIdx === 0} className="rounded-full"
                          data-testid={`pc-prev-${phase.id}`}>← Sebelumnya</Button>
                        <div className="flex items-center gap-2">
                          {!isDone && (
                            <Button variant="outline" size="sm" onClick={() => markComplete(idx)}
                              className="rounded-full gap-1.5" data-testid={`pc-mark-done-${phase.id}`}>
                              <CheckCircle2 className="h-3.5 w-3.5" /> Tandai Selesai
                            </Button>
                          )}
                          {idx < PHASES.length - 1 && (
                            <Button onClick={goNext} className="rounded-full gap-2 pill-active" data-testid={`pc-next-${phase.id}`}>
                              Lanjut <ArrowRight className="h-3.5 w-3.5" />
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
