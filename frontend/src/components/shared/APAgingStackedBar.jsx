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
    <div className="glass-card p-5" data-testid="ap-aging-widget">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">AP Aging</h3>
        <Link
          to="/finance/ap-aging"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          data-testid="ap-aging-detail-link"
        >
          Detail <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {total <= 0 ? (
        <div className="text-sm text-muted-foreground italic">
          Tidak ada AP outstanding saat ini.
        </div>
      ) : (
        <>
          <div className="text-2xl font-bold tabular-nums mb-2">{fmtRp(total)}</div>
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
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
            {BUCKET_DEF.map(b => {
              const v = Number(buckets?.[b.key] || 0);
              const pct = total > 0 ? ((v / total) * 100).toFixed(1) : 0;
              return (
                <div key={b.key} className="text-xs">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: b.color }}
                    />
                    <span className="text-muted-foreground">{b.label}</span>
                  </div>
                  <div className="font-semibold tabular-nums">{fmtRp(v)}</div>
                  <div className="text-muted-foreground">{pct}%</div>
                </div>
              );
            })}
          </div>
          {top_vendors && top_vendors.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border/50">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                Top Vendor (Outstanding)
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
                    <span className="font-bold tabular-nums shrink-0 ml-2">{fmtRp(v.total)}</span>
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
