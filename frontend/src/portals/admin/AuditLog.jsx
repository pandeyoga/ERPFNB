import { useEffect, useState } from "react";
import api, { unwrap } from "@/lib/api";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import { fmtRelative, fmtDateTime } from "@/lib/format";
import { Search, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InlineHelp } from "@/components/shared/InlineHelp";
import { cn } from "@/lib/utils";

const ACTION_COLORS = {
  create: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  update: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  delete: "bg-red-500/15 text-red-700 dark:text-red-400",
  disable: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  reset_password: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  login: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400",
  logout: "bg-zinc-300 text-zinc-700",
};

export default function AuditLog() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState({ entity_type: "", action: "" });
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, per_page: 50 });

  async function load() {
    setLoading(true);
    try {
      const params = { page, per_page: 50 };
      if (q.entity_type) params.entity_type = q.entity_type;
      if (q.action) params.action = q.action;
      const res = await api.get("/admin/audit-log", { params });
      setItems(unwrap(res) || []);
      setMeta(res.data?.meta || {});
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page]);

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.per_page || 50)));

  return (
    <div className="space-y-4" data-testid="audit-log-page">
      <div className="flex flex-wrap items-center gap-2" data-testid="audit-toolbar">
        <Input placeholder="Filter entity_type" value={q.entity_type}
               onChange={e => setQ({...q, entity_type: e.target.value})}
               className="glass-input h-10 max-w-[160px]"
               data-testid="audit-filter-entity" />
        <Input placeholder="Filter action" value={q.action}
               onChange={e => setQ({...q, action: e.target.value})}
               className="glass-input h-10 max-w-[160px]"
               data-testid="audit-filter-action" />
        <Button onClick={() => { setPage(1); load(); }} className="rounded-full pill-active gap-2"
                data-testid="audit-refresh">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
        <InlineHelp id="audit-log-filter" size="xs" placement="right" />
      </div>
      <div className="glass-card overflow-hidden" data-testid="audit-table-card">
        <DataTable
          columns={[
            { key: "timestamp", label: "Waktu", primary: true, sortable: true, render: (e) => (<div className="text-xs whitespace-nowrap"><div>{fmtDateTime(e.timestamp)}</div><div className="text-muted-foreground">{fmtRelative(e.timestamp)}</div></div>) },
            { key: "user_id", label: "User", render: (e) => <span className="text-xs font-mono text-muted-foreground">{(e.user_id || "—").slice(0, 8)}…</span> },
            { key: "entity_type", label: "Entity", sortable: true, render: (e) => <span className="text-xs">{e.entity_type}</span> },
            { key: "action", label: "Action", sortable: true, render: (e) => <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium", ACTION_COLORS[e.action] || "bg-foreground/10")}>{e.action}</span> },
            { key: "entity_id", label: "ID", render: (e) => <span className="text-xs font-mono text-muted-foreground">{(e.entity_id || "—").slice(0, 8)}…</span> },
          ]}
          rows={items}
          loading={loading}
          defaultSort={{ key: "timestamp", dir: "desc" }}
          empty={<EmptyState title="Belum ada audit entry" />}
          rowTestIdPrefix="audit-row"
        />
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
            <span>Total: {meta.total}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded-full glass-input disabled:opacity-50" data-testid="audit-prev">Prev</button>
              <span className="px-2 py-1">{page}/{totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded-full glass-input disabled:opacity-50" data-testid="audit-next">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
