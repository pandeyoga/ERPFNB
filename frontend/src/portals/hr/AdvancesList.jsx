/** Employee Advances list (DataTable + schedule drill-down) + create dialog + approve. */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Wallet, CheckCircle2, AlertTriangle } from "lucide-react";
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
import { fmtRp, fmtDate, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import useOutletScope from "@/hooks/useOutletScope";
import { confirmDialog } from "@/components/shared/confirmDialog";

export default function AdvancesList() {
  const { user } = useAuth();
  const { allOutlets: outlets } = useOutletScope();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");

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
      const r = await api.get("/master/employees", { params: { per_page: 200 } });
      return (unwrap(r) || []).filter((x) => x.status === "active");
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ["master", "payment-methods", { per_page: 50 }],
    queryFn: async () => {
      const r = await api.get("/master/payment-methods", { params: { per_page: 50 } });
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
    if (!(await confirmDialog("Submit kasbon untuk approval?"))) return;
    try {
      await api.post(`/hr/advances/${id}/submit`);
      toast.success("Submit untuk approval");
      await refetch();
    } catch (e) {
      toast.error(unwrapError(e));
    }
  };

  const handleReject = async (id) => {
    const reason = prompt("Alasan reject?");
    if (!reason || !reason.trim()) return;
    try {
      await api.post(`/hr/advances/${id}/reject`, { reason });
      toast.success("Kasbon ditolak");
      await refetch();
    } catch (e) {
      toast.error(unwrapError(e));
    }
  };

  const rowActions = (it) => (
    <div className="inline-flex items-center gap-1.5">
      {it.status === "draft" && canCreate && (
        <Button size="sm" variant="outline" className="rounded-full"
                onClick={() => handleSubmitForApproval(it.id)}
                data-testid={`hr-adv-submit-${it.id}`}>
          Submit
        </Button>
      )}
      {(it.status === "draft" || it.status === "awaiting_approval") && canApprove && (
        <Button size="sm" variant="default" className="rounded-full"
                onClick={() => handleApprove(it.id)}
                data-testid={`hr-adv-approve-${it.id}`}>
          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
        </Button>
      )}
      {it.status === "awaiting_approval" && canApprove && (
        <Button size="sm" variant="outline" className="rounded-full text-red-600"
                onClick={() => handleReject(it.id)}
                data-testid={`hr-adv-reject-${it.id}`}>
          Reject
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-4" data-testid="hr-advances-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-44" data-testid="hr-adv-filter-status">
              <SelectValue placeholder="Semua status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="repaying">Repaying</SelectItem>
              <SelectItem value="settled">Settled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {canCreate && (
          <Button onClick={() => setShowForm(true)} className="rounded-full" data-testid="hr-adv-create">
            <Plus className="h-4 w-4 mr-2" /> Kasbon Baru
          </Button>
        )}
      </div>

      <div className="glass-card" data-testid="hr-adv-table-card">
        <DataTable
          columns={[
            { key: "doc_no", label: "Doc No", primary: true, sortable: true, render: it => <span className="font-mono text-xs" data-testid={`hr-adv-docno-${it.id}`}>{it.doc_no}</span> },
            { key: "employee_name", label: "Karyawan", sortable: true, render: it => it.employee_name || it.employee_id?.slice(0, 8) },
            { key: "advance_date", label: "Tanggal", sortable: true, render: it => fmtDate(it.advance_date) },
            { key: "principal", label: "Principal", numeric: true, sortable: true, render: it => fmtRp(it.principal) },
            { key: "terms_months", label: "Tenor", align: "center", sortable: true, render: it => `${it.terms_months}×` },
            { key: "monthly_installment", label: "Cicilan/Bln", numeric: true, sortable: true, render: it => fmtRp(it.monthly_installment) },
            { key: "status", label: "Status", align: "center", sortable: true, render: it => <StatusPill status={it.status} /> },
          ]}
          rows={items}
          loading={loading}
          defaultSort={{ key: "advance_date", dir: "desc" }}
          renderExpanded={(it) => <AdvanceSchedule it={it} />}
          rowAction={rowActions}
          empty={<EmptyState icon={Wallet} title="Belum ada kasbon"
            description="Buat kasbon karyawan, sistem akan otomatis menghitung jadwal cicilan."
            action={canCreate ? (<Button onClick={() => setShowForm(true)} className="rounded-full">
              <Plus className="h-4 w-4 mr-2" /> Buat Kasbon
            </Button>) : null} />}
          rowTestIdPrefix="hr-adv"
        />
        {items.length > 0 && (
          <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border/40" data-testid="hr-adv-count">
            {meta.total ?? items.length} kasbon
          </div>
        )}
      </div>

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
        Schedule Cicilan ({sched.length})
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {sched.map((s, idx) => (
          <div key={idx} className={cn("glass-card-hover p-3 text-xs", s.paid && "opacity-60")}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono">{s.period}</span>
              {s.paid ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
            </div>
            <div className="font-semibold tabular-nums">{fmtRp(s.amount)}</div>
            <div className="text-muted-foreground">due {fmtDate(s.due_date)}</div>
          </div>
        ))}
      </div>
      {it.notes && <p className="text-xs text-muted-foreground mt-3">Notes: {it.notes}</p>}
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
          <DialogTitle>Kasbon Karyawan Baru</DialogTitle>
          <DialogDescription>Buat permintaan kasbon — jadwal cicilan akan dihitung otomatis.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Karyawan *</Label>
            <Select value={form.employee_id} onValueChange={(v) => setForm(f => ({ ...f, employee_id: v }))}>
              <SelectTrigger data-testid="hr-adv-employee"><SelectValue placeholder="Pilih karyawan" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {employees.map(e => (<SelectItem key={e.id} value={e.id}>{e.full_name} ({e.code})</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Outlet</Label>
            <Select value={form.outlet_id || "none"} onValueChange={(v) => setForm(f => ({ ...f, outlet_id: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="— ikuti karyawan—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— ikuti karyawan —</SelectItem>
                {(outlets || []).map(o => (<SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tanggal *</Label>
              <Input type="date" value={form.advance_date}
                     onChange={(e) => setForm(f => ({ ...f, advance_date: e.target.value }))}
                     data-testid="hr-adv-date" />
            </div>
            <div className="space-y-1">
              <Label>Metode Pembayaran</Label>
              <Select value={form.payment_method_id || "none"} onValueChange={(v) => setForm(f => ({ ...f, payment_method_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Cash default" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Cash default</SelectItem>
                  {paymentMethods.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Principal (Rp) *</Label>
              <Input type="number" min="0" step="1000" value={form.principal}
                     onChange={(e) => setForm(f => ({ ...f, principal: e.target.value }))}
                     placeholder="2000000"
                     data-testid="hr-adv-principal" />
            </div>
            <div className="space-y-1">
              <Label>Tenor (bulan)</Label>
              <Input type="number" min="1" max="24" value={form.terms_months}
                     onChange={(e) => setForm(f => ({ ...f, terms_months: e.target.value }))}
                     data-testid="hr-adv-terms" />
            </div>
          </div>
          {monthly > 0 && (
            <div className="glass-card-hover p-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Cicilan per bulan:</span>
              <span className="font-bold tabular-nums">{fmtRp(monthly)}</span>
            </div>
          )}
          <div className="space-y-1">
            <Label>Alasan</Label>
            <Textarea rows={2} value={form.reason}
                       onChange={(e) => setForm(f => ({ ...f, reason: e.target.value }))}
                       placeholder="Misal: kebutuhan keluarga"
                       data-testid="hr-adv-reason" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="rounded-full"
                  data-testid="hr-adv-submit">
            {submitting ? "Menyimpan…" : "Simpan Draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
