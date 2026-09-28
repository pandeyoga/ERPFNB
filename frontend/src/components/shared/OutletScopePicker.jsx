/**
 * OutletScopePicker — consistent outlet selector across all pages.
 *
 * - Full-access users: shows "All Outlets" + scoped outlet list
 * - Outlet staff: shows ONLY their assigned outlets (cannot see others)
 * - Auto-selects default_outlet_id if set on the user
 *
 * Props:
 *   value         string     selected outlet_id (controlled)
 *   onChange      fn(id)     called when selection changes
 *   outlets       array      list of { id, name, brand_name } — from useOutletScope
 *   isFullAccess  bool       whether user has full access (show "All" option)
 *   allowAll      bool       whether to show "All Outlets" option (default true for full-access)
 *   className     string
 */
import { Store, Globe2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export default function OutletScopePicker({
  value = "",
  onChange,
  outlets = [],
  isFullAccess = true,
  allowAll = true,
  className,
  placeholder = "Semua Outlet",
  "data-testid": testId = "outlet-scope-picker",
}) {
  const showAllOption = isFullAccess && allowAll;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Scope indicator badge for restricted users */}
      {!isFullAccess && outlets.length > 0 && (
        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium border border-amber-500/20 flex-shrink-0">
          <Store className="h-3 w-3" />
          Outlet Anda
        </span>
      )}
      {isFullAccess && value === "" && (
        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 font-medium border border-green-500/20 flex-shrink-0">
          <Globe2 className="h-3 w-3" />
          Semua
        </span>
      )}

      <Select value={value || "__all__"} onValueChange={(v) => onChange?.(v === "__all__" ? "" : v)}>
        <SelectTrigger className="glass-input min-w-[200px]" data-testid={testId}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {showAllOption && (
            <SelectItem value="__all__">
              <span className="flex items-center gap-2">
                <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
                Semua Outlet
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
                {o.brand_name && (
                  <span className="text-[10px] text-muted-foreground pl-5">{o.brand_name}</span>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
