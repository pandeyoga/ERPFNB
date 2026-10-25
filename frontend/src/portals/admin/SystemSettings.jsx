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
  { key: "DIGEST_DEFAULT_TIME", label: "Jam Kirim Digest Default (HH:MM 24 jam, WIB)", icon: Clock, placeholder: "06:00" },
  { key: "LOCALE", label: "Locale Default", icon: Globe, placeholder: "id-ID", default: "id-ID" },
  { key: "TIMEZONE", label: "Zona Waktu Default", icon: Clock, placeholder: "Asia/Jakarta", default: "Asia/Jakarta" },
  { key: "FISCAL_YEAR_START_MONTH", label: "Awal Tahun Fiskal (bulan, 1-12)", icon: MapPin, placeholder: "1", default: "1" },
];

// Tautan ke halaman konfigurasi lain — memakai rute kanonik (hub) sesuai menu sidebar
const QUICK_LINKS = [
  { to: "/admin/integrations", label: "Integrations", desc: "Telegram, WhatsApp, Email, AI/LLM" },
  { to: "/admin/configuration", label: "Business Rules", desc: "Sales schema, kas kecil, insentif" },
  { to: "/admin/approvals", label: "Approval Matrix", desc: "Approval bertingkat per entitas" },
  { to: "/admin/setup?tab=number-series", label: "Number Series", desc: "Format penomoran dokumen" },
  { to: "/admin/setup?tab=tax-config", label: "Tax Config", desc: "Tarif PPN, PPh withholding" },
  { to: "/admin/operations", label: "Monitoring", desc: "Metrics, logs, scheduler" },
];

export default function SystemSettings() {
  const [values, setValues] = useState({});
  const [saved, setSaved] = useState({});
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
      setSaved(map);
    } catch (e) {
      toast.error("Gagal memuat pengaturan");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function save(cfg) {
    const key = cfg.key;
    setSaving((s) => ({ ...s, [key]: true }));
    try {
      await api.post("/system-settings/set", {
        key,
        value: values[key] ?? "",
      });
      toast.success(`${cfg.label} disimpan`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal simpan");
    } finally {
      setSaving((s) => ({ ...s, [key]: false }));
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-3 lg:space-y-4" data-testid="admin-settings-page">
      <PageHeader icon={Settings} title="System Settings" subtitle="Konfigurasi umum sistem (nama aplikasi, locale, zona waktu, nilai default)." />

      {/* General settings */}
      <section className="glass-card p-4" aria-labelledby="settings-general-title">
        <h2 id="settings-general-title" className="text-base md:text-lg font-semibold mb-1 flex items-center gap-2">
          <Settings className="h-4 w-4" /> Pengaturan Umum
        </h2>
        <p className="text-xs text-muted-foreground mb-3">
          Disimpan per baris dan berlaku langsung tanpa restart. Tombol Simpan aktif bila nilai diubah atau belum pernah disimpan.
        </p>
        {loading ? (
          <LoadingState rows={5} />
        ) : (
          <div className="space-y-3">
            {KEYS.map((cfg) => {
              const current = values[cfg.key] ?? cfg.default ?? "";
              const original = saved[cfg.key] ?? cfg.default ?? "";
              return (
                <SettingRow
                  key={cfg.key}
                  cfg={cfg}
                  value={current}
                  dirty={current !== original || !(cfg.key in saved)}
                  onChange={(v) => setValues((s) => ({ ...s, [cfg.key]: v }))}
                  onSave={() => save(cfg)}
                  saving={!!saving[cfg.key]}
                />
              );
            })}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground mt-3">
          Pengaturan disimpan terenkripsi (untuk secret) atau plaintext (untuk non-secret) di database.
        </p>
      </section>

      {/* Quick links section */}
      <section className="glass-card p-4" aria-labelledby="settings-links-title">
        <h2 id="settings-links-title" className="text-base md:text-lg font-semibold mb-3">Konfigurasi Lainnya</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {QUICK_LINKS.map((l) => <QuickLink key={l.to} {...l} />)}
        </div>
      </section>
    </div>
  );
}

function SettingRow({ cfg, value, dirty, onChange, onSave, saving }) {
  const id = `setting-input-${cfg.key}`;
  return (
    <div className="flex items-end gap-2 flex-wrap">
      <div className="flex-1 min-w-[260px] space-y-1.5">
        <Label htmlFor={id} className="text-xs md:text-sm font-medium flex items-center gap-1.5">
          {cfg.icon && <cfg.icon className="h-3.5 w-3.5 text-muted-foreground" />} {cfg.label}
        </Label>
        {cfg.type === "color" ? (
          <div className="flex gap-2">
            <Input type="color" value={value || "#7C3AED"} onChange={(e) => onChange(e.target.value)}
                   aria-label={`${cfg.label} — pemilih warna`} className="w-16 p-1 glass-input" />
            <Input id={id} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={cfg.placeholder} className="glass-input flex-1" data-testid={`setting-input-${cfg.key}`} />
          </div>
        ) : (
          <Input id={id} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={cfg.placeholder} className="glass-input" data-testid={`setting-input-${cfg.key}`} />
        )}
      </div>
      <Button
        variant={dirty ? "default" : "outline"}
        onClick={onSave}
        disabled={saving || !dirty}
        aria-label={`Simpan ${cfg.label}`}
        data-testid={`setting-save-${cfg.key}`}
      >
        <Save /> {saving ? "Menyimpan…" : "Simpan"}
      </Button>
    </div>
  );
}

function QuickLink({ to, label, desc }) {
  return (
    <Link to={to} className="glass-input rounded-[calc(var(--radius)-2px)] p-3 hover:shadow-md transition group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{label}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  );
}
