/**
 * ApprovalDelegations — daftar + pembuatan delegasi approval (mis. saat cuti).
 *
 * Dipindahkan dari portals/shared/ApprovalCenter (yang tidak pernah ter-render karena
 * semua route approval mengarah ke Pusat Persetujuan) supaya fitur delegasi bisa
 * dijangkau lagi dari tab "Delegasi" di /my-approvals.
 */
import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import api, { unwrap } from "@/lib/api";
import { formatDateID } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import { confirmDialog } from "@/components/shared/confirmDialog";

export const APPROVAL_ENTITY_LABELS = {
  purchase_request: "Purchase Request",
  purchase_order: "Purchase Order",
  stock_adjustment: "Stock Adjustment",
  payment_request: "Payment Request",
  employee_advance: "Employee Advance",
  budget: "Budget",
  leave_request: "Leave Request",
  stock_transfer: "Stock Transfer",
  ar_invoice: "AR Invoice",
};

const EMPTY_FORM = { delegate_id: "", entity_types: [], reason: "", from_date: "", to_date: "" };

export default function ApprovalDelegations() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/approvals/delegations", { params: { role: "delegator" } });
      setRows(unwrap(res) || []);
    } catch {
      toast.error("Gagal memuat delegasi");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function revoke(id) {
    if (!(await confirmDialog("Cabut delegasi ini?"))) return;
    try {
      await api.delete(`/approvals/delegations/${id}`);
      toast.success("Delegasi dicabut");
      load();
    } catch {
      toast.error("Gagal mencabut delegasi");
    }
  }

  return (
    <div className="space-y-3" data-testid="approval-delegations">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base md:text-lg font-semibold">Delegasi Aktif</h2>
          <p className="text-xs md:text-sm text-muted-foreground">Approval yang Anda delegasikan ke orang lain untuk sementara.</p>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="create-delegation-btn">
          <Plus /> Tambah Delegasi
        </Button>
      </div>

      <DataTable
        rows={rows}
        loading={loading}
        keyField="id"
        rowTestIdPrefix="delegation-row"
        empty={
          <EmptyState
            icon={Users}
            title="Belum ada delegasi aktif"
            description="Buat delegasi saat Anda cuti agar dokumen tetap bisa disetujui."
          />
        }
        columns={[
          { key: "delegate", label: "Delegasi ke", primary: true,
            render: (d) => <span className="font-medium">{d.delegate_name || d.delegate_id}</span> },
          { key: "entity_types", label: "Tipe Approval",
            render: (d) => (d.entity_types?.length > 0
              ? d.entity_types.map((et) => (
                  <Badge key={et} variant="outline" className="mr-1 text-xs">{APPROVAL_ENTITY_LABELS[et] || et}</Badge>
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
          <Button size="icon-sm" variant="ghost" className="text-rose-700 dark:text-rose-400"
            onClick={() => revoke(d.id)}
            aria-label="Cabut delegasi"
            data-testid={`revoke-delegation-${d.id}`}>
            <Trash2 />
          </Button>
        )}
      />

      <DelegationCreateDialog open={open} onOpenChange={setOpen} onCreated={() => { setOpen(false); load(); }} />
    </div>
  );
}

function DelegationCreateDialog({ open, onOpenChange, onCreated }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.get("/admin/users", { params: { per_page: 200, status: "active" } })
      .then((res) => { const d = unwrap(res); setUsers(d?.items || d || []); })
      .catch(() => {});
  }, [open]);

  const toggleEntityType = (et) => {
    setForm((f) => ({
      ...f,
      entity_types: f.entity_types.includes(et) ? f.entity_types.filter((x) => x !== et) : [...f.entity_types, et],
    }));
  };

  const handleSubmit = async () => {
    if (!form.delegate_id) { toast.error("Pilih user tujuan delegasi"); return; }
    setSubmitting(true);
    try {
      await api.post("/approvals/delegations", form);
      toast.success("Delegasi berhasil dibuat");
      setForm(EMPTY_FORM);
      onCreated();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal membuat delegasi");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="delegation-create-dialog">
        <DialogHeader>
          <DialogTitle>Buat Delegasi Approval</DialogTitle>
          <DialogDescription>
            Delegasikan hak persetujuan Anda ke orang lain untuk sementara (mis. saat cuti).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Delegasikan ke *</Label>
            <Select value={form.delegate_id} onValueChange={(v) => setForm((f) => ({ ...f, delegate_id: v }))}>
              <SelectTrigger data-testid="delegate-user-select">
                <SelectValue placeholder="Pilih user…" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.full_name} ({u.email})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Tipe Approval yang Didelegasikan</Label>
            <p className="text-xs text-muted-foreground">Kosongkan untuk semua tipe.</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(APPROVAL_ENTITY_LABELS).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggleEntityType(k)}
                  aria-pressed={form.entity_types.includes(k)}
                  className={`h-7 text-xs px-2.5 rounded-full border transition-colors ${
                    form.entity_types.includes(k)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:border-primary"
                  }`}
                  data-testid={`toggle-entity-${k}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="delegation-from">Dari Tanggal</Label>
              <Input id="delegation-from" type="date" value={form.from_date}
                onChange={(e) => setForm((f) => ({ ...f, from_date: e.target.value }))}
                data-testid="delegation-from-date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="delegation-to">Sampai Tanggal</Label>
              <Input id="delegation-to" type="date" value={form.to_date}
                onChange={(e) => setForm((f) => ({ ...f, to_date: e.target.value }))}
                data-testid="delegation-to-date" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="delegation-reason">Alasan (opsional)</Label>
            <Input id="delegation-reason" value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="Mis. cuti tahunan 15–20 Mei"
              data-testid="delegation-reason" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSubmit} disabled={submitting} data-testid="confirm-delegation-btn">
            {submitting && <Loader2 className="animate-spin" />}
            Buat Delegasi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
