import PageHeader from "@/components/shared/PageHeader";
import { useEffect, useState } from "react";
import { RefreshCw, Server, Clock, AlertTriangle, Database, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

import api, { unwrap, unwrapError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import CompactStatCard from "@/components/shared/CompactStatCard";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import DataTable from "@/components/shared/DataTable";
import { fmtNumber } from "@/lib/format";

function fmtUptime(sec) {
  if (!sec || sec < 0) return "-";
  const s = Math.floor(sec);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  // Satuan eksplisit (hari/jam/mnt/dtk) supaya "39m 3d" tidak terbaca 39 bulan 3 hari.
  if (d > 0) return `${d} hari ${h} jam`;
  if (h > 0) return `${h} jam ${m} mnt`;
  if (m > 0) return `${m} mnt ${ss} dtk`;
  return `${ss} dtk`;
}

export default function MetricsView() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(showSpin = true) {
    if (showSpin) setLoading(true);
    setRefreshing(true);
    setError(null);
    try {
      const r = await api.get("/admin/metrics");
      setData(unwrap(r));
    } catch (e) {
      setError(unwrapError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(() => load(false), 15000);
    return () => clearInterval(id);
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={() => load()} />;
  if (!data) return null;

  const errRate = (data.requests?.error_rate_last_min ?? 0) * 100;
  const errColor = errRate >= 5 ? "aurora-6" : errRate > 0 ? "aurora-5" : "aurora-4";
  const errTone = errRate >= 5 ? "danger" : errRate > 0 ? "warning" : "default";

  return (
    <div className="space-y-3 lg:space-y-4">
      {/* Di hub Monitoring, PageHeader mengisi subtitle & aksi header hub (DESIGN_SYSTEM §10.1). */}
      <PageHeader
        title="Metrics"
        subtitle="Kesehatan sistem — auto-refresh tiap 15 detik."
        actions={<>
          <Button variant="outline" onClick={() => load()} disabled={refreshing} data-testid="metrics-refresh">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Muat ulang
          </Button>
        </>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CompactStatCard label="Uptime" value={fmtUptime(data.uptime_sec)} sub="sejak start" icon={Clock} color="aurora-1" />
        <CompactStatCard label="Total Requests" value={fmtNumber(data.requests?.total || 0)}
                 sub={`${data.requests?.rps_last_min || 0} req/s (60s)`} icon={Server} color="aurora-2" />
        <CompactStatCard label="Error Rate (60s)" value={`${errRate.toFixed(2)}%`} tone={errTone}
                 sub={`${data.requests?.["5xx"] || 0} 5xx total`} icon={AlertTriangle} color={errColor} />
        <CompactStatCard label="Sesi Aktif" value={fmtNumber(data.collection_counts?.refresh_tokens || 0)}
                 sub="refresh tokens" icon={TrendingUp} color="aurora-4" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
        <div className="glass-card p-4 min-w-0">
          <h3 className="text-sm md:text-base font-semibold mb-3 flex items-center gap-2">
            <Database className="h-4 w-4" /> Collection Counts
          </h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(data.collection_counts || {}).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50">
                <span className="text-muted-foreground truncate">{k}</span>
                <span className="tabular-nums">{fmtNumber(v < 0 ? 0 : v)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-4 min-w-0 overflow-hidden">
          <h3 className="text-sm md:text-base font-semibold mb-3">Top Slow Routes (p95)</h3>
          {(data.top_slow_routes || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada data.</p>
          ) : (
            <DataTable
              rows={data.top_slow_routes || []}
              keyField="route"
              rowTestIdPrefix="metrics-route"
              empty={<p className="text-sm text-muted-foreground py-2">Belum ada data.</p>}
              columns={[
                { key: "route", label: "Route", primary: true,
                  render: (r) => <span className="text-xs font-medium tabular-nums break-all">{r.route}</span> },
                { key: "count", label: "Jumlah", numeric: true, sortable: true,
                  render: (r) => fmtNumber(r.count) },
                { key: "avg_ms", label: "Avg ms", numeric: true, sortable: true,
                  render: (r) => r.avg_ms?.toFixed(1) },
                { key: "p95_ms", label: "p95 ms", numeric: true, sortable: true,
                  render: (r) => <span className="font-medium">{r.p95_ms?.toFixed(1)}</span> },
              ]}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
        <div className="glass-card p-4">
          <h3 className="text-sm md:text-base font-semibold mb-3">Per Status Code</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.requests?.by_status || {}).map(([k, v]) => {
              const s = parseInt(k, 10);
              const color = s >= 500 ? "bg-red-500/15 text-red-800 dark:text-red-400"
                          : s >= 400 ? "bg-amber-500/15 text-amber-800 dark:text-amber-400"
                          : "bg-emerald-500/15 text-emerald-800 dark:text-emerald-400";
              return (
                <motion.span key={k} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium ${color}`}>
                  {k}: {fmtNumber(v)}
                </motion.span>
              );
            })}
          </div>
        </div>
        <div className="glass-card p-4">
          <h3 className="text-sm md:text-base font-semibold mb-3">Per Method</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.requests?.by_method || {}).map(([k, v]) => (
              <span key={k} className="px-3 py-1.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-800 dark:text-blue-400">
                {k}: {fmtNumber(v)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
