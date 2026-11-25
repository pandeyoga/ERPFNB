/** Analisis AI untuk sesi Rekonsiliasi Bank: mengelompokkan mutasi yang belum cocok (payout marketplace banyak-ke-satu,
 * settlement QRIS/EDC − MDR, setoran tunai, biaya & bunga bank), menjelaskan sisanya dengan Claude, lalu membukukan
 * jurnal penyesuaian terpilih & menandai mutasi cocok. Backend: POST /ai/finance/recon/{id}/analyze | /apply. */
import { useEffect, useMemo, useState } from "react";
import { Sparkles, Bot } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DataTable from "@/components/shared/DataTable";
import StatusPill from "@/components/shared/StatusPill";
import CompactStatCard from "@/components/shared/CompactStatCard";
import SegmentedFilter from "@/components/shared/SegmentedFilter";
import EmptyState from "@/components/shared/EmptyState";
import api, { unwrap, unwrapError } from "@/lib/api";
import { fmtRp, fmtDate } from "@/lib/format";

const STATUS = { cocok: ["confirmed", "Sudah cocok"], usulan: ["pending", "Usulan"], belum: ["draft", "Belum"] };

const humanize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : "");

function Lines({ row }) {
  return (
    <div className="space-y-2 text-sm">
      {row.explanation && <p>{row.explanation}</p>}
      {row.ai?.penjelasan && row.ai.penjelasan !== row.explanation && (
        <p className="text-muted-foreground"><Bot className="inline h-3.5 w-3.5 mr-1" aria-hidden />{row.ai.penjelasan}{row.ai.akun ? ` — akun ${row.ai.akun}` : ""}</p>
      )}
      {row.window?.length > 0 && <p className="text-xs text-muted-foreground">Tanggal penjualan: {row.window.map(fmtDate).join(", ")}</p>}
      {(row.lines || []).length > 0 && (
        <ul className="text-xs tabular-nums space-y-0.5">
          {row.lines.map((ln, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">{ln.coa_label || ln.coa_id}</span>
              <span>{ln.dr ? `Dr ${fmtRp(ln.dr)}` : `Cr ${fmtRp(ln.cr)}`}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AIReconPanel({ sessionId, open, onOpenChange, onApplied }) {
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("usulan");
  const [picked, setPicked] = useState(() => new Set());

  const analyze = async () => {
    setBusy(true); setRes(null);
    try {
      const r = unwrap(await api.post(`/ai/finance/recon/${sessionId}/analyze`, { use_ai: true }));
      setRes(r);
      setPicked(new Set(r.rows.filter((x) => x.status === "usulan" && (x.confidence ?? 0) >= 0.8).map((x) => x.row_id)));
      setFilter(r.ringkasan.usulan ? "usulan" : "belum");
    } catch (e) { toast.error(unwrapError(e)); } finally { setBusy(false); }
  };
  useEffect(() => { if (open && sessionId) analyze(); }, [open, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = async () => {
    setBusy(true);
    try {
      const out = unwrap(await api.post(`/ai/finance/recon/${sessionId}/apply`, { row_ids: [...picked], analysis_id: res.analysis_id }));
      if (out.posted.length) toast.success(`${out.posted.length} jurnal penyesuaian dibukukan & mutasi ditandai cocok`);
      if (out.failed.length) toast.error(`${out.failed.length} gagal: ${out.failed[0].error}`);
      onApplied?.();
      // perbarui lokal (tanpa analisis ulang → tidak ada biaya AI tambahan)
      const done = Object.fromEntries(out.posted.map((x) => [x.row_id, x.journal]));
      setRes((cur) => {
        const rowsNew = cur.rows.map((r) => (done[r.row_id] ? { ...r, status: "cocok", match: done[r.row_id] } : r));
        const n = (st) => rowsNew.filter((r) => r.status === st).length;
        const ring = { baris: rowsNew.length, sudah_cocok: n("cocok"), usulan: n("usulan"), belum: n("belum") };
        ring.persen_tertangani = rowsNew.length ? Math.round(((ring.sudah_cocok + ring.usulan) / rowsNew.length) * 1000) / 10 : 0;
        return { ...cur, rows: rowsNew, ringkasan: ring };
      });
      setPicked(new Set());
    } catch (e) { toast.error(unwrapError(e)); } finally { setBusy(false); }
  };

  const rows = useMemo(() => (res?.rows || []).filter((r) => filter === "all" || r.status === filter), [res, filter]);
  const toggle = (id) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const s = res?.ringkasan || {};
  const cols = [
    { key: "pick", label: "", render: (r) => (r.status === "usulan"
      ? <Checkbox checked={picked.has(r.row_id)} onCheckedChange={() => toggle(r.row_id)} onClick={(e) => e.stopPropagation()}
          aria-label={`Pilih ${r.description}`} data-testid={`br-ai-pick-${r.row_id}`} />
      : null) },
    { key: "date", label: "Tanggal", render: (r) => fmtDate(r.date) },
    { key: "description", label: "Keterangan", primary: true, render: (r) => <span className="line-clamp-2">{r.description}</span> },
    { key: "amount", label: "Nominal", numeric: true, render: (r) => fmtRp(r.amount) },
    { key: "kind", label: "Jenis", hideOnMobile: true, render: (r) => r.kind_label || humanize(r.ai?.jenis) || (r.status === "cocok" ? r.match || "—" : "—") },
    { key: "confidence", label: "Yakin", numeric: true, hideOnMobile: true, render: (r) => (r.confidence != null ? `${Math.round(r.confidence * 100)}%` : "—") },
    { key: "status", label: "Status", render: (r) => <StatusPill status={STATUS[r.status][0]} label={STATUS[r.status][1]} /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto" data-testid="br-ai-dialog">
        <DialogHeader>
          <DialogTitle>Analisis AI rekonsiliasi</DialogTitle>
          <DialogDescription>Usulan pencocokan & jurnal penyesuaian (komisi platform, MDR, biaya/bunga bank). Tidak ada yang dibukukan sebelum Anda setujui.</DialogDescription>
        </DialogHeader>
        {!res ? (
          <p className="text-sm text-muted-foreground py-6 text-center">{busy ? "Menganalisis mutasi…" : "—"}</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <CompactStatCard label="Baris" value={s.baris} />
              <CompactStatCard label="Sudah cocok" value={s.sudah_cocok} tone="success" />
              <CompactStatCard label="Usulan" value={s.usulan} tone="info" />
              <CompactStatCard label="Tertangani" value={`${s.persen_tertangani}%`} sub={`${s.belum} belum`} tone={s.belum ? "warning" : "success"} />
            </div>
            <SegmentedFilter value={filter} onChange={setFilter} ariaLabel="Filter status"
              options={[{ value: "usulan", label: `Usulan (${s.usulan})` }, { value: "belum", label: `Belum (${s.belum})` },
                { value: "cocok", label: `Cocok (${s.sudah_cocok})` }, { value: "all", label: "Semua" }]} />
            <DataTable columns={cols} rows={rows} keyField="row_id" rowTestIdPrefix="br-ai-row" loading={busy && !res} renderExpanded={(r) => <Lines row={r} />}
              empty={<EmptyState icon={Sparkles} title="Tidak ada baris" description="Tidak ada mutasi pada filter ini." />} />
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
          <Button onClick={apply} disabled={busy || !picked.size} data-testid="br-ai-apply">
            {busy && res ? "Membukukan…" : `Bukukan ${picked.size} usulan`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
