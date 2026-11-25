/** /ai/settings — Pemakaian & Pengaturan AI (izin ai.agent.admin): tombol darurat, aksi tulis, anggaran bulanan,
 * kedalaman berpikir agen, serta pemakaian & biaya per fitur / pengguna / hari. Backend: routers/ai.py. */
import { useEffect, useMemo, useState } from "react";
import { Settings2, Wallet, Cpu, Activity, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import DataTable from "@/components/shared/DataTable";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { InlineHelp } from "@/components/shared/InlineHelp";
import EmptyState from "@/components/shared/EmptyState";
import { FormActionBar } from "@/components/shared/UnsavedChanges";
import api, { unwrap, unwrapError } from "@/lib/api";
import { fmtNumber } from "@/lib/format";

export const FEATURE_LABELS = {
  agent: "Asisten AI (agen)",
  gl_categorize: "Kategori GL otomatis",
  ocr_receipt: "OCR struk / invoice",
  journal_generator: "Generator jurnal",
  exec_qa: "Executive Q&A",
  exec_qa_legacy: "Insights (lama)",
  opname_variance: "Analisis selisih opname",
  vendor_recommend: "Rekomendasi vendor",
  daily_briefing: "Daily briefing",
  seo: "SEO konten",
  admin_test: "Tes koneksi",
};

const EFFORTS = [
  { value: "low", label: "Rendah — cepat & hemat" },
  { value: "medium", label: "Sedang" },
  { value: "high", label: "Tinggi — disarankan" },
  { value: "max", label: "Maksimal — paling teliti, paling mahal" },
];

const usd = (v) => `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const thisMonth = () => new Date().toISOString().slice(0, 7);

function toForm(p) {
  return {
    enabled: !!p.enabled,
    write_actions_enabled: !!p.write_actions_enabled,
    monthly_budget_usd: p.monthly_budget_usd ?? "",
    alert_pct: p.alert_pct ?? 80,
    agent_effort: p.agent_effort || "high",
    agent_max_steps: p.agent_max_steps ?? 15,
    practice_mode: !!p.practice_mode,
    mask_pii: !!p.mask_pii,
    retention_days: p.retention_days ?? "",
  };
}

/** Ringkasan kualitas: keberhasilan run, persetujuan usulan, umpan balik pengguna, otomasi (GET /ai/quality). */
function QualityCard() {
  const [days, setDays] = useState("30");
  const [q, setQ] = useState(null);
  useEffect(() => {
    setQ(null);
    api.get("/ai/quality", { params: { days }, scope: false }).then((r) => setQ(unwrap(r))).catch(() => setQ({}));
  }, [days]);
  const pct = (v) => (v == null ? "—" : `${v}%`);
  return (
    <Card className="p-4 space-y-3" data-testid="ai-quality-card">
      <div className="flex items-center gap-2">
        <CardTitle className="text-base flex-1">Kualitas</CardTitle>
        <SimpleSelect value={days} onValueChange={setDays} ariaLabel="Rentang kualitas" className="w-36"
          options={[{ value: "7", label: "7 hari" }, { value: "30", label: "30 hari" }, { value: "90", label: "90 hari" }]} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 nested-cards">
        <CompactStatCard label="Permintaan berhasil" value={pct(q?.run?.persen_berhasil)} sub={q?.run ? `${fmtNumber(q.run.total)} permintaan · median ${q.run.median_detik ?? "—"} dtk` : "…"} />
        <CompactStatCard label="Usulan disetujui" value={pct(q?.aksi?.persen_disetujui)} sub={q?.aksi ? `${fmtNumber(q.aksi.diusulkan)} usulan · ${pct(q.aksi.persen_diedit)} diedit` : "…"} />
        <CompactStatCard label="Pengguna puas" value={pct(q?.umpan_balik?.persen_puas)} sub={q?.umpan_balik ? `👍 ${q.umpan_balik.suka} · 👎 ${q.umpan_balik.tidak_suka}` : "…"}
          tone={q?.umpan_balik?.persen_puas != null && q.umpan_balik.persen_puas < 70 ? "warning" : "default"} />
        <CompactStatCard label="Biaya rata-rata" value={q?.run?.biaya_rata2_usd != null ? usd(q.run.biaya_rata2_usd) : "—"} sub="per permintaan" />
      </div>
      <DataTable rows={q?.umpan_balik?.keluhan_terbaru || []} keyField="session_id" loading={!q} rowTestIdPrefix="ai-complaint"
        columns={[
          { key: "comment", label: "Keluhan terbaru (👎)", primary: true, render: (r) => r.comment || <span className="text-muted-foreground">tanpa catatan</span> },
          { key: "tanggal", label: "Tanggal" },
        ]}
        empty={<EmptyState icon={Activity} title="Belum ada keluhan" description="Jawaban yang ditandai 👎 akan muncul di sini untuk ditinjau." />} />
    </Card>
  );
}

export default function AISettingsPage() {
  const [policy, setPolicy] = useState(null);
  const [form, setForm] = useState(null);
  const [usage, setUsage] = useState(null);
  const [month, setMonth] = useState(thisMonth());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/ai/policy", { scope: false }).then((r) => { const p = unwrap(r); setPolicy(p); setForm(toForm(p)); });
  }, []);
  useEffect(() => {
    setUsage(null);
    api.get("/ai/usage", { params: { month }, scope: false }).then((r) => setUsage(unwrap(r))).catch(() => setUsage({}));
  }, [month]);

  const dirty = useMemo(() => policy && form && JSON.stringify(toForm(policy)) !== JSON.stringify(form), [policy, form]);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form, monthly_budget_usd: form.monthly_budget_usd === "" ? null : Number(form.monthly_budget_usd),
        retention_days: form.retention_days === "" ? null : Number(form.retention_days),
        alert_pct: Number(form.alert_pct), agent_max_steps: Number(form.agent_max_steps) };
      const p = unwrap(await api.put("/ai/policy", payload));
      setPolicy(p); setForm(toForm(p));
      toast.success("Pengaturan AI disimpan");
    } catch (e) {
      toast.error(unwrapError(e));
    } finally {
      setSaving(false);
    }
  };

  const budget = usage?.budget_usd;
  const pct = budget ? Math.round(((usage?.cost_usd || 0) / budget) * 100) : null;
  const months = useMemo(() => {
    const out = [];
    const d = new Date();
    for (let i = 0; i < 6; i += 1) {
      const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const v = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
      out.push({ value: v, label: m.toLocaleDateString("id-ID", { month: "long", year: "numeric" }) });
    }
    return out;
  }, []);

  const featureCols = [
    { key: "feature", label: "Fitur", primary: true, render: (r) => FEATURE_LABELS[r.feature] || r.feature || "—" },
    { key: "calls", label: "Panggilan", numeric: true, render: (r) => fmtNumber(r.calls) },
    { key: "input_tokens", label: "Token input", numeric: true, hideOnMobile: true, render: (r) => fmtNumber(r.input_tokens) },
    { key: "output_tokens", label: "Token output", numeric: true, hideOnMobile: true, render: (r) => fmtNumber(r.output_tokens) },
    { key: "errors", label: "Galat", numeric: true, render: (r) => fmtNumber(r.errors) },
    { key: "cost_usd", label: "Biaya", numeric: true, render: (r) => usd(r.cost_usd) },
  ];
  const userCols = [
    { key: "user_name", label: "Pengguna", primary: true },
    { key: "calls", label: "Panggilan", numeric: true, render: (r) => fmtNumber(r.calls) },
    { key: "cost_usd", label: "Biaya", numeric: true, render: (r) => usd(r.cost_usd) },
  ];

  return (
    <div className="space-y-3 md:space-y-4" data-testid="ai-settings-page">
      <PageHeader icon={Settings2} title="Pemakaian & Pengaturan AI" subtitle="Tombol darurat, aksi tulis, anggaran bulanan, dan biaya Claude"
        actions={<SimpleSelect value={month} onValueChange={setMonth} options={months} ariaLabel="Bulan pemakaian" testId="ai-usage-month" className="w-44" />} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <CompactStatCard label="Biaya bulan ini" value={usage ? usd(usage.cost_usd) : "…"} icon={Wallet}
          sub={budget ? `${pct}% dari anggaran ${usd(budget)}` : "Tanpa batas anggaran"} tone={pct >= 100 ? "danger" : pct >= (form?.alert_pct || 80) ? "warning" : "default"} />
        <CompactStatCard label="Jumlah panggilan" value={usage ? fmtNumber(usage.calls) : "…"} icon={Activity} />
        <CompactStatCard label="Token input" value={usage ? fmtNumber(usage.input_tokens) : "…"} icon={Cpu} />
        <CompactStatCard label="Token output" value={usage ? fmtNumber(usage.output_tokens) : "…"} icon={Cpu} />
      </div>

      {form && (
        <Card className="p-4 space-y-4" data-testid="ai-policy-card">
          <CardHeader className="p-0 flex-row items-center gap-1.5 space-y-0">
            <CardTitle className="text-base">Kebijakan</CardTitle>
            <InlineHelp title="Tentang biaya" content={"Model: Claude Opus 5.5 — $4 per juta token input, $20 per juta token output; token dari cache jauh lebih murah.\nPeringatan dikirim ke admin AI saat pemakaian mencapai ambang dan 100% anggaran."} />
          </CardHeader>
          <CardContent className="p-0 grid gap-4 md:grid-cols-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Label htmlFor="ai-enabled">AI aktif</Label>
                <p className="text-xs text-muted-foreground">Tombol darurat: matikan untuk menghentikan semua fitur AI.</p>
              </div>
              <Switch id="ai-enabled" checked={form.enabled} onCheckedChange={set("enabled")} data-testid="ai-policy-enabled" />
            </div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <Label htmlFor="ai-writes">Aksi tulis oleh AI</Label>
                <p className="text-xs text-muted-foreground">Buat/ubah/hapus data lewat AI (selalu menunggu persetujuan pengguna).</p>
              </div>
              <Switch id="ai-writes" checked={form.write_actions_enabled} onCheckedChange={set("write_actions_enabled")} data-testid="ai-policy-writes" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ai-budget">Anggaran bulanan (USD)</Label>
              <Input id="ai-budget" type="number" min="0" step="1" value={form.monthly_budget_usd} placeholder="Kosong = tanpa batas"
                onChange={(e) => set("monthly_budget_usd")(e.target.value)} data-testid="ai-policy-budget" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ai-alert">Peringatan pada (% anggaran)</Label>
              <Input id="ai-alert" type="number" min="10" max="100" value={form.alert_pct}
                onChange={(e) => set("alert_pct")(e.target.value)} data-testid="ai-policy-alert" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ai-effort">Kedalaman berpikir agen</Label>
              <SimpleSelect id="ai-effort" value={form.agent_effort} onValueChange={set("agent_effort")} options={EFFORTS} ariaLabel="Kedalaman berpikir agen" testId="ai-policy-effort" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ai-steps">Maks. langkah per permintaan</Label>
              <Input id="ai-steps" type="number" min="3" max="40" value={form.agent_max_steps}
                onChange={(e) => set("agent_max_steps")(e.target.value)} data-testid="ai-policy-steps" />
            </div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <Label htmlFor="ai-practice">Mode latihan untuk semua</Label>
                <p className="text-xs text-muted-foreground">Usulan yang disetujui hanya disimulasikan — cocok untuk masa pelatihan.</p>
              </div>
              <Switch id="ai-practice" checked={form.practice_mode} onCheckedChange={set("practice_mode")} data-testid="ai-policy-practice" />
            </div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <Label htmlFor="ai-mask">Samarkan data pribadi</Label>
                <p className="text-xs text-muted-foreground">Telepon, email, NIK, NPWP, rekening & alamat disamarkan sebelum dikirim ke Claude (UU PDP).</p>
              </div>
              <Switch id="ai-mask" checked={form.mask_pii} onCheckedChange={set("mask_pii")} data-testid="ai-policy-mask" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ai-retention">Simpan percakapan & file AI (hari)</Label>
              <Input id="ai-retention" type="number" min="30" max="3650" value={form.retention_days} placeholder="Kosong = simpan selamanya"
                onChange={(e) => set("retention_days")(e.target.value)} data-testid="ai-policy-retention" />
            </div>
          </CardContent>
          {!form.enabled && (
            <p className="text-xs text-amber-800 dark:text-amber-400 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Semua fitur AI akan berhenti setelah disimpan.</p>
          )}
        </Card>
      )}

      <QualityCard />

      <div className="grid gap-3 md:gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="p-4 space-y-3">
          <CardHeader className="p-0"><CardTitle className="text-base">Pemakaian per fitur</CardTitle></CardHeader>
          <DataTable columns={featureCols} rows={usage?.by_feature || []} keyField="feature" loading={!usage} rowTestIdPrefix="ai-usage-feature"
            empty={<EmptyState icon={Activity} title="Belum ada pemakaian" description="Pemakaian AI bulan ini akan muncul di sini." />} />
        </Card>
        <Card className="p-4 space-y-3">
          <CardHeader className="p-0"><CardTitle className="text-base">Pemakaian per pengguna</CardTitle></CardHeader>
          <DataTable columns={userCols} rows={usage?.by_user || []} keyField="user_id" loading={!usage} rowTestIdPrefix="ai-usage-user"
            empty={<EmptyState icon={Activity} title="Belum ada pemakaian" />} />
        </Card>
      </div>

      {form && (
        <FormActionBar dirty={!!dirty} hint="Perubahan berlaku untuk semua pengguna.">
          <Button variant="outline" onClick={() => setForm(toForm(policy))} disabled={!dirty || saving}>Batal</Button>
          <Button onClick={save} disabled={!dirty || saving} data-testid="ai-policy-save">{saving ? "Menyimpan…" : "Simpan"}</Button>
        </FormActionBar>
      )}
    </div>
  );
}
