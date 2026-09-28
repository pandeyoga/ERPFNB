/** Phase 11E — KPI Snapshot strip for AI Q&A.
 * Shows 5 small tiles: cash, MTD revenue, net profit, pending approvals, anomalies.
 */
import { useEffect, useState } from "react";
import {
  Wallet, TrendingUp, AlertTriangle, ClipboardCheck, Receipt, RefreshCw,
} from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

function Tile({ label, value, sub, icon: Icon, tone = "text-foreground" }) {
  return (
    <div className="glass-card px-3 py-2.5 flex items-center gap-2 min-w-[140px]">
      <span className={cn("h-7 w-7 rounded-lg flex items-center justify-center", tone)}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">{label}</div>
        <div className="text-sm font-bold leading-tight truncate">{value}</div>
        {sub && <div className="text-[10px] text-muted-foreground truncate">{sub}</div>}
      </div>
    </div>
  );
}

export default function KpiSnapshotStrip() {
  const { can } = useAuth();
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setRefreshing(true);
    try {
      // Use owner cockpit if user has access — it bundles everything
      if (can("owner.cockpit.access")) {
        const r = await api.get("/owner/cockpit");
        const d = unwrap(r) || {};
        setData({
          cash:      d.cash_position?.net_liquid_cash || 0,
          revenue:   d.digest?.mtd_revenue || 0,
          ap_due:    d.digest?.ap_due_total || 0,
          pending:   d.digest?.pending_approvals || 0,
          anomalies: d.digest?.anomaly_count || 0,
          health:    d.cash_position?.health,
          runway:    d.cash_position?.days_runway,
        });
      } else {
        const [k, c] = await Promise.all([
          api.get("/executive/kpis").catch(() => ({ data: { data: null } })),
          api.get("/finance/cash/position").catch(() => ({ data: { data: null } })),
        ]);
        const ki = unwrap(k) || {};
        const ci = unwrap(c) || {};
        setData({
          cash:      ci.net_liquid_cash || 0,
          revenue:   ki.sales_mtd?.value || 0,
          ap_due:    ki.ap_exposure?.value || 0,
          pending:   ki.submitted_validations?.value || 0,
          anomalies: 0,
          health:    ci.health,
          runway:    ci.days_runway,
        });
      }
    } finally { setRefreshing(false); }
  }

  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, []);

  if (!data) return <div className="h-14 skeleton rounded-xl mb-3" />;

  const fmtJt = (v) => `Rp ${fmtNumber((v || 0) / 1_000_000, 1)}jt`;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1.5 -mb-1.5">
      <Tile label="Cash" value={fmtJt(data.cash)}
            sub={data.runway ? `${data.runway}d runway` : null}
            icon={Wallet}
            tone={data.health === "red" ? "bg-rose-100 text-rose-700" : data.health === "amber" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"} />
      <Tile label="Rev MTD" value={fmtJt(data.revenue)} icon={TrendingUp} tone="bg-aurora-1/15 text-aurora-1" />
      <Tile label="AP 7d" value={fmtJt(data.ap_due)} icon={Receipt} tone="bg-aurora-4/15 text-aurora-4" />
      <Tile label="Approvals" value={data.pending} icon={ClipboardCheck} tone="bg-aurora-2/15 text-aurora-2" />
      <Tile label="Anomalies" value={data.anomalies} icon={AlertTriangle}
            tone={data.anomalies ? "bg-rose-100 text-rose-700" : "bg-muted text-muted-foreground"} />
      <button
        type="button"
        onClick={load}
        disabled={refreshing}
        className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 ml-auto"
        data-testid="kpi-strip-refresh"
      >
        <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
        refresh
      </button>
    </div>
  );
}
