/**
 * useOutletScopeGuard — Client-side awareness for outlet scope violations.
 *
 * When a restricted outlet staff user navigates to a URL containing an
 * outlet_id they don't have access to, this hook:
 *   1. Shows a clear warning toast with the correct outlet name.
 *   2. Automatically resets outletId to the first allowed outlet.
 *
 * Usage (list/filter pages):
 *   const { outletId, setOutletId, scopedOutlets, isRestricted, loaded } = useOutletScope();
 *   useOutletScopeGuard({ requestedOutletId: urlOutletId, outletId, setOutletId, scopedOutlets, isRestricted, loaded });
 *
 * Usage (form pages — guard against PO/pre-filled outlet mismatch):
 *   useOutletScopeGuard({ requestedOutletId: form.outlet_id, setOutletId, scopedOutlets, isRestricted, loaded });
 */
import { useEffect, useRef } from "react";
import { toast } from "sonner";

export default function useOutletScopeGuard({
  requestedOutletId,
  setOutletId,
  scopedOutlets = [],
  isRestricted = false,
  loaded = true,
}) {
  const warnedFor = useRef(null); // track last warned outlet_id to avoid repeats

  useEffect(() => {
    // Only guard restricted users after outlets are loaded
    if (!loaded || !isRestricted || !requestedOutletId || scopedOutlets.length === 0) {
      warnedFor.current = null;
      return;
    }

    const isAllowed = scopedOutlets.some((o) => o.id === requestedOutletId);

    if (!isAllowed && warnedFor.current !== requestedOutletId) {
      warnedFor.current = requestedOutletId;
      const fallback = scopedOutlets[0];
      const fallbackName = fallback?.name || "outlet Anda";

      toast.warning(
        `⚠️ Anda tidak memiliki akses ke outlet yang diminta. Menampilkan data ${fallbackName}.`,
        {
          id: "outlet-scope-guard",
          duration: 5000,
          description: "URL outlet tidak sesuai dengan hak akses akun Anda.",
        }
      );

      // Reset to the user's first allowed outlet
      if (setOutletId && fallback?.id) {
        setOutletId(fallback.id);
      }
    } else if (isAllowed) {
      warnedFor.current = null; // reset so it can warn again if needed
    }
  }, [requestedOutletId, scopedOutlets, isRestricted, loaded, setOutletId]);
}
