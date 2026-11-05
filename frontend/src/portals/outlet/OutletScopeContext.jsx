/**
 * OutletScopeContext — toko aktif di Outlet Portal, di DALAM konteks global TopNav (contexts/ScopeContext).
 *
 * - Konteks global = 1 toko → toko itu, terkunci (pemilih tidak ditampilkan; TopNav sudah menyebut tokonya).
 * - Konteks global = brand / Semua → pilih di antara toko dalam konteks itu (kanan atas halaman), atau
 *   "Semua toko" untuk daftar & ringkasan. Halaman operasional 1 toko meminta pilih toko dulu.
 * - Pilihan toko di portal berlaku selama sesi browser untuk konteks yang sama; tidak mengubah konteks global.
 *
 * Usage (tetap sama untuk halaman portal):
 *   const { outletId, currentOutlet, scopedOutlets, isFullAccess } = useOutletScopeCtx();
 */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useScope } from "@/contexts/ScopeContext";

const SS_KEY = "outlet_portal_store";

const OutletScopeContext = createContext(null);

function read(key) {
  try {
    return sessionStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

export function OutletScopeProvider({ children }) {
  const { user } = useAuth();
  const g = useScope();
  const key = `${SS_KEY}:${g.scope.level}:${g.scope.brandId || ""}:${g.scope.outletId || ""}`;
  const [picked, setPicked] = useState(() => read(key));
  useEffect(() => setPicked(read(key)), [key]);

  const scopedOutlets = useMemo(
    () => g.contextOutlets.map((o) => ({ ...o, brand_name: g.brandName(o.brand_id) })),
    [g.contextOutlets, g.brandName],
  );
  const locked = scopedOutlets.length === 1;
  const outletId = locked ? scopedOutlets[0].id : scopedOutlets.some((o) => o.id === picked) ? picked : "";

  const value = useMemo(() => {
    const setOutletId = (id) => {
      const safe = id || "";
      setPicked(safe);
      try {
        if (safe) sessionStorage.setItem(key, safe);
        else sessionStorage.removeItem(key);
      } catch {
        /* private mode */
      }
    };
    const currentOutlet = outletId ? scopedOutlets.find((o) => o.id === outletId) || null : null;
    return {
      outletId,
      setOutletId,
      currentOutlet,
      scopedOutlets,
      allOutlets: g.allOutlets,
      isFullAccess: g.isFullAccess,
      userOutletIds: user?.outlet_ids || [],
      loaded: g.loaded,
      locked,
      // "Semua toko" hanya bila konteks berisi lebih dari satu toko
      allowAllOption: scopedOutlets.length > 1,
      displayLabel: currentOutlet
        ? currentOutlet.name
        : scopedOutlets.length === 0 ? "Tidak ada akses outlet" : `Semua toko (${scopedOutlets.length})`,
    };
  }, [outletId, scopedOutlets, g.allOutlets, g.isFullAccess, g.loaded, locked, key, user?.outlet_ids]);

  return <OutletScopeContext.Provider value={value}>{children}</OutletScopeContext.Provider>;
}

export function useOutletScopeCtx() {
  const ctx = useContext(OutletScopeContext);
  if (!ctx) {
    throw new Error("useOutletScopeCtx must be used within <OutletScopeProvider>");
  }
  return ctx;
}
