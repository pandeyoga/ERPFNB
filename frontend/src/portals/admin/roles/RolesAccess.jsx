/** Peran & Hak Akses — SATU layar konfigurasi akses (pola DAHOST RoleManagementModule).
 *
 * Kiri: daftar peran (bawaan / kustom / diubah). Kanan: editor peran terpilih —
 *   identitas, matriks izin (portal → modul → izin, tingkat cepat, pencarian, dependensi otomatis),
 *   pengguna, riwayat perubahan; simpan lewat FormActionBar dengan ringkasan +/−.
 * Peran bawaan bisa diubah & dikembalikan ke bawaan; Super Admin terkunci; izin yang tidak dimiliki pengubah
 * tidak bisa diberikan (anti eskalasi — juga ditegakkan backend).
 * API: /admin/roles*, /admin/permissions?grouped=true (backend/routers/admin.py, core/perms_registry.py).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, GitCompare, History, Lock, Plus, RotateCcw, Shield, ShieldAlert, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import api, { unwrap } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import KeyFacts from "@/components/shared/KeyFacts";
import RowActions from "@/components/shared/RowActions";
import LoadingState from "@/components/shared/LoadingState";
import { ListSearch } from "@/components/shared/ListToolbar";
import { confirmDialog } from "@/components/shared/confirmDialog";
import { FormActionBar, confirmDiscard, useUnsavedChanges } from "@/components/shared/UnsavedChanges";
import PermissionMatrix from "./PermissionMatrix";
import { CompareRolesSheet, CreateRoleDialog, DuplicateRoleDialog } from "./RoleDialogs";
import { allCodes, diff, indexCatalog } from "./permissionUtils";

const errMsg = (e, fb) => e?.response?.data?.errors?.[0]?.message || fb;

function RoleBadges({ role }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {role.locked ? <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase text-violet-800 dark:text-violet-400">AKSES PENUH</span>
        : role.is_system ? <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase text-muted-foreground">BAWAAN</span>
          : <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase text-blue-800 dark:text-blue-400">KUSTOM</span>}
      {role.modified && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase text-amber-800 dark:text-amber-400">DIUBAH</span>}
    </span>
  );
}

export default function RolesAccess() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const myPerms = useMemo(() => new Set(user?.permissions || []), [user]);
  const canGrant = useCallback((code) => myPerms.has("*") || myPerms.has(code), [myPerms]);

  const { data: catalog } = useQuery({
    queryKey: ["admin", "permissions", "grouped"],
    queryFn: async () => unwrap(await api.get("/admin/permissions", { params: { grouped: true } })),
    staleTime: 10 * 60 * 1000,
  });
  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["admin", "roles"],
    queryFn: async () => unwrap(await api.get("/admin/roles")) || [],
  });
  const idx = useMemo(() => indexCatalog(catalog), [catalog]);
  const total = useMemo(() => allCodes(catalog).length, [catalog]);
  const labelOf = useCallback((code) => (idx[code] ? `${idx[code].module.label}: ${idx[code].perm.label}` : code), [idx]);

  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState(null); // { name, description, perms:Set }
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  const selected = roles.find((r) => r.id === selectedId) || null;
  useEffect(() => {
    if (!selectedId && roles.length) setSelectedId((roles.find((r) => !r.locked) || roles[0]).id);
  }, [roles, selectedId]);
  useEffect(() => {
    if (selected) setDraft({ name: selected.name, description: selected.description || "", perms: new Set(selected.permissions || []) });
  }, [selected]);

  const changes = useMemo(() => (selected && draft ? diff(selected.permissions, [...draft.perms]) : { added: [], removed: [] }), [selected, draft]);
  const metaDirty = !!(selected && draft && (draft.name !== selected.name || (draft.description || "") !== (selected.description || "")));
  const dirty = metaDirty || changes.added.length > 0 || changes.removed.length > 0;
  useUnsavedChanges(dirty);

  const pick = async (id) => {
    if (id === selectedId) return;
    if (dirty && !(await confirmDiscard())) return;
    setSelectedId(id);
  };
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "roles"] });

  const save = async () => {
    const sens = changes.added.filter((c) => idx[c]?.perm.sensitive);
    if (sens.length && !(await confirmDialog({
      title: "Tambahkan izin sensitif?",
      description: `${sens.map(labelOf).join(", ")} — izin ini berdampak besar (mis. membuka periode terkunci atau mengelola user).`,
      confirmText: "Ya, simpan",
    }))) return;
    setSaving(true);
    try {
      await api.patch(`/admin/roles/${selected.id}`, { name: draft.name, description: draft.description, permissions: [...draft.perms] });
      toast.success(`Peran ${draft.name} disimpan (+${changes.added.length} / −${changes.removed.length} izin)`);
      refresh();
      qc.invalidateQueries({ queryKey: ["admin", "role-history", selected.id] });
    } catch (e) { toast.error(errMsg(e, "Gagal menyimpan peran")); } finally { setSaving(false); }
  };
  const reset = async () => {
    if (!(await confirmDialog({ title: "Kembalikan ke bawaan?", description: `Izin ${selected.name} dikembalikan ke izin bawaan sistem.`, confirmText: "Kembalikan" }))) return;
    try {
      await api.post(`/admin/roles/${selected.id}/reset`);
      toast.success("Peran dikembalikan ke bawaan");
      refresh();
      qc.invalidateQueries({ queryKey: ["admin", "role-history", selected.id] });
    } catch (e) { toast.error(errMsg(e, "Gagal mengembalikan")); }
  };
  const remove = async () => {
    if (!(await confirmDialog({ title: "Hapus peran?", description: `${selected.name} akan dihapus.`, confirmText: "Hapus", destructive: true }))) return;
    try {
      await api.delete(`/admin/roles/${selected.id}`);
      toast.success("Peran dihapus");
      setSelectedId(null);
      refresh();
    } catch (e) { toast.error(errMsg(e, "Gagal menghapus")); }
  };

  const visibleRoles = roles.filter((r) => !search || `${r.name} ${r.code}`.toLowerCase().includes(search.toLowerCase()));
  const sensitiveOn = draft ? [...draft.perms].filter((c) => idx[c]?.perm.sensitive).length : 0;

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="roles-page">
      <PageHeader
        title="Roles & permissions"
        subtitle="Atur peran dan izin aksesnya. Peran bawaan bisa diubah dan dikembalikan ke bawaan kapan saja."
        actions={(
          <>
            <Button variant="outline" onClick={() => setCompareOpen(true)} disabled={!selected} data-testid="roles-compare">
              <GitCompare /> Bandingkan
            </Button>
            <Button onClick={() => setCreateOpen(true)} data-testid="roles-new"><Plus /> Tambah Peran</Button>
          </>
        )}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-3 lg:gap-4 lg:items-start">
        <div className="glass-card overflow-hidden lg:sticky lg:top-3" data-testid="roles-grid">
          <div className="p-3 border-b border-border/50">
            <ListSearch value={search} onChange={setSearch} placeholder="Cari peran…" testId="roles-search" className="sm:w-full" />
          </div>
          <DataTable
            rows={visibleRoles} keyField="id" loading={isLoading} rowTestIdPrefix="role-row"
            onRowClick={(r) => pick(r.id)}
            rowClassName={(r) => (r.id === selectedId ? "bg-primary/5" : "")}
            columns={[
              { key: "name", label: "Peran", primary: true, sortable: true,
                render: (r) => (
                  <div className="min-w-0">
                    <div className={cn("font-medium truncate", r.id === selectedId && "text-foreground")} title={r.name}>{r.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="truncate">{r.code}</span><RoleBadges role={r} /><span className="tabular-nums">· {r.user_count} user</span>
                    </div>
                  </div>
                ) },
            ]}
            empty={<EmptyState icon={Shield} title="Tidak ada peran" />}
          />
        </div>

        {!selected || !draft || !catalog ? (
          <div className="glass-card p-4"><LoadingState rows={6} /></div>
        ) : (
          <div className="space-y-3 lg:space-y-4 min-w-0" data-testid="role-editor">
            <div className="glass-card p-4 space-y-3" data-testid="role-identity">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold flex items-center gap-2" data-testid="role-editor-title">
                    {selected.locked && <Lock className="h-4 w-4 text-muted-foreground" />}{selected.name}
                  </h3>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground"><span>{selected.code}</span><RoleBadges role={selected} /></div>
                </div>
                {!selected.locked && (
                  <RowActions size="default" testId="role-actions" label="Aksi peran"
                    primary={{ label: "Duplikat", icon: Copy, onClick: () => setDupOpen(true), testId: "role-duplicate" }}
                    items={[
                      { label: "Kembalikan ke bawaan", icon: RotateCcw, onSelect: reset, hidden: !selected.has_default || !selected.modified, testId: "role-reset" },
                      { label: "Hapus peran", icon: Trash2, destructive: true, onSelect: remove, hidden: selected.is_system || selected.user_count > 0, testId: "role-delete" },
                    ]} />
                )}
              </div>
              <KeyFacts testId="role-facts" items={[
                { label: "User", value: selected.user_count, numeric: true },
                { label: "Izin aktif", value: selected.locked ? "Semua" : `${draft.perms.size} dari ${total}`, numeric: true, testId: "role-fact-count" },
                { label: "Izin sensitif", value: selected.locked ? "Semua" : sensitiveOn, numeric: true },
                { label: "Tipe", value: selected.locked ? "Super Admin (terkunci)" : selected.is_system ? (selected.modified ? "Bawaan · diubah" : "Bawaan") : "Kustom" },
              ]} />
              {selected.locked ? (
                <p className="text-sm text-muted-foreground" data-testid="role-locked-note">
                  Peran ini memiliki akses penuh (<code>*</code>) ke semua fitur dan sengaja dikunci agar sistem tidak kehilangan administrator.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="role-name">Nama peran</Label>
                    <Input id="role-name" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                      className="glass-input mt-1" data-testid="role-name" />
                  </div>
                  <div>
                    <Label htmlFor="role-desc">Deskripsi</Label>
                    <Input id="role-desc" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                      placeholder="Untuk siapa peran ini dan tanggung jawabnya" className="glass-input mt-1" data-testid="role-description" />
                  </div>
                </div>
              )}
            </div>

            {!selected.locked && (
              <div className="glass-card overflow-hidden" data-testid="role-permissions">
                <div className="px-4 pt-3">
                  <h3 className="text-sm md:text-base font-semibold">Izin akses</h3>
                  <p className="text-xs text-muted-foreground">
                    Pilih tingkat per portal atau per modul (<strong>Lihat</strong> = hanya membaca, <strong>Penuh</strong> = semua aksi), atau klik izin satu per satu.
                    Mengaktifkan aksi ikut menyalakan izin lihatnya. <ShieldAlert className="inline h-3.5 w-3.5 text-amber-800 dark:text-amber-400" /> = izin sensitif.
                  </p>
                </div>
                <PermissionMatrix catalog={catalog} value={draft.perms} onChange={(perms) => setDraft((d) => ({ ...d, perms }))}
                  canGrant={canGrant} labelOf={labelOf} />
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 lg:gap-4 xl:items-start">
              <RoleUsers roleId={selected.id} />
              <RoleHistory roleId={selected.id} labelOf={labelOf} />
            </div>

            {!selected.locked && (
              <FormActionBar dirty={dirty} hint="Belum ada perubahan">
                {dirty && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" data-testid="role-changes-summary">
                    <span className="tabular-nums">+{changes.added.length} / −{changes.removed.length} izin{metaDirty ? " · identitas berubah" : ""}</span>
                    {(changes.added.length + changes.removed.length) > 0 && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button size="sm" variant="link" data-testid="role-changes-preview">Lihat perubahan</Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-96 max-h-80 overflow-y-auto" data-testid="role-changes-panel">
                          {changes.added.length > 0 && <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">Ditambahkan</p>}
                          <ul className="space-y-0.5 text-sm mb-2">{changes.added.map((c) => <li key={c}>+ {labelOf(c)}</li>)}</ul>
                          {changes.removed.length > 0 && <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 mb-1">Dicabut</p>}
                          <ul className="space-y-0.5 text-sm">{changes.removed.map((c) => <li key={c}>− {labelOf(c)}</li>)}</ul>
                        </PopoverContent>
                      </Popover>
                    )}
                  </span>
                )}
                <Button variant="ghost" disabled={!dirty}
                  onClick={() => setDraft({ name: selected.name, description: selected.description || "", perms: new Set(selected.permissions || []) })}
                  data-testid="role-discard">Batal</Button>
                <Button onClick={save} disabled={!dirty || saving || !draft.name.trim()} data-testid="role-save">Simpan</Button>
              </FormActionBar>
            )}
          </div>
        )}
      </div>

      <CreateRoleDialog open={createOpen} onOpenChange={setCreateOpen} roles={roles}
        onCreated={(r) => { refresh(); setSelectedId(r.id); }} />
      <DuplicateRoleDialog open={dupOpen} onOpenChange={setDupOpen} role={selected}
        onCreated={(r) => { refresh(); setSelectedId(r.id); }} />
      <CompareRolesSheet open={compareOpen} onOpenChange={setCompareOpen} roles={roles} base={selected} labelOf={labelOf} />
    </div>
  );
}

function RoleUsers({ roleId }) {
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin", "role-users", roleId],
    queryFn: async () => unwrap(await api.get(`/admin/roles/${roleId}/users`)) || [],
  });
  return (
    <div className="glass-card overflow-hidden" data-testid="role-users">
      <div className="px-4 py-3 border-b border-border/50">
        <h3 className="text-sm md:text-base font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /> User dengan peran ini ({users.length})</h3>
      </div>
      {isLoading ? <div className="p-4"><LoadingState rows={3} /></div> : users.length ? (
        <ul className="divide-y divide-border/40 max-h-72 overflow-y-auto">
          {users.map((u) => (
            <li key={u.id} className="px-4 py-2 text-sm">
              <div className="font-medium">{u.full_name}</div>
              <div className="text-xs text-muted-foreground break-all">{u.email}</div>
            </li>
          ))}
        </ul>
      ) : <p className="px-4 py-6 text-sm text-muted-foreground">Belum ada user. Atur peran user di tab Users.</p>}
    </div>
  );
}

function RoleHistory({ roleId, labelOf }) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin", "role-history", roleId],
    queryFn: async () => unwrap(await api.get(`/admin/roles/${roleId}/history`)) || [],
  });
  const ACTION = { create: "Dibuat", update: "Diubah", reset: "Dikembalikan ke bawaan", delete: "Dihapus" };
  return (
    <div className="glass-card overflow-hidden" data-testid="role-history">
      <div className="px-4 py-3 border-b border-border/50">
        <h3 className="text-sm md:text-base font-semibold flex items-center gap-2"><History className="h-4 w-4 text-muted-foreground" /> Riwayat perubahan</h3>
      </div>
      {isLoading ? <div className="p-4"><LoadingState rows={3} /></div> : rows.length ? (
        <ul className="divide-y divide-border/40 max-h-72 overflow-y-auto">
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-2 text-sm" data-testid={`role-history-${r.id}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{ACTION[r.action] || r.action}{r.renamed ? " · nama diubah" : ""}</span>
                <span className="text-xs text-muted-foreground">{fmtDateTime(r.timestamp)} · {r.user_name}</span>
              </div>
              {(r.added.length > 0 || r.removed.length > 0) && (
                <div className="mt-0.5 text-xs">
                  {r.added.length > 0 && <div className="text-emerald-700 dark:text-emerald-400 truncate" title={r.added.map(labelOf).join(", ")}>+ {r.added.length} izin: {r.added.slice(0, 3).map(labelOf).join(", ")}{r.added.length > 3 ? "…" : ""}</div>}
                  {r.removed.length > 0 && <div className="text-rose-700 dark:text-rose-400 truncate" title={r.removed.map(labelOf).join(", ")}>− {r.removed.length} izin: {r.removed.slice(0, 3).map(labelOf).join(", ")}{r.removed.length > 3 ? "…" : ""}</div>}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : <p className="px-4 py-6 text-sm text-muted-foreground">Belum ada perubahan tercatat.</p>}
    </div>
  );
}
