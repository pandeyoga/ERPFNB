import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, ShieldCheck, Shield, Eye } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { InlineHelp } from "@/components/shared/InlineHelp";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
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
          subtitle="Role sistem & custom beserta permission-nya."
          actions={newButton}
        />
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{roles.length} role aktif · role sistem (label "System") tidak bisa diubah atau dihapus</p>
      </div>
      {loading ? <LoadingState rows={6} /> : (
        roles.length === 0 ? <EmptyState title="Belum ada role" /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="roles-grid">
            {roles.map((r) => (
              <div key={r.id} className="glass-card p-4" data-testid={`role-card-${r.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <ShieldCheck className="h-4 w-4 text-aurora" />
                    <h3 className="text-sm md:text-base font-semibold truncate">{r.name}</h3>
                  </div>
                  {/* Aksi selalu terlihat (sebelumnya hanya muncul saat hover) */}
                  {r.is_system && (
                    <Button variant="ghost" size="icon-sm" onClick={() => setEditing(r)} className="-mt-1 -mr-1"
                            title="Lihat permission" aria-label={`Lihat permission role ${r.name}`}
                            data-testid={`role-view-${r.id}`}>
                      <Eye className="!h-3.5 !w-3.5" />
                    </Button>
                  )}
                  {!r.is_system && (
                    <div className="flex gap-1 -mt-1 -mr-1">
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
                </div>
                <p className="text-xs font-medium tabular-nums text-muted-foreground mt-1">{r.code}</p>
                {r.description && <p className="text-xs mt-2">{r.description}</p>}
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{(r.permissions || []).length} permissions</span>
                  {r.is_system && (
                    <span className="px-1.5 py-0.5 rounded bg-foreground/10 text-xs font-medium">System</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

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
