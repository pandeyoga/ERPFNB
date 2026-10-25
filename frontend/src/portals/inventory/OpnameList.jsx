/** Opname List — list sessions + start new (per outlet, snapshot system stock). */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, ClipboardCheck, Eye } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
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
import { fmtRp, fmtDate, fmtNumber, todayJakartaISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import useOutletScope from "@/hooks/useOutletScope";
import PageHeader from "@/components/shared/PageHeader";

export default function OpnameList() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const { outletId, setOutletId, scopedOutlets, allOutlets, isFullAccess, currentOutlet } = useOutletScope();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showStart, setShowStart] = useState(false);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, per_page: 20 });

  const outletMap = useMemo(
    () => Object.fromEntries(allOutlets.map(o => [o.id, o])),
    [allOutlets],
  );

  async function load() {
    setLoading(true);
    try {
      const params = { page, per_page: 20 };
      if (outletId) params.outlet_id = outletId;
      const res = await api.get("/inventory/opname", { params });
      setItems(unwrap(res) || []);
      setMeta(res.data?.meta || {});
    } catch (e) { toast.error("Gagal memuat sesi opname"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [page, outletId]); // eslint-disable-line
  // Reset page when outlet scope changes
  useEffect(() => { setPage(1); }, [outletId]);

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.per_page || 20)));

  return (
    <div data-testid="opname-list-page" className="space-y-3 lg:space-y-4">
      <div data-testid="opn-header-card">
        <PageHeader
          icon={ClipboardCheck}
          title="Stock Opname"
          subtitle={`${outletId && currentOutlet ? `Outlet: ${currentOutlet.name}` : "Semua outlet"} — hitung stok fisik dan bandingkan dengan stok sistem.`}
          className="mb-0 md:mb-0"
          actions={
            <>
              {/* Outlet switcher for full-access or multi-outlet users */}
              {scopedOutlets.length > 1 && (
                <SimpleSelect
                  value={outletId}
                  onValueChange={setOutletId}
                  options={[...(isFullAccess ? [{ value: "", label: "Semua outlet" }] : []), ...scopedOutlets.map(o => ({ value: o.id, label: o.name }))]}
                  placeholder="Semua outlet"
                  className="glass-input rounded-lg px-3 h-9 text-sm min-w-[160px]"
                  testId="opn-outlet-filter"
                  ariaLabel="Filter outlet"
                />
              )}
              <Button onClick={() => setShowStart(true)} data-testid="opn-new" disabled={!can("outlet.opname.execute")}>
                <Plus /> Mulai Opname
              </Button>
            </>
          }
        />
      </div>

      <div data-testid="opn-table-card" className="glass-card overflow-hidden">
        <DataTable
          columns={[
            { key: "doc_no", label: "Doc No", primary: true, sortable: true,
              render: s => <span className="font-medium tabular-nums">{s.doc_no || s.id.slice(0, 8)}</span> },
            { key: "opname_date", label: "Tanggal", sortable: true, render: s => fmtDate(s.opname_date) },
            { key: "outlet", label: "Outlet", render: s => outletMap[s.outlet_id]?.name || s.outlet_id },
            { key: "period", label: "Period", sortable: true, render: s => s.period },
            { key: "counted", label: "Counted", numeric: true, sortAccessor: s => s.counted_items || 0,
              render: s => <span className="tabular-nums">{s.counted_items || 0} / {s.total_items || 0}</span> },
            { key: "total_variance_value", label: "Variance Value", help: <InlineHelp id="opname-variance" size="xs" placement="top" />,
              numeric: true, sortable: true, sortAccessor: s => s.total_variance_value || 0,
              render: s => <span className={cn("font-semibold", s.total_variance_value < 0 ? "text-red-700 dark:text-red-400" : "")}>{fmtRp(s.total_variance_value || 0)}</span> },
            { key: "status", label: <span className="inline-flex items-center gap-1.5">Status <InlineHelp id="opname-status" size="xs" placement="top" /></span>,
              render: s => <StatusPill status={s.status} /> },
          ]}
          rows={items}
          loading={loading}
          rowTestIdPrefix="opn-row"
          defaultSort={{ key: "opname_date", dir: "desc" }}
          renderExpanded={(s) => <OpnameVarianceDrilldown s={s} />}
          empty={
            <EmptyState
              icon={ClipboardCheck}
              title="Belum ada sesi opname"
              description="Mulai opname untuk mengambil snapshot stok sistem, lalu hitung stok fisik."
              action={can("outlet.opname.execute") ? (
                <Button onClick={() => setShowStart(true)} data-testid="opn-empty-new"><Plus /> Mulai Opname</Button>
              ) : null}
            />
          }
          rowAction={(s) => (
            <Button asChild variant="ghost" size="sm">
              <Link to={`/inventory/opname/${s.id}`} data-testid={`opn-view-${s.id}`} onClick={(e) => e.stopPropagation()}>
                <Eye /> Buka
              </Link>
            </Button>
          )}
        />
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-border/50 flex items-center justify-between gap-2 text-xs text-muted-foreground" data-testid="opn-pagination">
            <span>Total: {meta.total}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} data-testid="opn-prev">Sebelumnya</Button>
              <span className="tabular-nums">{page}/{totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} data-testid="opn-next">Berikutnya</Button>
            </div>
          </div>
        )}
      </div>

      <StartOpnameDialog
        open={showStart}
        outlets={scopedOutlets}
        defaultOutletId={outletId}
        onClose={() => setShowStart(false)}
        onStarted={(sess) => {
          setShowStart(false);
          // Langsung ke sesi baru (SPA navigate — sebelumnya full page reload via window.location).
          if (sess?.id) navigate(`/inventory/opname/${sess.id}`);
          else load();
        }}
      />
    </div>
  );
}

function OpnameVarianceDrilldown({ s }) {
  const [lines, setLines] = useState(null);
  const [loadingD, setLoadingD] = useState(true);
  useEffect(() => {
    let active = true;
    api.get(`/inventory/opname/${s.id}`)
      .then(r => { if (active) setLines(unwrap(r)?.lines || []); })
      .catch(() => { if (active) setLines([]); })
      .finally(() => { if (active) setLoadingD(false); });
    return () => { active = false; };
  }, [s.id]);
  if (loadingD) return <div className="text-xs text-muted-foreground py-2">Memuat selisih…</div>;
  const variant = (lines || []).filter(l => l.counted_qty != null && (Number(l.counted_qty) - Number(l.system_qty || 0)) !== 0);
  if (!variant.length) return <p className="text-sm text-muted-foreground">Tidak ada selisih (sesuai sistem) atau belum dihitung.</p>;
  return (
    <div className="space-y-2" data-testid={`opn-variance-${s.id}`}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Item dengan Selisih ({variant.length})</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 pr-3 font-medium">Item</th>
              <th className="py-1 pr-3 font-medium text-right">Sistem</th>
              <th className="py-1 pr-3 font-medium text-right">Fisik</th>
              <th className="py-1 pr-3 font-medium text-right">Selisih</th>
              <th className="py-1 pr-3 font-medium text-right">Nilai</th>
            </tr>
          </thead>
          <tbody>
            {variant.map((l, i) => {
              const v = Number(l.counted_qty) - Number(l.system_qty || 0);
              return (
                <tr key={i} className="border-t border-border/30">
                  <td className="py-1.5 pr-3 font-medium">{l.item_name || l.item_id}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{fmtNumber(l.system_qty || 0, 2)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{fmtNumber(l.counted_qty || 0, 2)}</td>
                  <td className={cn("py-1.5 pr-3 text-right tabular-nums font-medium", v < 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400")}>{v > 0 ? `+${fmtNumber(v, 2)}` : fmtNumber(v, 2)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{fmtRp(v * Number(l.unit_cost || 0))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StartOpnameDialog({ open, outlets, defaultOutletId, onClose, onStarted }) {
  const [outletId, setOutletId] = useState("");
  const [period, setPeriod] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) {
      // Pre-fill with scoped outlet or first available
      setOutletId(defaultOutletId || outlets[0]?.id || "");
      setPeriod(todayJakartaISO().slice(0, 7));
      setNotes("");
    }
  }, [open, outlets, defaultOutletId]);
  if (!open) return null;

  const submit = async () => {
    if (!outletId) { toast.error("Outlet wajib"); return; }
    setSaving(true);
    try {
      const res = await api.post("/inventory/opname/start", {
        outlet_id: outletId, period, notes,
      });
      const sess = unwrap(res);
      toast.success(`Opname dimulai — ${sess?.doc_no || ""}`);
      onStarted(sess);
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal memulai opname");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="opn-start-dialog" className="glass-card max-w-md">
        <DialogHeader>
          <DialogTitle>Mulai sesi opname</DialogTitle>
          <DialogDescription>Snapshot stok sistem akan diambil sekarang. Hitung fisik bisa dilakukan bertahap.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs md:text-sm font-medium">Outlet <span className="text-destructive">*</span></Label>
            <SimpleSelect
              value={outletId}
              onValueChange={setOutletId}
              options={[{ value: "", label: "Pilih outlet" }, ...outlets.map(o => ({ value: o.id, label: o.name }))]}
              placeholder="Pilih outlet"
              className="glass-input rounded-lg w-full px-3 h-9 text-sm mt-1"
              testId="opn-start-outlet"
              ariaLabel="Outlet"
            />
          </div>
          <div>
            <Label htmlFor="opn-start-period" className="text-xs md:text-sm font-medium">Periode</Label>
            <Input id="opn-start-period" type="month" value={period} onChange={e => setPeriod(e.target.value)} className="glass-input mt-1" data-testid="opn-start-period" />
          </div>
          <div>
            <Label htmlFor="opn-start-notes" className="text-xs md:text-sm font-medium">Catatan</Label>
            <Textarea id="opn-start-notes" value={notes} onChange={e => setNotes(e.target.value)} className="glass-input mt-1 min-h-[60px]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={submit} disabled={saving} data-testid="opn-start-confirm">{saving ? "Memulai…" : "Mulai opname"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
