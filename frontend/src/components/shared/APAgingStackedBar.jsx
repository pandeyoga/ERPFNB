/**
 * APAgingStackedBar — horizontal stacked bar of AP aging buckets.
 * Props: { buckets: {current, d_30, d_60, d_90, d_90p}, grand_total, top_vendors }
 */
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { fmtRp } from "@/lib/format";
import { cn } from "@/lib/utils";

const BUCKET_DEF = [
  { key: "current", label: "Current", color: "#10B981" },
  { key: "d_30", label: "30 hari", color: "#FBBF24" },
  { key: "d_60", label: "60 hari", color: "#F97316" },
  { key: "d_90", label: "90 hari", color: "#EF4444" },
  { key: "d_90p", label: "90+ hari", color: "#991B1B" },
];

export default function APAgingStackedBar({
  buckets = {}, grand_total = 0, top_vendors = [],
}) {
  const total = grand_total || Object.values(buckets).reduce((a, b) => a + (b || 0), 0);

  return (
    <div className="glass-card p-4" data-testid="ap-aging-widget">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm md:text-base font-semibold">AP Aging</h3>
        <Link
          to="/finance/payments-hub?tab=ap-aging"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          data-testid="ap-aging-detail-link"
        >
          Lihat detail <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {total <= 0 ? (
        <div className="text-sm text-muted-foreground italic">
          Tidak ada AP outstanding saat ini.
        </div>
      ) : (
        <>
          <div className="text-xl font-semibold tracking-[-0.02em] tabular-nums mb-2">{fmtRp(total)}</div>
          {/* Stacked bar */}
          <div className="h-3 w-full rounded-full overflow-hidden flex bg-foreground/5" data-testid="ap-aging-bar">
            {BUCKET_DEF.map(b => {
              const v = Number(buckets?.[b.key] || 0);
              const pct = total > 0 ? (v / total) * 100 : 0;
              if (pct <= 0) return null;
              return (
                <div
                  key={b.key}
                  className="h-full transition-all"
                  style={{ width: `${pct}%`, background: b.color }}
                  title={`${b.label}: ${fmtRp(v)}`}
                />
              );
            })}
          </div>
          {/* Legenda bucket sebagai daftar baris: tetap terbaca di kartu sempit (1/3 lebar) —
              grid 5 kolom sebelumnya membuat nominal saling menimpa. */}
          <ul className="mt-3 space-y-1" data-testid="ap-aging-buckets">
            {BUCKET_DEF.map(b => {
              const v = Number(buckets?.[b.key] || 0);
              const pct = total > 0 ? ((v / total) * 100).toFixed(1) : 0;
              return (
                <li key={b.key} className="flex items-center gap-2 text-xs" data-testid={`ap-aging-bucket-${b.key}`}>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: b.color }} aria-hidden />
                  <span className="text-muted-foreground">{b.label}</span>
                  <span className="ml-auto font-semibold tabular-nums">{fmtRp(v)}</span>
                  <span className="w-12 text-right text-muted-foreground tabular-nums">{pct}%</span>
                </li>
              );
            })}
          </ul>
          {top_vendors && top_vendors.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border/50">
              <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground mb-2">
                Top vendor (outstanding)
              </div>
              <div className="space-y-1.5">
                {top_vendors.slice(0, 3).map(v => (
                  <div
                    key={v.vendor_id}
                    className={cn(
                      "flex items-center justify-between text-sm",
                      "px-2 py-1.5 rounded-lg hover:bg-foreground/5",
                    )}
                  >
                    <span className="font-medium truncate">{v.vendor_name}</span>
                    <span className="font-semibold tabular-nums shrink-0 ml-2">{fmtRp(v.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
