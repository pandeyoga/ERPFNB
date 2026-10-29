/** ApprovalMatrixBuilder — orchestrator. */
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
import PageHeader from "@/components/shared/PageHeader";

import { MODE_META, emptyStep, emptyTier } from "./constants";
import TierEditor from "./TierEditor";
import StepEditor, { PreviewResult, DiagramView } from "./StepEditor";

export default function ApprovalMatrixBuilder() {
  const [entityTypes, setEntityTypes] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [wfMeta, setWfMeta] = useState({ name: "", description: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [perms, setPerms] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [brands, setBrands] = useState([]);
  const [previewSample, setPreviewSample] = useState({ amount: 1000000, outlet_id: "", brand_id: "" });
  const [previewResult, setPreviewResult] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Initial load
  useEffect(() => {
    (async () => {
      try {
        const [etRes, urRes, rlRes, pmRes, olRes, brRes] = await Promise.all([
          api.get("/admin/approval-matrix/entity-types"),
          api.get("/admin/approval-matrix/users", { params: { limit: 200 } }),
          api.get("/admin/approval-matrix/roles"),
          api.get("/admin/approval-matrix/permissions"),
          api.get("/master/outlets"),
          api.get("/master/brands"),
        ]);
        setEntityTypes(etRes.data.data.items || []);
        setUsers(urRes.data.data.items || []);
        setRoles(rlRes.data.data.items || []);
        setPerms(pmRes.data.data.items || []);
        setOutlets(olRes.data.data || []);
        setBrands(brRes.data.data || []);
        if ((etRes.data.data.items || []).length > 0) {
          setSelectedEntity(etRes.data.data.items[0].value);
        }
      } catch (e) {
        toast.error("Gagal memuat data builder");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load workflow when entity changes
  useEffect(() => {
    if (!selectedEntity) return;
    (async () => {
      try {
        const res = await api.get(`/admin/approval-matrix/workflows/${selectedEntity}`);
        const wf = res.data.data.workflow;
        if (wf) {
          const rd = wf.rule_data || {};
          setTiers(rd.tiers || []);
          setWfMeta({ name: wf.name || "", description: wf.description || "" });
        } else {
          setTiers([emptyTier()]);
          setWfMeta({ name: "", description: "" });
        }
        setPreviewResult(null);
      } catch (e) {
        toast.error("Gagal memuat workflow");
      }
    })();
  }, [selectedEntity]);

  const updateTier = (idx, patch) => {
    setTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  };
  const removeTier = (idx) => {
    setTiers((prev) => prev.filter((_, i) => i !== idx));
  };
  const addTier = () => {
    setTiers((prev) => [...prev, emptyTier()]);
  };
  const moveTier = (idx, dir) => {
    setTiers((prev) => {
      const next = [...prev];
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= next.length) return next;
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  };

  const updateStep = (tierIdx, stepIdx, patch) => {
    setTiers((prev) =>
      prev.map((t, i) =>
        i === tierIdx
          ? { ...t, steps: t.steps.map((s, j) => (j === stepIdx ? { ...s, ...patch } : s)) }
          : t,
      ),
    );
  };
  const removeStep = (tierIdx, stepIdx) => {
    setTiers((prev) =>
      prev.map((t, i) =>
        i === tierIdx ? { ...t, steps: t.steps.filter((_, j) => j !== stepIdx) } : t,
      ),
    );
  };
  const addStep = (tierIdx) => {
    setTiers((prev) =>
      prev.map((t, i) => (i === tierIdx ? { ...t, steps: [...t.steps, emptyStep()] } : t)),
    );
  };

  const save = async () => {
    if (!selectedEntity) return;
    if (!tiers.length) {
      toast.error("Minimal 1 tier");
      return;
    }
    setSaving(true);
    try {
      await api.post("/admin/approval-matrix/workflows", {
        entity_type: selectedEntity,
        name: wfMeta.name || `${selectedEntity} workflow`,
        description: wfMeta.description,
        tiers,
      });
      toast.success("Workflow disimpan (versi baru aktif).");
      // Refresh entity-types to update has_workflow indicator
      const etRes = await api.get("/admin/approval-matrix/entity-types");
      setEntityTypes(etRes.data.data.items || []);
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const runPreview = async () => {
    if (!selectedEntity) return;
    setPreviewLoading(true);
    try {
      const res = await api.post("/admin/approval-matrix/preview", {
        entity_type: selectedEntity,
        sample: {
          amount: Number(previewSample.amount) || 0,
          outlet_id: previewSample.outlet_id || null,
          brand_id: previewSample.brand_id || null,
        },
      });
      setPreviewResult(res.data.data);
    } catch (e) {
      toast.error("Gagal preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  const usersById = useMemo(() => {
    const m = {};
    for (const u of users) m[u.id] = u;
    return m;
  }, [users]);
  const rolesById = useMemo(() => {
    const m = {};
    for (const r of roles) m[r.id] = r;
    return m;
  }, [roles]);
  const outletsById = useMemo(() => {
    const m = {};
    for (const o of outlets) m[o.id] = o;
    return m;
  }, [outlets]);
  const brandsById = useMemo(() => {
    const m = {};
    for (const b of brands) m[b.id] = b;
    return m;
  }, [brands]);

  if (loading) {
    return (
      <div className="space-y-3" data-testid="approval-matrix-builder">
        <PageHeader icon={GitBranch} title="Approval Matrix" subtitle="Memuat builder…" />
        <div className="py-10 text-center text-muted-foreground" data-testid="approval-matrix-builder-loading">
          Memuat builder…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="approval-matrix-builder">
      <PageHeader
        icon={GitBranch}
        title="Approval Matrix"
        subtitle="Alur approval per entitas dengan 3 mode routing (Permission, Role, User Spesifik); bisa kondisional per outlet/brand."
        actions={(
          <Button onClick={save} disabled={saving || !selectedEntity} data-testid="btn-save-workflow">
            <Save /> {saving ? "Menyimpan…" : "Simpan Workflow"}
          </Button>
        )}
      />

      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-3 lg:gap-4 items-start">
        {/* Entity rail */}
        <Card data-testid="entity-rail" className="md:sticky md:top-2">
          <CardHeader className="pb-2">
            <CardTitle>Jenis Entitas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 px-2 pb-2">
            {entityTypes.map((et) => (
              <button
                key={et.value}
                onClick={() => setSelectedEntity(et.value)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedEntity === et.value ? "bg-aurora/10 border-aurora/30" : "border-transparent hover:bg-foreground/5"}`}
                aria-pressed={selectedEntity === et.value}
                data-testid={`entity-btn-${et.value}`}
              >
                <div>
                  <div className="font-medium">{et.label}</div>
                  <div className="text-xs font-medium tabular-nums text-muted-foreground">{et.value}</div>
                </div>
                {et.has_workflow ? (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border-emerald-500/30 text-xs">
                    v{et.version}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">belum ada</Badge>
                )}
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Builder + Preview */}
        <div className="space-y-4">
          {/* Workflow meta */}
          <Card>
            <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="wf-name" className="text-xs md:text-sm font-medium">Nama Workflow</Label>
                <Input
                  id="wf-name" value={wfMeta.name}
                  onChange={(e) => setWfMeta((m) => ({ ...m, name: e.target.value }))}
                  placeholder={`mis. ${selectedEntity || "workflow"} workflow`}
                  className="mt-1"
                  data-testid="input-wf-name"
                />
              </div>
              <div>
                <Label htmlFor="wf-desc" className="text-xs md:text-sm font-medium">Deskripsi</Label>
                <Input
                  id="wf-desc" value={wfMeta.description}
                  onChange={(e) => setWfMeta((m) => ({ ...m, description: e.target.value }))}
                  placeholder="Catatan internal (opsional)"
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="builder">
            <TabsList>
              <TabsTrigger value="builder" data-testid="tab-builder">
                <Settings /> Builder
              </TabsTrigger>
              <TabsTrigger value="preview" data-testid="tab-preview">
                <Eye /> Simulasi
              </TabsTrigger>
              <TabsTrigger value="diagram" data-testid="tab-diagram">
                <GitBranch /> Diagram
              </TabsTrigger>
            </TabsList>

            <TabsContent value="builder" className="space-y-3">
              {tiers.map((tier, ti) => (
                <TierEditor
                  key={ti} idx={ti} tier={tier} total={tiers.length}
                  onChange={(patch) => updateTier(ti, patch)}
                  onRemove={() => removeTier(ti)}
                  onMove={(dir) => moveTier(ti, dir)}
                  onAddStep={() => addStep(ti)}
                  onUpdateStep={(si, patch) => updateStep(ti, si, patch)}
                  onRemoveStep={(si) => removeStep(ti, si)}
                  users={users} roles={roles} perms={perms}
                  outlets={outlets} brands={brands}
                />
              ))}
              <Button variant="outline" onClick={addTier} data-testid="btn-add-tier">
                <Plus /> Tambah Tier
              </Button>
            </TabsContent>

            <TabsContent value="preview" className="space-y-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Simulasi Approval</CardTitle>
                  <CardDescription>
                    Masukkan contoh nominal + outlet/brand untuk melihat tier yang terpicu dan siapa approver-nya.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor="preview-amount" className="text-xs md:text-sm font-medium">Nominal (Rp)</Label>
                      <Input
                        id="preview-amount"
                        type="number" min="0" step="100000"
                        value={previewSample.amount}
                        onChange={(e) => setPreviewSample((s) => ({ ...s, amount: e.target.value }))}
                        className="mt-1" data-testid="input-preview-amount"
                      />
                    </div>
                    <div>
                      <Label htmlFor="preview-outlet" className="text-xs md:text-sm font-medium">Outlet (opsional)</Label>
                      <Select
                        value={previewSample.outlet_id || "none"}
                        onValueChange={(v) => setPreviewSample((s) => ({ ...s, outlet_id: v === "none" ? "" : v }))}
                      >
                        <SelectTrigger id="preview-outlet" className="mt-1" data-testid="select-preview-outlet"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Semua outlet —</SelectItem>
                          {outlets.map((o) => (
                            <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="preview-brand" className="text-xs md:text-sm font-medium">Brand (opsional)</Label>
                      <Select
                        value={previewSample.brand_id || "none"}
                        onValueChange={(v) => setPreviewSample((s) => ({ ...s, brand_id: v === "none" ? "" : v }))}
                      >
                        <SelectTrigger id="preview-brand" className="mt-1" data-testid="select-preview-brand"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Semua brand —</SelectItem>
                          {brands.map((b) => (
                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button onClick={runPreview} disabled={previewLoading} data-testid="btn-run-preview">
                    <Eye /> {previewLoading ? "Menjalankan…" : "Jalankan Simulasi"}
                  </Button>
                </CardContent>
              </Card>
              {previewResult && (
                <PreviewResult result={previewResult} usersById={usersById} rolesById={rolesById} />
              )}
            </TabsContent>

            <TabsContent value="diagram">
              <DiagramView
                tiers={tiers} entityType={selectedEntity}
                usersById={usersById} rolesById={rolesById}
                outletsById={outletsById} brandsById={brandsById}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Tier Editor
// ============================================================================

