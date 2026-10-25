/** IncentiveSchemeEditor — Sheet editor for incentive_policy.
 * rule_type tabs (pct_of_sales / flat_per_target / tiered_sales).
 */
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import RuleEditorShell from "./RuleEditorShell";
import { fmtRp } from "@/lib/format";

export default function IncentiveSchemeEditor(props) {
  return (
    <RuleEditorShell
      {...props}
      variant="sheet"
      renderBody={({ ruleData, setRuleData }) => {
        const ruleType = ruleData.rule_type || "pct_of_sales";
        function set(field, value) { setRuleData({ ...ruleData, [field]: value }); }
        const eligibility = ruleData.eligibility || {};
        function setEli(field, value) {
          set("eligibility", { ...eligibility, [field]: value });
        }
        const tiers = ruleData.tiers || [];

        function tierValid(i) {
          const t = tiers[i];
          if (!t) return true;
          if (t.min_sales != null && t.max_sales != null && Number(t.min_sales) > Number(t.max_sales)) {
            return false;
          }
          for (let j = 0; j < tiers.length; j++) {
            if (j === i) continue;
            const o = tiers[j];
            if (o.min_sales == null || o.max_sales == null) continue;
            const a1 = Number(t.min_sales ?? 0), a2 = Number(t.max_sales ?? Infinity);
            const b1 = Number(o.min_sales ?? 0), b2 = Number(o.max_sales ?? Infinity);
            if (a1 <= b2 && b1 <= a2) return false;
          }
          return true;
        }

        function addTier() {
          set("tiers", [...tiers, { min_sales: 0, max_sales: 0, incentive_amount: 0, notes: "" }]);
        }

        return (
          <div className="space-y-4">
            <Tabs value={ruleType} onValueChange={(v) => set("rule_type", v)}>
              <TabsList data-testid="incentive-rule-type-tabs">
                <TabsTrigger value="pct_of_sales" data-testid="incentive-rule-pct">% Penjualan</TabsTrigger>
                <TabsTrigger value="flat_per_target" data-testid="incentive-rule-flat">Flat / Target</TabsTrigger>
                <TabsTrigger value="tiered_sales" data-testid="incentive-rule-tiered">Tier</TabsTrigger>
              </TabsList>

              <TabsContent value="pct_of_sales" className="pt-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="incentive-target-amount" className="text-xs md:text-sm font-medium">Target Penjualan (Rp)</Label>
                    <Input
                      id="incentive-target-amount"
                      type="number"
                      min={0}
                      value={Number(ruleData.target_amount ?? 0)}
                      onChange={(e) => set("target_amount", Number(e.target.value || 0))}
                      data-testid="incentive-target-amount"
                    />
                  </div>
                  <div>
                    <Label htmlFor="incentive-pct" className="text-xs md:text-sm font-medium">Insentif % dari Penjualan</Label>
                    <Input
                      id="incentive-pct"
                      type="number"
                      step="0.005"
                      min={0} max={1}
                      value={Number(ruleData.incentive_pct ?? 0.01)}
                      onChange={(e) => set("incentive_pct", Number(e.target.value || 0))}
                      data-testid="incentive-pct"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                      {((Number(ruleData.incentive_pct ?? 0.01)) * 100).toFixed(2)}% dari total penjualan.
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="flat_per_target" className="pt-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="incentive-flat-target" className="text-xs md:text-sm font-medium">Target Penjualan (Rp)</Label>
                    <Input
                      id="incentive-flat-target"
                      type="number"
                      min={0}
                      value={Number(ruleData.target_amount ?? 0)}
                      onChange={(e) => set("target_amount", Number(e.target.value || 0))}
                      data-testid="incentive-flat-target"
                    />
                  </div>
                  <div>
                    <Label htmlFor="incentive-flat-amount" className="text-xs md:text-sm font-medium">Insentif Flat (Rp)</Label>
                    <Input
                      id="incentive-flat-amount"
                      type="number"
                      min={0}
                      value={Number(ruleData.flat_amount ?? 0)}
                      onChange={(e) => set("flat_amount", Number(e.target.value || 0))}
                      data-testid="incentive-flat-amount"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="tiered_sales" className="pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Tetapkan rentang penjualan dan nominal insentifnya. Pastikan tidak overlap.</p>
                  <Button size="sm" variant="ghost" onClick={addTier} data-testid="incentive-add-tier-btn">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Tambah Tier
                  </Button>
                </div>
                {tiers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Belum ada tier.</p>
                ) : (
                  <div className="space-y-2">
                    {tiers.map((t, i) => {
                      const valid = tierValid(i);
                      return (
                        <div
                          key={i}
                          className={`grid grid-cols-12 gap-2 items-center rounded-lg border px-2 py-1.5 ${valid ? "border-border/40" : "border-destructive/40 bg-destructive/5"}`}
                          data-testid={`incentive-tier-row-${i}`}
                        >
                          <Input
                            type="number"
                            className="col-span-3 h-8"
                            value={t.min_sales ?? 0}
                            onChange={(e) => {
                              const next = [...tiers];
                              next[i] = { ...t, min_sales: Number(e.target.value || 0) };
                              set("tiers", next);
                            }}
                            placeholder="Min sales"
                            aria-label={`Tier ${i + 1} — penjualan minimum`}
                          />
                          <Input
                            type="number"
                            className="col-span-3 h-8"
                            value={t.max_sales ?? 0}
                            onChange={(e) => {
                              const next = [...tiers];
                              next[i] = { ...t, max_sales: Number(e.target.value || 0) };
                              set("tiers", next);
                            }}
                            placeholder="Max sales"
                            aria-label={`Tier ${i + 1} — penjualan maksimum`}
                          />
                          <Input
                            type="number"
                            className="col-span-3 h-8"
                            value={t.incentive_amount ?? 0}
                            onChange={(e) => {
                              const next = [...tiers];
                              next[i] = { ...t, incentive_amount: Number(e.target.value || 0) };
                              set("tiers", next);
                            }}
                            placeholder="Insentif (Rp)"
                            aria-label={`Tier ${i + 1} — nominal insentif`}
                          />
                          <Input
                            className="col-span-2 h-8 text-xs"
                            value={t.notes || ""}
                            onChange={(e) => {
                              const next = [...tiers];
                              next[i] = { ...t, notes: e.target.value };
                              set("tiers", next);
                            }}
                            placeholder="Catatan"
                            aria-label={`Tier ${i + 1} — catatan`}
                          />
                          <Button
                            size="icon-sm" variant="ghost" className="col-span-1"
                            aria-label={`Hapus tier ${i + 1}`} title="Hapus tier"
                            onClick={() => set("tiers", tiers.filter((_, j) => j !== i))}
                            data-testid={`incentive-tier-remove-${i}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          {!valid && (
                            <p className="col-span-12 text-[11px] text-destructive flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Rentang tidak valid atau bentrok dengan tier lain.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <div className="glass-card p-3 space-y-2">
              <h5 className="text-sm font-semibold">Eligibility</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="incentive-min-days" className="text-xs md:text-sm font-medium">Min Hari Kerja</Label>
                  <Input
                    id="incentive-min-days"
                    type="number"
                    min={0} max={31}
                    value={Number(eligibility.min_days_worked ?? 22)}
                    onChange={(e) => setEli("min_days_worked", Number(e.target.value || 0))}
                    data-testid="incentive-min-days"
                  />
                </div>
                <div className="flex items-center gap-3 pt-5">
                  <Switch
                    id="incentive-exclude-probation"
                    checked={eligibility.exclude_probation !== false}
                    onCheckedChange={(v) => setEli("exclude_probation", v)}
                    data-testid="incentive-exclude-probation"
                  />
                  <Label htmlFor="incentive-exclude-probation" className="text-xs md:text-sm font-medium">Tidak termasuk probation</Label>
                </div>
              </div>
            </div>
          </div>
        );
      }}
      renderPreview={({ ruleData }) => {
        const rt = ruleData.rule_type || "pct_of_sales";
        if (rt === "pct_of_sales") {
          const pct = Number(ruleData.incentive_pct ?? 0.01);
          return (
            <div className="text-xs space-y-1">
              <p>Insentif <strong className="tabular-nums">{(pct * 100).toFixed(2)}%</strong> dari total penjualan periode.</p>
              <p className="text-muted-foreground">Contoh: penjualan {fmtRp(80_000_000)} → insentif <strong>{fmtRp(80_000_000 * pct)}</strong>.</p>
            </div>
          );
        }
        if (rt === "flat_per_target") {
          return (
            <div className="text-xs space-y-1">
              <p>Jika penjualan ≥ <strong className="tabular-nums">{fmtRp(ruleData.target_amount || 0)}</strong>:</p>
              <p>→ dapat <strong className="tabular-nums">{fmtRp(ruleData.flat_amount || 0)}</strong> (flat).</p>
            </div>
          );
        }
        const tiers = ruleData.tiers || [];
        return (
          <div className="text-xs space-y-1">
            <p>{tiers.length} tier dikonfigurasi.</p>
            {tiers.slice(0, 3).map((t, i) => (
              <p key={i} className="text-muted-foreground tabular-nums">
                {fmtRp(t.min_sales || 0)} – {fmtRp(t.max_sales || 0)}: {fmtRp(t.incentive_amount || 0)}
              </p>
            ))}
          </div>
        );
      }}
    />
  );
}
