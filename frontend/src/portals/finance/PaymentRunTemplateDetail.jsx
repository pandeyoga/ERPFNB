/** PaymentRunTemplateDetail.jsx — View + edit template items */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Plus, Trash2, Play, Save, CalendarDays, CheckCircle2,
  Info, Pencil, ClipboardList, Banknote, Receipt, Users,
} from "lucide-react";
import { toast } from "sonner";
import SimpleSelect from "@/components/shared/SimpleSelect";

import api, { unwrap } from "@/lib/api";
import { fmtRp, fmtRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import LoadingState from "@/components/shared/LoadingState";
import DataTable from "@/components/shared/DataTable";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import EmptyState from "@/components/shared/EmptyState";

const BACK_PATH = "/finance/payments-hub?tab=run-templates";

export default function PaymentRunTemplateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tmpl, setTmpl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showApply, setShowApply] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get(`/finance/payment-run-templates/${id}`);
      setTmpl(unwrap(res));
    } catch { toast.error("Gagal memuat template"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [id]);

  async function removeItem(itemId) {
    const items = (tmpl.items || []).filter(it => it.id !== itemId);
    setSaving(true);
    try {
      const res = await api.patch(`/finance/payment-run-templates/${id}`, { items });
      setTmpl(unwrap(res));
      toast.success("Item dihapus");
    } catch (e) {
      toast.error(e?.response?.data?.errors?.[0]?.message || "Gagal");
    } finally { setSaving(false); }
  }

  async function saveItem(item) {
    const existing = tmpl.items || [];
    const idx = existing.findIndex(it => it.id === item.id);
    const items = idx >= 0
      ? existing.map(it => it.id === item.id ? item : it)
      : [...existing, item];
    setSaving(true);
    try {
      const res = await api.patch(`/finance/payment-run-templates/${id}`, { items });
      setTmpl(unwrap(res));
      setShowAddItem(false);
      setEditItem(null);
      toast.success(idx >= 0 ? "Item diperbarui" : "Item ditambahkan");
    } catch (e) {
      toast.error(e?.response?.data?.errors?.[0]?.message || "Gagal menyimpan item");
    } finally { setSaving(false); }
  }

  if (loading) return <LoadingState rows={5} />;
  if (!tmpl) return (
    <div className="glass-card" data-testid="prn-template-not-found">
      <EmptyState icon={ClipboardList} title="Template tidak ditemukan"
        description="Template mungkin sudah dihapus atau tautannya salah."
        action={<Button variant="outline" size="sm" onClick={() => navigate(BACK_PATH)} data-testid="tmpl-notfound-back">
          <ArrowLeft className="h-4 w-4" />Kembali ke Run Templates</Button>} />
    </div>
  );

  const totalGross = (tmpl.items || []).reduce((s, it) => s + parseFloat(it.amount || 0), 0);
  const totalWht = (tmpl.items || []).reduce((s, it) => {
    const wh = parseFloat(it.amount || 0) * parseFloat(it.wh_rate || 0) / 100;
    return s + wh;
  }, 0);

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="prn-template-detail-page">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate(BACK_PATH)}
        data-testid="tmpl-back-btn">
        <ArrowLeft className="h-4 w-4" />Kembali ke Run Templates
      </Button>
      <PageHeader
        icon={ClipboardList}
        title={<span data-testid="tmpl-name">{tmpl.name}</span>}
        subtitle={tmpl.description}
        actions={
          <Button onClick={() => setShowApply(true)}
            data-testid="tmpl-apply-btn" disabled={!tmpl.items?.length}>
            <Play className="h-4 w-4" />Apply Template
          </Button>
        }
      >
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />Jadwal: tgl {tmpl.schedule_day} tiap bulan
          </span>
          <span>Bank: {tmpl.bank_account_name || tmpl.bank_account_id}</span>
          {tmpl.auto_approve && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-400">
              Auto-approve aktif
            </span>
          )}
          {tmpl.apply_count > 0 && (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-700 dark:text-emerald-400" />
              Applied {tmpl.apply_count}× (terakhir {fmtRelative(tmpl.last_applied_at)})
            </span>
          )}
        </div>
      </PageHeader>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CompactStatCard label="Total gross" icon={Banknote} color="aurora-1" value={fmtRp(totalGross)} testId="tmpl-total-gross" />
        {totalWht > 0 && <CompactStatCard label="Total WHT" icon={Receipt} color="aurora-5" tone="warning" value={fmtRp(totalWht)} testId="tmpl-total-wht" />}
        {totalWht > 0 && <CompactStatCard label="Net ke bank" icon={Banknote} color="aurora-4" value={fmtRp(totalGross - totalWht)} testId="tmpl-net" />}
        <CompactStatCard label="Jumlah item" icon={Users} color="aurora-2" value={`${tmpl.items?.length || 0} payee`} testId="tmpl-item-count" />
      </div>

      {/* Items */}
      <div className="glass-card overflow-hidden" data-testid="tmpl-items-card">
        <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
          <h3 className="text-sm md:text-base font-semibold">Item pembayaran ({tmpl.items?.length || 0})</h3>
          <Button size="sm" variant="outline" onClick={() => setShowAddItem(true)} data-testid="tmpl-add-item-btn">
            <Plus className="h-3.5 w-3.5" />Tambah Item
          </Button>
        </div>
        {(!tmpl.items || tmpl.items.length === 0) ? (
          <EmptyState icon={Info} title="Belum ada item"
            description="Tambahkan vendor + jumlah + COA untuk setiap pembayaran tetap."
            action={<Button size="sm" onClick={() => setShowAddItem(true)} data-testid="tmpl-add-first-item">
              <Plus className="h-4 w-4" />Tambah Item Pertama</Button>} />
        ) : (
          <DataTable
            rows={tmpl.items}
            keyField="id"
            rowTestIdPrefix="tmpl-item-row"
            columns={[
              { key: "payee_name", label: "Payee", primary: true, sortable: true,
                render: (it) => (
                  <div>
                    <div className="font-medium">{it.payee_name || "-"}</div>
                    <div className="text-[11px] text-muted-foreground uppercase">{it.payee_type}</div>
                  </div>
                ) },
              { key: "description", label: "Keterangan",
                render: (it) => <span className="max-w-[200px] truncate inline-block align-middle text-muted-foreground">{it.description}</span> },
              { key: "gl_debit_code", label: "COA Debit",
                render: (it) => <span className="text-xs text-muted-foreground tabular-nums">{it.gl_debit_code} — {it.gl_debit_name}</span> },
              { key: "amount", label: "Nominal", numeric: true, sortable: true,
                render: (it) => <span className="font-semibold">{fmtRp(it.amount)}</span> },
              { key: "wht", label: "WHT", numeric: true,
                sortAccessor: (it) => it.wh_type ? round2(parseFloat(it.amount) * parseFloat(it.wh_rate || 0) / 100) : 0,
                render: (it) => {
                  const whtAmt = it.wh_type ? round2(parseFloat(it.amount) * parseFloat(it.wh_rate || 0) / 100) : 0;
                  return <span className="text-amber-700 dark:text-amber-400 text-xs">{whtAmt > 0 ? `${it.wh_type} ${it.wh_rate}% = ${fmtRp(whtAmt)}` : "—"}</span>;
                } },
            ]}
            rowAction={(it) => (
              <div className="flex gap-1 justify-end">
                <Button variant="ghost" size="icon-sm" onClick={() => setEditItem(it)}
                  data-testid={`tmpl-edit-item-${it.id}`}
                  title="Edit item" aria-label="Edit item">
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => removeItem(it.id)} disabled={saving}
                  className="text-red-700 dark:text-red-400 hover:text-red-700"
                  data-testid={`tmpl-remove-item-${it.id}`}
                  title="Hapus item" aria-label="Hapus item">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            footer={
              <tr className="border-t border-border/40 bg-muted/20">
                <td colSpan={3} className="px-4 py-2.5 font-semibold text-sm">Total</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-bold">{fmtRp(totalGross)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-amber-700 dark:text-amber-400 text-xs">
                  {totalWht > 0 ? fmtRp(totalWht) : "—"}
                </td>
                <td></td>
              </tr>
            }
          />
        )}
      </div>

      {(showAddItem || editItem) && (
        <ItemFormDialog
          item={editItem}
          onClose={() => { setShowAddItem(false); setEditItem(null); }}
          onSave={saveItem}
          saving={saving}
        />
      )}

      {showApply && (
        <ApplyDialog template={tmpl}
          onClose={() => setShowApply(false)}
          onApplied={(result) => {
            setShowApply(false);
            load(); // refresh apply_count
            if (result.run_id) navigate(`/finance/payment-runs/${result.run_id}`);
          }} />
      )}
    </div>
  );
}

// ── Item Form Dialog ───────────────────────────────────────────────────────────
function ItemFormDialog({ item, onClose, onSave, saving }) {
  const [vendors, setVendors] = useState([]);
  const [coas, setCoas] = useState([]);
  const [whtCoas, setWhtCoas] = useState([]);
  const [form, setForm] = useState({
    id: item?.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    payee_type: item?.payee_type || "vendor",
    payee_id: item?.payee_id || "",
    payee_name: item?.payee_name || "",
    amount: item?.amount || "",
    description: item?.description || "",
    gl_debit_id: item?.gl_debit_id || "",
    wh_type: item?.wh_type || "",
    wh_rate: item?.wh_rate || 0,
    wh_coa_id: item?.wh_coa_id || "",
  });

  useEffect(() => {
    api.get("/master/vendors?page=1&per_page=100").then(r => {
      const d = r.data?.data || (Array.isArray(r.data) ? r.data : []);
      setVendors(d);
    }).catch(() => {});
    // DUP-10: /finance/coa never existed (404 → empty dropdown); master CoA list + postable filter
    api.get("/master/chart-of-accounts?page=1&per_page=500").then(r => {
      const d = (r.data?.data || (Array.isArray(r.data) ? r.data : [])).filter(c => c.is_postable !== false);
      setCoas(d);
      const whCoas = d.filter(c => /withholding|pph|pajak/i.test(c.name || "") || /21[0-9]{3}/.test(c.code || ""));
      setWhtCoas(whCoas.length > 0 ? whCoas : d);
    }).catch(() => {});
  }, []);

  function handleVendorChange(vid) {
    const v = vendors.find(v => v.id === vid);
    setForm(f => ({ ...f, payee_id: vid, payee_name: v?.name || "" }));
  }

  const calcWht = form.wh_type && form.wh_rate && form.amount
    ? round2(parseFloat(form.amount) * parseFloat(form.wh_rate) / 100)
    : 0;

  function handleSave() {
    if (!form.description.trim()) { toast.error("Keterangan wajib"); return; }
    if (!parseFloat(form.amount) || parseFloat(form.amount) <= 0) { toast.error("Amount harus > 0"); return; }
    if (!form.gl_debit_id) { toast.error("COA Debit wajib"); return; }
    onSave({ ...form, amount: parseFloat(form.amount) });
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg" data-testid="tmpl-item-dialog">
        <DialogHeader>
          <DialogTitle>{item ? "Edit Item" : "Tambah Item Pembayaran"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tipe Payee</Label>
              <SimpleSelect
                ariaLabel="Tipe Payee"
                value={form.payee_type}
                onValueChange={v => setForm(f => ({ ...f, payee_type: v, payee_id: "", payee_name: "" }))}
                options={[
                  { value: "vendor", label: "Vendor" },
                  { value: "employee", label: "Karyawan" },
                  { value: "other", label: "Lainnya" },
                ]}
                className="glass-input w-full"
                testId="item-form-payee-type"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-form-payee-name">
                {form.payee_type === "vendor" ? "Vendor" : "Nama Payee"}
              </Label>
              {form.payee_type === "vendor" ? (
                <SimpleSelect
                  ariaLabel="Vendor"
                  value={form.payee_id}
                  onValueChange={handleVendorChange}
                  options={[{ value: "", label: "— Pilih vendor —" }, ...vendors.map(v => ({ value: v.id, label: v.name }))]}
                  placeholder="— Pilih vendor —"
                  className="glass-input w-full"
                  testId="item-form-payee-id"
                />
              ) : (
                <Input id="item-form-payee-name" value={form.payee_name}
                  onChange={e => setForm(f => ({ ...f, payee_name: e.target.value }))}
                  placeholder="Nama payee..." className="glass-input"
                  data-testid="item-form-payee-name" />
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-form-desc">Keterangan / Deskripsi <span className="text-red-700 dark:text-red-400">*</span></Label>
            <Input id="item-form-desc" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Mis: Sewa kantor Mei 2026" className="glass-input"
              data-testid="item-form-desc" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="item-form-amount">Amount (Rp) <span className="text-red-700 dark:text-red-400">*</span></Label>
              <Input id="item-form-amount" type="number" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0" className="glass-input"
                data-testid="item-form-amount" />
            </div>
            <div className="space-y-1.5">
              <Label>COA Debit (Beban) <span className="text-red-700 dark:text-red-400">*</span></Label>
              <SimpleSelect
                ariaLabel="COA Debit (Beban)"
                value={form.gl_debit_id}
                onValueChange={v => setForm(f => ({ ...f, gl_debit_id: v }))}
                options={[{ value: "", label: "— Pilih COA —" }, ...coas.map(c => ({ value: c.id, label: `${c.code} — ${c.name}` }))]}
                placeholder="— Pilih COA —"
                className="glass-input w-full"
                testId="item-form-coa"
              />
            </div>
          </div>

          {/* WHT */}
          <div className="border border-border/40 rounded-lg p-3 space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Withholding Tax (opsional)
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Jenis PPh</Label>
                <SimpleSelect
                  ariaLabel="Jenis PPh"
                  value={form.wh_type}
                  onValueChange={v => setForm(f => ({ ...f, wh_type: v, wh_rate: 0 }))}
                  options={[
                    { value: "", label: "— Tidak ada —" },
                    { value: "pph23", label: "PPh 23" },
                    { value: "pph42", label: "PPh 4(2)" },
                  ]}
                  placeholder="— Tidak ada —"
                  className="glass-input w-full"
                  testId="item-form-wh-type"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="item-form-wh-rate">Tarif (%)</Label>
                <Input id="item-form-wh-rate" type="number" step={0.5} value={form.wh_rate}
                  onChange={e => setForm(f => ({ ...f, wh_rate: parseFloat(e.target.value) || 0 }))}
                  disabled={!form.wh_type}
                  className="glass-input"
                  data-testid="item-form-wh-rate" />
              </div>
            </div>
            {calcWht > 0 && (
              <div className="text-xs text-amber-800 dark:text-amber-400 bg-amber-500/10 rounded px-2 py-1">
                WHT yang dipotong: <strong>{fmtRp(calcWht)}</strong> · Net ke bank: <strong>{fmtRp(parseFloat(form.amount) - calcWht)}</strong>
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} data-testid="item-form-cancel">Batal</Button>
          <Button onClick={handleSave} disabled={saving} data-testid="item-form-save">
            <Save className="h-4 w-4" />
            {saving ? "Menyimpan..." : "Simpan Item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Apply Dialog ──────────────────────────────────────────────────────────────
function ApplyDialog({ template, onClose, onApplied }) {
  const today = new Date().toISOString().slice(0, 10);
  const [paymentDate, setPaymentDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [applying, setApplying] = useState(false);

  async function handleApply() {
    if (!paymentDate) { toast.error("Payment date wajib"); return; }
    setApplying(true);
    try {
      const res = await api.post(`/finance/payment-run-templates/${template.id}/apply`, {
        payment_date: paymentDate, notes,
      });
      const result = unwrap(res);
      toast.success(result.run_doc_no
        ? `Payment Run ${result.run_doc_no} dibuat — siap dikonfirmasi`
        : `${result.pr_doc_nos?.length || 0} PR dibuat, menunggu approval`);
      onApplied(result);
    } catch (e) {
      toast.error(e?.response?.data?.errors?.[0]?.message || "Gagal apply");
    } finally { setApplying(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md" data-testid="tmpl-detail-apply-dialog">
        <DialogHeader>
          <DialogTitle>Apply Template</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-muted/30 rounded-lg p-4 text-sm space-y-1.5">
            <div className="flex justify-between"><span>Items:</span><strong>{template.item_count}</strong></div>
            <div className="flex justify-between"><span>Total:</span><strong>{fmtRp(template.total_amount)}</strong></div>
            <div className="flex justify-between"><span>Bank:</span><span className="text-xs">{template.bank_account_name}</span></div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="detail-apply-date">Payment Date <span className="text-red-700 dark:text-red-400">*</span></Label>
            <Input id="detail-apply-date" type="date" value={paymentDate}
              onChange={e => setPaymentDate(e.target.value)}
              className="glass-input" data-testid="detail-apply-date" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="detail-apply-notes">Catatan</Label>
            <Input id="detail-apply-notes" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Mis: Pembayaran vendor Juli 2026" className="glass-input"
              data-testid="detail-apply-notes" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} data-testid="detail-apply-cancel">Batal</Button>
          <Button onClick={handleApply} disabled={applying} data-testid="detail-apply-submit">
            <Play className="h-4 w-4" />
            {applying ? "Memproses..." : "Apply sekarang"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function round2(n) { return Math.round(n * 100) / 100; }
