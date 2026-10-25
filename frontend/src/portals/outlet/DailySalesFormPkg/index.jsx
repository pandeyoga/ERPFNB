/** DailySalesForm/index.jsx — daily sales entry wizard. */
/** Daily Sales Form — Phase 9C: 5-step wizard + autosave.
 *  Steps: 1) Channel · 2) Revenue · 3) Service & Tax · 4) Payment · 5) Review.
 *  Each step validates locally; final Review step shows reconciliation diff.
 *  Autosaves draft every 5 seconds (debounced) to /api/outlet/daily-sales/draft.
 *
 *  Existing submit/validate flow preserved (same backend contracts).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Save, Send, ArrowLeft, ArrowRight, Plus, Trash2,
  AlertTriangle, CheckCircle2, Wallet, Tag, Receipt,
  Coins, ListChecks, Loader2, UserCheck, Search, X, Star,
} from "lucide-react";
import api, { unwrap, fetchAll } from "@/lib/api";
import { Button } from "@/components/ui/button";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import PeriodLockBanner from "@/components/shared/PeriodLockBanner";
import { fmtRp, todayJakartaISO } from "@/lib/format";
import StatusPill from "@/components/shared/StatusPill";
import PageHeader from "@/components/shared/PageHeader";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useOutletScopeCtx } from "../OutletScopeContext";
import { Stepper, AutosaveBadge, ChannelStep, RevenueStep, TaxStep, PaymentStep, ReviewStep, mergeChannels, mergeBuckets } from "../DailySalesFormSteps";

import { DEFAULT_CHANNELS, DEFAULT_BUCKETS, STEPS } from "./constants";

export default function DailySalesForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { outletId: scopeOutletId, scopedOutlets } = useOutletScopeCtx();
  const isEdit = !!id;
  const [brands, setBrands] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState("idle"); // idle|saving|saved|error
  const [stepIdx, setStepIdx] = useState(0);
  const [periodLocked, setPeriodLocked] = useState(false);

  const [form, setForm] = useState({
    id: null,
    outlet_id: "",
    brand_id: "",
    sales_date: todayJakartaISO(),
    channels: DEFAULT_CHANNELS.map(c => ({ ...c, gross: 0, discount: 0, net: 0 })),
    revenue_buckets: DEFAULT_BUCKETS.map(b => ({ ...b, amount: 0 })),
    payment_breakdown: [],
    service_charge: 0,
    tax_amount: 0,
    transaction_count: 0,
    notes: "",
    status: "draft",
    rejected_reason: null,
    voucher_code: "",
    voucher_discount_amount: 0,
    voucher_meta: null,
  });

  // Loyalty customer lookup state


  // Sprint C — Voucher state
  const [voucherInput, setVoucherInput] = useState("");
  const [voucherValidating, setVoucherValidating] = useState(false);
  const [voucherStatus, setVoucherStatus] = useState(null); // null | { valid, status, discount_value, message, ... }
  const [voucherRules, setVoucherRules] = useState(null);

  // ----- Load masters -----
  // Outlets datang dari OutletScopeContext. Brand & metode pembayaran sebelumnya tidak
  // pernah dimuat (state kosong) → dropdown Brand & "Metode" di langkah Payment selalu
  // kosong sehingga langkah 4 tidak bisa dilewati.
  useEffect(() => {
    fetchAll("/master/brands").then(r => setBrands(unwrap(r) || [])).catch(() => {});
    fetchAll("/master/payment-methods").then(r => setPaymentMethods(unwrap(r) || [])).catch(() => {});
  }, []);

  // Default outlet_id from outlet picker context (or single-outlet user)
  useEffect(() => {
    if (form.outlet_id) return;
    if (scopeOutletId) { setForm(f => ({ ...f, outlet_id: scopeOutletId })); return; }
    const userOutlets = user?.outlet_ids || [];
    if (userOutlets.length === 1) setForm(f => ({ ...f, outlet_id: userOutlets[0] }));
    else if (scopedOutlets.length === 1) setForm(f => ({ ...f, outlet_id: scopedOutlets[0].id }));
  }, [user, scopeOutletId, scopedOutlets.length]); // eslint-disable-line

  // ----- Load existing -----
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get(`/outlet/daily-sales/${id}`).then(res => {
      const ds = unwrap(res);
      if (ds) {
        setForm(prev => ({
          ...prev,
          id: ds.id,
          outlet_id: ds.outlet_id,
          brand_id: ds.brand_id || "",
          sales_date: ds.sales_date,
          channels: mergeChannels(ds.channels || [], DEFAULT_CHANNELS),
          revenue_buckets: mergeBuckets(ds.revenue_buckets || [], DEFAULT_BUCKETS),
          payment_breakdown: ds.payment_breakdown || [],
          service_charge: ds.service_charge || 0,
          tax_amount: ds.tax_amount || 0,
          transaction_count: ds.transaction_count || 0,
          notes: ds.notes || "",
          status: ds.status,
          rejected_reason: ds.rejected_reason,
          voucher_code: ds.voucher_code || "",
          voucher_discount_amount: ds.voucher_discount_amount || 0,
          voucher_meta: ds.voucher_meta || null,
        }));

        // Restore voucher if exists
        if (ds.voucher_code) {
          setVoucherInput(ds.voucher_code);
          if (ds.voucher_meta) {
            setVoucherStatus({
              valid: true,
              status: "valid",
              discount_value: ds.voucher_discount_amount || 0,
              message: `Voucher applied: ${ds.voucher_meta.reward_name || "Discount"}`,
              ...ds.voucher_meta,
            });
          }
        }
      }
    }).catch(() => toast.error("Gagal load draft")).finally(() => setLoading(false));
  }, [id]);

  // ----- Computed totals -----
  const grossTotal = useMemo(() => form.channels.reduce((s, c) => s + Number(c.gross || 0), 0), [form.channels]);
  const netTotal = useMemo(() => form.channels.reduce((s, c) => s + Number(c.net || 0), 0), [form.channels]);
  const revenueTotal = useMemo(() => form.revenue_buckets.reduce((s, b) => s + Number(b.amount || 0), 0), [form.revenue_buckets]);
  const grandTotal = useMemo(
    () => Number(revenueTotal) + Number(form.service_charge || 0) + Number(form.tax_amount || 0)
      - Number(form.voucher_discount_amount || 0),
    [revenueTotal, form.service_charge, form.tax_amount, form.voucher_discount_amount],
  );
  const paymentTotal = useMemo(() => form.payment_breakdown.reduce((s, p) => s + Number(p.amount || 0), 0), [form.payment_breakdown]);
  const balanced = Math.abs(grandTotal - paymentTotal) < 1;
  const channelNetVsRevenue = Math.abs(netTotal - revenueTotal);
  const channelRevenueAligned = channelNetVsRevenue < 1 || revenueTotal === 0;

  // ----- Mutators -----
  function setChannelVal(i, key, val) {
    setForm(f => {
      const c = [...f.channels];
      c[i] = { ...c[i], [key]: val };
      if (key === "gross" || key === "discount") {
        c[i].net = Math.max(0, Number(c[i].gross || 0) - Number(c[i].discount || 0));
      }
      return { ...f, channels: c };
    });
  }
  function setBucketVal(i, val) {
    setForm(f => {
      const b = [...f.revenue_buckets];
      b[i] = { ...b[i], amount: val };
      return { ...f, revenue_buckets: b };
    });
  }
  function addPayment() {
    setForm(f => ({
      ...f,
      payment_breakdown: [...f.payment_breakdown, { payment_method_id: "", payment_method_name: "", amount: 0 }],
    }));
  }
  function setPaymentVal(i, key, val) {
    setForm(f => {
      const p = [...f.payment_breakdown];
      p[i] = { ...p[i], [key]: val };
      if (key === "payment_method_id") {
        const pm = paymentMethods.find(x => x.id === val);
        if (pm) p[i].payment_method_name = pm.name;
      }
      return { ...f, payment_breakdown: p };
    });
  }
  function removePayment(i) {
    setForm(f => ({ ...f, payment_breakdown: f.payment_breakdown.filter((_, idx) => idx !== i) }));
  }

  // ----- Sprint C: Voucher validation -----
  async function validateVoucher() {
    const code = voucherInput.trim();
    if (!code) {
      setVoucherStatus({ valid: false, status: "invalid", message: "Masukkan kode voucher" });
      return;
    }
    setVoucherValidating(true);
    setVoucherStatus({ valid: false, status: "checking", message: "Memvalidasi..." });
    try {
      const res = await api.post("/outlet/vouchers/validate", {
        code,
        outlet_id: form.outlet_id,
        sales_date: form.sales_date,
      });
      const result = unwrap(res);
      setVoucherStatus(result);
      if (result.valid) {
        // Apply voucher to form
        setForm(f => ({
          ...f,
          voucher_code: code.trim().toUpperCase(),
          voucher_discount_amount: result.discount_type === "percentage"
            ? Math.round(Number(revenueTotal || 0) * Number(result.discount_value || 0) / 100)
            : Number(result.discount_value || 0),
          voucher_meta: {
            reward_name: result.reward_name,
            discount_type: result.discount_type,
            discount_value: result.discount_value,
            expiry: result.expiry,
            redemption_id: result.redemption_id,
            validated_at: new Date().toISOString(),
          },
        }));
        toast.success(result.message || "Voucher valid!");
      } else {
        toast.error(result.message || "Voucher tidak valid");
      }
    } catch (e) {
      const msg = e.response?.data?.errors?.[0]?.message || "Gagal validasi voucher";
      setVoucherStatus({ valid: false, status: "invalid", message: msg });
      toast.error(msg);
    } finally {
      setVoucherValidating(false);
    }
  }

  function clearVoucher() {
    setVoucherInput("");
    setVoucherStatus(null);
    setForm(f => ({
      ...f,
      voucher_code: "",
      voucher_discount_amount: 0,
      voucher_meta: null,
    }));
  }

  // ----- Save / Submit -----
  async function saveDraftCore({ silent = false } = {}) {
    if (!form.outlet_id || !form.sales_date) {
      if (!silent) toast.error("Outlet & tanggal wajib");
      return null;
    }
    if (!silent) setSaving(true);
    setAutosaveStatus("saving");
    try {
      const payload = {
        outlet_id: form.outlet_id,
        brand_id: form.brand_id || null,
        sales_date: form.sales_date,
        channels: form.channels,
        revenue_buckets: form.revenue_buckets,
        payment_breakdown: form.payment_breakdown,
        service_charge: Number(form.service_charge || 0),
        tax_amount: Number(form.tax_amount || 0),
        transaction_count: Number(form.transaction_count || 0),
        notes: form.notes,
        voucher_code: form.voucher_code || null,
        voucher_discount_amount: Number(form.voucher_discount_amount || 0),
        voucher_meta: form.voucher_meta || null,
      };
      const res = await api.post("/outlet/daily-sales/draft", payload);
      const saved = unwrap(res);
      if (!form.id && saved?.id) {
        navigate(`/outlet/daily-sales/${saved.id}/edit`, { replace: true });
      } else if (saved) {
        setForm(f => ({ ...f, id: saved.id, status: saved.status }));
      }
      setAutosaveStatus("saved");
      if (!silent) toast.success("Draft disimpan");
      return saved;
    } catch (e) {
      setAutosaveStatus("error");
      if (!silent) toast.error(e.response?.data?.errors?.[0]?.message || "Gagal simpan");
      return null;
    } finally {
      if (!silent) setSaving(false);
    }
  }

  async function submitForValidation() {
    if (!form.id) {
      const saved = await saveDraftCore();
      if (!saved) return;
    }
    if (!balanced) {
      toast.error("Total pembayaran belum balance dengan grand total");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/outlet/daily-sales/${form.id}/submit`);
      toast.success("Daily sales di-submit untuk validasi");
      navigate(`/outlet/daily-sales/${form.id}`);
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal submit");
    } finally { setSubmitting(false); }
  }

  // ----- Autosave (5s debounce) -----
  const autosaveTimer = useRef(null);
  const isFirstRun = useRef(true);
  const editable = !form.status || form.status === "draft" || form.status === "rejected";

  useEffect(() => {
    if (!editable) return;
    if (!form.outlet_id || !form.sales_date) return;
    // Skip the very first run after load
    if (isFirstRun.current) { isFirstRun.current = false; return; }
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      saveDraftCore({ silent: true });
    }, 5000);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [
    form.outlet_id, form.brand_id, form.sales_date, form.channels,
    form.revenue_buckets, form.payment_breakdown, form.service_charge,
    form.tax_amount, form.transaction_count, form.notes, form.voucher_code,
    form.voucher_discount_amount, editable,
  ]); // eslint-disable-line

  // ----- Step gating -----
  function canGoNext() {
    const step = STEPS[stepIdx];
    if (step.key === "channel") {
      if (!form.outlet_id) return { ok: false, msg: "Pilih outlet dulu" };
      if (!form.sales_date) return { ok: false, msg: "Tanggal wajib diisi" };
      if (grossTotal <= 0) return { ok: false, msg: "Isi minimal 1 channel dengan gross > 0" };
      return { ok: true };
    }
    if (step.key === "revenue") {
      if (revenueTotal <= 0) return { ok: false, msg: "Isi minimal 1 revenue bucket" };
      if (!channelRevenueAligned) {
        return { ok: false, msg: `Net channel (${fmtRp(netTotal)}) ≠ revenue bucket total (${fmtRp(revenueTotal)}) — selisih ${fmtRp(channelNetVsRevenue)}` };
      }
      return { ok: true };
    }
    if (step.key === "tax") {
      // Service & Tax are optional — but transaction_count > 0 is helpful
      return { ok: true };
    }
    if (step.key === "payment") {
      if (form.payment_breakdown.length === 0) return { ok: false, msg: "Tambahkan minimal 1 metode pembayaran" };
      if (form.payment_breakdown.some(p => !p.payment_method_id)) return { ok: false, msg: "Lengkapi semua metode pembayaran" };
      return { ok: true };
    }
    return { ok: true };
  }

  const nextCheck = canGoNext();

  function handleNext() {
    const c = canGoNext();
    if (!c.ok) { toast.error(c.msg); return; }
    setStepIdx(i => Math.min(i + 1, STEPS.length - 1));
  }

  function handlePrev() {
    setStepIdx(i => Math.max(i - 1, 0));
  }

  // ----- Render -----
  return (
    <div className="space-y-3 lg:space-y-4 max-w-5xl mx-auto">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate(isEdit ? `/outlet/daily-sales/${id}` : "/outlet/daily-sales")} className="-ml-2 mb-1" data-testid="ds-form-back">
          <ArrowLeft className="h-4 w-4" /> {isEdit ? "Kembali ke detail" : "Kembali ke Daily Sales"}
        </Button>
        <PageHeader
          icon={Receipt}
          title={isEdit ? "Edit Daily Sales" : "Daily Sales Baru"}
          subtitle="Isi per langkah — draft tersimpan otomatis setiap 5 detik."
          className="mb-0 md:mb-0"
          actions={
            <>
              <Button onClick={() => saveDraftCore()} disabled={!editable || saving}
                variant="outline"
                data-testid="ds-save-draft">
                <Save className="h-4 w-4" /> {saving ? "Menyimpan…" : "Simpan Draft"}
              </Button>
              <Button onClick={submitForValidation}
                disabled={!editable || submitting || !balanced || periodLocked}
                data-testid="ds-submit">
                <Send className="h-4 w-4" /> {submitting ? "Mengirim…" : "Submit"}
              </Button>
            </>
          }
        >
          {(form.status || autosaveStatus !== "idle") && (
            <div className="flex items-center gap-2 flex-wrap">
              {form.status && <StatusPill status={form.status} />}
              <AutosaveBadge status={autosaveStatus} />
            </div>
          )}
        </PageHeader>
      </div>

      <PeriodLockBanner
        date={form.sales_date}
        action="submit/validate Daily Sales"
        onLockState={({ locked, closed }) => setPeriodLocked(locked || closed)}
      />

      {form.status === "rejected" && form.rejected_reason && (
        <div className="glass-card border-l-4 border-red-500 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-red-700 dark:text-red-400">Daily sales ini di-reject Finance</div>
              <div className="text-sm mt-0.5">{form.rejected_reason}</div>
              <div className="text-xs text-muted-foreground mt-1">Edit lalu submit ulang.</div>
            </div>
          </div>
        </div>
      )}

      {/* Stepper */}
      <Stepper steps={STEPS} currentIdx={stepIdx} onJump={(idx) => {
        // Allow jumping to any visited step or the next valid one
        if (idx <= stepIdx) setStepIdx(idx);
        else {
          const c = canGoNext();
          if (c.ok && idx === stepIdx + 1) setStepIdx(idx);
        }
      }} />

      {/* Header (always visible) */}
      <div className="glass-card p-4 grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4">
        <div>
          <Label htmlFor="ds-date-input" className="text-xs md:text-sm font-medium">Tanggal *</Label>
          <Input id="ds-date-input" type="date" value={form.sales_date}
            onChange={e => setForm(f => ({ ...f, sales_date: e.target.value }))}
            disabled={!editable}
            className="glass-input mt-1" data-testid="ds-date" />
        </div>
        <div>
          <Label className="text-xs md:text-sm font-medium">Outlet *</Label>
          <SimpleSelect
            value={form.outlet_id}
            onValueChange={v => setForm(f => ({ ...f, outlet_id: v }))}
            disabled={!editable}
            options={[{ value: "", label: "-- Pilih outlet --" }, ...scopedOutlets.filter(o =>
                !user.outlet_ids?.length
                || user.outlet_ids.includes(o.id)
                || (user.permissions || []).includes("*")
            ).map(o => ({ value: o.id, label: o.name }))]}
            placeholder="-- Pilih outlet --"
            className="glass-input w-full mt-1"
            ariaLabel="Outlet"
            testId="ds-outlet"
          />
        </div>
        <div>
          <Label className="text-xs md:text-sm font-medium">Brand</Label>
          <SimpleSelect
            value={form.brand_id}
            onValueChange={v => setForm(f => ({ ...f, brand_id: v }))}
            disabled={!editable}
            options={[{ value: "", label: "-- (opsional) --" }, ...brands.map(b => ({ value: b.id, label: b.name }))]}
            placeholder="-- (opsional) --"
            className="glass-input w-full mt-1"
            ariaLabel="Brand"
            testId="ds-brand"
          />
        </div>
      </div>

      {/* Sprint C — Voucher Redemption Card */}
      {editable && (
        <div className="glass-card p-4 border border-dashed border-amber-500/30">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Receipt className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm md:text-base font-semibold">Voucher</h3>
            <span className="text-xs text-muted-foreground">Opsional — diskon otomatis diterapkan.</span>
          </div>
          {voucherStatus?.valid ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-3 py-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium">{voucherStatus.reward_name}</span>
                  <span className="text-xs tracking-wider text-muted-foreground">{form.voucher_code}</span>
                </div>
                <Button size="icon-sm" variant="ghost" onClick={clearVoucher}
                  aria-label="Hapus voucher" title="Hapus voucher" data-testid="ds-clear-voucher">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2"
                data-testid="daily-sales-voucher-discount-value">
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Diskon diterapkan</span>
                <span className="text-sm font-semibold tabular-nums text-emerald-800 dark:text-emerald-200">
                  {fmtRp(form.voucher_discount_amount)}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  placeholder={voucherRules?.accepted_formats_hint || "Masukkan kode voucher (contoh: VCH12345)"}
                  value={voucherInput}
                  onChange={e => { setVoucherInput(e.target.value.toUpperCase()); setVoucherStatus(null); }}
                  onKeyDown={e => e.key === "Enter" && validateVoucher()}
                  className="glass-input max-w-xs tracking-wider"
                  aria-label="Kode voucher"
                  data-testid="daily-sales-voucher-code-input"
                  disabled={voucherValidating}
                />
                <Button size="sm" onClick={validateVoucher} disabled={voucherValidating || !voucherInput.trim()}
                  variant="outline" data-testid="daily-sales-validate-voucher-button">
                  {voucherValidating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Validasi
                </Button>
              </div>
              {voucherStatus && !voucherStatus.valid && (
                <div className={cn(
                  "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ring-1 ring-inset",
                  voucherStatus.status === "checking" && "bg-blue-500/15 text-blue-700 dark:text-blue-400 ring-blue-500/30",
                  voucherStatus.status === "invalid" && "bg-red-500/15 text-red-700 dark:text-red-400 ring-red-500/30",
                  voucherStatus.status === "expired" && "bg-amber-500/15 text-amber-800 dark:text-amber-400 ring-amber-500/30",
                  voucherStatus.status === "used" && "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 ring-zinc-500/30",
                )}
                data-testid="daily-sales-voucher-status-pill">
                  {voucherStatus.status === "checking" && <Loader2 className="h-3 w-3 animate-spin" />}
                  {voucherStatus.status !== "checking" && <AlertTriangle className="h-3 w-3" />}
                  <span className="font-medium capitalize">{voucherStatus.status}</span>
                  <span data-testid="daily-sales-voucher-error-text">— {voucherStatus.message}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step content */}
      <div data-testid={`ds-step-${STEPS[stepIdx].key}`}>
        {STEPS[stepIdx].key === "channel" && (
          <ChannelStep form={form} setChannelVal={setChannelVal} editable={editable}
            grossTotal={grossTotal} netTotal={netTotal} />
        )}
        {STEPS[stepIdx].key === "revenue" && (
          <RevenueStep form={form} setBucketVal={setBucketVal} editable={editable}
            revenueTotal={revenueTotal} netTotal={netTotal}
            channelRevenueAligned={channelRevenueAligned}
            diff={channelNetVsRevenue} />
        )}
        {STEPS[stepIdx].key === "tax" && (
          <TaxStep form={form} setForm={setForm} editable={editable}
            revenueTotal={revenueTotal} grandTotal={grandTotal} />
        )}
        {STEPS[stepIdx].key === "payment" && (
          <PaymentStep form={form} addPayment={addPayment}
            setPaymentVal={setPaymentVal} removePayment={removePayment}
            paymentMethods={paymentMethods} editable={editable}
            grandTotal={grandTotal} paymentTotal={paymentTotal} balanced={balanced} />
        )}
        {STEPS[stepIdx].key === "review" && (
          <ReviewStep form={form} setForm={setForm} editable={editable}
            grossTotal={grossTotal} netTotal={netTotal}
            revenueTotal={revenueTotal} grandTotal={grandTotal}
            paymentTotal={paymentTotal} balanced={balanced}
            channelRevenueAligned={channelRevenueAligned}
            diff={channelNetVsRevenue} />
        )}
      </div>

      {/* Step nav */}
      <div className="glass-card p-3 flex items-center justify-between">
        <Button variant="outline" disabled={stepIdx === 0}
          onClick={handlePrev}
          data-testid="ds-step-prev">
          <ArrowLeft className="h-3.5 w-3.5" /> Sebelumnya
        </Button>
        <div className="text-xs text-muted-foreground">
          Langkah {stepIdx + 1} / {STEPS.length} — {STEPS[stepIdx].label}
        </div>
        {stepIdx < STEPS.length - 1 ? (
          <Button onClick={handleNext}
            disabled={!nextCheck.ok}
            title={nextCheck.ok ? "" : nextCheck.msg}
            data-testid="ds-step-next">
            Lanjut <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button onClick={submitForValidation}
            disabled={!editable || submitting || !balanced}
            data-testid="ds-step-submit">
            <Send className="h-3.5 w-3.5" /> Submit
          </Button>
        )}
      </div>
    </div>
  );
}

// ===================== STEPPER =====================
