/**
 * ScopeSwitcher — pemilih konteks kerja di TopNav: Semua brand › Brand › Toko (DESIGN_SYSTEM §10.7).
 * Dibaca bersama breadcrumb: *bisnis mana* › *menu apa*. User dengan 1 toko melihat label statis.
 */
import { useState } from "react";
import { Check, ChevronsUpDown, Globe2, Store, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { useScope } from "@/contexts/ScopeContext";
import { confirmDiscard } from "@/components/shared/UnsavedChanges";

function Option({ selected, onSelect, value, testId, indent, children, hint }) {
  return (
    <CommandItem value={value} onSelect={onSelect} data-testid={testId} className={cn(indent && "pl-8")}>
      <span className="flex-1 min-w-0 truncate">{children}</span>
      {hint && <span className="text-xs text-muted-foreground shrink-0 [[data-selected=true]_&]:text-current">{hint}</span>}
      <Check className={cn("h-4 w-4 shrink-0", selected ? "opacity-100" : "opacity-0")} aria-hidden />
    </CommandItem>
  );
}

export default function ScopeSwitcher() {
  const {
    loaded, scope, setScope, label, sublabel, tree, isFullAccess, scopedOutlets, canSwitch, groupLabel, brandName,
  } = useScope();
  const [open, setOpen] = useState(false);

  if (!loaded) return <div className="skeleton h-8 w-40 rounded-md shrink-0" aria-hidden />;
  if (scopedOutlets.length === 0) {
    return (
      <span className="text-xs font-medium text-amber-800 dark:text-amber-400 shrink-0" data-testid="scope-switcher">
        Tidak ada akses toko
      </span>
    );
  }

  const Icon = scope.level === "outlet" ? Store : scope.level === "brand" ? Building2 : Globe2;
  const face = (
    <>
      <Icon className="text-muted-foreground" aria-hidden />
      <span className="truncate max-w-[180px]" data-testid="scope-label">{label}</span>
      {sublabel && <span className="hidden 2xl:inline text-muted-foreground font-normal truncate max-w-[140px]">· {sublabel}</span>}
    </>
  );

  if (!canSwitch) {
    return (
      <span className="inline-flex h-8 items-center gap-1.5 px-1 text-sm font-medium shrink-0 [&_svg]:size-4"
        title="Toko Anda" data-testid="scope-switcher">
        {face}
      </span>
    );
  }

  const choose = async (next) => {
    setOpen(false);
    if (!(await confirmDiscard())) return; // ganti konteks memuat ulang halaman
    setScope(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0 max-w-[300px]" title={sublabel ? `${label} · ${sublabel}` : label}
          aria-label={`Konteks kerja: ${label}${sublabel ? ` (${sublabel})` : ""}. Ganti brand atau toko`}
          data-testid="scope-switcher">
          {face}
          <ChevronsUpDown className="text-muted-foreground" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <Command>
          <CommandInput placeholder="Cari brand / toko…" data-testid="scope-search" />
          <CommandList className="max-h-[360px]">
            <CommandEmpty>Tidak ada brand / toko yang cocok.</CommandEmpty>
            {scopedOutlets.length > 1 && (
              <>
                <CommandGroup>
                  <Option value={`__group__ ${groupLabel}`} selected={scope.level === "group"} testId="scope-option-group"
                    onSelect={() => choose({ level: "group" })} hint={isFullAccess ? "Konsolidasi" : `${scopedOutlets.length} toko`}>
                    <span className="font-medium">{groupLabel}</span>
                  </Option>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}
            <CommandGroup heading="Brand & toko">
              {tree.map((b) => (b.outlets.length === 1 ? (
                <Option key={b.id} value={`${b.name} ${b.outlets[0].name} ${b.outlets[0].code || ""}`}
                  selected={scope.level === "outlet" && scope.outletId === b.outlets[0].id}
                  testId={`scope-option-outlet-${b.outlets[0].id}`}
                  onSelect={() => choose({ level: "outlet", outletId: b.outlets[0].id, brandId: b.id })}
                  hint={b.outlets[0].name !== b.name ? brandName(b.id) : ""}>
                  {b.outlets[0].name}
                </Option>
              ) : (
                <div key={b.id}>
                  <Option value={`${b.name} semua toko`} selected={scope.level === "brand" && scope.brandId === b.id}
                    testId={`scope-option-brand-${b.id}`} onSelect={() => choose({ level: "brand", brandId: b.id })}
                    hint={b.outlets.length === b.total ? `${b.total} toko` : `${b.outlets.length} dari ${b.total} toko`}>
                    <span className="font-medium">{b.name}</span>
                  </Option>
                  {b.outlets.map((o) => (
                    <Option key={o.id} indent value={`${b.name} ${o.name} ${o.code || ""}`}
                      selected={scope.level === "outlet" && scope.outletId === o.id} testId={`scope-option-outlet-${o.id}`}
                      onSelect={() => choose({ level: "outlet", outletId: o.id, brandId: b.id })}>
                      {o.name}
                    </Option>
                  ))}
                </div>
              )))}
            </CommandGroup>
          </CommandList>
          <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
            Semua menu memakai pilihan ini. Menu tingkat Group (COA, Tax, Closing, Payment) tidak terpengaruh.
          </p>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
