/** Sourcing › Penawaran supplier — daftar harga yang ditawarkan supplier (masa berlaku, MOQ, lead time, wilayah).
 *  Sumber: input manual, kontrak, RFQ (otomatis), atau impor CSV. */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Edit2, Plus, Tag, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import api, { unwrap, fetchAll } from "@/lib/api";
import { fmtDate, fmtRp } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import StatusPill from "@/components/shared/StatusPill";
import RowActions from "@/components/shared/RowActions";
import ListToolbar, { ListSearch, StatusTabs } from "@/components/shared/ListToolbar";
import { confirmDialog } from "@/components/shared/confirmDialog";
import { OfferDialog, RegionSelect, SOURCE_LABEL, useSourcingPerms } from "./shared";

const STATUS_TABS = [
  { key: "valid", label: "Berlaku" },
  { key: "upcoming", label: "Akan berlaku" },
  { key: "expired", label: "Kedaluwarsa" },
  { key: "all", label: "Semua" },
];
const CSV_HEADER = "kode_item,kode_supplier,harga,satuan,moq,lead_time_hari,berlaku_dari,berlaku_sampai,catatan";

export default function SupplierOffers() {
  const qc = useQueryClient();
  const { canOffers } = useSourcingPerms();
  const [status, setStatus] = useState("valid");
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("");
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const { data: offers = [], isLoading } = useQuery({
    queryKey: ["sourcing", "offers", status, region, search],
    queryFn: async () => unwrap(await api.get("/sourcing/offers", { params: {
      status: status === "all" ? undefined : status, region_id: region || undefined, search: search || undefined, per_page: 200 } })) || [],
  });

  const remove = async (o) => {
    if (!(await confirmDialog({ title: "Hapus penawaran?", description: `${o.vendor_name} · ${o.item_name} · ${fmtRp(o.price)}/${o.unit}`, confirmText: "Hapus", destructive: true }))) return;
    try {
      await api.delete(`/sourcing/offers/${o.id}`);
      toast.success("Penawaran dihapus");
      qc.invalidateQueries({ queryKey: ["sourcing"] });
    } catch (e) { toast.error(e?.response?.data?.errors?.[0]?.message || "Gagal menghapus"); }
  };

  const columns = [
    { key: "item_name", label: "Item", primary: true, sortable: true,
      render: (o) => <Link to={`/procurement/sourcing/items/${o.item_id}`} className="font-medium hover:underline" data-testid={`offer-item-link-${o.id}`}>{o.item_name}</Link> },
    { key: "vendor_name", label: "Supplier", sortable: true },
    { key: "price", label: "Harga", numeric: true, sortable: true, render: (o) => <span>{fmtRp(o.price)}<span className="text-xs text-muted-foreground">/{o.unit}</span></span> },
    { key: "min_order_qty", label: "MOQ · Lead time", hideOnMobile: true,
      render: (o) => <span className="whitespace-nowrap">{o.min_order_qty ? `MOQ ${o.min_order_qty}` : "Tanpa MOQ"} · {o.lead_time_days ? `${o.lead_time_days} hari` : "—"}</span> },
    { key: "valid_from", label: "Berlaku", sortable: true,
      render: (o) => (
        <div className="min-w-0">
          <div className="whitespace-nowrap">{fmtDate(o.valid_from)} – {o.valid_to ? fmtDate(o.valid_to) : "tanpa batas"}</div>
          <div className="text-xs text-muted-foreground truncate">{o.region_name} · {SOURCE_LABEL[o.source] || o.source}{o.source_ref ? ` ${o.source_ref}` : ""}</div>
        </div>
      ) },
    { key: "status", label: "Status", render: (o) => <StatusPill status={o.status} /> },
  ];

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="sourcing-offers">
      <PageHeader
        title="Penawaran supplier"
        subtitle="Harga yang ditawarkan supplier beserta masa berlakunya. Penawaran RFQ masuk otomatis."
        actions={canOffers ? (
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)} data-testid="offers-import"><Upload /> Impor CSV</Button>
            <Button onClick={() => { setEditing(null); setOpen(true); }} data-testid="offers-add"><Plus /> Tambah Penawaran</Button>
          </>
        ) : null}
      />
      <div className="glass-card overflow-hidden" data-testid="offers-table-card">
        <ListToolbar testId="offers-toolbar"
          search={<ListSearch value={search} onChange={setSearch} placeholder="Cari item / supplier…" testId="offers-search" />}>
          <StatusTabs value={status} onChange={setStatus} options={STATUS_TABS} ariaLabel="Status penawaran"
            testId="offers-status" tabTestId={(k) => `offers-status-${k}`} />
          <RegionSelect value={region} onChange={setRegion} testId="offers-region" />
        </ListToolbar>
        <DataTable columns={columns} rows={offers} keyField="id" loading={isLoading} rowTestIdPrefix="offer-row"
          defaultSort={{ key: "item_name", dir: "asc" }}
          rowAction={canOffers ? (o) => (
            <RowActions testId={`offer-actions-${o.id}`} promote={false} items={[
              { label: "Edit", icon: Edit2, onSelect: () => { setEditing(o); setOpen(true); }, testId: `offer-edit-${o.id}` },
              { label: "Hapus", icon: Trash2, destructive: true, onSelect: () => remove(o), testId: `offer-delete-${o.id}` },
            ]} />
          ) : undefined}
          empty={<EmptyState icon={Tag} title="Belum ada penawaran" description="Tambahkan penawaran, impor CSV, atau catat penawaran lewat RFQ." />}
        />
      </div>
      <OfferDialog open={open} onOpenChange={setOpen} initial={editing} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const sep = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
  const head = lines[0].toLowerCase().split(sep).map((h) => h.trim());
  return lines.slice(1).map((l) => {
    const cells = l.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    return Object.fromEntries(head.map((h, i) => [h, cells[i] ?? ""]));
  });
}

/** Impor CSV: kode item & kode supplier dipetakan ke master; baris gagal dilaporkan per nomor baris. */
function ImportDialog({ open, onOpenChange }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const { data: items = [] } = useQuery({ queryKey: ["master", "items", "all"], enabled: open,
    queryFn: async () => unwrap(await fetchAll("/master/items")) || [] });
  const { data: vendors = [] } = useQuery({ queryKey: ["master", "vendors", "picker"], enabled: open,
    queryFn: async () => unwrap(await fetchAll("/master/vendors", { active: true })) || [] });
  const rows = useMemo(() => parseCsv(text), [text]);
  const byCode = (list, code) => list.find((x) => (x.code || "").toLowerCase() === (code || "").toLowerCase());

  const template = () => {
    const blob = new Blob([`${CSV_HEADER}\nITM-002,VND-001,60500,kg,5,1,${new Date().toISOString().slice(0, 10)},,contoh\n`], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "template_penawaran_supplier.csv";
    a.click();
  };
  const submit = async () => {
    const mapped = rows.map((r) => ({
      item_id: byCode(items, r.kode_item)?.id, vendor_id: byCode(vendors, r.kode_supplier)?.id,
      price: Number(r.harga || 0), unit: r.satuan || undefined, min_order_qty: Number(r.moq || 0),
      lead_time_days: Number(r.lead_time_hari || 0), valid_from: r.berlaku_dari || undefined,
      valid_to: r.berlaku_sampai || null, notes: r.catatan || undefined, source: "import",
    }));
    setBusy(true);
    try {
      const res = unwrap(await api.post("/sourcing/offers/bulk", { rows: mapped }));
      setResult(res);
      qc.invalidateQueries({ queryKey: ["sourcing"] });
      if (!res.errors?.length) { toast.success(`${res.ok} penawaran diimpor`); onOpenChange(false); setText(""); }
    } catch (e) { toast.error(e?.response?.data?.errors?.[0]?.message || "Impor gagal"); }
    finally { setBusy(false); }
  };
  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (f) setText(await f.text());
  };
  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setResult(null); }}>
      <DialogContent className="max-w-2xl" data-testid="offers-import-dialog">
        <DialogHeader>
          <DialogTitle>Impor Penawaran (CSV)</DialogTitle>
          <DialogDescription>Kolom: {CSV_HEADER}. Kode item & supplier mengikuti master data.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={template} data-testid="offers-import-template"><Download /> Unduh template</Button>
            <input type="file" accept=".csv,text/csv" onChange={onFile} className="text-xs" aria-label="Pilih file CSV" data-testid="offers-import-file" />
          </div>
          <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={`${CSV_HEADER}\n…`}
            className="glass-input font-mono text-xs" data-testid="offers-import-text" />
          <p className="text-xs text-muted-foreground" data-testid="offers-import-count">{rows.length} baris terbaca</p>
          {result?.errors?.length > 0 && (
            <ul className="max-h-32 overflow-y-auto text-xs text-rose-700 dark:text-rose-400 space-y-0.5" data-testid="offers-import-errors">
              <li className="font-medium">{result.ok} tersimpan, {result.errors.length} gagal:</li>
              {result.errors.slice(0, 20).map((e) => <li key={e.row}>Baris {e.row}: {e.error}</li>)}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="offers-import-cancel">Batal</Button>
          <Button onClick={submit} disabled={!rows.length || busy} data-testid="offers-import-submit">Impor {rows.length || ""}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
