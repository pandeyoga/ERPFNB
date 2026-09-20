/** AR Invoice Dialogs — extracted from ARInvoiceList.jsx for maintainability */
import { useState, useEffect } from "react";
import {
  Plus, FileText, DollarSign, X, Loader2, Edit2, Send, Bell, Mail, MessageSquare,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import DataTable from "@/components/shared/DataTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import api from "@/lib/api";
import { toast } from "sonner";
import { formatCurrency, formatDateID } from "@/lib/format";

const STATUS_MAP = {
  draft:     { label: "Draft",       variant: "secondary",    color: "" },
  sent:      { label: "Terkirim",    variant: "default",      color: "" },
  partial:   { label: "Sebagian",    variant: "outline",      color: "border-amber-500 text-amber-700" },
  paid:      { label: "Lunas",       variant: "default",      color: "bg-green-600" },
  overdue:   { label: "Jatuh Tempo", variant: "destructive",  color: "" },
  cancelled: { label: "Dibatalkan",  variant: "secondary",    color: "" },
};

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || { label: status, variant: "secondary", color: "" };
  return <Badge variant={s.variant} className={s.color}>{s.label}</Badge>;
}

export function InvoiceCreateDialog({ open, onOpenChange, onCreated }) {
  const [customers, setCustomers] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [form, setForm] = useState({
    customer_id: "", customer_name: "", customer_npwp: "", customer_address: "",
    channel: "b2b", invoice_date: new Date().toISOString().slice(0, 10),
    credit_terms_days: 30, notes: "", outlet_id: "", auto_post: true,
    lines: [{ description: "", qty: 1, unit_price: 0, discount: 0, include_ppn: true, ppn_rate: 0.12 }],
  });
  const [submitting, setSubmitting] = useState(false);
  const [loadingRefs, setLoadingRefs] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingRefs(true);
    Promise.all([
      api.get("/ar/customers").catch(() => ({ data: { data: { items: [] } } })),
      api.get("/public/outlets").catch(() => ({ data: { data: [] } })),
    ]).then(([cr, or]) => {
      setCustomers(cr.data?.data?.items || []);
      setOutlets(or.data?.data || []);
    }).finally(() => setLoadingRefs(false));
  }, [open]);

  function addLine() {
    setForm(f => ({ ...f, lines: [...f.lines, { description: "", qty: 1, unit_price: 0, discount: 0, include_ppn: true, ppn_rate: 0.12 }] }));
  }
  function removeLine(i) {
    setForm(f => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }));
  }
  function updateLine(i, k, v) {
    setForm(f => ({ ...f, lines: f.lines.map((l, idx) => idx === i ? { ...l, [k]: v } : l) }));
  }

  const subtotal = form.lines.reduce((s, l) => {
    const dpp = l.qty * l.unit_price - (l.discount || 0);
    return s + dpp;
  }, 0);
  const taxAmt = form.lines.reduce((s, l) => {
    if (!l.include_ppn) return s;
    const dpp = l.qty * l.unit_price - (l.discount || 0);
    return s + dpp * (l.ppn_rate || 0.12);
  }, 0);
  const total = subtotal + taxAmt;

  async function handleSubmit() {
    if (!form.lines.length) { toast.error("Minimal 1 baris"); return; }
    if (!form.customer_name && !form.customer_id) { toast.error("Customer wajib diisi"); return; }
    setSubmitting(true);
    try {
      await api.post("/ar/invoices", form);
      toast.success("Invoice berhasil dibuat");
      onCreated();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal membuat invoice");
    } finally { setSubmitting(false); }
  }

  function handleCustomerSelect(id) {
    const c = customers.find(x => x.id === id);
    if (!c) { setForm(f => ({ ...f, customer_id: "", customer_name: "" })); return; }
    setForm(f => ({
      ...f,
      customer_id: c.id,
      customer_name: c.name,
      customer_npwp: c.npwp || "",
      customer_address: c.address || "",
      channel: c.channel || "b2b",
      credit_terms_days: c.credit_terms_days || 30,
    }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="invoice-create-dialog">
        <DialogHeader>
          <DialogTitle>Buat Invoice AR Baru</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Customer */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Customer (dari daftar)</Label>
              <Select value={form.customer_id} onValueChange={handleCustomerSelect}>
                <SelectTrigger data-testid="invoice-customer-select">
                  <SelectValue placeholder={loadingRefs ? "Memuat customer..." : "Pilih customer..."} />
                </SelectTrigger>
                <SelectContent>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Nama Customer *</Label>
              <Input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                placeholder="Nama customer" data-testid="invoice-customer-name" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Channel</Label>
              <Select value={form.channel} onValueChange={v => setForm(f => ({ ...f, channel: v }))}>
                <SelectTrigger data-testid="invoice-channel"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[
                    { code: "b2b", name: "B2B / Catering" },
                    { code: "gofood", name: "GoFood" },
                    { code: "grabfood", name: "GrabFood" },
                    { code: "shopee", name: "ShopeeFood" },
                    { code: "other", name: "Lainnya" },
                  ].map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tanggal Invoice *</Label>
              <Input type="date" value={form.invoice_date}
                onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))}
                data-testid="invoice-date" />
            </div>
            <div className="space-y-1">
              <Label>Terms (hari)</Label>
              <Input type="number" value={form.credit_terms_days}
                onChange={e => setForm(f => ({ ...f, credit_terms_days: parseInt(e.target.value) || 30 }))}
                data-testid="invoice-terms" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>NPWP Customer</Label>
              <Input value={form.customer_npwp} onChange={e => setForm(f => ({ ...f, customer_npwp: e.target.value }))}
                placeholder="00.000.000.0-000.000" data-testid="invoice-customer-npwp" />
            </div>
            <div className="space-y-1">
              <Label>Outlet</Label>
              <Select value={form.outlet_id || "no_outlet"} onValueChange={v => setForm(f => ({ ...f, outlet_id: v === "no_outlet" ? "" : v }))}>
                <SelectTrigger data-testid="invoice-outlet"><SelectValue placeholder="Pilih outlet..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no_outlet">— Semua Outlet —</SelectItem>
                  {outlets.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Lines */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Baris Invoice</Label>
              <Button size="sm" variant="outline" onClick={addLine} data-testid="invoice-add-line">
                <Plus className="h-3 w-3 mr-1" /> Tambah Baris
              </Button>
            </div>
            <div className="border rounded-md overflow-hidden">
              <DataTable
                rows={form.lines.map((ln, i) => ({ ...ln, _idx: i }))}
                keyField="_idx"
                loading={loadingRefs}
                loadingRows={2}
                stickyHeader={false}
                rowTestIdPrefix="invoice-line"
                empty={<div className="p-4 text-center text-sm text-muted-foreground">Belum ada baris. Tambah baris invoice.</div>}
                columns={[
                  { key: "description", label: "Deskripsi", primary: true,
                    render: (ln) => (
                      <Input value={ln.description}
                        onChange={e => updateLine(ln._idx, "description", e.target.value)}
                        placeholder="Deskripsi item" className="h-7 text-sm"
                        data-testid={`line-desc-${ln._idx}`} />
                    ) },
                  { key: "qty", label: "Qty", numeric: true,
                    render: (ln) => (
                      <Input type="number" value={ln.qty}
                        onChange={e => updateLine(ln._idx, "qty", parseFloat(e.target.value) || 1)}
                        className="h-7 text-sm text-right tabular-nums w-16"
                        data-testid={`line-qty-${ln._idx}`} />
                    ) },
                  { key: "unit_price", label: "Harga", numeric: true,
                    render: (ln) => (
                      <Input type="number" value={ln.unit_price}
                        onChange={e => updateLine(ln._idx, "unit_price", parseFloat(e.target.value) || 0)}
                        className="h-7 text-sm text-right tabular-nums w-28" data-testid={`line-price-${ln._idx}`} />
                    ) },
                  { key: "discount", label: "Diskon", numeric: true,
                    render: (ln) => (
                      <Input type="number" value={ln.discount}
                        onChange={e => updateLine(ln._idx, "discount", parseFloat(e.target.value) || 0)}
                        className="h-7 text-sm text-right tabular-nums w-24"
                        data-testid={`line-discount-${ln._idx}`} />
                    ) },
                  { key: "include_ppn", label: "PPN", align: "center",
                    render: (ln) => (
                      <input type="checkbox" checked={ln.include_ppn}
                        onChange={e => updateLine(ln._idx, "include_ppn", e.target.checked)}
                        className="rounded"
                        data-testid={`line-ppn-${ln._idx}`} />
                    ) },
                  { key: "total", label: "Total", numeric: true,
                    render: (ln) => {
                      const dpp = ln.qty * ln.unit_price - (ln.discount || 0);
                      const ppn = ln.include_ppn ? dpp * (ln.ppn_rate || 0.12) : 0;
                      return <span className="font-medium" data-testid={`line-total-${ln._idx}`}>{formatCurrency(dpp + ppn)}</span>;
                    } },
                ]}
                rowAction={(ln) => (
                  form.lines.length > 1
                    ? <Button size="icon" variant="ghost" aria-label="Hapus baris" className="h-6 w-6" onClick={() => removeLine(ln._idx)} data-testid={`line-remove-${ln._idx}`}><X className="h-3 w-3" /></Button>
                    : null
                )}
              />
            </div>
            {/* Subtotal */}
            <div className="text-right tabular-nums text-sm space-y-1 pr-2" data-testid="invoice-totals">
              <div className="text-muted-foreground">Subtotal: <span className="font-medium" data-testid="invoice-subtotal">{formatCurrency(subtotal)}</span></div>
              <div className="text-muted-foreground">PPN (12%): <span className="font-medium" data-testid="invoice-tax">{formatCurrency(taxAmt)}</span></div>
              <div className="font-bold text-base" data-testid="invoice-total">Total: {formatCurrency(total)}</div>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Catatan</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Catatan..." rows={2} data-testid="invoice-notes" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="invoice-cancel">Batal</Button>
          <Button onClick={handleSubmit} disabled={submitting} data-testid="confirm-create-invoice">
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Buat Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ── Customer Create Dialog ────────────────────────────────────

export function CustomerCreateDialog({ open, onOpenChange, onCreated }) {
  const [form, setForm] = useState({
    name: "", channel: "b2b", npwp: "", address: "",
    contact_person: "", phone: "", email: "", credit_terms_days: 30, notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!form.name) { toast.error("Nama customer wajib diisi"); return; }
    setSubmitting(true);
    try {
      await api.post("/ar/customers", form);
      toast.success("Customer berhasil ditambahkan");
      onCreated();
      setForm({ name: "", channel: "b2b", npwp: "", address: "", contact_person: "", phone: "", email: "", credit_terms_days: 30, notes: "" });
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal menambahkan customer");
    } finally { setSubmitting(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="customer-create-dialog">
        <DialogHeader>
          <DialogTitle>Tambah Customer AR Baru</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nama Customer *</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Nama perusahaan / individu" data-testid="customer-name-input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Channel</Label>
              <Select value={form.channel} onValueChange={v => setForm(f => ({ ...f, channel: v }))}>
                <SelectTrigger data-testid="customer-channel"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[
                    { code: "b2b", name: "B2B / Catering" },
                    { code: "gofood", name: "GoFood" },
                    { code: "grabfood", name: "GrabFood" },
                    { code: "shopee", name: "ShopeeFood" },
                    { code: "other", name: "Lainnya" },
                  ].map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Terms (hari)</Label>
              <Input type="number" value={form.credit_terms_days}
                onChange={e => setForm(f => ({ ...f, credit_terms_days: parseInt(e.target.value) || 30 }))}
                data-testid="customer-terms" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>NPWP</Label>
            <Input value={form.npwp} onChange={e => setForm(f => ({ ...f, npwp: e.target.value }))}
              placeholder="00.000.000.0-000.000" data-testid="customer-npwp" />
          </div>
          <div className="space-y-1">
            <Label>Alamat</Label>
            <Textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              rows={2} placeholder="Alamat lengkap" data-testid="customer-address" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Nama Kontak</Label>
              <Input value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} data-testid="customer-contact-person" />
            </div>
            <div className="space-y-1">
              <Label>Telepon</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} data-testid="customer-phone" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="email@domain.com" data-testid="customer-email" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="customer-cancel">Batal</Button>
          <Button onClick={handleSubmit} disabled={submitting} data-testid="confirm-create-customer">
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Simpan Customer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ── Receipt Dialog ────────────────────────────────────────────

export function ReceiptDialog({ invoice, onClose, onRecorded }) {
  const [form, setForm] = useState({
    receipt_date: new Date().toISOString().slice(0, 10),
    amount: invoice.outstanding || 0,
    payment_method: "bank_transfer",
    reference: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!form.amount || form.amount <= 0) { toast.error("Jumlah harus > 0"); return; }
    setSubmitting(true);
    try {
      await api.post(`/ar/invoices/${invoice.id}/receipt`, form);
      toast.success("Pembayaran berhasil dicatat");
      onRecorded();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal mencatat pembayaran");
    } finally { setSubmitting(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md" data-testid="receipt-dialog">
        <DialogHeader>
          <DialogTitle>Catat Pembayaran AR</DialogTitle>
          <DialogDescription>
            Invoice {invoice.invoice_no} — {invoice.customer_name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted/40 rounded-lg p-3 text-sm" data-testid="receipt-summary">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Invoice</span>
              <span className="font-medium" data-testid="receipt-total-invoice">{formatCurrency(invoice.total_amount)}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-muted-foreground">Sudah Dibayar</span>
              <span className="text-green-700" data-testid="receipt-paid">{formatCurrency(invoice.paid_amount || 0)}</span>
            </div>
            <div className="flex justify-between mt-1 font-semibold">
              <span>Outstanding</span>
              <span className="text-orange-600" data-testid="receipt-outstanding">{formatCurrency(invoice.outstanding)}</span>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Tanggal Terima *</Label>
            <Input type="date" value={form.receipt_date}
              onChange={e => setForm(f => ({ ...f, receipt_date: e.target.value }))}
              data-testid="receipt-date" />
          </div>
          <div className="space-y-1">
            <Label>Jumlah Diterima *</Label>
            <Input type="number" value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
              data-testid="receipt-amount" />
          </div>
          <div className="space-y-1">
            <Label>Metode Pembayaran</Label>
            <Select value={form.payment_method} onValueChange={v => setForm(f => ({ ...f, payment_method: v }))}>
              <SelectTrigger data-testid="receipt-method"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="cash">Tunai</SelectItem>
                <SelectItem value="giro">Giro</SelectItem>
                <SelectItem value="virtual_account">Virtual Account</SelectItem>
                <SelectItem value="other">Lainnya</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>No Referensi / Bukti</Label>
            <Input value={form.reference}
              onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
              placeholder="No transfer / referensi" data-testid="receipt-reference" />
          </div>
          <div className="space-y-1">
            <Label>Catatan</Label>
            <Textarea value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} data-testid="receipt-notes" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="receipt-cancel">Batal</Button>
          <Button onClick={handleSubmit} disabled={submitting} data-testid="confirm-receipt">
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Catat Pembayaran
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ── Invoice Detail Dialog ─────────────────────────────────────

export function InvoiceDetailDialog({ invoice, onClose, onSend, onPayment }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="invoice-detail-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {invoice.invoice_no}
            <StatusBadge status={invoice.status} />
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4" data-testid="invoice-detail-summary">
            <div>
              <div className="text-muted-foreground">Customer</div>
              <div className="font-medium" data-testid="invoice-detail-customer-name">{invoice.customer_name}</div>
              {invoice.customer_npwp && <div className="text-xs text-muted-foreground" data-testid="invoice-detail-customer-npwp">NPWP: {invoice.customer_npwp}</div>}
            </div>
            <div>
              <div className="text-muted-foreground">Channel</div>
              <Badge variant="outline" data-testid="invoice-detail-channel">{invoice.channel}</Badge>
            </div>
            <div>
              <div className="text-muted-foreground">Tanggal Invoice</div>
              <div data-testid="invoice-detail-date">{formatDateID(invoice.invoice_date)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Jatuh Tempo</div>
              <div className={invoice.status === "overdue" ? "text-red-600 font-medium" : ""} data-testid="invoice-detail-due-date">
                {formatDateID(invoice.due_date)}
              </div>
            </div>
          </div>

          <DataTable
            rows={(invoice.lines || []).map((ln, i) => ({ ...ln, _idx: i }))}
            keyField="_idx"
            stickyHeader={false}
            rowTestIdPrefix="invoice-detail-line"
            empty={<div className="p-4 text-center text-sm text-muted-foreground">Tidak ada baris invoice.</div>}
            columns={[
              { key: "description", label: "Deskripsi", primary: true, render: (ln) => ln.description },
              { key: "qty", label: "Qty", numeric: true },
              { key: "unit_price", label: "Harga", numeric: true, render: (ln) => formatCurrency(ln.unit_price) },
              { key: "dpp", label: "DPP", numeric: true, render: (ln) => formatCurrency(ln.dpp) },
              { key: "ppn", label: "PPN", numeric: true, render: (ln) => formatCurrency(ln.ppn || 0) },
              { key: "total", label: "Total", numeric: true,
                render: (ln) => <span className="font-medium">{formatCurrency(ln.dpp + (ln.ppn || 0))}</span> },
            ]}
            footer={
              <>
                <tr className="border-t-2 font-semibold">
                  <td colSpan={5} className="px-4 py-2 text-right tabular-nums">Subtotal</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(invoice.subtotal)}</td>
                </tr>
                <tr>
                  <td colSpan={5} className="px-4 py-2 text-right tabular-nums text-muted-foreground">PPN</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(invoice.tax_amount)}</td>
                </tr>
                <tr className="font-bold">
                  <td colSpan={5} className="px-4 py-2 text-right tabular-nums">TOTAL</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(invoice.total_amount)}</td>
                </tr>
                {invoice.paid_amount > 0 && (
                  <tr className="text-green-700">
                    <td colSpan={5} className="px-4 py-2 text-right tabular-nums">Dibayar</td>
                    <td className="px-4 py-2 text-right tabular-nums">({formatCurrency(invoice.paid_amount)})</td>
                  </tr>
                )}
                {invoice.outstanding > 0 && (
                  <tr className="text-orange-600 font-bold">
                    <td colSpan={5} className="px-4 py-2 text-right tabular-nums">Outstanding</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(invoice.outstanding)}</td>
                  </tr>
                )}
              </>
            }
          />

          {invoice.notes && (
            <div className="text-muted-foreground text-xs italic">Catatan: {invoice.notes}</div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="invoice-detail-close">Tutup</Button>
          {invoice.status === "draft" && (
            <Button variant="outline" onClick={onSend} data-testid="invoice-detail-send">
              <Send className="h-4 w-4 mr-2" /> Kirim Invoice
            </Button>
          )}
          {invoice.outstanding > 0 && (
            <Button onClick={onPayment} data-testid="detail-record-payment">
              <DollarSign className="h-4 w-4 mr-2" /> Catat Pembayaran
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ── Customer Edit Dialog ──────────────────────────────────────
// Parity gap (PARITY_AUDIT Kategori A, P1): PUT /ar/customers/{id}

const CHANNELS = [
  { code: "b2b", name: "B2B / Catering" },
  { code: "gofood", name: "GoFood" },
  { code: "grabfood", name: "GrabFood" },
  { code: "shopee", name: "ShopeeFood" },
  { code: "other", name: "Lainnya" },
];

export function CustomerEditDialog({ customer, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: customer.name || "",
    channel: customer.channel || "b2b",
    npwp: customer.npwp || "",
    address: customer.address || "",
    contact_person: customer.contact_person || "",
    phone: customer.phone || "",
    email: customer.email || "",
    credit_terms_days: customer.credit_terms_days || 30,
    notes: customer.notes || "",
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!form.name) { toast.error("Nama customer wajib diisi"); return; }
    setSubmitting(true);
    try {
      await api.put(`/ar/customers/${customer.id}`, form);
      toast.success("Customer berhasil diperbarui");
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal memperbarui customer");
    } finally { setSubmitting(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md" data-testid="customer-edit-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Edit2 className="h-4 w-4" /> Edit Customer AR</DialogTitle>
          <DialogDescription>{customer.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nama Customer *</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Nama perusahaan / individu" data-testid="customer-edit-name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Channel</Label>
              <Select value={form.channel} onValueChange={v => setForm(f => ({ ...f, channel: v }))}>
                <SelectTrigger data-testid="customer-edit-channel"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Terms (hari)</Label>
              <Input type="number" value={form.credit_terms_days}
                onChange={e => setForm(f => ({ ...f, credit_terms_days: parseInt(e.target.value) || 30 }))}
                data-testid="customer-edit-terms" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>NPWP</Label>
            <Input value={form.npwp} onChange={e => setForm(f => ({ ...f, npwp: e.target.value }))}
              placeholder="00.000.000.0-000.000" data-testid="customer-edit-npwp" />
          </div>
          <div className="space-y-1">
            <Label>Alamat</Label>
            <Textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              rows={2} placeholder="Alamat lengkap" data-testid="customer-edit-address" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Nama Kontak</Label>
              <Input value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} data-testid="customer-edit-contact-person" />
            </div>
            <div className="space-y-1">
              <Label>Telepon</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} data-testid="customer-edit-phone" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="email@domain.com" data-testid="customer-edit-email" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="customer-edit-cancel">Batal</Button>
          <Button onClick={handleSubmit} disabled={submitting} data-testid="confirm-edit-customer">
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Simpan Perubahan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ── Invoice Edit Dialog (draft only) ──────────────────────────
// Parity gap (PARITY_AUDIT Kategori A, P1): PUT /ar/invoices/{id}

export function InvoiceEditDialog({ invoice, onClose, onSaved }) {
  const [outlets, setOutlets] = useState([]);
  const [form, setForm] = useState({
    customer_name: invoice.customer_name || "",
    customer_npwp: invoice.customer_npwp || "",
    customer_address: invoice.customer_address || "",
    channel: invoice.channel || "b2b",
    invoice_date: (invoice.invoice_date || "").slice(0, 10),
    due_date: (invoice.due_date || "").slice(0, 10),
    outlet_id: invoice.outlet_id || "",
    notes: invoice.notes || "",
    lines: (invoice.lines || []).map((l) => ({
      description: l.description || "",
      qty: l.qty ?? 1,
      unit_price: l.unit_price ?? 0,
      discount: l.discount ?? 0,
      include_ppn: l.include_ppn ?? ((l.ppn_rate || l.ppn || 0) > 0),
      ppn_rate: l.ppn_rate || 0.12,
    })),
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get("/public/outlets").then(r => setOutlets(r.data?.data || [])).catch(() => {});
  }, []);

  function addLine() {
    setForm(f => ({ ...f, lines: [...f.lines, { description: "", qty: 1, unit_price: 0, discount: 0, include_ppn: true, ppn_rate: 0.12 }] }));
  }
  function removeLine(i) { setForm(f => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) })); }
  function updateLine(i, k, v) { setForm(f => ({ ...f, lines: f.lines.map((l, idx) => idx === i ? { ...l, [k]: v } : l) })); }

  const subtotal = form.lines.reduce((s, l) => s + (l.qty * l.unit_price - (l.discount || 0)), 0);
  const taxAmt = form.lines.reduce((s, l) => {
    if (!l.include_ppn) return s;
    const dpp = l.qty * l.unit_price - (l.discount || 0);
    return s + dpp * (l.ppn_rate || 0.12);
  }, 0);
  const total = subtotal + taxAmt;

  async function handleSubmit() {
    if (!form.lines.length) { toast.error("Minimal 1 baris"); return; }
    if (!form.customer_name) { toast.error("Nama customer wajib diisi"); return; }
    setSubmitting(true);
    try {
      await api.put(`/ar/invoices/${invoice.id}`, form);
      toast.success("Invoice berhasil diperbarui");
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal memperbarui invoice");
    } finally { setSubmitting(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="invoice-edit-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Edit2 className="h-4 w-4" /> Edit Invoice (Draft)</DialogTitle>
          <DialogDescription>
            {invoice.invoice_no} <Badge variant="secondary" className="ml-1">Draft</Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Nama Customer *</Label>
              <Input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                placeholder="Nama customer" data-testid="invoice-edit-customer-name" />
            </div>
            <div className="space-y-1">
              <Label>NPWP Customer</Label>
              <Input value={form.customer_npwp} onChange={e => setForm(f => ({ ...f, customer_npwp: e.target.value }))}
                placeholder="00.000.000.0-000.000" data-testid="invoice-edit-npwp" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Channel</Label>
              <Select value={form.channel} onValueChange={v => setForm(f => ({ ...f, channel: v }))}>
                <SelectTrigger data-testid="invoice-edit-channel"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tanggal Invoice *</Label>
              <Input type="date" value={form.invoice_date}
                onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))}
                data-testid="invoice-edit-date" />
            </div>
            <div className="space-y-1">
              <Label>Jatuh Tempo</Label>
              <Input type="date" value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                data-testid="invoice-edit-due-date" />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Outlet</Label>
            <Select value={form.outlet_id || "no_outlet"} onValueChange={v => setForm(f => ({ ...f, outlet_id: v === "no_outlet" ? "" : v }))}>
              <SelectTrigger data-testid="invoice-edit-outlet"><SelectValue placeholder="Pilih outlet..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="no_outlet">— Semua Outlet —</SelectItem>
                {outlets.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Lines */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Baris Invoice</Label>
              <Button size="sm" variant="outline" onClick={addLine} data-testid="invoice-edit-add-line">
                <Plus className="h-3 w-3 mr-1" /> Tambah Baris
              </Button>
            </div>
            <div className="border rounded-md overflow-hidden">
              <DataTable
                rows={form.lines.map((ln, i) => ({ ...ln, _idx: i }))}
                keyField="_idx"
                stickyHeader={false}
                rowTestIdPrefix="invoice-edit-line"
                empty={<div className="p-4 text-center text-sm text-muted-foreground">Belum ada baris.</div>}
                columns={[
                  { key: "description", label: "Deskripsi", primary: true,
                    render: (ln) => (
                      <Input value={ln.description} onChange={e => updateLine(ln._idx, "description", e.target.value)}
                        placeholder="Deskripsi item" className="h-7 text-sm" data-testid={`edit-line-desc-${ln._idx}`} />
                    ) },
                  { key: "qty", label: "Qty", numeric: true,
                    render: (ln) => (
                      <Input type="number" value={ln.qty} onChange={e => updateLine(ln._idx, "qty", parseFloat(e.target.value) || 1)}
                        className="h-7 text-sm text-right tabular-nums w-16" data-testid={`edit-line-qty-${ln._idx}`} />
                    ) },
                  { key: "unit_price", label: "Harga", numeric: true,
                    render: (ln) => (
                      <Input type="number" value={ln.unit_price} onChange={e => updateLine(ln._idx, "unit_price", parseFloat(e.target.value) || 0)}
                        className="h-7 text-sm text-right tabular-nums w-28" data-testid={`edit-line-price-${ln._idx}`} />
                    ) },
                  { key: "discount", label: "Diskon", numeric: true,
                    render: (ln) => (
                      <Input type="number" value={ln.discount} onChange={e => updateLine(ln._idx, "discount", parseFloat(e.target.value) || 0)}
                        className="h-7 text-sm text-right tabular-nums w-24" data-testid={`edit-line-discount-${ln._idx}`} />
                    ) },
                  { key: "include_ppn", label: "PPN", align: "center",
                    render: (ln) => (
                      <input type="checkbox" checked={ln.include_ppn} onChange={e => updateLine(ln._idx, "include_ppn", e.target.checked)}
                        className="rounded" data-testid={`edit-line-ppn-${ln._idx}`} />
                    ) },
                  { key: "total", label: "Total", numeric: true,
                    render: (ln) => {
                      const dpp = ln.qty * ln.unit_price - (ln.discount || 0);
                      const ppn = ln.include_ppn ? dpp * (ln.ppn_rate || 0.12) : 0;
                      return <span className="font-medium">{formatCurrency(dpp + ppn)}</span>;
                    } },
                ]}
                rowAction={(ln) => (
                  form.lines.length > 1
                    ? <Button size="icon" variant="ghost" aria-label="Hapus baris" className="h-6 w-6" onClick={() => removeLine(ln._idx)} data-testid={`edit-line-remove-${ln._idx}`}><X className="h-3 w-3" /></Button>
                    : null
                )}
              />
            </div>
            <div className="text-right tabular-nums text-sm space-y-1 pr-2" data-testid="invoice-edit-totals">
              <div className="text-muted-foreground">Subtotal: <span className="font-medium">{formatCurrency(subtotal)}</span></div>
              <div className="text-muted-foreground">PPN: <span className="font-medium">{formatCurrency(taxAmt)}</span></div>
              <div className="font-bold text-base">Total: {formatCurrency(total)}</div>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Catatan</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Catatan..." rows={2} data-testid="invoice-edit-notes" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="invoice-edit-cancel">Batal</Button>
          <Button onClick={handleSubmit} disabled={submitting} data-testid="confirm-edit-invoice">
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Simpan Perubahan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ── Reminder Dialog ───────────────────────────────────────────
// Parity gap (PARITY_AUDIT Kategori A, P2): POST /ar/invoices/{id}/remind
// NOTE: backend attempts real Telegram/Email but gracefully reports if the
// channel is not configured (sent:false + error). We surface that honestly.

export function ReminderDialog({ invoice, onClose, onSent }) {
  const [channel, setChannel] = useState("email");
  const [submitting, setSubmitting] = useState(false);

  async function handleSend() {
    setSubmitting(true);
    try {
      const res = await api.post(`/ar/invoices/${invoice.id}/remind`, { channel });
      const result = res.data?.data || {};
      if (result.sent) {
        toast.success(`Pengingat terkirim via ${channel}`);
      } else {
        toast.warning(
          `Pengingat dicatat, tapi belum terkirim via ${channel}` +
          (result.error ? ` — ${result.error}` : " (channel belum dikonfigurasi)")
        );
      }
      onSent();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal mengirim pengingat");
    } finally { setSubmitting(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md" data-testid="reminder-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Kirim Pengingat Pembayaran</DialogTitle>
          <DialogDescription>
            Invoice {invoice.invoice_no} — {invoice.customer_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/40 rounded-lg p-3 text-sm" data-testid="reminder-summary">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Outstanding</span>
              <span className="font-semibold text-orange-600">{formatCurrency(invoice.outstanding)}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-muted-foreground">Jatuh Tempo</span>
              <span className="font-medium">{formatDateID(invoice.due_date)}</span>
            </div>
            {invoice.reminders_sent > 0 && (
              <div className="flex justify-between mt-1">
                <span className="text-muted-foreground">Pengingat Terkirim</span>
                <span className="font-medium">{invoice.reminders_sent}x</span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Channel Pengingat</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger data-testid="reminder-channel"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email"><span className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> Email</span></SelectItem>
                <SelectItem value="telegram"><span className="flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5" /> Telegram</span></SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Pengingat dikirim ke {channel === "email" ? "email customer" : "Telegram"}. Jika channel belum dikonfigurasi, sistem akan memberi tahu.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="reminder-cancel">Batal</Button>
          <Button onClick={handleSend} disabled={submitting} data-testid="confirm-reminder">
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Kirim Pengingat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
