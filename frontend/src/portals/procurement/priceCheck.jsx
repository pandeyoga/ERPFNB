/** Cek harga di titik keputusan (form PO, detail PO): acuan wilayah toko & satuan yang sama, penawaran vendor
 *  terpilih, dan penawaran termurah. Ambang = Pengaturan Sourcing (`alert_pct`). API: POST /sourcing/price-check. */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api, { unwrap } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { permitted } from "@/lib/portalGate";
import { fmtRp } from "@/lib/format";

const PERMS = ["procurement.sourcing.read", "procurement.po.create", "procurement.po.approve"];

function useDebounced(value, ms = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** lines: [{ item_id, unit, unit_cost }] → { checks: [per baris | null], alertPct }. */
export function usePriceCheck({ lines, outletId, vendorId, on }) {
  const { user } = useAuth();
  const allowed = PERMS.some((p) => permitted(user, p));
  const sig = JSON.stringify((lines || []).map((l) => [l.item_id || null, l.unit || null, Number(l.unit_cost || 0)]));
  const key = useDebounced(`${sig}|${outletId || ""}|${vendorId || ""}|${on || ""}`);
  // dari kunci yang sudah di-debounce: jangan memanggil dengan baris lama/kosong sebelum debounce selesai
  const hasItems = useMemo(() => JSON.parse(key.split("|")[0] || "[]").some(([id]) => id), [key]);
  const { data } = useQuery({
    queryKey: ["sourcing", "price-check", key],
    enabled: allowed && hasItems,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const [s, o, v, d] = key.split("|");
      const body = JSON.parse(s).map(([item_id, unit, unit_cost]) => ({ item_id, unit, unit_cost }));
      return unwrap(await api.post("/sourcing/price-check", { lines: body, outlet_id: o || null, vendor_id: v || null, on: d || null }));
    },
  });
  return useMemo(() => ({ checks: data?.lines || [], alertPct: data?.alert_pct ?? 10 }), [data]);
}

/** Catatan kecil di bawah baris: acuan (+%), penawaran vendor ini, penawaran termurah. */
export function PriceCheckNote({ check, alertPct, unitCost, testId, alignEnd = false }) {
  if (!check) return null;
  const { benchmark, vs_benchmark_pct: d, vendor_offer: own, best_offer: best, flags = [] } = check;
  if (!benchmark && !own && !best) return null;
  const tone = d == null ? "text-muted-foreground"
    : d > alertPct ? "text-red-700 dark:text-red-400"
      : d > 0 ? "text-orange-800 dark:text-orange-400" : "text-green-700 dark:text-green-400";
  return (
    <div className={`text-xs mt-0.5 space-y-0.5 ${alignEnd ? "text-right" : ""}`} data-testid={testId}>
      {benchmark && (
        <div className={`flex flex-wrap items-center gap-x-1 ${alignEnd ? "justify-end" : ""}`}>
          <span className="text-muted-foreground">Acuan {benchmark.label}{benchmark.stale ? " (periode lalu)" : ""}:</span>
          <span className="tabular-nums">{fmtRp(benchmark.price)}</span>
          {d != null && Number(unitCost) > 0 && (
            <span className={`font-semibold tabular-nums ${tone}`}>({d > 0 ? "+" : ""}{d}%)</span>
          )}
        </div>
      )}
      {flags.includes("above_vendor_offer") && (
        <div className="text-amber-800 dark:text-amber-400">Di atas penawaran vendor ini {fmtRp(own.price)}</div>
      )}
      {flags.includes("cheaper_offer") && best && (
        <div className="text-muted-foreground">
          Termurah: <span className="tabular-nums text-foreground">{fmtRp(best.price)}</span> · {best.vendor_name || "supplier lain"}
        </div>
      )}
    </div>
  );
}

/** Ringkasan untuk penyetuju: berapa baris di atas ambang. */
export function priceCheckSummary(checks, alertPct) {
  const above = (checks || []).filter((c) => c?.flags?.includes("above_benchmark"));
  const overOffer = (checks || []).filter((c) => c?.flags?.includes("above_vendor_offer"));
  return { above: above.length, overOffer: overOffer.length, alertPct };
}
