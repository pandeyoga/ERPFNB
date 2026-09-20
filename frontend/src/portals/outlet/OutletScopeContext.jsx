/**
 * OutletScopeContext — provides the actively-selected outlet across the entire
 * Outlet Portal. The selection is persisted in localStorage so it survives
 * reloads and tab restores.
 *
 * Behavior:
 * - For full-access (super-admin) users: defaults to "" meaning "Semua Outlet".
 *   They can pick any outlet from the scoped list.
 * - For restricted outlet staff: defaults to user.default_outlet_id, or the
 *   single outlet in their scope if they only have one. They can ONLY switch
 *   between outlets in their scope.
 *
 * Usage:
 *   import { OutletScopeProvider, useOutletScopeCtx } from "./OutletScopeContext";
 *
 *   // In OutletPortal.jsx (root):
 *   <OutletScopeProvider>{children}</OutletScopeProvider>
 *
 *   // In any nested Outlet page:
 *   const { outletId, currentOutlet, scopedOutlets, isFullAccess } = useOutletScopeCtx();
 */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api, { unwrap } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const LS_KEY = "aurora_outlet_scope_selected";

const OutletScopeContext = createContext(null);

export function OutletScopeProvider({ children }) {
  const { user } = useAuth();
  const [allOutlets, setAllOutlets] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [outletId, _setOutletId] = useState(() => localStorage.getItem(LS_KEY) || "");

  const isFullAccess = useMemo(
    () => (user?.permissions || []).includes("*"),
    [user?.permissions],
  );
  const userOutletIds = useMemo(() => user?.outlet_ids || [], [user?.outlet_ids]);
  const defaultOutletId = user?.default_outlet_id || "";

  // Load all outlets from master once
  useEffect(() => {
    let cancelled = false;
    api
      .get("/master/outlets", { params: { per_page: 100 } })
      .then((r) => {
        if (!cancelled) setAllOutlets(unwrap(r) || []);
      })
      .catch(() => {
        if (!cancelled) setAllOutlets([]);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Derive scoped outlets: full-access = all, restricted = intersection
  const scopedOutlets = useMemo(() => {
    if (!loaded) return [];
    if (isFullAccess || userOutletIds.length === 0) return allOutlets;
    return allOutlets.filter((o) => userOutletIds.includes(o.id));
  }, [allOutlets, isFullAccess, userOutletIds, loaded]);

  // Persist + validate selection
  const setOutletId = (id) => {
    const safe = id || "";
    _setOutletId(safe);
    if (safe) localStorage.setItem(LS_KEY, safe);
    else localStorage.removeItem(LS_KEY);
  };

  // Initial smart-default once outlets loaded:
  // - If user has a saved selection that is still valid → keep it
  // - Else if user has default_outlet_id and it is in scope → use it
  // - Else if restricted user with only 1 outlet → auto-pick it
  // - Else (full-access multi-outlet) → leave blank = "Semua Outlet"
  useEffect(() => {
    if (!loaded) return;
    const validIds = new Set(scopedOutlets.map((o) => o.id));
    if (outletId && validIds.has(outletId)) return; // already valid
    if (outletId && !validIds.has(outletId)) {
      // Selection no longer valid (e.g. user changed) — reset
      setOutletId("");
    }
    if (defaultOutletId && validIds.has(defaultOutletId)) {
      setOutletId(defaultOutletId);
      return;
    }
    if (!isFullAccess && scopedOutlets.length === 1) {
      setOutletId(scopedOutlets[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, scopedOutlets, defaultOutletId, isFullAccess]);

  const currentOutlet = outletId
    ? allOutlets.find((o) => o.id === outletId) || null
    : null;

  const value = useMemo(
    () => ({
      outletId,
      setOutletId,
      currentOutlet,
      scopedOutlets,
      allOutlets,
      isFullAccess,
      userOutletIds,
      loaded,
      // Helper: whether picker should offer "Semua Outlet" option
      allowAllOption: isFullAccess || userOutletIds.length > 1,
      // Display label for header
      displayLabel: currentOutlet
        ? currentOutlet.name
        : isFullAccess
          ? "Semua Outlet"
          : userOutletIds.length === 0
            ? "Tidak ada akses outlet"
            : "Semua Outlet (akses Anda)",
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [outletId, currentOutlet, scopedOutlets, allOutlets, isFullAccess, userOutletIds, loaded],
  );

  return (
    <OutletScopeContext.Provider value={value}>{children}</OutletScopeContext.Provider>
  );
}

export function useOutletScopeCtx() {
  const ctx = useContext(OutletScopeContext);
  if (!ctx) {
    throw new Error("useOutletScopeCtx must be used within <OutletScopeProvider>");
  }
  return ctx;
}
