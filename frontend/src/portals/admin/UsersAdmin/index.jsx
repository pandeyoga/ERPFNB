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
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import StatusPill from "@/components/shared/StatusPill";
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

import { fetchAll } from "@/lib/api";
export default function Users({ embedded = false } = {}) {
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
    fetchAll("/master/brands")
      .then((r) => setBrands(unwrap(r) || [])).catch(() => {});
  }, []);

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.per_page || 20)));

  const newButton = (
    <Button onClick={() => setEditing({})} data-testid="users-new">
      <Plus /> Tambah User
    </Button>
  );

  return (
    <div className="space-y-3" data-testid="users-page">
      {/* Halaman mandiri (/admin/users) punya judul sendiri; di dalam hub "Users & Roles" judul dari hub */}
      {!embedded && (
        <PageHeader
          icon={Users2}
          title="Users"
          subtitle="Akun user ERP, role, dan akses outlet/brand."
          actions={newButton}
        />
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari nama atau email…"
            aria-label="Cari user berdasarkan nama atau email"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="glass-input pl-9"
            data-testid="users-search"
          />
        </div>
        {embedded && newButton}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Globe2 className="h-3.5 w-3.5 text-green-700 dark:text-green-400" />
          <span>Full Access — semua brand &amp; outlet</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Store className="h-3.5 w-3.5 text-amber-800 dark:text-amber-400" />
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
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Store className="h-3 w-3" />
                    {outlets.find((o) => o.id === u.default_outlet_id)?.name || "—"}
                    <span className="text-muted-foreground">(default)</span>
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
                    <span key={r.id} className="text-xs px-2 py-0.5 rounded-full glass-input">{r.name}</span>
                  ))}
                  {userRoles.length > 2 && (
                    <span className="text-xs text-muted-foreground">+{userRoles.length - 2}</span>
                  )}
                </div>
              );
            } },
            { key: "access", label: "Akses Outlet / Brand", render: (u) => <AccessBadge u={u} outlets={outlets} brands={brands} /> },
            { key: "status", label: "Status", align: "center", sortable: true, render: (u) => (
              <StatusPill status={u.status === "active" ? "active" : "inactive"} />
            ) },
            { key: "last_login_at", label: "Login Terakhir", sortable: true, hideOnMobile: true, render: (u) => (
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
                      <span key={r.id} className="text-xs px-2 py-0.5 rounded-full glass-input">{r.name}</span>
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
              <Button
                variant="ghost" size="icon-sm"
                onClick={() => setEditing(u)}
                title="Edit user" aria-label={`Edit user ${u.full_name}`}
                data-testid={`user-edit-${u.id}`}
              >
                <Edit2 className="!h-3.5 !w-3.5" />
              </Button>
              <Button
                variant="ghost" size="icon-sm"
                onClick={() => setResetTarget(u)}
                title="Reset password" aria-label={`Reset password ${u.full_name}`}
                data-testid={`user-reset-${u.id}`}
              >
                <KeyRound className="!h-3.5 !w-3.5" />
              </Button>
              {u.id !== me?.id && (
                <Button
                  variant="ghost" size="icon-sm"
                  onClick={() => disableUser(u, load)}
                  className="hover:bg-destructive/10 hover:text-destructive"
                  title="Nonaktifkan user" aria-label={`Nonaktifkan user ${u.full_name}`}
                  data-testid={`user-disable-${u.id}`}
                >
                  <Trash2 className="!h-3.5 !w-3.5" />
                </Button>
              )}
            </div>
          )}
          rowTestIdPrefix="user-row"
        />
        {totalPages > 1 && (
          <div className="px-4 py-2.5 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
            <span>Total: {meta.total}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} data-testid="users-prev">Sebelumnya</Button>
              <span className="px-1 tabular-nums">{page}/{totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} data-testid="users-next">Berikutnya</Button>
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
