/** /ai/automations — Monitor & Otomasi Asisten AI: instruksi terjadwal (laporan, pemantauan dengan AI) dan kondisi
 * tanpa biaya AI (penjualan rendah, anomali baru, selisih opname, …). Hasil ke notifikasi aplikasi / WhatsApp.
 * Backend: /api/ai/automations (+ /templates, /{id}/run, /{id}/runs). */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Workflow, Plus, Play, History, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import StatusPill from "@/components/shared/StatusPill";
import SegmentedFilter from "@/components/shared/SegmentedFilter";
import SimpleSelect from "@/components/shared/SimpleSelect";
import EmptyState from "@/components/shared/EmptyState";
import RowActions from "@/components/shared/RowActions";
import { confirmDialog } from "@/components/shared/confirmDialog";
import api, { unwrap, unwrapError } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";

const FREQS = [{ value: "daily", label: "Harian" }, { value: "weekly", label: "Mingguan" }, { value: "monthly", label: "Bulanan" }, { value: "hourly", label: "Tiap jam" }];
const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"].map((d, i) => ({ value: String(i), label: d }));
const DATES = Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: `Tanggal ${i + 1}` }));
const OPS = ["<", "<=", ">", ">="].map((o) => ({ value: o, label: o }));
const RUN_STATUS = { terpenuhi: ["pending", "Terpenuhi"], aman: ["confirmed", "Aman"], dikirim: ["confirmed", "Dikirim"],
  tidak_ada_temuan: ["draft", "Tidak ada temuan"], error: ["rejected", "Gagal"] };
const EMPTY = { name: "", kind: "agen", instruction: "", monitor: false, schedule: { freq: "daily", time: "07:00", weekday: 0, day: 1 },
  channels: ["app"], condition: { template: "sales_low", op: "<", threshold: "" } };

function AutomationDialog({ open, onOpenChange, initial, templates, onSaved }) {
  const [f, setF] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    setF(initial ? { ...EMPTY, ...initial, condition: { ...EMPTY.condition, ...(initial.condition || {}) } } : EMPTY);
  }, [open, initial]);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setSch = (k, v) => setF((x) => ({ ...x, schedule: { ...x.schedule, [k]: v } }));
  const setCond = (k, v) => setF((x) => ({ ...x, condition: { ...x.condition, [k]: v } }));
  const tpl = templates.find((t) => t.id === f.condition.template);
  const toggleCh = (c) => set("channels", f.channels.includes(c) ? f.channels.filter((x) => x !== c) : [...f.channels, c]);

  const save = async () => {
    const body = { name: f.name, kind: f.kind, schedule: { ...f.schedule, weekday: Number(f.schedule.weekday), day: Number(f.schedule.day) },
      channels: f.channels.length ? f.channels : ["app"] };
    if (f.kind === "agen") Object.assign(body, { instruction: f.instruction, monitor: f.monitor });
    else body.condition = { template: f.condition.template, op: f.condition.op || tpl?.op, threshold: Number(f.condition.threshold) };
    setSaving(true);
    try {
      if (initial) await api.patch(`/ai/automations/${initial.id}`, body); else await api.post("/ai/automations", body);
      toast.success("Otomasi disimpan"); onOpenChange(false); onSaved();
    } catch (e) { toast.error(unwrapError(e)); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto" data-testid="automation-dialog">
        <DialogHeader><DialogTitle>{initial ? "Ubah otomasi" : "Buat otomasi"}</DialogTitle>
          <DialogDescription>Berjalan dengan izin Anda. Aksi tulis yang diusulkan AI tetap menunggu persetujuan.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="au-name">Nama</Label>
            <Input id="au-name" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Laporan sales mingguan" data-testid="automation-name" /></div>
          <SegmentedFilter value={f.kind} onChange={(v) => set("kind", v)} ariaLabel="Jenis otomasi"
            options={[{ value: "agen", label: "Instruksi AI" }, { value: "kondisi", label: "Kondisi (tanpa biaya AI)" }]} />
          {f.kind === "agen" ? (
            <>
              <div className="space-y-1"><Label htmlFor="au-ins">Instruksi</Label>
                <Textarea id="au-ins" rows={4} value={f.instruction} onChange={(e) => set("instruction", e.target.value)} data-testid="automation-instruction"
                  placeholder="Ringkas penjualan minggu lalu per toko vs minggu sebelumnya, sertakan PDF." /></div>
              <label className="flex items-center gap-2 text-sm" htmlFor="au-mon">
                <Checkbox id="au-mon" checked={!!f.monitor} onCheckedChange={(v) => set("monitor", !!v)} />
                Pemantauan — kirim hanya bila ada temuan
              </label>
            </>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[1fr_80px_1fr]">
              <div className="space-y-1"><Label htmlFor="au-tpl">Kondisi</Label>
                <SimpleSelect id="au-tpl" value={f.condition.template} onValueChange={(v) => { const t = templates.find((x) => x.id === v); setF((x) => ({ ...x, condition: { template: v, op: t?.op || "<", threshold: t?.threshold ?? "" } })); }}
                  options={templates.map((t) => ({ value: t.id, label: t.label }))} ariaLabel="Kondisi" className="w-full" /></div>
              <div className="space-y-1"><Label htmlFor="au-op">Operator</Label>
                <SimpleSelect id="au-op" value={f.condition.op || tpl?.op || "<"} onValueChange={(v) => setCond("op", v)} options={OPS} ariaLabel="Operator" className="w-full" /></div>
              <div className="space-y-1"><Label htmlFor="au-thr">Batas {tpl?.unit === "rp" ? "(Rp)" : ""}</Label>
                <Input id="au-thr" type="number" value={f.condition.threshold} onChange={(e) => setCond("threshold", e.target.value)} data-testid="automation-threshold" /></div>
            </div>
          )}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
            <div className="space-y-1"><Label htmlFor="au-freq">Jadwal</Label>
              <SimpleSelect id="au-freq" value={f.schedule.freq} onValueChange={(v) => setSch("freq", v)} options={FREQS} ariaLabel="Jadwal" className="w-full" /></div>
            {f.schedule.freq === "weekly" && (
              <div className="space-y-1"><Label htmlFor="au-wd">Hari</Label>
                <SimpleSelect id="au-wd" value={String(f.schedule.weekday ?? 0)} onValueChange={(v) => setSch("weekday", v)} options={DAYS} ariaLabel="Hari" className="w-full" /></div>
            )}
            {f.schedule.freq === "monthly" && (
              <div className="space-y-1"><Label htmlFor="au-day">Tanggal</Label>
                <SimpleSelect id="au-day" value={String(f.schedule.day ?? 1)} onValueChange={(v) => setSch("day", v)} options={DATES} ariaLabel="Tanggal" className="w-full" /></div>
            )}
            <div className="space-y-1"><Label htmlFor="au-time">{f.schedule.freq === "hourly" ? "Menit (HH:MM)" : "Jam (WIB)"}</Label>
              <Input id="au-time" type="time" value={f.schedule.time} onChange={(e) => setSch("time", e.target.value)} /></div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-muted-foreground">Kirim ke:</span>
            <label className="flex items-center gap-2" htmlFor="au-app"><Checkbox id="au-app" checked={f.channels.includes("app")} onCheckedChange={() => toggleCh("app")} /> Notifikasi aplikasi</label>
            <label className="flex items-center gap-2" htmlFor="au-wa"><Checkbox id="au-wa" checked={f.channels.includes("whatsapp")} onCheckedChange={() => toggleCh("whatsapp")} /> WhatsApp</label>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={save} disabled={saving || !f.name.trim()} data-testid="automation-save">{saving ? "Menyimpan…" : "Simpan"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RunsDialog({ automation, onClose }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    if (!automation) return;
    setRows(null);
    api.get(`/ai/automations/${automation.id}/runs`, { scope: false }).then((r) => setRows(unwrap(r) || [])).catch(() => setRows([]));
  }, [automation]);
  return (
    <Dialog open={!!automation} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Riwayat: {automation?.name}</DialogTitle><DialogDescription>{automation?.jadwal}</DialogDescription></DialogHeader>
        <DataTable rows={rows || []} loading={!rows} rowTestIdPrefix="automation-run"
          columns={[
            { key: "started_at", label: "Waktu", render: (r) => fmtDateTime(r.started_at) },
            { key: "status", label: "Hasil", render: (r) => <StatusPill status={(RUN_STATUS[r.status] || ["draft"])[0]} label={(RUN_STATUS[r.status] || [r.status, r.status])[1]} /> },
            { key: "ringkasan", label: "Ringkasan", primary: true, render: (r) => (
              <span className="text-xs line-clamp-3 whitespace-pre-wrap">{r.ringkasan}{r.session_id ? " " : ""}
                {r.session_id && <Link to={`/ai?session=${r.session_id}`} className="underline">Buka percakapan</Link>}</span>) },
            { key: "terkirim", label: "Terkirim", hideOnMobile: true, render: (r) => (r.terkirim || []).join(", ") || "—" },
          ]}
          empty={<EmptyState icon={History} title="Belum pernah jalan" description="Klik Jalankan untuk mencoba sekarang." />} />
        <DialogFooter><Button variant="outline" onClick={onClose}>Tutup</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AIAutomationsPage() {
  const [rows, setRows] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [history, setHistory] = useState(null);
  const [running, setRunning] = useState("");

  const load = useCallback(() => {
    api.get("/ai/automations", { scope: false }).then((r) => setRows(unwrap(r) || [])).catch((e) => { toast.error(unwrapError(e)); setRows([]); });
  }, []);
  useEffect(() => {
    load();
    api.get("/ai/automations/templates", { scope: false }).then((r) => setTemplates(unwrap(r) || [])).catch(() => {});
  }, [load]);

  const toggle = async (a, enabled) => {
    try { await api.patch(`/ai/automations/${a.id}`, { enabled }); load(); } catch (e) { toast.error(unwrapError(e)); }
  };
  const runNow = async (a) => {
    setRunning(a.id);
    try {
      const r = unwrap(await api.post(`/ai/automations/${a.id}/run`, {}, { timeout: 660000 }));
      toast[r.status === "error" ? "error" : "success"](`${a.name}: ${(RUN_STATUS[r.status] || [0, r.status])[1]}`);
      load();
    } catch (e) { toast.error(unwrapError(e)); } finally { setRunning(""); }
  };
  const remove = async (a) => {
    if (!(await confirmDialog({ title: "Hapus otomasi?", description: a.name, confirmText: "Hapus", destructive: true }))) return;
    try { await api.delete(`/ai/automations/${a.id}`); toast.success("Dihapus"); load(); } catch (e) { toast.error(unwrapError(e)); }
  };

  return (
    <div className="space-y-3 md:space-y-4" data-testid="ai-automations-page">
      <PageHeader icon={Workflow} title="Monitor & Otomasi" subtitle="Laporan terjadwal & pemantauan oleh Asisten AI, plus pengecekan kondisi tanpa biaya AI"
        actions={<Button onClick={() => { setEditing(null); setOpen(true); }} data-testid="automation-add"><Plus /> Buat otomasi</Button>} />
      <Card className="p-0 overflow-hidden">
        <DataTable rows={rows || []} loading={!rows} rowTestIdPrefix="automation-row"
          columns={[
            { key: "name", label: "Nama", primary: true, render: (a) => (
              <div className="min-w-0"><div className="font-medium truncate">{a.name}</div>
                <div className="text-xs text-muted-foreground truncate">{a.kind === "agen" ? (a.monitor ? "Pemantauan AI" : "Instruksi AI") : "Kondisi"} · {a.jadwal}</div></div>) },
            { key: "channels", label: "Kirim ke", hideOnMobile: true, render: (a) => a.channels.map((c) => (c === "app" ? "Aplikasi" : "WhatsApp")).join(", ") },
            { key: "last_status", label: "Terakhir", render: (a) => (a.last_status
              ? <StatusPill status={(RUN_STATUS[a.last_status] || ["draft"])[0]} label={(RUN_STATUS[a.last_status] || [0, a.last_status])[1]} />
              : <span className="text-xs text-muted-foreground">Belum jalan</span>) },
            { key: "next_run_at", label: "Berikutnya", hideOnMobile: true, render: (a) => (a.enabled ? fmtDateTime(a.next_run_at) : "—") },
            { key: "enabled", label: "Aktif", render: (a) => <Switch checked={!!a.enabled} onCheckedChange={(v) => toggle(a, v)} aria-label={`Aktifkan ${a.name}`} /> },
          ]}
          rowAction={(a) => (
            <RowActions
              primary={{ label: running === a.id ? "Menjalankan…" : "Jalankan", icon: Play, onClick: () => runNow(a), testId: `automation-run-${a.id}` }}
              items={[
                { label: "Riwayat", icon: History, onSelect: () => setHistory(a) },
                { label: "Ubah", icon: Pencil, onSelect: () => { setEditing(a); setOpen(true); } },
                { label: "Hapus", icon: Trash2, onSelect: () => remove(a), destructive: true },
              ]} />
          )}
          empty={<EmptyState icon={Workflow} title="Belum ada otomasi"
            description='Buat di sini, atau minta di percakapan: "tiap Senin 07:00 kirim laporan sales minggu lalu ke WA saya".' />} />
      </Card>
      <AutomationDialog open={open} onOpenChange={setOpen} initial={editing} templates={templates} onSaved={load} />
      <RunsDialog automation={history} onClose={() => setHistory(null)} />
    </div>
  );
}
