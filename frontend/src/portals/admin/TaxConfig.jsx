/**
 * Admin > Tax/Pajak — Quick overview + link to Finance > Pajak for full config.
 * Shows live toggle statuses + rates, lets admin enable/disable each type.
 */
import { useEffect, useState, useCallback } from "react";
import { Calculator, ArrowRight, CheckCircle2, XCircle, ExternalLink, Info, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import api, { unwrap } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import LoadingState from "@/components/shared/LoadingState";
import PageHeader from "@/components/shared/PageHeader";

const TAX_TYPES = [
  {
    id: "ppn",
    enabledKey: "TAX_PPN_ENABLED",
    rateKey: "TAX_PPN_RATE",
    name: "PPN (Pajak Pertambahan Nilai)",
    law: "Perpu 2/2024 — efektif 2025",
    color: "blue",
    desc: "Dikenakan pada transaksi penjualan dan pembelian. Default 12%.",
  },
  {
    id: "pph21",
    enabledKey: "TAX_PPH21_ENABLED",
    rateKey: null,
    name: "PPh Pasal 21 (Karyawan)",
    law: "UU HPP No. 7/2021",
    color: "purple",
    desc: "Pemotongan pajak atas penghasilan karyawan (payroll). Tarif progresif.",
  },
  {
    id: "pph23",
    enabledKey: "TAX_PPH23_ENABLED",
    rateKey: "TAX_PPH23_RATE",
    name: "PPh Pasal 23 (Jasa/Royalti)",
    law: "UU PPh",
    color: "amber",
    desc: "Pemotongan pajak atas pembayaran jasa dan royalti kepada vendor.",
  },
  {
    id: "pph42",
    enabledKey: "TAX_PPH42_ENABLED",
    rateKey: "TAX_PPH42_RATE",
    name: "PPh Pasal 4 Ayat 2 (Final)",
    law: "UU PPh",
    color: "rose",
    desc: "Pajak final atas sewa tanah/bangunan, jasa konstruksi, dll.",
  },
];

const colorMap = {
  blue:   { bg: "bg-blue-50",   border: "border-blue-200",  text: "text-blue-700",   badge: "bg-blue-100 text-blue-700",   ring: "ring-blue-300",   toggle: "bg-blue-500"   },
  purple: { bg: "bg-purple-50", border: "border-purple-200",text: "text-purple-700", badge: "bg-purple-100 text-purple-700",ring: "ring-purple-300", toggle: "bg-purple-500" },
  amber:  { bg: "bg-amber-50",  border: "border-amber-200", text: "text-amber-700",  badge: "bg-amber-100 text-amber-700", ring: "ring-amber-300",  toggle: "bg-amber-500"  },
  rose:   { bg: "bg-rose-50",   border: "border-rose-200",  text: "text-rose-700",   badge: "bg-rose-100 text-rose-700",   ring: "ring-rose-300",   toggle: "bg-rose-500"   },
};

function ToggleSwitch({ checked, onChange, color = "blue", disabled }) {
  const c = colorMap[color] || colorMap.blue;
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-300 focus:outline-none",
        checked ? c.toggle : "bg-gray-200",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      data-testid={`tax-toggle-${color}`}
    >
      <span className={cn(
        "inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-all duration-300",
        checked ? "translate-x-8" : "translate-x-1"
      )} />
    </button>
  );
}

export default function TaxConfig() {
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(null); // id of saving item
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cfgRes = await api.get("/tax/config");
      setConfig(unwrap(cfgRes));
    } catch (e) {
      toast.error("Gagal memuat config pajak");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggle(taxItem, enabled) {
    setSaving(taxItem.id);
    try {
      const toggleRes = await api.put("/tax/config", { [taxItem.enabledKey]: String(enabled) });
      unwrap(toggleRes);
      toast.success(`${taxItem.name}: ${enabled ? "Diaktifkan ✓" : "Dinonaktifkan"}`);
      await load();
    } catch (e) {
      toast.error("Gagal: " + (e.message || ""));
    } finally {
      setSaving(null);
    }
  }

  if (loading) return (
    <div className="space-y-6 pb-8" data-testid="tax-config-page">
      <LoadingState rows={4} />
    </div>
  );
  if (!config) return null;

  return (
    <div className="space-y-6 pb-8" data-testid="tax-config-page">
      <PageHeader
        icon={Calculator}
        title="Tax / Pajak"
        subtitle="Toggle aktif/nonaktif setiap jenis pajak. Konfigurasi lengkap ada di Finance → Pajak."
      />

      {/* Info banner */}
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 flex items-start gap-3" data-testid="tax-config-info-banner">
        <Info size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">Sprint 1 — Compliance Indonesia 2026</p>
          <p className="text-blue-600 mt-1">
            Halaman ini menampilkan status pajak secara ringkas. Untuk konfigurasi lengkap (kalkulator, tabel tarif, riwayat withholding),
            buka <Link to="/finance/tax" className="underline font-medium">Finance → Pajak</Link>.
          </p>
        </div>
      </div>

      {/* Tax cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="tax-cards-grid">
        {TAX_TYPES.map(t => {
          const cfg = config[t.id] || {};
          const enabled = cfg.enabled ?? false;
          const rate = cfg.rate;
          const c = colorMap[t.color] || colorMap.blue;

          return (
            <div
              key={t.id}
              className={cn(
                "rounded-2xl border-2 p-5 transition-all",
                enabled ? cn(c.bg, c.border) : "bg-gray-50 border-gray-200"
              )}
              data-testid={`tax-card-${t.id}`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={cn("font-semibold text-sm", enabled ? c.text : "text-gray-600")}>{t.name}</h3>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-medium",
                      enabled ? cn(c.badge) : "bg-gray-100 text-gray-500"
                    )}>
                      {enabled ? "ON" : "OFF"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{t.law}</p>
                </div>
                <ToggleSwitch
                  checked={enabled}
                  onChange={v => toggle(t, v)}
                  color={t.color}
                  disabled={saving === t.id}
                />
              </div>

              {/* Description */}
              <p className="text-xs text-gray-500 mb-4">{t.desc}</p>

              {/* Rate + status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {rate !== undefined && (
                    <span className={cn(
                      "px-3 py-1 rounded-lg text-sm font-bold tabular-nums",
                      enabled ? cn(c.badge) : "bg-gray-100 text-gray-400"
                    )}>
                      {(rate * 100).toFixed(0)}%
                    </span>
                  )}
                  {t.id === "pph21" && (
                    <span className="text-xs text-gray-400">Progresif (5–35%)</span>
                  )}
                  {enabled ? (
                    <CheckCircle2 size={16} className={c.text} />
                  ) : (
                    <XCircle size={16} className="text-gray-300" />
                  )}
                </div>
                {saving === t.id && <RefreshCw size={14} className="animate-spin text-gray-400" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Link to full config */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5" data-testid="tax-full-config-card">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-gray-900">Konfigurasi Lengkap</h4>
            <p className="text-sm text-gray-500 mt-1">
              Kalkulator PPh 21, tabel tarif PPh 23/4(2), riwayat withholding per periode, dan export.
            </p>
          </div>
          <Link to="/finance/tax" data-testid="tax-full-config-link">
            <Button variant="outline" className="flex items-center gap-2" data-testid="tax-full-config-btn">
              Buka Finance → Pajak
              <ExternalLink size={14} />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
