/**
 * useIdleSuggestion — Hook for detecting user-stuck state on a page and suggesting tour.
 *
 * Detection logic:
 * - Listen for: mousemove, mousedown, keydown, scroll, touchstart
 * - Reset idle timer on any of those events
 * - After IDLE_THRESHOLD_MS without activity, fire `onIdle` callback
 *
 * Caller decides whether to show suggestion based on:
 * - Is a tour available for the current page?
 * - Has user already completed this tour?
 * - Has user dismissed suggestion for this page (LocalStorage)?
 */
import { useEffect, useRef, useCallback } from "react";

export const DEFAULT_IDLE_THRESHOLD_MS = 45000; // 45 seconds

export function useIdleSuggestion({
  enabled = true,
  thresholdMs = DEFAULT_IDLE_THRESHOLD_MS,
  onIdle,
  resetKey, // when this changes (e.g., pathname), reset the timer + re-arm
}) {
  const timerRef = useRef(null);
  const firedRef = useRef(false);
  const onIdleRef = useRef(onIdle);

  // Keep latest onIdle without re-binding events
  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (firedRef.current) return; // Don't re-arm after firing for this page session

    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      try {
        onIdleRef.current?.();
      } catch {
        /* noop */
      }
    }, thresholdMs);
  }, [thresholdMs]);

  // Reset timer when resetKey changes (e.g., new page)
  useEffect(() => {
    firedRef.current = false;
    if (!enabled) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    reset();
  }, [resetKey, enabled, reset]);

  // Listen for user activity
  useEffect(() => {
    if (!enabled) return;

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    const handler = () => {
      if (!firedRef.current) reset();
    };

    events.forEach((evt) =>
      window.addEventListener(evt, handler, { passive: true })
    );

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handler));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, reset]);
}
