/**
 * useOutletGuard — detects when an outlet staff member accesses
 * a URL containing an outlet_id that's outside their scope,
 * shows a toast warning, and strips the invalid param from the URL.
 *
 * Usage: call once inside any page that accepts ?outlet_id= in the URL.
 *   useOutletGuard();
 */
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export default function useOutletGuard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (!user) return;

    const isFullAccess = (user?.permissions || []).includes("*");
    if (isFullAccess) return; // super admin / full access → no restriction

    const userOutletIds = user?.outlet_ids || [];
    if (userOutletIds.length === 0) return; // no outlets assigned → backend will handle

    const urlOutletId = searchParams.get("outlet_id");
    if (!urlOutletId) return; // no outlet_id in URL → nothing to check

    if (!userOutletIds.includes(urlOutletId)) {
      toast.warning("Akses dibatasi — Anda tidak memiliki akses ke outlet tersebut. Data ditampilkan sesuai outlet Anda.", {
        id: "outlet-guard-warn",
        duration: 5000,
      });
      // Strip the invalid outlet_id from URL
      const next = new URLSearchParams(searchParams);
      next.delete("outlet_id");
      setSearchParams(next, { replace: true });
    }
  }, [user, searchParams]); // eslint-disable-line
}
