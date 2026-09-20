/**
 * LeaveRequests — HR Portal: leave request list, create, and approval queue.
 */
import { useState, useEffect, useCallback } from "react";
import {
  CalendarDays, Plus, Loader2, CheckCircle, XCircle, Clock, User, ChevronDown,
} from "lucide-react";
import { InlineHelp } from "@/components/shared/InlineHelp";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import StatusPill from "@/components/shared/StatusPill";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import DataTable from "@/components/shared/DataTable";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { formatDateID } from "@/lib/format";
import { confirmDialog } from "@/components/shared/confirmDialog";

const LEAVE_STATUS_MAP = {
  draft:             { label: "Draft",          color: "secondary" },
  submitted:         { label: "Diajukan",       color: "default" },
  awaiting_approval: { label: "Menunggu",       color: "default" },
  approved:          { label: "Disetujui",      color: "success" },
  rejected:          { label: "Ditolak",        color: "destructive" },
  cancelled:         { label: "Dibatalkan",     color: "secondary" },
};

const LEAVE_TYPE_LABELS = {
  annual:    "Cuti Tahunan",
  sick:      "Sakit",
  personal:  "Keperluan Pribadi",
  emergency: "Darurat Keluarga",
  maternity: "Cuti Melahirkan",
  paternity: "Cuti Ayah",
  other:     "Lainnya",
};

function LeaveStatusBadge({ status }) {
  const m = LEAVE_STATUS_MAP[status] || LEAVE_STATUS_MAP.draft;
  // Phase 2: use the shared StatusPill for visual consistency, keeping the
  // HR-specific Indonesian label via the `label` override.
  return <StatusPill status={status} label={m.label} />;
}

export default function LeaveRequests() {
  const [tab, setTab] = useState("my");
  const [leaves, setLeaves] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createDialog, setCreateDialog] = useState(false);
  const [approveDialog, setApproveDialog] = useState(null); // { id, employee_name }
  const [rejectDialog, setRejectDialog] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [leaveSummary, setLeaveSummary] = useState(null);
  // Current user from cached auth context (avoids redundant /auth/me fetch per page)
  const { user } = useAuth();
  const currentUserId = user?.id || null;

  const loadMyLeaves = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);
    try {
      const [lRes, sRes] = await Promise.all([
        api.get("/hr/leaves"),
        api.get(`/hr/leaves/summary/${currentUserId}`),
      ]);
      if (lRes.data.success) setLeaves(lRes.data.data.items || []);
      if (sRes.data.success) setLeaveSummary(sRes.data.data || {});
    } catch { toast.error("Gagal memuat cuti"); }
    finally { setLoading(false); }
  }, [currentUserId]);

  const loadPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/hr/leaves?pending=true&per_page=100");
      if (res.data.success) setPendingLeaves(res.data.data.items || []);
    } catch { toast.error("Gagal memuat pending approval"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === "my") loadMyLeaves();
    else if (tab === "approval") loadPending();
  }, [tab, loadMyLeaves, loadPending]);

  const handleSubmit = async (leaveId) => {
    try {
      await api.post(`/hr/leaves/${leaveId}/submit`);
      toast.success("Pengajuan cuti berhasil dikirim");
      loadMyLeaves();
    } catch (e) { toast.error(e.response?.data?.errors?.[0]?.message || "Gagal"); }
  };

  const handleCancel = async (leaveId) => {
    if (!(await confirmDialog("Batalkan pengajuan cuti ini?"))) return;
    try {
      await api.post(`/hr/leaves/${leaveId}/cancel`);
      toast.success("Pengajuan dibatalkan");
      loadMyLeaves();
    } catch (e) { toast.error(e.response?.data?.errors?.[0]?.message || "Gagal"); }
  };

  const handleApproveConfirm = async () => {
    if (!approveDialog) return;
    try {
      await api.post(`/hr/leaves/${approveDialog.id}/approve`, { note: "Disetujui" });
      toast.success("Cuti disetujui");
      setApproveDialog(null);
      loadPending();
    } catch (e) { toast.error(e.response?.data?.errors?.[0]?.message || "Gagal"); }
  };

  const handleRejectConfirm = async () => {
    if (!rejectDialog || !rejectReason.trim()) { toast.error("Masukkan alasan"); return; }
    try {
      await api.post(`/hr/leaves/${rejectDialog.id}/reject`, { reason: rejectReason });
      toast.success("Cuti ditolak");
      setRejectDialog(null); setRejectReason("");
      loadPending();
    } catch (e) { toast.error(e.response?.data?.errors?.[0]?.message || "Gagal"); }
  };

  return (
    <div className="space-y-6" data-testid="leave-requests">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <CalendarDays className="h-6 w-6" /> Leave Management
            <InlineHelp id="hr-leaves-page" size="xs" placement="right" />
          </h2>
          <p className="text-sm text-muted-foreground">Kelola pengajuan cuti karyawan</p>
        </div>
        <Button onClick={() => setCreateDialog(true)} data-testid="create-leave-btn">
          <Plus className="h-4 w-4 mr-2" /> Ajukan Cuti
        </Button>
      </div>

      {/* Leave Summary */}
      {leaveSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="leave-summary">
          {["annual", "sick", "personal", "emergency"].map(lt => (
            <Card key={lt}>
              <CardContent className="pt-3 pb-3">
                <div className="text-xs text-muted-foreground">{LEAVE_TYPE_LABELS[lt]}</div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xl font-bold">
                    {leaveSummary[lt]?.used || 0}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    / {leaveSummary[lt]?.quota || 0} hari
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Sisa: {leaveSummary[lt]?.remaining || 0} hari
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="my" data-testid="tab-my-leaves">Cuti Saya</TabsTrigger>
          <TabsTrigger value="approval" data-testid="tab-approval-queue">
            Pending Persetujuan
            {pendingLeaves.length > 0 && (
              <Badge variant="destructive" className="ml-2 text-xs px-1.5 py-0">{pendingLeaves.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── MY LEAVES ─────────────────────────────────── */}
        <TabsContent value="my" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : leaves.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
                <CalendarDays className="h-10 w-10 mb-2" />
                <p>Belum ada pengajuan cuti</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setCreateDialog(true)}>
                  Ajukan Cuti Pertama
                </Button>
              </CardContent>
            </Card>
          ) : (
            <DataTable
              rows={leaves}
              keyField="doc_no"
              rowTestIdPrefix="leave-row"
              columns={[
                { key: "doc_no", label: "No", primary: true, render: (lr) => <span className="font-mono text-xs">{lr.doc_no}</span> },
                { key: "leave_type", label: "Jenis", render: (lr) => LEAVE_TYPE_LABELS[lr.leave_type] || lr.leave_type },
                { key: "start_date", label: "Mulai", render: (lr) => formatDateID(lr.start_date) },
                { key: "end_date", label: "Selesai", render: (lr) => formatDateID(lr.end_date) },
                { key: "days_count", label: "Hari", align: "center", render: (lr) => <span className="font-semibold">{lr.days_count}</span> },
                { key: "status", label: "Status", render: (lr) => <LeaveStatusBadge status={lr.status} /> },
              ]}
              rowAction={(lr) => (
                <div className="flex gap-1 justify-end">
                  {lr.status === "draft" && (
                    <Button size="sm" variant="outline" className="text-xs h-7"
                      onClick={() => handleSubmit(lr.id)} data-testid={`submit-leave-${lr.id}`}>
                      Ajukan
                    </Button>
                  )}
                  {["draft", "submitted"].includes(lr.status) && (
                    <Button size="sm" variant="ghost" className="text-xs h-7 text-red-500"
                      onClick={() => handleCancel(lr.id)} data-testid={`cancel-leave-${lr.id}`}>
                      Batalkan
                    </Button>
                  )}
                  {lr.rejection_reason && (
                    <Button size="sm" variant="ghost" className="text-xs h-7" title={lr.rejection_reason}>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
            />
          )}
        </TabsContent>

        {/* ── APPROVAL QUEUE ─────────────────────────────── */}
        <TabsContent value="approval" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : pendingLeaves.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
                <CheckCircle className="h-10 w-10 mb-2 text-green-500" />
                <p>Tidak ada cuti yang menunggu persetujuan</p>
              </CardContent>
            </Card>
          ) : (
            <DataTable
              rows={pendingLeaves}
              keyField="id"
              rowTestIdPrefix="pending-leave"
              columns={[
                { key: "employee_name", label: "Karyawan", primary: true, render: (lr) => (
                  <div>
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{lr.employee_name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{lr.doc_no}</div>
                  </div>
                ) },
                { key: "leave_type", label: "Jenis Cuti", render: (lr) => LEAVE_TYPE_LABELS[lr.leave_type] || lr.leave_type },
                { key: "periode", label: "Periode", render: (lr) => (
                  <span className="text-sm">{formatDateID(lr.start_date)} — {formatDateID(lr.end_date)}</span>
                ) },
                { key: "days_count", label: "Hari", align: "center", render: (lr) => <span className="font-semibold">{lr.days_count}</span> },
                { key: "notes", label: "Catatan", render: (lr) => (
                  <span className="text-sm text-muted-foreground max-w-32 truncate inline-block align-top">{lr.notes || "—"}</span>
                ) },
                { key: "status", label: "Status", render: (lr) => <LeaveStatusBadge status={lr.status} /> },
              ]}
              rowAction={(lr) => (
                <div className="flex gap-1 justify-end">
                  <Button size="sm" variant="default" className="text-xs h-7"
                    onClick={() => setApproveDialog({ id: lr.id, employee_name: lr.employee_name })}
                    data-testid={`approve-leave-${lr.id}`}>
                    <CheckCircle className="h-3 w-3 mr-1" /> Setujui
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs h-7 text-destructive hover:text-destructive"
                    onClick={() => setRejectDialog({ id: lr.id, employee_name: lr.employee_name })}
                    data-testid={`reject-leave-${lr.id}`}>
                    <XCircle className="h-3 w-3 mr-1" /> Tolak
                  </Button>
                </div>
              )}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <CreateLeaveDialog
        open={createDialog}
        onOpenChange={setCreateDialog}
        onCreated={() => { setCreateDialog(false); loadMyLeaves(); }}
        currentUserId={currentUserId}
      />

      {/* Approve Dialog */}
      <Dialog open={!!approveDialog} onOpenChange={o => !o && setApproveDialog(null)}>
        <DialogContent data-testid="approve-leave-dialog">
          <DialogHeader>
            <DialogTitle>Setujui Cuti</DialogTitle>
            <DialogDescription>
              Setujui pengajuan cuti untuk {approveDialog?.employee_name}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog(null)}>Batal</Button>
            <Button variant="default" onClick={handleApproveConfirm}
              data-testid="confirm-approve-leave">
              <CheckCircle className="h-4 w-4 mr-2" /> Ya, Setujui
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={o => !o && setRejectDialog(null)}>
        <DialogContent data-testid="reject-leave-dialog">
          <DialogHeader>
            <DialogTitle>Tolak Cuti</DialogTitle>
            <DialogDescription>
              Penolakan cuti untuk {rejectDialog?.employee_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Alasan Penolakan *</Label>
            <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="Jelaskan alasan penolakan..." rows={3}
              data-testid="leave-reject-reason" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleRejectConfirm}
              disabled={!rejectReason.trim()} data-testid="confirm-reject-leave">
              Tolak Cuti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function CreateLeaveDialog({ open, onOpenChange, onCreated, currentUserId }) {
  const [form, setForm] = useState({
    leave_type: "annual",
    start_date: "",
    end_date: "",
    days_count: "",
    notes: "",
    auto_submit: false,
  });
  const [submitting, setSubmitting] = useState(false);

  // Auto-calculate days_count
  useEffect(() => {
    if (form.start_date && form.end_date) {
      const sd = new Date(form.start_date);
      const ed = new Date(form.end_date);
      const diff = Math.max(1, Math.round((ed - sd) / (1000 * 60 * 60 * 24)) + 1);
      setForm(f => ({ ...f, days_count: diff }));
    }
  }, [form.start_date, form.end_date]);

  const handleSubmit = async () => {
    if (!form.start_date) { toast.error("Tanggal mulai wajib diisi"); return; }
    setSubmitting(true);
    try {
      const res = await api.post("/hr/leaves", { ...form, employee_id: currentUserId });
      if (res.data.success && form.auto_submit) {
        await api.post(`/hr/leaves/${res.data.data.id}/submit`);
        toast.success("Cuti berhasil diajukan");
      } else {
        toast.success("Draft cuti berhasil disimpan");
      }
      onCreated();
      setForm({ leave_type: "annual", start_date: "", end_date: "", days_count: "", notes: "", auto_submit: false });
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal membuat cuti");
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="create-leave-dialog">
        <DialogHeader>
          <DialogTitle>Ajukan Cuti Baru</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Jenis Cuti *</Label>
            <Select value={form.leave_type} onValueChange={v => setForm(f => ({ ...f, leave_type: v }))}>
              <SelectTrigger data-testid="leave-type-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(LEAVE_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tanggal Mulai *</Label>
              <Input type="date" value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                data-testid="leave-start-date" />
            </div>
            <div className="space-y-1">
              <Label>Tanggal Selesai</Label>
              <Input type="date" value={form.end_date} min={form.start_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                data-testid="leave-end-date" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Jumlah Hari</Label>
            <Input type="number" value={form.days_count} readOnly className="bg-muted/50"
              placeholder="Otomatis dihitung" />
          </div>
          <div className="space-y-1">
            <Label>Catatan / Keterangan</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Jelaskan keperluan cuti..." rows={2}
              data-testid="leave-notes" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="auto-submit" checked={form.auto_submit}
              onChange={e => setForm(f => ({ ...f, auto_submit: e.target.checked }))} />
            <label htmlFor="auto-submit" className="text-sm cursor-pointer">
              Langsung ajukan ke atasan
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSubmit} disabled={submitting} data-testid="confirm-create-leave">
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {form.auto_submit ? "Simpan & Ajukan" : "Simpan Draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
