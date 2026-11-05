/**
 * useOutletScope — pilihan toko di halaman, DI DALAM konteks global TopNav (contexts/ScopeContext, DESIGN_SYSTEM §10.7).
 *
 * Halaman daftar/laporan (default):
 *   - scopedOutlets = toko dalam konteks (brand/toko yang dipilih di TopNav), dalam akses user
 *   - outletId      = filter Toko lokal; "" = semua toko dalam konteks. Kembali ke "" saat pindah menu.
 *   - params        = parameter API: { outlet_id } bila satu toko dipilih, selain itu konteks global
 *                     (GET tanpa parameter toko sudah otomatis membawa konteks lewat lib/api.js)
 *   - storeFilter   = props untuk <StoreFilter filter={storeFilter}/> (hanya tampil bila ≥ 2 toko)
 *
 * Form input (`{ form: true }`): scopedOutlets = semua toko dalam akses user; outletId awal = toko konteks bila
 * konteksnya satu toko (konteks hanya mengisi nilai awal, field tetap bisa diganti).
 *
 * allOutlets = semua toko (untuk lookup nama), tidak dibatasi konteks.
 */
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useScope } from "@/contexts/ScopeContext";

export default function useOutletScope(initialOutletId = "", { form = false } = {}) {
  const { user } = useAuth();
  const g = useScope();
  const withBrand = (list) => list.map((o) => ({ ...o, brand_name: g.brandName(o.brand_id) }));
  const scopedOutlets = useMemo(
    () => withBrand(form ? g.scopedOutlets : g.contextOutlets),
    [form, g.scopedOutlets, g.contextOutlets, g.brandName], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const allOutlets = useMemo(() => withBrand(g.allOutlets), [g.allOutlets, g.brandName]); // eslint-disable-line react-hooks/exhaustive-deps

  const single = g.contextOutlets.length === 1 ? g.contextOutlets[0].id : "";
  const [outletId, setOutletId] = useState(initialOutletId || single);
  useEffect(() => {
    if (!initialOutletId && !outletId && single) setOutletId(single);
  }, [single]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentOutlet = outletId ? allOutlets.find((o) => o.id === outletId) || null : null;
  const userOutletIds = user?.outlet_ids || [];
  const contextIds = g.contextOutlets.map((o) => o.id);
  const allLabel = g.scope.level === "brand" && g.brand ? `Semua toko ${g.brand.name}` : `Semua toko (${contextIds.length})`;

  return {
    outletId,
    setOutletId,
    scopedOutlets,
    allOutlets,
    currentOutlet,
    isFullAccess: g.isFullAccess,
    isRestricted: !g.isFullAccess,
    userOutletIds,
    loaded: g.loaded,
    params: outletId ? { outlet_id: outletId } : g.params,
    // cakupan di bawah Group → transaksi pusat (tanpa toko) tidak ikut; lihat <ScopeNote show/>
    belowGroup: !!outletId || g.scope.level !== "group" || !g.isFullAccess,
    // toko yang sedang tampil (untuk filter sisi klien & multi-select laporan)
    outletIds: outletId ? [outletId] : contextIds,
    allLabel,
    storeFilter: {
      storeId: outletId,
      setStoreId: setOutletId,
      options: !form && scopedOutlets.length > 1 ? scopedOutlets : [],
      allLabel,
    },
  };
}
