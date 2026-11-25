/** Saran restock: item di bawah par level → draf PR per toko (harga & supplier dari penawaran termurah di wilayah toko)
 * dan saran PO per supplier. Backend: GET /ai/purchasing/restock, POST /procurement/prs (status draft). */
import { useEffect, useState } from "react";
import { PackageSearch } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DataTable from "@/components/shared/DataTable";
import CompactStatCard from "@/components/shared/CompactStatCard";
import EmptyState from "@/components/shared/EmptyState";
import api, { unwrap, unwrapError } from "@/lib/api";
import { fmtRp } from "@/lib/format";

export default function RestockAIDialog({ open, onOpenChange, outletId, onCreated }) {
  const [data, setData] = useState(null);
  const [done, setDone] = useState({});
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!open) return;
    setData(null); setDone({});
    api.get("/ai/purchasing/restock", { params: outletId ? { outlet_id: outletId } : {} })
      .then((r) => setData(unwrap(r))).catch((e) => { toast.error(unwrapError(e)); setData({ ringkasan: {}, pr_drafts: [] }); });
  }, [open, outletId]);

  const create = async (pr) => {
    setBusy(pr.outlet_id);
    try {
      const { outlet, ...body } = pr;
      const res = unwrap(await api.post("/procurement/prs", { ...body, status: "draft", source: "manual" }));
      setDone((d) => ({ ...d, [pr.outlet_id]: res.doc_no })); toast.success(`PR ${res.doc_no} dibuat (draft)`); onCreated?.();
    } catch (e) { toast.error(unwrapError(e)); } finally { setBusy(""); }
  };
  const s = data?.ringkasan || {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="restock-ai-dialog">
        <DialogHeader>
          <DialogTitle>Saran restock</DialogTitle>
          <DialogDescription>Item yang stoknya di bawah par level, dengan supplier & harga dari penawaran termurah. PR dibuat sebagai draft untuk Anda cek.</DialogDescription>
        </DialogHeader>
        {!data ? <p className="text-sm text-muted-foreground py-6 text-center">Menghitung…</p> : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <CompactStatCard label="Item di bawah par" value={s.item_di_bawah_par ?? 0} tone={s.item_di_bawah_par ? "warning" : "success"} />
              <CompactStatCard label="Toko" value={s.toko ?? 0} />
              <CompactStatCard label="Supplier" value={s.supplier ?? 0} />
              <CompactStatCard label="Estimasi" value={fmtRp(s.estimasi_total || 0)} />
            </div>
            {!data.pr_drafts.length && <EmptyState icon={PackageSearch} title="Stok aman" description="Tidak ada item di bawah par level." />}
            <ul className="divide-y divide-border">
              {data.pr_drafts.map((pr) => (
                <li key={pr.outlet_id} className="py-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0 font-medium">{pr.outlet} <span className="text-xs text-muted-foreground">· {pr.lines.length} item · butuh {pr.needed_by}</span></div>
                    {done[pr.outlet_id]
                      ? <span className="text-sm text-emerald-700 dark:text-emerald-400">{done[pr.outlet_id]} dibuat</span>
                      : <Button size="sm" onClick={() => create(pr)} disabled={!!busy} data-testid={`restock-create-${pr.outlet_id}`}>{busy === pr.outlet_id ? "Membuat…" : "Buat PR draft"}</Button>}
                  </div>
                  <DataTable keyField="item_id" rows={pr.lines} rowTestIdPrefix="restock-line" loading={false}
                    empty={<p className="p-3 text-sm text-muted-foreground">—</p>}
                    columns={[
                      { key: "item_name", label: "Item", primary: true },
                      { key: "qty", label: "Qty", numeric: true, render: (l) => `${l.qty} ${l.unit || ""}` },
                      { key: "estimated_price", label: "Harga", numeric: true, render: (l) => (l.estimated_price ? fmtRp(l.estimated_price) : "—") },
                      { key: "notes", label: "Alasan", hideOnMobile: true, render: (l) => <span className="text-xs">{l.notes}</span> },
                    ]} />
                </li>
              ))}
            </ul>
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
