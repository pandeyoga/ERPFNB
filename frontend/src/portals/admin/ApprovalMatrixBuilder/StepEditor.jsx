/** StepEditor — edit individual approver within a tier. */
/**
 * Phase B — Approval Matrix Global Builder.
 *
 * Single page at /admin/approvals with:
 *   1. Entity-type selector (left rail)
 *   2. Tier builder with conditions (outlet/brand)
 *   3. Step builder with 3 modes: user / role / permission
 *   4. Live preview simulator
 */
import { useEffect, useMemo, useState } from "react";
import {
  GitBranch, Plus, Trash2, Save, Eye, ArrowDown, AlertCircle,
  User, Users as UsersIcon, Shield, Layers, Settings, RefreshCw,
  CheckCircle2, ChevronRight, Search, X, FileText, ClipboardList,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import api from "@/lib/api";
import { fmtRp } from "@/lib/format";
import { MODE_META } from "./constants";


function StepEditor({ tierIdx, idx, step, users, roles, perms, onChange, onRemove }) {
  const mode = step.match_mode || "permission";
  const ModeIcon = MODE_META[mode]?.icon || Shield;
  return (
    <div className="rounded-lg border border-border/40 p-3 space-y-3" data-testid={`tier-${tierIdx}-step-${idx}`}>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="font-mono">Step {idx + 1}</Badge>
        <Input
          value={step.label || ""}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Label step (mis: Finance Manager Approval)"
          className="h-8 flex-1"
          data-testid={`step-${tierIdx}-${idx}-label`}
        />
        <Button size="icon" variant="ghost" onClick={onRemove} title="Hapus step" aria-label="Hapus step ini">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Mode toggle */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(MODE_META).map(([key, meta]) => {
          const Icon = meta.icon;
          const isActive = mode === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange({ match_mode: key })}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-colors ${isActive ? "bg-aurora/15 border-aurora/40 text-foreground" : "border-border/40 text-muted-foreground hover:bg-foreground/5"}`}
              data-testid={`step-${tierIdx}-${idx}-mode-${key}`}
            >
              <Icon className="h-3.5 w-3.5" /> {meta.label}
            </button>
          );
        })}
      </div>

      {/* Mode-specific selectors */}
      {mode === "user" && (
        <MultiSelectChips
          label="Pilih User"
          options={users.map((u) => ({ value: u.id, label: `${u.full_name} (${u.email})` }))}
          selected={step.any_of_user_ids || []}
          onChange={(v) => onChange({ any_of_user_ids: v })}
          placeholder="Search user…"
          searchable
          testId={`step-${tierIdx}-${idx}-users`}
        />
      )}
      {mode === "role" && (
        <MultiSelectChips
          label="Pilih Role"
          options={roles.map((r) => ({ value: r.id, label: `${r.name} (${r.perm_count} perms)` }))}
          selected={step.any_of_role_ids || []}
          onChange={(v) => onChange({ any_of_role_ids: v })}
          placeholder="Search role…"
          searchable
          testId={`step-${tierIdx}-${idx}-roles`}
        />
      )}
      {mode === "permission" && (
        <MultiSelectChips
          label="Pilih Permission"
          options={perms.map((p) => ({ value: p.code, label: `${p.code} — ${p.label}` }))}
          selected={step.any_of_perms || []}
          onChange={(v) => onChange({ any_of_perms: v })}
          placeholder="Search permission…"
          searchable
          testId={`step-${tierIdx}-${idx}-perms`}
        />
      )}

      {/* Deadline */}
      <div>
        <Label className="text-xs">Deadline (jam, opsional)</Label>
        <Input
          type="number" min="1"
          value={step.deadline_hours ?? ""}
          onChange={(e) => onChange({ deadline_hours: e.target.value === "" ? null : Number(e.target.value) })}
          placeholder="Mis: 24"
          className="mt-1 h-8 max-w-[140px]"
        />
      </div>
    </div>
  );
}

// ============================================================================
// Multi-Select Chip Component
// ============================================================================

function MultiSelectChips({ label, options, selected, onChange, placeholder, searchable, testId }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    if (!search) return options.slice(0, 50);
    const q = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 50);
  }, [options, search]);
  const optionsById = useMemo(() => {
    const m = {};
    for (const o of options) m[o.value] = o;
    return m;
  }, [options]);

  const toggle = (v) => {
    if (selected.includes(v)) {
      onChange(selected.filter((x) => x !== v));
    } else {
      onChange([...selected, v]);
    }
  };
  const remove = (v) => onChange(selected.filter((x) => x !== v));

  return (
    <div data-testid={testId}>
      {label && <Label className="text-xs">{label}</Label>}
      <div
        onClick={() => setOpen(true)}
        className="mt-1 min-h-[36px] rounded-md border border-input bg-background px-2 py-1.5 flex flex-wrap gap-1 cursor-text"
      >
        {selected.length === 0 && (
          <span className="text-sm text-muted-foreground">{placeholder || "Pilih…"}</span>
        )}
        {selected.map((v) => (
          <Badge
            key={v} variant="outline"
            className="gap-1 bg-aurora/10 border-aurora/30"
          >
            <span className="max-w-[200px] truncate">{optionsById[v]?.label || v}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(v); }}
              className="hover:text-red-500"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>{selected.length} item dipilih</DialogDescription>
          </DialogHeader>
          {searchable && (
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari…"
                className="pl-9"
              />
            </div>
          )}
          <div className="max-h-[420px] overflow-y-auto space-y-1">
            {filtered.map((o) => {
              const isSelected = selected.includes(o.value);
              return (
                <button
                  key={o.value} type="button"
                  onClick={() => toggle(o.value)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 ${isSelected ? "bg-aurora/10" : "hover:bg-foreground/5"}`}
                >
                  <input type="checkbox" checked={isSelected} readOnly />
                  <span>{o.label}</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center text-muted-foreground py-6 text-sm">Tidak ada hasil.</div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setOpen(false)}>Selesai</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Preview Result + Diagram View
// ============================================================================

function PreviewResult({ result, usersById, rolesById }) {
  if (!result.has_workflow) {
    return (
      <Card><CardContent className="py-6 text-center text-muted-foreground">
        Workflow belum disimpan untuk entity ini.
      </CardContent></Card>
    );
  }
  if (!result.tier) {
    return (
      <Card><CardContent className="py-6 text-center text-muted-foreground">
        Tidak ada tier yang match untuk amount {fmtRp(result.amount)}.
      </CardContent></Card>
    );
  }
  return (
    <Card data-testid="preview-result">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          Tier Terpilih: <strong>{result.tier.label}</strong>
        </CardTitle>
        <CardDescription>
          Range: {fmtRp(result.tier.min_amount)} → {result.tier.max_amount ? fmtRp(result.tier.max_amount) : "∞"}
          {result.tier.condition_outlet_ids?.length > 0 && ` • condition outlets: ${result.tier.condition_outlet_ids.length}`}
          {result.tier.condition_brand_ids?.length > 0 && ` • condition brands: ${result.tier.condition_brand_ids.length}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {(result.steps_resolved || []).map((s, i) => {
          const Icon = MODE_META[s.match_mode]?.icon || Shield;
          return (
            <div key={i} className="rounded-md border border-border/40 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">Step {i + 1}</Badge>
                  <Icon className="h-4 w-4" style={{ color: MODE_META[s.match_mode]?.color }} />
                  <span className="font-medium">{s.label}</span>
                  <Badge variant="outline" className="text-[10px]">{s.match_mode}</Badge>
                </div>
                <Badge variant="outline" className={s.approvers_count > 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}>
                  {s.approvers_count} approver{s.approvers_count !== 1 ? "s" : ""}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {s.approvers_count === 0 ? (
                  <span className="text-red-500">⚠️ Tidak ada user yang match — step ini akan stuck.</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {s.approvers.map((a) => (
                      <Badge key={a.id} variant="outline" className="text-[11px]">
                        {a.full_name || a.id.slice(0, 8)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function DiagramView({ tiers, entityType, usersById, rolesById, outletsById, brandsById }) {
  if (!tiers.length) {
    return (
      <Card><CardContent className="py-6 text-center text-muted-foreground">
        Belum ada tier.
      </CardContent></Card>
    );
  }
  return (
    <div className="space-y-4" data-testid="diagram-view">
      {tiers.map((tier, ti) => (
        <Card key={ti} className="border-aurora/20">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-aurora/10 border-aurora/30">Tier {ti + 1}</Badge>
              <CardTitle className="text-sm">{tier.label || "(no label)"}</CardTitle>
              <Badge variant="outline" className="text-xs ml-auto">
                {fmtRp(tier.min_amount || 0)} → {tier.max_amount ? fmtRp(tier.max_amount) : "∞"}
              </Badge>
            </div>
            {(tier.condition_outlet_ids?.length > 0 || tier.condition_brand_ids?.length > 0) && (
              <div className="text-xs text-muted-foreground flex flex-wrap gap-1 mt-1">
                {tier.condition_outlet_ids?.map((id) => (
                  <Badge key={id} variant="outline" className="text-[10px]">
                    Outlet: {outletsById[id]?.name || id.slice(0, 8)}
                  </Badge>
                ))}
                {tier.condition_brand_ids?.map((id) => (
                  <Badge key={id} variant="outline" className="text-[10px]">
                    Brand: {brandsById[id]?.name || id.slice(0, 8)}
                  </Badge>
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              {(tier.steps || []).map((step, si) => {
                const Icon = MODE_META[step.match_mode]?.icon || Shield;
                const color = MODE_META[step.match_mode]?.color;
                return (
                  <div key={si} className="flex items-center gap-2">
                    {si > 0 && <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                    <div className="rounded-lg border-2 px-3 py-2 min-w-[160px]" style={{ borderColor: color }}>
                      <div className="flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5" style={{ color }} />
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">{step.match_mode}</span>
                      </div>
                      <div className="text-sm font-medium mt-0.5">{step.label || `(no label)`}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {step.match_mode === "user" && `${step.any_of_user_ids?.length || 0} user`}
                        {step.match_mode === "role" && `${step.any_of_role_ids?.length || 0} role`}
                        {step.match_mode === "permission" && `${step.any_of_perms?.length || 0} perm`}
                        {step.deadline_hours ? ` • ${step.deadline_hours}h SLA` : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default StepEditor;
export { PreviewResult, DiagramView, MultiSelectChips };
