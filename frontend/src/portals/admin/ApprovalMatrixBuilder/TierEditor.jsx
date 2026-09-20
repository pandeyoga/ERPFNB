/** TierEditor — edit a single approval tier. */
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

import { emptyStep } from "./constants";
import StepEditor, { MultiSelectChips } from "./StepEditor";

function TierEditor({
  idx, tier, total, onChange, onRemove, onMove,
  onAddStep, onUpdateStep, onRemoveStep,
  users, roles, perms, outlets, brands,
}) {
  return (
    <Card className="border-aurora/20" data-testid={`tier-${idx}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-aurora/10 border-aurora/30">Tier {idx + 1}</Badge>
            <Input
              value={tier.label || ""}
              onChange={(e) => onChange({ label: e.target.value })}
              placeholder="Label tier (mis: Small <5M)"
              className="h-8 max-w-[280px]"
              data-testid={`tier-${idx}-label`}
            />
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => onMove(-1)} disabled={idx === 0} title="Naikkan" aria-label="Naikkan posisi tier">
              ↑
            </Button>
            <Button size="icon" variant="ghost" onClick={() => onMove(1)} disabled={idx === total - 1} title="Turunkan" aria-label="Turunkan posisi tier">
              ↓
            </Button>
            <Button size="icon" variant="ghost" onClick={onRemove} title="Hapus tier" aria-label="Hapus tier">
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Amount range */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>Min Amount</Label>
            <Input
              type="number" min="0" step="100000"
              value={tier.min_amount ?? 0}
              onChange={(e) => onChange({ min_amount: Number(e.target.value) })}
              className="mt-1"
              data-testid={`tier-${idx}-min`}
            />
          </div>
          <div>
            <Label>Max Amount (kosong = unlimited)</Label>
            <Input
              type="number" min="0" step="100000"
              value={tier.max_amount ?? ""}
              onChange={(e) => onChange({ max_amount: e.target.value === "" ? null : Number(e.target.value) })}
              className="mt-1"
              placeholder="∞"
              data-testid={`tier-${idx}-max`}
            />
          </div>
        </div>

        {/* Conditions */}
        <div className="rounded-lg border border-border/40 p-3 space-y-2 bg-foreground/[0.02]">
          <div className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
            <Layers className="h-3.5 w-3.5" /> Kondisi (opsional)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <MultiSelectChips
              label="Hanya untuk Outlet"
              options={outlets.map((o) => ({ value: o.id, label: o.name }))}
              selected={tier.condition_outlet_ids || []}
              onChange={(v) => onChange({ condition_outlet_ids: v })}
              placeholder="— semua outlet —"
              testId={`tier-${idx}-outlets`}
            />
            <MultiSelectChips
              label="Hanya untuk Brand"
              options={brands.map((b) => ({ value: b.id, label: b.name }))}
              selected={tier.condition_brand_ids || []}
              onChange={(v) => onChange({ condition_brand_ids: v })}
              placeholder="— semua brand —"
              testId={`tier-${idx}-brands`}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase text-muted-foreground">Approval Steps</div>
          {(tier.steps || []).map((step, si) => (
            <StepEditor
              key={si} tierIdx={idx} idx={si} step={step}
              users={users} roles={roles} perms={perms}
              onChange={(patch) => onUpdateStep(si, patch)}
              onRemove={() => onRemoveStep(si)}
            />
          ))}
          <Button variant="outline" size="sm" onClick={onAddStep} className="gap-1" data-testid={`tier-${idx}-add-step`}>
            <Plus className="h-3.5 w-3.5" /> Tambah Step
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Step Editor
// ============================================================================


export default TierEditor;
