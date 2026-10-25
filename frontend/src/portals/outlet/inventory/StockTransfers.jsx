/** Outlet Stock Transfers — inter-outlet transfer workflow (list/create/send/receive). */
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight, ArrowRight, RefreshCw, Plus, Send, PackageCheck, Trash2, Truck, Wallet,
} from "lucide-react";
import api, { unwrap, unwrapError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import StatusPill from "@/components/shared/StatusPill";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtRp, fmtDate, fmtNumber } from "@/lib/format";
import { toast } from "sonner";
import { useOutletScopeCtx } from "../OutletScopeContext";

// Label tab filter = label kamus StatusPill (satu kamus status untuk seluruh aplikasi).
const STATUS_META = {
  draft: { label: "Draft" },
  sent: { label: "Terkirim" },
  received: { label: "Diterima" },
  cancelled: { label: "Dibatalkan" },
};

export default function StockTransfers() {
  const { scopedOutlets, outletId } = useOutletScopeCtx();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [detail, setDetail] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const outletMap = useMemo(
    () => Object.fromEntries(scopedOutlets.map((o) => [o.id, o])), [scopedOutlets]);
  const oname = (id) => outletMap[id]?.name || "—";

  async function load() {
    setLoading(true);
    try {
      const params = { per_page: 100 };
      if (outletId) params.outlet_id = outletId;
      const res = await api.get("/inventory/transfers", { params });
      setRows((unwrap(res) || []).map((r) => ({ ...r, _rk: r.id })));
    } catch (e) {
      toast.error("Gagal memuat transfers");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [outletId]);

  const filtered = useMemo(
    () => (statusFilter === "all" ? rows : rows.filter((r) => r.status === statusFilter)),
    [rows, statusFilter]);

  const kpis = useMemo(() => ({
    total: rows.length,
    inTransit: rows.filter((r) => r.status === "sent").length,
    value: rows.reduce((s, r) => s + (Number(r.total_value) || 0), 0),
  }), [rows]);

  async function doAction(id, action) {
    setBusy(true);
    try {
      await api.post(`/inventory/transfers/${id}/${action}`);
      toast.success(action === "send" ? "Transfer dikirim" : "Transfer diterima");
      setDetail(null);
      await load();
    } catch (e) {
      toast.error(unwrapError(e));
    } finally {
      setBusy(false);
    }
  }

  const statuses = ["all", "draft", "sent", "received"];
  const columns = [
    { key: "doc_no", label: "No. Transfer", primary: true,
      render: (r) => <span className="text-xs font-medium tabular-nums">{r.doc_no}</span> },
    { key: "route", label: "Rute",
      render: (r) => (
        <span className="text-sm inline-flex items-center gap-1.5">
          {oname(r.from_outlet_id)} <ArrowRight className="h-3 w-3 text-muted-foreground" aria-label="ke" /> {oname(r.to_outlet_id)}
        </span>
      ) },
    { key: "transfer_date", label: "Tanggal", render: (r) => fmtDate(r.transfer_date) },
    { key: "items", label: "Item", numeric: true,
      render: (r) => <span className="tabular-nums">{(r.lines || []).length}</span> },
    { key: "total_value", label: "Nilai", numeric: true,
      render: (r) => <span className="tabular-nums">{fmtRp(r.total_value || 0)}</span> },
    { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
  ];

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="outlet-stock-transfers">
      <PageHeader
        icon={ArrowLeftRight}
        title="Stock Transfers"
        subtitle="Transfer stok antar outlet — draft → kirim → terima. Klik baris untuk detail & aksi."
        className="mb-0 md:mb-0"
        actions={
          <>
            <Button variant="outline" onClick={load} data-testid="transfers-refresh">
              <RefreshCw className="h-4 w-4" /> Muat ulang
            </Button>
            <Button onClick={() => setCreateOpen(true)} data-testid="transfers-new">
              <Plus className="h-4 w-4" /> Transfer Baru
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <CompactStatCard label="Total Transfer" value={fmtNumber(kpis.total)} icon={ArrowLeftRight} color="aurora-1" loading={loading} testId="transfers-kpi-total" />
        <CompactStatCard label="Dalam Pengiriman" value={fmtNumber(kpis.inTransit)} icon={Truck} color="aurora-4" tone={kpis.inTransit > 0 ? "info" : "default"} loading={loading} testId="transfers-kpi-transit" />
        <CompactStatCard label="Total Nilai Transfer" value={fmtRp(kpis.value)} icon={Wallet} color="aurora-3" loading={loading} testId="transfers-kpi-value" className="col-span-2 lg:col-span-1" />
      </div>

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList aria-label="Filter status">
          {statuses.map((s) => (
            <TabsTrigger key={s} value={s} data-testid={`transfers-filter-${s}`}>
              {s === "all" ? "Semua" : (STATUS_META[s]?.label || s)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="glass-card">
        <DataTable
          columns={columns}
          rows={filtered}
          keyField="_rk"
          loading={loading}
          onRowClick={(r) => setDetail(r)}
          empty={<EmptyState icon={ArrowLeftRight} title={statusFilter === "all" ? "Belum ada transfer" : "Tidak ada transfer dengan status ini"}
            description="Buat transfer baru untuk memindahkan stok antar outlet."
            action={<Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>Transfer Baru</Button>} />}
          rowTestIdPrefix="transfers-row"
        />
      </div>

      {/* Detail dialog with workflow actions */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="tabular-nums">{detail.doc_no}</span>
                  <StatusPill status={detail.status} />
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between p-3 rounded-lg glass-input">
                  <div><div className="text-xs text-muted-foreground">Dari</div><div className="font-medium">{oname(detail.from_outlet_id)}</div></div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <div className="text-right"><div className="text-xs text-muted-foreground">Ke</div><div className="font-medium">{oname(detail.to_outlet_id)}</div></div>
                </div>
                <div className="text-xs text-muted-foreground">Tanggal: {fmtDate(detail.transfer_date)}</div>
                <div className="border rounded-lg divide-y divide-border/50">
                  {(detail.lines || []).map((ln, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 text-sm">
                      <span>{ln.item_name || ln.item_id}</span>
                      <span className="tabular-nums">{fmtNumber(ln.qty)} {ln.unit || ""} · {fmtRp(ln.total_cost || 0)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Total</span><span className="tabular-nums">{fmtRp(detail.total_value || 0)}</span>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setDetail(null)}>Tutup</Button>
                {detail.status === "draft" && (
                  <Button onClick={() => doAction(detail.id, "send")} disabled={busy} data-testid="transfer-send">
                    <Send className="h-4 w-4" /> Kirim
                  </Button>
                )}
                {detail.status === "sent" && (
                  <Button onClick={() => doAction(detail.id, "receive")} disabled={busy} data-testid="transfer-receive">
                    <PackageCheck className="h-4 w-4" /> Terima
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <CreateTransferDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        outlets={scopedOutlets}
        onCreated={() => { setCreateOpen(false); load(); }}
      />
    </div>
  );
}

function CreateTransferDialog({ open, onClose, outlets, onCreated }) {
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [items, setItems] = useState([]);
  const [lines, setLines] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFromId(""); setToId(""); setLines([{ item_id: "", qty: 1, unit_cost: 0 }]);
    (async () => {
      try {
        const res = await api.get("/inventory/balance", { params: { per_page: 500 } });
        const seen = new Map();
        (unwrap(res) || []).forEach((b) => {
          if (b.item_id && !seen.has(b.item_id)) seen.set(b.item_id, { id: b.item_id, name: b.item_name, unit: b.unit, cost: b.last_unit_cost });
        });
        setItems([...seen.values()]);
      } catch { /* ignore */ }
    })();
  }, [open]);

  const setLine = (i, patch) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, { item_id: "", qty: 1, unit_cost: 0 }]);
  const rmLine = (i) => setLines((ls) => ls.filter((_, idx) => idx !== i));

  async function submit() {
    if (!fromId || !toId) return toast.error("Pilih outlet asal & tujuan");
    if (fromId === toId) return toast.error("Outlet asal & tujuan harus berbeda");
    const valid = lines.filter((l) => l.item_id && Number(l.qty) > 0);
    if (!valid.length) return toast.error("Tambahkan minimal 1 item");
    setBusy(true);
    try {
      const payload = {
        from_outlet_id: fromId, to_outlet_id: toId,
        lines: valid.map((l) => {
          const it = items.find((x) => x.id === l.item_id);
          return { item_id: l.item_id, item_name: it?.name, qty: Number(l.qty), unit: it?.unit, unit_cost: Number(it?.cost || 0) };
        }),
      };
      await api.post("/inventory/transfers", payload);
      toast.success("Transfer dibuat (draft)");
      onCreated();
    } catch (e) {
      toast.error(unwrapError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" data-testid="transfer-create-dialog">
        <DialogHeader><DialogTitle>Transfer Baru</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground -mt-1">Transfer dibuat sebagai draft; kirim dari detail transfer setelah dicek.</p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="transfer-from-trigger" className="text-xs md:text-sm font-medium mb-1 block">Dari outlet *</Label>
              <Select value={fromId} onValueChange={setFromId}>
                <SelectTrigger id="transfer-from-trigger" className="glass-input" data-testid="transfer-from"><SelectValue placeholder="Pilih…" /></SelectTrigger>
                <SelectContent>{outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="transfer-to-trigger" className="text-xs md:text-sm font-medium mb-1 block">Ke outlet *</Label>
              <Select value={toId} onValueChange={setToId}>
                <SelectTrigger id="transfer-to-trigger" className="glass-input" data-testid="transfer-to"><SelectValue placeholder="Pilih…" /></SelectTrigger>
                <SelectContent>{outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs md:text-sm font-medium">Item *</span>
              <Button type="button" variant="outline" size="sm" onClick={addLine} data-testid="transfer-add-line"><Plus className="h-3.5 w-3.5" /> Tambah</Button>
            </div>
            {lines.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select value={l.item_id} onValueChange={(v) => setLine(i, { item_id: v })}>
                  <SelectTrigger className="glass-input flex-1" aria-label={`Item ${i + 1}`} data-testid={`transfer-item-${i}`}><SelectValue placeholder="Pilih item…" /></SelectTrigger>
                  <SelectContent>{items.map((it) => <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="number" min="1" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })}
                  className="glass-input w-20" aria-label={`Qty item ${i + 1}`} data-testid={`transfer-qty-${i}`} />
                {lines.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => rmLine(i)} aria-label={`Hapus item ${i + 1}`}>
                    <Trash2 className="h-4 w-4 text-rose-500" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={submit} disabled={busy} data-testid="transfer-create-submit">Buat Transfer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
