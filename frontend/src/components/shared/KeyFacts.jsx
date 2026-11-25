/**
 * KeyFacts — fakta kunci dokumen di header halaman detail (DESIGN_SYSTEM §10.10; pola "header facets" Fiori object page).
 * Dipasang sebagai `children` PageHeader: status, tanggal, nominal, toko, dokumen sumber — menggantikan kartu tipis
 * berisi label/nilai di bawah judul.
 *
 *   <PageHeader title=… subtitle=… actions=…>
 *     <KeyFacts items={[{ label: "Status", value: <StatusPill …/> }, { label: "Tanggal", value: "06 Nov 2026" }]} />
 *   </PageHeader>
 *
 * Item `hidden: true` dilewati; nilai kosong ditampilkan "—".
 */
import { cn } from "@/lib/utils";

export default function KeyFacts({ items, className, testId = "key-facts" }) {
  const list = items.filter((i) => i && !i.hidden);
  if (!list.length) return null;
  return (
    <dl className={cn("flex flex-wrap items-start gap-x-6 gap-y-2", className)} data-testid={testId}>
      {list.map((i) => (
        <div key={i.label} className="min-w-0" data-testid={i.testId}>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{i.label}</dt>
          <dd className={cn("mt-0.5 text-sm font-medium", i.numeric && "tabular-nums")}>
            {i.value === undefined || i.value === null || i.value === "" ? "—" : i.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
