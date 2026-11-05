/**
 * RowActions — aksi baris tabel (DESIGN_SYSTEM §10.1): maksimal SATU tombol terlihat + menu "⋯" untuk sisanya, supaya
 * kolom aksi tidak melebar dan tombol tidak terpotong di tepi tabel.
 *
 *   <RowActions
 *     primary={{ label: "Setujui", icon: CheckCircle2, onClick, testId }}
 *     items={[{ label: "Tolak", icon: XCircle, onSelect, destructive: true, testId }]}
 *   />
 *
 * Item dengan `hidden: true` dilewati. Bila tidak ada `primary`, item pertama dijadikan tombol — kecuali
 * `promote={false}` (baris tanpa aksi utama cukup menampilkan "⋯").
 * `primary` boleh berupa elemen React (mis. <AsyncButton size="sm" variant="outline">) untuk aksi dengan status sibuk.
 */
import { isValidElement } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export default function RowActions({ primary, items = [], testId, label = "Aksi lain", promote = true }) {
  const visible = items.filter((i) => i && !i.hidden);
  const element = isValidElement(primary) ? primary : null;
  let main = !element && primary && !primary.hidden ? primary : null;
  let rest = visible;
  if (promote && !element && !main && visible.length) [main, ...rest] = visible;
  if (!element && !main && !rest.length) return null;
  const MainIcon = main?.icon;
  return (
    <div className="inline-flex items-center gap-1" data-testid={testId}>
      {element}
      {main && (
        <Button size="sm" variant={main.variant || "outline"} onClick={main.onClick || main.onSelect} disabled={main.disabled}
          className={cn(main.destructive && "text-destructive hover:text-destructive")} data-testid={main.testId}>
          {MainIcon && <MainIcon />} {main.label}
        </Button>
      )}
      {rest.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label={label} data-testid={testId ? `${testId}-more` : undefined}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {rest.map((i) => {
              const Icon = i.icon;
              return (
                <DropdownMenuItem key={i.label} onSelect={i.onSelect || i.onClick} disabled={i.disabled}
                  className={cn(i.destructive && "text-destructive focus:text-destructive")} data-testid={i.testId}>
                  {Icon && <Icon className="h-4 w-4" />} {i.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
