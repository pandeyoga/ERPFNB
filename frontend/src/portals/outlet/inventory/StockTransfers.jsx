/** Outlet Stock Transfers — inter-outlet transfer workflow (list/create/send/receive). */
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight, RefreshCw, Plus, Send, PackageCheck, Trash2, X, Store,
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
import { fmtRp, fmtDate, fmtNumber } from "@/lib/format";
import { toast } from "sonner";
import { useOutletScopeCtx } from "../OutletScopeContext";

const STATUS_META = {
  draft: { label: "Draft", tone: "bg-muted text-muted-foreground" },
  sent: { label: "Dikirim", tone: "bg-sky-500/15 text-sky-700 dark:text-sky-400" },
  received: { label: "Diterima", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  cancelled: { label: "Dibatalkan", tone: "bg-rose-500/15 text-rose-700 dark:text-rose-400" },
};

function StatusBadge({ s }) {
  const m = STATUS_META[s] || { label: s, tone: "bg-muted text-muted-foreground" };
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${m.tone}`}>{m.label}</span>;
}

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
      render: (r) => <span className="font-mono text-xs font-semibold">{r.doc_no}</span> },
    { key: "route", label: "Rute",
      render: (r) => (
        <span className="text-sm inline-flex items-center gap-1.5">
          {oname(r.from_outlet_id)} <ArrowLeftRight className="h-3 w-3 text-muted-foreground" /> {oname(r.to_outlet_id)}
        </span>
      ) },
    { key: "transfer_date", label: "Tanggal", render: (r) => fmtDate(r.transfer_date) },
    { key: "items", label: "Item", numeric: true,
      render: (r) => <span className="tabular-nums">{(r.lines || []).length}</span> },
    { key: "total_value", label: "Nilai", numeric: true,
      render: (r) => <span className="font-mono tabular-nums">{fmtRp(r.total_value || 0)}</span> },
    { key: "status", label: "Status", render: (r) => <StatusBadge s={r.status} /> },
  ];

  return (
    <div className="p-1 sm:p-2 space-y-5" data-testid="outlet-stock-transfers">
      <div className="glass-card p-5 lg:p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-xl font-bold mb-1 flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5" /> Stock Transfers
            </h1>
            <p className="text-sm text-muted-foreground">Transfer stok antar outlet — draft → kirim → terima</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} data-testid="transfers-refresh">
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
            <Button size="sm" className="pill-active gap-1" onClick={() => setCreateOpen(true)} data-testid="transfers-new">
              <Plus className="h-4 w-4" /> Transfer Baru
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="glass-card p-4" data-testid="transfers-kpi-total">
          <div className="text-xs text-muted-foreground">Total Transfer</div>
          <div className="text-2xl font-bold tabular-nums">{fmtNumber(kpis.total)}</div>
        </div>
        <div className="glass-card p-4" data-testid="transfers-kpi-transit">
          <div className="text-xs text-muted-foreground">Dalam Pengiriman</div>
          <div className="text-2xl font-bold tabular-nums text-sky-600 dark:text-sky-400">{fmtNumber(kpis.inTransit)}</div>
        </div>
        <div className="glass-card p-4 col-span-2 lg:col-span-1" data-testid="transfers-kpi-value">
          <div className="text-xs text-muted-foreground">Total Nilai Transfer</div>
          <div className="text-2xl font-bold tabular-nums">{fmtRp(kpis.value)}</div>
        </div>
      </div>

      <div className="glass-card p-3">
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${statusFilter === s ? "pill-active" : "glass-input hover:bg-foreground/5"}`}
              data-testid={`transfers-filter-${s}`}>
              {s === "all" ? "Semua" : (STATUS_META[s]?.label || s)}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card">
        <DataTable
          columns={columns}
          rows={filtered}
          keyField="_rk"
          loading={loading}
          onRowClick={(r) => setDetail(r)}
          empty={<EmptyState icon={ArrowLeftRight} title="Belum ada transfer"
            description="Buat transfer baru untuk memindahkan stok antar outlet." />}
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
                  <span className="font-mono text-sm">{detail.doc_no}</span>
                  <StatusBadge s={detail.status} />
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between p-3 rounded-lg glass-input">
                  <div><div className="text-xs text-muted-foreground">Dari</div><div className="font-medium">{oname(detail.from_outlet_id)}</div></div>
                  <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                  <div className="text-right"><div className="text-xs text-muted-foreground">Ke</div><div className="font-medium">{oname(detail.to_outlet_id)}</div></div>
                </div>
                <div className="text-xs text-muted-foreground">Tanggal: {fmtDate(detail.transfer_date)}</div>
                <div className="border rounded-lg divide-y divide-border/50">
                  {(detail.lines || []).map((ln, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 text-sm">
                      <span>{ln.item_name || ln.item_id}</span>
                      <span className="font-mono tabular-nums">{fmtNumber(ln.qty)} {ln.unit || ""} · {fmtRp(ln.total_cost || 0)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Total</span><span className="font-mono tabular-nums">{fmtRp(detail.total_value || 0)}</span>
                </div>
              </div>
              <DialogFooter className="gap-2">
                {detail.status === "draft" && (
                  <Button onClick={() => doAction(detail.id, "send")} disabled={busy} className="gap-1" data-testid="transfer-send">
                    <Send className="h-4 w-4" /> Kirim
                  </Button>
                )}
                {detail.status === "sent" && (
                  <Button onClick={() => doAction(detail.id, "receive")} disabled={busy} className="gap-1" data-testid="transfer-receive">
                    <PackageCheck className="h-4 w-4" /> Terima
                  </Button>
                )}
                <Button variant="outline" onClick={() => setDetail(null)}>Tutup</Button>
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
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Dari Outlet</label>
              <Select value={fromId} onValueChange={setFromId}>
                <SelectTrigger className="glass-input" data-testid="transfer-from"><SelectValue placeholder="Pilih…" /></SelectTrigger>
                <SelectContent>{outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Ke Outlet</label>
              <Select value={toId} onValueChange={setToId}>
                <SelectTrigger className="glass-input" data-testid="transfer-to"><SelectValue placeholder="Pilih…" /></SelectTrigger>
                <SelectContent>{outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">Item</label>
              <Button type="button" variant="ghost" size="sm" onClick={addLine} className="h-7 gap-1 text-xs"><Plus className="h-3 w-3" /> Tambah</Button>
            </div>
            {lines.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select value={l.item_id} onValueChange={(v) => setLine(i, { item_id: v })}>
                  <SelectTrigger className="glass-input flex-1" data-testid={`transfer-item-${i}`}><SelectValue placeholder="Pilih item…" /></SelectTrigger>
                  <SelectContent>{items.map((it) => <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="number" min="1" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })}
                  className="glass-input w-20" data-testid={`transfer-qty-${i}`} />
                {lines.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => rmLine(i)}>
                    <Trash2 className="h-4 w-4 text-rose-500" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={submit} disabled={busy} className="pill-active" data-testid="transfer-create-submit">Buat Transfer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
