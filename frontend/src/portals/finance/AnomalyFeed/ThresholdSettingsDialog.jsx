/** ThresholdSettingsDialog.jsx — Admin UI untuk mengelola threshold anomaly detector.
 * Menampilkan 4 detector (Sales Deviation, Vendor Price, Vendor Leadtime, AP Spike)
 * per scope: Group (global), Brand, Outlet
 * Menyimpan override ke business_rules collection via /api/anomalies/thresholds
 */
import { useEffect, useState, useCallback } from "react";
import { Settings, Save, RotateCcw, ChevronRight, Info } from "lucide-react";
import { toast } from "sonner";

import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

// ── Default thresholds (mirrors backend helpers.py DEFAULT_THRESHOLDS) ────────
const DEFAULTS = {
  sales_deviation: { enabled: true, sigma_mild: 1.5, sigma_severe: 2.5, window_days: 14, min_points: 7 },
  vendor_price_spike: { enabled: true, pct_mild: 15, pct_severe: 30, window_days: 90 },
  vendor_leadtime: { enabled: true, days_mild: 3, days_severe: 7, window_days: 90 },
  ap_cash_spike: { enabled: true, pct_mild: 15, pct_severe: 30 },
};

const DETECTOR_META = [
  {
    key: "sales_deviation",
    label: "Deviasi Penjualan Harian",
    desc: "Deteksi penjualan harian yang menyimpang secara statistik dari baseline rolling window.",
    fields: [
      { key: "sigma_mild", label: "Sigma Mild", type: "number", min: 0.5, step: 0.1,
        hint: "Z-score minimum untuk kategori Mild (default 1.5)" },
      { key: "sigma_severe", label: "Sigma Severe", type: "number", min: 1.0, step: 0.1,
        hint: "Z-score minimum untuk kategori Severe (default 2.5)" },
      { key: "window_days", label: "Window Hari", type: "integer", min: 7, step: 1,
        hint: "Jumlah hari historis untuk baseline (default 14)" },
      { key: "min_points", label: "Min Data Points", type: "integer", min: 3, step: 1,
        hint: "Jumlah minimum data historis agar deteksi aktif (default 7)" },
    ],
  },
  {
    key: "vendor_price_spike",
    label: "Lonjakan Harga Vendor",
    desc: "Deteksi kenaikan harga item dari vendor dibandingkan historis.",
    fields: [
      { key: "pct_mild", label: "% Mild", type: "number", min: 5, step: 1,
        hint: "Persentase kenaikan minimum untuk Mild (default 15%)" },
      { key: "pct_severe", label: "% Severe", type: "number", min: 10, step: 1,
        hint: "Persentase kenaikan minimum untuk Severe (default 30%)" },
      { key: "window_days", label: "Window Hari", type: "integer", min: 30, step: 1,
        hint: "Jumlah hari historis untuk baseline harga (default 90)" },
    ],
  },
  {
    key: "vendor_leadtime",
    label: "Lead Time Vendor Memburuk",
    desc: "Deteksi vendor yang pengirimannya lebih lambat dari biasanya.",
    fields: [
      { key: "days_mild", label: "Hari Keterlambatan Mild", type: "integer", min: 1, step: 1,
        hint: "Kelebihan hari minimum untuk Mild (default 3)" },
      { key: "days_severe", label: "Hari Keterlambatan Severe", type: "integer", min: 3, step: 1,
        hint: "Kelebihan hari minimum untuk Severe (default 7)" },
      { key: "window_days", label: "Window Hari", type: "integer", min: 30, step: 1,
        hint: "Jumlah hari historis untuk baseline lead time (default 90)" },
    ],
  },
  {
    key: "ap_cash_spike",
    label: "Lonjakan Pengeluaran Kas/AP",
    desc: "Deteksi lonjakan nilai AP atau pengeluaran kas dibanding bulan sebelumnya.",
    fields: [
      { key: "pct_mild", label: "% Mild", type: "number", min: 5, step: 1,
        hint: "Persentase kenaikan minimum untuk Mild (default 15%)" },
      { key: "pct_severe", label: "% Severe", type: "number", min: 10, step: 1,
        hint: "Persentase kenaikan minimum untuk Severe (default 30%)" },
    ],
  },
];

const SCOPE_TABS = [
  { key: "group", label: "Group (Global)", desc: "Berlaku untuk semua outlet kecuali ada override lebih spesifik." },
  { key: "brand", label: "Per Brand", desc: "Override khusus untuk satu brand." },
  { key: "outlet", label: "Per Outlet", desc: "Override khusus untuk satu outlet." },
];

export function ThresholdSettingsDialog({ onClose }) {
  const [activeScope, setActiveScope] = useState("group");
  const [rules, setRules] = useState([]); // all anomaly_threshold_policy rules
  const [outlets, setOutlets] = useState([]);
  const [brands, setBrands] = useState([]);
  const [selectedScopeId, setSelectedScopeId] = useState("*");
  const [draftData, setDraftData] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load existing rules + master data
  useEffect(() => {
    api.get("/anomalies/thresholds").then(r => setRules(unwrap(r) || [])).catch(() => {});
    api.get("/master/outlets?page=1&per_page=50").then(r => setOutlets(unwrap(r) || [])).catch(() => {});
    api.get("/master/brands?page=1&per_page=50").then(r => setBrands(unwrap(r) || [])).catch(() => {});
  }, []);

  // Sync selectedScopeId when scope changes
  useEffect(() => {
    setSelectedScopeId(activeScope === "group" ? "*" : "");
    setDraftData({});
  }, [activeScope]);

  // Find existing rule for current scope
  const existingRule = rules.find(r =>
    r.scope_type === activeScope &&
    (activeScope === "group" ? r.scope_id === "*" : r.scope_id === selectedScopeId) &&
    r.active
  );

  // Compute effective draft (existing rule data merged over defaults)
  const effectiveData = useCallback(() => {
    const base = existingRule?.rule_data || {};
    const merged = {};
    for (const det of DETECTOR_META) {
      merged[det.key] = {
        ...DEFAULTS[det.key],
        ...(base[det.key] || {}),
        ...(draftData[det.key] || {}),
      };
    }
    return merged;
  }, [existingRule, draftData]);

  function handleFieldChange(detKey, fieldKey, rawValue) {
    const field = DETECTOR_META.find(d => d.key === detKey)?.fields.find(f => f.key === fieldKey);
    const parsed = field?.type === "integer" ? parseInt(rawValue, 10) : parseFloat(rawValue);
    const val = isNaN(parsed) ? rawValue : parsed;
    setDraftData(prev => ({
      ...prev,
      [detKey]: { ...(prev[detKey] || {}), [fieldKey]: val },
    }));
  }

  function handleToggle(detKey, enabled) {
    setDraftData(prev => ({
      ...prev,
      [detKey]: { ...(prev[detKey] || {}), enabled },
    }));
  }

  async function handleSave() {
    if (activeScope !== "group" && !selectedScopeId) {
      toast.error("Pilih brand/outlet terlebih dahulu");
      return;
    }
    const data = effectiveData();
    // Remove _rule_* meta keys
    const cleanData = {};
    for (const det of DETECTOR_META) {
      cleanData[det.key] = { ...data[det.key] };
    }
    setSaving(true);
    try {
      const res = await api.post("/anomalies/thresholds", {
        scope_type: activeScope,
        scope_id: selectedScopeId || "*",
        rule_data: cleanData,
      });
      const rule = unwrap(res);
      toast.success("Threshold override disimpan");
      setRules(prev => {
        const idx = prev.findIndex(r => r.id === rule.id);
        if (idx >= 0) { const n = [...prev]; n[idx] = rule; return n; }
        return [...prev, rule];
      });
      setDraftData({});
    } catch (e) {
      toast.error(e?.response?.data?.errors?.[0]?.message || "Gagal menyimpan threshold");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!existingRule) { toast.info("Tidak ada override — sudah menggunakan default"); return; }
    setDeleting(true);
    try {
      await api.delete(`/anomalies/thresholds/${existingRule.id}`);
      toast.success("Override dihapus — kembali ke default");
      setRules(prev => prev.filter(r => r.id !== existingRule.id));
      setDraftData({});
    } catch (e) {
      toast.error("Gagal menghapus override");
    } finally {
      setDeleting(false);
    }
  }

  const scopeOptions = activeScope === "brand" ? brands : outlets;
  const hasOverride = !!existingRule;
  const hasDraft = Object.keys(draftData).length > 0;
  const current = effectiveData();

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="threshold-settings-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Pengaturan Threshold Anomaly Detector
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Scope Tabs */}
          <div className="flex gap-1 border-b border-border/40 pb-1" role="tablist" data-testid="threshold-scope-tabs">
            {SCOPE_TABS.map(t => (
              <button key={t.key} role="tab" aria-selected={activeScope === t.key}
                data-testid={`threshold-tab-${t.key}`}
                className={`px-4 py-2 text-sm rounded-t-lg transition ${
                  activeScope === t.key ? "bg-foreground text-background" : "hover:bg-foreground/10"
                }`}
                onClick={() => setActiveScope(t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Scope description + selector */}
          <div className="text-xs text-muted-foreground">
            {SCOPE_TABS.find(t => t.key === activeScope)?.desc}
          </div>

          {activeScope !== "group" && (
            <div className="space-y-1.5">
              <Label className="text-xs">{activeScope === "brand" ? "Pilih Brand" : "Pilih Outlet"}</Label>
              <SimpleSelect
                value={selectedScopeId}
                onValueChange={v => { setSelectedScopeId(v); setDraftData({}); }}
                options={[{ value: "", label: `— Pilih ${activeScope === "brand" ? "brand" : "outlet"} —` }, ...scopeOptions.map(o => ({ value: o.id, label: o.name }))]}
                placeholder={`— Pilih ${activeScope === "brand" ? "brand" : "outlet"} —`}
                className="glass-input rounded-lg w-full px-3 h-9 text-sm"
                testId="threshold-scope-selector"
              />
            </div>
          )}

          {/* Override status indicator */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
            hasOverride ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-muted/40 text-muted-foreground"
          }`} data-testid="threshold-override-status">
            {hasOverride ? (
              <><span className="font-semibold">Override aktif</span>
              <span>— v{existingRule.version} · diubah terakhir: {new Date(existingRule.updated_at).toLocaleDateString("id-ID")}</span></>
            ) : (
              <span>Menggunakan nilai default — belum ada override untuk scope ini</span>
            )}
          </div>

          {/* Detector cards */}
          {((activeScope === "group") || selectedScopeId) && DETECTOR_META.map(det => (
            <DetectorCard
              key={det.key}
              meta={det}
              values={current[det.key] || DEFAULTS[det.key]}
              defaults={DEFAULTS[det.key]}
              hasOverride={!!(existingRule?.rule_data?.[det.key] || draftData[det.key])}
              onFieldChange={(fk, v) => handleFieldChange(det.key, fk, v)}
              onToggle={(v) => handleToggle(det.key, v)}
            />
          ))}

          {/* Actions */}
          <div className="flex justify-between pt-2 border-t border-border/40">
            <Button variant="outline" onClick={handleReset} disabled={!hasOverride || deleting}
              className="gap-2 text-red-600 hover:text-red-700"
              data-testid="threshold-reset-btn">
              <RotateCcw className="h-4 w-4" />
              {deleting ? "Menghapus..." : "Reset ke Default"}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} data-testid="threshold-close-btn">Tutup</Button>
              <Button onClick={handleSave} disabled={saving || (!hasDraft && hasOverride)}
                className="gap-2" data-testid="threshold-save-btn">
                <Save className="h-4 w-4" />
                {saving ? "Menyimpan..." : "Simpan Override"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Detector Card ─────────────────────────────────────────────────────────────
function DetectorCard({ meta, values, defaults, hasOverride, onFieldChange, onToggle }) {
  const [expanded, setExpanded] = useState(true);
  const enabled = values.enabled !== false;

  return (
    <div className={`border rounded-lg overflow-hidden ${hasOverride ? "border-amber-400/40" : "border-border/40"}`}
      data-testid={`detector-card-${meta.key}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-muted/20 cursor-pointer"
        onClick={() => setExpanded(e => !e)}>
        <input type="checkbox" checked={enabled}
          onChange={e => { e.stopPropagation(); onToggle(e.target.checked); }}
          className="h-4 w-4 accent-primary"
          data-testid={`detector-toggle-${meta.key}`} />
        <div className="flex-1">
          <div className="font-semibold text-sm flex items-center gap-2">
            {meta.label}
            {hasOverride && (
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-700 dark:text-amber-400">
                OVERRIDE
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{meta.desc}</div>
        </div>
        <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`} />
      </div>

      {/* Fields */}
      {expanded && (
        <div className="p-4 grid grid-cols-2 gap-4">
          {meta.fields.map(field => {
            const isDirty = values[field.key] !== defaults[field.key];
            return (
              <div key={field.key} className="space-y-1">
                <div className="flex items-center gap-1">
                  <Label className="text-xs">{field.label}</Label>
                  {isDirty && (
                    <span className="text-[9px] text-amber-600 px-1 rounded bg-amber-500/10">modified</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number" step={field.step} min={field.min}
                    value={values[field.key] ?? defaults[field.key]}
                    onChange={e => onFieldChange(field.key, e.target.value)}
                    className="glass-input h-8 text-sm"
                    data-testid={`threshold-field-${meta.key}-${field.key}`}
                    disabled={!enabled}
                  />
                  {isDirty && (
                    <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                      default: {defaults[field.key]}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">{field.hint}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
