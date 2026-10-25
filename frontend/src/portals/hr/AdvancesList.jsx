/** Employee Advances list (DataTable + schedule drill-down) + create dialog + approve. */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Wallet, CheckCircle2, AlertTriangle, XCircle, Send } from "lucide-react";
import { usePaginatedList } from "@/hooks/useListQuery";
import api, { unwrap, unwrapError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import StatusPill from "@/components/shared/StatusPill";
import EmptyState from "@/components/shared/EmptyState";
import DataTable from "@/components/shared/DataTable";
import PageHeader from "@/components/shared/PageHeader";
import { fmtRp, fmtDate, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import useOutletScope from "@/hooks/useOutletScope";
import { confirmDialog } from "@/components/shared/confirmDialog";

import { fetchAll } from "@/lib/api";
/** @param {{ embedded?: boolean }} props — embedded=true saat dirender sebagai tab di CompensationHub (tanpa PageHeader). */
export default function AdvancesList({ embedded = false }) {
  const { user } = useAuth();
  const { allOutlets: outlets } = useOutletScope();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [rejectFor, setRejectFor] = useState(null); // advance row being rejected
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const filters = useMemo(() => {
    const f = {};
    if (statusFilter) f.status = statusFilter;
    return f;
  }, [statusFilter]);

  const { data, isLoading: loading, refetch } = usePaginatedList("/hr/advances", filters, 1, 50);
  const items = data?.data || [];
  const meta = data?.meta || { total: 0, per_page: 50 };

  // Master data — employees & payment methods (rarely changes; cache 5min)
  const { data: employees = [] } = useQuery({
    queryKey: ["master", "employees", { per_page: 200 }],
    queryFn: async () => {
      const r = await fetchAll("/master/employees");
      return (unwrap(r) || []).filter((x) => x.status === "active");
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ["master", "payment-methods", { per_page: 50 }],
    queryFn: async () => {
      const r = await fetchAll("/master/payment-methods");
      return unwrap(r) || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const canApprove = (user?.permissions || []).includes("hr.advance.approve")
    || (user?.permissions || []).includes("*");
  const canCreate = (user?.permissions || []).includes("hr.advance.create")
    || canApprove;

  // Auto-open dialog when ?new=1
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setShowForm(true);
      const next = new URLSearchParams(searchParams);
      next.delete("new");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleApprove = async (id) => {
    try {
      await api.post(`/hr/advances/${id}/approve`, { note: "approved" });
      toast.success("Approval step disetujui");
      await refetch();
    } catch (e) {
      toast.error(unwrapError(e));
    }
  };

  const handleSubmitForApproval = async (id) => {
    if (!(await confirmDialog({ title: "Ajukan kasbon", description: "Ajukan kasbon ini untuk persetujuan?", confirmText: "Ajukan" }))) return;
    try {
      await api.post(`/hr/advances/${id}/submit`);
      toast.success("Kasbon diajukan untuk persetujuan");
      await refetch();
    } catch (e) {
      toast.error(unwrapError(e));
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectFor || !rejectReason.trim()) return;
    setRejecting(true);
    try {
      await api.post(`/hr/advances/${rejectFor.id}/reject`, { reason: rejectReason.trim() });
      toast.success("Kasbon ditolak");
      setRejectFor(null);
      setRejectReason("");
      await refetch();
    } catch (e) {
      toast.error(unwrapError(e));
    } finally {
      setRejecting(false);
    }
  };

  // Backend hanya menerima approve dari status submitted/awaiting_approval
  // (draft wajib diajukan dulu), jadi tombol Setujui tidak ditampilkan untuk draft.
  const rowActions = (it) => (
    <div className="inline-flex items-center gap-1.5">
      {it.status === "draft" && canCreate && (
        <Button size="sm" variant="outline"
                onClick={() => handleSubmitForApproval(it.id)}
                data-testid={`hr-adv-submit-${it.id}`}>
          <Send /> Ajukan
        </Button>
      )}
      {["submitted", "awaiting_approval"].includes(it.status) && canApprove && (
        <Button size="sm" variant="default"
                onClick={() => handleApprove(it.id)}
                data-testid={`hr-adv-approve-${it.id}`}>
          <CheckCircle2 /> Setujui
        </Button>
      )}
      {["submitted", "awaiting_approval"].includes(it.status) && canApprove && (
        <Button size="sm" variant="outline" className="text-destructive hover:text-destructive"
                onClick={() => { setRejectReason(""); setRejectFor(it); }}
                data-testid={`hr-adv-reject-${it.id}`}>
          <XCircle /> Tolak
        </Button>
      )}
    </div>
  );

  const createBtn = canCreate ? (
    <Button onClick={() => setShowForm(true)} data-testid="hr-adv-create">
      <Plus /> Buat Kasbon
    </Button>
  ) : null;

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="hr-advances-page">
      {!embedded && (
        <PageHeader icon={Wallet} title="Advances"
          subtitle="Kasbon karyawan & jadwal cicilan — dipotong otomatis saat payroll di-post"
          actions={createBtn} />
      )}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-48" aria-label="Filter status kasbon" data-testid="hr-adv-filter-status">
              <SelectValue placeholder="Semua status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="awaiting_approval">Menunggu Approval</SelectItem>
              <SelectItem value="repaying">Repaying</SelectItem>
              <SelectItem value="settled">Settled</SelectItem>
              <SelectItem value="rejected">Ditolak</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {embedded && createBtn}
      </div>

      <div className="glass-card" data-testid="hr-adv-table-card">
        <DataTable
          columns={[
            { key: "doc_no", label: "Doc No", primary: true, sortable: true, render: it => <span className="font-mono text-xs whitespace-nowrap" data-testid={`hr-adv-docno-${it.id}`}>{it.doc_no}</span> },
            { key: "employee_name", label: "Karyawan", sortable: true, render: it => it.employee_name || it.employee_id?.slice(0, 8) },
            { key: "advance_date", label: "Tanggal", sortable: true, render: it => <span className="whitespace-nowrap">{fmtDate(it.advance_date)}</span> },
            { key: "principal", label: "Principal", numeric: true, sortable: true, render: it => <span className="whitespace-nowrap">{fmtRp(it.principal)}</span> },
            { key: "terms_months", label: "Tenor", align: "center", sortable: true, render: it => `${it.terms_months}×` },
            { key: "monthly_installment", label: "Cicilan/Bln", numeric: true, sortable: true, render: it => <span className="whitespace-nowrap">{fmtRp(it.monthly_installment)}</span> },
            { key: "status", label: "Status", align: "center", sortable: true, render: it => <StatusPill status={it.status} /> },
          ]}
          rows={items}
          loading={loading}
          defaultSort={{ key: "advance_date", dir: "desc" }}
          renderExpanded={(it) => <AdvanceSchedule it={it} />}
          rowAction={rowActions}
          empty={<EmptyState icon={Wallet} title="Belum ada kasbon"
            description="Buat kasbon karyawan, sistem akan otomatis menghitung jadwal cicilan."
            action={canCreate ? (<Button size="sm" onClick={() => setShowForm(true)}>
              <Plus /> Buat Kasbon
            </Button>) : null} />}
          rowTestIdPrefix="hr-adv"
        />
        {items.length > 0 && (
          <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border/40" data-testid="hr-adv-count">
            {meta.total ?? items.length} kasbon
          </div>
        )}
      </div>

      <Dialog open={!!rejectFor} onOpenChange={(o) => { if (!o) setRejectFor(null); }}>
        <DialogContent className="max-w-md" data-testid="hr-adv-reject-dialog">
          <DialogHeader>
            <DialogTitle>Tolak Kasbon</DialogTitle>
            <DialogDescription>
              {rejectFor?.doc_no} · {rejectFor?.employee_name || "-"} · {fmtRp(rejectFor?.principal || 0)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="hr-adv-reject-reason">Alasan penolakan *</Label>
            <Textarea id="hr-adv-reject-reason" rows={3} value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Jelaskan alasan penolakan…"
                      data-testid="hr-adv-reject-reason" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectFor(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleRejectConfirm}
                    disabled={rejecting || !rejectReason.trim()}
                    data-testid="hr-adv-reject-confirm">
              {rejecting ? "Memproses…" : "Tolak Kasbon"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdvanceFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        employees={employees}
        outlets={outlets}
        paymentMethods={paymentMethods}
        onCreated={async () => { setShowForm(false); await refetch(); }}
      />
    </div>
  );
}

function AdvanceSchedule({ it }) {
  const sched = it.schedule || [];
  if (!sched.length) return <p className="text-sm text-muted-foreground">Belum ada jadwal cicilan.</p>;
  return (
    <div data-testid={`hr-adv-schedule-${it.id}`}>
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Jadwal Cicilan ({sched.length})
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {sched.map((s, idx) => (
          <div key={idx} className={cn("rounded-md border border-border/60 p-2.5 text-xs", s.paid && "opacity-60")}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono">{s.period}</span>
              {s.paid ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
            </div>
            <div className="font-semibold tabular-nums">{fmtRp(s.amount)}</div>
            <div className="text-muted-foreground">jatuh tempo {fmtDate(s.due_date)}</div>
          </div>
        ))}
      </div>
      {it.notes && <p className="text-xs text-muted-foreground mt-3">Catatan: {it.notes}</p>}
    </div>
  );
}

function AdvanceFormDialog({ open, onOpenChange, employees, outlets, paymentMethods, onCreated }) {
  const [form, setForm] = useState({
    employee_id: "", outlet_id: "", principal: "", terms_months: 4,
    advance_date: todayJakartaISO(), payment_method_id: "", reason: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const monthly = useMemo(() => {
    const p = Number(form.principal || 0);
    const t = Number(form.terms_months || 1);
    if (p <= 0 || t <= 0) return 0;
    return Math.round(p / t);
  }, [form.principal, form.terms_months]);

  const handleSubmit = async () => {
    if (!form.employee_id || !Number(form.principal)) {
      toast.error("Pilih karyawan & isi principal");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        employee_id: form.employee_id,
        outlet_id: form.outlet_id || undefined,
        principal: Number(form.principal),
        terms_months: Number(form.terms_months) || 1,
        advance_date: form.advance_date,
        payment_method_id: form.payment_method_id || undefined,
        reason: form.reason || undefined,
      };
      await api.post("/hr/advances", payload);
      toast.success("Kasbon dibuat (status: draft)");
      setForm({ employee_id: "", outlet_id: "", principal: "", terms_months: 4,
                advance_date: todayJakartaISO(), payment_method_id: "", reason: "" });
      await onCreated();
    } catch (e) {
      toast.error(unwrapError(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="hr-adv-form-dialog">
        <DialogHeader>
          <DialogTitle>Buat Kasbon Karyawan</DialogTitle>
          <DialogDescription>Buat permintaan kasbon — jadwal cicilan akan dihitung otomatis.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="hr-adv-employee">Karyawan *</Label>
            <Select value={form.employee_id} onValueChange={(v) => setForm(f => ({ ...f, employee_id: v }))}>
              <SelectTrigger id="hr-adv-employee" data-testid="hr-adv-employee"><SelectValue placeholder="Pilih karyawan" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {employees.map(e => (<SelectItem key={e.id} value={e.id}>{e.full_name} ({e.code})</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="hr-adv-outlet">Outlet</Label>
            <Select value={form.outlet_id || "none"} onValueChange={(v) => setForm(f => ({ ...f, outlet_id: v === "none" ? "" : v }))}>
              <SelectTrigger id="hr-adv-outlet" data-testid="hr-adv-outlet"><SelectValue placeholder="— ikuti karyawan —" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— ikuti karyawan —</SelectItem>
                {(outlets || []).map(o => (<SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="hr-adv-date">Tanggal *</Label>
              <Input id="hr-adv-date" type="date" value={form.advance_date}
                     onChange={(e) => setForm(f => ({ ...f, advance_date: e.target.value }))}
                     data-testid="hr-adv-date" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="hr-adv-payment-method">Metode Pembayaran</Label>
              <Select value={form.payment_method_id || "none"} onValueChange={(v) => setForm(f => ({ ...f, payment_method_id: v === "none" ? "" : v }))}>
                <SelectTrigger id="hr-adv-payment-method" data-testid="hr-adv-payment-method"><SelectValue placeholder="Cash default" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Cash default</SelectItem>
                  {paymentMethods.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="hr-adv-principal">Principal (Rp) *</Label>
              <Input id="hr-adv-principal" type="number" min="0" step="1000" value={form.principal}
                     onChange={(e) => setForm(f => ({ ...f, principal: e.target.value }))}
                     placeholder="2000000"
                     data-testid="hr-adv-principal" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="hr-adv-terms">Tenor (bulan) *</Label>
              <Input id="hr-adv-terms" type="number" min="1" max="24" value={form.terms_months}
                     onChange={(e) => setForm(f => ({ ...f, terms_months: e.target.value }))}
                     data-testid="hr-adv-terms" />
            </div>
          </div>
          {monthly > 0 && (
            <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 flex items-center justify-between text-sm" data-testid="hr-adv-monthly">
              <span className="text-muted-foreground">Cicilan per bulan</span>
              <span className="font-semibold tabular-nums">{fmtRp(monthly)}</span>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="hr-adv-reason">Alasan</Label>
            <Textarea id="hr-adv-reason" rows={2} value={form.reason}
                       onChange={(e) => setForm(f => ({ ...f, reason: e.target.value }))}
                       placeholder="Misal: kebutuhan keluarga"
                       data-testid="hr-adv-reason" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSubmit} disabled={submitting}
                  data-testid="hr-adv-submit">
            {submitting ? "Menyimpan…" : "Simpan Draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
