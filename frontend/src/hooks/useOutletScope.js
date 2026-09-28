/**
 * useOutletScope — A hook that enforces outlet scope for the current user.
 *
 * - Reads user.outlet_ids to restrict the visible outlet list
 * - Auto-selects user.default_outlet_id if no outlet is chosen yet
 * - Exposes helpers to detect full-access vs restricted users
 *
 * Usage:
 *   const { outletId, setOutletId, scopedOutlets, isFullAccess } = useOutletScope();
 */
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import api, { unwrap } from "@/lib/api";

export default function useOutletScope(initialOutletId = "") {
  const { user } = useAuth();
  const [allOutlets, setAllOutlets] = useState([]);
  const [outletId, setOutletId] = useState(initialOutletId);
  const [loaded, setLoaded] = useState(false);

  const isFullAccess = (user?.permissions || []).includes("*");
  const userOutletIds = useMemo(() => user?.outlet_ids || [], [user?.outlet_ids]); // eslint-disable-line
  const defaultOutletId = user?.default_outlet_id || "";

  useEffect(() => {
    api.get("/master/outlets", { params: { per_page: 100 } })
      .then((r) => setAllOutlets(unwrap(r) || []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Derive scoped outlets: full-access = all, restricted = intersection
  const scopedOutlets = useMemo(() => {
    if (!loaded) return [];
    if (isFullAccess || userOutletIds.length === 0) return allOutlets;
    return allOutlets.filter((o) => userOutletIds.includes(o.id));
  }, [allOutlets, isFullAccess, userOutletIds, loaded]);

  // Auto-select default_outlet_id or first scoped outlet when loaded and no selection yet
  useEffect(() => {
    if (!loaded || outletId) return;
    if (defaultOutletId && scopedOutlets.some((o) => o.id === defaultOutletId)) {
      setOutletId(defaultOutletId);
    } else if (!isFullAccess && scopedOutlets.length === 1) {
      // Outlet staff with exactly one outlet — auto-select it
      setOutletId(scopedOutlets[0].id);
    }
    // For full-access users or multi-outlet staff without default, leave blank (show all)
  }, [loaded, scopedOutlets, defaultOutletId, isFullAccess]); // eslint-disable-line

  // Current outlet object
  const currentOutlet = outletId ? allOutlets.find((o) => o.id === outletId) : null;

  return {
    outletId,
    setOutletId,
    scopedOutlets,
    allOutlets,
    currentOutlet,
    isFullAccess,
    isRestricted: !isFullAccess && userOutletIds.length > 0 && userOutletIds.length < allOutlets.length,
    userOutletIds,
    loaded,
  };
}
