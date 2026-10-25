/** SegmentedFilter — filter status/opsi kecil dengan tampilan Tabs terpadu (pill h-8, 13px).
 *
 * Dipakai untuk baris filter "Semua / Published / Draft" dsb. di CMS Studio & Monitoring,
 * menggantikan deretan tombol default/outline yang ukurannya tidak seragam.
 *
 * Props: value, onChange(value), options [{ value, label, testId? }], ariaLabel, testId
 */
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SegmentedFilter({ value, onChange, options, ariaLabel = "Filter", testId }) {
  return (
    <Tabs value={String(value)} onValueChange={onChange}>
      <TabsList aria-label={ariaLabel} data-testid={testId}>
        {options.map((o) => (
          <TabsTrigger key={o.value} value={String(o.value)} data-testid={o.testId}>
            {o.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
