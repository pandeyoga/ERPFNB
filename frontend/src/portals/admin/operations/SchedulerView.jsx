import { useEffect, useState, useCallback } from "react";
import { Play, RefreshCw, CheckCircle2, XCircle, Clock } from "lucide-react";

import api, { unwrap, unwrapError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import DataTable from "@/components/shared/DataTable";
import { toast } from "sonner";
import { fmtDateTime, fmtRelative } from "@/lib/format";

export default function SchedulerView() {
  const [jobs, setJobs] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(null);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, per_page: 20, total_pages: 1 });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [j, r] = await Promise.all([
        api.get("/admin/scheduler/jobs"),
        api.get("/admin/scheduler/runs", { params: { page, per_page: 20 } }),
      ]);
      setJobs(unwrap(j)?.items || []);
      const runData = unwrap(r) || {};
      setRuns(runData.items || []);
      setMeta({
        total: runData.total || 0,
        per_page: runData.per_page || 20,
        total_pages: runData.total_pages || 1,
      });
    } catch (e) {
      setError(unwrapError(e));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  async function trigger(job) {
    setRunning(job.id);
    try {
      const r = await api.post(`/admin/scheduler/jobs/${job.id}/run`);
      const result = unwrap(r);
      if (result.status === "success") {
        toast.success(`Job ${job.id} sukses`, {
          description: JSON.stringify(result.result || {}).slice(0, 120),
        });
      } else {
        toast.error(`Job ${job.id} gagal`, { description: result.error || "unknown error" });
      }
      await load();
    } catch (e) {
      toast.error("Gagal menjalankan job", { description: unwrapError(e) });
    } finally {
      setRunning(null);
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-3 lg:space-y-4">
      {/* Toolbar (judul seksi = tab "Scheduler" di hub Monitoring) */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Background jobs — {jobs.length} job terjadwal · TZ Asia/Jakarta</p>
        <Button variant="outline" onClick={load} data-testid="scheduler-refresh">
          <RefreshCw className="h-3.5 w-3.5" /> Muat ulang
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {jobs.map((j) => {
          const lastRun = runs.find((r) => r.job_id === j.id);
          return (
            <div key={j.id} className="glass-card p-4 flex flex-col gap-3" data-testid={`job-${j.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm md:text-base font-semibold flex items-center gap-2">
                    {j.name}
                    {j.enabled ? (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-800 dark:text-emerald-400">enabled</span>
                    ) : (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">disabled</span>
                    )}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">{j.description}</p>
                </div>
                <Button size="sm" disabled={running === j.id} onClick={() => trigger(j)}
                        data-testid={`job-run-${j.id}`}>
                  <Play className="h-3.5 w-3.5" /> {running === j.id ? "Menjalankan…" : "Jalankan"}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded bg-muted/50 px-2.5 py-1.5">
                  <div className="text-muted-foreground">Trigger</div>
                  <div className="font-mono text-xs truncate">{j.trigger}</div>
                </div>
                <div className="rounded bg-muted/50 px-2.5 py-1.5">
                  <div className="text-muted-foreground">Next Run</div>
                  <div className="text-xs tabular-nums">{j.next_run ? fmtDateTime(j.next_run) : "-"}</div>
                </div>
              </div>
              {lastRun && (
                <div className="flex items-center gap-2 text-xs border-t border-border/30 pt-2">
                  {lastRun.status === "success" ? <CheckCircle2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400" /> :
                    lastRun.status === "failed" ? <XCircle className="h-4 w-4 text-red-700 dark:text-red-400" /> :
                    <Clock className="h-4 w-4 text-blue-700 dark:text-blue-400" />}
                  <span className="text-muted-foreground">Last run:</span>
                  <span>{fmtRelative(lastRun.started_at)}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className={lastRun.status === "success" ? "text-emerald-700 dark:text-emerald-400" : lastRun.status === "failed" ? "text-red-700 dark:text-red-400" : ""}>
                    {lastRun.status}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base md:text-lg font-semibold">Run Terbaru</h2>
          <span className="text-xs text-muted-foreground">
            Total: {meta.total} · Halaman {page} / {meta.total_pages}
          </span>
        </div>
        <div className="glass-card overflow-hidden">
          <div className="max-h-[400px] overflow-auto">
            <DataTable
              columns={[
                { key: "started_at", label: "Started", primary: true, sortable: true, render: (r) => <span className="text-xs tabular-nums whitespace-nowrap">{fmtDateTime(r.started_at)}</span> },
                { key: "job_id", label: "Job", sortable: true, render: (r) => <span className="text-xs font-medium tabular-nums">{r.job_id}</span> },
                { key: "status", label: "Status", sortable: true, render: (r) => <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.status === "success" ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-400" : r.status === "failed" ? "bg-red-500/15 text-red-800 dark:text-red-400" : "bg-blue-500/15 text-blue-800 dark:text-blue-400"}`}>{r.status}</span> },
                { key: "result", label: "Result / Error", render: (r) => <span className="font-mono text-xs text-muted-foreground break-all">{r.error || JSON.stringify(r.result || {}).slice(0, 200)}</span> },
              ]}
              rows={runs}
              defaultSort={{ key: "started_at", dir: "desc" }}
              empty={<div className="py-6 text-center text-sm text-muted-foreground">Belum ada run.</div>}
              rowTestIdPrefix="scheduler-run"
            />
          </div>
        </div>
        {meta.total_pages > 1 && (
          <div className="flex items-center justify-end gap-2 mt-3">
            <Button
              variant="outline" size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              data-testid="scheduler-runs-prev"
            >Sebelumnya</Button>
            <span className="text-xs text-muted-foreground tabular-nums" data-testid="scheduler-runs-page-info">
              {page} / {meta.total_pages}
            </span>
            <Button
              variant="outline" size="sm"
              onClick={() => setPage(p => Math.min(meta.total_pages, p + 1))}
              disabled={page >= meta.total_pages || loading}
              data-testid="scheduler-runs-next"
            >Berikutnya</Button>
          </div>
        )}
      </div>
    </div>
  );
}
