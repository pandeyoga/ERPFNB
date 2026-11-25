/** /ai/whatsapp — hubungkan WhatsApp ke Asisten AI (owner & manager): kode tautan, PIN persetujuan, notifikasi,
 * daftar perintah; admin AI melihat & mencabut nomor yang terhubung. Backend: /api/wa (services/wa_bot). */
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Link2, Unlink, KeyRound, ShieldAlert, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PageHeader from "@/components/shared/PageHeader";
import KeyFacts from "@/components/shared/KeyFacts";
import StatusPill from "@/components/shared/StatusPill";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import { confirmDialog } from "@/components/shared/confirmDialog";
import { useAuth } from "@/lib/auth";
import api, { unwrap, unwrapError } from "@/lib/api";
import { fmtDateTime, fmtRelative } from "@/lib/format";

const COMMANDS = [
  ["Pertanyaan bebas", "“sales kemarin per toko”, “PO yang menunggu persetujuan”, “buatkan laporan PDF bulan ini”"],
  ["Kirim foto / PDF / Excel", "struk, invoice, price list, ekspor POS/GoFood, mutasi bank → dibaca & bisa diimpor"],
  ["PIN 123456", "membuka persetujuan selama 15 menit"],
  ["SETUJUI 1 · TOLAK 1 · SETUJUI SEMUA", "memutuskan usulan aksi (di atas Rp10 jt lewat aplikasi)"],
  ["BARU · BANTUAN", "percakapan baru · daftar perintah"],
];

function PinDialog({ open, onOpenChange, onSaved }) {
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setPin(""); setPin2(""); } }, [open]);
  const save = async () => {
    if (!/^\d{6}$/.test(pin)) { toast.error("PIN harus 6 digit angka"); return; }
    if (pin !== pin2) { toast.error("Konfirmasi PIN tidak sama"); return; }
    setSaving(true);
    try { onSaved(unwrap(await api.post("/wa/pin", { pin }))); toast.success("PIN disimpan"); onOpenChange(false); }
    catch (e) { toast.error(unwrapError(e)); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Atur PIN persetujuan</DialogTitle>
          <DialogDescription>Dipakai saat menyetujui usulan aksi lewat WhatsApp. Jangan bagikan ke siapa pun.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="wa-pin">PIN (6 digit)</Label>
            <Input id="wa-pin" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} data-testid="wa-pin" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wa-pin2">Ulangi PIN</Label>
            <Input id="wa-pin2" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin2}
              onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))} data-testid="wa-pin2" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={save} disabled={saving} data-testid="wa-pin-save">{saving ? "Menyimpan…" : "Simpan PIN"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdminLinks() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    api.get("/wa/links", { scope: false }).then((r) => setRows(unwrap(r) || [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);
  const revoke = async (r) => {
    if (!(await confirmDialog({ title: "Cabut akses WhatsApp?", description: `${r.user_name} (${r.phone || r.jid}) tidak bisa lagi memakai bot.`, confirmText: "Cabut", destructive: true }))) return;
    try { await api.delete(`/wa/links/${r.id}`); toast.success("Akses dicabut"); load(); } catch (e) { toast.error(unwrapError(e)); }
  };
  const cols = [
    { key: "user_name", label: "Pengguna", primary: true },
    { key: "phone", label: "Nomor", render: (r) => r.phone || (r.jid ? "nomor tersembunyi" : "—") },
    { key: "status", label: "Status", render: (r) => <StatusPill status={r.status === "active" ? "active" : "pending"} label={r.status === "active" ? "Terhubung" : "Menunggu kode"} /> },
    { key: "last_seen_at", label: "Terakhir aktif", render: (r) => (r.last_seen_at ? fmtRelative(r.last_seen_at) : "—") },
    { key: "messages_7d", label: "Pesan 7 hari", numeric: true },
    { key: "act", label: "", render: (r) => <Button size="sm" variant="ghost" onClick={() => revoke(r)} aria-label={`Cabut ${r.user_name}`}><Unlink className="h-3.5 w-3.5" /> Cabut</Button> },
  ];
  return (
    <Card className="p-4 space-y-3" data-testid="wa-admin-links">
      <CardHeader className="p-0"><CardTitle className="text-base">Semua nomor terhubung (admin)</CardTitle></CardHeader>
      <DataTable columns={cols} rows={rows} loading={loading} rowTestIdPrefix="wa-link"
        empty={<EmptyState icon={Smartphone} title="Belum ada nomor terhubung" />} />
    </Card>
  );
}

export default function AIWhatsAppPage() {
  const { can } = useAuth();
  const [st, setSt] = useState(null);
  const [code, setCode] = useState(null);
  const [pinOpen, setPinOpen] = useState(false);
  const timer = useRef(null);

  const load = useCallback(async () => {
    try { setSt(unwrap(await api.get("/wa/me", { scope: false }))); } catch (e) { toast.error(unwrapError(e)); }
  }, []);
  useEffect(() => { load(); return () => clearInterval(timer.current); }, [load]);
  // menunggu pengguna mengirim kode dari WhatsApp
  useEffect(() => {
    clearInterval(timer.current);
    if (!code) return undefined;
    timer.current = setInterval(async () => {
      try {
        const s = unwrap(await api.get("/wa/me", { scope: false }));
        setSt(s);
        if (s.status === "active") { setCode(null); toast.success("WhatsApp terhubung"); }
        if (new Date(code.expires_at) < new Date()) setCode(null);
      } catch { /* abaikan */ }
    }, 3000);
    return () => clearInterval(timer.current);
  }, [code]);

  const startLink = async () => {
    try { setCode(unwrap(await api.post("/wa/link"))); } catch (e) { toast.error(unwrapError(e)); }
  };
  const unlink = async () => {
    if (!(await confirmDialog({ title: "Putuskan WhatsApp?", description: "Nomor Anda tidak bisa lagi memakai bot sampai dihubungkan ulang.", confirmText: "Putuskan", destructive: true }))) return;
    try { await api.delete("/wa/me"); setCode(null); load(); } catch (e) { toast.error(unwrapError(e)); }
  };
  const setNotify = async (v) => {
    try { setSt(unwrap(await api.patch("/wa/me", { notify: v }))); } catch (e) { toast.error(unwrapError(e)); }
  };

  const active = st?.status === "active";
  return (
    <div className="space-y-3 md:space-y-4" data-testid="wa-page">
      <PageHeader icon={MessageCircle} title="WhatsApp" subtitle="Pakai Asisten AI dari HP: tanya data, kirim foto/file, terima laporan, setujui usulan dengan PIN"
        actions={active
          ? <Button variant="outline" onClick={unlink} data-testid="wa-unlink"><Unlink className="h-4 w-4" /> Putuskan</Button>
          : <Button onClick={startLink} disabled={st && !st.configured} data-testid="wa-link"><Link2 className="h-4 w-4" /> Hubungkan WhatsApp</Button>}>
        {st && (
          <KeyFacts items={[
            { label: "Status", value: <StatusPill status={active ? "active" : "pending"} label={active ? "Terhubung" : st.status === "pending" ? "Menunggu kode" : "Belum terhubung"} /> },
            { label: "Nomor", value: st.phone || (active ? "nomor tersembunyi" : "—") },
            { label: "PIN persetujuan", value: st.pin_set ? "Sudah diatur" : "Belum" },
            { label: "Terhubung sejak", value: st.linked_at ? fmtDateTime(st.linked_at) : "—" },
          ]} />
        )}
      </PageHeader>

      {st && !st.configured && (
        <Card className="p-4">
          <p className="text-sm flex items-start gap-2 text-amber-800 dark:text-amber-400"><ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
            Gateway WhatsApp belum dikonfigurasi. Admin: Admin → Integrations → WhatsApp — provider <strong>evolution</strong>, isi
            Evolution API URL/Key/Instance, nomor bot, dan rahasia webhook; arahkan webhook Evolution (event MESSAGES_UPSERT) ke
            /api/wa/webhook?token=&lt;rahasia&gt;.</p>
        </Card>
      )}

      {code && (
        <Card className="p-4 space-y-2" data-testid="wa-code-card">
          <CardHeader className="p-0"><CardTitle className="text-base">Kirim kode ini dari WhatsApp Anda</CardTitle></CardHeader>
          <CardContent className="p-0 space-y-2">
            <p className="text-3xl font-semibold tracking-[0.3em] tabular-nums" data-testid="wa-code">LINK {code.code}</p>
            <p className="text-sm text-muted-foreground">
              Kirim pesan <strong>LINK {code.code}</strong> {code.bot_number ? <>ke nomor <strong>{code.bot_number}</strong></> : "ke nomor bot"} —
              berlaku sampai {fmtDateTime(code.expires_at)}. Halaman ini memperbarui otomatis.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:gap-4 lg:grid-cols-2">
        <Card className="p-4 space-y-3">
          <CardHeader className="p-0 flex-row items-center justify-between space-y-0 gap-2">
            <CardTitle className="text-base">Keamanan & notifikasi</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setPinOpen(true)} disabled={!st || st.status === "none"} data-testid="wa-set-pin">
              <KeyRound className="h-3.5 w-3.5" /> {st?.pin_set ? "Ganti PIN" : "Atur PIN"}
            </Button>
          </CardHeader>
          <CardContent className="p-0 space-y-3">
            <p className="text-sm text-muted-foreground">PIN 6 digit wajib untuk menyetujui aksi lewat WhatsApp (berlaku 15 menit setelah
              dimasukkan). Aksi bernilai di atas Rp10 jt tetap disetujui lewat aplikasi.</p>
            <div className="flex items-start justify-between gap-3">
              <div>
                <Label htmlFor="wa-notify">Kirim notifikasi penting ke WhatsApp</Label>
                <p className="text-xs text-muted-foreground">Peringatan & hal mendesak (anggaran, approval, anomali).</p>
              </div>
              <Switch id="wa-notify" checked={!!st?.notify} disabled={!active} onCheckedChange={setNotify} data-testid="wa-notify" />
            </div>
          </CardContent>
        </Card>
        <Card className="p-4 space-y-3">
          <CardHeader className="p-0"><CardTitle className="text-base">Perintah di WhatsApp</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ul className="space-y-2">
              {COMMANDS.map(([k, v]) => (
                <li key={k} className="text-sm"><span className="font-medium">{k}</span><span className="text-muted-foreground"> — {v}</span></li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {can("ai.agent.admin") && <AdminLinks />}
      <PinDialog open={pinOpen} onOpenChange={setPinOpen} onSaved={setSt} />
    </div>
  );
}
