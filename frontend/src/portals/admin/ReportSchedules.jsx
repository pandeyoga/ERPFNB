/**
 * Report Schedules Admin UI — Sprint E
 * Manage automated report subscriptions (what, to whom, via which channel, at what time)
 */
import { useState, useEffect, useCallback } from "react";
import {
  Bell, Plus, Play, Eye, Trash2, Mail, MessageCircle, Send,
  Clock, CalendarDays, CheckCircle2, AlertTriangle, RefreshCw,
  Edit2, ToggleLeft, ToggleRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import api from "@/lib/api";
import { confirmDialog } from "@/components/shared/confirmDialog";

const CHANNEL_ICONS = {
  email: <Mail className="h-4 w-4" />,
  telegram: <Send className="h-4 w-4" />,
  whatsapp: <MessageCircle className="h-4 w-4" />,
};

const CHANNEL_COLORS = {
  email: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  telegram: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  whatsapp: "bg-green-500/10 text-green-600 border-green-500/20",
};

const STATUS_COLORS = {
  sent: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  error: "bg-red-500/10 text-red-500 border-red-500/20",
  not_configured: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  running: "bg-blue-500/10 text-blue-600 border-blue-500/20",
};

const DAY_NAMES = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

const BLANK = {
  report_type: "",
  name: "",
  frequency: "daily",
  run_time: "07:00",
  day_of_week: 0,
  channel: "email",
  recipients: "",
  enabled: true,
};

export default function ReportSchedules() {
  const [schedules, setSchedules] = useState([]);
  const [reportTypes, setReportTypes] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ...BLANK });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("schedules");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, tRes, rRes] = await Promise.all([
        api.get("/report-schedules"),
        api.get("/report-schedules/types"),
        api.get("/report-schedules/runs", { params: { limit: 30 } }),
      ]);
      setSchedules(sRes.data.data || []);
      setReportTypes(tRes.data.data || []);
      setRuns(rRes.data.data || []);
    } catch (err) {
      toast.error("Gagal memuat jadwal laporan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditId(null);
    setForm({ ...BLANK });
    setDialogOpen(true);
  };

  const openEdit = (sched) => {
    setEditId(sched.id);
    setForm({
      ...sched,
      recipients: (sched.recipients || []).join(", "),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.report_type) return toast.error("Pilih tipe laporan");
    if (!form.recipients?.trim()) return toast.error("Isi setidaknya satu penerima");
    setSaving(true);
    try {
      const payload = {
        ...form,
        recipients: form.recipients.split(",").map(r => r.trim()).filter(Boolean),
      };
      if (editId) {
        await api.put(`/report-schedules/${editId}`, payload);
        toast.success("Jadwal diperbarui");
      } else {
        await api.post("/report-schedules", payload);
        toast.success("Jadwal dibuat");
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.errors?.[0]?.message || "Gagal menyimpan jadwal");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirmDialog("Hapus jadwal ini?"))) return;
    try {
      await api.delete(`/report-schedules/${id}`);
      toast.success("Jadwal dihapus");
      load();
    } catch (err) {
      toast.error("Gagal menghapus");
    }
  };

  const handleToggle = async (sched) => {
    try {
      await api.put(`/report-schedules/${sched.id}`, { enabled: !sched.enabled });
      toast.success(sched.enabled ? "Jadwal dinonaktifkan" : "Jadwal diaktifkan");
      load();
    } catch {
      toast.error("Gagal memperbarui status");
    }
  };

  const handleRunNow = async (sched) => {
    setRunningId(sched.id);
    try {
      const res = await api.post(`/report-schedules/${sched.id}/run-now`);
      const status = res.data.data?.status || "unknown";
      if (status === "sent") toast.success(`Laporan dikirim ke ${res.data.data?.recipients_sent || 0} penerima`);
      else if (status === "not_configured") toast.warning("Penerima kosong atau channel belum dikonfigurasi di Integrations");
      else toast.error(`Pengiriman gagal: ${res.data.data?.error || "unknown error"}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.errors?.[0]?.message || "Gagal menjalankan laporan");
    } finally {
      setRunningId(null);
    }
  };

  const handlePreview = async (sched) => {
    setPreviewLoading(true);
    setPreviewOpen(true);
    setPreviewData(null);
    try {
      const res = await api.post(`/report-schedules/${sched.id}/preview`);
      setPreviewData(res.data.data);
    } catch (err) {
      toast.error("Gagal memuat preview");
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6" data-testid="report-schedules-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Laporan Terjadwal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kirim ringkasan otomatis via Email, Telegram, atau WhatsApp
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} data-testid="report-schedules-refresh"><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={openCreate} data-testid="create-schedule-btn">
            <Plus className="h-4 w-4 mr-2" />Tambah Jadwal
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="report-schedules-tabs">
          <TabsTrigger value="schedules" data-testid="tab-schedules">Jadwal ({schedules.length})</TabsTrigger>
          <TabsTrigger value="runs" data-testid="tab-runs">Riwayat Kirim ({runs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="schedules" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12" data-testid="schedules-loading">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : schedules.length === 0 ? (
            <Card data-testid="schedules-empty">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <Bell className="h-10 w-10 text-muted-foreground/40" />
                <p className="font-medium">Belum ada jadwal laporan</p>
                <p className="text-sm text-muted-foreground">Klik "Tambah Jadwal" untuk mulai</p>
                <Button onClick={openCreate} data-testid="schedules-empty-create-btn"><Plus className="h-4 w-4 mr-2" />Tambah Jadwal</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="schedules-grid">
              {schedules.map(sched => (
                <Card key={sched.id} className={`transition-opacity ${!sched.enabled ? "opacity-60" : ""}`} data-testid={`schedule-card-${sched.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">{sched.name}</CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          {reportTypes.find(rt => rt.id === sched.report_type)?.description || sched.report_type}
                        </CardDescription>
                      </div>
                      <Switch checked={sched.enabled} onCheckedChange={() => handleToggle(sched)} data-testid={`schedule-toggle-${sched.id}`} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className={CHANNEL_COLORS[sched.channel] || ""}>
                        {CHANNEL_ICONS[sched.channel]}
                        <span className="ml-1 capitalize">{sched.channel}</span>
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />
                        {sched.frequency === "weekly"
                          ? `${DAY_NAMES[sched.day_of_week || 0]} ${sched.run_time}`
                          : `Harian ${sched.run_time}`}
                      </Badge>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">Penerima: </span>
                      {(sched.recipients || []).slice(0, 2).join(", ")}
                      {(sched.recipients || []).length > 2 && ` +${sched.recipients.length - 2} lainnya`}
                    </div>

                    {sched.last_status && (
                      <Badge variant="outline" className={STATUS_COLORS[sched.last_status] || ""}>
                        {sched.last_status === "sent" ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                        {sched.last_status}
                        {sched.last_run_at && ` · ${new Date(sched.last_run_at).toLocaleString("id-ID", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`}
                      </Badge>
                    )}

                    <Separator />
                    <div className="flex gap-1" data-testid={`schedule-actions-${sched.id}`}>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => handlePreview(sched)} data-testid={`schedule-preview-${sched.id}`}>
                        <Eye className="h-3.5 w-3.5 mr-1" />Preview
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => handleRunNow(sched)}
                        disabled={runningId === sched.id} data-testid={`schedule-run-${sched.id}`}>
                        {runningId === sched.id
                          ? <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />
                          : <Play className="h-3.5 w-3.5 mr-1" />}
                        Kirim Sekarang
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(sched)} data-testid={`schedule-edit-${sched.id}`}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(sched.id)} data-testid={`schedule-delete-${sched.id}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="runs" className="mt-4">
          <Card data-testid="runs-card">
            <CardContent className="p-0">
              <div className="divide-y">
                {runs.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground" data-testid="runs-empty">Belum ada riwayat pengiriman</p>
                ) : runs.map(run => (
                  <div key={run.id} className="flex items-center gap-3 px-4 py-3" data-testid={`run-item-${run.id}`}>
                    <Badge variant="outline" className={STATUS_COLORS[run.status] || ""}>{run.status}</Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{run.report_type}</p>
                      <p className="text-xs text-muted-foreground">
                        {run.channel} · {run.recipients_sent ?? "?"} terkirim
                        {run.error && ` · ${run.error}`}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(run.started_at).toLocaleString("id-ID", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg" data-testid="schedule-form-dialog">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Jadwal" : "Tambah Jadwal Laporan"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Tipe Laporan *</Label>
              <Select value={form.report_type} onValueChange={v => {
                const rt = reportTypes.find(r => r.id === v);
                setForm(f => ({ ...f, report_type: v, name: rt?.name || f.name, frequency: rt?.default_frequency || f.frequency, run_time: rt?.default_time || f.run_time }));
              }}>
                <SelectTrigger data-testid="schedule-form-report-type"><SelectValue placeholder="Pilih tipe laporan..." /></SelectTrigger>
                <SelectContent>
                  {reportTypes.map(rt => (
                    <SelectItem key={rt.id} value={rt.id}>
                      <div>
                        <p className="font-medium">{rt.name}</p>
                        <p className="text-xs text-muted-foreground">{rt.description}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Nama Jadwal</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Mis: Owner Daily Digest" data-testid="schedule-form-name" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Frekuensi</Label>
                <Select value={form.frequency} onValueChange={v => setForm(f => ({ ...f, frequency: v }))}>
                  <SelectTrigger data-testid="schedule-form-frequency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Harian</SelectItem>
                    <SelectItem value="weekly">Mingguan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.frequency === "weekly" && (
                <div className="space-y-1">
                  <Label>Hari</Label>
                  <Select value={String(form.day_of_week ?? 0)} onValueChange={v => setForm(f => ({ ...f, day_of_week: Number(v) }))}>
                    <SelectTrigger data-testid="schedule-form-day"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DAY_NAMES.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1">
                <Label>Jam Kirim (WIB)</Label>
                <Input type="time" value={form.run_time} onChange={e => setForm(f => ({ ...f, run_time: e.target.value }))} data-testid="schedule-form-time" />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Channel</Label>
              <Select value={form.channel} onValueChange={v => setForm(f => ({ ...f, channel: v }))}>
                <SelectTrigger data-testid="schedule-form-channel"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="telegram">Telegram</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Penerima *</Label>
              <Input
                value={form.recipients}
                onChange={e => setForm(f => ({ ...f, recipients: e.target.value }))}
                placeholder={form.channel === "email" ? "email@contoh.com, email2@contoh.com" : "chat_id atau nomor HP, pisahkan koma"}
                data-testid="schedule-form-recipients"
              />
              <p className="text-xs text-muted-foreground">Pisahkan dengan koma untuk multiple penerima</p>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.enabled} onCheckedChange={v => setForm(f => ({ ...f, enabled: v }))} data-testid="schedule-form-enabled" />
              <Label>Aktifkan jadwal ini</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="schedule-form-cancel">Batal</Button>
            <Button onClick={handleSave} disabled={saving} data-testid="schedule-form-save">
              {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editId ? "Simpan Perubahan" : "Buat Jadwal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl" data-testid="schedule-preview-dialog">
          <DialogHeader><DialogTitle>Preview Laporan</DialogTitle></DialogHeader>
          {previewLoading ? (
            <div className="flex justify-center py-8" data-testid="schedule-preview-loading">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : previewData ? (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-3 pr-4" data-testid="schedule-preview-content">
                <div className="rounded-md bg-muted/30 px-4 py-2">
                  <p className="text-xs font-medium text-muted-foreground">Subjek</p>
                  <p className="text-sm font-medium" data-testid="schedule-preview-subject">{previewData.subject}</p>
                </div>
                <div className="rounded-md bg-muted/30 px-4 py-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Isi Pesan (plain text)</p>
                  <pre className="whitespace-pre-wrap text-sm font-mono" data-testid="schedule-preview-text">{previewData.text}</pre>
                </div>
              </div>
            </ScrollArea>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)} data-testid="schedule-preview-close">Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
