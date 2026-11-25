/** Dialog Peran: buat (kosong / salin dari peran lain), duplikat, dan bandingkan dua peran. */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { diff } from "./permissionUtils";

const toCode = (s) => s.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
const errMsg = (e, fb) => e?.response?.data?.errors?.[0]?.message || fb;

export function CreateRoleDialog({ open, onOpenChange, roles, onCreated }) {
  const [form, setForm] = useState({ name: "", code: "", description: "", from: "" });
  const [codeTouched, setCodeTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setForm({ name: "", code: "", description: "", from: "" }); setCodeTouched(false); } }, [open]);
  const submit = async () => {
    if (!form.name.trim() || !form.code) { toast.error("Nama dan kode peran wajib"); return; }
    setSaving(true);
    try {
      const src = roles.find((r) => r.id === form.from);
      const res = form.from
        ? await api.post(`/admin/roles/${form.from}/duplicate`, { code: form.code, name: form.name, description: form.description || undefined })
        : await api.post("/admin/roles", { code: form.code, name: form.name, description: form.description || undefined, permissions: [] });
      toast.success(src ? `Peran dibuat dari ${src.name}` : "Peran dibuat — atur izinnya");
      onCreated(unwrap(res));
      onOpenChange(false);
    } catch (e) { toast.error(errMsg(e, "Gagal membuat peran")); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="role-create-dialog">
        <DialogHeader>
          <DialogTitle>Tambah Peran</DialogTitle>
          <DialogDescription>Mulai dari kosong, atau salin izin peran yang mirip lalu sesuaikan.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="role-new-name">Nama peran</Label>
            <Input id="role-new-name" value={form.name} placeholder="Mis. Area Manager Bakery"
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, code: codeTouched ? f.code : toCode(e.target.value) }))}
              className="glass-input mt-1" data-testid="role-new-name" />
          </div>
          <div>
            <Label htmlFor="role-new-code">Kode</Label>
            <Input id="role-new-code" value={form.code} onChange={(e) => { setCodeTouched(true); setForm((f) => ({ ...f, code: toCode(e.target.value) })); }}
              className="glass-input mt-1 font-medium tabular-nums" data-testid="role-new-code" />
            <p className="text-xs text-muted-foreground mt-0.5">Huruf besar, angka, garis bawah. Tidak bisa diubah setelah dibuat.</p>
          </div>
          <div>
            <Label htmlFor="role-new-desc">Deskripsi</Label>
            <Textarea id="role-new-desc" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="glass-input mt-1" data-testid="role-new-description" />
          </div>
          <div>
            <Label>Mulai dari</Label>
            <SimpleSelect value={form.from} onValueChange={(v) => setForm((f) => ({ ...f, from: v || "" }))}
              options={[{ value: "", label: "Kosong (tanpa izin)" }, ...roles.filter((r) => !r.locked).map((r) => ({ value: r.id, label: `Salin dari ${r.name}` }))]}
              ariaLabel="Mulai dari" className="glass-input w-full mt-1" testId="role-new-from" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="role-new-cancel">Batal</Button>
          <Button onClick={submit} disabled={saving} data-testid="role-new-submit">Buat Peran</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DuplicateRoleDialog({ open, onOpenChange, role, onCreated }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open && role) { setName(`Salinan ${role.name}`); setCode(toCode(`${role.code}_COPY`)); } }, [open, role]);
  const submit = async () => {
    setSaving(true);
    try {
      const res = await api.post(`/admin/roles/${role.id}/duplicate`, { code, name });
      toast.success("Peran diduplikat");
      onCreated(unwrap(res));
      onOpenChange(false);
    } catch (e) { toast.error(errMsg(e, "Gagal menduplikat")); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="role-duplicate-dialog">
        <DialogHeader>
          <DialogTitle>Duplikat Peran</DialogTitle>
          <DialogDescription>Peran baru dengan izin yang sama persis dengan {role?.name}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="role-dup-name">Nama peran</Label>
            <Input id="role-dup-name" value={name} onChange={(e) => setName(e.target.value)} className="glass-input mt-1" data-testid="role-dup-name" />
          </div>
          <div>
            <Label htmlFor="role-dup-code">Kode</Label>
            <Input id="role-dup-code" value={code} onChange={(e) => setCode(toCode(e.target.value))} className="glass-input mt-1" data-testid="role-dup-code" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="role-dup-cancel">Batal</Button>
          <Button onClick={submit} disabled={saving || !name.trim() || !code} data-testid="role-dup-submit">Duplikat</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CompareRolesSheet({ open, onOpenChange, roles, base, labelOf }) {
  const [otherId, setOtherId] = useState("");
  useEffect(() => { if (open) setOtherId(roles.find((r) => r.id !== base?.id && !r.locked)?.id || ""); }, [open, roles, base]);
  const other = roles.find((r) => r.id === otherId);
  const d = useMemo(() => (base && other ? diff(other.permissions, base.permissions) : { added: [], removed: [] }), [base, other]);
  const both = base && other ? base.permissions.filter((p) => other.permissions.includes(p)).length : 0;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto" data-testid="role-compare-sheet">
        <SheetHeader>
          <SheetTitle>Bandingkan Peran</SheetTitle>
          <SheetDescription>Izin yang hanya dimiliki salah satu peran.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{base?.name}</span>
            <span className="text-muted-foreground">vs</span>
            <SimpleSelect value={otherId} onValueChange={setOtherId} ariaLabel="Peran pembanding"
              options={roles.filter((r) => r.id !== base?.id).map((r) => ({ value: r.id, label: r.name }))}
              className="glass-input w-56" testId="role-compare-select" />
          </div>
          <p className="text-xs text-muted-foreground" data-testid="role-compare-summary">{both} izin sama · {d.added.length} hanya di {base?.name} · {d.removed.length} hanya di {other?.name || "—"}</p>
          {[["Hanya di " + (base?.name || ""), d.added, "role-compare-only-base"], ["Hanya di " + (other?.name || ""), d.removed, "role-compare-only-other"]].map(([title, list, tid]) => (
            <div key={tid} data-testid={tid}>
              <h4 className="text-sm font-semibold mb-1">{title} ({list.length})</h4>
              {list.length ? (
                <ul className="space-y-0.5 text-sm">{list.map((c) => <li key={c} title={c}>{labelOf(c)}</li>)}</ul>
              ) : <p className="text-xs text-muted-foreground">Tidak ada.</p>}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
