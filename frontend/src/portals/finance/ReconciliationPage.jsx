/** /finance/reconciliation — Rekonsiliasi lanjutan (selain bank): statement supplier vs hutang, 3-way match PO–GR–invoice,
 * persediaan kartu stok vs GL, kas kecil, transfer antar toko, settlement EDC/QRIS vs POS. Hanya membaca; penyesuaian
 * dibukukan lewat jurnal manual. Ekspor PDF/Excel dari hasil yang tampil. Backend: /api/ai/finance/reconcile/*. */
import { useEffect, useMemo, useState } from "react";
import { Scale, Play, FileDown, Bot } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import StatusPill from "@/components/shared/StatusPill";
import CompactStatCard from "@/components/shared/CompactStatCard";
import SegmentedFilter from "@/components/shared/SegmentedFilter";
import SimpleSelect from "@/components/shared/SimpleSelect";
import EmptyState from "@/components/shared/EmptyState";
import { InlineHelp } from "@/components/shared/InlineHelp";
import api, { fetchAll, unwrap, unwrapError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtRp, fmtDate } from "@/lib/format";

const KINDS = [
  { value: "vendor", label: "Statement supplier" }, { value: "three", label: "3-way match" }, { value: "stock", label: "Stok vs GL" },
  { value: "petty", label: "Kas kecil" }, { value: "transfer", label: "Transfer" }, { value: "noncash", label: "EDC/QRIS" },
];
const DESC = {
  vendor: "Unggah statement/rekening koran dari supplier (foto, PDF, atau Excel). AI membaca & mencocokkan dengan hutang per invoice dan pembayaran.",
  three: "Cocokkan PO, penerimaan barang (GR) dan invoice: harga GR di atas PO, qty lebih, invoice ≠ GR, PO terlambat.",
  stock: "Nilai persediaan menurut kartu stok vs saldo akun persediaan per toko, beserta asal selisih.",
  petty: "Saldo buku kas kecil vs akun GL per toko, transaksi tanpa jurnal & pembelian tanpa foto struk.",
  transfer: "Transfer antar toko yang belum diterima dan selisih qty kirim vs terima.",
  noncash: "Unggah laporan settlement EDC/QRIS dari bank/penyedia. Dibandingkan per tanggal dengan penjualan non-tunai di POS (selisih & MDR %).",
};
const PILL = { cocok: ["confirmed", "Cocok"], selisih: ["pending", "Selisih"], selisih_nominal: ["pending", "Selisih nominal"],
  hanya_statement: ["rejected", "Hanya di statement"], hanya_buku: ["submitted", "Hanya di buku"], hanya_pos: ["rejected", "Hanya di POS"],
  terlambat: ["overdue", "Terlambat"] };
const money = (v) => (v == null ? "—" : fmtRp(v));
const COLS = {
  vendor: [["tanggal", "Tanggal", (r) => (r.tanggal ? fmtDate(r.tanggal) : "—")], ["jenis", "Jenis"], ["no_statement", "No. statement", (r) => r.no_statement || r.no_buku || "—"],
    ["nominal_statement", "Statement", (r) => money(r.nominal_statement), true], ["nominal_buku", "Buku", (r) => money(r.nominal_buku), true]],
  three: [["gr", "GR / PO", (r) => [r.gr, r.po].filter(Boolean).join(" · ")], ["vendor", "Supplier"], ["nilai_po", "PO", (r) => money(r.nilai_po), true],
    ["nilai_gr", "GR", (r) => money(r.nilai_gr), true], ["nilai_invoice", "Invoice", (r) => money(r.nilai_invoice), true]],
  stock: [["toko", "Toko"], ["nilai_kartu_stok", "Kartu stok", (r) => money(r.nilai_kartu_stok), true], ["saldo_gl", "Saldo GL", (r) => money(r.saldo_gl), true],
    ["selisih", "Selisih", (r) => money(r.selisih), true]],
  petty: [["toko", "Toko"], ["saldo_buku", "Saldo buku", (r) => money(r.saldo_buku), true], ["saldo_gl", "Saldo GL", (r) => money(r.saldo_gl), true],
    ["selisih", "Selisih", (r) => money(r.selisih), true]],
  transfer: [["transfer", "Transfer"], ["tanggal", "Tanggal", (r) => (r.tanggal ? fmtDate(r.tanggal) : "—")], ["dari", "Dari"], ["ke", "Ke"],
    ["nilai", "Nilai", (r) => money(r.nilai), true]],
  noncash: [["tanggal", "Tanggal", (r) => fmtDate(r.tanggal)], ["pos", "POS", (r) => money(r.pos), true], ["kotor", "Laporan", (r) => money(r.kotor), true],
    ["mdr_pct", "MDR %", (r) => (r.mdr_pct == null ? "—" : `${r.mdr_pct}%`), true], ["selisih", "Selisih", (r) => money(r.selisih), true]],
};

async function upload(file) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("category", "general");
  return unwrap(await api.post("/uploads", fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 120000 }));
}

export default function ReconciliationPage() {
  const { can } = useAuth();
  const [kind, setKind] = useState("three");
  const [days, setDays] = useState("60");
  const [vendors, setVendors] = useState([]);
  const [vendorId, setVendorId] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);

  useEffect(() => { setRes(null); setFile(null); }, [kind]);
  useEffect(() => {
    if (kind === "vendor" && !vendors.length) fetchAll("/master/vendors").then((r) => setVendors(unwrap(r) || [])).catch(() => {});
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async () => {
    setBusy(true); setRes(null);
    try {
      let r;
      if (kind === "vendor") {
        if (!vendorId || !file) { toast.error("Pilih supplier & file statement"); setBusy(false); return; }
        const att = await upload(file);
        r = await api.post("/ai/finance/reconcile/vendor-statement", { vendor_id: vendorId, attachment_id: att.id }, { timeout: 240000 });
      } else if (kind === "noncash") {
        if (!file) { toast.error("Pilih file laporan settlement"); setBusy(false); return; }
        const att = await upload(file);
        r = await api.post("/ai/finance/reconcile/non-cash", { attachment_id: att.id }, { timeout: 240000 });
      } else {
        const path = { three: "three-way", stock: "inventory-gl", petty: "petty-cash", transfer: "transfers" }[kind];
        r = await api.get(`/ai/finance/reconcile/${path}`, { params: ["three", "transfer"].includes(kind) ? { days } : {}, timeout: 120000 });
      }
      setRes(unwrap(r));
    } catch (e) { toast.error(unwrapError(e)); } finally { setBusy(false); }
  };

  const exportAs = async (format) => {
    try {
      const r = await api.post("/ai/finance/reconcile/export", { format, result: res }, { responseType: "blob", timeout: 120000 });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url; a.download = `${(res.judul || "rekonsiliasi").replace(/[^\w-]+/g, "_")}.${format}`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { toast.error(unwrapError(e)); }
  };
  const askAI = () => window.dispatchEvent(new CustomEvent("aurora-open-ai", { detail: {
    prompt: `Jelaskan hasil rekonsiliasi "${res.judul}" ini dan usulkan jurnal penyesuaian bila perlu: ${JSON.stringify({ ringkasan: res.ringkasan, rows: res.rows.filter((x) => x.status !== "cocok").slice(0, 40) })}` } }));

  const cols = useMemo(() => [
    ...COLS[kind].map(([key, label, render, numeric]) => ({ key, label, numeric, render, hideOnMobile: !!numeric && key !== "selisih" })),
    { key: "status", label: "Status", render: (r) => <StatusPill status={(PILL[r.status] || ["draft"])[0]} label={(PILL[r.status] || [0, r.status])[1]} /> },
  ], [kind]);
  const s = res?.ringkasan || {};
  const needsFile = kind === "vendor" || kind === "noncash";

  return (
    <div className="space-y-3 md:space-y-4" data-testid="reconciliation-page">
      <PageHeader icon={Scale} title="Rekonsiliasi" subtitle="Hutang supplier, PO–GR–invoice, persediaan, kas kecil, transfer antar toko & EDC/QRIS"
        actions={res ? (
          <>
            {can("ai.agent.use") && <Button variant="outline" onClick={askAI}><Bot /> Tanya AI</Button>}
            <Button variant="outline" onClick={() => exportAs("xlsx")} data-testid="recon-export-xlsx"><FileDown /> Excel</Button>
            <Button variant="outline" onClick={() => exportAs("pdf")} data-testid="recon-export-pdf"><FileDown /> PDF</Button>
          </>
        ) : null} />
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedFilter value={kind} onChange={setKind} options={KINDS} ariaLabel="Jenis rekonsiliasi" testId="recon-kind" />
        <InlineHelp title="Rekonsiliasi bank" content="Mutasi rekening bank direkonsiliasi di Payments → Kas & Bank → Bank reconciliation (dengan Analisis AI)." />
      </div>
      <p className="text-sm text-muted-foreground max-w-3xl">{DESC[kind]}</p>
      <div className="flex flex-wrap items-end gap-3">
        {kind === "vendor" && (
          <div className="space-y-1 w-64"><Label htmlFor="rc-vendor">Supplier</Label>
            <SimpleSelect id="rc-vendor" value={vendorId} onValueChange={setVendorId} ariaLabel="Supplier" className="w-full"
              options={[{ value: "", label: "— Pilih supplier —" }, ...vendors.map((v) => ({ value: v.id, label: v.name }))]} /></div>
        )}
        {needsFile && (
          <div className="space-y-1 w-72"><Label htmlFor="rc-file">{kind === "vendor" ? "File statement" : "Laporan settlement"}</Label>
            <Input id="rc-file" type="file" accept="image/*,application/pdf,.xlsx,.xls,.csv" onChange={(e) => setFile(e.target.files?.[0] || null)} data-testid="recon-file" /></div>
        )}
        {["three", "transfer"].includes(kind) && (
          <div className="space-y-1 w-40"><Label htmlFor="rc-days">Rentang</Label>
            <SimpleSelect id="rc-days" value={days} onValueChange={setDays} ariaLabel="Rentang" className="w-full"
              options={[{ value: "30", label: "30 hari" }, { value: "60", label: "60 hari" }, { value: "90", label: "90 hari" }, { value: "180", label: "180 hari" }]} /></div>
        )}
        <Button onClick={run} disabled={busy} data-testid="recon-run"><Play /> {busy ? (needsFile ? "Membaca & mencocokkan…" : "Menghitung…") : "Jalankan"}</Button>
      </div>
      {res && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <CompactStatCard label="Baris" value={s.baris ?? 0} />
          <CompactStatCard label="Cocok" value={s.cocok ?? 0} tone="success" />
          <CompactStatCard label="Perlu dicek" value={s.perlu_cek ?? 0} tone={s.perlu_cek ? "warning" : "success"} />
          {kind === "vendor" && <CompactStatCard label="Selisih saldo" value={money(s.selisih_saldo)} sub={`statement ${money(s.saldo_statement)} · buku ${money(s.saldo_buku)}`} tone={s.selisih_saldo ? "danger" : "success"} />}
          {kind === "stock" && <CompactStatCard label="Kartu stok vs GL" value={money((s.total_kartu_stok || 0) - (s.total_gl || 0))} sub={`${s.mutasi_penyesuaian_tanpa_jurnal ?? 0} penyesuaian tanpa jurnal`} tone="warning" />}
          {kind === "noncash" && <CompactStatCard label="MDR rata-rata" value={s.mdr_rata2_pct != null ? `${s.mdr_rata2_pct}%` : "—"} sub={`kotor ${money(s.kotor)}`} />}
          {["three", "petty", "transfer"].includes(kind) && <CompactStatCard label="Kesesuaian" value={s.baris ? `${Math.round((s.cocok / s.baris) * 100)}%` : "—"} />}
        </div>
      )}
      <Card className="p-0 overflow-hidden">
        <DataTable columns={cols} rows={(res?.rows || []).map((r, i) => ({ ...r, _k: i }))} keyField="_k" loading={busy} rowTestIdPrefix="recon-row"
          renderExpanded={(r) => <p className="text-sm whitespace-pre-wrap">{r.keterangan}</p>}
          empty={<EmptyState icon={Scale} title={res ? "Tidak ada baris" : "Belum dijalankan"} description={res ? "Tidak ada data pada rentang ini." : "Pilih jenis rekonsiliasi lalu klik Jalankan."} />} />
      </Card>
    </div>
  );
}
