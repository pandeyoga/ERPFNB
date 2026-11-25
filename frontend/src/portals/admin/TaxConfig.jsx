/**
 * Admin > Tax/Pajak — Quick overview + link to Finance > Pajak for full config.
 * Shows live toggle statuses + rates, lets admin enable/disable each type.
 */
import { useEffect, useState, useCallback } from "react";
import { Calculator, CheckCircle2, XCircle, ExternalLink, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import api, { unwrap } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import LoadingState from "@/components/shared/LoadingState";
import PageHeader from "@/components/shared/PageHeader";
import StatusPill from "@/components/shared/StatusPill";

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

// Aksen per jenis pajak (hanya untuk teks/ikon saat aktif — kartu memakai permukaan glass-card standar)
const ACCENT = {
  blue:   "text-blue-700 dark:text-blue-300",
  purple: "text-purple-700 dark:text-purple-300",
  amber:  "text-amber-700 dark:text-amber-300",
  rose:   "text-rose-700 dark:text-rose-300",
};

export default function TaxConfig({ embedded = false } = {}) {
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(null); // id of saving item
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cfgRes = await api.get("/tax/config");
      setConfig(unwrap(cfgRes));
    } catch (e) {
      toast.error("Gagal memuat konfigurasi pajak");
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
      toast.success(`${taxItem.name}: ${enabled ? "diaktifkan" : "dinonaktifkan"}`);
      await load();
    } catch (e) {
      toast.error("Gagal: " + (e.message || ""));
    } finally {
      setSaving(null);
    }
  }

  const fullConfigLink = (
    <div data-testid="tax-full-config-card">
      <Link to="/finance/tax" tabIndex={-1} data-testid="tax-full-config-link">
        <Button variant="outline" data-testid="tax-full-config-btn">
          Buka Finance → Pajak
          <ExternalLink />
        </Button>
      </Link>
    </div>
  );

  const header = (
    <PageHeader
      icon={Calculator}
      title="Tax Config"
      subtitle="Aktif/nonaktifkan setiap jenis pajak. Kalkulator PPh 21, tarif, riwayat & ekspor ada di Finance → Pajak."
      actions={fullConfigLink}
    />
  );

  if (loading) return (
    <div className="space-y-3" data-testid="tax-config-page">
      {header}
      <LoadingState rows={4} />
    </div>
  );
  if (!config) return null;

  return (
    <div className="space-y-3" data-testid="tax-config-page">
      {header}


      {/* Tax cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="tax-cards-grid">
        {TAX_TYPES.map(t => {
          const cfg = config[t.id] || {};
          const enabled = cfg.enabled ?? false;
          const rate = cfg.rate;
          const accent = ACCENT[t.color] || ACCENT.blue;
          const switchId = `tax-switch-${t.id}`;

          return (
            <div
              key={t.id}
              className={cn("glass-card p-4 transition-colors", enabled && "ring-1 ring-primary/20")}
              data-testid={`tax-card-${t.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={cn("text-sm md:text-base font-semibold", enabled ? accent : "text-muted-foreground")}>
                      <label htmlFor={switchId} className="cursor-pointer">{t.name}</label>
                    </h3>
                    <StatusPill status={enabled ? "active" : "inactive"} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.law}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {saving === t.id && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  <Switch
                    id={switchId}
                    checked={enabled}
                    onCheckedChange={v => toggle(t, v)}
                    disabled={saving === t.id}
                    aria-label={`${enabled ? "Nonaktifkan" : "Aktifkan"} ${t.name}`}
                    data-testid={`tax-toggle-${t.color}`}
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-2">{t.desc}</p>

              <div className="flex items-center gap-2 mt-3">
                {rate !== undefined && (
                  <span className={cn(
                    "px-2 py-0.5 rounded-md text-sm font-semibold tabular-nums",
                    enabled ? cn("bg-foreground/[0.06]", accent) : "bg-foreground/[0.04] text-muted-foreground"
                  )}>
                    Tarif {(rate * 100).toFixed(0)}%
                  </span>
                )}
                {t.id === "pph21" && (
                  <span className="text-xs text-muted-foreground">Progresif (5–35%)</span>
                )}
                {enabled ? (
                  <CheckCircle2 className={cn("h-4 w-4", accent)} aria-hidden />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground/50" aria-hidden />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
