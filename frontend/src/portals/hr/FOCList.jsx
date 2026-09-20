/** FOC — log list (DataTable) + create dialog by type. */
import { useEffect, useMemo, useState } from "react";
import { Plus, Coffee } from "lucide-react";
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
import useOutletScope from "@/hooks/useOutletScope";

const FOC_LABELS = {
  staff_meal: "Staff Meal",
  marketing: "Marketing",
  customer_comp: "Customer Comp",
  other: "Other",
};

export default function FOCList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [outletFilter, setOutletFilter] = useState("");
  // Bug fix 2026-05-26: useOutletScope was imported but never invoked.
  const { scopedOutlets: outlets } = useOutletScope();

  const outletMap = useMemo(
    () => Object.fromEntries((outlets || []).map(o => [o.id, o])),
    [outlets],
  );

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/hr/foc", {
        params: {
          foc_type: typeFilter || undefined,
          outlet_id: outletFilter || undefined,
          per_page: 50,
        },
      });
      setItems(unwrap(r) || []);
    } finally {
      setLoading(false);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [typeFilter, outletFilter]);

  return (
    <div className="space-y-4" data-testid="hr-foc-page">
      <div className="flex items-center justify-between flex-wrap gap-3" data-testid="hr-foc-toolbar">
        <div className="flex items-center gap-2 flex-wrap" data-testid="hr-foc-filters">
          <Select value={typeFilter || "all"} onValueChange={(v) => setTypeFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-44" data-testid="hr-foc-filter-type"><SelectValue placeholder="Semua tipe" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua tipe</SelectItem>
              {Object.entries(FOC_LABELS).map(([k, l]) => (<SelectItem key={k} value={k}>{l}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={outletFilter || "all"} onValueChange={(v) => setOutletFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-48" data-testid="hr-foc-filter-outlet"><SelectValue placeholder="Semua outlet" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua outlet</SelectItem>
              {outlets.map(o => (<SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setShowForm(true)} className="rounded-full" data-testid="hr-foc-create">
          <Plus className="h-4 w-4 mr-2" /> Catat FOC
        </Button>
      </div>

      <div className="glass-card" data-testid="hr-foc-table-card">
        <DataTable
          columns={[
            { key: "doc_no", label: "Doc No", primary: true, sortable: true, render: it => <span className="font-mono text-xs" data-testid={`hr-foc-docno-${it.id}`}>{it.doc_no}</span> },
            { key: "foc_date", label: "Date", sortable: true, render: it => fmtDate(it.foc_date) },
            { key: "outlet", label: "Outlet", render: it => outletMap[it.outlet_id]?.name || it.outlet_id?.slice(0, 8) },
            { key: "foc_type", label: "Type", sortable: true, render: it => <span className="text-xs" data-testid={`hr-foc-type-${it.id}`}>{FOC_LABELS[it.foc_type] || it.foc_type}</span> },
            { key: "beneficiary", label: "Beneficiary", render: it => <span className="text-xs text-muted-foreground">{it.beneficiary || "—"}</span> },
            { key: "amount", label: "Amount", numeric: true, sortable: true, render: it => <span data-testid={`hr-foc-amount-${it.id}`}>{fmtRp(it.amount)}</span> },
            { key: "status", label: "Status", align: "center", sortable: true, render: it => <StatusPill status={it.status} /> },
          ]}
          rows={items}
          loading={loading}
          defaultSort={{ key: "foc_date", dir: "desc" }}
          empty={<EmptyState icon={Coffee} title="Belum ada FOC"
            description="Catat staff meal, marketing, customer compensation, atau FOC lainnya." />}
          rowTestIdPrefix="hr-foc-row"
        />
      </div>

      <FOCFormDialog open={showForm} onOpenChange={setShowForm}
        outlets={outlets}
        onCreated={async () => { setShowForm(false); await load(); }} />
    </div>
  );
}

function FOCFormDialog({ open, onOpenChange, outlets, onCreated }) {
  const [form, setForm] = useState({
    outlet_id: "", foc_date: todayJakartaISO(), foc_type: "staff_meal",
    amount: "", beneficiary: "", notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.outlet_id || !Number(form.amount)) {
      return toast.error("Pilih outlet & isi amount");
    }
    setSubmitting(true);
    try {
      await api.post("/hr/foc", {
        outlet_id: form.outlet_id,
        foc_date: form.foc_date,
        foc_type: form.foc_type,
        amount: Number(form.amount),
        beneficiary: form.beneficiary || undefined,
        notes: form.notes || undefined,
      });
      toast.success("FOC dicatat & dijurnal");
      setForm({ outlet_id: "", foc_date: todayJakartaISO(), foc_type: "staff_meal",
                 amount: "", beneficiary: "", notes: "" });
      await onCreated();
    } catch (e) {
      toast.error(unwrapError(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="hr-foc-form-dialog">
        <DialogHeader>
          <DialogTitle>Catat FOC (Free of Charge)</DialogTitle>
          <DialogDescription>Auto-jurnal: Dr expense by type, Cr Inventory.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tanggal</Label>
              <Input type="date" value={form.foc_date}
                      onChange={(e) => setForm(f => ({ ...f, foc_date: e.target.value }))}
                      data-testid="hr-foc-date" />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={form.foc_type} onValueChange={(v) => setForm(f => ({ ...f, foc_type: v }))}>
                <SelectTrigger data-testid="hr-foc-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FOC_LABELS).map(([k, l]) => (<SelectItem key={k} value={k}>{l}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Outlet *</Label>
            <Select value={form.outlet_id} onValueChange={(v) => setForm(f => ({ ...f, outlet_id: v }))}>
              <SelectTrigger data-testid="hr-foc-outlet"><SelectValue placeholder="Pilih outlet" /></SelectTrigger>
              <SelectContent>
                {outlets.map(o => (<SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Amount (Rp) *</Label>
              <Input type="number" min="0" step="1000" value={form.amount}
                      onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                      data-testid="hr-foc-amount" />
            </div>
            <div className="space-y-1">
              <Label>Beneficiary</Label>
              <Input value={form.beneficiary}
                      onChange={(e) => setForm(f => ({ ...f, beneficiary: e.target.value }))}
                      placeholder="Karyawan / event / customer"
                      data-testid="hr-foc-beneficiary" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes}
                       onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                       data-testid="hr-foc-notes" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="hr-foc-cancel">Batal</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="rounded-full"
                  data-testid="hr-foc-submit">
            {submitting ? "Menyimpan…" : "Simpan & Post"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
