/** Analisis price list supplier dengan AI: unggah foto/PDF/Excel price list → cocokkan ke master item, normalisasi
 * kemasan ke satuan item, bandingkan dengan harga lama, harga beli terakhir, acuan pasar & supplier lain → temuan,
 * rekomendasi, dampak per bulan, draf pesan negosiasi → simpan baris terpilih sebagai penawaran.
 * Backend: POST /ai/purchasing/pricelist/analyze, POST /sourcing/offers/bulk. */
import { useEffect, useMemo, useState } from "react";
import { Sparkles, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DataTable from "@/components/shared/DataTable";
import StatusPill from "@/components/shared/StatusPill";
import CompactStatCard from "@/components/shared/CompactStatCard";
import SimpleSelect from "@/components/shared/SimpleSelect";
import EmptyState from "@/components/shared/EmptyState";
import api, { fetchAll, unwrap, unwrapError } from "@/lib/api";
import { fmtRp } from "@/lib/format";

const REC = {
  terima: ["confirmed", "Terima"],
  negosiasi: ["pending", "Negosiasi"],
  "pertimbangkan pindah": ["rejected", "Pertimbangkan pindah"],
};

export async function uploadFile(file, category = "general") {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("category", category);
  return unwrap(await api.post("/uploads", fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 120000 }));
}

export default function PriceListAIDialog({ open, onOpenChange, canSave, onSaved }) {
  const [vendors, setVendors] = useState([]);
  const [vendorId, setVendorId] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [picked, setPicked] = useState(() => new Set());

  useEffect(() => {
    if (!open) return;
    setRes(null); setFile(null); setPicked(new Set());
    if (!vendors.length) fetchAll("/master/vendors").then((r) => setVendors(unwrap(r) || [])).catch(() => {});
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const analyze = async () => {
    if (!vendorId || !file) { toast.error("Pilih supplier & file price list"); return; }
    setBusy(true);
    try {
      const att = await uploadFile(file, "invoice");
      const r = unwrap(await api.post("/ai/purchasing/pricelist/analyze", { vendor_id: vendorId, attachment_id: att.id }, { timeout: 180000 }));
      setRes(r);
      setPicked(new Set(r.baris.map((x, i) => (x.offer ? i : null)).filter((i) => i !== null)));
    } catch (e) { toast.error(unwrapError(e)); } finally { setBusy(false); }
  };

  const save = async () => {
    const rows = res.baris.filter((x, i) => picked.has(i) && x.offer).map((x) => x.offer);
    setBusy(true);
    try {
      await api.post("/sourcing/offers/bulk", { rows });
      toast.success(`${rows.length} penawaran disimpan`); onSaved?.(); onOpenChange(false);
    } catch (e) { toast.error(unwrapError(e)); } finally { setBusy(false); }
  };

  const rows = useMemo(() => (res?.baris || []).map((x, i) => ({ ...x, _i: i })), [res]);
  const toggle = (i) => setPicked((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const s = res?.ringkasan || {};
  const cols = [
    ...(canSave ? [{ key: "pick", label: "", render: (r) => (r.offer
      ? <Checkbox checked={picked.has(r._i)} onCheckedChange={() => toggle(r._i)} aria-label={`Pilih ${r.nama}`} />
      : null) }] : []),
    { key: "nama", label: "Produk", primary: true, render: (r) => (
      <div className="min-w-0"><div className="font-medium truncate">{r.nama}</div>
        <div className="text-xs text-muted-foreground truncate">{r.item ? `→ ${r.item}` : "item baru"} · {r.kemasan || "—"}</div></div>) },
    { key: "harga", label: "Harga", numeric: true, render: (r) => fmtRp(r.harga) },
    { key: "harga_per_satuan", label: "Per satuan", numeric: true, render: (r) => (r.harga_per_satuan ? `${fmtRp(r.harga_per_satuan)}/${r.satuan_item}` : "—") },
    { key: "temuan", label: "Temuan", hideOnMobile: true, render: (r) => (
      <span className="text-xs">{(r.temuan || []).join("; ") || (r.status === "dibandingkan" ? "sesuai" : r.rekomendasi)}</span>) },
    { key: "dampak_per_bulan", label: "Dampak/bln", numeric: true, hideOnMobile: true, render: (r) => (r.dampak_per_bulan ? fmtRp(r.dampak_per_bulan) : "—") },
    { key: "rekomendasi", label: "Saran", render: (r) => (REC[r.rekomendasi]
      ? <StatusPill status={REC[r.rekomendasi][0]} label={REC[r.rekomendasi][1]} />
      : <StatusPill status="draft" label={r.status === "item_baru" ? "Item baru" : "Cek kemasan"} />) },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto" data-testid="pricelist-ai-dialog">
        <DialogHeader>
          <DialogTitle>Analisis price list (AI)</DialogTitle>
          <DialogDescription>Foto, PDF, atau Excel price list supplier. Harga dibandingkan per satuan item — kemasan dikonversi dulu.</DialogDescription>
        </DialogHeader>
        {!res ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label htmlFor="pl-vendor">Supplier</Label>
              <SimpleSelect id="pl-vendor" value={vendorId} onValueChange={setVendorId} ariaLabel="Supplier" className="w-full"
                options={[{ value: "", label: "— Pilih supplier —" }, ...vendors.map((v) => ({ value: v.id, label: v.name }))]} /></div>
            <div className="space-y-1"><Label htmlFor="pl-file">File price list</Label>
              <Input id="pl-file" type="file" accept="image/*,application/pdf,.xlsx,.xls,.csv" onChange={(e) => setFile(e.target.files?.[0] || null)}
                data-testid="pricelist-file" /></div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <CompactStatCard label="Baris" value={s.baris} sub={`${s.item_baru} item baru`} />
              <CompactStatCard label="Negosiasi" value={s.negosiasi} tone={s.negosiasi ? "warning" : "default"} />
              <CompactStatCard label="Pertimbangkan pindah" value={s.pindah} tone={s.pindah ? "danger" : "default"} />
              <CompactStatCard label="Dampak / bulan" value={fmtRp(s.dampak_per_bulan)} tone={s.dampak_per_bulan > 0 ? "danger" : "success"} />
            </div>
            <DataTable columns={cols} rows={rows} keyField="_i" rowTestIdPrefix="pricelist-row" loading={busy && !res}
              empty={<EmptyState icon={Sparkles} title="Tidak ada baris" description="Price list tidak berisi produk yang terbaca." />} />
            {res.draf_pesan_negosiasi && (
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="pl-nego">Draf pesan negosiasi</Label>
                  <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(res.draf_pesan_negosiasi); toast.success("Disalin"); }}>
                    <Copy className="h-3.5 w-3.5" /> Salin
                  </Button>
                </div>
                <Textarea id="pl-nego" rows={6} readOnly value={res.draf_pesan_negosiasi} />
              </div>
            )}
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
          {!res ? (
            <Button onClick={analyze} disabled={busy} data-testid="pricelist-analyze">{busy ? "Membaca & membandingkan…" : "Analisis"}</Button>
          ) : canSave && (
            <Button onClick={save} disabled={busy || !picked.size} data-testid="pricelist-save">Simpan {picked.size} sebagai penawaran</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
