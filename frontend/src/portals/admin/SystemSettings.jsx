/** Admin → System Settings (general): locale, timezone, regional, branding overview. */
import { useEffect, useState } from "react";
import { Settings, Save, Globe, Clock, MapPin, Palette, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/shared/PageHeader";
import LoadingState from "@/components/shared/LoadingState";
import { toast } from "sonner";

const KEYS = [
  { key: "APP_NAME", label: "Nama Aplikasi", icon: Globe, default: "FnB Group ERP" },
  { key: "APP_PRIMARY_COLOR", label: "Warna Brand (hex)", icon: Palette, placeholder: "#7C3AED", type: "color" },
  { key: "DIGEST_DEFAULT_TIME", label: "Default Digest Time (HH:MM 24h, WIB)", icon: Clock, placeholder: "06:00" },
  { key: "LOCALE", label: "Default Locale", icon: Globe, placeholder: "id-ID", default: "id-ID" },
  { key: "TIMEZONE", label: "Default Timezone", icon: Clock, placeholder: "Asia/Jakarta", default: "Asia/Jakarta" },
  { key: "FISCAL_YEAR_START_MONTH", label: "Awal Tahun Fiskal (bulan, 1-12)", icon: MapPin, placeholder: "1", default: "1" },
  { key: "DEFAULT_PPN_RATE", label: "Default PPN Rate (% — gunakan Tax Center untuk detail)", icon: MapPin, placeholder: "12", default: "12" },
];

export default function SystemSettings() {
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/system-settings/list");
      const list = unwrap(res) || [];
      const map = {};
      for (const it of list) {
        map[it.key] = it.value || "";
      }
      setValues(map);
    } catch (e) {
      toast.error("Gagal load settings");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function save(key) {
    setSaving((s) => ({ ...s, [key]: true }));
    try {
      await api.post("/system-settings/set", {
        key,
        value: values[key] ?? "",
      });
      toast.success(`Setting ${key} disimpan`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal simpan");
    } finally {
      setSaving((s) => ({ ...s, [key]: false }));
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4" data-testid="admin-settings-page">
      <PageHeader icon={Settings} title="System Settings" subtitle="Konfigurasi umum sistem (locale, timezone, default values)" />

      {/* Quick links section */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold mb-3">Konfigurasi Lainnya</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <QuickLink to="/admin/integrations" label="API Keys & Integrations" desc="Telegram, WhatsApp, Email, AI/LLM" />
          <QuickLink to="/admin/configuration" label="Business Rules" desc="Sales schemas, petty cash, incentive" />
          <QuickLink to="/admin/tax" label="Tax Configuration" desc="PPN rate, PPh withholding" />
          <QuickLink to="/admin/number-series" label="Number Series" desc="Format penomoran dokumen" />
          <QuickLink to="/admin/workflows" label="Approval Workflows" desc="Multi-tier approval" />
          <QuickLink to="/admin/operations" label="Operations & Monitoring" desc="Metrics, logs, scheduler" />
        </div>
      </div>

      {/* General settings */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Settings className="h-4 w-4" /> Pengaturan Umum
        </h3>
        {loading ? (
          <LoadingState rows={5} />
        ) : (
          <div className="space-y-4">
            {KEYS.map((cfg) => (
              <SettingRow
                key={cfg.key}
                cfg={cfg}
                value={values[cfg.key] ?? cfg.default ?? ""}
                onChange={(v) => setValues((s) => ({ ...s, [cfg.key]: v }))}
                onSave={() => save(cfg.key)}
                saving={!!saving[cfg.key]}
              />
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Pengaturan disimpan terenkripsi (untuk secret) atau plaintext (untuk non-secret) di database. Berlaku live tanpa restart.
      </p>
    </div>
  );
}

function SettingRow({ cfg, value, onChange, onSave, saving }) {
  return (
    <div className="flex items-end gap-3 flex-wrap">
      <div className="flex-1 min-w-[260px]">
        <Label className="text-xs uppercase text-muted-foreground flex items-center gap-2">
          {cfg.icon && <cfg.icon className="h-3 w-3" />} {cfg.label}
        </Label>
        {cfg.type === "color" ? (
          <div className="flex gap-2 mt-1">
            <Input type="color" value={value || "#7C3AED"} onChange={(e) => onChange(e.target.value)} className="h-10 w-20 glass-input" />
            <Input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={cfg.placeholder} className="glass-input flex-1" data-testid={`setting-input-${cfg.key}`} />
          </div>
        ) : (
          <Input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={cfg.placeholder} className="glass-input mt-1" data-testid={`setting-input-${cfg.key}`} />
        )}
      </div>
      <Button onClick={onSave} disabled={saving} className="rounded-full pill-active gap-2 h-10" data-testid={`setting-save-${cfg.key}`}>
        <Save className="h-4 w-4" /> {saving ? "..." : "Simpan"}
      </Button>
    </div>
  );
}

function QuickLink({ to, label, desc }) {
  return (
    <Link to={to} className="glass-input rounded-xl p-3 hover:shadow-md transition group">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold">{label}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
        </div>
        <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition" />
      </div>
    </Link>
  );
}
