/** PageHeader — SATU-SATUNYA judul halaman (<h1>) di area konten.
 *
 * Token mengikuti docs/DESIGN_SYSTEM.md: title `text-xl md:text-2xl font-semibold`, subtitle `text-xs md:text-sm`,
 * ikon 32px, jarak bawah `mb-3 md:mb-4`. Breadcrumb lokasi sudah ada di TopNav.
 *
 * Anatomi (DESIGN_SYSTEM §10.1): aksi layar SELALU di kanan judul. Pada hub ber-tab:
 *  - hub membungkus isinya dengan <HubHeaderProvider> dan memberi prop `hub` pada PageHeader-nya;
 *  - halaman tab tetap memakai <PageHeader subtitle actions/> biasa. Di dalam hub, PageHeader itu tidak
 *    membuat <h1> kedua, tetapi MENGISI subtitle & aksi header hub (lewat portal), sehingga header hub
 *    selalu mewakili tab yang aktif.
 *
 * Props:
 *  - icon, title, subtitle
 *  - actions (alias lama: action) — tombol aksi layar, rata kanan
 *  - children — baris tambahan di bawah judul (mis. chip filter/status)
 *  - hub — PageHeader milik hub (menyediakan slot untuk tab aktif)
 *
 * Konteks layar (mis. pemilih "Outlet aktif" di portal Outlet) masuk lewat <PageHeaderExtrasProvider extras>:
 * PageHeader halaman menampilkannya paling kiri di area aksi — bukan kartu terpisah di atas judul (§10.3).
 */
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const HubHeaderContext = createContext(null);

/** Bungkus seluruh isi hub (termasuk PageHeader `hub`) agar header tab bisa mengisi header hub. */
export function HubHeaderProvider({ children }) {
  const [actionsEl, setActionsEl] = useState(null);
  const [subtitleEl, setSubtitleEl] = useState(null);
  const [filled, setFilled] = useState(0); // jumlah header tab yang menyediakan subtitle
  const value = useMemo(
    () => ({ actionsEl, setActionsEl, subtitleEl, setSubtitleEl, filled, setFilled }),
    [actionsEl, subtitleEl, filled],
  );
  return <HubHeaderContext.Provider value={value}>{children}</HubHeaderContext.Provider>;
}

const ExtrasContext = createContext(null);

/** extras = node konteks layar; `onConsumed(n)` memberi tahu berapa PageHeader yang menampilkannya (0 = tidak ada). */
export function PageHeaderExtrasProvider({ extras, children }) {
  const [consumed, setConsumed] = useState(0);
  const value = useMemo(() => ({ extras, consumed, setConsumed }), [extras, consumed]);
  return <ExtrasContext.Provider value={value}>{children}</ExtrasContext.Provider>;
}

export function usePageHeaderExtrasConsumed() {
  return useContext(ExtrasContext)?.consumed ?? 0;
}

function ExtrasSlot({ ex }) {
  const { setConsumed } = ex;
  useLayoutEffect(() => {
    setConsumed((n) => n + 1);
    return () => setConsumed((n) => n - 1);
  }, [setConsumed]);
  return ex.extras;
}

const SUBTITLE = "text-xs md:text-sm text-muted-foreground leading-[1.3] mt-0.5";

function HubSlotFill({ ctx, subtitle, actions, children }) {
  const { setFilled } = ctx;
  const hasSubtitle = !!subtitle;
  useEffect(() => {
    if (!hasSubtitle) return undefined;
    setFilled((n) => n + 1);
    return () => setFilled((n) => n - 1);
  }, [hasSubtitle, setFilled]);
  return (
    <>
      {hasSubtitle && ctx.subtitleEl ? createPortal(subtitle, ctx.subtitleEl) : null}
      {actions && ctx.actionsEl ? createPortal(actions, ctx.actionsEl) : null}
      {children ? <div>{children}</div> : null}
    </>
  );
}

export default function PageHeader({
  icon: Icon,
  title,
  subtitle,
  action,
  actions,
  children,
  hub = false,
  colorClass = "grad-aurora",
  className,
  testId = "page-header",
}) {
  const ctx = useContext(HubHeaderContext);
  const ex = useContext(ExtrasContext);
  const slot = actions ?? action;
  if (ctx && !hub) return <HubSlotFill ctx={ctx} subtitle={subtitle} actions={slot}>{children}</HubSlotFill>;
  const hubSlots = hub && ctx;
  const showOwnSubtitle = subtitle && !(hubSlots && ctx.filled > 0);
  return (
    <div className={cn("mb-3 md:mb-4", className)} data-testid={testId}>
      {/* Judul mengisi sisa lebar (subtitle boleh 2 baris); aksi tidak pernah turun ke baris sendiri di ≥ md. */}
      <div className="flex items-start md:items-center justify-between gap-3 flex-wrap md:flex-nowrap">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {Icon && (
            <div className={cn("h-8 w-8 rounded-[calc(var(--radius)-2px)] flex items-center justify-center shrink-0", colorClass)}>
              <Icon className="h-4 w-4 text-white" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-semibold leading-[1.2] tracking-[-0.015em] truncate" data-testid="page-header-title">
              {title}
            </h1>
            {hubSlots && <p ref={ctx.setSubtitleEl} className={SUBTITLE} hidden={!ctx.filled} data-testid="page-header-subtitle-tab" />}
            {showOwnSubtitle && <p className={SUBTITLE}>{subtitle}</p>}
          </div>
        </div>
        {(slot || hubSlots || ex?.extras) && (
          <div className="flex items-center gap-2 flex-wrap md:flex-nowrap justify-end shrink-0 ml-auto" data-testid="page-header-actions">
            {ex?.extras && <ExtrasSlot ex={ex} />}
            {slot}
            {hubSlots && <div ref={ctx.setActionsEl} className="contents" />}
          </div>
        )}
      </div>
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
