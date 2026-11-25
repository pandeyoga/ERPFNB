/** Foto/PDF struk → jurnal (AI): unggah beberapa struk/invoice sekaligus → OCR → akun beban (aturan yang dipelajari
 * lalu AI) + PPN masukan → cek bukti ganda → pilih & bukukan. Bukti terlampir ke jurnal, vendor → akun dipelajari.
 * Backend: POST /ai/finance/receipts/analyze, POST /finance/journals/manual. */
import { useEffect, useMemo, useState } from "react";
import { ScanText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DataTable from "@/components/shared/DataTable";
import StatusPill from "@/components/shared/StatusPill";
import SimpleSelect from "@/components/shared/SimpleSelect";
import EmptyState from "@/components/shared/EmptyState";
import api, { fetchAll, unwrap, unwrapError } from "@/lib/api";
import useOutletScope from "@/hooks/useOutletScope";
import { fmtRp, fmtDate } from "@/lib/format";

const STATUS = { siap: ["confirmed", "Siap"], perlu_cek: ["pending", "Perlu dicek"], duplikat: ["rejected", "Duplikat"], gagal: ["draft", "Gagal"] };
const PAYMENTS = [
  { value: "cash", label: "Kas" }, { value: "petty", label: "Kas kecil toko" },
  { value: "bank", label: "Bank" }, { value: "ap", label: "Hutang usaha (belum dibayar)" },
];

async function upload(file) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("category", "receipt");
  return unwrap(await api.post("/uploads", fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 120000 }));
}

export default function ReceiptJournalDialog({ open, onOpenChange, onPosted }) {
  const { scopedOutlets } = useOutletScope("", { form: true });
  const [outletId, setOutletId] = useState("");
  const [payment, setPayment] = useState("cash");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState("");
  const [res, setRes] = useState(null);
  const [coas, setCoas] = useState([]);
  const [acct, setAcct] = useState({});          // no → coa_id pilihan pengguna
  const [picked, setPicked] = useState(() => new Set());
  const [posted, setPosted] = useState({});

  useEffect(() => {
    if (!open) return;
    setRes(null); setFiles([]); setAcct({}); setPicked(new Set()); setPosted({});
    if (!coas.length) fetchAll("/master/chart-of-accounts").then((c) => setCoas((unwrap(c) || []).filter((x) => x.is_postable && x.active))).catch(() => {});
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const coaOpts = useMemo(() => [{ value: "", label: "— Pilih akun —" },
    ...coas.filter((c) => ["expense", "cogs", "asset"].includes(c.type)).map((c) => ({ value: c.id, label: `${c.code} ${c.name}` }))], [coas]);

  const analyze = async () => {
    if (!files.length) { toast.error("Pilih foto/PDF struk"); return; }
    setBusy("analyze");
    try {
      const ids = [];
      for (const f of files.slice(0, 30)) ids.push((await upload(f)).id);
      const r = unwrap(await api.post("/ai/finance/receipts/analyze", { attachment_ids: ids, payment, outlet_id: outletId || null }, { timeout: 300000 }));
      setRes(r);
      setPicked(new Set(r.items.filter((i) => i.status === "siap" && i.journal?.lines?.[0]?.coa_id).map((i) => i.no)));
    } catch (e) { toast.error(unwrapError(e)); } finally { setBusy(""); }
  };

  const post = async () => {
    setBusy("post");
    let ok = 0;
    for (const it of res.items.filter((i) => picked.has(i.no) && !posted[i.no])) {
      const coa = acct[it.no] || it.journal.lines[0].coa_id;
      const lines = it.journal.lines.map((ln, k) => (k === 0 ? { ...ln, coa_id: coa } : ln));
      const body = { ...it.journal, lines, learn: it.journal.learn ? { ...it.journal.learn, coa_id: coa } : null };
      try {
        const je = unwrap(await api.post("/finance/journals/manual", body));
        setPosted((p) => ({ ...p, [it.no]: je.doc_no })); ok += 1;
      } catch (e) { toast.error(`Struk #${it.no}: ${unwrapError(e)}`); }
    }
    if (ok) { toast.success(`${ok} jurnal dibukukan`); onPosted?.(); }
    setPicked(new Set()); setBusy("");
  };

  const toggle = (no) => setPicked((s) => { const n = new Set(s); n.has(no) ? n.delete(no) : n.add(no); return n; });
  const canPick = (i) => ["siap", "perlu_cek"].includes(i.status) && !posted[i.no] && (acct[i.no] || i.journal?.lines?.[0]?.coa_id);
  const s = res?.ringkasan || {};
  const cols = [
    { key: "pick", label: "", render: (i) => (canPick(i)
      ? <Checkbox checked={picked.has(i.no)} onCheckedChange={() => toggle(i.no)} onClick={(e) => e.stopPropagation()} aria-label={`Pilih struk ${i.no}`} />
      : null) },
    { key: "vendor", label: "Struk", primary: true, render: (i) => (
      <div className="min-w-0"><div className="font-medium truncate">#{i.no} {i.vendor || "—"}</div>
        <div className="text-xs text-muted-foreground">{i.tanggal ? fmtDate(i.tanggal) : ""}</div></div>) },
    { key: "total", label: "Total", numeric: true, render: (i) => (i.total ? fmtRp(i.total) : "—") },
    { key: "akun_beban", label: "Akun beban", render: (i) => (["siap", "perlu_cek"].includes(i.status) && !posted[i.no]
      ? <div onClick={(e) => e.stopPropagation()} className="min-w-[180px]"><SimpleSelect value={acct[i.no] || i.journal?.lines?.[0]?.coa_id || ""} options={coaOpts}
          onValueChange={(v) => setAcct((a) => ({ ...a, [i.no]: v }))} ariaLabel={`Akun beban struk ${i.no}`} className="w-full" /></div>
      : <span className="text-xs">{i.akun_beban || "—"}</span>) },
    { key: "status", label: "Status", render: (i) => (posted[i.no]
      ? <StatusPill status="posted" label={posted[i.no]} />
      : <StatusPill status={STATUS[i.status][0]} label={STATUS[i.status][1]} />) },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="receipt-ai-dialog">
        <DialogHeader>
          <DialogTitle>Foto struk → jurnal</DialogTitle>
          <DialogDescription>Hingga 30 foto/PDF struk atau invoice sekaligus. Struk yang sama tidak bisa dibukukan dua kali.</DialogDescription>
        </DialogHeader>
        {!res ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1"><Label htmlFor="rc-outlet">Toko</Label>
              <SimpleSelect id="rc-outlet" value={outletId} onValueChange={setOutletId} ariaLabel="Toko" className="w-full"
                options={[{ value: "", label: "— Kantor pusat —" }, ...scopedOutlets.map((o) => ({ value: o.id, label: o.name }))]} /></div>
            <div className="space-y-1"><Label htmlFor="rc-pay">Dibayar dari</Label>
              <SimpleSelect id="rc-pay" value={payment} onValueChange={setPayment} options={PAYMENTS} ariaLabel="Dibayar dari" className="w-full" /></div>
            <div className="space-y-1"><Label htmlFor="rc-files">Foto / PDF</Label>
              <Input id="rc-files" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setFiles([...(e.target.files || [])])} data-testid="receipt-files" /></div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">{s.lampiran} struk · {s.siap} siap · {s.perlu_cek} perlu dicek · {s.duplikat} duplikat · {s.gagal} gagal ·
              total {fmtRp(s.total)} · dibayar dari <b>{res.akun_bayar}</b></p>
            <DataTable columns={cols} rows={res.items} keyField="no" rowTestIdPrefix="receipt-row" loading={busy === "analyze"}
              renderExpanded={(i) => (
                <div className="text-xs space-y-1">
                  {i.pesan && <p>{i.pesan}</p>}
                  {i.duplikat && <p className="text-rose-700 dark:text-rose-400">Duplikat: {i.duplikat}</p>}
                  {(i.peringatan || []).map((w) => <p key={w} className="text-amber-800 dark:text-amber-400">{w}</p>)}
                  {i.alasan_akun && <p className="text-muted-foreground">Akun: {i.alasan_akun} ({i.sumber_akun})</p>}
                  {i.ppn_dikreditkan > 0 && <p>PPN masukan {fmtRp(i.ppn_dikreditkan)}</p>}
                  {(i.items || []).length > 0 && <p className="text-muted-foreground">{i.items.map((x) => x.name).filter(Boolean).join(", ")}</p>}
                </div>
              )}
              empty={<EmptyState icon={ScanText} title="Tidak ada struk" description="Unggah foto atau PDF struk." />} />
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
          {!res ? (
            <Button onClick={analyze} disabled={!!busy} data-testid="receipt-analyze">{busy ? "Membaca struk…" : "Baca struk"}</Button>
          ) : (
            <Button onClick={post} disabled={!!busy || !picked.size} data-testid="receipt-post">{busy === "post" ? "Membukukan…" : `Bukukan ${picked.size} jurnal`}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
