import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Search, Filter } from "lucide-react";

import api, { unwrap, unwrapError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/useDebounce";
import ErrorState from "@/components/shared/ErrorState";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import { fmtDateTime } from "@/lib/format";

const LEVELS = ["", "DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"];
const LEVEL_STYLES = {
  DEBUG: "bg-muted text-foreground",
  INFO: "bg-blue-500/15 text-blue-800 dark:text-blue-400",
  WARNING: "bg-amber-500/15 text-amber-800 dark:text-amber-400",
  ERROR: "bg-red-500/15 text-red-800 dark:text-red-400",
  CRITICAL: "bg-red-700/25 text-red-800 dark:text-red-300 font-bold",
};

export default function LogsView() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    level: "", request_id: "", route_contains: "", user_id: "",
  });
  const [stats, setStats] = useState(null);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, per_page: 50, total_pages: 1 });
  // Filter teks di-debounce: API dipanggil setelah user berhenti mengetik, bukan per huruf.
  const requestId = useDebounce(filters.request_id.trim(), 400);
  const routeContains = useDebounce(filters.route_contains.trim(), 400);
  const userId = useDebounce(filters.user_id.trim(), 400);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, per_page: 50 };
      Object.entries({ level: filters.level, request_id: requestId, route_contains: routeContains, user_id: userId })
        .forEach(([k, v]) => { if (v) params[k] = v; });
      const [r, s] = await Promise.all([
        api.get("/admin/logs/recent", { params }),
        api.get("/admin/logs/stats"),
      ]);
      const logsData = unwrap(r) || {};
      setItems(logsData.items || []);
      setMeta({
        total: logsData.total || 0,
        per_page: logsData.per_page || 50,
        total_pages: logsData.total_pages || 1,
      });
      setStats(unwrap(s));
    } catch (e) {
      setError(unwrapError(e));
    } finally {
      setLoading(false);
    }
  }, [filters.level, requestId, routeContains, userId, page]);

  useEffect(() => { load(); }, [load]);

  // Reset to page 1 when filters change
  function updateFilters(newFilters) {
    setFilters(newFilters);
    setPage(1);
  }

  // Stable key for expand/sort (logs lack a unique id field).
  const rows = items.map((r, i) => ({
    ...r,
    __rid: r.request_id ? `${r.request_id}-${i}` : `log-${i}`,
  }));

  return (
    <div className="space-y-3">
      {/* Toolbar (judul seksi = tab "Logs" di hub Monitoring) */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Log request terbaru — total {stats?.total || 0} entri · per level: {Object.entries(stats?.recent_by_level || {}).map(([k, v]) => `${k}:${v}`).join(" · ") || "-"}
        </p>
        <Button variant="outline" onClick={load} disabled={loading} data-testid="logs-refresh">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Muat ulang
        </Button>
      </div>

      <div className="glass-card p-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <SimpleSelect
            value={filters.level}
            onValueChange={(v) => updateFilters({ ...filters, level: v })}
            options={LEVELS.map((l) => ({ value: l, label: l || "Semua level" }))}
            className="glass-input h-9 px-2 rounded-md"
            ariaLabel="Filter level"
            testId="logs-filter-level"
          />
        </div>
        <Input className="glass-input max-w-[260px]" placeholder="Request ID" aria-label="Filter request ID"
                value={filters.request_id} onChange={(e) => updateFilters({ ...filters, request_id: e.target.value })}
                data-testid="logs-filter-rid" />
        <div className="relative max-w-[260px] flex-1">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="glass-input pl-8" placeholder="Filter route (regex)" aria-label="Filter route"
                  value={filters.route_contains}
                  onChange={(e) => updateFilters({ ...filters, route_contains: e.target.value })}
                  data-testid="logs-filter-route" />
        </div>
        <Input className="glass-input max-w-[200px]" placeholder="User ID" aria-label="Filter user ID"
                value={filters.user_id} onChange={(e) => updateFilters({ ...filters, user_id: e.target.value })}
                data-testid="logs-filter-user" />
        {Object.values(filters).some(Boolean) && (
          <Button variant="ghost" size="sm" className="ml-auto" data-testid="logs-filter-reset"
                  onClick={() => updateFilters({ level: "", request_id: "", route_contains: "", user_id: "" })}>
            Reset filter
          </Button>
        )}
      </div>

      {error && <ErrorState message={error} onRetry={load} />}

      <div className="glass-card overflow-hidden">
        <div className="max-h-[640px] overflow-auto">
          <DataTable
            columns={[
              { key: "ts", label: "Timestamp", primary: true, sortable: true, render: (row) => <span className="text-xs tabular-nums whitespace-nowrap">{fmtDateTime(row.ts)}</span> },
              { key: "level", label: "Level", sortable: true, render: (row) => { const lvl = row.level || "INFO"; return <span className={`px-2 py-0.5 rounded text-xs font-medium ${LEVEL_STYLES[lvl] || LEVEL_STYLES.INFO}`}>{lvl}</span>; } },
              { key: "route", label: "Method/Route", render: (row) => <span className="text-xs font-medium tabular-nums break-all">{row.method ? <><span className="text-muted-foreground">{row.method}</span> {row.route}</> : row.msg?.slice(0, 80)}</span> },
              { key: "status_code", label: "Status", numeric: true, sortable: true, render: (row) => { const code = row.status_code; const cls = !code ? "" : code >= 500 ? "text-red-700 dark:text-red-400 font-semibold" : code >= 400 ? "text-amber-800 dark:text-amber-400 font-semibold" : "text-emerald-700 dark:text-emerald-400"; return <span className={cls}>{code || "-"}</span>; } },
              { key: "duration_ms", label: "ms", numeric: true, sortable: true, render: (row) => row.duration_ms?.toFixed(1) || "-" },
              { key: "request_id", label: "Request ID", render: (row) => <span className="text-xs font-medium tabular-nums text-muted-foreground">{row.request_id?.slice(0, 8) || "-"}</span> },
            ]}
            rows={rows}
            keyField="__rid"
            loading={loading && !items.length}
            renderExpanded={(row) => (
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">{JSON.stringify(row, null, 2)}</pre>
            )}
            empty={<EmptyState title="Belum ada log" description="Coba ubah filter atau tunggu request masuk." />}
            rowTestIdPrefix="logs-row"
          />
        </div>
      </div>

      {meta.total_pages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            Total: {meta.total} entri · Halaman {page} / {meta.total_pages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              data-testid="logs-prev"
            >Sebelumnya</Button>
            <span className="text-xs text-muted-foreground tabular-nums" data-testid="logs-page-info">
              {page} / {meta.total_pages}
            </span>
            <Button
              variant="outline" size="sm"
              onClick={() => setPage(p => Math.min(meta.total_pages, p + 1))}
              disabled={page >= meta.total_pages || loading}
              data-testid="logs-next"
            >Berikutnya</Button>
          </div>
        </div>
      )}
    </div>
  );
}
