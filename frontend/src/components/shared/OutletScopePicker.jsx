/**
 * OutletScopePicker — pemilih toko seragam (DESIGN_SYSTEM §10.7). Konteks Brand/Toko utama dipilih di TopNav.
 *
 * - Filter daftar (`allowAll`, default): pilihan = toko dalam konteks + "Semua toko ‹brand›". Tidak dirender bila
 *   konteks hanya berisi satu toko (TopNav sudah menyebut tokonya).
 * - Field form (`allowAll={false}`): selalu tampil; daftar = toko dalam akses user (dari useOutletScope form mode).
 *
 * Props:
 *   value / onChange(id)   toko terpilih ("" = semua)
 *   outlets                daftar { id, name, brand_name } — dari useOutletScope
 *   allowAll               tampilkan opsi "Semua toko"
 *   placeholder, className, triggerClassName, id, ariaLabel, data-testid
 */
import { Store, Globe2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useScope } from "@/contexts/ScopeContext";

export default function OutletScopePicker({
  value = "",
  onChange,
  outlets = [],
  allowAll = true,
  className,
  placeholder,
  "data-testid": testId = "outlet-scope-picker",
  id,
  ariaLabel = "Pilih toko",
  triggerClassName,
}) {
  const { scope, brand } = useScope();
  const allLabel = scope.level === "brand" && brand ? `Semua toko ${brand.name}` : `Semua toko (${outlets.length})`;
  if (allowAll && outlets.length <= 1) return null;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Select value={value || "__all__"} onValueChange={(v) => onChange?.(v === "__all__" ? "" : v)}>
        <SelectTrigger id={id} aria-label={ariaLabel} className={cn("glass-input min-w-[180px]", triggerClassName)} data-testid={testId}>
          <SelectValue placeholder={placeholder || (allowAll ? allLabel : "Pilih toko")} />
        </SelectTrigger>
        <SelectContent>
          {allowAll && (
            <SelectItem value="__all__">
              <span className="flex items-center gap-2">
                <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
                {allLabel}
              </span>
            </SelectItem>
          )}
          {outlets.map((o) => (
            <SelectItem key={o.id} value={o.id} data-testid={`outlet-option-${o.id}`}>
              <span className="flex flex-col">
                <span className="flex items-center gap-1.5">
                  <Store className="h-3.5 w-3.5 text-muted-foreground" />
                  {o.name}
                </span>
                {o.brand_name && o.brand_name !== o.name && (
                  <span className="text-xs text-muted-foreground pl-5">{o.brand_name}</span>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
