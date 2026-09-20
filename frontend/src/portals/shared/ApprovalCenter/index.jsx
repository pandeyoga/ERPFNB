/**
 * ApprovalCenter — Unified approval inbox for all entity types.
 * Tabs: My Queue | Delegations | History
 * 
 * Optimized with React Query for caching and request deduplication
 */
import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle, XCircle, Clock, AlertTriangle, ChevronRight,
  Users, Loader2, RefreshCw, Plus, Trash2, Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DataTable from "@/components/shared/DataTable";
import { Textarea } from "@/components/ui/textarea";
import api from "@/lib/api";
import { toast } from "sonner";
import { formatCurrency, formatDateID } from "@/lib/format";
import { useNavigate } from "react-router-dom";
import { queryKeys } from "@/lib/queryClient";
import { confirmDialog } from "@/components/shared/confirmDialog";

const ENTITY_LABELS = {
  purchase_request:  "Purchase Request",
  purchase_order:    "Purchase Order",
  stock_adjustment:  "Stock Adjustment",
  payment_request:   "Payment Request",
  employee_advance:  "Employee Advance",
  budget:            "Budget",
  leave_request:     "Leave Request",
  stock_transfer:    "Stock Transfer",
  ar_invoice:        "AR Invoice",
};

const ENTITY_COLORS = {
  purchase_request:  "bg-blue-100 text-blue-800",
  purchase_order:    "bg-indigo-100 text-indigo-800",
  stock_adjustment:  "bg-yellow-100 text-yellow-800",
  payment_request:   "bg-orange-100 text-orange-800",
  employee_advance:  "bg-purple-100 text-purple-800",
  budget:            "bg-teal-100 text-teal-800",
  leave_request:     "bg-pink-100 text-pink-800",
  stock_transfer:    "bg-cyan-100 text-cyan-800",
  ar_invoice:        "bg-green-100 text-green-800",
};

export default function ApprovalCenter({
  restrictedTypes = null,
  minAmount = null,
  outletOnly = false,
  title = "Approval Center",
  subtitle = "Semua persetujuan yang menunggu tindakan kamu",
} = {}) {
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState("all");
  const [rejectDialog, setRejectDialog] = useState(null); // { entity_type, entity_id, title }
  const [rejectReason, setRejectReason] = useState("");
  const [delegationDialog, setDelegationDialog] = useState(false);
  const [users, setUsers] = useState([]);
  const navigate = useNavigate();

  // Build query params for portal-specific filters
  const queryParams = (() => {
    const p = {};
    if (Array.isArray(restrictedTypes) && restrictedTypes.length > 0) {
      p.entity_types = restrictedTypes.join(",");
    }
    if (minAmount != null && Number(minAmount) > 0) {
      p.min_amount = minAmount;
    }
    if (outletOnly) p.outlet_only = "true";
    return p;
  })();

  // Filter ENTITY_LABELS by restrictedTypes (for chip filter UI)
  const visibleEntityLabels = Array.isArray(restrictedTypes) && restrictedTypes.length > 0
    ? Object.fromEntries(
        Object.entries(ENTITY_LABELS).filter(([k]) => restrictedTypes.includes(k))
      )
    : ENTITY_LABELS;

  // Use React Query for queue data
  const { data: queueData, isLoading, refetch: refetchQueue } = useQuery({
    queryKey: queryKeys.approvals.queue(queryParams),
    queryFn: async () => {
      const res = await api.get("/approvals/queue", { params: queryParams });
      return res.data.success ? (res.data.data.items || res.data.data || []) : [];
    },
    staleTime: 30 * 1000, // 30 seconds - approvals don't change that often
  });

  // Use React Query for counts
  const { data: counts = {} } = useQuery({
    queryKey: queryKeys.approvals.counts(queryParams),
    queryFn: async () => {
      const res = await api.get("/approvals/counts", { params: queryParams });
      return res.data.success ? (res.data.data || {}) : {};
    },
    staleTime: 30 * 1000,
  });

  const queue = queueData || [];

  // Use React Query for delegations
  const { data: delegations = [], refetch: refetchDelegations } = useQuery({
    queryKey: queryKeys.approvals.delegations,
    queryFn: async () => {
      const res = await api.get("/approvals/delegations?role=delegator");
      return res.data.success ? (res.data.data || []) : [];
    },
    staleTime: 60 * 1000, // 1 minute
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async ({ entity_type, entity_id }) => {
      return await api.post("/approvals/quick-action", {
        entity_type,
        entity_id,
        action: "approve",
      });
    },
    onSuccess: (_, variables) => {
      toast.success(`${ENTITY_LABELS[variables.entity_type] || variables.entity_type} disetujui`);
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.queue(queryParams) });
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.counts(queryParams) });
    },
    onError: (e) => {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal menyetujui");
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ entity_type, entity_id, reason }) => {
      return await api.post("/approvals/quick-action", {
        entity_type,
        entity_id,
        action: "reject",
        reason,
      });
    },
    onSuccess: () => {
      toast.success("Ditolak");
      setRejectDialog(null);
      setRejectReason("");
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.queue(queryParams) });
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.counts(queryParams) });
    },
    onError: (e) => {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal menolak");
    },
  });

  const handleApprove = (item) => {
    approveMutation.mutate({
      entity_type: item.entity_type,
      entity_id: item.entity_id,
    });
  };

  const handleRejectConfirm = () => {
    if (!rejectDialog || !rejectReason.trim()) {
      toast.error("Masukkan alasan penolakan");
      return;
    }
    rejectMutation.mutate({
      entity_type: rejectDialog.entity_type,
      entity_id: rejectDialog.entity_id,
      reason: rejectReason,
    });
  };

  const handleRevokeDelegation = async (id) => {
    if (!(await confirmDialog("Cabut delegasi ini?"))) return;
    try {
      await api.delete(`/approvals/delegations/${id}`);
      toast.success("Delegasi dicabut");
      refetchDelegations();
    } catch { toast.error("Gagal mencabut delegasi"); }
  };

  const filtered = filterType === "all"
    ? queue
    : queue.filter(i => i.entity_type === filterType);

  const totalPending = typeof counts.total === "number" ? counts.total : queue.length;

  // Breakdown tiles must reconcile to Total Pending. Previously this used a fixed
  // `.slice(0, 4)` of entity types, which permanently hid categories like
  // leave_request — so the tiles never summed to the total. Now we surface the
  // entity types that actually have pending items (sorted by count desc); when
  // nothing is pending we fall back to the first few types just for layout.
  const byEntity = counts.by_entity || {};
  const breakdownEntries = (() => {
    const withCounts = Object.entries(visibleEntityLabels)
      .filter(([k]) => (byEntity[k] || 0) > 0)
      .sort((a, b) => (byEntity[b[0]] || 0) - (byEntity[a[0]] || 0));
    return withCounts.length > 0
      ? withCounts
      : Object.entries(visibleEntityLabels).slice(0, 4);
  })();

  return (
    <div className="space-y-6" data-testid="approval-center">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <CheckCircle className="h-6 w-6 text-primary" /> {title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {subtitle}
            {minAmount != null && Number(minAmount) > 0 && (
              <span className="ml-1 text-amber-600">
                · Filter aktif: nilai ≥ {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(minAmount))}
              </span>
            )}
            {outletOnly && (
              <span className="ml-1 text-blue-600">· Lingkup outlet kamu</span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchQueue()} data-testid="refresh-queue-btn">
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="approval-kpi">
        <Card className="border-primary/30 bg-primary/5 col-span-2 md:col-span-1">
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total Pending</div>
            <div className="text-3xl font-bold text-primary">{totalPending}</div>
          </CardContent>
        </Card>
        {breakdownEntries.map(([k, label]) => (
          <Card key={k} className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setFilterType(k)} data-testid={`kpi-${k}`}>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="text-2xl font-bold">
                {(counts.by_entity || {})[k] || 0}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue" data-testid="tab-queue">
            My Queue
            {totalPending > 0 && (
              <Badge variant="destructive" className="ml-2 px-1.5 py-0 text-xs">{totalPending}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="delegation" data-testid="tab-delegation" onClick={() => refetchDelegations()}>
            Delegasi
          </TabsTrigger>
        </TabsList>

        {/* ── QUEUE TAB ─────────────────────────────────── */}
        <TabsContent value="queue" className="mt-4">
          {/* Type Filter */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <Button size="sm" variant={filterType === "all" ? "default" : "outline"}
              onClick={() => setFilterType("all")}>Semua</Button>
            {Object.entries(visibleEntityLabels).map(([k, label]) => (
              (counts.by_entity || {})[k] > 0 && (
                <Button key={k} size="sm"
                  variant={filterType === k ? "default" : "outline"}
                  onClick={() => setFilterType(k)}
                  data-testid={`filter-${k}`}>
                  {label} ({(counts.by_entity || {})[k]})
                </Button>
              )
            ))}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-16 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mb-3 text-green-500" />
                <p className="font-medium">Tidak ada pending approval</p>
                <p className="text-sm">Semua sudah ditangani!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map((item) => (
                <ApprovalQueueItem
                  key={`${item.entity_type}-${item.entity_id}`}
                  item={item}
                  loading={approveMutation.isPending || rejectMutation.isPending}
                  onApprove={() => handleApprove(item)}
                  onReject={() => setRejectDialog(item)}
                  onNavigate={() => item.link && navigate(item.link)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── DELEGATION TAB ─────────────────────────────── */}
        <TabsContent value="delegation" className="mt-4">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-semibold">Delegasi Aktif</h3>
              <p className="text-sm text-muted-foreground">Approval yang kamu delegasikan ke orang lain</p>
            </div>
            <Button size="sm" onClick={() => { refetchDelegations(); setDelegationDialog(true); }}
              data-testid="create-delegation-btn">
              <Plus className="h-4 w-4 mr-1" /> Tambah Delegasi
            </Button>
          </div>

          <DataTable
            rows={delegations}
            keyField="id"
            rowTestIdPrefix="delegation-row"
            empty={(
              <Card>
                <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
                  <Users className="h-10 w-10 mb-2" />
                  <p>Belum ada delegasi aktif</p>
                </CardContent>
              </Card>
            )}
            columns={[
              { key: "delegate", label: "Delegasi ke", primary: true,
                render: (d) => <span className="font-medium">{d.delegate_name || d.delegate_id}</span> },
              { key: "entity_types", label: "Tipe Approval",
                render: (d) => ((d.entity_types?.length > 0)
                  ? d.entity_types.map(et => (
                      <Badge key={et} variant="outline" className="mr-1 text-xs">{ENTITY_LABELS[et] || et}</Badge>
                    ))
                  : <Badge variant="outline" className="text-xs">Semua Tipe</Badge>) },
              { key: "period", label: "Periode",
                render: (d) => (
                  <span className="text-sm">
                    {d.from_date && <span>{formatDateID(d.from_date)}</span>}
                    {d.to_date && <span> s/d {formatDateID(d.to_date)}</span>}
                    {!d.from_date && !d.to_date && <span className="text-muted-foreground">Tidak terbatas</span>}
                  </span>
                ) },
              { key: "reason", label: "Alasan",
                render: (d) => <span className="text-sm text-muted-foreground">{d.reason || "—"}</span> },
            ]}
            rowAction={(d) => (
              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500"
                onClick={() => handleRevokeDelegation(d.id)}
                aria-label="Cabut delegasi"
                data-testid={`revoke-delegation-${d.id}`}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          />
        </TabsContent>
      </Tabs>

      {/* ── Reject Dialog ─── */}
      <Dialog open={!!rejectDialog} onOpenChange={(o) => !o && setRejectDialog(null)}>
        <DialogContent data-testid="reject-dialog">
          <DialogHeader>
            <DialogTitle>Tolak Approval</DialogTitle>
            <DialogDescription>
              {ENTITY_LABELS[rejectDialog?.entity_type] || ""}: {rejectDialog?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Alasan Penolakan *</Label>
            <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="Jelaskan alasan penolakan..." rows={3}
              data-testid="reject-reason-input" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleRejectConfirm}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              data-testid="confirm-reject-btn">
              {rejectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Tolak
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delegation Create Dialog ─── */}
      <DelegationCreateDialog
        open={delegationDialog}
        onOpenChange={setDelegationDialog}
        onCreated={() => { setDelegationDialog(false); refetchDelegations(); }}
      />
    </div>
  );
}


// ── Queue Item Card ──────────────────────────────────────────

function ApprovalQueueItem({ item, loading, onApprove, onReject, onNavigate }) {
  const isOverdue = item.is_overdue;
  const nearDeadline = item.hours_until_deadline != null && item.hours_until_deadline < 4 && !isOverdue;

  return (
    <Card
      className={`transition-all ${isOverdue ? "border-red-300 bg-red-50 dark:bg-red-950/20" : nearDeadline ? "border-amber-300" : ""}`}
      data-testid={`queue-item-${item.entity_type}-${item.entity_id}`}
    >
      <CardContent className="py-3 px-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left: info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ENTITY_COLORS[item.entity_type] || "bg-gray-100 text-gray-700"}`}>
                {ENTITY_LABELS[item.entity_type] || item.entity_type}
              </span>
              {isOverdue && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Terlambat {Math.abs(item.hours_until_deadline || 0).toFixed(0)}j
                </Badge>
              )}
              {nearDeadline && !isOverdue && (
                <Badge variant="outline" className="text-xs border-amber-500 text-amber-700">
                  <Clock className="h-3 w-3 mr-1" />
                  Deadline {item.hours_until_deadline?.toFixed(1)}j lagi
                </Badge>
              )}
              {item.is_delegated && (
                <Badge variant="outline" className="text-xs text-purple-700 border-purple-300">
                  Delegasi
                </Badge>
              )}
            </div>
            <div className="mt-1 font-medium truncate">{item.title}</div>
            <div className="text-sm text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
              {item.current_step_label && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Step: {item.current_step_label}
                </span>
              )}
              {item.amount != null && (
                <span className="tabular-nums">{item.amount_label || "Nilai"}: {formatCurrency(item.amount)}</span>
              )}
              {item.days_count != null && (
                <span>{item.days_count} hari</span>
              )}
              {item.created_by_name && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" /> {item.created_by_name}
                </span>
              )}
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2 shrink-0">
            {item.link && (
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onNavigate} title="Lihat detail" aria-label="Lihat detail">
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50"
              onClick={onReject} disabled={loading}
              data-testid={`reject-btn-${item.entity_id}`}>
              <XCircle className="h-4 w-4 mr-1" /> Tolak
            </Button>
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
              onClick={onApprove} disabled={loading}
              data-testid={`approve-btn-${item.entity_id}`}>
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <><CheckCircle className="h-4 w-4 mr-1" /> Setujui</>}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


// ── Delegation Create Dialog ─────────────────────────────────

function DelegationCreateDialog({ open, onOpenChange, onCreated }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    delegate_id: "", entity_types: [], reason: "", from_date: "", to_date: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.get("/admin/users?per_page=200&status=active").then(res => {
      if (res.data.success) setUsers(res.data.data.items || []);
    }).catch(() => {});
  }, [open]);

  const toggleEntityType = (et) => {
    setForm(f => ({
      ...f,
      entity_types: f.entity_types.includes(et)
        ? f.entity_types.filter(x => x !== et)
        : [...f.entity_types, et],
    }));
  };

  const handleSubmit = async () => {
    if (!form.delegate_id) { toast.error("Pilih user tujuan delegasi"); return; }
    setSubmitting(true);
    try {
      await api.post("/approvals/delegations", form);
      toast.success("Delegasi berhasil dibuat");
      onCreated();
      setForm({ delegate_id: "", entity_types: [], reason: "", from_date: "", to_date: "" });
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal membuat delegasi");
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="delegation-create-dialog">
        <DialogHeader>
          <DialogTitle>Buat Delegasi Approval</DialogTitle>
          <DialogDescription>
            Delegasikan hak persetujuan kamu ke orang lain untuk sementara (misal: saat cuti).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Delegasikan ke *</Label>
            <Select value={form.delegate_id} onValueChange={v => setForm(f => ({ ...f, delegate_id: v }))}>
              <SelectTrigger data-testid="delegate-user-select">
                <SelectValue placeholder="Pilih user..." />
              </SelectTrigger>
              <SelectContent>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.full_name} ({u.email})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tipe Approval yang Didelegasikan</Label>
            <p className="text-xs text-muted-foreground">Kosong = semua tipe</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(ENTITY_LABELS).map(([k, label]) => (
                <button key={k}
                  type="button"
                  onClick={() => toggleEntityType(k)}
                  className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                    form.entity_types.includes(k)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/30 hover:border-primary"
                  }`}
                  data-testid={`toggle-entity-${k}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Dari Tanggal</Label>
              <Input type="date" value={form.from_date}
                onChange={e => setForm(f => ({ ...f, from_date: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Sampai Tanggal</Label>
              <Input type="date" value={form.to_date}
                onChange={e => setForm(f => ({ ...f, to_date: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Alasan (opsional)</Label>
            <Input value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="Misal: Cuti tahunan 15-20 Mei" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSubmit} disabled={submitting} data-testid="confirm-delegation-btn">
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Buat Delegasi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
