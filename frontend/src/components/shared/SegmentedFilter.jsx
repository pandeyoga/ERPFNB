/** SegmentedFilter — filter status/opsi kecil dengan tampilan Tabs terpadu (pill h-8, 13px).
 *
 * Dipakai untuk filter/rentang kecil ("Semua / Published / Draft", "7d / 14d / 30d", scope) di seluruh aplikasi,
 * menggantikan deretan tombol default/outline yang ukurannya tidak seragam.
 *
 * Props: value, onChange(value), options [{ value, label, testId? }], ariaLabel, testId
 */
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SegmentedFilter({ value, onChange, options, ariaLabel = "Filter", testId }) {
  return (
    <Tabs value={String(value)} onValueChange={onChange}>
      <TabsList aria-label={ariaLabel} data-testid={testId} data-segmented="">
        {options.map((o) => (
          <TabsTrigger key={o.value} value={String(o.value)} data-testid={o.testId}>
            {o.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
