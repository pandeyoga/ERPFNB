/**
 * LeaveRequests — HR Portal: leave request list, create, and approval queue.
 */
import { useState, useEffect, useCallback } from "react";
import {
  CalendarDays, Plus, Loader2, CheckCircle, XCircle, User, Send,
} from "lucide-react";
import { InlineHelp } from "@/components/shared/InlineHelp";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
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
    } catch { toast.error("Gagal memuat antrean persetujuan"); }
    finally { setLoading(false); }
  }, []);

  // Prefetch antrean persetujuan (diam-diam) supaya badge jumlah di tab
  // "Menunggu persetujuan" sudah tampil sebelum tab dibuka.
  useEffect(() => {
    api.get("/hr/leaves?pending=true&per_page=100")
      .then((res) => { if (res.data.success) setPendingLeaves(res.data.data.items || []); })
      .catch(() => {});
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
    <div className="space-y-3 lg:space-y-4" data-testid="leave-requests">
      <PageHeader
        icon={CalendarDays}
        title="Leave Requests"
        subtitle="Pengajuan cuti Anda & antrean persetujuan cuti karyawan"
        actions={
          <>
            <InlineHelp id="hr-leaves-page" size="sm" />
            <Button onClick={() => setCreateDialog(true)} data-testid="create-leave-btn">
              <Plus /> Ajukan Cuti
            </Button>
          </>
        }
      />

      {/* Leave Summary */}
      {leaveSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4" data-testid="leave-summary">
          {["annual", "sick", "personal", "emergency"].map(lt => (
            <CompactStatCard
              key={lt}
              size="sm"
              label={LEAVE_TYPE_LABELS[lt]}
              value={`${leaveSummary[lt]?.used || 0} / ${leaveSummary[lt]?.quota || 0} hari`}
              sub={`Sisa: ${leaveSummary[lt]?.remaining || 0} hari`}
              testId={`leave-summary-${lt}`}
            />
          ))}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="my" data-testid="tab-my-leaves">Cuti saya</TabsTrigger>
          <TabsTrigger value="approval" data-testid="tab-approval-queue">
            Menunggu persetujuan
            {pendingLeaves.length > 0 && (
              <Badge variant="destructive" className="ml-1 text-[11px] px-1.5 py-0">{pendingLeaves.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── MY LEAVES ─────────────────────────────────── */}
        <TabsContent value="my">
          {loading ? (
            <LoadingState rows={5} />
          ) : leaves.length === 0 ? (
            <div className="glass-card">
              <EmptyState icon={CalendarDays} title="Belum ada pengajuan cuti"
                description="Ajukan cuti untuk diproses oleh atasan / HR."
                action={<Button size="sm" variant="outline" onClick={() => setCreateDialog(true)}><Plus /> Ajukan Cuti</Button>} />
            </div>
          ) : (
            <div className="glass-card">
            <DataTable
              rows={leaves}
              keyField="doc_no"
              rowTestIdPrefix="leave-row"
              columns={[
                { key: "doc_no", label: "No", primary: true, render: (lr) => <span className="font-mono text-xs whitespace-nowrap">{lr.doc_no}</span> },
                { key: "leave_type", label: "Jenis", render: (lr) => LEAVE_TYPE_LABELS[lr.leave_type] || lr.leave_type },
                { key: "start_date", label: "Mulai", render: (lr) => formatDateID(lr.start_date) },
                { key: "end_date", label: "Selesai", render: (lr) => formatDateID(lr.end_date) },
                { key: "days_count", label: "Hari", align: "center", render: (lr) => <span className="font-semibold">{lr.days_count}</span> },
                { key: "status", label: "Status", render: (lr) => (
                  <div className="flex flex-col items-start gap-0.5">
                    <LeaveStatusBadge status={lr.status} />
                    {lr.rejection_reason && (
                      <span className="text-xs text-muted-foreground max-w-48 truncate" title={lr.rejection_reason}
                            data-testid={`leave-reject-reason-${lr.id}`}>
                        Alasan: {lr.rejection_reason}
                      </span>
                    )}
                  </div>
                ) },
              ]}
              rowAction={(lr) => (
                <div className="flex gap-1 justify-end">
                  {lr.status === "draft" && (
                    <Button size="sm" variant="outline"
                      onClick={() => handleSubmit(lr.id)} data-testid={`submit-leave-${lr.id}`}>
                      <Send /> Ajukan
                    </Button>
                  )}
                  {["draft", "submitted"].includes(lr.status) && (
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                      onClick={() => handleCancel(lr.id)} data-testid={`cancel-leave-${lr.id}`}>
                      Batalkan
                    </Button>
                  )}
                </div>
              )}
            />
            </div>
          )}
        </TabsContent>

        {/* ── APPROVAL QUEUE ─────────────────────────────── */}
        <TabsContent value="approval">
          {loading ? (
            <LoadingState rows={5} />
          ) : pendingLeaves.length === 0 ? (
            <div className="glass-card">
              <EmptyState icon={CheckCircle} title="Tidak ada cuti yang menunggu persetujuan"
                description="Semua pengajuan cuti sudah diproses." />
            </div>
          ) : (
            <div className="glass-card">
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
                    <div className="text-xs text-muted-foreground font-mono whitespace-nowrap">{lr.doc_no}</div>
                  </div>
                ) },
                { key: "leave_type", label: "Jenis Cuti", render: (lr) => LEAVE_TYPE_LABELS[lr.leave_type] || lr.leave_type },
                { key: "periode", label: "Periode", render: (lr) => (
                  <span className="text-sm whitespace-nowrap">{formatDateID(lr.start_date)} — {formatDateID(lr.end_date)}</span>
                ) },
                { key: "days_count", label: "Hari", align: "center", render: (lr) => <span className="font-semibold">{lr.days_count}</span> },
                { key: "notes", label: "Catatan", render: (lr) => (
                  <span className="text-sm text-muted-foreground max-w-32 truncate inline-block align-top">{lr.notes || "—"}</span>
                ) },
                { key: "status", label: "Status", render: (lr) => <LeaveStatusBadge status={lr.status} /> },
              ]}
              rowAction={(lr) => (
                <div className="flex gap-1 justify-end">
                  <Button size="sm" variant="default"
                    onClick={() => setApproveDialog({ id: lr.id, employee_name: lr.employee_name })}
                    data-testid={`approve-leave-${lr.id}`}>
                    <CheckCircle /> Setujui
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive hover:text-destructive"
                    onClick={() => { setRejectReason(""); setRejectDialog({ id: lr.id, employee_name: lr.employee_name }); }}
                    data-testid={`reject-leave-${lr.id}`}>
                    <XCircle /> Tolak
                  </Button>
                </div>
              )}
            />
            </div>
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
        <DialogContent className="max-w-md" data-testid="approve-leave-dialog">
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
              <CheckCircle /> Ya, Setujui
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={o => !o && setRejectDialog(null)}>
        <DialogContent className="max-w-md" data-testid="reject-leave-dialog">
          <DialogHeader>
            <DialogTitle>Tolak Cuti</DialogTitle>
            <DialogDescription>
              Penolakan cuti untuk {rejectDialog?.employee_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="leave-reject-reason">Alasan penolakan *</Label>
            <Textarea id="leave-reject-reason" value={rejectReason} onChange={e => setRejectReason(e.target.value)}
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
          <DialogDescription>Simpan sebagai draft atau langsung ajukan ke atasan.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="leave-type">Jenis Cuti *</Label>
            <Select value={form.leave_type} onValueChange={v => setForm(f => ({ ...f, leave_type: v }))}>
              <SelectTrigger id="leave-type" data-testid="leave-type-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(LEAVE_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="leave-start-date">Tanggal Mulai *</Label>
              <Input id="leave-start-date" type="date" value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                data-testid="leave-start-date" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="leave-end-date">Tanggal Selesai</Label>
              <Input id="leave-end-date" type="date" value={form.end_date} min={form.start_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                data-testid="leave-end-date" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="leave-days-count">Jumlah Hari</Label>
            <Input id="leave-days-count" type="number" value={form.days_count} readOnly className="bg-muted/50"
              placeholder="Otomatis dihitung" data-testid="leave-days-count" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="leave-notes">Catatan / Keterangan</Label>
            <Textarea id="leave-notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Jelaskan keperluan cuti..." rows={2}
              data-testid="leave-notes" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="auto-submit" className="h-4 w-4" checked={form.auto_submit}
              onChange={e => setForm(f => ({ ...f, auto_submit: e.target.checked }))}
              data-testid="leave-auto-submit" />
            <label htmlFor="auto-submit" className="text-sm cursor-pointer">
              Langsung ajukan ke atasan
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSubmit} disabled={submitting} data-testid="confirm-create-leave">
            {submitting && <Loader2 className="animate-spin" />}
            {form.auto_submit ? "Simpan & Ajukan" : "Simpan Draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
