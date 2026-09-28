/**
 * useTourAnalytics — Hook for batched tour analytics submission.
 *
 * Features:
 * - In-memory event queue
 * - Auto-flush every 8 seconds OR when queue >= 10 events
 * - LocalStorage backup (so events persist across page navigation)
 * - Flush on page unload (using sendBeacon)
 * - Graceful failure (network errors don't break tour UX)
 *
 * Usage:
 *   const { track } = useTourAnalytics();
 *   track({ type: 'tour_started', tour_id: 'foo', tour_version: 1, total_steps: 5 });
 */
import { useEffect, useRef, useCallback } from "react";
import api from "@/lib/api";
import { logger } from "@/lib/logger";

const STORAGE_KEY = "fnb_tour_analytics_queue";
const FLUSH_INTERVAL_MS = 8000;
const FLUSH_THRESHOLD = 10;
const MAX_QUEUE_SIZE = 100;
const ENDPOINT = "/tour-analytics/events";

// Module-level singleton queue (shared across mounts)
let memoryQueue = [];
let flushInProgress = false;

function loadQueueFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.slice(0, MAX_QUEUE_SIZE);
  } catch {
    /* noop */
  }
  return [];
}

function persistQueue(queue) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue.slice(0, MAX_QUEUE_SIZE)));
  } catch {
    /* noop */
  }
}

async function flushQueue() {
  if (flushInProgress) return;
  if (memoryQueue.length === 0) return;
  flushInProgress = true;

  const batch = memoryQueue.splice(0, MAX_QUEUE_SIZE);
  persistQueue(memoryQueue);

  try {
    await api.post(ENDPOINT, { events: batch });
    // Success — events accepted
  } catch (err) {
    // Network/auth error — restore to queue (front) so we retry later
    // But cap to avoid infinite growth
    memoryQueue = [...batch.slice(-MAX_QUEUE_SIZE / 2), ...memoryQueue].slice(0, MAX_QUEUE_SIZE);
    persistQueue(memoryQueue);
    // Silently fail — analytics shouldn't break UX
    logger.warn("Tour analytics flush failed (will retry)", { error: err?.message });
  } finally {
    flushInProgress = false;
  }
}

function flushBeacon() {
  // Use navigator.sendBeacon for fire-and-forget on unload
  if (memoryQueue.length === 0) return;
  try {
    const url =
      (process.env.REACT_APP_BACKEND_URL || "") + "/api" + ENDPOINT;
    const blob = new Blob(
      [JSON.stringify({ events: memoryQueue.splice(0, MAX_QUEUE_SIZE) })],
      { type: "application/json" }
    );
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, blob);
    }
    persistQueue(memoryQueue);
  } catch {
    /* noop */
  }
}

export function useTourAnalytics() {
  const intervalRef = useRef(null);

  // Initialize: load from storage once
  useEffect(() => {
    if (memoryQueue.length === 0) {
      memoryQueue = loadQueueFromStorage();
      // If we have backed-up events, try flush immediately
      if (memoryQueue.length > 0) {
        setTimeout(() => flushQueue(), 1000);
      }
    }
  }, []);

  // Periodic flush
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      flushQueue();
    }, FLUSH_INTERVAL_MS);
    return () => {
      clearInterval(intervalRef.current);
    };
  }, []);

  // Flush on page unload
  useEffect(() => {
    const handler = () => flushBeacon();
    window.addEventListener("beforeunload", handler);
    window.addEventListener("pagehide", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      window.removeEventListener("pagehide", handler);
    };
  }, []);

  const track = useCallback((event) => {
    if (!event || !event.type || !event.tour_id) return;
    const enriched = {
      ...event,
      client_ts: new Date().toISOString(),
      path: event.path || window.location.pathname,
    };
    memoryQueue.push(enriched);
    persistQueue(memoryQueue);

    // Auto-flush on threshold
    if (memoryQueue.length >= FLUSH_THRESHOLD) {
      flushQueue();
    }
  }, []);

  const flush = useCallback(() => flushQueue(), []);

  return { track, flush };
}
