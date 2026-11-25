/**
 * ScopeContext — konteks kerja global Group › Brand › Toko, dipilih sekali di TopNav (DESIGN_SYSTEM §10.7).
 *
 * scope = { level: "group" | "brand" | "outlet", brandId, outletId }
 *  - group  : "Semua brand" (akses semua toko) atau "Semua toko saya" (akses terbatas, > 1 toko)
 *  - brand  : semua toko brand itu yang dalam akses user
 *  - outlet : satu toko
 * Disimpan per akun (/preferences/me → `work_scope`) dengan cache localStorage. Server tetap menegakkan akses.
 * Setiap GET membawa konteks ini otomatis (lib/api.js `setRequestScope`); halaman di-remount saat konteks diganti
 * (`scopeKey`, lihat AppShell) sehingga semua data dimuat ulang.
 *
 * Halaman memakai:
 *  - useScope()        → konteks + `params` untuk API: {} | { brand_id } | { outlet_id }
 *  - useStoreFilter()  → filter Toko LOKAL di halaman (muncul hanya bila konteks berisi ≥ 2 toko). Tidak mengubah
 *                        konteks global dan kembali ke "Semua toko" saat pindah menu.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api, { fetchAll, setRequestScope, unwrap } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";

const LS_KEY = "erp_work_scope";
const GROUP = { level: "group", brandId: null, outletId: null };

const ScopeContext = createContext(null);

function readCache() {
  try {
    const v = JSON.parse(localStorage.getItem(LS_KEY) || "null");
    return v && v.level ? v : null;
  } catch {
    return null;
  }
}

function writeCache(v) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(v));
  } catch {
    /* private mode */
  }
}

const byName = (a, b) => (a.name || "").localeCompare(b.name || "");

export function ScopeProvider({ children }) {
  const { user } = useAuth();
  const [brands, setBrands] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [saved, setSaved] = useState(readCache);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user?.id) return undefined;
    let off = false;
    setLoaded(false);
    Promise.all([
      fetchAll("/master/brands").catch(() => null),
      fetchAll("/master/outlets").catch(() => null),
      api.get("/preferences/me").catch(() => null),
    ])
      .then(([b, o, p]) => {
        if (off) return;
        setBrands((unwrap(b) || []).filter((x) => x.active !== false).sort(byName));
        setOutlets((unwrap(o) || []).filter((x) => x.active !== false).sort(byName));
        const pref = unwrap(p)?.preferences?.work_scope;
        if (pref?.level) setSaved({ level: pref.level, brandId: pref.brand_id || null, outletId: pref.outlet_id || null });
      })
      .finally(() => !off && setLoaded(true));
    return () => {
      off = true;
    };
  }, [user?.id]);

  const userOutletIds = useMemo(() => user?.outlet_ids || [], [user?.outlet_ids]);
  const perms = user?.permissions || [];
  // Sama dengan server (services/_finance/scope.py): memegang semua toko = tingkat Group.
  const isFullAccess = perms.includes("*") || userOutletIds.includes("*")
    || (outlets.length > 0 && outlets.every((o) => userOutletIds.includes(o.id)));

  const scopedOutlets = useMemo(
    () => (isFullAccess ? outlets : outlets.filter((o) => userOutletIds.includes(o.id))),
    [isFullAccess, outlets, userOutletIds],
  );

  // Brand → toko dalam akses; `total` = semua toko brand (untuk label "3 toko").
  const tree = useMemo(() => brands
    .map((b) => ({
      ...b,
      outlets: scopedOutlets.filter((o) => o.brand_id === b.id),
      total: outlets.filter((o) => o.brand_id === b.id).length,
    }))
    .filter((b) => b.outlets.length > 0), [brands, outlets, scopedOutlets]);

  const brandName = useCallback((id) => brands.find((b) => b.id === id)?.name || "", [brands]);

  // Pilihan tersimpan divalidasi terhadap akses; brand dengan 1 toko (dalam akses) = level toko.
  const scope = useMemo(() => {
    if (!loaded) return GROUP;
    const asOutlet = (o) => ({ level: "outlet", brandId: o.brand_id, outletId: o.id });
    const pick = (s) => {
      if (!s) return null;
      if (s.level === "outlet") {
        const o = scopedOutlets.find((x) => x.id === s.outletId);
        return o ? asOutlet(o) : null;
      }
      if (s.level === "brand") {
        const b = tree.find((x) => x.id === s.brandId);
        if (!b) return null;
        return b.outlets.length === 1 ? asOutlet(b.outlets[0]) : { level: "brand", brandId: b.id, outletId: null };
      }
      return scopedOutlets.length > 1 ? GROUP : null;
    };
    const def = () => {
      const d = scopedOutlets.find((o) => o.id === user?.default_outlet_id);
      if (d) return asOutlet(d);
      if (scopedOutlets.length === 1) return asOutlet(scopedOutlets[0]);
      if (!isFullAccess && tree.length === 1) return pick({ level: "brand", brandId: tree[0].id });
      return GROUP;
    };
    return pick(saved) || def();
  }, [loaded, saved, scopedOutlets, tree, isFullAccess, user?.default_outlet_id]);

  const setScope = useCallback((next) => {
    const v = { level: next.level, brandId: next.brandId || null, outletId: next.outletId || null };
    queryClient.removeQueries(); // cache react-query tidak memuat konteks di key-nya
    setSaved(v);
    writeCache(v);
    api.put("/preferences/me", { work_scope: { level: v.level, brand_id: v.brandId, outlet_id: v.outletId } })
      .catch(() => { /* tetap berlaku di browser ini */ });
  }, []);

  const value = useMemo(() => {
    const outlet = scope.level === "outlet" ? scopedOutlets.find((o) => o.id === scope.outletId) || null : null;
    const brand = scope.brandId ? tree.find((b) => b.id === scope.brandId) || null : null;
    const contextOutlets = scope.level === "outlet" ? (outlet ? [outlet] : [])
      : scope.level === "brand" ? (brand?.outlets || []) : scopedOutlets;
    const params = scope.level === "outlet" ? { outlet_id: scope.outletId }
      : scope.level === "brand" ? { brand_id: scope.brandId } : {};
    // Di render (bukan effect): fetch pertama halaman anak sudah membawa konteks.
    setRequestScope(params);
    const groupLabel = isFullAccess ? "Semua brand" : "Semua toko saya";
    const label = outlet ? outlet.name : brand ? brand.name : groupLabel;
    const sublabel = outlet ? (brandName(outlet.brand_id) !== outlet.name ? brandName(outlet.brand_id) : "")
      : brand ? `Semua toko (${brand.outlets.length})` : isFullAccess ? "Konsolidasi Group" : `${scopedOutlets.length} toko`;
    return {
      loaded,
      scope,
      scopeKey: `${scope.level}:${scope.brandId || ""}:${scope.outletId || ""}`,
      setScope,
      params,
      label,
      sublabel,
      groupLabel,
      brand,
      outlet,
      tree,
      brands,
      allOutlets: outlets,
      scopedOutlets,
      contextOutlets,
      isFullAccess,
      isSingleStore: contextOutlets.length === 1,
      // Pemilih aktif hanya bila ada lebih dari satu pilihan
      canSwitch: scopedOutlets.length > 1,
      brandName,
    };
  }, [loaded, scope, setScope, scopedOutlets, tree, brands, outlets, isFullAccess, brandName]);

  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
}

export function useScope() {
  const ctx = useContext(ScopeContext);
  if (!ctx) throw new Error("useScope must be used within <ScopeProvider>");
  return ctx;
}

/**
 * Filter Toko lokal: `params` = konteks global, atau { outlet_id } bila user memilih satu toko di halaman ini.
 * `options` kosong bila konteks hanya berisi 1 toko (filter tidak perlu ditampilkan).
 */
export function useStoreFilter() {
  const ctx = useScope();
  const [storeId, setStoreId] = useState("");
  const { contextOutlets, scope } = ctx;
  useEffect(() => setStoreId(""), [scope.level, scope.brandId, scope.outletId]);
  const valid = storeId && contextOutlets.some((o) => o.id === storeId) ? storeId : "";
  const params = valid ? { outlet_id: valid } : ctx.params;
  return {
    ...ctx,
    storeId: valid,
    setStoreId,
    options: contextOutlets.length > 1 ? contextOutlets : [],
    params,
    // toko yang tampil di halaman (1 bila filter dipakai)
    outletIds: valid ? [valid] : contextOutlets.map((o) => o.id),
    allLabel: scope.level === "brand" && ctx.brand ? `Semua toko ${ctx.brand.name}` : `Semua toko (${contextOutlets.length})`,
  };
}

const slug = (s) => (s || "").normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");

/**
 * Penanda konteks untuk nama file ekspor: "Group", "Toko-saya", nama brand, atau nama toko (bila satu toko dipilih
 * di halaman). Pakai `withScopeTag(filename, tag)`.
 */
export function scopeTag(ctx, storeId = "") {
  if (storeId) return slug(ctx.allOutlets.find((o) => o.id === storeId)?.name || "");
  if (ctx.scope.level === "group") return ctx.isFullAccess ? "Group" : "Toko-saya";
  return slug(ctx.label);
}

export function useScopeTag(storeId = "") {
  return scopeTag(useScope(), storeId);
}

/** Toko tunggal yang dipilih lewat parameter request (outlet_id / dim_outlet / outlet_ids berisi satu id). */
export function storeFromParams(params) {
  const p = params instanceof URLSearchParams ? Object.fromEntries(params) : params || {};
  const one = p.outlet_id || p.dim_outlet || (p.outlet_ids && !String(p.outlet_ids).includes(",") ? p.outlet_ids : "");
  return one || "";
}

/** "PL-2026-11.csv" + "The-Coffeeshop" → "PL-2026-11_The-Coffeeshop.csv". */
export function withScopeTag(filename, tag) {
  if (!tag) return filename;
  const i = filename.lastIndexOf(".");
  return i > 0 ? `${filename.slice(0, i)}_${tag}${filename.slice(i)}` : `${filename}_${tag}`;
}
