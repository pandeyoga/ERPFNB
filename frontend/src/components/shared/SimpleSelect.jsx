/** SimpleSelect — thin wrapper over shadcn Select with a native dropdown-like API.
 *
 *  Why: migrating dozens of native dropdown elements to shadcn is error-prone,
 *  chiefly because shadcn SelectItem FORBIDS an empty-string value ("") which
 *  native dropdowns commonly use for an "All" option. SimpleSelect transparently
 *  maps "" (and null/undefined) ↔ an internal sentinel so callers keep using ""
 *  as the value for "All". See UX Usability Standard §Form.
 *
 *  Usage (drop-in for the common filter pattern):
 *    <SimpleSelect
 *      value={vendorId}
 *      onValueChange={(v) => { setVendorId(v); setPage(1); }}
 *      options={[{ value: "", label: "Semua" }, ...vendors.map(v => ({ value: v.id, label: v.name }))]}
 *      placeholder="Semua"
 *      className="w-full"
 *      testId="po-filter-vendor"
 *    />
 */
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const EMPTY = "__all__";
const toUI = (v) => (v === "" || v === null || v === undefined ? EMPTY : String(v));
const fromUI = (v) => (v === EMPTY ? "" : v);

export default function SimpleSelect({
  value,
  onValueChange,
  options = [],
  placeholder,
  className = "",
  triggerClassName = "",
  disabled = false,
  testId,
  "data-testid": dataTestId,
  ariaLabel,
}) {
  return (
    <Select value={toUI(value)} onValueChange={(v) => onValueChange?.(fromUI(v))} disabled={disabled}>
      <SelectTrigger className={className || triggerClassName} data-testid={testId || dataTestId} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={String(o.value)} value={toUI(o.value)} disabled={o.disabled}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
