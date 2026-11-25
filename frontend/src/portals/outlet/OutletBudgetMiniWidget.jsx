/**
 * Outlet Home compact widget — mini gauges for budget.
 * Used at the top of Outlet Today's Workbench.
 *
 * Renders adaptively based on budget_mode:
 *  - combined  → 1 single big gauge (one combined budget)
 *  - per_bucket → 3 mini gauges (KDO/FDO/BDO)
 */
import { useEffect, useState } from "react";
import { Wallet, ArrowRight, AlertCircle, Globe2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { fmtRp } from "@/lib/format";
import {
  BUCKETS, BUCKET_COLORS, fetchMyCurrent, paceColor,
} from "@/lib/outletBudgetApi";
import { useOutletScopeCtx } from "./OutletScopeContext";

export default function OutletBudgetMiniWidget({ scope = "monthly" }) {
  const { outletId: scopeOutletId, currentOutlet } = useOutletScopeCtx();
  const [data, setData] = useState(null);
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetchMyCurrent();
        const items = res.items || [];
        setAllItems(items);
        // Pick by scope, fallback to first
        let target = null;
        if (scopeOutletId) {
          target = items.find(i => i.outlet_id === scopeOutletId) || null;
        }
        if (!target) target = items[0] || null;
        setData(target);
      } catch (e) { /* ignore */ }
      setLoading(false);
    })();
  }, [scopeOutletId]);

  if (loading) return null;

  const aggregateMode = !scopeOutletId && allItems.length > 1;
  const current = scope === "weekly" ? data?.weekly : data?.monthly;
  const mode = current?.budget_mode || "per_bucket";

  return (
    // Satu target klik yang jelas (link ke Outlet Budget) — bisa difokus keyboard.
    <Link to="/outlet/budget" className="block rounded-[var(--radius)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Buka Outlet Budget">
    <Card
      className="hover:border-aurora/40 transition-colors"
      data-testid="outlet-budget-mini"
    >
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm md:text-base font-semibold flex-wrap">
            <Wallet className="h-4 w-4 text-aurora" />
            Outlet Budget · {scope === "weekly" ? "Minggu Ini" : "Bulan Ini"}
            {data?.outlet_name && (
              <span className="text-xs font-normal text-muted-foreground">
                · {data.outlet_name}
              </span>
            )}
            {aggregateMode && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-800 dark:text-blue-400 font-medium border border-blue-500/20 flex items-center gap-1">
                <Globe2 className="h-2.5 w-2.5" />
                {data?.outlet_name || "outlet pertama"}
              </span>
            )}
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </div>
        {!current ? (
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400 text-sm">
            <AlertCircle className="h-4 w-4" />
            Budget belum ditetapkan Executive
          </div>
        ) : mode === "combined" ? (
          <CombinedGauge current={current} />
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {BUCKETS.map((bk) => {
              const cell = current.pace?.[bk] || {};
              return (
                <div key={bk}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: BUCKET_COLORS[bk] }}>
                      {bk}
                    </span>
                    <span className={`text-xs font-semibold ${paceColor(cell.status)}`}>
                      {(cell.pct_used || 0).toFixed(0)}%
                    </span>
                  </div>
                  <Progress
                    value={Math.min(100, cell.pct_used || 0)}
                    className="h-1.5"
                  />
                  <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                    sisa {fmtRp(cell.remaining)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
    </Link>
  );
}

function CombinedGauge({ current }) {
  const cell = current.pace?.combined || {};
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
          Gabungan KDO + FDO + BDO
        </span>
        <span className={`text-sm font-semibold ${paceColor(cell.status)}`}>
          {(cell.pct_used || 0).toFixed(0)}%
        </span>
      </div>
      <Progress value={Math.min(100, cell.pct_used || 0)} className="h-2.5" />
      <div className="mt-1.5 flex items-center justify-between text-xs tabular-nums">
        <span className="text-muted-foreground">
          {fmtRp(cell.actual || 0)} / {fmtRp(cell.budget || 0)}
        </span>
        <span className="text-muted-foreground">
          sisa <span className="font-semibold text-foreground">{fmtRp(cell.remaining || 0)}</span>
        </span>
      </div>
    </div>
  );
}
