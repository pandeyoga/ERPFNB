/** TaxCenter/index.jsx — main TaxCenter orchestrator. */
import { useEffect, useState, useCallback } from "react";
import { Receipt, ToggleLeft, ToggleRight, Calculator, ChevronDown, ChevronRight,
         AlertTriangle, CheckCircle2, Info, RefreshCw, TrendingDown, FileDown } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { fmtRp, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import LoadingState from "@/components/shared/LoadingState";

// ───── helpers ────────────────────────────────────────────────────────
import { TABS, PPH_LABELS, fmtRpShort, ToggleSwitch, RateInput, badgeColor, colMap } from "./constants";
import PPh21Calculator from "./PPh21Calculator";
import { WithholdingCalcPreview, BracketsTable, WithholdingSummaryTable, ServiceTypeList } from "./WithholdingComponents";

export default function TaxCenter() {
  const [activeTab, setActiveTab] = useState("ppn");
  const [config, setConfig] = useState(null);
  const [types, setTypes] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [localRates, setLocalRates] = useState({});
  const curYear = String(new Date().getFullYear());

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
      toast.success(`${taxType.toUpperCase()} ${enabled ? "diaktifkan" : "dinonaktifkan"}`);
      await load();
    } catch(e) {
      toast.error("Gagal update: " + (e.message || ""));
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
      toast.error("Gagal: " + (e.message || ""));
    } finally {
      setSaving(false);
    }
  }

  async function saveMethod(method) {
    setSaving(true);
    try {
      const saveMethodRes = await api.put("/tax/config", { TAX_PPH21_METHOD: method }); unwrap(saveMethodRes);
      toast.success(`Metode PPh 21 → ${method}`);
      await load();
    } catch(e) {
      toast.error("Gagal: " + (e.message || ""));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div data-testid="tax-center-page" className="space-y-6 pb-8">
      <LoadingState rows={4} />
    </div>
  );
  if (!config) return null;

  const activeInfo = TABS.find(t => t.id === activeTab);
  const color = activeInfo?.color || "blue";

  return (
    <div data-testid="tax-center-page" className="space-y-6 pb-8">
      {/* Header banner */}
      <div data-testid="tax-center-header" className="rounded-2xl bg-gradient-to-br from-gray-900 to-gray-700 text-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">Pusat Pajak</h2>
            <p className="text-gray-300 text-sm mt-1">Konfigurasi PPN, PPh 21/23/4(2) — Sprint 1 Compliance Indonesia 2026</p>
          </div>
          <div className="flex gap-3">
            {TABS.map(t => (
              <div key={t.id} className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                badgeColor[t.color],
                config[t.id]?.enabled
                  ? "opacity-100"
                  : "opacity-40 line-through"
              )}>
                {t.label}: {config[t.id]?.enabled ? "ON" : "OFF"}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tab nav */}
      <div data-testid="tax-center-tabs" className="flex gap-2 border-b border-gray-200 pb-0">
        {TABS.map(t => {
          const Icon = t.Icon || Receipt;
          const enabled = config[t.id]?.enabled;
          return (
            <button
              key={t.id}
              data-testid={`tax-tab-${t.id}`}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-5 py-3 text-sm font-medium rounded-t-lg transition-all border border-b-0",
                activeTab === t.id
                  ? cn(colMap[t.color], "border-current")
                  : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50"
              )}
            >
              <span className={cn(
                "w-2 h-2 rounded-full",
                enabled ? (t.color === "blue" ? "bg-blue-500" : t.color === "purple" ? "bg-purple-500" : t.color === "amber" ? "bg-amber-500" : "bg-rose-500") : "bg-gray-300"
              )} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* PPN Panel */}
      {activeTab === "ppn" && (
        <div data-testid="ppn-panel" className="space-y-6">
          <div data-testid="ppn-config-card" className="rounded-2xl border border-blue-200 bg-white p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{PPH_LABELS.ppn.full}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{PPH_LABELS.ppn.law}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn("text-sm font-medium", config.ppn.enabled ? "text-blue-700" : "text-gray-400")}>
                  {config.ppn.enabled ? "Aktif" : "Nonaktif"}
                </span>
                <ToggleSwitch
                  data-testid="ppn-toggle"
                  checked={config.ppn.enabled}
                  onChange={(v) => toggleEnabled("ppn", v)}
                  color="blue"
                  disabled={saving}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
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
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
                <div className="flex items-start gap-2">
                  <Info size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium">PPN 12% berlaku efektif 1 Jan 2025</p>
                    <p className="text-blue-600 mt-1">Sebelumnya 11% (UU HPP). Diubah menjadi 12% via Perpu 2/2024.</p>
                    <p className="text-blue-600 mt-1">Tarif ini otomatis digunakan di form Daily Sales, GR, dan Payment.</p>
                  </div>
                </div>
              </div>
            </div>

            {!config.ppn.enabled && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                <AlertTriangle size={16} />
                <span>PPN dinonaktifkan. Semua transaksi baru <b>tidak</b> akan dikenakan PPN hingga diaktifkan kembali.</span>
              </div>
            )}
          </div>
          <div className="rounded-2xl border bg-white p-6">
            <h4 className="font-semibold mb-4">Riwayat Withholding</h4>
            <WithholdingSummaryTable year={curYear} />
          </div>
        </div>
      )}

      {/* PPh 21 Panel */}
      {activeTab === "pph21" && (
        <div data-testid="pph21-panel" className="space-y-6">
          <div data-testid="pph21-config-card" className="rounded-2xl border border-purple-200 bg-white p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{PPH_LABELS.pph21.full}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{PPH_LABELS.pph21.law}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn("text-sm font-medium", config.pph21.enabled ? "text-purple-700" : "text-gray-400")}>
                  {config.pph21.enabled ? "Aktif" : "Nonaktif"}
                </span>
                <ToggleSwitch data-testid="pph21-toggle" checked={config.pph21.enabled} onChange={v => toggleEnabled("pph21", v)} color="purple" disabled={saving} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div data-testid="pph21-method-selector" className="space-y-2">
                <Label>Metode Perhitungan</Label>
                <div className="flex gap-3">
                  {[
                    { v: "gross",    label: "Gross",    desc: "Pajak ditanggung karyawan (dipotong gaji)" },
                    { v: "gross_up", label: "Gross-Up",  desc: "Pajak ditanggung perusahaan (jadi biaya)" },
                  ].map(m => (
                    <button
                      key={m.v}
                      data-testid={`pph21-method-${m.v}`}
                      onClick={() => saveMethod(m.v)}
                      disabled={!config.pph21.enabled || saving}
                      className={cn(
                        "flex-1 rounded-xl border p-3 text-sm text-left transition-all",
                        config.pph21.method === m.v
                          ? "border-purple-400 bg-purple-50 text-purple-800 font-medium"
                          : "border-gray-200 hover:border-gray-300 text-gray-600",
                        (!config.pph21.enabled || saving) && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className="font-semibold">{m.label}</div>
                      <div className="text-xs mt-0.5 opacity-70">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-purple-50 border border-purple-200 p-4">
                <div className="flex items-start gap-2">
                  <Info size={16} className="text-purple-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-purple-800">
                    <p className="font-medium">PPh 21 dipotong dari payroll</p>
                    <p className="text-purple-600 mt-1">Saat payroll diproses, sistem otomatis menghitung PPh 21 per karyawan berdasarkan status PTKP dan gaji pokok.</p>
                    <p className="text-purple-600 mt-1">JE: Dr Beban Gaji / Cr Gaji Bersih + Cr Utang PPh 21</p>
                  </div>
                </div>
              </div>
            </div>

            <BracketsTable brackets={config.pph21.brackets} />
          </div>

          <PPh21Calculator />

          {/* e-SPT PPh21 Export (Sprint G) */}
          <PPh21SPTExport />

          <div data-testid="pph21-history-card" className="rounded-2xl border bg-white p-6">
            <h4 className="font-semibold mb-4">Riwayat PPh 21 (Payroll)</h4>
            <WithholdingSummaryTable year={curYear} />
          </div>
        </div>
      )}

      {/* PPh 23 Panel */}
      {activeTab === "pph23" && (
        <div data-testid="pph23-panel" className="space-y-6">
          <div data-testid="pph23-config-card" className="rounded-2xl border border-amber-200 bg-white p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{PPH_LABELS.pph23.full}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{PPH_LABELS.pph23.law}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn("text-sm font-medium", config.pph23.enabled ? "text-amber-700" : "text-gray-400")}>
                  {config.pph23.enabled ? "Aktif" : "Nonaktif"}
                </span>
                <ToggleSwitch data-testid="pph23-toggle" checked={config.pph23.enabled} onChange={v => toggleEnabled("pph23", v)} color="amber" disabled={saving} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div data-testid="pph23-rate-input">
                <RateInput
                  label="Tarif Default PPh 23" keyName="TAX_PPH23_RATE"
                  value={localRates.TAX_PPH23_RATE}
                  onChange={(k, v) => { setLocalRates(p => ({...p, [k]: v})); saveRate(k, v); }}
                  disabled={!config.pph23.enabled || saving}
                  hint="Rate per jenis transaksi lihat tabel kanan"
                />
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
                <div className="flex items-start gap-2">
                  <Info size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Dipotong saat bayar vendor</p>
                    <p className="text-amber-700 mt-1">Aktifkan per payment di form Pembayaran. Pilih "Jenis PPh 23" dan sistem otomatis memotong dan membuat JE ke Utang PPh 23.</p>
                    <p className="text-amber-700 mt-1">JE: Dr Beban / Cr Bank (net) + Cr Utang PPh 23</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-sm text-gray-700">Jenis Transaksi &amp; Tarif</h4>
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

          <div data-testid="pph23-history-card" className="rounded-2xl border bg-white p-6">
            <h4 className="font-semibold mb-4">Riwayat PPh 23</h4>
            <WithholdingSummaryTable year={curYear} />
          </div>
        </div>
      )}

      {/* PPh 4(2) Panel */}
      {activeTab === "pph42" && (
        <div data-testid="pph42-panel" className="space-y-6">
          <div data-testid="pph42-config-card" className="rounded-2xl border border-rose-200 bg-white p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{PPH_LABELS.pph42.full}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{PPH_LABELS.pph42.law}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn("text-sm font-medium", config.pph42.enabled ? "text-rose-700" : "text-gray-400")}>
                  {config.pph42.enabled ? "Aktif" : "Nonaktif"}
                </span>
                <ToggleSwitch data-testid="pph42-toggle" checked={config.pph42.enabled} onChange={v => toggleEnabled("pph42", v)} color="rose" disabled={saving} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div data-testid="pph42-rate-input">
                <RateInput
                  label="Tarif Default PPh 4(2)" keyName="TAX_PPH42_RATE"
                  value={localRates.TAX_PPH42_RATE}
                  onChange={(k, v) => { setLocalRates(p => ({...p, [k]: v})); saveRate(k, v); }}
                  disabled={!config.pph42.enabled || saving}
                  hint="Default: 0.10 (10%) untuk sewa bangunan"
                />
              </div>
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800">
                <div className="flex items-start gap-2">
                  <Info size={16} className="text-rose-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Pajak final — tidak dapat dikreditkan</p>
                    <p className="text-rose-700 mt-1">PPh 4(2) adalah pajak final. Berlaku untuk sewa tanah/bangunan, jasa konstruksi, dll.</p>
                    <p className="text-rose-700 mt-1">JE: Dr Beban Sewa / Cr Bank (net) + Cr Utang PPh 4(2)</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-sm text-gray-700">Jenis &amp; Tarif PPh 4(2)</h4>
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

          <div data-testid="pph42-history-card" className="rounded-2xl border bg-white p-6">
            <h4 className="font-semibold mb-4">Riwayat PPh 4(2)</h4>
            <WithholdingSummaryTable year={curYear} />
          </div>
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
      alert("Gagal mengunduh: " + (e.message || "Unknown error"));
    } finally { setDownloading(false); }
  };

  return (
    <div data-testid="pph21-spt-export" className="rounded-2xl border border-purple-100 bg-purple-50 p-5">
      <div className="flex items-center gap-2 mb-3">
        <FileDown size={18} className="text-purple-600" />
        <h4 className="font-semibold text-purple-900">Export SPT Masa PPh 21</h4>
      </div>
      <p className="text-sm text-purple-700 mb-4">
        Export data pemotongan PPh 21 dari payroll cycle dalam format CSV (kompatibel e-SPT DJP).
      </p>
      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1">
          <label className="text-xs text-purple-700 font-medium">Periode</label>
          <input
            data-testid="spt-period-input"
            type="month"
            value={period}
            onChange={e => { setPeriod(e.target.value); setSummary(null); }}
            className="rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>
        <Button data-testid="spt-load-summary" variant="outline" size="sm" onClick={loadSummary} disabled={loading} className="border-purple-300">
          {loading ? <RefreshCw size={14} className="animate-spin mr-1" /> : null}
          Lihat Summary
        </Button>
        <Button data-testid="spt-download-csv" size="sm" onClick={handleDownload} disabled={downloading}
                className="bg-purple-600 hover:bg-purple-700 text-white">
          {downloading ? <RefreshCw size={14} className="animate-spin mr-1" /> : <FileDown size={14} className="mr-1" />}
          Download CSV
        </Button>
      </div>
      {summary && (
        <div data-testid="spt-summary-stats" className="mt-4 grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-purple-700">{summary.total_employees}</div>
            <div className="text-xs text-gray-500 mt-0.5">Total Karyawan</div>
          </div>
          <div className="bg-white rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-purple-700">{summary.employees_with_pph21}</div>
            <div className="text-xs text-gray-500 mt-0.5">Wajib Potong PPh 21</div>
          </div>
          <div className="bg-white rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-purple-700">{fmtRp(summary.total_pph21)}</div>
            <div className="text-xs text-gray-500 mt-0.5">Total PPh 21 Setor</div>
          </div>
        </div>
      )}
    </div>
  );
}
