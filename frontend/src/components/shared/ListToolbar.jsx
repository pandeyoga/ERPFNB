/**
 * ListToolbar — toolbar daftar di bagian ATAS kartu tabel (DESIGN_SYSTEM §10.3): filter menempel pada tabel
 * yang difilternya (satu kotak), satu baris pada layar lebar:
 *
 *   [cari]  [status ≤ 5 tab · Status lain ▾]  [filter …]                 [aksi kartu]
 *
 * Pemakaian: di dalam kartu tabel (glass-card overflow-hidden), sebelum komponen tabelnya —
 *   ListToolbar(search = ListSearch, actions = aksi tabel) berisi StatusTabs / filter lain.
 *
 * Aksi layar (Buat …, Ekspor semua) tetap di PageHeader; `actions` di sini hanya untuk aksi milik tabel ini.
 */
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function ListToolbar({ search, children, actions, className, testId }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 p-3 border-b border-border/50", className)} data-testid={testId}>
      {search}
      {children}
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function ListSearch({ value, onChange, placeholder = "Cari…", ariaLabel, testId, className }) {
  return (
    <div className={cn("relative w-full sm:w-64", className)}>
      <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder}
        className="glass-input pl-9"
        data-testid={testId}
      />
    </div>
  );
}

/**
 * Tab status: maksimal `max` tab terlihat, sisanya di menu "Status lain" (label menu = status terpilih bila aktif).
 * options: [{ key, label }]; `tabTestId(key)` untuk data-testid tiap pilihan.
 */
export function StatusTabs({ value, onChange, options, max = 5, ariaLabel = "Filter status", testId, tabTestId }) {
  const visible = options.slice(0, max);
  const rest = options.slice(max);
  const activeRest = rest.find((o) => o.key === value);
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <Tabs value={activeRest ? "" : value} onValueChange={onChange}>
        <TabsList data-testid={testId} aria-label={ariaLabel}>
          {visible.map((o) => (
            <TabsTrigger key={o.key} value={o.key} data-testid={tabTestId ? tabTestId(o.key) : undefined}>
              {o.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {rest.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant={activeRest ? "default" : "outline"}
              aria-pressed={!!activeRest}
              data-testid={testId ? `${testId}-more` : undefined}
            >
              {activeRest ? activeRest.label : "Status lain"} <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {rest.map((o) => (
              <DropdownMenuItem key={o.key} onSelect={() => onChange(o.key)} data-testid={tabTestId ? tabTestId(o.key) : undefined}>
                {o.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

/**
 * MoreFilters — filter sekunder di balik satu tombol (DESIGN_SYSTEM §10.9; Polaris: 2–3 filter utama terlihat,
 * sisanya di "More filters"; Fiori: tampilkan jumlah filter yang aktif). `count` = filter non-default yang aktif.
 */
export function MoreFilters({ label = "Filter lain", count = 0, children, testId = "more-filters", align = "end" }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" data-testid={testId} aria-label={count ? `${label} (${count} aktif)` : label}>
          <SlidersHorizontal /> {label}
          {count > 0 && (
            <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-[11px] font-semibold text-background">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-80 space-y-3" data-testid={`${testId}-panel`}>
        {children}
      </PopoverContent>
    </Popover>
  );
}
