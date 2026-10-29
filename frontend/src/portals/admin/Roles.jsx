import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, Shield, Eye } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { InlineHelp } from "@/components/shared/InlineHelp";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/components/shared/confirmDialog";

export default function Roles({ embedded = false } = {}) {
  const [roles, setRoles] = useState([]);
  const [perms, setPerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([
        api.get("/admin/roles"),
        api.get("/admin/permissions"),
      ]);
      setRoles(unwrap(r) || []);
      setPerms(unwrap(p) || []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const newButton = (
    <Button onClick={() => setEditing({})} data-testid="roles-new">
      <Plus /> Tambah Role
    </Button>
  );

  return (
    <div className="space-y-3" data-testid="roles-page">
      {/* Halaman mandiri (/admin/roles) punya judul sendiri; di dalam hub "Users & Roles" judul dari hub */}
      <PageHeader
          icon={Shield}
          title="Roles & Permissions"
          subtitle={`${roles.length} role aktif — role sistem (label "System") tidak bisa diubah atau dihapus.`}
          actions={newButton}
        />
      {/* Role = data sejenis → tabel dalam satu kartu, bukan kartu per role (DESIGN_SYSTEM §10.3). */}
      <div className="glass-card overflow-hidden" data-testid="roles-grid">
        <DataTable
          columns={[
            { key: "name", label: "Role", primary: true, sortable: true,
              render: (r) => (
                <div className="min-w-0">
                  <div className="font-semibold flex items-center gap-1.5">
                    {r.name}
                    {r.is_system && <span className="px-1.5 py-0.5 rounded bg-foreground/10 text-xs font-medium">System</span>}
                  </div>
                  <div className="text-xs tabular-nums text-muted-foreground">{r.code}</div>
                </div>
              ) },
            { key: "description", label: "Deskripsi", hideOnMobile: true,
              render: (r) => <span className="text-sm text-muted-foreground">{r.description || "—"}</span> },
            { key: "perm_count", label: "Permission", numeric: true, sortable: true,
              sortAccessor: (r) => (r.permissions || []).length, render: (r) => (r.permissions || []).length },
          ]}
          rows={roles}
          keyField="id"
          loading={loading}
          rowTestIdPrefix="role-card"
          defaultSort={{ key: "name", dir: "asc" }}
          empty={<EmptyState title="Belum ada role" />}
          rowAction={(r) => r.is_system ? (
            <Button variant="ghost" size="icon-sm" onClick={() => setEditing(r)}
                    title="Lihat permission" aria-label={`Lihat permission role ${r.name}`}
                    data-testid={`role-view-${r.id}`}>
              <Eye className="!h-3.5 !w-3.5" />
            </Button>
          ) : (
            <div className="flex gap-1 justify-end">
              <Button variant="ghost" size="icon-sm" onClick={() => setEditing(r)}
                      title="Edit role" aria-label={`Edit role ${r.name}`}
                      data-testid={`role-edit-${r.id}`}>
                <Edit2 className="!h-3.5 !w-3.5" />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => deleteRole(r, load)}
                      className="hover:bg-destructive/10 hover:text-destructive"
                      title="Hapus role" aria-label={`Hapus role ${r.name}`}
                      data-testid={`role-delete-${r.id}`}>
                <Trash2 className="!h-3.5 !w-3.5" />
              </Button>
            </div>
          )}
        />
      </div>

      <RoleDialog editing={editing} perms={perms} onClose={() => setEditing(null)}
                   onSaved={() => { setEditing(null); load(); }} />
    </div>
  );
}

async function deleteRole(r, refresh) {
  if (!(await confirmDialog(`Hapus role '${r.name}'?`))) return;
  try {
    await api.delete(`/admin/roles/${r.id}`);
    toast.success("Role dihapus");
    refresh();
  } catch (e) {
    toast.error(e.response?.data?.errors?.[0]?.message || "Gagal");
  }
}

function RoleDialog({ editing, perms, onClose, onSaved }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        code: editing.code || "",
        name: editing.name || "",
        description: editing.description || "",
        permissions: editing.permissions || [],
      });
    }
  }, [editing]);

  if (!editing) return null;
  const isNew = !editing.id;
  // Role sistem dikelola seed/kode — dialog dibuka sebagai mode lihat (baca-saja).
  const readOnly = !!editing.is_system;
  const hasWildcard = (form.permissions || []).includes("*");

  const submit = async () => {
    setSaving(true);
    try {
      if (isNew) {
        await api.post("/admin/roles", form);
      } else {
        await api.patch(`/admin/roles/${editing.id}`, form);
      }
      toast.success("Role disimpan");
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal");
    } finally {
      setSaving(false);
    }
  };

  // Group perms (mode lihat: hanya permission yang dimiliki role)
  const shownPerms = readOnly ? perms.filter(p => hasWildcard || (form.permissions || []).includes(p.code)) : perms;
  const grouped = shownPerms.reduce((acc, p) => {
    (acc[p.category] = acc[p.category] || []).push(p);
    return acc;
  }, {});

  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-card max-w-2xl" data-testid="role-form-dialog">
        <DialogHeader>
          <DialogTitle>{isNew ? "Role Baru" : readOnly ? `Role ${editing.name}` : "Edit Role"}</DialogTitle>
        </DialogHeader>
        {readOnly && (
          <p className="text-xs text-muted-foreground -mt-1" data-testid="role-form-readonly-note">
            Role sistem tidak dapat diubah. Buat role baru jika butuh kombinasi permission lain.
          </p>
        )}
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Kode *" htmlFor="role-form-code">
              <Input id="role-form-code" value={form.code || ""} disabled={!isNew}
                     onChange={e => setForm({...form, code: e.target.value.toUpperCase().replace(/\s/g,"_")})}
                     className="glass-input" placeholder="CUSTOM_ROLE"
                     data-testid="role-form-code" />
            </Field>
            <Field label="Nama *" htmlFor="role-form-name">
              <Input id="role-form-name" value={form.name || ""} disabled={readOnly} onChange={e => setForm({...form, name: e.target.value})}
                     className="glass-input" placeholder="Nama role"
                     data-testid="role-form-name" />
            </Field>
          </div>
          <Field label="Deskripsi" htmlFor="role-form-description">
            <Textarea id="role-form-description" value={form.description || ""} disabled={readOnly} onChange={e => setForm({...form, description: e.target.value})}
                      className="glass-input min-h-[60px]"
                      data-testid="role-form-description" />
          </Field>
          <Field label={readOnly
            ? (hasWildcard ? "Permissions (semua — *)" : `Permissions (${(form.permissions || []).length})`)
            : `Permissions (${(form.permissions || []).length} dipilih)`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-muted-foreground">Permission menggunakan format dot-notation. User punya akses jika memiliki salah satu role yang berisi permission.</span>
              <InlineHelp id="rbac-permission" size="xs" placement="right" />
            </div>
            <div className="glass-input rounded-lg p-3 max-h-80 overflow-y-auto space-y-3" data-testid="role-form-perms-list">
              {Object.entries(grouped).map(([cat, list]) => (
                <div key={cat} data-testid={`role-form-perm-group-${cat}`}>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center justify-between">
                    <span>{cat}</span>
                    {!readOnly && <button
                      type="button"
                      className="text-aurora text-xs font-medium normal-case tracking-normal hover:underline"
                      onClick={() => {
                        const all = list.map(p => p.code);
                        const has = all.every(c => (form.permissions || []).includes(c));
                        const next = new Set(form.permissions || []);
                        if (has) all.forEach(c => next.delete(c));
                        else all.forEach(c => next.add(c));
                        setForm({...form, permissions: Array.from(next)});
                      }}
                      data-testid={`role-form-perm-toggle-all-${cat}`}
                    >Pilih/lepas semua</button>}
                  </div>
                  <div className="space-y-1">
                    {list.map(p => (
                      <label key={p.code} className={`flex items-center gap-2 text-xs ${readOnly ? "" : "cursor-pointer"}`}>
                        <Checkbox
                          disabled={readOnly}
                          checked={hasWildcard || (form.permissions || []).includes(p.code)}
                          onCheckedChange={(c) => {
                            const next = new Set(form.permissions || []);
                            if (c) next.add(p.code); else next.delete(p.code);
                            setForm({...form, permissions: Array.from(next)});
                          }}
                          data-testid={`role-form-perm-${p.code}`}
                        />
                        <code className="text-xs font-sans font-medium tabular-nums text-muted-foreground">{p.code}</code>
                        <span>{p.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Field>
        </div>
        <DialogFooter className="sticky -bottom-5 -mx-5 -mb-5 px-5 py-3 border-t border-border/50 bg-background/95 backdrop-blur-sm">
          <Button variant="outline" onClick={onClose} data-testid="role-form-cancel">{readOnly ? "Tutup" : "Batal"}</Button>
          {!readOnly && (
            <Button onClick={submit} disabled={saving} data-testid="role-form-save">
              {saving ? "Menyimpan…" : "Simpan"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, htmlFor }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs md:text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}
