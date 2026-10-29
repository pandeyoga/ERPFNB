/** TaxCenter/index.jsx — main TaxCenter orchestrator.
 *
 * Dua mode:
 *  - standalone (/finance/tax-center): PageHeader "Tax Center" + Tabs PPN/PPh.
 *  - embedded (di FinanceTaxHub, prop `section`): hanya panel pajak yang dipilih —
 *    tanpa judul & tanpa baris tab kedua (tab sudah ada di hub).
 */
import { useEffect, useState, useCallback } from "react";
import { Receipt, Calculator, AlertTriangle, Info, RefreshCw, FileDown, Users, UserCheck, Wallet } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { fmtRp } from "@/lib/format";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import LoadingState from "@/components/shared/LoadingState";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";

// ───── helpers ────────────────────────────────────────────────────────
import { TABS, PPH_LABELS, TONE_TEXT, NOTE_TONE, RateInput } from "./constants";
import PPh21Calculator from "./PPh21Calculator";
import { WithholdingCalcPreview, BracketsTable, WithholdingSummaryTable, ServiceTypeList } from "./WithholdingComponents";

/** Header kartu konfigurasi pajak: nama + dasar hukum + switch Aktif/Nonaktif. */
function TaxCardHeader({ taxId, color, enabled, saving, onToggle }) {
  const switchId = `${taxId}-toggle-switch`;
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h3 className="text-sm md:text-base font-semibold">{PPH_LABELS[taxId].full}</h3>
        <p className="text-xs md:text-sm text-muted-foreground mt-0.5">{PPH_LABELS[taxId].law}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Label htmlFor={switchId} className={cn("text-sm font-medium", enabled ? TONE_TEXT[color] : "text-muted-foreground")}>
          {enabled ? "Aktif" : "Nonaktif"}
        </Label>
        <Switch
          id={switchId}
          checked={!!enabled}
          onCheckedChange={onToggle}
          disabled={saving}
          data-testid={`${taxId}-toggle`}
        />
      </div>
    </div>
  );
}

/** Catatan info bertint (pengganti kotak bg-*-50 yang tidak ramah dark mode). */
function InfoNote({ color, title, children }) {
  return (
    <div className={cn("rounded-lg border p-3 text-sm", NOTE_TONE[color])}>
      <div className="flex items-start gap-2">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="font-medium">{title}</p>
          <div className="space-y-1 opacity-90">{children}</div>
        </div>
      </div>
    </div>
  );
}

function HistoryCard({ title, testId, year }) {
  return (
    <div data-testid={testId} className="glass-card p-4">
      <h3 className="text-sm md:text-base font-semibold mb-3">{title}</h3>
      <WithholdingSummaryTable year={year} />
    </div>
  );
}

export default function TaxCenter({ embedded = false, section }) {
  const [activeTab, setActiveTab] = useState(section || "ppn");
  const [config, setConfig] = useState(null);
  const [types, setTypes] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [localRates, setLocalRates] = useState({});
  const curYear = String(new Date().getFullYear());

  // Hub mengontrol section aktif (mode embedded)
  useEffect(() => { if (section) setActiveTab(section); }, [section]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgRes, typesRes] = await Promise.all([
        api.get("/tax/config"),
        api.get("/tax/types"),
      ]);
      const cfg = unwrap(cfgRes);
      const t = unwrap(typesRes);
      setConfig(cfg);
      setTypes(t);
      setLocalRates({
        TAX_PPN_RATE:  cfg.ppn.rate,
        TAX_PPH23_RATE: cfg.pph23.rate,
        TAX_PPH42_RATE: cfg.pph42.rate,
      });
    } catch(e) {
      toast.error("Gagal memuat konfigurasi pajak");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleEnabled(taxType, enabled) {
    const keyMap = { ppn: "TAX_PPN_ENABLED", pph21: "TAX_PPH21_ENABLED", pph23: "TAX_PPH23_ENABLED", pph42: "TAX_PPH42_ENABLED" };
    setSaving(true);
    try {
      const toggleRes = await api.put("/tax/config", { [keyMap[taxType]]: String(enabled) });
      unwrap(toggleRes);
      const label = TABS.find(t => t.id === taxType)?.label || taxType.toUpperCase();
      toast.success(`${label} ${enabled ? "diaktifkan" : "dinonaktifkan"}`);
      await load();
    } catch(e) {
      toast.error("Gagal memperbarui: " + (e.message || ""));
    } finally {
      setSaving(false);
    }
  }

  async function saveRate(keyName, value) {
    setSaving(true);
    try {
      const saveRateRes = await api.put("/tax/config", { [keyName]: String(value) }); unwrap(saveRateRes);
      toast.success(`Tarif diperbarui → ${(value*100).toFixed(1)}%`);
      await load();
    } catch(e) {
      toast.error("Gagal menyimpan tarif: " + (e.message || ""));
    } finally {
      setSaving(false);
    }
  }

  async function saveMethod(method) {
    setSaving(true);
    try {
      const saveMethodRes = await api.put("/tax/config", { TAX_PPH21_METHOD: method }); unwrap(saveMethodRes);
      toast.success(`Metode PPh 21 → ${method === "gross_up" ? "Gross-Up" : "Gross"}`);
      await load();
    } catch(e) {
      toast.error("Gagal menyimpan metode: " + (e.message || ""));
    } finally {
      setSaving(false);
    }
  }

  const header = !embedded && (
    <PageHeader
      icon={Calculator}
      title="Tax Center"
      subtitle="Konfigurasi PPN, PPh 21/23/4(2) sesuai regulasi pajak Indonesia"
      testId="tax-center-header"
    />
  );

  if (loading) return (
    <div data-testid="tax-center-page">
      {header}
      <LoadingState rows={4} />
    </div>
  );
  if (!config) return null;

  const current = section || activeTab;

  return (
    <div data-testid="tax-center-page">
      {header}

      {/* Tab pajak — hanya di mode standalone (di hub, tab ada di FinanceTaxHub) */}
      {!embedded && (
        <Tabs value={current} onValueChange={setActiveTab} className="mb-3">
          <TabsList data-testid="tax-center-tabs">
            {TABS.map(t => {
              const Icon = t.icon || Receipt;
              const enabled = config[t.id]?.enabled;
              return (
                <TabsTrigger key={t.id} value={t.id} data-testid={`tax-tab-${t.id}`} title={enabled ? "Aktif" : "Nonaktif"}>
                  <Icon />
                  {t.label}
                  <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", enabled ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                  <span className="sr-only">{enabled ? "(aktif)" : "(nonaktif)"}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      )}

      {/* PPN Panel */}
      {current === "ppn" && (
        <div data-testid="ppn-panel" className="space-y-3 lg:space-y-4">
          <div data-testid="ppn-config-card" className="glass-card p-4">
            <TaxCardHeader taxId="ppn" color="blue" enabled={config.ppn.enabled} saving={saving}
              onToggle={(v) => toggleEnabled("ppn", v)} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
              <div data-testid="ppn-rate-input">
                <RateInput
                  label="Tarif PPN" keyName="TAX_PPN_RATE"
                  value={localRates.TAX_PPN_RATE}
                  onChange={(k, v) => { setLocalRates(p => ({...p, [k]: v})); saveRate(k, v); }}
                  pctDisplay={`${(parseFloat(localRates.TAX_PPN_RATE||0.12)*100).toFixed(0)}%`}
                  disabled={!config.ppn.enabled || saving}
                  hint="Default: 0.12 (12%) sesuai Perpu 2/2024"
                />
              </div>
              <InfoNote color="blue" title="PPN 12% berlaku efektif 1 Jan 2025">
                <p>Sebelumnya 11% (UU HPP). Diubah menjadi 12% via Perpu 2/2024.</p>
                <p>Tarif ini otomatis digunakan di form Daily Sales, GR, dan Payment.</p>
              </InfoNote>
            </div>

            {!config.ppn.enabled && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>PPN dinonaktifkan. Semua transaksi baru <b>tidak</b> akan dikenakan PPN hingga diaktifkan kembali.</span>
              </div>
            )}
          </div>
          <HistoryCard title="Riwayat Withholding" year={curYear} />
        </div>
      )}

      {/* PPh 21 Panel */}
      {current === "pph21" && (
        <div data-testid="pph21-panel" className="space-y-3 lg:space-y-4">
          <div data-testid="pph21-config-card" className="glass-card p-4">
            <TaxCardHeader taxId="pph21" color="purple" enabled={config.pph21.enabled} saving={saving}
              onToggle={(v) => toggleEnabled("pph21", v)} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4 mb-4">
              <div data-testid="pph21-method-selector" className="space-y-2" role="group" aria-labelledby="pph21-method-label">
                <p id="pph21-method-label" className="text-xs md:text-sm font-medium">Metode Perhitungan</p>
                <div className="flex gap-3">
                  {[
                    { v: "gross",    label: "Gross",    desc: "Pajak ditanggung karyawan (dipotong gaji)" },
                    { v: "gross_up", label: "Gross-Up",  desc: "Pajak ditanggung perusahaan (jadi biaya)" },
                  ].map(m => (
                    <button
                      key={m.v}
                      type="button"
                      aria-pressed={config.pph21.method === m.v}
                      data-testid={`pph21-method-${m.v}`}
                      onClick={() => saveMethod(m.v)}
                      disabled={!config.pph21.enabled || saving}
                      className={cn(
                        "flex-1 rounded-md border p-3 text-sm text-left transition-colors",
                        config.pph21.method === m.v
                          ? "border-violet-500/50 bg-violet-500/10 text-violet-800 dark:text-violet-200 font-medium"
                          : "border-border hover:border-foreground/30 text-muted-foreground",
                        (!config.pph21.enabled || saving) && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className="font-semibold">{m.label}</div>
                      <div className="text-xs mt-0.5 opacity-80">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              <InfoNote color="purple" title="PPh 21 dipotong dari payroll">
                <p>Saat payroll diproses, sistem otomatis menghitung PPh 21 per karyawan berdasarkan status PTKP dan gaji pokok.</p>
                <p>JE: Dr Beban Gaji / Cr Gaji Bersih + Cr Utang PPh 21</p>
              </InfoNote>
            </div>

            <BracketsTable brackets={config.pph21.brackets} />
          </div>

          <PPh21Calculator />

          {/* e-SPT PPh21 Export (Sprint G) */}
          <PPh21SPTExport />

          <HistoryCard title="Riwayat PPh 21 (Payroll)" testId="pph21-history-card" year={curYear} />
        </div>
      )}

      {/* PPh 23 Panel */}
      {current === "pph23" && (
        <div data-testid="pph23-panel" className="space-y-3 lg:space-y-4">
          <div data-testid="pph23-config-card" className="glass-card p-4">
            <TaxCardHeader taxId="pph23" color="amber" enabled={config.pph23.enabled} saving={saving}
              onToggle={(v) => toggleEnabled("pph23", v)} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4 mb-4">
              <div data-testid="pph23-rate-input">
                <RateInput
                  label="Tarif Default PPh 23" keyName="TAX_PPH23_RATE"
                  value={localRates.TAX_PPH23_RATE}
                  onChange={(k, v) => { setLocalRates(p => ({...p, [k]: v})); saveRate(k, v); }}
                  disabled={!config.pph23.enabled || saving}
                  hint="Tarif per jenis transaksi: lihat tabel di bawah"
                />
              </div>
              <InfoNote color="amber" title="Dipotong saat bayar vendor">
                <p>Aktifkan per payment di form Pembayaran. Pilih "Jenis PPh 23" dan sistem otomatis memotong dan membuat JE ke Utang PPh 23.</p>
                <p>JE: Dr Beban / Cr Bank (net) + Cr Utang PPh 23</p>
              </InfoNote>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs md:text-sm font-medium text-muted-foreground">Jenis Transaksi &amp; Tarif</h4>
              <div data-testid="pph23-service-types">
                <ServiceTypeList types={types.pph23_service_types || []} color="amber" />
              </div>
            </div>
          </div>

          <div data-testid="pph23-calculator">
            <WithholdingCalcPreview
              taxType="pph23"
              serviceTypes={types.pph23_service_types || []}
              defaultService="jasa"
            />
          </div>

          <HistoryCard title="Riwayat PPh 23" testId="pph23-history-card" year={curYear} />
        </div>
      )}

      {/* PPh 4(2) Panel */}
      {current === "pph42" && (
        <div data-testid="pph42-panel" className="space-y-3 lg:space-y-4">
          <div data-testid="pph42-config-card" className="glass-card p-4">
            <TaxCardHeader taxId="pph42" color="rose" enabled={config.pph42.enabled} saving={saving}
              onToggle={(v) => toggleEnabled("pph42", v)} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4 mb-4">
              <div data-testid="pph42-rate-input">
                <RateInput
                  label="Tarif Default PPh 4(2)" keyName="TAX_PPH42_RATE"
                  value={localRates.TAX_PPH42_RATE}
                  onChange={(k, v) => { setLocalRates(p => ({...p, [k]: v})); saveRate(k, v); }}
                  disabled={!config.pph42.enabled || saving}
                  hint="Default: 0.10 (10%) untuk sewa bangunan"
                />
              </div>
              <InfoNote color="rose" title="Pajak final — tidak dapat dikreditkan">
                <p>PPh 4(2) adalah pajak final. Berlaku untuk sewa tanah/bangunan, jasa konstruksi, dll.</p>
                <p>JE: Dr Beban Sewa / Cr Bank (net) + Cr Utang PPh 4(2)</p>
              </InfoNote>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs md:text-sm font-medium text-muted-foreground">Jenis &amp; Tarif PPh 4(2)</h4>
              <div data-testid="pph42-service-types">
                <ServiceTypeList types={types.pph42_service_types || []} color="rose" />
              </div>
            </div>
          </div>

          <div data-testid="pph42-calculator">
            <WithholdingCalcPreview
              taxType="pph42"
              serviceTypes={types.pph42_service_types || []}
              defaultService="sewa_bangunan"
            />
          </div>

          <HistoryCard title="Riwayat PPh 4(2)" testId="pph42-history-card" year={curYear} />
        </div>
      )}
    </div>
  );
}


// ── PPh21 e-SPT Export Panel (Sprint G) ───────────────────────────────────────
function PPh21SPTExport() {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/tax/pph21/summary`, { params: { period } });
      setSummary(unwrap(r));
    } catch { } finally { setLoading(false); }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const r = await api.get(`/tax/pph21/spt-export`, {
        params: { period },
        responseType: "blob",
      });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SPT_PPh21_Masa_${period}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("Gagal mengunduh: " + (e.message || "Kesalahan tidak diketahui"));
    } finally { setDownloading(false); }
  };

  return (
    <div data-testid="pph21-spt-export" className="glass-card p-4">
      <h3 className="text-sm md:text-base font-semibold flex items-center gap-2 mb-1">
        <FileDown className="h-4 w-4 text-violet-700 dark:text-violet-300" /> Ekspor SPT Masa PPh 21
      </h3>
      <p className="text-xs md:text-sm text-muted-foreground mb-3">
        Ekspor data pemotongan PPh 21 dari payroll cycle dalam format CSV (kompatibel e-SPT DJP).
      </p>
      <div className="flex items-end gap-2 flex-wrap">
        <div className="space-y-1">
          <Label htmlFor="spt-period-input" className="text-xs md:text-sm font-medium">Periode</Label>
          <Input
            id="spt-period-input"
            data-testid="spt-period-input"
            type="month"
            value={period}
            onChange={e => { setPeriod(e.target.value); setSummary(null); }}
            className="w-44"
          />
        </div>
        <Button data-testid="spt-load-summary" variant="outline" onClick={loadSummary} disabled={loading}>
          {loading && <RefreshCw className="animate-spin" />}
          Lihat ringkasan
        </Button>
        <Button data-testid="spt-download-csv" onClick={handleDownload} disabled={downloading}>
          {downloading ? <RefreshCw className="animate-spin" /> : <FileDown />}
          Unduh CSV
        </Button>
      </div>
      {summary && (
        <div data-testid="spt-summary-stats" className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <CompactStatCard size="sm" label="Total karyawan" value={summary.total_employees} icon={Users} color="aurora-2" testId="spt-stat-employees" />
          <CompactStatCard size="sm" label="Wajib potong PPh 21" value={summary.employees_with_pph21} icon={UserCheck} color="aurora-1" testId="spt-stat-withheld" />
          <CompactStatCard size="sm" label="Total PPh 21 setor" value={fmtRp(summary.total_pph21)} icon={Wallet} color="aurora-5" testId="spt-stat-total" />
        </div>
      )}
    </div>
  );
}
