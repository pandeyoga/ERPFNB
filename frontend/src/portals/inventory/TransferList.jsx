/** Transfer List + create + send/receive actions. */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Truck, Send, Inbox, Trash2, Eye } from "lucide-react";
import api from "@/lib/api";
import { usePaginatedList } from "@/hooks/useListQuery";
import { Button } from "@/components/ui/button";
import AsyncButton from "@/components/shared/AsyncButton";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { InlineHelp } from "@/components/shared/InlineHelp";
import StatusPill from "@/components/shared/StatusPill";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import ItemAutocomplete from "@/components/shared/ItemAutocomplete";
import { fmtRp, fmtDate, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import useOutletScope from "@/hooks/useOutletScope";
import { confirmDialog } from "@/components/shared/confirmDialog";
import ListHeader from "./ListHeader";

/** `embedded` = dirender sebagai tab di Stock Movements hub (tanpa <h1> sendiri). */
export default function TransferList({ embedded = false }) {
  const { can } = useAuth();
  const { outletId, setOutletId, scopedOutlets, allOutlets, isFullAccess, currentOutlet } = useOutletScope();
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);

  const filters = useMemo(() => {
    const f = {};
    if (outletId) f.outlet_id = outletId;
    return f;
  }, [outletId]);

  const { data, isLoading: loading, refetch } = usePaginatedList("/inventory/transfers", filters, page, 20);
  const items = data?.data || [];
  const meta = data?.meta || { total: 0, per_page: 20 };

  const outletMap = useMemo(
    () => Object.fromEntries(allOutlets.map(o => [o.id, o])),
    [allOutlets],
  );

  // Reset page when outlet scope changes
  useEffect(() => { setPage(1); }, [outletId]);

  async function send(t) {
    if (!(await confirmDialog("Kirim transfer? Stock akan dikurangi dari outlet asal."))) return;
    try {
      await api.post(`/inventory/transfers/${t.id}/send`);
      toast.success("Transfer dikirim"); refetch();
    } catch (e) { toast.error(e.response?.data?.errors?.[0]?.message || "Gagal mengirim transfer"); }
  }
  async function receive(t) {
    if (!(await confirmDialog("Konfirmasi penerimaan? Stock akan masuk ke outlet tujuan."))) return;
    try {
      await api.post(`/inventory/transfers/${t.id}/receive`);
      toast.success("Transfer diterima"); refetch();
    } catch (e) { toast.error(e.response?.data?.errors?.[0]?.message || "Gagal menerima transfer"); }
  }

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.per_page || 20)));

  return (
    <div data-testid="transfer-list-page" className="space-y-3 lg:space-y-4">
      <div data-testid="trf-header-card">
        <ListHeader
          embedded={embedded}
          icon={Truck}
          title="Stock Transfers"
          subtitle={`${outletId && currentOutlet ? `Outlet: ${currentOutlet.name}` : "Semua outlet"} — pindahkan stok antar outlet.`}
          actions={
            <>
              {/* Outlet scope switcher */}
              {scopedOutlets.length > 1 && (
                <SimpleSelect
                  value={outletId}
                  onValueChange={setOutletId}
                  options={[...(isFullAccess ? [{ value: "", label: "Semua outlet" }] : []), ...scopedOutlets.map(o => ({ value: o.id, label: o.name }))]}
                  placeholder="Semua outlet"
                  className="glass-input w-44"
                  testId="trf-outlet-filter"
                  ariaLabel="Filter outlet"
                />
              )}
              <Button onClick={() => setShowForm(true)} data-testid="trf-new" disabled={!can("inventory.transfer.create")}>
                <Plus /> Buat Transfer
              </Button>
            </>
          }
        />
      </div>

      <div data-testid="trf-table-card" className="glass-card overflow-hidden">
        <DataTable
          columns={[
            { key: "doc_no", label: "Doc No", primary: true, sortable: true,
              render: t => <span className="font-medium tabular-nums">{t.doc_no || t.id.slice(0, 8)}</span> },
            { key: "transfer_date", label: "Tanggal", sortable: true, render: t => fmtDate(t.transfer_date) },
            { key: "from", label: "Dari", render: t => outletMap[t.from_outlet_id]?.name || t.from_outlet_id },
            { key: "to", label: "Ke", render: t => outletMap[t.to_outlet_id]?.name || t.to_outlet_id },
            { key: "lines", label: "Lines", numeric: true, sortable: true, sortAccessor: t => t.lines?.length || 0, render: t => t.lines?.length || 0 },
            { key: "total_value", label: "Nilai Total", numeric: true, sortable: true, render: t => <span className="font-semibold">{fmtRp(t.total_value || 0)}</span> },
            { key: "status",
              label: <span className="inline-flex items-center gap-1.5">Status <InlineHelp id="transfer-status" size="xs" placement="top" /></span>,
              render: t => <StatusPill status={t.status} /> },
          ]}
          rows={items}
          loading={loading}
          rowTestIdPrefix="trf-row"
          defaultSort={{ key: "transfer_date", dir: "desc" }}
          renderExpanded={(t) => <TransferLines t={t} />}
          empty={<EmptyState icon={Truck} title="Belum ada transfer" description="Buat transfer untuk memindah stok antar outlet." />}
          rowAction={(t) => (
            <div className="inline-flex items-center gap-1.5">
              {t.status === "draft" && can("inventory.transfer.send") && (
                <AsyncButton onClick={async (e) => { e.stopPropagation(); await send(t); }} size="sm" busyText="Mengirim…" data-testid={`trf-send-${t.id}`}>
                  <Send /> Kirim
                </AsyncButton>
              )}
              {t.status === "sent" && can("inventory.transfer.receive") && (
                <AsyncButton onClick={async (e) => { e.stopPropagation(); await receive(t); }} size="sm" busyText="Menerima…" data-testid={`trf-receive-${t.id}`}>
                  <Inbox /> Terima
                </AsyncButton>
              )}
              {/* Satu-satunya jalan ke halaman detail transfer (sebelumnya tidak ada link sama sekali). */}
              <Button asChild variant="ghost" size="icon-sm" aria-label={`Lihat detail ${t.doc_no || "transfer"}`} title="Lihat detail">
                <Link to={`/inventory/transfers/${t.id}`} onClick={(e) => e.stopPropagation()} data-testid={`trf-view-${t.id}`}>
                  <Eye />
                </Link>
              </Button>
            </div>
          )}
        />
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-border/50 flex items-center justify-between gap-2 text-xs text-muted-foreground" data-testid="trf-pagination">
            <span>Total: {meta.total}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} data-testid="trf-prev">Sebelumnya</Button>
              <span className="tabular-nums">{page}/{totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} data-testid="trf-next">Berikutnya</Button>
            </div>
          </div>
        )}
      </div>

      <TransferForm
        open={showForm}
        fromOutlets={scopedOutlets}
        toOutlets={allOutlets}
        defaultFromOutletId={outletId}
        onClose={() => setShowForm(false)}
        onSaved={() => { setShowForm(false); refetch(); }}
      />
    </div>
  );
}

function TransferLines({ t }) {
  const lines = t.lines || [];
  if (!lines.length) return <p className="text-sm text-muted-foreground">Tidak ada item.</p>;
  return (
    <div className="space-y-2" data-testid={`trf-lines-${t.id}`}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Item ({lines.length})</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 pr-3 font-medium">Item</th>
              <th className="py-1 pr-3 font-medium text-right">Qty</th>
              <th className="py-1 pr-3 font-medium">Unit</th>
              <th className="py-1 pr-3 font-medium text-right">Harga</th>
              <th className="py-1 pr-3 font-medium text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-t border-border/30">
                <td className="py-1.5 pr-3 font-medium">{l.item_name}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{l.qty}</td>
                <td className="py-1.5 pr-3 text-muted-foreground">{l.unit}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{fmtRp(l.unit_cost || 0)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums font-medium">{fmtRp(Number(l.qty || 0) * Number(l.unit_cost || 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TransferForm({ open, fromOutlets, toOutlets, defaultFromOutletId, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) {
      setForm({
        ...emptyForm(),
        transfer_date: todayJakartaISO(),
        // Pre-fill from_outlet_id with scope context
        from_outlet_id: defaultFromOutletId || fromOutlets?.[0]?.id || "",
      });
    }
  }, [open, defaultFromOutletId, fromOutlets]);
  if (!open) return null;

  function setLine(i, key, val) {
    setForm(f => {
      const lines = [...f.lines];
      lines[i] = { ...lines[i], [key]: val };
      return { ...f, lines };
    });
  }
  function addLine() {
    setForm(f => ({ ...f, lines: [...f.lines, { item_name: "", item_id: null, qty: 1, unit: "pcs", unit_cost: 0 }] }));
  }
  function removeLine(i) {
    setForm(f => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }));
  }

  const total = form.lines.reduce((s, l) => s + Number(l.qty || 0) * Number(l.unit_cost || 0), 0);

  const submit = async () => {
    if (!form.from_outlet_id || !form.to_outlet_id) { toast.error("Outlet asal & tujuan wajib"); return; }
    if (form.from_outlet_id === form.to_outlet_id) { toast.error("Outlet asal & tujuan harus berbeda"); return; }
    if (form.lines.some(l => !l.item_name || !l.qty)) { toast.error("Lengkapi line items"); return; }
    setSaving(true);
    try {
      await api.post("/inventory/transfers", {
        from_outlet_id: form.from_outlet_id,
        to_outlet_id: form.to_outlet_id,
        transfer_date: form.transfer_date,
        lines: form.lines.map(l => ({
          item_id: l.item_id, item_name: l.item_name,
          qty: Number(l.qty), unit: l.unit,
          unit_cost: Number(l.unit_cost || 0),
        })),
        notes: form.notes,
      });
      toast.success("Transfer dibuat");
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal menyimpan transfer");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="trf-form-dialog" className="glass-card max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transfer Baru</DialogTitle>
          <DialogDescription>Status awal akan draft. Klik Kirim untuk mengurangi stok asal.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs md:text-sm font-medium">Dari outlet <span className="text-destructive">*</span></Label>
            <SimpleSelect
              value={form.from_outlet_id}
              onValueChange={v => setForm(f => ({ ...f, from_outlet_id: v }))}
              options={[{ value: "", label: "Pilih outlet asal" }, ...fromOutlets.map(o => ({ value: o.id, label: o.name }))]}
              placeholder="Pilih outlet asal"
              className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1"
              testId="trf-from"
              ariaLabel="Dari outlet"
            />
          </div>
          <div>
            <Label className="text-xs md:text-sm font-medium">Ke outlet <span className="text-destructive">*</span></Label>
            <SimpleSelect
              value={form.to_outlet_id}
              onValueChange={v => setForm(f => ({ ...f, to_outlet_id: v }))}
              options={[{ value: "", label: "Pilih outlet tujuan" }, ...(toOutlets || fromOutlets).filter(o => o.id !== form.from_outlet_id).map(o => ({ value: o.id, label: o.name }))]}
              placeholder="Pilih outlet tujuan"
              className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1"
              testId="trf-to"
              ariaLabel="Ke outlet"
            />
          </div>
          <div>
            <Label htmlFor="trf-date" className="text-xs md:text-sm font-medium">Tanggal <span className="text-destructive">*</span></Label>
            <Input id="trf-date" type="date" value={form.transfer_date}
              onChange={e => setForm(f => ({ ...f, transfer_date: e.target.value }))}
              className="glass-input mt-1" data-testid="trf-date" />
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Item</h3>
            <Button onClick={addLine} variant="outline" size="sm" data-testid="trf-add-line">
              <Plus /> Tambah baris
            </Button>
          </div>
          {form.lines.map((ln, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center mb-2">
              <div className="col-span-5">
                <ItemAutocomplete
                  value={ln.item_name}
                  onChange={v => setLine(i, "item_name", v)}
                  onSelect={(it) => {
                    setForm(f => {
                      const lines = [...f.lines];
                      lines[i] = { ...lines[i], item_name: it.name, item_id: it.id, unit: it.unit || lines[i].unit, unit_cost: it.last_price ?? lines[i].unit_cost };
                      return { ...f, lines };
                    });
                  }}
                  dataTestId={`trf-line-item-${i}`}
                />
              </div>
              <Input type="number" min="0" value={ln.qty}
                onChange={e => setLine(i, "qty", e.target.value)}
                className="glass-input col-span-2 text-right tabular-nums"
                placeholder="Qty" aria-label={`Qty baris ${i + 1}`} data-testid={`trf-line-qty-${i}`} />
              <Input value={ln.unit} onChange={e => setLine(i, "unit", e.target.value)} className="glass-input col-span-1" placeholder="Unit" aria-label={`Unit baris ${i + 1}`} />
              <Input type="number" min="0" value={ln.unit_cost}
                onChange={e => setLine(i, "unit_cost", e.target.value)}
                className="glass-input col-span-2 text-right tabular-nums" placeholder="Harga" aria-label={`Harga satuan baris ${i + 1}`} />
              <div className="col-span-1 text-right text-xs tabular-nums">{fmtRp(Number(ln.qty || 0) * Number(ln.unit_cost || 0))}</div>
              <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(i)} disabled={form.lines.length <= 1}
                className="col-span-1 hover:bg-destructive/10 hover:text-destructive" aria-label={`Hapus baris ${i + 1}`} data-testid={`trf-line-remove-${i}`}>
                <Trash2 />
              </Button>
            </div>
          ))}
          <div className="flex justify-between pt-2 border-t border-border/50 text-sm font-semibold">
            <span>Total nilai</span>
            <span className="tabular-nums">{fmtRp(total)}</span>
          </div>
        </div>

        <div>
          <Label htmlFor="trf-notes" className="text-xs md:text-sm font-medium">Catatan</Label>
          <Textarea id="trf-notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="glass-input mt-1 min-h-[60px]" />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={submit} disabled={saving} data-testid="trf-save">{saving ? "Menyimpan…" : "Simpan draft"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function emptyForm() {
  return {
    from_outlet_id: "", to_outlet_id: "",
    transfer_date: todayJakartaISO(),
    lines: [{ item_name: "", item_id: null, qty: 1, unit: "pcs", unit_cost: 0 }],
    notes: "",
  };
}
