/**
 * TourProvider — Global context untuk manage interactive tours.
 *
 * Fitur (Phase 3 update):
 * - Welcome modal sebelum tour dimulai (intro)
 * - Custom premium tooltip (TourTooltip)
 * - Spotlight + overlay polish
 * - LocalStorage persistence dengan **versioning** ({ id, version, completedAt })
 * - Restart support + Auto-stop saat route berubah
 * - **Analytics tracking** (batched events: started/step/completed/skipped/closed)
 * - **Auto-suggest** ketika user idle 45s di halaman dengan tour
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useLocation } from "react-router-dom";
import { Joyride, ACTIONS, EVENTS, STATUS } from "react-joyride";
import { Sparkles, X, BookOpen, Zap, HelpCircle } from "lucide-react";
import { toast } from "sonner";

import { tourRegistry, getTourVersion } from "./tours";
import { getToursForPath, getTourMetadata } from "./tourMap";
import TourTooltip from "./TourTooltip";
import { useTourAnalytics } from "./useTourAnalytics";
import { useIdleSuggestion } from "./useIdleSuggestion";
import { logger } from "@/lib/logger";
import "./tour.css";

const TourContext = createContext(null);
const STORAGE_KEY = "fnb_tour_completed_v2"; // v2: includes version
const LEGACY_KEY = "fnb_tour_completed"; // v1: array of ids only
const SUGGESTED_DISMISSED_KEY = "fnb_tour_suggested_dismissed"; // path-set

// ============================================================
// Completion storage (v2: { id, version, completedAt })
// ============================================================

function migrateLegacyCompleted() {
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return null;
    const parsed = JSON.parse(legacy);
    if (!Array.isArray(parsed)) return null;
    const migrated = parsed.map((id) => ({
      id,
      version: 1, // assume v1
      completedAt: new Date().toISOString(),
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    localStorage.removeItem(LEGACY_KEY);
    return migrated;
  } catch {
    return null;
  }
}

function loadCompleted() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (!v) {
      // Try migrate from legacy
      const migrated = migrateLegacyCompleted();
      return migrated || [];
    }
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCompleted(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
}

function loadDismissedSuggestions() {
  try {
    const v = localStorage.getItem(SUGGESTED_DISMISSED_KEY);
    if (!v) return [];
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDismissedSuggestions(list) {
  try {
    localStorage.setItem(SUGGESTED_DISMISSED_KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
}

// ============================================================
// TourProvider
// ============================================================

export function TourProvider({ children }) {
  const location = useLocation();
  const [activeTourId, setActiveTourId] = useState(null);
  const [activeTour, setActiveTour] = useState(null);
  const [run, setRun] = useState(false);
  const [welcomeTour, setWelcomeTour] = useState(null);
  const [completed, setCompletedState] = useState(loadCompleted);
  const [dismissedSuggestions, setDismissedSuggestions] = useState(loadDismissedSuggestions);
  const lastPathRef = useRef(location.pathname);
  const tourStartTsRef = useRef(null);
  const lastSeenStepRef = useRef(-1);
  const startTourTimerRef = useRef(null); // Store timer ID for cleanup

  const { track } = useTourAnalytics();

  // Auto-stop tour saat user navigate ke halaman lain
  useEffect(() => {
    if (lastPathRef.current !== location.pathname) {
      lastPathRef.current = location.pathname;
      if (run) {
        setRun(false);
        setActiveTour(null);
        setActiveTourId(null);
      }
    }
    
    // CLEANUP: Reset tour state on unmount to prevent memory leak
    return () => {
      // Clear any pending tour start timer
      if (startTourTimerRef.current) {
        clearTimeout(startTourTimerRef.current);
        startTourTimerRef.current = null;
      }
      
      if (run) {
        setRun(false);
        setActiveTour(null);
        setActiveTourId(null);
      }
    };
  }, [location.pathname, run]);

  const markCompleted = useCallback((tourId) => {
    const version = getTourVersion(tourId);
    setCompletedState((prev) => {
      const others = prev.filter((c) => (typeof c === "string" ? c !== tourId : c.id !== tourId));
      const next = [
        ...others,
        { id: tourId, version, completedAt: new Date().toISOString() },
      ];
      saveCompleted(next);
      return next;
    });
  }, []);

  // ============================================================
  // Public API
  // ============================================================

  const requestStartTour = useCallback((tourId) => {
    const tour = tourRegistry[tourId];
    if (!tour) {
      logger.warn("Tour not found in registry", { tourId });
      return;
    }
    setWelcomeTour({ id: tourId, ...tour });
  }, []);

  const startTourDirect = useCallback(
    (tourId) => {
      const tour = tourRegistry[tourId];
      if (!tour) {
        logger.warn(`Tour not found`, { tourId });
        return;
      }
      const version = getTourVersion(tourId);
      setActiveTour(tour);
      setActiveTourId(tourId);
      setWelcomeTour(null);
      tourStartTsRef.current = Date.now();
      lastSeenStepRef.current = -1;

      // Track start
      track({
        type: "tour_started",
        tour_id: tourId,
        tour_version: version,
        total_steps: tour.steps?.length || 0,
      });

      // Small delay to let welcome modal close gracefully + DOM settle
      // Clear previous timer if exists to prevent memory leak
      if (startTourTimerRef.current) {
        clearTimeout(startTourTimerRef.current);
      }
      startTourTimerRef.current = setTimeout(() => {
        setRun(true);
        startTourTimerRef.current = null;
      }, 50);
    },
    [track]
  );

  const startTour = useCallback(
    (tourId) => {
      requestStartTour(tourId);
    },
    [requestStartTour]
  );

  const stopTour = useCallback(() => {
    setRun(false);
    setActiveTour(null);
    setActiveTourId(null);
    tourStartTsRef.current = null;
    lastSeenStepRef.current = -1;
  }, []);

  const isCompleted = useCallback(
    (tourId) => completed.some((c) => (typeof c === "string" ? c === tourId : c.id === tourId)),
    [completed]
  );

  const getCompletedVersion = useCallback(
    (tourId) => {
      const rec = completed.find((c) =>
        typeof c === "string" ? c === tourId : c.id === tourId
      );
      if (!rec) return null;
      return typeof rec === "string" ? 1 : rec.version || 1;
    },
    [completed]
  );

  const isOutdated = useCallback(
    (tourId) => {
      const ver = getCompletedVersion(tourId);
      if (ver == null) return false;
      return getTourVersion(tourId) > ver;
    },
    [getCompletedVersion]
  );

  // ============================================================
  // Joyride callback
  // ============================================================
  const handleJoyrideCallback = useCallback(
    (data) => {
      const { action, index, status, type, lifecycle } = data;
      const tourId = activeTourId;
      const totalSteps = activeTour?.steps?.length || 0;
      const version = tourId ? getTourVersion(tourId) : 1;
      const startedAt = tourStartTsRef.current;

      // Track step views (when tooltip shown)
      if (type === EVENTS.STEP_AFTER && lifecycle === "complete" && tourId) {
        // step_index here is the step user just finished viewing
        if (index !== lastSeenStepRef.current) {
          lastSeenStepRef.current = index;
          track({
            type: "tour_step_viewed",
            tour_id: tourId,
            tour_version: version,
            step_index: index,
            total_steps: totalSteps,
          });
        }
      }

      // Tour finished or skipped
      if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
        const durationMs = startedAt ? Date.now() - startedAt : null;
        if (status === STATUS.FINISHED && tourId) {
          markCompleted(tourId);
          track({
            type: "tour_completed",
            tour_id: tourId,
            tour_version: version,
            duration_ms: durationMs,
            total_steps: totalSteps,
          });
        } else if (status === STATUS.SKIPPED && tourId) {
          track({
            type: "tour_skipped",
            tour_id: tourId,
            tour_version: version,
            step_index: index,
            duration_ms: durationMs,
            total_steps: totalSteps,
          });
        }
        stopTour();
        return;
      }

      // Close button clicked
      if (action === ACTIONS.CLOSE && lifecycle === "complete" && tourId) {
        const durationMs = startedAt ? Date.now() - startedAt : null;
        track({
          type: "tour_closed",
          tour_id: tourId,
          tour_version: version,
          step_index: index,
          duration_ms: durationMs,
          total_steps: totalSteps,
        });
        stopTour();
        return;
      }

      if (type === EVENTS.TOUR_END) {
        stopTour();
      }
    },
    [activeTourId, activeTour, markCompleted, stopTour, track]
  );

  // ============================================================
  // Auto-suggest tour ketika user idle
  // ============================================================

  // Compute current page's primary tour
  const currentTours = getToursForPath(location.pathname);
  const primaryTourId = currentTours.find((t) => t !== "general-navigation") || null;

  // Show suggestion?
  const canSuggest =
    !!primaryTourId &&
    !run &&
    !welcomeTour &&
    !isCompleted(primaryTourId) &&
    !dismissedSuggestions.includes(location.pathname);

  const handleIdleFire = useCallback(() => {
    if (!canSuggest || !primaryTourId) return;

    const meta = getTourMetadata(primaryTourId);
    const tour = tourRegistry[primaryTourId];
    if (!meta || !tour) return;

    // Emit suggested_shown analytics
    track({
      type: "tour_suggested_shown",
      tour_id: primaryTourId,
      tour_version: getTourVersion(primaryTourId),
      total_steps: tour.steps?.length || 0,
    });

    toast.custom(
      (t) => (
        <div
          className="tour-suggestion-toast"
          data-testid="tour-suggestion-toast"
        >
          <div className="tour-suggestion-icon" aria-hidden="true">
            <HelpCircle className="h-5 w-5" />
          </div>
          <div className="tour-suggestion-body">
            <p className="tour-suggestion-title">Butuh bantuan?</p>
            <p className="tour-suggestion-desc">
              Kami punya panduan singkat untuk halaman ini:{" "}
              <strong>{meta.title}</strong>
            </p>
            <div className="tour-suggestion-buttons">
              <button
                className="tour-suggestion-btn-primary"
                onClick={() => {
                  toast.dismiss(t);
                  track({
                    type: "tour_suggested_accepted",
                    tour_id: primaryTourId,
                    tour_version: getTourVersion(primaryTourId),
                  });
                  startTour(primaryTourId);
                }}
                data-testid="tour-suggestion-accept"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Mulai Tour
              </button>
              <button
                className="tour-suggestion-btn-secondary"
                onClick={() => {
                  toast.dismiss(t);
                  track({
                    type: "tour_suggested_dismissed",
                    tour_id: primaryTourId,
                    tour_version: getTourVersion(primaryTourId),
                  });
                  // Persist dismissal for this path
                  setDismissedSuggestions((prev) => {
                    const next = [...prev, location.pathname];
                    saveDismissedSuggestions(next);
                    return next;
                  });
                }}
                data-testid="tour-suggestion-dismiss"
              >
                Tidak, terima kasih
              </button>
            </div>
          </div>
          <button
            className="tour-suggestion-close"
            onClick={() => toast.dismiss(t)}
            aria-label="Tutup"
            data-testid="tour-suggestion-close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
      { duration: 12000, position: "bottom-right" }
    );
  }, [
    canSuggest,
    primaryTourId,
    track,
    startTour,
    location.pathname,
  ]);

  useIdleSuggestion({
    enabled: canSuggest,
    thresholdMs: 45000,
    onIdle: handleIdleFire,
    resetKey: location.pathname,
  });

  // ============================================================
  // Context value
  // ============================================================
  const value = {
    activeTour,
    activeTourId,
    run,
    startTour,
    startTourDirect,
    stopTour,
    completed,
    isCompleted,
    isOutdated,
    getCompletedVersion,
  };

  return (
    <TourContext.Provider value={value}>
      {children}

      {/* Welcome Modal */}
      {welcomeTour && (
        <TourWelcomeModal
          tour={welcomeTour}
          isCompleted={isCompleted(welcomeTour.id)}
          isOutdated={isOutdated(welcomeTour.id)}
          onStart={() => startTourDirect(welcomeTour.id)}
          onClose={() => setWelcomeTour(null)}
        />
      )}

      {/* Joyride Engine */}
      {activeTour && (
        <Joyride
          steps={activeTour.steps.map((s) => ({ skipBeacon: true, disableBeacon: true, ...s }))}
          run={run}
          continuous
          showProgress={false}
          showSkipButton
          scrollToFirstStep
          disableScrolling={false}
          disableOverlayClose
          spotlightPadding={6}
          callback={handleJoyrideCallback}
          tooltipComponent={TourTooltip}
          floaterProps={{
            disableAnimation: false,
            styles: {
              floater: { filter: "none" },
              wrapper: { zIndex: 10001 },
            },
          }}
          styles={{
            options: {
              primaryColor: "hsl(240 70% 63%)",
              zIndex: 10000,
              overlayColor: "rgba(15, 23, 42, 0.55)",
              spotlightShadow: "0 0 0 8px rgba(91, 95, 227, 0.2)",
            },
            overlay: { mixBlendMode: "normal" },
            spotlight: { borderRadius: 12 },
          }}
          locale={{
            back: "Kembali",
            close: "Tutup",
            last: "Selesai",
            next: "Lanjut",
            open: "Buka",
            skip: "Lewati",
          }}
        />
      )}
    </TourContext.Provider>
  );
}

/* =====================================================
 * Welcome Modal Component
 * ===================================================== */
function TourWelcomeModal({ tour, isCompleted, isOutdated, onStart, onClose }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const stepCount = tour.steps?.length || 0;
  const estimatedMin = Math.max(1, Math.ceil(stepCount * 0.3));

  return (
    <div
      className="tour-welcome-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Mulai Tour"
      onClick={onClose}
      data-testid="tour-welcome-overlay"
    >
      <div
        className="tour-welcome-card"
        onClick={(e) => e.stopPropagation()}
        data-testid="tour-welcome-card"
      >
        <div className="tour-welcome-hero" aria-hidden="true" />

        <button
          className="tour-welcome-close"
          onClick={onClose}
          aria-label="Tutup"
          data-testid="tour-welcome-close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="tour-welcome-icon">
          <Sparkles className="h-6 w-6" />
        </div>

        <h2 className="tour-welcome-title" data-testid="tour-welcome-title">
          {tour.name}
        </h2>
        <p className="tour-welcome-subtitle">
          {tour.description ||
            "Mari kami pandu kamu lewat fitur penting di halaman ini. Tour ini interaktif — kamu bisa skip atau ulangi kapan saja."}
        </p>

        <div className="tour-welcome-meta">
          <span className="tour-welcome-meta-chip">
            <BookOpen className="h-3.5 w-3.5" />
            {stepCount} langkah
          </span>
          <span className="tour-welcome-meta-chip">
            <Zap className="h-3.5 w-3.5" />
            ±{estimatedMin} menit
          </span>
          {isOutdated && (
            <span
              className="tour-welcome-meta-chip"
              style={{
                background: "hsl(38 92% 90%)",
                color: "hsl(28 80% 30%)",
                borderColor: "hsl(38 92% 75%)",
              }}
              data-testid="tour-welcome-updated-badge"
            >
              🆕 Diperbarui
            </span>
          )}
          {isCompleted && !isOutdated && (
            <span
              className="tour-welcome-meta-chip"
              style={{
                background: "hsl(152 60% 92%)",
                color: "hsl(152 60% 28%)",
                borderColor: "hsl(152 60% 80%)",
              }}
            >
              Pernah diakses
            </span>
          )}
        </div>

        <div className="tour-welcome-buttons">
          <button
            className="tour-welcome-btn-secondary"
            onClick={onClose}
            data-testid="tour-welcome-cancel"
          >
            Nanti saja
          </button>
          <button
            className="tour-welcome-btn-primary"
            onClick={onStart}
            data-testid="tour-welcome-start"
          >
            <Sparkles className="h-4 w-4" />
            {isOutdated ? "Lihat Pembaruan" : "Mulai Tour"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error("useTour must be used within TourProvider");
  }
  return context;
}
