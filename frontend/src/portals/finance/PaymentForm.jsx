/** Payment Request create/edit form — Sprint 1 PPh withholding support. */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Banknote, Info, Save, Calculator, ChevronDown, ChevronRight } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LoadingState from "@/components/shared/LoadingState";
import PageHeader from "@/components/shared/PageHeader";
import { FormActionBar, useDirtyState, confirmDiscard } from "@/components/shared/UnsavedChanges";
import { fmtRp, fmtDate, todayJakartaISO } from "@/lib/format";
import { toast } from "sonner";

// PPh service types (match backend models/tax.py)
const PPH23_TYPES = [
  { code: "jasa",       label: "Jasa (Umum)",           rate: 0.02 },
  { code: "royalti",    label: "Royalti",                rate: 0.15 },
  { code: "bunga",      label: "Bunga / Hadiah",         rate: 0.15 },
  { code: "dividen",    label: "Dividen ke WP Badan",    rate: 0.15 },
  { code: "sewa",       label: "Sewa Selain Tanah/Bangunan", rate: 0.02 },
  { code: "konsultan",  label: "Jasa Konsultan",         rate: 0.02 },
  { code: "teknik",     label: "Jasa Teknik",            rate: 0.02 },
  { code: "manajemen",  label: "Jasa Manajemen",         rate: 0.02 },
];

const PPH42_TYPES = [
  { code: "sewa_bangunan",             label: "Sewa Tanah/Bangunan",        rate: 0.10 },
  { code: "konstruksi_kecil",          label: "Jasa Konstruksi (Kecil)",    rate: 0.02 },
  { code: "konstruksi_menengah",       label: "Jasa Konstruksi (Menengah)", rate: 0.03 },
  { code: "konstruksi_besar",          label: "Jasa Konstruksi (Besar)",    rate: 0.04 },
  { code: "konstruksi_perencanaan",    label: "Perencanaan Konstruksi Kecil", rate: 0.04 },
  { code: "konstruksi_perencanaan_besar", label: "Perencanaan Konstruksi Besar", rate: 0.06 },
  { code: "hak_tanah",                 label: "Pengalihan Hak Tanah/Bangunan", rate: 0.025 },
];

const BACK_PATH = "/finance/payments-hub?tab=payments";

export default function PaymentForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [taxConfig, setTaxConfig] = useState(null);
  const [whOpen, setWhOpen] = useState(false); // expanded withholding section

  const [form, setForm] = useState({
    payee_type: "vendor",
    payee_id: "",
    payee_text: "",
    amount: "",
    description: "",
    gl_debit_id: "",
    bank_account_id: "",
    invoice_no: "",
    invoice_date: "",
    gr_id: "",
    request_date: todayJakartaISO(),
    notes: "",
    // PPh withholding fields
    wh_type: "",         // pph23 | pph42 | ""
    wh_subtype: "",      // e.g. jasa, sewa_bangunan
    wh_rate: 0,
    wh_amount: 0,
    wh_coa_id: "",
  });

  const [vendors, setVendors] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [coas, setCoas] = useState([]);
  const [banks, setBanks] = useState([]);
  const [unpaidGrs, setUnpaidGrs] = useState([]);
  const [selectedGr, setSelectedGr] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [vRes, eRes, cRes, bRes, gRes, taxRes] = await Promise.all([
          api.get("/master/vendors?page=1&per_page=200"),
          api.get("/master/employees?page=1&per_page=200"),
          api.get("/master/chart-of-accounts?page=1&per_page=300"),
          api.get("/master/bank-accounts?page=1&per_page=50"),
          api.get("/finance/payments/unpaid-grs"),
          api.get("/tax/config").catch(() => ({ data: { success: false } })),
        ]);
        setVendors(unwrap(vRes) || []);
        setEmployees(unwrap(eRes) || []);
        setCoas((unwrap(cRes) || []).filter(c => c.is_postable && c.active));
        setBanks(unwrap(bRes) || []);
        setUnpaidGrs(unwrap(gRes) || []);
        if (taxRes?.data?.success) setTaxConfig(taxRes.data.data);
      } catch (e) {
        toast.error("Gagal memuat master data");
      } finally { setLoading(false); }
    })();
  }, []);

  // Compute withholding COA id from coas list
  const whCoaIds = useMemo(() => {
    const find = code => coas.find(c => c.code === code)?.id || "";
    return { pph23: find("2113"), pph42: find("2114") };
  }, [coas]);

  // Compute withholding amount automatically
  const gross = parseFloat(form.amount) || 0;
  const whAmount = gross > 0 && form.wh_rate > 0 ? Math.round(gross * form.wh_rate) : 0;
  const netToPay = gross - whAmount;

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function onWhTypeChange(whType) {
    if (!whType || whType === "none") {
      setForm(f => ({ ...f, wh_type: "", wh_subtype: "", wh_rate: 0, wh_amount: 0, wh_coa_id: "" }));
      return;
    }
    const coaId = whCoaIds[whType] || "";
    if (whType === "pph23") {
      const dflt = PPH23_TYPES[0];
      setForm(f => ({ ...f, wh_type: whType, wh_subtype: dflt.code, wh_rate: dflt.rate, wh_coa_id: coaId }));
    } else if (whType === "pph42") {
      const dflt = PPH42_TYPES[0];
      setForm(f => ({ ...f, wh_type: whType, wh_subtype: dflt.code, wh_rate: dflt.rate, wh_coa_id: coaId }));
    }
  }

  function onWhSubtypeChange(subtype) {
    const list = form.wh_type === "pph23" ? PPH23_TYPES : PPH42_TYPES;
    const found = list.find(t => t.code === subtype);
    if (found) setForm(f => ({ ...f, wh_subtype: subtype, wh_rate: found.rate }));
  }

  function onGrSelect(gr_id) {
    const gr = unpaidGrs.find(g => g.gr_id === gr_id);
    setSelectedGr(gr || null);
    if (gr) {
      const apCoa = coas.find(c => c.code === "2101");
      setForm(f => ({
        ...f, gr_id,
        payee_id: gr.vendor_id,
        amount: String(gr.outstanding),
        description: `Payment for ${gr.doc_no} — ${gr.vendor_name}`,
        invoice_no: gr.invoice_no || "",
        invoice_date: gr.receive_date,
        gl_debit_id: apCoa ? apCoa.id : f.gl_debit_id,
      }));
    }
  }

  async function submit(andSubmit = false) {
    if (!form.description.trim()) { toast.error("Deskripsi wajib diisi"); return; }
    if (!Number(form.amount) || Number(form.amount) <= 0) { toast.error("Amount harus > 0"); return; }
    if (!form.gl_debit_id) { toast.error("Pilih GL Debit"); return; }
    if (!form.bank_account_id) { toast.error("Pilih Bank Account"); return; }
    if (form.payee_type === "vendor" && !form.payee_id && !form.payee_text) {
      toast.error("Pilih vendor atau isi nama payee"); return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        amount: Number(form.amount),
        wh_amount: whAmount,
        wh_rate: form.wh_rate || 0,
      };
      if (!payload.wh_type) { delete payload.wh_type; delete payload.wh_subtype; delete payload.wh_rate; delete payload.wh_amount; delete payload.wh_coa_id; }
      if (form.payee_type === "other") payload.payee_id = null;
      if (!form.payee_id) delete payload.payee_id;
      if (!form.gr_id) delete payload.gr_id;
      const res = await api.post("/finance/payments", payload);
      const created = unwrap(res);
      if (andSubmit) {
        await api.post(`/finance/payments/${created.id}/submit`);
        toast.success(`PAY ${created.doc_no} dibuat & disubmit — menunggu approval`);
      } else {
        toast.success(`PAY ${created.doc_no} dibuat sebagai draft`);
      }
      markSaved();
      navigate(`/finance/payments/${created.id}`);
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal menyimpan");
    } finally { setSaving(false); }
  }

  const { dirty, markSaved } = useDirtyState(form, !loading);

  // Check if PPh is enabled for vendor payments
  const pph23Active = taxConfig?.pph23?.enabled;
  const pph42Active = taxConfig?.pph42?.enabled;
  const anyPphActive = pph23Active || pph42Active;

  if (loading) return <LoadingState rows={6} />;

  return (
    <div className="max-w-4xl" data-testid="payment-form-page">
      <PageHeader
        icon={Banknote}
        title="Payment Baru"
        subtitle="Bayar vendor (dari GR outstanding atau ad-hoc), karyawan, atau pihak lain. Field bertanda * wajib diisi."
      />
      <div className="glass-card p-4 space-y-4">

        {/* Link-to-GR quick selector */}
        {unpaidGrs.length > 0 && (
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/10" data-testid="pay-gr-card">
            <Label htmlFor="pay-gr-select" className="text-xs md:text-sm font-medium">Bayar dari GR outstanding (opsional)</Label>
            <Select value={form.gr_id || "none"} onValueChange={(v) => onGrSelect(v === "none" ? "" : v)}>
              <SelectTrigger id="pay-gr-select" className="glass-input mt-1" data-testid="pay-gr-select">
                <SelectValue placeholder="Pilih GR untuk di-pay (auto-fill form)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Tanpa GR (ad-hoc payment) —</SelectItem>
                {unpaidGrs.map(gr => (
                  <SelectItem key={gr.gr_id} value={gr.gr_id}>
                    {gr.doc_no} · {gr.vendor_name} · {fmtRp(gr.outstanding)} ({fmtDate(gr.receive_date)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Tipe Payee" htmlFor="pay-payee-type" required>
            <Select value={form.payee_type} onValueChange={v => setField("payee_type", v)}>
              <SelectTrigger id="pay-payee-type" className="glass-input" data-testid="pay-payee-type">
                <SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="vendor">Vendor</SelectItem>
                <SelectItem value="employee">Employee</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Tanggal Pengajuan" htmlFor="pay-date" required>
            <Input type="date" value={form.request_date} onChange={e => setField("request_date", e.target.value)}
              id="pay-date" className="glass-input" data-testid="pay-date" />
          </Field>

          {form.payee_type === "vendor" && (
            <Field label="Vendor" htmlFor="pay-vendor" required className="md:col-span-2">
              <Select value={form.payee_id || ""} onValueChange={v => setField("payee_id", v)}>
                <SelectTrigger id="pay-vendor" className="glass-input" data-testid="pay-vendor"><SelectValue placeholder="Pilih vendor..." /></SelectTrigger>
                <SelectContent>{vendors.map(v => (<SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>))}</SelectContent>
              </Select>
            </Field>
          )}
          {form.payee_type === "employee" && (
            <Field label="Karyawan" htmlFor="pay-emp" required className="md:col-span-2">
              <Select value={form.payee_id || ""} onValueChange={v => setField("payee_id", v)}>
                <SelectTrigger id="pay-emp" className="glass-input" data-testid="pay-emp"><SelectValue placeholder="Pilih employee..." /></SelectTrigger>
                <SelectContent>{employees.map(e => (<SelectItem key={e.id} value={e.id}>{e.full_name} · {e.position}</SelectItem>))}</SelectContent>
              </Select>
            </Field>
          )}
          {form.payee_type === "other" && (
            <Field label="Nama Payee / Deskripsi" htmlFor="pay-payee-text" required className="md:col-span-2">
              <Input value={form.payee_text} onChange={e => setField("payee_text", e.target.value)}
                placeholder="mis. PLN, Telkom, dll" id="pay-payee-text" className="glass-input" data-testid="pay-payee-text" />
            </Field>
          )}

          <Field label="Nominal Bruto (Rp)" htmlFor="pay-amount" required>
            <Input type="number" inputMode="numeric" value={form.amount}
              onChange={e => setField("amount", e.target.value)}
              id="pay-amount" className="glass-input tabular-nums" data-testid="pay-amount" min={1} />
          </Field>

          <Field label="Bank Account (sumber dana)" htmlFor="pay-bank" required>
            <Select value={form.bank_account_id} onValueChange={v => setField("bank_account_id", v)}>
              <SelectTrigger id="pay-bank" className="glass-input" data-testid="pay-bank"><SelectValue placeholder="Pilih bank account..." /></SelectTrigger>
              <SelectContent>{banks.map(b => (<SelectItem key={b.id} value={b.id}>{b.bank} {b.account_number} — {b.name}</SelectItem>))}</SelectContent>
            </Select>
          </Field>

          <Field label="GL Debit (COA yang didebit)" htmlFor="pay-gldebit" required className="md:col-span-2">
            <Select value={form.gl_debit_id} onValueChange={v => setField("gl_debit_id", v)}>
              <SelectTrigger id="pay-gldebit" className="glass-input" data-testid="pay-gldebit"><SelectValue placeholder="Pilih COA debit..." /></SelectTrigger>
              <SelectContent>{coas.map(c => (<SelectItem key={c.id} value={c.id}>{c.code} · {c.name} <span className="text-muted-foreground">({c.type})</span></SelectItem>))}</SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Untuk bayar vendor (link ke GR): gunakan COA Accounts Payable (2101). Untuk expense langsung: gunakan expense COA.
            </p>
          </Field>

          <Field label="No. Invoice (opsional)" htmlFor="pay-invno">
            <Input value={form.invoice_no} onChange={e => setField("invoice_no", e.target.value)}
              id="pay-invno" className="glass-input" data-testid="pay-invno" />
          </Field>

          <Field label="Tanggal Invoice (opsional)" htmlFor="pay-invdate">
            <Input type="date" value={form.invoice_date} onChange={e => setField("invoice_date", e.target.value)}
              id="pay-invdate" className="glass-input" data-testid="pay-invdate" />
          </Field>

          <Field label="Deskripsi" htmlFor="pay-desc" required className="md:col-span-2">
            <Textarea value={form.description} onChange={e => setField("description", e.target.value)}
              placeholder="Alasan/keperluan pembayaran..." rows={2} id="pay-desc" className="glass-input" data-testid="pay-desc" />
          </Field>

          <Field label="Catatan (internal)" htmlFor="pay-notes" className="md:col-span-2">
            <Textarea value={form.notes} onChange={e => setField("notes", e.target.value)}
              placeholder="Catatan tambahan..." rows={2} id="pay-notes" className="glass-input" data-testid="pay-notes" />
          </Field>
        </div>

        {/* PPh Withholding Section (Sprint 1) */}
        {form.payee_type === "vendor" && (
          <div className="rounded-lg border border-amber-500/30 overflow-hidden">
            <button
              type="button"
              onClick={() => setWhOpen(o => !o)}
              aria-expanded={whOpen}
              data-testid="pay-wh-toggle"
              className="w-full flex items-center justify-between px-4 py-3 bg-amber-500/5 hover:bg-amber-500/10 transition-colors text-sm"
            >
              <div className="flex items-center gap-2">
                <Calculator size={15} className="text-amber-800 dark:text-amber-400" />
                <span className="font-medium text-amber-800 dark:text-amber-300">
                  PPh Withholding
                  {form.wh_type && (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                      {form.wh_type.toUpperCase()} — {(form.wh_rate * 100).toFixed(0)}% → Potong {fmtRp(whAmount)}
                    </span>
                  )}
                  {!anyPphActive && !form.wh_type && (
                    <span className="ml-2 text-xs text-amber-800 dark:text-amber-400">(aktifkan di Admin → Tax)</span>
                  )}
                </span>
              </div>
              {whOpen ? <ChevronDown size={16} className="text-amber-800 dark:text-amber-400" /> : <ChevronRight size={16} className="text-amber-800 dark:text-amber-400" />}
            </button>

            {whOpen && (
              <div className="p-4 space-y-4">
                {!anyPphActive && (
                  <div className="text-sm text-amber-800 dark:text-amber-300 bg-amber-500/10 rounded-lg p-3 border border-amber-500/30">
                    PPh 23 dan PPh 4(2) belum diaktifkan. Aktifkan di <strong>Admin → Tax / Pajak</strong> untuk menggunakan fitur ini.
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                  <Field label="Jenis PPh" htmlFor="pay-wh-type">
                    <Select value={form.wh_type || "none"} onValueChange={v => onWhTypeChange(v === "none" ? "" : v)}>
                      <SelectTrigger id="pay-wh-type" className="glass-input" data-testid="pay-wh-type">
                        <SelectValue placeholder="Tidak ada withholding..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Tidak ada withholding —</SelectItem>
                        {(pph23Active || !anyPphActive) && <SelectItem value="pph23">PPh 23 (Jasa/Royalti)</SelectItem>}
                        {(pph42Active || !anyPphActive) && <SelectItem value="pph42">PPh 4(2) (Sewa/Konstruksi)</SelectItem>}
                      </SelectContent>
                    </Select>
                  </Field>

                  {form.wh_type && (
                    <Field label="Jenis Transaksi" htmlFor="pay-wh-subtype">
                      <Select value={form.wh_subtype || ""} onValueChange={onWhSubtypeChange}>
                        <SelectTrigger id="pay-wh-subtype" className="glass-input" data-testid="pay-wh-subtype">
                          <SelectValue placeholder="Pilih jenis..." />
                        </SelectTrigger>
                        <SelectContent>
                          {(form.wh_type === "pph23" ? PPH23_TYPES : PPH42_TYPES).map(t => (
                            <SelectItem key={t.code} value={t.code}>
                              {t.label} — {(t.rate * 100).toFixed(0)}%
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                </div>

                {form.wh_type && gross > 0 && (
                  <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-muted/40 border text-sm" data-testid="pay-wh-summary">
                    <div>
                      <div className="text-muted-foreground text-xs mb-1">Bruto (Gross)</div>
                      <div className="font-semibold tabular-nums" data-testid="pay-wh-gross">{fmtRp(gross)}</div>
                    </div>
                    <div>
                      <div className="text-red-700 dark:text-red-400 text-xs mb-1">PPh Dipotong ({(form.wh_rate*100).toFixed(0)}%)</div>
                      <div className="font-semibold tabular-nums text-red-700 dark:text-red-400" data-testid="pay-wh-amount">— {fmtRp(whAmount)}</div>
                    </div>
                    <div>
                      <div className="text-emerald-700 dark:text-emerald-400 text-xs mb-1">Net ke Vendor</div>
                      <div className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400" data-testid="pay-wh-net">{fmtRp(netToPay)}</div>
                    </div>
                  </div>
                )}

                {form.wh_type && (
                  <p className="text-xs text-muted-foreground" data-testid="pay-wh-je-preview">
                    JE: Dr GL Debit ({fmtRp(gross)}) / Cr Bank ({fmtRp(netToPay)}) / Cr Utang {form.wh_type.toUpperCase()} ({fmtRp(whAmount)})
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {selectedGr && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm flex items-start gap-2" data-testid="pay-selected-gr">
            <Info className="h-4 w-4 mt-0.5 text-emerald-700 dark:text-emerald-400" />
            <div>
              <div className="font-semibold text-emerald-800 dark:text-emerald-300">GR {selectedGr.doc_no} akan ditandai "paid" setelah mark-paid.</div>
              <div className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                Outstanding: {fmtRp(selectedGr.outstanding)} · Vendor: {selectedGr.vendor_name}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Simpan/Ajukan selalu terlihat di bawah form (DESIGN_SYSTEM §10.4). */}
      <FormActionBar dirty={dirty} hint="Field bertanda * wajib diisi." testId="pay-form-actions">
        <Button variant="ghost" onClick={async () => { if (await confirmDiscard()) navigate(BACK_PATH); }} data-testid="pay-cancel">Batal</Button>
        <Button variant="outline" onClick={() => submit(false)} disabled={saving} data-testid="pay-save-draft">
          <Save className="h-4 w-4" /> Simpan draft
        </Button>
        <Button onClick={() => submit(true)} disabled={saving} data-testid="pay-save-submit">
          {saving ? "Menyimpan..." : "Simpan & ajukan approval"}
        </Button>
      </FormActionBar>
    </div>
  );
}

function Field({ label, htmlFor, required = false, children, className = "" }) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} className="text-xs md:text-sm font-medium">
        {label}{required && <span className="text-red-700 dark:text-red-400"> *</span>}
      </Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
