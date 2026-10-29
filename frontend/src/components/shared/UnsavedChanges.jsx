/**
 * Perubahan belum disimpan (DESIGN_SYSTEM §10.4).
 *
 *  - useDirtyState(value, ready)  → { dirty, markSaved }: bandingkan nilai form dengan snapshot saat `ready`
 *                                    (data selesai dimuat) atau saat terakhir disimpan.
 *  - useUnsavedChanges(dirty)     → selama dirty: peringatan browser saat tab ditutup/di-refresh, dan
 *                                    <UnsavedChangesGuard/> menahan klik menu/link ke halaman lain.
 *  - confirmDiscard()             → panggil sebelum berpindah entitas/tab di dalam halaman.
 *  - <UnsavedChangesGuard/>        → mount SEKALI di dalam Router (App.js).
 *  - <FormActionBar dirty>         → bar aksi sticky di bawah form: penanda + tombol (Batal · Simpan · Ajukan).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/components/shared/confirmDialog";

const dirtySources = new Set();

export function hasUnsavedChanges() {
  return dirtySources.size > 0;
}

/** Tanya user sebelum membuang perubahan. true = boleh lanjut (tidak ada perubahan, atau user setuju). */
export async function confirmDiscard() {
  if (!hasUnsavedChanges()) return true;
  const ok = await confirmDialog({
    title: "Buang perubahan?",
    description: "Ada perubahan yang belum disimpan. Jika lanjut, perubahan tersebut hilang.",
    confirmText: "Buang perubahan",
    cancelText: "Kembali",
    destructive: true,
  });
  if (ok) dirtySources.clear();
  return ok;
}

export function useUnsavedChanges(dirty) {
  useEffect(() => {
    if (!dirty) return undefined;
    const id = Symbol("dirty");
    dirtySources.add(id);
    const onBeforeUnload = (e) => {
      if (!dirtySources.has(id)) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      dirtySources.delete(id);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [dirty]);
}

export function useDirtyState(value, ready = true) {
  const current = JSON.stringify(value ?? null);
  const [base, setBase] = useState(null);
  const currentRef = useRef(current);
  currentRef.current = current;
  useEffect(() => {
    if (ready && base === null) setBase(currentRef.current);
    if (!ready && base !== null) setBase(null);
  }, [ready, base]);
  const markSaved = useCallback(() => setBase(currentRef.current), []);
  return { dirty: base !== null && current !== base, markSaved };
}

/** Menahan klik <a href> internal (sidebar, breadcrumb, Link) saat ada perubahan belum disimpan. */
export function UnsavedChangesGuard() {
  const navigate = useNavigate();
  const location = useLocation();
  const locRef = useRef(location);
  locRef.current = location;
  useEffect(() => {
    const onClick = async (e) => {
      if (!hasUnsavedChanges() || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest && e.target.closest("a[href]");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const cur = locRef.current;
      if (url.pathname === cur.pathname && url.search === cur.search) return;
      e.preventDefault();
      e.stopPropagation();
      if (await confirmDiscard()) navigate(url.pathname + url.search + url.hash);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [navigate]);
  return null;
}

/** Bar aksi form, menempel di bawah layar selama form terlihat. children = tombol (Batal, Simpan draft, Ajukan). */
export function FormActionBar({ dirty = false, hint, children, className, testId = "form-action-bar" }) {
  useUnsavedChanges(dirty);
  return (
    <div className={cn("sticky bottom-3 z-20 mt-3", className)} data-testid={testId}>
      <div className="glass-card p-3 flex items-center justify-between gap-3 flex-wrap shadow-lg">
        <div className="text-xs text-muted-foreground min-w-0" aria-live="polite" data-testid={`${testId}-status`}>
          {dirty ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-400">
              <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
              Perubahan belum disimpan
            </span>
          ) : hint}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">{children}</div>
      </div>
    </div>
  );
}

export default FormActionBar;
