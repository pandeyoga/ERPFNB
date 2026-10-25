import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  GitBranch, Plus, Edit2, Trash2, Sparkles, ChevronDown, ChevronRight,
  Save, Layers,
} from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { InlineHelp } from "@/components/shared/InlineHelp";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import StatusPill from "@/components/shared/StatusPill";
import { fmtRp } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/components/shared/confirmDialog";

export default function ApprovalWorkflows() {
  const [items, setItems] = useState([]);
  const [perms, setPerms] = useState([]);
  const [entityTypes, setEntityTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [seeding, setSeeding] = useState(false);
  const [openIds, setOpenIds] = useState({});

  async function load() {
    setLoading(true);
    try {
      const [w, p, et] = await Promise.all([
        api.get("/admin/business-rules", { params: { rule_type: "approval_workflow" } }),
        api.get("/admin/permissions"),
        api.get("/admin/approval-entity-types"),
      ]);
      setItems(unwrap(w) || []);
      setPerms(unwrap(p) || []);
      setEntityTypes(unwrap(et) || []);
    } catch {
      toast.error("Gagal memuat workflows");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function seedDefaults() {
    if (!(await confirmDialog("Seed default workflows? Workflow yang sudah ada untuk entity yang sama akan diarsipkan."))) return;
    try {
      setSeeding(true);
      await api.post("/admin/business-rules/seed-defaults", { overwrite: true });
      toast.success("Default workflows disusun ulang");
      load();
    } catch {
      toast.error("Gagal seed default");
    } finally { setSeeding(false); }
  }

  async function deleteRule(rule) {
    if (!(await confirmDialog(`Hapus workflow untuk ${rule.rule_data?.entity_type}?`))) return;
    try {
      await api.delete(`/admin/business-rules/${rule.id}`);
      toast.success("Workflow dihapus");
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal hapus");
    }
  }

  const grouped = useMemo(() => {
    const out = {};
    for (const it of items) {
      const et = it.rule_data?.entity_type || "unknown";
      out[et] = out[et] || [];
      out[et].push(it);
    }
    return out;
  }, [items]);

  return (
    <div className="space-y-3" data-testid="approval-workflows-page">
      <PageHeader
        icon={GitBranch}
        title="Approval Workflows"
        subtitle={`${items.length} workflow terdaftar — tier berbasis nominal + rantai approver per entitas.`}
        actions={(
          <>
            <Button variant="outline" onClick={seedDefaults} disabled={seeding} data-testid="wf-seed-defaults">
              <Sparkles /> Reset ke Default
            </Button>
            <Button onClick={() => setEditing({ isNew: true, rule_data: blankRule() })} data-testid="wf-new">
              <Plus /> Tambah Workflow
            </Button>
          </>
        )}
      />

      {/* Halaman ini = editor daftar (legacy); menu "Approval Matrix" membuka builder visual di /admin/approvals */}
      <div className="glass-card p-3 flex items-center justify-between gap-3 flex-wrap text-sm" data-testid="wf-matrix-hint">
        <span className="text-muted-foreground">
          Ingin mengatur approver per role/user dengan kondisi outlet/brand dan simulasi? Gunakan builder visual.
        </span>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/approvals" data-testid="wf-open-matrix">Buka Approval Matrix</Link>
        </Button>
      </div>

      {loading ? <LoadingState rows={6} /> : (
        items.length === 0 ? (
          <EmptyState icon={GitBranch} title="Belum ada workflow"
            description="Klik 'Reset ke Default' untuk membuat workflow default, atau tambah workflow baru." />
        ) : (
          <div className="space-y-3">
            {Object.entries(grouped).map(([entity_type, group]) => (
              <div key={entity_type} className="glass-card overflow-hidden">
                <button
                  onClick={() => setOpenIds(s => ({ ...s, [entity_type]: !s[entity_type] }))}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-foreground/5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-expanded={!!openIds[entity_type]}
                  data-testid={`wf-group-${entity_type}`}>
                  {openIds[entity_type] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <Layers className="h-4 w-4 text-aurora" />
                  <div className="flex-1">
                    <h3 className="text-sm md:text-base font-semibold capitalize">{(entityTypes.find(e => e.value === entity_type)?.label) || entity_type.replaceAll("_", " ")}</h3>
                    <div className="text-xs text-muted-foreground">{group.length} versi · {group.filter(g => g.active).length} aktif</div>
                  </div>
                </button>
                {openIds[entity_type] && (
                  <div className="border-t border-border/50">
                    {group.map(rule => (
                      <RuleCard key={rule.id} rule={rule} entityTypes={entityTypes}
                        onEdit={() => setEditing({ ...rule })}
                        onDelete={() => deleteRule(rule)} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      <WorkflowDialog
        editing={editing}
        entityTypes={entityTypes}
        permsCatalog={perms}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); }} />
    </div>
  );
}

function blankRule() {
  return {
    entity_type: "purchase_request",
    amount_field: null,
    tiers: [
      { min_amount: 0, max_amount: null, label: "Default tier", steps: [{ label: "Approver", any_of_perms: [] }] },
    ],
  };
}

function RuleCard({ rule, entityTypes, onEdit, onDelete }) {
  const tiers = rule.rule_data?.tiers || [];
  return (
    <div className="px-4 py-3 border-b border-border/30 last:border-0">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs tabular-nums px-2 py-0.5 rounded-full bg-foreground/5">v{rule.version}</span>
            <StatusPill status={rule.active ? "active" : "disabled"} />
            <span className="text-xs text-muted-foreground">{tiers.length} tier</span>
          </div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
            {tiers.map((t, ti) => (
              <div key={ti} className="rounded-[calc(var(--radius)-2px)] border border-border/50 p-3 bg-foreground/[0.02]">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t.label || `Tier ${ti + 1}`}</div>
                <div className="text-xs mt-0.5 tabular-nums">
                  {fmtRp(t.min_amount || 0)} <span className="text-muted-foreground">→</span> {t.max_amount != null ? fmtRp(t.max_amount) : <span className="text-muted-foreground">∞</span>}
                </div>
                <div className="mt-2 space-y-1">
                  {(t.steps || []).map((s, si) => (
                    <div key={si} className="flex items-center gap-2 text-xs">
                      <span className="h-5 w-5 rounded-full bg-aurora/10 text-aurora flex items-center justify-center text-[11px] font-bold">{si + 1}</span>
                      <span className="font-medium truncate">{s.label}</span>
                      <span className="text-[11px] text-muted-foreground truncate">{(s.any_of_perms || []).join(" / ") || "(siapa saja)"}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <Button variant="ghost" size="icon-sm" onClick={onEdit} title="Edit workflow" aria-label={`Edit workflow v${rule.version}`} data-testid={`wf-edit-${rule.id}`}>
            <Edit2 className="!h-3.5 !w-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onDelete} className="hover:bg-destructive/10 hover:text-destructive" title="Hapus workflow" aria-label={`Hapus workflow v${rule.version}`} data-testid={`wf-delete-${rule.id}`}>
            <Trash2 className="!h-3.5 !w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function WorkflowDialog({ editing, entityTypes, permsCatalog, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) { setForm(null); return; }
    setForm({
      isNew: !!editing.isNew,
      id: editing.id,
      rule_data: editing.rule_data ? JSON.parse(JSON.stringify(editing.rule_data)) : blankRule(),
    });
  }, [editing]);

  if (!editing || !form) return null;

  const tiers = form.rule_data.tiers || [];

  function setEntity(et) {
    setForm(s => ({ ...s, rule_data: { ...s.rule_data, entity_type: et } }));
  }
  function patchTier(ti, patch) {
    setForm(s => {
      const next = JSON.parse(JSON.stringify(s.rule_data));
      next.tiers[ti] = { ...next.tiers[ti], ...patch };
      return { ...s, rule_data: next };
    });
  }
  function addTier() {
    setForm(s => {
      const next = JSON.parse(JSON.stringify(s.rule_data));
      const lastMax = next.tiers.length ? next.tiers[next.tiers.length - 1].max_amount : 0;
      next.tiers.push({
        min_amount: lastMax || 0, max_amount: null, label: `Tier ${next.tiers.length + 1}`,
        steps: [{ label: "Approver", any_of_perms: [] }],
      });
      return { ...s, rule_data: next };
    });
  }
  function removeTier(ti) {
    setForm(s => {
      const next = JSON.parse(JSON.stringify(s.rule_data));
      next.tiers.splice(ti, 1);
      return { ...s, rule_data: next };
    });
  }
  function patchStep(ti, si, patch) {
    setForm(s => {
      const next = JSON.parse(JSON.stringify(s.rule_data));
      next.tiers[ti].steps[si] = { ...next.tiers[ti].steps[si], ...patch };
      return { ...s, rule_data: next };
    });
  }
  function addStep(ti) {
    setForm(s => {
      const next = JSON.parse(JSON.stringify(s.rule_data));
      next.tiers[ti].steps.push({ label: `Step ${next.tiers[ti].steps.length + 1}`, any_of_perms: [] });
      return { ...s, rule_data: next };
    });
  }
  function removeStep(ti, si) {
    setForm(s => {
      const next = JSON.parse(JSON.stringify(s.rule_data));
      next.tiers[ti].steps.splice(si, 1);
      return { ...s, rule_data: next };
    });
  }

  async function save() {
    // Validation
    if (!form.rule_data.entity_type) { toast.error("Pilih entity type"); return; }
    if (!tiers.length) { toast.error("Minimal 1 tier"); return; }
    for (const t of tiers) {
      if (!(t.steps || []).length) { toast.error("Setiap tier harus punya minimal 1 step"); return; }
    }
    try {
      setSaving(true);
      if (form.isNew) {
        await api.post("/admin/business-rules", {
          rule_type: "approval_workflow",
          scope_type: "group",
          scope_id: "*",
          rule_data: form.rule_data,
        });
        toast.success("Workflow dibuat");
      } else {
        await api.patch(`/admin/business-rules/${form.id}`, {
          rule_data: form.rule_data,
        });
        toast.success("Workflow diperbarui");
      }
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal simpan");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={!!editing} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass-card max-w-4xl" data-testid="wf-dialog">
        <DialogHeader>
          <DialogTitle>{form.isNew ? "Tambah Workflow" : "Edit Workflow"}</DialogTitle>
          <DialogDescription>
            Definisikan tier berbasis nominal + approver bertahap per jenis entitas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Entity type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs md:text-sm font-medium">Jenis Entitas <span className="text-destructive">*</span></Label>
              <SimpleSelect
                value={form.rule_data.entity_type}
                onValueChange={setEntity}
                disabled={!form.isNew}
                options={entityTypes.map(et => ({ value: et.value, label: et.label }))}
                className="glass-input w-full mt-1"
                ariaLabel="Jenis entitas"
                testId="wf-entity-type"
              />
              {!form.isNew && (
                <p className="text-[11px] text-muted-foreground mt-1">Jenis entitas tidak dapat diubah setelah dibuat. Buat workflow baru jika perlu beralih.</p>
              )}
            </div>
            <div>
              <Label htmlFor="wf-amount-field" className="text-xs md:text-sm font-medium">Field Nominal (opsional)</Label>
              <Input id="wf-amount-field" value={form.rule_data.amount_field || ""}
                onChange={e => setForm(s => ({ ...s, rule_data: { ...s.rule_data, amount_field: e.target.value || null } }))}
                placeholder="dihitung otomatis jika kosong" className="glass-input mt-1" data-testid="wf-amount-field" />
            </div>
          </div>

          {/* Tiers */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2">
                <h3 className="text-sm font-semibold">Tier ({tiers.length})</h3>
                <InlineHelp id="approval-workflow-tier" size="xs" placement="right" />
              </div>
              <Button onClick={addTier} variant="outline" size="sm" data-testid="wf-add-tier">
                <Plus /> Tambah Tier
              </Button>
            </div>
            {tiers.map((t, ti) => (
              <div key={ti} className="glass-input rounded-[calc(var(--radius)-2px)] p-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <Label htmlFor={`wf-tier-label-${ti}`} className="text-xs md:text-sm font-medium">Label</Label>
                    <Input id={`wf-tier-label-${ti}`} value={t.label || ""} onChange={e => patchTier(ti, { label: e.target.value })}
                      className="bg-background mt-1" data-testid={`wf-tier-label-${ti}`} />
                  </div>
                  <div>
                    <Label htmlFor={`wf-tier-min-${ti}`} className="text-xs md:text-sm font-medium">Nominal Min (Rp)</Label>
                    <Input id={`wf-tier-min-${ti}`} type="number" value={t.min_amount ?? 0}
                      onChange={e => patchTier(ti, { min_amount: Number(e.target.value) })}
                      className="bg-background mt-1 tabular-nums" data-testid={`wf-tier-min-${ti}`} />
                  </div>
                  <div>
                    <Label htmlFor={`wf-tier-max-${ti}`} className="text-xs md:text-sm font-medium">Nominal Maks (kosong = ∞)</Label>
                    <Input id={`wf-tier-max-${ti}`} type="number" value={t.max_amount ?? ""}
                      onChange={e => patchTier(ti, { max_amount: e.target.value === "" ? null : Number(e.target.value) })}
                      className="bg-background mt-1 tabular-nums" data-testid={`wf-tier-max-${ti}`} />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={() => removeTier(ti)} variant="outline"
                      className="text-destructive w-full" disabled={tiers.length <= 1} data-testid={`wf-tier-remove-${ti}`}>
                      <Trash2 /> Hapus Tier
                    </Button>
                  </div>
                </div>

                {/* Steps */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-2">
                      <div className="text-xs md:text-sm font-semibold">Langkah Approval ({(t.steps || []).length})</div>
                      <InlineHelp id="approval-workflow-step" size="xs" placement="right" />
                    </div>
                    <Button onClick={() => addStep(ti)} variant="outline" size="sm" data-testid={`wf-add-step-${ti}`}>
                      <Plus /> Tambah Step
                    </Button>
                  </div>
                  {(t.steps || []).map((s, si) => (
                    <StepEditor key={si} step={s} stepIdx={si}
                      permsCatalog={permsCatalog}
                      onChange={(p) => patchStep(ti, si, p)}
                      onRemove={() => removeStep(ti, si)}
                      removable={(t.steps || []).length > 1}
                      tIdx={ti} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="sticky -bottom-5 -mx-5 -mb-5 px-5 py-3 border-t border-border/50 bg-background/95 backdrop-blur-sm">
          <Button variant="outline" onClick={onClose} disabled={saving} data-testid="wf-cancel">Batal</Button>
          <Button onClick={save} disabled={saving} data-testid="wf-save">
            <Save /> {saving ? "Menyimpan…" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StepEditor({ step, stepIdx, permsCatalog, onChange, onRemove, removable, tIdx }) {
  const [open, setOpen] = useState(false);
  const grouped = useMemo(() => {
    const m = {};
    for (const p of permsCatalog) {
      m[p.category] = m[p.category] || [];
      m[p.category].push(p);
    }
    return m;
  }, [permsCatalog]);

  return (
    <div className="bg-background rounded-lg border border-border/40 p-3 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-end">
        <div>
          <Label htmlFor={`wf-step-label-${tIdx}-${stepIdx}`} className="text-xs md:text-sm font-medium">Step {stepIdx + 1} — Label</Label>
          <Input id={`wf-step-label-${tIdx}-${stepIdx}`} value={step.label || ""} onChange={e => onChange({ label: e.target.value })}
            className="bg-foreground/[0.02] mt-1" data-testid={`wf-step-label-${tIdx}-${stepIdx}`} />
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setOpen(o => !o)}
            className="flex-1 rounded-lg border border-border/50 px-3 h-9 text-xs flex items-center gap-2 bg-foreground/[0.02] hover:bg-foreground/[0.05]"
            aria-expanded={open}
            data-testid={`wf-step-perms-toggle-${tIdx}-${stepIdx}`}>
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            <span>{(step.any_of_perms || []).length} permission</span>
            <span className="ml-auto text-muted-foreground truncate max-w-[160px]">{(step.any_of_perms || []).join(", ") || "siapa saja"}</span>
          </button>
          {removable && (
            <Button type="button" variant="ghost" size="icon" onClick={onRemove}
              className="hover:bg-destructive/10 hover:text-destructive"
              title="Hapus step" aria-label={`Hapus step ${stepIdx + 1}`}
              data-testid={`wf-step-remove-${tIdx}-${stepIdx}`}>
              <Trash2 className="!h-3.5 !w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Deadline + Escalation config */}
      <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/30">
        <div>
          <Label htmlFor={`wf-step-deadline-${tIdx}-${stepIdx}`} className="text-xs md:text-sm font-medium">
            Deadline (jam)
          </Label>
          <Input
            id={`wf-step-deadline-${tIdx}-${stepIdx}`}
            type="number" min="0" step="1"
            placeholder="Tidak ada batas"
            value={step.deadline_hours ?? ""}
            onChange={e => onChange({ deadline_hours: e.target.value ? parseInt(e.target.value) : null })}
            className="mt-1"
            data-testid={`wf-step-deadline-${tIdx}-${stepIdx}`}
          />
          <p className="text-[11px] text-muted-foreground mt-0.5">Eskalasi dikirim jika melewati batas</p>
        </div>
        <div>
          <Label htmlFor={`wf-step-escalate-${tIdx}-${stepIdx}`} className="text-xs md:text-sm font-medium">
            Eskalasi ke (permission)
          </Label>
          <Input
            id={`wf-step-escalate-${tIdx}-${stepIdx}`}
            placeholder="Misal: *  atau  executive.dashboard.read"
            value={(step.escalate_to_perms || []).join(", ")}
            onChange={e => onChange({
              escalate_to_perms: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
            })}
            className="mt-1"
            data-testid={`wf-step-escalate-${tIdx}-${stepIdx}`}
          />
          <p className="text-[11px] text-muted-foreground mt-0.5">Pisahkan dengan koma. Kosong = step yang sama</p>
        </div>
      </div>

      {open && (
        <div className="mt-2 space-y-2 max-h-64 overflow-y-auto pr-2">
          {Object.entries(grouped).map(([cat, list]) => (
            <div key={cat}>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">{cat}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                {list.map(p => {
                  const checked = (step.any_of_perms || []).includes(p.code);
                  return (
                    <label key={p.code} className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer",
                      checked ? "bg-aurora/10" : "hover:bg-foreground/5",
                    )}>
                      <Checkbox checked={checked}
                        onCheckedChange={(v) => {
                          const set = new Set(step.any_of_perms || []);
                          if (v) set.add(p.code); else set.delete(p.code);
                          onChange({ any_of_perms: Array.from(set) });
                        }} />
                      <span className="truncate flex-1">{p.label}</span>
                      <code className="text-[11px] text-muted-foreground truncate">{p.code}</code>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
