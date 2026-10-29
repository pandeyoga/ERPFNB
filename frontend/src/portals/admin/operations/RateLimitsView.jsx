import PageHeader from "@/components/shared/PageHeader";
import { useEffect, useState, useCallback } from "react";
import { RefreshCw, RotateCcw } from "lucide-react";

import api, { unwrap, unwrapError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import { toast } from "sonner";
import { fmtNumber } from "@/lib/format";
import { confirmDialog } from "@/components/shared/confirmDialog";

export default function RateLimitsView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get("/admin/rate-limits");
      setData(unwrap(r));
    } catch (e) {
      setError(unwrapError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function reset(bucket) {
    try {
      const r = await api.post("/admin/rate-limits/reset", { bucket });
      const cleared = unwrap(r)?.cleared || 0;
      toast.success(`Reset ${bucket}: ${cleared} keys cleared`);
      await load();
    } catch (e) {
      toast.error("Reset gagal", { description: unwrapError(e) });
    }
  }

  async function resetAll() {
    if (!(await confirmDialog("Reset semua rate limit counters?"))) return;
    try {
      const r = await api.post("/admin/rate-limits/reset", {});
      const cleared = unwrap(r)?.cleared || 0;
      toast.success(`Reset all: ${cleared} keys cleared`);
      await load();
    } catch (e) {
      toast.error("Reset gagal", { description: unwrapError(e) });
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const buckets = data.buckets || {};
  const top = data.top_keys || {};

  return (
    <div className="space-y-3 lg:space-y-4">
      {/* Di hub Monitoring, PageHeader mengisi subtitle & aksi header hub (DESIGN_SYSTEM §10.1). */}
      <PageHeader
        title="Rate limits"
        subtitle="Token-bucket in-memory per (bucket, key). Window 60 detik."
        actions={<>
            <Button variant="outline" size="icon" onClick={load} aria-label="Muat ulang" title="Muat ulang" data-testid="rl-refresh">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" onClick={resetAll} data-testid="rl-reset-all">
              <RotateCcw className="h-3.5 w-3.5" /> Reset semua
            </Button>
        </>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
        {Object.entries(buckets).map(([name, [limit, win]]) => (
          <div key={name} className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm md:text-base font-semibold">{name}</h3>
              <span className="text-xs px-2 py-0.5 rounded bg-blue-500/15 text-blue-800 dark:text-blue-400">{limit}/{win}s</span>
            </div>
            <div className="text-xs text-muted-foreground mb-2">{(top[name] || []).length} key aktif</div>
            <div className="space-y-1 max-h-[280px] overflow-auto pr-1">
              {(top[name] || []).length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Tidak ada hit di window ini.</p>
              ) : top[name].map((row, i) => {
                const pct = Math.min(100, (row.count / limit) * 100);
                const color = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500";
                return (
                  <div key={i} className="text-xs">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-medium tabular-nums truncate max-w-[180px]" title={row.key}>{row.key}</span>
                      <span className="tabular-nums font-medium">{fmtNumber(row.count)}/{limit}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <Button variant="ghost" size="sm" onClick={() => reset(name)} className="w-full mt-3" data-testid={`rl-reset-${name}`}>
              <RotateCcw className="h-3 w-3" /> Reset {name}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
