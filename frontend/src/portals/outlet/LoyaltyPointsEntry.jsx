import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Zap, CheckCircle2, Crown, Plus, RefreshCw, Phone, Loader2, UserPlus, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import PageHeader from "@/components/shared/PageHeader";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import axios from "axios";
import { useOutletScopeCtx } from "@/portals/outlet/OutletScopeContext";

const API = process.env.REACT_APP_BACKEND_URL || "";

// Warna tier = warna data loyalty (sama dengan CRM Hub); tanpa emoji di UI.
const TIER_CONFIG = {
  bronze: { label: "Bronze", color: "#C9813C", bg: "rgba(201,129,60,0.12)", multiplier: "×1.0" },
  silver: { label: "Silver", color: "#A0AEC0", bg: "rgba(160,174,192,0.12)", multiplier: "×1.2" },
  gold:   { label: "Gold",   color: "#C9A876", bg: "rgba(201,168,118,0.15)", multiplier: "×1.5" },
  platinum: { label: "Platinum", color: "#7F8EA3", bg: "rgba(127,142,163,0.15)", multiplier: "×2.0" },
};

function normalizePhone(raw) {
  let p = (raw || "").replace(/[\s\-\(\)]/g, "");
  if (p.startsWith("0")) p = "+62" + p.slice(1);
  else if (p.startsWith("62") && !p.startsWith("+")) p = "+" + p;
  return p;
}

function formatRupiah(v) {
  const n = Number(String(v).replace(/\D/g, ""));
  return isNaN(n) ? "0" : n.toLocaleString("id-ID");
}

function calcPoints(amount, multiplier = 1.0) {
  const base = Math.floor(amount / 10000);
  return Math.floor(base * multiplier); // SSOT-21: same as backend int()
}

// ─── Phase: search ──────────────────────────────────────────────
function SearchPhase({ onFound, onNotFound, loading, setLoading }) {
  const [phone, setPhone] = useState("");
  const inputRef = useRef(null);

  const handleSearch = useCallback(async (e) => {
    e?.preventDefault();
    const raw = phone.trim();
    if (!raw) { inputRef.current?.focus(); return; }
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/api/outlet/loyalty/cashier/lookup`, {
        params: { phone: raw },
        withCredentials: true,
      });
      if (data?.success && data?.data) {
        onFound(data.data, raw);
      } else {
        onNotFound(raw);
      }
    } catch {
      toast.error("Gagal melakukan pencarian. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }, [phone, onFound, onNotFound, setLoading]);

  return (
    // Enter di input sudah memicu submit form — tidak perlu onKeyDown tambahan
    // (sebelumnya Enter memanggil pencarian dua kali).
    <form onSubmit={handleSearch} className="space-y-1.5">
      <Label htmlFor="cashier-phone" className="text-xs md:text-sm font-medium">
        No. HP pelanggan *
      </Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="cashier-phone"
            ref={inputRef}
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="081234567890"
            className="glass-input pl-9"
            autoFocus
            data-testid="cashier-phone-input"
          />
        </div>
        <Button
          type="submit"
          disabled={loading || !phone.trim()}
          data-testid="cashier-search-button"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Cari
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Masukkan nomor HP pelanggan lalu tekan Cari atau Enter.
      </p>
    </form>
  );
}

// ─── Phase: confirm ──────────────────────────────────────────────
function ConfirmPhase({ customer, rawPhone, wasNew, onConfirm, onReset, loading }) {
  const [rawAmount, setRawAmount] = useState("");
  const [note, setNote] = useState("");
  const [orderRef, setOrderRef] = useState("");
  const tier = TIER_CONFIG[customer?.loyalty_tier] || TIER_CONFIG.bronze;
  const amount = Number(String(rawAmount).replace(/\D/g, ""));
  const points = calcPoints(amount, customer?.multiplier ?? 1.0);

  const handleAmountChange = (e) => {
    const digits = e.target.value.replace(/\D/g, "");
    setRawAmount(digits);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (amount < 10000) { toast.error("Nominal minimal Rp 10.000"); return; }
    // Backend requires the receipt number: one receipt can earn points only once (idempotent)
    if (!orderRef.trim()) { toast.error("Nomor struk wajib diisi"); return; }
    onConfirm({ phone: rawPhone, amount_idr: amount, note: note || undefined, order_ref: orderRef.trim() });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Customer card */}
      <div
        className="rounded-lg p-3 flex items-start gap-3"
        style={{ background: tier.bg, border: `1px solid ${tier.color}30` }}
        data-testid="cashier-customer-card"
      >
        <div
          className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: tier.bg, color: tier.color }}
          aria-hidden="true"
        >
          <Crown className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          {wasNew ? (
            <div className="flex items-center gap-1.5 mb-0.5 text-emerald-700 dark:text-emerald-400">
              <UserPlus className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">Akun baru akan dibuat</span>
            </div>
          ) : null}
          <p className="font-semibold text-sm md:text-base truncate">{customer.full_name}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: tier.bg, color: tier.color, border: `1px solid ${tier.color}30` }}>
              {tier.label} {tier.multiplier}
            </span>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Zap className="h-3 w-3" />
              <span className="tabular-nums font-medium">{(customer.total_points || 0).toLocaleString("id-ID")}</span> poin
            </div>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onReset}
          data-testid="cashier-change-customer"
        >
          Ganti
        </Button>
      </div>

      {/* Amount */}
      <div className="space-y-1.5">
        <Label htmlFor="cashier-amount" className="text-xs md:text-sm font-medium">Nominal transaksi *</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">Rp</span>
          <Input
            id="cashier-amount"
            type="text"
            inputMode="numeric"
            value={rawAmount ? formatRupiah(rawAmount) : ""}
            onChange={handleAmountChange}
            placeholder="0"
            className="glass-input pl-10 font-semibold tabular-nums"
            autoFocus
            data-testid="cashier-amount-input"
          />
        </div>
        <p className="text-xs text-muted-foreground">Minimal Rp 10.000.</p>
      </div>

      {/* Points preview */}
      <AnimatePresence mode="wait">
        {amount >= 10000 && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div
              className="rounded-lg p-3 flex items-center justify-between bg-primary/5 border border-primary/15"
              data-testid="cashier-points-preview"
            >
              <div>
                <p className="text-xs text-muted-foreground">Estimasi poin</p>
                <p className="text-xl font-semibold tabular-nums">
                  +{points.toLocaleString("id-ID")} <span className="text-sm font-normal text-muted-foreground">poin</span>
                </p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>Rp {formatRupiah(rawAmount)} ÷ 10.000</p>
                <p>× {customer?.multiplier?.toFixed(1) ?? "1.0"} ({tier.label})</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Receipt number (required — one receipt earns points once) */}
      <div className="space-y-1.5">
        <Label htmlFor="cashier-order-ref" className="text-xs md:text-sm font-medium">Nomor struk *</Label>
        <Input
          id="cashier-order-ref"
          type="text"
          value={orderRef}
          onChange={(e) => setOrderRef(e.target.value)}
          placeholder="mis. TRX-000123"
          className="glass-input"
          data-testid="cashier-order-ref-input"
        />
        <p className="text-xs text-muted-foreground">Satu struk hanya bisa mendapat poin satu kali.</p>
      </div>

      {/* Note (optional) */}
      <div className="space-y-1.5">
        <Label htmlFor="cashier-note" className="text-xs md:text-sm font-medium">Catatan (opsional)</Label>
        <Input
          id="cashier-note"
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="mis. Meja 5, dine-in..."
          className="glass-input"
          data-testid="cashier-note-input"
        />
      </div>

      {/* Submit */}
      <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onReset} disabled={loading} data-testid="cashier-cancel-button">
          Batal
        </Button>
        <Button
          type="submit"
          className="sm:flex-1"
          disabled={loading || amount < 10000 || !orderRef.trim()}
          data-testid="cashier-add-points-button"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Memproses…</>
          ) : (
            <><Plus className="h-4 w-4" /> Tambah Poin</>
          )}
        </Button>
      </div>
    </form>
  );
}

// ─── Phase: success ──────────────────────────────────────────────
function SuccessPhase({ result, onNext }) {
  const tier = TIER_CONFIG[result.customer?.loyalty_tier] || TIER_CONFIG.bronze;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="text-center py-2"
      data-testid="cashier-success"
    >
      <div className="h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-3 bg-emerald-500/10 border border-emerald-500/30">
        <CheckCircle2 className="h-6 w-6 text-emerald-700 dark:text-emerald-400" />
      </div>

      <p className="text-sm text-muted-foreground mb-1">Poin berhasil ditambahkan</p>
      <p className="text-3xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400 mb-0.5" data-testid="cashier-success-points">
        +{result.points_awarded?.toLocaleString("id-ID")}
      </p>
      <p className="text-sm text-muted-foreground mb-4">poin</p>

      {/* Customer recap */}
      <div
        className="rounded-lg p-3 mb-4 text-left"
        style={{ background: tier.bg, border: `1px solid ${tier.color}25` }}
      >
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold" data-testid="cashier-success-name">
            {result.customer?.full_name}
          </p>
          {result.was_created && (
            <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1 bg-emerald-500/10 text-emerald-800 dark:text-emerald-400">
              <UserPlus className="h-3 w-3" /> Akun baru
            </span>
          )}
        </div>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5">
            <Crown className="h-3.5 w-3.5" style={{ color: tier.color }} />
            <span className="font-medium" style={{ color: tier.color }}>{tier.label}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" style={{ color: tier.color }} />
            <span className="font-semibold tabular-nums" data-testid="cashier-success-total-points">
              {result.customer?.total_points?.toLocaleString("id-ID")}
            </span>
            <span className="text-muted-foreground text-xs">total poin</span>
          </div>
        </div>
        {result.was_created && (
          <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50">
            Akun dibuat otomatis. Password = nomor HP. Customer bisa ubah setelah login.
          </p>
        )}
      </div>

      <Button
        type="button"
        onClick={onNext}
        className="w-full"
        data-testid="cashier-next-customer-button"
      >
        <RefreshCw className="h-4 w-4" /> Pelanggan Berikutnya
      </Button>
    </motion.div>
  );
}

// ─── Main component ──────────────────────────────────────────────
export default function LoyaltyPointsEntry() {
  const outletScope = useOutletScopeCtx();
  const { token } = useAuth();
  const [phase, setPhase] = useState("search"); // search | confirm | success
  const [loading, setLoading] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [rawPhone, setRawPhone] = useState("");
  const [wasNew, setWasNew] = useState(false);
  const [result, setResult] = useState(null);

  const handleFound = (data, raw) => {
    setCustomer(data);
    setRawPhone(raw);
    setWasNew(false);
    setPhase("confirm");
  };

  const handleNotFound = (raw) => {
    // Placeholder customer for new account display
    setCustomer({
      full_name: "Pelanggan Baru",
      phone: raw,
      loyalty_tier: "bronze",
      total_points: 0,
      multiplier: 1.0,
    });
    setRawPhone(raw);
    setWasNew(true);
    setPhase("confirm");
  };

  const handleReset = () => {
    setPhase("search");
    setCustomer(null);
    setRawPhone("");
    setWasNew(false);
    setResult(null);
  };

  const handleConfirm = async ({ phone, amount_idr, note, order_ref }) => {
    setLoading(true);
    try {
      const { data } = await axios.post(
        `${API}/api/outlet/loyalty/cashier/add-points`,
        // receipt numbers are unique per outlet → send the outlet currently in view (if any)
        { phone, amount_idr, note, order_ref, outlet_id: outletScope?.outletId || undefined },
        { withCredentials: true }
      );
      if (data?.success) {
        setResult(data.data);
        setPhase("success");
        toast.success("Poin berhasil ditambahkan!");
      } else {
        toast.error(data?.errors?.[0]?.message || "Gagal menambah poin");
      }
    } catch (err) {
      toast.error(err?.response?.data?.errors?.[0]?.message || err?.response?.data?.detail || "Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="loyalty-points-entry-page">
      <PageHeader
        icon={Zap}
        title="Loyalty Points Entry"
        subtitle="Input poin kasir — nomor HP pelanggan + nominal transaksi untuk menambah poin loyalty."
        className="mb-0 md:mb-0"
      />

      <div className="max-w-2xl space-y-3">
        {/* Step indicator */}
        <ol className="flex items-center gap-2 flex-wrap" aria-label="Langkah input poin">
          {["Cari Pelanggan", "Input Transaksi", "Selesai"].map((s, i) => {
            const currentIdx = phase === "search" ? 0 : phase === "confirm" ? 1 : 2;
            const active = i === currentIdx;
            const done = i < currentIdx;
            return (
              <li key={s} className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
                <div
                  className={cn(
                    "flex items-center gap-1.5 h-8 px-2.5 rounded-full text-xs font-medium transition-colors",
                    active && "bg-primary text-primary-foreground",
                    done && "bg-primary/15 text-primary",
                    !active && !done && "bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="tabular-nums">{i + 1}</span>}
                  {s}
                </div>
                {i < 2 && <div className="h-px w-4 flex-shrink-0 bg-border" />}
              </li>
            );
          })}
        </ol>

        {/* Card */}
        <Card className="p-4">
          <AnimatePresence mode="wait">
            {phase === "search" && (
              <motion.div key="search" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.25 }}>
                <SearchPhase onFound={handleFound} onNotFound={handleNotFound} loading={loading} setLoading={setLoading} />
              </motion.div>
            )}
            {phase === "confirm" && (
              <motion.div key="confirm" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.25 }}>
                <ConfirmPhase
                  customer={customer}
                  rawPhone={rawPhone}
                  wasNew={wasNew}
                  onConfirm={handleConfirm}
                  onReset={handleReset}
                  loading={loading}
                />
              </motion.div>
            )}
            {phase === "success" && result && (
              <motion.div key="success" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                <SuccessPhase result={result} onNext={handleReset} />
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* Info box */}
        {phase === "search" && (
          <div className="p-3 rounded-lg text-sm bg-muted/60 border border-border/60">
            <div className="flex gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="text-muted-foreground space-y-1 text-xs">
                <p><b>Belum terdaftar?</b> Akun dibuat otomatis. Password awal = nomor HP.</p>
                <p><b>Poin:</b> Rp 10.000 = 1 poin × multiplier tier (Bronze ×1.0, Silver ×1.2, Gold ×1.5)</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
