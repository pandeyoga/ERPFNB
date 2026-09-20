/** Voucher — issue (bulk) + redeem + status list (DataTable). */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Ticket, Search, BadgeCheck } from "lucide-react";
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
import useOutletScope from "@/hooks/useOutletScope";

export default function VoucherList() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showIssue, setShowIssue] = useState(false);
  const [redeemFor, setRedeemFor] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  // Bug fix 2026-05-26: useOutletScope was imported but never invoked.
  const { scopedOutlets: outlets } = useOutletScope();

  const canIssue = (user?.permissions || []).includes("hr.voucher.issue")
    || (user?.permissions || []).includes("*");
  const canRedeem = (user?.permissions || []).includes("hr.voucher.redeem")
    || (user?.permissions || []).includes("*");

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setShowIssue(true);
      const next = new URLSearchParams(searchParams);
      next.delete("new");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/hr/vouchers", {
        params: {
          status: statusFilter || undefined,
          search: search || undefined,
          per_page: 100,
        },
      });
      setItems(unwrap(r) || []);
    } finally {
      setLoading(false);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [statusFilter, search]);

  return (
    <div className="space-y-4" data-testid="hr-voucher-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-40" data-testid="hr-voucher-filter-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua status</SelectItem>
              <SelectItem value="issued">Issued</SelectItem>
              <SelectItem value="redeemed">Redeemed</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input className="pl-8 w-56" placeholder="Cari kode voucher…"
                    value={search} onChange={(e) => setSearch(e.target.value)}
                    data-testid="hr-voucher-search" />
          </div>
        </div>
        {canIssue && (
          <Button onClick={() => setShowIssue(true)} className="rounded-full" data-testid="hr-voucher-issue-btn">
            <Plus className="h-4 w-4 mr-2" /> Issue Voucher
          </Button>
        )}
      </div>

      <div className="glass-card" data-testid="hr-voucher-table-card">
        <DataTable
          columns={[
            { key: "code", label: "Code", primary: true, sortable: true, render: v => <span className="font-mono">{v.code}</span> },
            { key: "issue_date", label: "Issue Date", sortable: true, render: v => fmtDate(v.issue_date) },
            { key: "expire_date", label: "Expire", sortable: true, render: v => v.expire_date ? fmtDate(v.expire_date) : "—" },
            { key: "purpose", label: "Purpose", sortable: true, render: v => <span className="text-xs">{v.purpose}</span> },
            { key: "value", label: "Value", numeric: true, sortable: true, render: v => fmtRp(v.value) },
            { key: "redeemed_amount", label: "Redeemed", numeric: true, sortable: true, render: v => <span className="text-xs">{v.status === "redeemed" ? fmtRp(v.redeemed_amount) : "—"}</span> },
            { key: "status", label: "Status", align: "center", sortable: true, render: v => <StatusPill status={v.status} /> },
          ]}
          rows={items}
          loading={loading}
          defaultSort={{ key: "issue_date", dir: "desc" }}
          empty={<EmptyState icon={Ticket} title="Belum ada voucher"
            description="Issue voucher promosi/staff/comp — sistem akan track liability + redemption." />}
          rowAction={(v) => (
            canRedeem && v.status === "issued" ? (
              <Button size="sm" variant="default" className="rounded-full"
                      onClick={() => setRedeemFor(v)}
                      data-testid={`hr-voucher-redeem-${v.code}`}>
                <BadgeCheck className="h-3.5 w-3.5 mr-1" /> Redeem
              </Button>
            ) : null
          )}
          rowTestIdPrefix="hr-voucher-row"
        />
      </div>

      <IssueVoucherDialog open={showIssue} onOpenChange={setShowIssue}
        outlets={outlets}
        onIssued={async () => { setShowIssue(false); await load(); }} />
      <RedeemDialog voucher={redeemFor} open={!!redeemFor}
        outlets={outlets}
        onOpenChange={(v) => !v && setRedeemFor(null)}
        onRedeemed={async () => { setRedeemFor(null); await load(); }} />
    </div>
  );
}

function IssueVoucherDialog({ open, onOpenChange, outlets, onIssued }) {
  const [form, setForm] = useState({
    qty: 10, value: 50000, purpose: "marketing", prefix: "PROMO",
    expire_date: "", outlet_id: "", post_journal: true, notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (Number(form.qty) <= 0 || Number(form.value) <= 0) {
      return toast.error("qty & value harus > 0");
    }
    setSubmitting(true);
    try {
      const res = await api.post("/hr/vouchers/issue", {
        qty: Number(form.qty), value: Number(form.value),
        purpose: form.purpose, prefix: form.prefix,
        expire_date: form.expire_date || undefined,
        outlet_id: form.outlet_id || undefined,
        post_journal: form.post_journal,
        notes: form.notes || undefined,
      });
      const data = unwrap(res);
      toast.success(`${data.qty} voucher di-issue (batch: ${data.batch_id.slice(0,8)})`);
      await onIssued();
    } catch (e) {
      toast.error(unwrapError(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="hr-voucher-issue-dialog">
        <DialogHeader>
          <DialogTitle>Issue Voucher Batch</DialogTitle>
          <DialogDescription>Generate kode voucher dalam jumlah banyak.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Quantity *</Label>
              <Input type="number" min="1" max="1000" value={form.qty}
                      onChange={(e) => setForm(f => ({ ...f, qty: e.target.value }))}
                      data-testid="hr-voucher-qty" />
            </div>
            <div className="space-y-1">
              <Label>Value (Rp) *</Label>
              <Input type="number" min="0" step="1000" value={form.value}
                      onChange={(e) => setForm(f => ({ ...f, value: e.target.value }))}
                      data-testid="hr-voucher-value" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Purpose</Label>
              <Select value={form.purpose} onValueChange={(v) => setForm(f => ({ ...f, purpose: v }))}>
                <SelectTrigger data-testid="hr-voucher-purpose"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="customer_comp">Customer Comp</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="replacement">Replacement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Prefix</Label>
              <Input value={form.prefix}
                      onChange={(e) => setForm(f => ({ ...f, prefix: e.target.value.toUpperCase() }))}
                      data-testid="hr-voucher-prefix" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Expire Date</Label>
              <Input type="date" value={form.expire_date}
                      onChange={(e) => setForm(f => ({ ...f, expire_date: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Outlet</Label>
              <Select value={form.outlet_id || "none"} onValueChange={(v) => setForm(f => ({ ...f, outlet_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="— semua outlet —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— semua outlet —</SelectItem>
                  {outlets.map(o => (<SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.post_journal}
                    onChange={(e) => setForm(f => ({ ...f, post_journal: e.target.checked }))}
                    data-testid="hr-voucher-post-journal" />
            Post journal entry saat issue (Dr Marketing/Comp, Cr Voucher Liability)
          </label>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes}
                       onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="rounded-full"
                  data-testid="hr-voucher-issue-submit">
            {submitting ? "Issuing…" : `Issue ${form.qty} voucher`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RedeemDialog({ voucher, open, onOpenChange, outlets, onRedeemed }) {
  const [amount, setAmount] = useState(0);
  const { outletId, setOutletId } = useOutletScope();
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (voucher) {
      setAmount(voucher.value);
      setOutletId(voucher.outlet_id || "");
      setRef("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voucher]);

  const handleSubmit = async () => {
    setBusy(true);
    try {
      await api.post(`/hr/vouchers/${voucher.code}/redeem`, {
        amount: Number(amount),
        outlet_id: outletId || undefined,
        ref: ref || undefined,
      });
      toast.success("Voucher redeemed");
      await onRedeemed();
    } catch (e) {
      toast.error(unwrapError(e));
    } finally {
      setBusy(false);
    }
  };

  if (!voucher) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" data-testid="hr-voucher-redeem-dialog">
        <DialogHeader>
          <DialogTitle>Redeem Voucher</DialogTitle>
          <DialogDescription>
            Code <span className="font-mono">{voucher.code}</span> · max {fmtRp(voucher.value)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Amount</Label>
            <Input type="number" min="0" max={voucher.value} step="1000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    data-testid="hr-voucher-redeem-amount" />
          </div>
          <div className="space-y-1">
            <Label>Outlet</Label>
            <Select value={outletId || "none"} onValueChange={(v) => setOutletId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="— pilih —" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— tidak spesifik —</SelectItem>
                {outlets.map(o => (<SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Reference</Label>
            <Input value={ref} onChange={(e) => setRef(e.target.value)}
                    placeholder="Daily sales doc / customer / event"
                    data-testid="hr-voucher-redeem-ref" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSubmit} disabled={busy} className="rounded-full"
                  data-testid="hr-voucher-redeem-submit">
            {busy ? "Memproses…" : "Redeem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
