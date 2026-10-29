/**
 * OutletScopeHeader — sticky header that lives at the top of every Outlet
 * Portal page. Surfaces the currently-selected outlet and lets the user switch.
 *
 * Goals (UX):
 *  - Always visible: user never wonders "which outlet am I looking at?"
 *  - Persistent across navigation (state in OutletScopeContext + localStorage)
 *  - Hidden gracefully for outlet staff who only have access to 1 outlet (just
 *    shows a read-only badge so they still see context, no useless dropdown)
 */
import { Store, Globe2, Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOutletScopeCtx } from "./OutletScopeContext";

/** Pemilih outlet ringkas untuk area aksi PageHeader (DESIGN_SYSTEM §10.3: konteks layar bukan kartu di atas judul). */
export function OutletScopeCompact() {
  const { outletId, setOutletId, scopedOutlets, isFullAccess, allowAllOption, loaded } = useOutletScopeCtx();
  if (!loaded) return <div className="skeleton h-9 w-48 rounded-md" aria-hidden />;
  if (scopedOutlets.length === 0) {
    return (
      <span className="text-xs font-medium text-amber-800 dark:text-amber-400" data-testid="outlet-scope-header">
        Tidak ada outlet dalam scope Anda
      </span>
    );
  }
  if (!isFullAccess && scopedOutlets.length === 1) {
    const o = scopedOutlets[0];
    return (
      <span className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium"
        title="Outlet Anda" data-testid="outlet-scope-header">
        <Store className="h-4 w-4 text-muted-foreground" aria-hidden /> {o.name}
      </span>
    );
  }
  return (
    <div data-testid="outlet-scope-header">
      <Select value={outletId || "__all__"} onValueChange={(v) => setOutletId(v === "__all__" ? "" : v)}>
        <SelectTrigger className="glass-input w-52 justify-start gap-2 [&>svg:last-child]:ml-auto" aria-label="Pilih outlet aktif" data-testid="outlet-scope-picker">
          {outletId ? <Store className="h-4 w-4 shrink-0 text-muted-foreground" /> : <Globe2 className="h-4 w-4 shrink-0 text-muted-foreground" />}
          <SelectValue placeholder="Pilih outlet" />
        </SelectTrigger>
        <SelectContent>
          {allowAllOption && (
            <SelectItem value="__all__" data-testid="outlet-option-all">Semua Outlet ({scopedOutlets.length})</SelectItem>
          )}
          {scopedOutlets.map((o) => (
            <SelectItem key={o.id} value={o.id} data-testid={`outlet-option-${o.id}`}>
              {o.name}{o.brand_name ? ` · ${o.brand_name}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function OutletScopeHeader() {
  const {
    outletId,
    setOutletId,
    scopedOutlets,
    isFullAccess,
    allowAllOption,
    currentOutlet,
    loaded,
  } = useOutletScopeCtx();

  if (!loaded) {
    return (
      <div className="glass-card flex items-center gap-3 p-3 mb-3">
        <div className="skeleton h-4 w-32 rounded" />
      </div>
    );
  }

  // Outlet staff with only 1 outlet → no need for a dropdown, just a badge
  if (!isFullAccess && scopedOutlets.length === 1) {
    const o = scopedOutlets[0];
    return (
      <div
        className="glass-card flex items-center gap-2.5 px-4 py-2.5 mb-3"
        data-testid="outlet-scope-header"
      >
        <div className="h-8 w-8 rounded-[calc(var(--radius)-2px)] bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
          <Store className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            Outlet Aktif
          </div>
          <div className="text-sm font-semibold truncate">
            {o.name}
            {o.brand_name && (
              <span className="text-muted-foreground font-normal ml-1.5">
                · {o.brand_name}
              </span>
            )}
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-800 dark:text-amber-400 font-medium border border-amber-500/20 flex-shrink-0">
          Outlet Anda
        </span>
      </div>
    );
  }

  if (scopedOutlets.length === 0) {
    return (
      <div
        className="glass-card flex items-center gap-3 p-3 mb-3 border-amber-500/30"
        data-testid="outlet-scope-header"
      >
        <div className="h-8 w-8 rounded-[calc(var(--radius)-2px)] bg-amber-500/15 text-amber-800 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">Tidak ada outlet dalam scope Anda</div>
          <div className="text-xs text-muted-foreground">
            Hubungi admin untuk request akses outlet.
          </div>
        </div>
      </div>
    );
  }

  const selectedValue = outletId || "__all__";

  return (
    <div
      className="glass-card flex items-center gap-3 p-3 mb-3 flex-wrap"
      data-testid="outlet-scope-header"
    >
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <div className="h-8 w-8 rounded-[calc(var(--radius)-2px)] grad-aurora-soft flex items-center justify-center">
          {currentOutlet ? (
            <Store className="h-4 w-4" />
          ) : (
            <Globe2 className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            Outlet Aktif
          </div>
          <div className="text-sm font-semibold truncate">
            {currentOutlet
              ? currentOutlet.name
              : `Semua Outlet (${scopedOutlets.length})`}
            {currentOutlet?.brand_name && (
              <span className="text-muted-foreground font-normal ml-1.5">
                · {currentOutlet.brand_name}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1" />

      <Select
        value={selectedValue}
        onValueChange={(v) => setOutletId(v === "__all__" ? "" : v)}
      >
        <SelectTrigger
          className="glass-input min-w-[220px] max-w-[280px]"
          aria-label="Pilih outlet aktif"
          data-testid="outlet-scope-picker"
        >
          <SelectValue placeholder="Pilih Outlet" />
        </SelectTrigger>
        <SelectContent>
          {allowAllOption && (
            <SelectItem value="__all__" data-testid="outlet-option-all">
              <span className="flex items-center gap-2">
                <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
                Semua Outlet ({scopedOutlets.length})
              </span>
            </SelectItem>
          )}
          {scopedOutlets.map((o) => (
            <SelectItem key={o.id} value={o.id} data-testid={`outlet-option-${o.id}`}>
              <span className="flex flex-col">
                <span className="flex items-center gap-1.5">
                  <Store className="h-3.5 w-3.5 text-muted-foreground" />
                  {o.name}
                </span>
                {o.brand_name && (
                  <span className="text-xs text-muted-foreground pl-5">
                    {o.brand_name}
                  </span>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isFullAccess && !currentOutlet && (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 font-medium border border-emerald-500/20 flex-shrink-0">
          <Globe2 className="h-3 w-3" />
          Agregat
        </span>
      )}
      {!isFullAccess && !currentOutlet && scopedOutlets.length > 1 && (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-800 dark:text-amber-400 font-medium border border-amber-500/20 flex-shrink-0">
          <Store className="h-3 w-3" />
          Outlet Anda
        </span>
      )}
    </div>
  );
}
