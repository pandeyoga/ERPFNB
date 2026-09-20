/** UserDialog — create/edit user modal. */
import { useEffect, useState } from "react";
import {
  Plus, Edit2, Trash2, Search, KeyRound, Building2, Store, Globe2,
  ShieldCheck, Users2, UserCog,
} from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { fmtRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import useOutletScope from "@/hooks/useOutletScope";

/* ─── Access Level helper ──────────────────────────────────────────── */
import { isFullAccess, resolveAccessLevel, AccessBadge } from "./helpers";
import { Section, Field } from "./ResetPwdDialog";

function UserDialog({ editing, roles, outlets, brands, onClose, onSaved }) {
  const isNew = editing && !editing.id;
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        email: editing.email || "",
        full_name: editing.full_name || "",
        phone: editing.phone || "",
        password: "",
        role_ids: editing.role_ids || [],
        outlet_ids: editing.outlet_ids || [],
        brand_ids: editing.brand_ids || [],
        default_outlet_id: editing.default_outlet_id || "",
        default_portal: editing.default_portal || "",
        status: editing.status || "active",
      });
    }
  }, [editing]);

  if (!editing) return null;

  /* Quick setters */
  const setFullAccess = () => {
    setForm((f) => ({
      ...f,
      outlet_ids: outlets.map((o) => o.id),
      brand_ids: brands.map((b) => b.id),
      default_outlet_id: "",
    }));
  };
  const clearAccess = () => {
    setForm((f) => ({ ...f, outlet_ids: [], brand_ids: [], default_outlet_id: "" }));
  };

  /* Auto-sync brand_ids when outlet_ids change */
  const toggleOutlet = (id, checked) => {
    const ids = new Set(form.outlet_ids || []);
    if (checked) ids.add(id); else ids.delete(id);
    const newOutletIds = Array.from(ids);
    // auto-include corresponding brands
    const associatedBrandIds = new Set(form.brand_ids || []);
    const selectedOutlets = outlets.filter((o) => newOutletIds.includes(o.id));
    selectedOutlets.forEach((o) => associatedBrandIds.add(o.brand_id));
    // if outlet removed, check if its brand still has other selected outlets
    if (!checked) {
      const removedOutlet = outlets.find((o) => o.id === id);
      if (removedOutlet) {
        const hasOtherOutlets = newOutletIds.some((oid) => {
          const ou = outlets.find((o) => o.id === oid);
          return ou && ou.brand_id === removedOutlet.brand_id;
        });
        if (!hasOtherOutlets) associatedBrandIds.delete(removedOutlet.brand_id);
      }
    }
    setForm((f) => ({
      ...f,
      outlet_ids: newOutletIds,
      brand_ids: Array.from(associatedBrandIds),
      // clear default_outlet_id if removed
      default_outlet_id: newOutletIds.includes(f.default_outlet_id) ? f.default_outlet_id : "",
    }));
  };

  const toggleBrand = (id, checked) => {
    const ids = new Set(form.brand_ids || []);
    if (checked) ids.add(id); else ids.delete(id);
    setForm((f) => ({ ...f, brand_ids: Array.from(ids) }));
  };

  const isAllOutlets = outlets.length > 0 && outlets.every((o) => (form.outlet_ids || []).includes(o.id));
  const isAllBrands = brands.length > 0 && brands.every((b) => (form.brand_ids || []).includes(b.id));

  const submit = async () => {
    setSaving(true);
    try {
      if (isNew) {
        if (!form.password || form.password.length < 8) {
          toast.error("Password minimal 8 karakter");
          setSaving(false);
          return;
        }
        await api.post("/admin/users", {
          ...form,
          default_outlet_id: form.default_outlet_id || null,
          default_portal: form.default_portal || null,
        });
        toast.success("User dibuat");
      } else {
        const patch = { ...form };
        delete patch.password;
        delete patch.email;
        if (!patch.default_outlet_id) patch.default_outlet_id = null;
        if (!patch.default_portal) patch.default_portal = null;
        await api.patch(`/admin/users/${editing.id}`, patch);
        toast.success("User diperbarui");
      }
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal simpan");
    } finally {
      setSaving(false);
    }
  };

  // Group outlets by brand for display
  const outletsByBrand = brands.map((b) => ({
    brand: b,
    outlets: outlets.filter((o) => o.brand_id === b.id),
  })).filter((g) => g.outlets.length > 0);

  const selectedOutletCount = (form.outlet_ids || []).length;
  const selectedBrandCount = (form.brand_ids || []).length;

  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-card max-w-2xl max-h-[92vh] overflow-y-auto" data-testid="user-dialog">
        <DialogHeader>
          <DialogTitle>{isNew ? "User Baru" : "Edit User"}</DialogTitle>
          <DialogDescription>
            {isNew ? "Buat akun untuk anggota tim baru." : "Update detail user dan akses."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Basic Info */}
          <Section title="Informasi Dasar">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nama Lengkap *" className="col-span-2 sm:col-span-1">
                <Input value={form.full_name || ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                       className="glass-input" data-testid="user-form-name" />
              </Field>
              <Field label="Phone" className="col-span-2 sm:col-span-1">
                <Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                       className="glass-input" />
              </Field>
              <Field label="Email *" className="col-span-2">
                <Input type="email" disabled={!isNew} value={form.email || ""}
                       onChange={(e) => setForm({ ...form, email: e.target.value })}
                       className="glass-input" data-testid="user-form-email" />
              </Field>
              {isNew && (
                <Field label="Password (min 8) *" className="col-span-2">
                  <Input type="password" value={form.password || ""}
                         onChange={(e) => setForm({ ...form, password: e.target.value })}
                         className="glass-input" data-testid="user-form-password" />
                </Field>
              )}
            </div>
          </Section>

          {/* Roles */}
          <Section title="Roles & Permissions">
            <div className="glass-input rounded-lg p-3 max-h-32 overflow-y-auto grid grid-cols-2 gap-1.5">
              {roles.map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={(form.role_ids || []).includes(r.id)}
                    onCheckedChange={(c) => {
                      const ids = new Set(form.role_ids || []);
                      if (c) ids.add(r.id); else ids.delete(r.id);
                      setForm({ ...form, role_ids: Array.from(ids) });
                    }}
                  />
                  <span className="leading-tight">
                    <span className="block">{r.name}</span>
                    <span className="text-[10px] text-muted-foreground">{r.code}</span>
                  </span>
                </label>
              ))}
            </div>
          </Section>

          {/* Access Level */}
          <Section
            title="Level Akses"
            badge={
              isAllOutlets && isAllBrands
                ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 font-medium flex items-center gap-1"><Globe2 className="h-3 w-3" /> Full Access</span>
                : selectedOutletCount > 0
                ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-medium flex items-center gap-1"><Store className="h-3 w-3" /> {selectedOutletCount} outlet dipilih</span>
                : <span className="text-[11px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">Tidak ada akses</span>
            }
          >
            {/* Quick access level buttons */}
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={setFullAccess}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all",
                  isAllOutlets && isAllBrands
                    ? "border-green-500/50 bg-green-500/10 text-green-600"
                    : "border-border hover:border-green-500/50 hover:bg-green-500/5 text-muted-foreground"
                )}
                data-testid="access-full"
              >
                <Globe2 className="h-4 w-4" />
                <span>
                  <span className="block text-sm font-semibold">Full Access</span>
                  <span className="block text-[10px] opacity-70">Owner, Executive, Finance, Procurement</span>
                </span>
              </button>
              <button
                type="button"
                onClick={clearAccess}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all",
                  !isAllOutlets && selectedOutletCount > 0
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-600"
                    : selectedOutletCount === 0
                    ? "border-border hover:border-amber-500/50 hover:bg-amber-500/5 text-muted-foreground"
                    : "border-border hover:border-amber-500/50 hover:bg-amber-500/5 text-muted-foreground"
                )}
                data-testid="access-clear"
              >
                <Store className="h-4 w-4" />
                <span>
                  <span className="block text-sm font-semibold">Outlet Staff</span>
                  <span className="block text-[10px] opacity-70">Pilih outlet spesifik di bawah</span>
                </span>
              </button>
            </div>

            {/* Outlet scope by brand group */}
            <div className="space-y-3">
              {outletsByBrand.map(({ brand, outlets: brandOutlets }) => {
                const allBrandOutletsChecked = brandOutlets.every((o) => (form.outlet_ids || []).includes(o.id));
                const someBrandOutletsChecked = brandOutlets.some((o) => (form.outlet_ids || []).includes(o.id));
                return (
                  <div key={brand.id} className="glass-input rounded-lg p-3">
                    {/* Brand header row */}
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <Checkbox
                        checked={allBrandOutletsChecked}
                        data-state={someBrandOutletsChecked && !allBrandOutletsChecked ? "indeterminate" : undefined}
                        onCheckedChange={(c) => {
                          brandOutlets.forEach((o) => toggleOutlet(o.id, !!c));
                        }}
                      />
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-sm">{brand.name}</span>
                      <span
                        className="ml-1 h-3 w-3 rounded-full ring-1 ring-white/20"
                        style={{ background: brand.color || "#888" }}
                      />
                      {(form.brand_ids || []).includes(brand.id) && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 ml-auto">Brand ✓</span>
                      )}
                    </label>
                    {/* Outlet rows */}
                    <div className="pl-6 grid grid-cols-2 gap-1">
                      {brandOutlets.map((o) => (
                        <label key={o.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={(form.outlet_ids || []).includes(o.id)}
                            onCheckedChange={(c) => toggleOutlet(o.id, !!c)}
                          />
                          <Store className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{o.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Standalone Brand scope (for reporting/executive) */}
            {brands.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-1.5">
                  Brand access untuk laporan &amp; Executive Dashboard:
                </p>
                <div className="glass-input rounded-lg p-3 grid grid-cols-2 gap-1.5">
                  {brands.map((b) => (
                    <label key={b.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={(form.brand_ids || []).includes(b.id)}
                        onCheckedChange={(c) => toggleBrand(b.id, !!c)}
                      />
                      <span
                        className="h-3 w-3 rounded-full ring-1 ring-white/20 flex-shrink-0"
                        style={{ background: b.color || "#888" }}
                      />
                      <span>{b.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* Default Portal & Outlet */}
          <Section title="Preferensi Default">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Portal Default">
                <SimpleSelect
                  value={form.default_portal || ""}
                  onValueChange={(v) => setForm({ ...form, default_portal: v })}
                  options={[
                    { value: "", label: "— Otomatis —" },
                    { value: "admin", label: "Admin" },
                    { value: "executive", label: "Executive" },
                    { value: "finance", label: "Finance" },
                    { value: "hr", label: "HR" },
                    { value: "procurement", label: "Procurement" },
                    { value: "inventory", label: "Inventory" },
                    { value: "outlet", label: "Outlet" },
                    { value: "owner", label: "Owner" },
                  ]}
                  placeholder="— Otomatis —"
                  className="glass-input rounded-lg w-full px-3 h-10 text-sm"
                  testId="user-default-portal"
                />
              </Field>
              <Field label="Outlet Default">
                <SimpleSelect
                  value={form.default_outlet_id || ""}
                  onValueChange={(v) => setForm({ ...form, default_outlet_id: v })}
                  disabled={(form.outlet_ids || []).length === 0}
                  options={[{ value: "", label: "— Tidak ada / pilih manual —" }, ...outlets.filter((o) => (form.outlet_ids || []).includes(o.id)).map((o) => ({ value: o.id, label: o.name }))]}
                  placeholder="— Tidak ada / pilih manual —"
                  className="glass-input rounded-lg w-full px-3 h-10 text-sm"
                  testId="user-default-outlet"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Outlet yang otomatis dipilih saat user membuka halaman baru
                </p>
              </Field>
            </div>
          </Section>

          {/* Status (edit only) */}
          {!isNew && (
            <Section title="Status Akun">
              <SimpleSelect
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v })}
                options={[
                  { value: "active", label: "Aktif" },
                  { value: "disabled", label: "Nonaktif" },
                ]}
                className="glass-input rounded-lg w-full px-3 h-10 text-sm"
                testId="user-status"
              />
            </Section>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={submit} disabled={saving} className="pill-active" data-testid="user-form-save">
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Reset password dialog ────────────────────────────────────────── */

export default UserDialog;
