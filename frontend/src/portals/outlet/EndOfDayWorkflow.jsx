/** EndOfDayWorkflow — Phase D UX continuous flow 2026-05-26.
 *
 * The classic "split flow" anti-pattern: outlet closing required navigating to
 * 5+ separate pages (Daily Sales → KDO/BDO/FDO → Petty Cash → Daily Close).
 *
 * This page consolidates the entire end-of-day routine into a single vertical
 * stepper with progress indicator. Each step renders the relevant existing
 * component INLINE (no navigation), so users complete the closing in one
 * continuous view.
 *
 * URL: /outlet/end-of-day
 *      /outlet/end-of-day?step=2  (deep link to specific step)
 */
import { useState, useEffect, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  Receipt, ChefHat, Banknote, ClipboardCheck, CheckCircle2,
  ChevronRight, ChevronDown, ArrowRight, CircleDot, Circle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import useOutletScope from "@/hooks/useOutletScope";
import { Badge } from "@/components/ui/badge";
import { InlineHelp } from "@/components/shared/InlineHelp";
import DailySalesList from "./DailySalesList";
import KdoBdoList from "./KdoBdoList";
import FdoPage from "./FdoPage";
import PettyCashList from "./PettyCashList";
import DailyClose from "./DailyClose";

const STEPS = [
  {
    id: "sales",
    name: "Daily Sales",
    desc: "Submit penjualan hari ini untuk semua channel",
    icon: Receipt,
    accent: "from-violet-500/20 to-violet-500/5",
    helpId: "outlet-eod-sales",
    render: () => <DailySalesList />,
  },
  {
    id: "orders",
    name: "Daily Orders",
    desc: "Konfirmasi KDO (Kitchen) / BDO (Bar) / FDO (Floor)",
    icon: ChefHat,
    accent: "from-amber-500/20 to-amber-500/5",
    helpId: "outlet-eod-inventory",
    render: () => <DailyOrdersStep />,
  },
  {
    id: "cash",
    name: "Petty Cash",
    desc: "Reconcile saldo kas operasional outlet",
    icon: Banknote,
    accent: "from-emerald-500/20 to-emerald-500/5",
    helpId: "outlet-eod-petty-cash",
    render: () => <PettyCashList />,
  },
  {
    id: "close",
    name: "Daily Close",
    desc: "Checklist + upload slip setoran + lock day",
    icon: ClipboardCheck,
    accent: "from-rose-500/20 to-rose-500/5",
    helpId: "outlet-eod-submit",
    render: () => <DailyClose />,
  },
];

/** Sub-tabs for the Daily Orders step (Kitchen/Bar/Floor) */
function DailyOrdersStep() {
  const [tab, setTab] = useState("kdo");
  const TABS = [
    { id: "kdo", name: "Kitchen (KDO)" },
    { id: "bdo", name: "Bar (BDO)" },
    { id: "fdo", name: "Floor (FDO)" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 -mb-px overflow-x-auto" role="tablist">
        {TABS.map(t => {
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(t.id)}
              className={cn(
                "px-3 py-2 text-xs font-semibold rounded-full transition-colors",
                isActive
                  ? "bg-foreground text-background"
                  : "bg-foreground/5 text-muted-foreground hover:text-foreground"
              )}
              data-testid={`eod-orders-${t.id}`}
            >
              {t.name}
            </button>
          );
        })}
      </div>
      <div>
        {tab === "fdo" ? <FdoPage /> : <KdoBdoList kind={tab} />}
      </div>
    </div>
  );
}

export default function EndOfDayWorkflow() {
  const { allOutlets } = useOutletScope();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStep = Math.max(0, Math.min(STEPS.length - 1, Number(searchParams.get("step") || 0)));
  const [activeIdx, setActiveIdx] = useState(initialStep);
  const [completed, setCompleted] = useState(() => {
    try {
      const raw = localStorage.getItem("aurora_eod_completed_" + new Date().toISOString().slice(0, 10));
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    setSearchParams({ step: String(activeIdx) }, { replace: true });
  }, [activeIdx, setSearchParams]);

  useEffect(() => {
    localStorage.setItem(`aurora_eod_completed_${today}`, JSON.stringify(completed));
  }, [completed, today]);

  const markComplete = (idx) => {
    setCompleted(c => ({ ...c, [STEPS[idx].id]: true }));
  };

  const goNext = () => {
    markComplete(activeIdx);
    if (activeIdx < STEPS.length - 1) setActiveIdx(activeIdx + 1);
  };
  const goPrev = () => { if (activeIdx > 0) setActiveIdx(activeIdx - 1); };

  const allDone = STEPS.every(s => completed[s.id]);

  return (
    <div className="space-y-4 max-w-6xl mx-auto" data-testid="end-of-day-workflow">
      {/* Hub header */}
      <div className="glass-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl grad-aurora flex items-center justify-center">
              <ClipboardCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight flex items-center gap-2" data-testid="eod-title">
                Tutup Hari (End-of-Day) <InlineHelp id="outlet-eod-workflow" placement="bottom-start" />
              </h1>
              <p className="text-xs text-muted-foreground">
                Workflow operasional outlet hari {today} — 4 langkah continuous, tidak perlu pindah halaman.
              </p>
            </div>
          </div>
          {allDone && (
            <Badge variant="secondary" className="gap-1.5 text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 border-emerald-500/30">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Semua langkah selesai
            </Badge>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
              Progress
            </span>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {Object.keys(completed).filter(k => completed[k]).length} / {STEPS.length}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-foreground/10 overflow-hidden">
            <motion.div
              className="h-full grad-aurora"
              initial={false}
              animate={{ width: `${(Object.keys(completed).filter(k => completed[k]).length / STEPS.length) * 100}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      {/* Steps — vertical accordion-style stepper */}
      <div className="space-y-3">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isActive = idx === activeIdx;
          const isDone = !!completed[step.id];
          const isLocked = idx > activeIdx && !isDone;

          return (
            <div
              key={step.id}
              className={cn(
                "glass-card overflow-hidden transition-all",
                isActive && "ring-2 ring-foreground/20",
              )}
              data-testid={`eod-step-${step.id}`}
            >
              {/* Step header */}
              <div className="w-full flex items-center gap-4 p-4 hover:bg-foreground/3 transition-colors relative">
                <button
                  onClick={() => setActiveIdx(idx)}
                  className="absolute inset-0 w-full h-full z-0"
                  aria-expanded={isActive}
                  aria-label={`Toggle langkah ${idx + 1}: ${step.name}`}
                  data-testid={`eod-step-toggle-${step.id}`}
                />
                {/* Status dot */}
                <div className="shrink-0 relative z-10 pointer-events-none">
                  {isDone ? (
                    <div className="h-9 w-9 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  ) : isActive ? (
                    <div className={cn(
                      "h-9 w-9 rounded-full flex items-center justify-center bg-gradient-to-br",
                      step.accent,
                      "border border-border/40",
                    )}>
                      <CircleDot className="h-5 w-5" />
                    </div>
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-foreground/5 border border-border/40 flex items-center justify-center">
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Step icon + name + desc */}
                <div className="flex-1 min-w-0 relative z-10 pointer-events-none">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Langkah {idx + 1}
                    </span>
                    {isDone && (
                      <Badge variant="secondary" className="h-4 text-[9px] px-1.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                        Selesai
                      </Badge>
                    )}
                    {isLocked && (
                      <Badge variant="secondary" className="h-4 text-[9px] px-1.5">
                        Belum dimulai
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">{step.name}</span>
                    {step.helpId && <span className="pointer-events-auto"><InlineHelp id={step.helpId} size="xs" placement="right" /></span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{step.desc}</p>
                </div>

                {/* Chevron */}
                <div className="shrink-0 relative z-10 pointer-events-none">
                  {isActive ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>

              {/* Step body — only render when active (lazy) */}
              <AnimatePresence initial={false}>
                {isActive && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-2 border-t border-border/30">
                      <div className="py-3">
                        {step.render()}
                      </div>

                      {/* Step nav buttons */}
                      <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/30">
                        <Button
                          variant="ghost"
                          onClick={goPrev}
                          disabled={activeIdx === 0}
                          className="rounded-full"
                          data-testid={`eod-prev-${step.id}`}
                        >
                          ← Sebelumnya
                        </Button>
                        <div className="flex items-center gap-2">
                          {!isDone && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => markComplete(idx)}
                              className="rounded-full gap-1.5"
                              data-testid={`eod-mark-done-${step.id}`}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Tandai Selesai
                            </Button>
                          )}
                          {idx < STEPS.length - 1 && (
                            <Button
                              onClick={goNext}
                              className="rounded-full gap-2 pill-active"
                              data-testid={`eod-next-${step.id}`}
                            >
                              Lanjut
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {idx === STEPS.length - 1 && (
                            <Link
                              to="/outlet"
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium pill-active"
                              data-testid={`eod-finish`}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Kembali ke Dashboard
                            </Link>
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

      {/* Footer tip */}
      <div className="glass-card p-3 text-xs text-muted-foreground flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
        Tip: progress disimpan otomatis di browser per tanggal. Aman tutup tab dan lanjut lagi nanti.
      </div>
    </div>
  );
}
