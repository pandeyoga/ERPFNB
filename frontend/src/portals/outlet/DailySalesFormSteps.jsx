/** DailySalesForm Step Components — extracted for maintainability.
 * Contains: Stepper, AutosaveBadge, ChannelStep, RevenueStep, TaxStep, PaymentStep, ReviewStep
 */
import { useState } from "react";
import { Check, ChevronRight, CheckCircle2, AlertTriangle, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import SimpleSelect from "@/components/shared/SimpleSelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import DataTable from "@/components/shared/DataTable";
import { formatCurrency, fmtRp } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Stepper({ steps, currentIdx, onJump }) {
  return (
    <div className="glass-card p-3 overflow-x-auto" data-testid="ds-stepper">
      <ol className="flex items-center gap-2 min-w-max">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const active = i === currentIdx;
          const done = i < currentIdx;
          return (
            <li key={s.key} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onJump?.(i)}
                className={cn(
                  "h-9 px-3 rounded-full inline-flex items-center gap-1.5 border text-xs font-medium transition-colors whitespace-nowrap",
                  active && "bg-foreground text-background border-foreground",
                  !active && done && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
                  !active && !done && "bg-background text-muted-foreground border-border/60 hover:bg-foreground/5",
                )}
                data-testid={`ds-step-${s.key}-pill`}
              >
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                <span>
                  <span className="opacity-60 mr-1">{i + 1}.</span>{s.label}
                </span>
              </button>
              {i < steps.length - 1 && <span className="h-px w-4 bg-border" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function AutosaveBadge({ status }) {
  if (status === "idle") return null;
  let label, classes, Icon;
  if (status === "saving") {
    label = "Menyimpan…"; Icon = Loader2;
    classes = "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30";
  } else if (status === "saved") {
    label = "Tersimpan"; Icon = CheckCircle2;
    classes = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
  } else {
    label = "Gagal autosave"; Icon = AlertTriangle;
    classes = "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30";
  }
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${classes}`}
      data-testid="ds-autosave-badge">
      <Icon className={`h-3 w-3 ${status === "saving" ? "animate-spin" : ""}`} />
      {label}
    </span>
  );
}

// ===================== STEPS =====================
export function ChannelStep({ form, setChannelVal, editable, grossTotal, netTotal }) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold">1. Channel Sales</h3>
          <p className="text-xs text-muted-foreground">
            Isi gross + diskon per channel — net dihitung otomatis.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">Net total: <b>{fmtRp(netTotal)}</b></span>
      </div>
      <DataTable
        rows={form.channels.map((c, i) => ({ ...c, _idx: i }))}
        keyField="_idx"
        loading={false}
        stickyHeader={false}
        rowTestIdPrefix="ds-channel"
        columns={[
          { key: "label", label: "Channel", primary: true,
            render: (c) => <span className="font-medium">{c.label}</span> },
          { key: "gross", label: "Gross", numeric: true,
            render: (c) => (
              <Input type="number" min="0" value={c.gross}
                onChange={e => setChannelVal(c._idx, "gross", e.target.value)}
                disabled={!editable}
                className="glass-input h-9 text-right tabular-nums w-32"
                data-testid={`ds-ch-gross-${c.channel}`} />
            ) },
          { key: "discount", label: "Discount", numeric: true,
            render: (c) => (
              <Input type="number" min="0" value={c.discount}
                onChange={e => setChannelVal(c._idx, "discount", e.target.value)}
                disabled={!editable}
                className="glass-input h-9 text-right tabular-nums w-32"
                data-testid={`ds-ch-disc-${c.channel}`} />
            ) },
          { key: "net", label: "Net", numeric: true,
            render: (c) => <span className="font-medium">{fmtRp(c.net || 0)}</span> },
        ]}
        footer={
          <tr className="font-semibold">
            <td className="px-4 py-2.5">Total</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{fmtRp(grossTotal)}</td>
            <td></td>
            <td className="px-4 py-2.5 text-right tabular-nums">{fmtRp(netTotal)}</td>
          </tr>
        }
      />
    </div>
  );
}

export function RevenueStep({ form, setBucketVal, editable, revenueTotal, netTotal, channelRevenueAligned, diff }) {
  return (
    <div className="glass-card p-5">
      <div className="mb-3">
        <h3 className="font-semibold">2. Revenue Bucket</h3>
        <p className="text-xs text-muted-foreground">
          Distribusikan net sales ke kategori untuk Profit & Loss. Total bucket harus sama dengan net total channel.
        </p>
      </div>
      <div className="space-y-2 max-w-xl">
        {form.revenue_buckets.map((b, i) => (
          <div key={b.bucket} className="flex items-center gap-3">
            <div className="w-28 text-sm text-muted-foreground capitalize">{b.label}</div>
            <Input type="number" min="0" value={b.amount}
              onChange={e => setBucketVal(i, e.target.value)}
              disabled={!editable}
              className="glass-input h-9 text-right tabular-nums"
              data-testid={`ds-bucket-${b.bucket}`} />
          </div>
        ))}
      </div>
      <div className="mt-4 p-3 rounded-lg border border-border/40 text-xs flex items-center justify-between flex-wrap gap-2">
        <div>
          <div>Net Channel: <b className="tabular-nums">{fmtRp(netTotal)}</b></div>
          <div>Total Bucket: <b className="tabular-nums">{fmtRp(revenueTotal)}</b></div>
        </div>
        {channelRevenueAligned ? (
          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" /> Aligned
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" /> Selisih {fmtRp(diff)}
          </span>
        )}
      </div>
    </div>
  );
}

export function TaxStep({ form, setForm, editable, revenueTotal, grandTotal }) {
  return (
    <div className="glass-card p-5">
      <div className="mb-3">
        <h3 className="font-semibold">3. Service Charge & Tax</h3>
        <p className="text-xs text-muted-foreground">
          Service charge dan PB1/PPN ditambahkan ke grand total. Transaction count opsional (untuk metric).
        </p>
      </div>
      <div className="space-y-2 max-w-xl">
        <Row label="Service Chg">
          <Input type="number" min="0" value={form.service_charge}
            onChange={e => setForm(f => ({ ...f, service_charge: e.target.value }))}
            disabled={!editable} className="glass-input h-9 text-right tabular-nums"
            data-testid="ds-sc" />
        </Row>
        <Row label="Tax (PB1)">
          <Input type="number" min="0" value={form.tax_amount}
            onChange={e => setForm(f => ({ ...f, tax_amount: e.target.value }))}
            disabled={!editable} className="glass-input h-9 text-right tabular-nums"
            data-testid="ds-tax" />
        </Row>
        <Row label="Trx Count">
          <Input type="number" min="0" value={form.transaction_count}
            onChange={e => setForm(f => ({ ...f, transaction_count: e.target.value }))}
            disabled={!editable} className="glass-input h-9 text-right tabular-nums"
            data-testid="ds-trx-count" />
        </Row>
      </div>
      <div className="mt-4 p-3 rounded-lg border border-border/40 text-xs grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Stat label="Revenue" value={fmtRp(revenueTotal)} />
        <Stat label="+ SC + Tax" value={fmtRp(Number(form.service_charge || 0) + Number(form.tax_amount || 0))} />
        <Stat label="Grand Total" value={fmtRp(grandTotal)} highlight />
      </div>
    </div>
  );
}

export function PaymentStep({ form, addPayment, setPaymentVal, removePayment, paymentMethods, editable, grandTotal, paymentTotal, balanced }) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold">4. Payment Breakdown</h3>
          <p className="text-xs text-muted-foreground">
            Tambah metode pembayaran. Total harus balance dengan grand total.
          </p>
        </div>
        <Button onClick={addPayment} disabled={!editable} variant="outline" size="sm" className="rounded-full gap-1" data-testid="ds-pay-add">
          <Plus className="h-3.5 w-3.5" /> Tambah
        </Button>
      </div>
      {form.payment_breakdown.length === 0 && (
        <div className="text-sm text-muted-foreground italic">Belum ada metode pembayaran.</div>
      )}
      <div className="space-y-2">
        {form.payment_breakdown.map((p, i) => (
          <div key={i} className="flex items-center gap-3">
            <SimpleSelect
              value={p.payment_method_id}
              onValueChange={v => setPaymentVal(i, "payment_method_id", v)}
              disabled={!editable}
              options={[{ value: "", label: "-- pilih metode --" }, ...paymentMethods.map(pm => ({ value: pm.id, label: pm.name }))]}
              placeholder="-- pilih metode --"
              className="glass-input rounded-lg flex-1 px-3 h-9 text-sm"
              testId={`ds-pay-method-${i}`}
            />
            <Input type="number" min="0" value={p.amount}
              onChange={e => setPaymentVal(i, "amount", e.target.value)}
              disabled={!editable}
              className="glass-input h-9 text-right tabular-nums w-40"
              data-testid={`ds-pay-amt-${i}`} />
            <button type="button" onClick={() => removePayment(i)} disabled={!editable}
              className="h-9 w-9 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className={cn(
        "mt-4 flex items-center justify-between p-3 rounded-lg border text-sm",
        balanced ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
      )} data-testid="ds-pay-balance">
        <span className="flex items-center gap-1.5 font-medium">
          {balanced ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          Total Pembayaran vs Grand Total
        </span>
        <span className="font-bold tabular-nums">
          {fmtRp(paymentTotal)} {!balanced && `(Δ ${fmtRp(grandTotal - paymentTotal)})`}
        </span>
      </div>
    </div>
  );
}

export function ReviewStep({ form, setForm, editable, grossTotal, netTotal, revenueTotal, grandTotal, paymentTotal, balanced, channelRevenueAligned, diff }) {
  const allOk = balanced && channelRevenueAligned && netTotal > 0 && form.payment_breakdown.length > 0;
  return (
    <div className="space-y-4">
      <div className="glass-card p-5">
        <h3 className="font-semibold mb-3">5. Review &amp; Reconciliation</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <Stat label="Gross" value={fmtRp(grossTotal)} />
          <Stat label="Net Channel" value={fmtRp(netTotal)} />
          <Stat label="Revenue Bucket" value={fmtRp(revenueTotal)} />
          <Stat label="Service + Tax" value={fmtRp(Number(form.service_charge || 0) + Number(form.tax_amount || 0))} />
          <Stat label="Grand Total" value={fmtRp(grandTotal)} highlight />
          <Stat label="Total Pembayaran" value={fmtRp(paymentTotal)} highlight={!balanced} negative={!balanced} />
        </div>

        <div className="space-y-2" data-testid="ds-review-checks">
          <ReconRow ok={netTotal > 0} label="Net channel terisi" detail={`${fmtRp(netTotal)}`} />
          <ReconRow ok={channelRevenueAligned} label="Net channel ≈ revenue bucket"
            detail={channelRevenueAligned ? "aligned" : `selisih ${fmtRp(diff)} — periksa step 1 atau 2`} />
          <ReconRow ok={form.payment_breakdown.length > 0} label="Minimal 1 metode pembayaran"
            detail={`${form.payment_breakdown.length} metode`} />
          <ReconRow ok={balanced} label="Total pembayaran = grand total"
            detail={balanced ? "balanced" : `selisih ${fmtRp(grandTotal - paymentTotal)} — periksa step 4`} />
        </div>

        {!allOk && (
          <div className="mt-3 text-xs text-amber-700 dark:text-amber-300 italic">
            Perbaiki check yang masih merah sebelum submit. Anda masih bisa Save Draft kapan saja.
          </div>
        )}
      </div>

      <div className="glass-card p-5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Catatan</Label>
        <Textarea value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          disabled={!editable}
          placeholder="Catatan operasional, anomali, dll."
          className="glass-input mt-1 min-h-[80px]"
          data-testid="ds-notes" />
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 text-sm text-muted-foreground">{label}</div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function Stat({ label, value, highlight = false, negative = false }) {
  return (
    <div className={cn(
      "rounded-lg border p-3",
      highlight && !negative && "bg-emerald-500/10 border-emerald-500/30",
      highlight && negative && "bg-amber-500/10 border-amber-500/30",
      !highlight && "border-border/40",
    )}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</div>
      <div className="text-base font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

function ReconRow({ ok, label, detail }) {
  return (
    <div className={cn(
      "flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm",
      ok ? "bg-emerald-500/8 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
         : "bg-rose-500/8 border-rose-500/30 text-rose-700 dark:text-rose-300",
    )}>
      <span className="flex items-center gap-2">
        {ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        {label}
      </span>
      <span className="text-xs text-muted-foreground">{detail}</span>
    </div>
  );
}

export function mergeChannels(savedChannels, defaults) {
  const map = Object.fromEntries(savedChannels.map(c => [c.channel, c]));
  return defaults.map(d => ({
    ...d, ...map[d.channel],
    gross: map[d.channel]?.gross ?? 0,
    discount: map[d.channel]?.discount ?? 0,
    net: map[d.channel]?.net ?? 0,
  }));
}
export function mergeBuckets(saved, defaults) {
  const map = Object.fromEntries(saved.map(b => [b.bucket, b]));
  return defaults.map(d => ({ ...d, amount: map[d.bucket]?.amount ?? 0 }));
}
