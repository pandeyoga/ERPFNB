/** /ai/import — Impor Cerdas: unggah file mentah (ekspor POS, GoFood/GrabFood, rekap Excel, mutasi bank) → AI
 * memetakan kolom & nilai, membersihkan format, memeriksa duplikasi per toko/hari → pratinjau → impor ke Daily Sales
 * DRAF (atau sesi rekonsiliasi bank) → bisa dibatalkan. Backend: /api/imports (services/smart_import).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FileUp, Upload, Undo2, Bot, ArrowLeft, AlertTriangle, Info, CircleX, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import PageHeader from "@/components/shared/PageHeader";
import KeyFacts from "@/components/shared/KeyFacts";
import DataTable from "@/components/shared/DataTable";
import StatusPill from "@/components/shared/StatusPill";
import SegmentedFilter from "@/components/shared/SegmentedFilter";
import SimpleSelect from "@/components/shared/SimpleSelect";
import CompactStatCard from "@/components/shared/CompactStatCard";
import EmptyState from "@/components/shared/EmptyState";
import FileDropZone from "@/components/shared/FileDropZone";
import { confirmDialog } from "@/components/shared/confirmDialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useScope } from "@/contexts/ScopeContext";
import api, { unwrap, unwrapError } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const rp = (v) => (v == null ? "—" : `Rp ${Number(v).toLocaleString("id-ID", { maximumFractionDigits: 0 })}`);
const ACCEPT = ".csv,.txt,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const TARGETS = [{ value: "auto", label: "Deteksi otomatis" }, { value: "sales", label: "Penjualan" }, { value: "bank", label: "Mutasi bank" }];
const DAY_ACTIONS = [
  { value: "create", label: "Buat baru" }, { value: "replace", label: "Ganti" },
  { value: "merge", label: "Gabung" }, { value: "skip", label: "Lewati" },
];
const BY_LABEL = { kamus: "Kamus", ai: "AI", resep: "Resep", pengguna: "Anda" };
const LEVEL_ICON = { error: CircleX, warning: AlertTriangle, info: Info };
const LEVEL_CLS = {
  error: "text-rose-700 dark:text-rose-400", warning: "text-amber-800 dark:text-amber-400", info: "text-muted-foreground",
};

function openAI(prompt) {
  window.dispatchEvent(new CustomEvent("aurora-open-ai", { detail: { prompt } }));
}

function UploadStart({ onCreated }) {
  const scope = useScope();
  const [target, setTarget] = useState("auto");
  const [busy, setBusy] = useState(false);
  const create = async (att) => {
    if (!att?.id) return;
    setBusy(true);
    try {
      const options = scope.outlet ? { outlet_id: scope.outlet.id } : undefined;
      const b = unwrap(await api.post("/imports", { attachment_id: att.id, target: target === "auto" ? null : target, options }, { timeout: 120000 }));
      onCreated(b.id);
    } catch (e) {
      toast.error(unwrapError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="p-4 space-y-3" data-testid="import-upload-card">
      <CardHeader className="p-0 flex-row items-center justify-between space-y-0 gap-2">
        <CardTitle className="text-base">Unggah file</CardTitle>
        <SegmentedFilter value={target} onChange={setTarget} options={TARGETS} ariaLabel="Jenis data" testId="import-target" />
      </CardHeader>
      <CardContent className="p-0 space-y-2">
        <FileDropZone category="import" accept={ACCEPT} maxSizeMB={25} onUploaded={create} testId="import-dropzone"
          label={busy ? "Membaca & memetakan file…" : "Tarik file ke sini atau klik untuk memilih"}
          description="CSV / Excel / TXT dari POS (Moka, Majoo, ESB, dll.), GoFood, GrabFood, ShopeeFood, rekap Excel buatan sendiri, atau mutasi bank (KlikBCA, Mandiri, BRI, BNI…)." />
        <p className="text-xs text-muted-foreground">
          Belum ada data yang disimpan sampai Anda menekan <strong>Impor</strong>. Foto/PDF struk: kirim ke Asisten AI (OCR).
        </p>
      </CardContent>
    </Card>
  );
}

function History({ onOpen, refreshKey }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    api.get("/imports", { scope: false }).then((r) => setRows(unwrap(r) || [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, [refreshKey]);
  const cols = [
    { key: "created_at", label: "Diunggah", render: (r) => fmtDateTime(r.created_at) },
    { key: "filename", label: "File", primary: true, render: (r) => <span className="font-medium">{r.filename}</span> },
    { key: "source", label: "Sumber", render: (r) => r.source || "—" },
    { key: "target", label: "Jenis", render: (r) => (r.target === "bank" ? "Mutasi bank" : "Penjualan") },
    { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
    { key: "result", label: "Hasil", hideOnMobile: true, render: (r) => (r.result
      ? (r.target === "bank" ? `${r.result.rows} baris` : `${r.result.transactions} transaksi · ${(r.result.days || []).length} hari`) : "—") },
  ];
  return (
    <Card className="p-4 space-y-3">
      <CardHeader className="p-0"><CardTitle className="text-base">Riwayat impor</CardTitle></CardHeader>
      <DataTable columns={cols} rows={rows} loading={loading} onRowClick={(r) => onOpen(r.id)} rowTestIdPrefix="import-batch"
        empty={<EmptyState icon={FileUp} title="Belum ada impor" description="File yang Anda unggah akan muncul di sini." />} />
    </Card>
  );
}

function Issues({ issues }) {
  if (!issues?.length) return <EmptyState icon={Info} title="Tidak ada masalah" description="Semua baris terbaca dan terpetakan." />;
  return (
    <ul className="space-y-1.5" data-testid="import-issues">
      {issues.map((i, k) => {
        const Icon = LEVEL_ICON[i.level] || Info;
        return (
          <li key={k} className={cn("flex items-start gap-2 text-sm", LEVEL_CLS[i.level])}>
            <Icon className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{i.row ? `Baris ${i.row}: ` : ""}{i.pesan}</span>
          </li>
        );
      })}
    </ul>
  );
}

function BatchView({ batchId, onBack }) {
  const [b, setB] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("ringkasan");
  const [banks, setBanks] = useState([]);
  const scope = useScope();

  const load = useCallback(async () => {
    try { setB(unwrap(await api.get(`/imports/${batchId}`, { scope: false, timeout: 120000 }))); } catch (e) { toast.error(unwrapError(e)); }
  }, [batchId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (b?.target === "bank" && !banks.length) {
      api.get("/master/bank-accounts", { params: { page: 1, per_page: 100 }, scope: false })
        .then((r) => setBanks((unwrap(r) || []).map((x) => ({ value: x.id, label: `${x.bank || ""} ${x.account_number || ""} — ${x.name || ""}` }))))
        .catch(() => {});
    }
  }, [b?.target, banks.length]);

  const patch = async (body) => {
    setSaving(true);
    try { setB(unwrap(await api.patch(`/imports/${batchId}`, body, { timeout: 120000 }))); } catch (e) { toast.error(unwrapError(e)); }
    finally { setSaving(false); }
  };
  const commit = async () => {
    const ok = await confirmDialog({ title: "Impor sekarang?", description: b.target === "bank"
      ? "Baris mutasi akan dibuat menjadi sesi rekonsiliasi bank baru (duplikat dilewati)."
      : "Transaksi disimpan dan rekap per toko/hari masuk ke Daily Sales DRAF sesuai aksi di tabel. Bisa dibatalkan.", confirmText: "Impor" });
    if (!ok) return;
    setSaving(true);
    try {
      const r = unwrap(await api.post(`/imports/${batchId}/commit`, { save_recipe: true }, { timeout: 300000 }));
      setB((x) => ({ ...x, ...r }));
      toast.success("Impor selesai");
      load();
    } catch (e) { toast.error(unwrapError(e)); } finally { setSaving(false); }
  };
  const rollback = async () => {
    if (!(await confirmDialog({ title: "Batalkan impor?", description: "Transaksi dari file ini dihapus; Daily Sales draf dihitung ulang atau dikembalikan. Yang sudah divalidasi tidak diubah.", confirmText: "Batalkan impor", destructive: true }))) return;
    setSaving(true);
    try { await api.post(`/imports/${batchId}/rollback`); toast.success("Impor dibatalkan"); load(); } catch (e) { toast.error(unwrapError(e)); }
    finally { setSaving(false); }
  };

  const fieldOpts = useMemo(() => [{ value: "", label: "— Abaikan —" }, ...(b?.field_options || [])], [b]);
  if (!b) return <Card className="p-4"><p className="text-sm text-muted-foreground">Membaca file…</p></Card>;
  const draft = b.status === "draft";
  const errors = (b.issues || []).filter((i) => i.level === "error");
  const s = b.summary || {};
  const isBank = b.target === "bank";

  const colDefs = [
    { key: "name", label: "Kolom di file", primary: true, render: (c) => <span className="font-medium">{c.name}</span> },
    { key: "sample", label: "Contoh isi", hideOnMobile: true, render: (c) => <span className="text-muted-foreground">{(c.sample || []).join(" · ") || "—"}</span> },
    { key: "field", label: "Dipetakan ke", render: (c) => (
      <SimpleSelect value={c.field || ""} onValueChange={(v) => patch({ mapping: { [c.name]: v || null } })} options={fieldOpts}
        disabled={!draft || saving} className="w-56" ariaLabel={`Pemetaan kolom ${c.name}`} testId={`import-map-${c.index}`} />) },
    { key: "confidence", label: "Oleh", render: (c) => (c.field ? `${BY_LABEL[c.by] || c.by || "—"} · ${Math.round((c.confidence || 0) * 100)}%` : "—") },
  ];
  const dayCols = [
    { key: "date", label: "Tanggal" },
    { key: "outlet", label: "Toko", primary: true },
    { key: "transaksi", label: "Transaksi", numeric: true },
    { key: "duplikat", label: "Duplikat", numeric: true },
    { key: "grand_total", label: "Grand total", numeric: true, render: (d) => rp(d.grand_total) },
    { key: "verdict", label: "Status", render: (d) => <StatusPill status={d.verdict} /> },
    { key: "alasan", label: "Keterangan", hideOnMobile: true, render: (d) => <span className="text-xs text-muted-foreground">{d.alasan}</span> },
    { key: "action", label: "Aksi", render: (d) => (draft ? (
      <SimpleSelect value={d.action} options={DAY_ACTIONS} disabled={saving || ["terkunci", "kosong"].includes(d.verdict)} className="w-32"
        ariaLabel={`Aksi ${d.outlet} ${d.date}`}
        onValueChange={(v) => patch({ options: { day_actions: { ...((b.options || {}).day_actions || {}), [`${d.outlet_id}|${d.date}`]: v } } })} />
    ) : (DAY_ACTIONS.find((x) => x.value === d.action)?.label || d.action)) },
  ];
  const txCols = [
    { key: "business_date", label: "Tanggal" }, { key: "time", label: "Jam" },
    { key: "receipt_no", label: "No. struk", primary: true, render: (t) => t.receipt_no || "—" },
    { key: "outlet_raw", label: "Toko (file)", hideOnMobile: true },
    { key: "channel", label: "Channel" }, { key: "payment_raw", label: "Bayar", hideOnMobile: true },
    { key: "net", label: "Net", numeric: true, render: (t) => rp(t.net) },
    { key: "total", label: "Total", numeric: true, render: (t) => rp(t.total) },
    { key: "dup", label: "Catatan", render: (t) => (t.void ? <StatusPill status="void" label="Void" /> : t.dup ? <StatusPill status="dup" label={t.dup} /> : "—") },
  ];
  const bankCols = [
    { key: "date", label: "Tanggal" }, { key: "description", label: "Keterangan", primary: true },
    { key: "reference", label: "Referensi", hideOnMobile: true, render: (r) => r.reference || "—" },
    { key: "amount", label: "Nominal", numeric: true, render: (r) => rp(r.amount) },
    { key: "balance", label: "Saldo", numeric: true, hideOnMobile: true, render: (r) => rp(r.balance) },
  ];
  const vm = b.value_maps_resolved || {};
  const valueRows = [...(vm.outlet || []).map((x) => ({ ...x, kind: "outlet" })), ...(vm.payment || []).map((x) => ({ ...x, kind: "payment" }))]
    .map((x, i) => ({ ...x, key: `${x.kind}-${i}` }));
  const valueCols = [
    { key: "kind", label: "Jenis", render: (x) => (x.kind === "outlet" ? "Toko" : "Metode bayar") },
    { key: "raw", label: "Nilai di file", primary: true, render: (x) => x.raw || "(tanpa kolom toko)" },
    { key: "id", label: "Dipetakan ke", render: (x) => (
      <SimpleSelect value={x.id || ""} disabled={!draft || saving} className="w-60" ariaLabel={`Pemetaan ${x.raw}`}
        options={[{ value: "", label: "— Belum dipetakan —" }, ...((b.choices || {})[x.kind] || [])]}
        onValueChange={(v) => (x.kind === "outlet" && !x.raw
          ? patch({ options: { outlet_id: v || null } })
          : patch({ value_maps: { [x.kind]: { [x.raw]: v || null } } }))} />) },
  ];

  return (
    <div className="space-y-3 md:space-y-4" data-testid="import-batch">
      <PageHeader icon={FileUp} title={b.filename || "Impor"} subtitle="Impor Cerdas — periksa pemetaan & duplikasi, lalu impor"
        actions={(
          <>
            <Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Kembali</Button>
            <Button variant="outline" onClick={() => openAI(`Bantu periksa batch impor ${b.id} (${b.filename}). Jelaskan pemetaan, duplikasi, dan masalahnya.`)} data-testid="import-ask-ai">
              <Bot className="h-4 w-4" /> Tanya AI
            </Button>
            {b.status === "committed" && <Button variant="outline" onClick={rollback} disabled={saving} data-testid="import-rollback"><Undo2 className="h-4 w-4" /> Batalkan impor</Button>}
            {draft && <Button onClick={commit} disabled={saving || errors.length > 0 || (b.missing || []).length > 0} data-testid="import-commit"><Upload className="h-4 w-4" /> Impor</Button>}
          </>
        )}>
        <KeyFacts items={[
          { label: "Status", value: <StatusPill status={b.status} /> },
          { label: "Sumber", value: b.source || "Tidak dikenal" },
          { label: "Jenis", value: isBank ? "Mutasi bank" : "Penjualan" },
          { label: "Baris data", value: b.rows_in_file },
          { label: "Sheet / header", value: `${b.sheet} · baris ${b.header_row}` },
          { label: "Pemetaan", value: BY_LABEL[b.mapping_by] || b.mapping_by },
        ]} />
      </PageHeader>

      {b.error && <Card className="p-4"><p className="text-sm text-rose-700 dark:text-rose-400">{b.error}</p></Card>}
      {(b.missing || []).length > 0 && (
        <Card className="p-3"><p className="text-sm text-rose-700 dark:text-rose-400 flex items-center gap-2"><CircleX className="h-4 w-4" />
          Kolom wajib belum dipetakan: {b.missing.join(", ")} — atur di tab Pemetaan kolom.</p></Card>
      )}

      <div className={cn("grid gap-3", isBank ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 lg:grid-cols-4")}>
        {isBank ? (
          <>
            <CompactStatCard label="Baris mutasi" value={s.baris ?? "—"} />
            <CompactStatCard label="Uang masuk" value={rp(s.masuk)} tone="success" />
            <CompactStatCard label="Uang keluar" value={rp(s.keluar)} tone="warning" />
            <CompactStatCard label="Sudah pernah diimpor" value={b.duplicates ?? 0} />
          </>
        ) : (
          <>
            <CompactStatCard label="Transaksi" value={s.transaksi ?? "—"} sub={(s.tanggal || []).join(" s/d ")} />
            <CompactStatCard label="Total" value={rp(s.total)} />
            <CompactStatCard label="Void / batal" value={s.void ?? 0} />
            <CompactStatCard label="Duplikat (dilewati)" value={(b.days || []).reduce((a, d) => a + (d.duplikat || 0), 0)} sub="lihat tabel per hari" />
          </>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="Bagian impor">
          <TabsTrigger value="ringkasan" data-testid="import-tab-summary">{isBank ? "Opsi" : "Per toko & hari"}</TabsTrigger>
          <TabsTrigger value="kolom" data-testid="import-tab-columns">Pemetaan kolom</TabsTrigger>
          {!isBank && <TabsTrigger value="nilai" data-testid="import-tab-values">Pemetaan nilai</TabsTrigger>}
          <TabsTrigger value="contoh">Contoh data</TabsTrigger>
          <TabsTrigger value="masalah" data-testid="import-tab-issues">Masalah ({(b.issues || []).length})</TabsTrigger>
        </TabsList>

        <TabsContent value="ringkasan">
          <Card className="p-4 space-y-3">
            {isBank ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="imp-bank">Rekening bank</Label>
                  <SimpleSelect id="imp-bank" value={(b.options || {}).bank_account_id || ""} options={[{ value: "", label: "— Pilih rekening —" }, ...banks]}
                    onValueChange={(v) => patch({ options: { bank_account_id: v || null } })} disabled={!draft || saving} ariaLabel="Rekening bank" testId="import-bank-account" />
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="imp-bucket">Bucket bila tanpa rincian menu</Label>
                    <SimpleSelect id="imp-bucket" value={(b.options || {}).default_bucket || "food"} className="w-40" disabled={!draft || saving}
                      options={[{ value: "food", label: "Food" }, { value: "beverage", label: "Beverage" }, { value: "other", label: "Other" }]}
                      onValueChange={(v) => patch({ options: { default_bucket: v } })} ariaLabel="Bucket default" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="imp-cutoff">Hari bisnis berganti jam</Label>
                    <SimpleSelect id="imp-cutoff" value={String((b.options || {}).cutoff_hour ?? 4)} className="w-28" disabled={!draft || saving}
                      options={[0, 1, 2, 3, 4, 5, 6].map((h) => ({ value: String(h), label: `${String(h).padStart(2, "0")}:00` }))}
                      onValueChange={(v) => patch({ options: { cutoff_hour: Number(v) } })} ariaLabel="Jam pergantian hari bisnis" />
                  </div>
                  {b.duplicate_file_of && (
                    <div className="flex items-center gap-2">
                      <Switch id="imp-dupfile" checked={!!(b.options || {}).allow_duplicate_file} disabled={!draft || saving}
                        onCheckedChange={(v) => patch({ options: { allow_duplicate_file: v } })} />
                      <Label htmlFor="imp-dupfile" className="text-amber-800 dark:text-amber-400">File ini sudah pernah diimpor — tetap proses</Label>
                    </div>
                  )}
                </div>
                <DataTable columns={dayCols} rows={(b.days || []).map((d) => ({ ...d, id: `${d.outlet_id}|${d.date}` }))} rowTestIdPrefix="import-day"
                  empty={<EmptyState icon={Wand2} title="Belum ada hari yang bisa diimpor" description="Petakan toko & kolom wajib dulu." />} />
                {scope.outlet && <p className="text-xs text-muted-foreground">Konteks TopNav: {scope.outlet.name} dipakai untuk file tanpa kolom toko.</p>}
              </>
            )}
          </Card>
        </TabsContent>
        <TabsContent value="kolom">
          <Card className="p-4"><DataTable columns={colDefs} rows={(b.columns || []).map((c) => ({ ...c, id: c.index }))} rowTestIdPrefix="import-col" /></Card>
        </TabsContent>
        {!isBank && (
          <TabsContent value="nilai">
            <Card className="p-4"><DataTable columns={valueCols} rows={valueRows} keyField="key" rowTestIdPrefix="import-val"
              empty={<EmptyState icon={Info} title="Tidak ada nilai untuk dipetakan" />} /></Card>
          </TabsContent>
        )}
        <TabsContent value="contoh">
          <Card className="p-4"><DataTable columns={isBank ? bankCols : txCols} rows={(b.preview || []).map((t, i) => ({ ...t, id: i }))} rowTestIdPrefix="import-row"
            empty={<EmptyState icon={Info} title="Tidak ada baris terbaca" />} /></Card>
        </TabsContent>
        <TabsContent value="masalah">
          <Card className="p-4"><Issues issues={b.issues} /></Card>
        </TabsContent>
      </Tabs>

      {b.result && (
        <Card className="p-4 space-y-2" data-testid="import-result">
          <CardHeader className="p-0"><CardTitle className="text-base">Hasil impor</CardTitle></CardHeader>
          <p className="text-sm">{isBank
            ? `${b.result.rows} baris mutasi → sesi rekonsiliasi baru (${b.result.skipped_duplicates} duplikat dilewati).`
            : `${b.result.transactions} transaksi disimpan, ${b.result.lines} baris menu, ${b.result.menu_items_created} menu baru (perlu ditinjau), `
              + `${b.result.skipped_duplicates} duplikat dilewati${b.result.skipped_day_transactions ? `, ${b.result.skipped_day_transactions} transaksi di hari yang dilewati tidak disimpan` : ""}.`}</p>
          {!isBank && (b.result.days || []).length > 0 && (
            <ul className="text-sm space-y-0.5">
              {b.result.days.map((d) => (
                <li key={`${d.outlet_id}|${d.date}`}>{d.date} · {(b.days || []).find((x) => x.outlet_id === d.outlet_id)?.outlet || d.outlet_id}: {d.status}{d.error ? ` — ${d.error}` : ""}{d.alasan ? ` — ${d.alasan}` : ""}</li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

export default function AIImportPage() {
  const [params, setParams] = useSearchParams();
  const batchId = params.get("batch");
  const [refreshKey, setRefreshKey] = useState(0);
  const open = (id) => setParams(id ? { batch: id } : {});
  if (batchId) return <BatchView batchId={batchId} onBack={() => { open(null); setRefreshKey((k) => k + 1); }} />;
  return (
    <div className="space-y-3 md:space-y-4" data-testid="import-page">
      <PageHeader icon={FileUp} title="Impor Cerdas"
        subtitle="Unggah ekspor POS, aplikasi delivery, rekap Excel, atau mutasi bank — AI memetakan, membersihkan, dan mengecek duplikasi"
        actions={<Button variant="outline" onClick={() => openAI("Saya mau impor data penjualan. Bagaimana caranya dan file apa saja yang didukung?")}><Bot className="h-4 w-4" /> Tanya AI</Button>} />
      <UploadStart onCreated={open} />
      <History onOpen={open} refreshKey={refreshKey} />
    </div>
  );
}
