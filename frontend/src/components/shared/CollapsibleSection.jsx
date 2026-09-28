/**
 * CollapsibleSection — Sprint F Phase F3 Stretch Goal
 * Wraps any section with a collapsible header. State (open/closed) persists per-user
 * via /api/preferences/me on PUT { collapsed_widgets: [...ids] }.
 *
 * Usage:
 *   <CollapsibleSection id="owner_kpi" title="KPI Utama" icon={LayoutDashboard}>
 *     <div className="grid">...</div>
 *   </CollapsibleSection>
 */
import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";

// Module-level singleton — fetched once per app lifecycle, shared across sections
let _setCache = null;
let _fetchPromise = null;
const _subscribers = new Set();

async function fetchCollapsedSet() {
  if (_setCache !== null) return _setCache;
  if (_fetchPromise) return _fetchPromise;
  _fetchPromise = api
    .get("/preferences/me")
    .then((r) => {
      const list = unwrap(r)?.preferences?.collapsed_widgets || [];
      _setCache = new Set(Array.isArray(list) ? list : []);
      return _setCache;
    })
    .catch((err) => {
      logger.warn("Failed to fetch user preferences", { error: err?.message });
      _setCache = new Set();
      return _setCache;
    });
  return _fetchPromise;
}

let _persistTimer = null;
function persistDebounced() {
  if (_persistTimer) clearTimeout(_persistTimer);
  _persistTimer = setTimeout(async () => {
    if (!_setCache) return;
    try {
      await api.put("/preferences/me", { collapsed_widgets: Array.from(_setCache) });
    } catch (err) {
      // Surface error in dev tools — local toggle still works, but state will be lost on next reload
      logger.warn("Failed to persist collapsed widgets", { error: err?.message });
    }
  }, 400);
}

function notifyAll() {
  _subscribers.forEach((cb) => {
    try { cb(); } catch { /* noop */ }
  });
}

export default function CollapsibleSection({ id, title, icon: Icon, children, className, testId, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const [loaded, setLoaded] = useState(false);

  // Subscribe to global cache changes (so multi-section state stays in sync if needed)
  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      if (!mounted || !_setCache) return;
      setOpen(!_setCache.has(id));
    };
    _subscribers.add(refresh);
    fetchCollapsedSet().then((set) => {
      if (!mounted) return;
      setOpen(!set.has(id));
      setLoaded(true);
    });
    return () => {
      mounted = false;
      _subscribers.delete(refresh);
    };
  }, [id]);

  const toggle = useCallback(() => {
    const next = !open;
    setOpen(next);
    if (!_setCache) _setCache = new Set();
    if (next) _setCache.delete(id);
    else _setCache.add(id);
    persistDebounced();
    notifyAll();
  }, [open, id]);

  return (
    <section
      className={cn("space-y-3", className)}
      data-testid={testId || `section-${id}`}
      data-section-state={open ? "open" : "collapsed"}
    >
      {(title || Icon) && (
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold flex items-center gap-2 text-sm uppercase tracking-wide text-muted-foreground">
            {Icon && <Icon className="h-3.5 w-3.5" />}
            <span>{title}</span>
          </h3>
          <button
            type="button"
            onClick={toggle}
            className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground hover:text-foreground rounded-full px-2 py-1 hover:bg-foreground/5 transition-colors"
            aria-label={open ? `Collapse ${title || id}` : `Expand ${title || id}`}
            aria-expanded={open}
            data-testid={`section-${id}-toggle`}
          >
            {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {open ? "Tutup" : "Buka"}
          </button>
        </div>
      )}
      <div
        className={cn(
          "transition-all duration-200 overflow-hidden",
          open ? "opacity-100" : "max-h-0 opacity-0 pointer-events-none"
        )}
        aria-hidden={!open}
      >
        {open && children}
      </div>
    </section>
  );
}

// Test-only helper: reset module cache (used by E2E)
export function _resetCollapsibleCache() {
  _setCache = null;
  _fetchPromise = null;
}
