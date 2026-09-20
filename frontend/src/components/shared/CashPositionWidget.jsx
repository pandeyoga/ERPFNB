/**
 * Compact Cash Position widget for embedding on Executive Home + Owner Cockpit.
 * Shows: net liquid cash, breakdown chips, days_runway pill.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Wallet, ArrowRight, CheckCircle2, AlertCircle, AlertTriangle,
} from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { fmtRp, fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const HEALTH_PILL = {
  green: { tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300", icon: CheckCircle2, label: "Sehat" },
  amber: { tone: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300", icon: AlertCircle, label: "Watch" },
  red:   { tone: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300", icon: AlertTriangle, label: "Critical" },
};

export default function CashPositionWidget({ to = "/finance/cash-position", showLink = true }) {
  const [position, setPosition] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api.get("/finance/cash/position")
      .then((r) => { if (alive) setPosition(unwrap(r)); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading) return <div className="glass-card p-5 animate-pulse h-40" />;
  if (!position) return null;

  const health = HEALTH_PILL[position.health || "green"];
  const HealthIcon = health.icon;
  const types = position.by_type || {};

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="h-9 w-9 rounded-xl bg-aurora-1/15 text-aurora-1 flex items-center justify-center">
            <Wallet className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-semibold">Cash Position</div>
            <div className="text-[11px] text-muted-foreground">
              {position.account_count} akun likuid
            </div>
          </div>
        </div>
        <span className={cn("px-2 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1", health.tone)}>
          <HealthIcon className="h-3 w-3" />
          {health.label}
          {position.days_runway && ` • ${position.days_runway}d`}
        </span>
      </div>
      <div className="text-2xl font-bold tracking-tight mb-4">
        {fmtRp(position.net_liquid_cash)}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {["bank", "petty_cash", "ewallet"].map((t) => (
          <div key={t} className="rounded-lg bg-muted/40 p-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {t === "petty_cash" ? "Petty" : t === "ewallet" ? "E-Wallet" : "Bank"}
            </div>
            <div className="text-xs font-bold mt-0.5">
              Rp {fmtNumber((types[t]?.total || 0) / 1_000_000, 1)} jt
            </div>
            <div className="text-[10px] text-muted-foreground">
              {types[t]?.count || 0} akun
            </div>
          </div>
        ))}
      </div>
      {showLink && (
        <Link
          to={to}
          className="flex items-center justify-center gap-1 mt-3 text-xs text-primary font-semibold hover:underline"
          data-testid="cash-widget-link"
        >
          Buka Cash Position <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}
