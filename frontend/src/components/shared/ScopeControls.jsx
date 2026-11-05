/**
 * Kontrol konteks Brand/Toko di level halaman (DESIGN_SYSTEM §10.7). Konteks utamanya dipilih di TopNav.
 *
 *  - <StoreFilter filter={useStoreFilter()} />  filter Toko LOKAL; hanya muncul bila konteks berisi ≥ 2 toko.
 *                                                `bare` = tanpa label (untuk ListToolbar di dalam kartu tabel).
 *  - <GroupLevelBadge />                         halaman tingkat Group: datanya milik badan usaha, tidak mengikuti
 *                                                pilihan brand/toko (COA, Tax, Closing, Payment, Bank recon).
 *  - <ScopeNote show={belowGroup} />             catatan bila cakupan di bawah Group: transaksi pusat tidak ikut.
 */
import { Building, Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { cn } from "@/lib/utils";

const LABEL = "text-xs font-medium text-muted-foreground";

export function StoreFilter({ filter, bare = false, testId = "store-filter", className }) {
  if (!filter?.options?.length) return null;
  const select = (
    <SimpleSelect
      value={filter.storeId}
      onValueChange={filter.setStoreId}
      ariaLabel="Toko"
      options={[{ value: "", label: filter.allLabel }, ...filter.options.map((o) => ({ value: o.id, label: o.name }))]}
      placeholder={filter.allLabel}
      className={cn("glass-input w-full", !bare && "mt-1")}
      testId={testId}
    />
  );
  if (bare) return <div className={cn("w-52", className)}>{select}</div>;
  return (
    <div className={cn("min-w-[200px]", className)}>
      <Label className={LABEL}>Toko</Label>
      {select}
    </div>
  );
}

export function GroupLevelBadge({ className, testId = "group-level-badge" }) {
  return (
    <span
      className={cn("inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-muted-foreground shrink-0", className)}
      title="Data tingkat badan usaha (Group) — tidak mengikuti pilihan brand/toko di bagian atas"
      data-testid={testId}
    >
      <Building className="h-3.5 w-3.5" aria-hidden /> Tingkat Group
    </span>
  );
}

/** Cakupan di bawah Group (brand/toko/akses terbatas): transaksi pusat tanpa toko tidak termasuk. */
export function ScopeNote({ show, children, testId = "scope-note" }) {
  if (!show) return null;
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground" data-testid={testId}>
      <Info className="h-3.5 w-3.5 mt-px shrink-0" aria-hidden />
      <span>{children || "Tidak termasuk transaksi pusat (tanpa toko), mis. AR, payroll pusat, dan payment run."}</span>
    </p>
  );
}
