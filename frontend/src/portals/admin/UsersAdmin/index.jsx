/** Users/index.jsx — Users admin page orchestrator. */
import { useEffect, useState } from "react";
import {
  Plus, Edit2, Trash2, Search, KeyRound, Building2, Store, Globe2,
  ShieldCheck, Users2, UserCog,
} from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { fmtRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { InlineHelp } from "@/components/shared/InlineHelp";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import useOutletScope from "@/hooks/useOutletScope";

/* ─── Access Level helper ──────────────────────────────────────────── */
import { isFullAccess, resolveAccessLevel, AccessBadge } from "./helpers";
import UserDialog from "./UserDialog";
import ResetPwdDialog from "./ResetPwdDialog";
import { confirmDialog } from "@/components/shared/confirmDialog";

export default function Users() {
  const { user: me } = useAuth();
  const { allOutlets } = useOutletScope();
  const outlets = allOutlets;
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, per_page: 20 });
  const [roles, setRoles] = useState([]);
  const [brands, setBrands] = useState([]);
  const [editing, setEditing] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const params = { page, per_page: 20 };
      if (q) params.q = q;
      const res = await api.get("/admin/users", { params });
      setUsers(unwrap(res) || []);
      setMeta(res.data?.meta || {});
    } catch (e) {
      toast.error("Gagal load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page]); // eslint-disable-line
  useEffect(() => {
    const id = setTimeout(() => { setPage(1); load(); }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    api.get("/admin/roles").then((r) => setRoles(unwrap(r) || [])).catch(() => {});
    api.get("/master/brands", { params: { per_page: 100 } })
      .then((r) => setBrands(unwrap(r) || [])).catch(() => {});
  }, []);

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.per_page || 20)));

  return (
    <div className="space-y-4" data-testid="users-page">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari nama atau email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="glass-input pl-9 h-10"
            data-testid="users-search"
          />
        </div>
        <Button
          onClick={() => setEditing({})}
          className="rounded-full pill-active h-10 px-4 gap-2"
          data-testid="users-new"
        >
          <Plus className="h-4 w-4" /> User Baru
        </Button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Globe2 className="h-3.5 w-3.5 text-green-500" />
          <span>Full Access — semua brand &amp; outlet</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Store className="h-3.5 w-3.5 text-amber-500" />
          <span>Outlet Staff — hanya outlet yang di-assign</span>
        </span>
        <InlineHelp id="rbac-access-level" size="xs" placement="right" />
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden" data-testid="users-table-card">
        <DataTable
          columns={[
            { key: "full_name", label: "Nama", primary: true, sortable: true, render: (u) => (
              <div>
                <div className="font-medium">{u.full_name}</div>
                {u.default_outlet_id && (
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Store className="h-3 w-3" />
                    {outlets.find((o) => o.id === u.default_outlet_id)?.name || "—"}
                    <span className="text-muted-foreground/60">(default)</span>
                  </div>
                )}
              </div>
            ) },
            { key: "email", label: "Email", sortable: true, render: (u) => <span className="text-muted-foreground">{u.email}</span> },
            { key: "roles", label: "Roles", render: (u) => {
              const userRoles = roles.filter((r) => (u.role_ids || []).includes(r.id));
              return (
                <div className="flex flex-wrap gap-1">
                  {userRoles.slice(0, 2).map((r) => (
                    <span key={r.id} className="text-[11px] px-2 py-0.5 rounded-full glass-input">{r.name}</span>
                  ))}
                  {userRoles.length > 2 && (
                    <span className="text-[11px] text-muted-foreground">+{userRoles.length - 2}</span>
                  )}
                </div>
              );
            } },
            { key: "access", label: "Akses Outlet / Brand", render: (u) => <AccessBadge u={u} outlets={outlets} brands={brands} /> },
            { key: "status", label: "Status", align: "center", sortable: true, render: (u) => (
              <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium",
                u.status === "active" ? "status-active" : "status-disabled"
              )}>
                {u.status === "active" ? "Aktif" : "Nonaktif"}
              </span>
            ) },
            { key: "last_login_at", label: "Last Login", sortable: true, hideOnMobile: true, render: (u) => (
              <span className="text-xs text-muted-foreground">{u.last_login_at ? fmtRelative(u.last_login_at) : "—"}</span>
            ) },
          ]}
          rows={users}
          loading={loading}
          empty={<EmptyState title="Belum ada user" />}
          renderExpanded={(u) => {
            const userRoles = roles.filter((r) => (u.role_ids || []).includes(r.id));
            return (
              <div className="space-y-3 text-sm" data-testid={`user-detail-${u.id}`}>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Roles ({userRoles.length})</div>
                  <div className="flex flex-wrap gap-1.5">
                    {userRoles.length ? userRoles.map((r) => (
                      <span key={r.id} className="text-[11px] px-2 py-0.5 rounded-full glass-input">{r.name}</span>
                    )) : <span className="text-muted-foreground text-xs">Tidak ada role</span>}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Akses Outlet / Brand</div>
                  <AccessBadge u={u} outlets={outlets} brands={brands} />
                </div>
              </div>
            );
          }}
          rowAction={(u) => (
            <div className="flex items-center gap-1 justify-end">
              <button
                onClick={() => setEditing(u)}
                className="h-8 w-8 rounded-lg hover:bg-foreground/5 flex items-center justify-center"
                title="Edit"
                data-testid={`user-edit-${u.id}`}
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setResetTarget(u)}
                className="h-8 w-8 rounded-lg hover:bg-foreground/5 flex items-center justify-center"
                title="Reset password"
                data-testid={`user-reset-${u.id}`}
              >
                <KeyRound className="h-3.5 w-3.5" />
              </button>
              {u.id !== me?.id && (
                <button
                  onClick={() => disableUser(u, load)}
                  className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center"
                  title="Nonaktifkan"
                  data-testid={`user-disable-${u.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
          rowTestIdPrefix="user-row"
        />
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
            <span>Total: {meta.total}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 rounded-full glass-input disabled:opacity-50" data-testid="users-prev">Prev</button>
              <span className="px-2 py-1">{page}/{totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 rounded-full glass-input disabled:opacity-50" data-testid="users-next">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Edit/Create dialog */}
      <UserDialog
        editing={editing}
        roles={roles}
        outlets={outlets}
        brands={brands}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); }}
      />

      {/* Reset password dialog */}
      <ResetPwdDialog target={resetTarget} onClose={() => setResetTarget(null)} />
    </div>
  );
}

async function disableUser(u, refresh) {
  if (!(await confirmDialog(`Nonaktifkan user ${u.full_name}?`))) return;
  try {
    await api.delete(`/admin/users/${u.id}`);
    toast.success("User dinonaktifkan");
    refresh();
  } catch (e) {
    toast.error("Gagal nonaktifkan");
  }
}

/* ─── User Dialog ──────────────────────────────────────────────────── */
