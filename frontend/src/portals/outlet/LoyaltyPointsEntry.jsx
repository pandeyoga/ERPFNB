import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Zap, CheckCircle2, Crown, Plus, RefreshCw, Phone, Loader2, UserPlus, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL || "";

const TIER_CONFIG = {
  bronze: { label: "Bronze", color: "#C9813C", bg: "rgba(201,129,60,0.12)", icon: "🥉", multiplier: "×1.0" },
  silver: { label: "Silver", color: "#A0AEC0", bg: "rgba(160,174,192,0.12)", icon: "🥈", multiplier: "×1.2" },
  gold:   { label: "Gold",   color: "#C9A876", bg: "rgba(201,168,118,0.15)", icon: "🥇", multiplier: "×1.5" },
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
  return Math.round(base * multiplier);
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
        headers: { Authorization: `Bearer ${localStorage.getItem("aurora_access_token")}` },
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
    <form onSubmit={handleSearch} className="space-y-6">
      <div>
        <p className="text-sm font-medium mb-2 text-[hsl(var(--foreground)/.7)]">
          No. HP Customer
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              ref={inputRef}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="081234567890"
              className="glass-input w-full h-12 pl-10 pr-4 text-base rounded-xl"
              autoFocus
              data-testid="cashier-phone-input"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !phone.trim()}
            className="h-12 px-5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all"
            style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
            data-testid="cashier-search-button"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Cari
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Masukkan nomor HP pelanggan lalu tekan Cari atau Enter.
        </p>
      </div>
    </form>
  );
}

// ─── Phase: confirm ──────────────────────────────────────────────
function ConfirmPhase({ customer, rawPhone, wasNew, onConfirm, onReset, loading }) {
  const [rawAmount, setRawAmount] = useState("");
  const [note, setNote] = useState("");
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
    onConfirm({ phone: rawPhone, amount_idr: amount, note: note || undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Customer card */}
      <div
        className="rounded-xl p-4 flex items-start gap-4"
        style={{ background: tier.bg, border: `1px solid ${tier.color}30` }}
        data-testid="cashier-customer-card"
      >
        <div
          className="h-10 w-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
          style={{ background: tier.bg }}
        >
          {tier.icon}
        </div>
        <div className="flex-1 min-w-0">
          {wasNew ? (
            <div className="flex items-center gap-1.5 mb-0.5">
              <UserPlus className="h-3.5 w-3.5" style={{ color: "#7FAE7A" }} />
              <span className="text-xs font-semibold" style={{ color: "#7FAE7A" }}>Akun baru akan dibuat</span>
            </div>
          ) : null}
          <p className="font-semibold text-base truncate">{customer.full_name}</p>
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
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-muted-foreground hover:text-foreground mt-1"
          data-testid="cashier-change-customer"
        >
          Ganti
        </button>
      </div>

      {/* Amount */}
      <div>
        <p className="text-sm font-medium mb-2 text-[hsl(var(--foreground)/.7)]">Nominal Transaksi</p>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">Rp</span>
          <input
            type="text"
            inputMode="numeric"
            value={rawAmount ? formatRupiah(rawAmount) : ""}
            onChange={handleAmountChange}
            placeholder="0"
            className="glass-input w-full h-12 pl-10 pr-4 text-base font-semibold rounded-xl tabular-nums"
            autoFocus
            data-testid="cashier-amount-input"
          />
        </div>
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
              className="rounded-xl p-4 flex items-center justify-between"
              style={{ background: "rgba(var(--primary-rgb, 201 168 118) / 0.08)", border: "1px solid hsl(var(--primary)/.15)" }}
              data-testid="cashier-points-preview"
            >
              <div>
                <p className="text-xs text-muted-foreground">Estimasi poin</p>
                <p className="font-['Cormorant_Garamond',serif] text-2xl font-semibold">
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

      {/* Note (optional) */}
      <div>
        <p className="text-sm font-medium mb-2 text-[hsl(var(--foreground)/.5)]">Catatan (opsional)</p>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="mis. Meja 5, dine-in..."
          className="glass-input w-full h-10 px-4 text-sm rounded-xl"
          data-testid="cashier-note-input"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || amount < 10000}
        className="w-full h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
        style={{
          background: amount >= 10000 ? "hsl(var(--primary))" : "hsl(var(--muted))",
          color: amount >= 10000 ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
        }}
        data-testid="cashier-add-points-button"
      >
        {loading ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Memproses...</>
        ) : (
          <><Plus className="h-4 w-4" /> Tambah Poin</>
        )}
      </button>
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
      className="text-center py-4"
      data-testid="cashier-success"
    >
      <div
        className="h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4"
        style={{ background: "rgba(127,174,122,0.15)", border: "1px solid rgba(127,174,122,0.3)" }}
      >
        <CheckCircle2 className="h-8 w-8" style={{ color: "#7FAE7A" }} />
      </div>

      <p className="text-sm text-muted-foreground mb-1">Poin berhasil ditambahkan!</p>
      <p className="font-['Cormorant_Garamond',serif] text-5xl font-semibold mb-1" style={{ color: "#7FAE7A" }} data-testid="cashier-success-points">
        +{result.points_awarded?.toLocaleString("id-ID")}
      </p>
      <p className="text-sm text-muted-foreground mb-6">poin</p>

      {/* Customer recap */}
      <div
        className="rounded-2xl p-4 mb-6 text-left"
        style={{ background: tier.bg, border: `1px solid ${tier.color}25` }}
      >
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold" data-testid="cashier-success-name">
            {result.customer?.full_name}
          </p>
          {result.was_created && (
            <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: "rgba(127,174,122,0.15)", color: "#7FAE7A" }}>
              <UserPlus className="h-3 w-3" /> Akun baru
            </span>
          )}
        </div>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5">
            <span>{tier.icon}</span>
            <span className="font-medium" style={{ color: tier.color }}>{tier.label}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" style={{ color: tier.color }} />
            <span className="font-bold tabular-nums" data-testid="cashier-success-total-points">
              {result.customer?.total_points?.toLocaleString("id-ID")}
            </span>
            <span className="text-muted-foreground text-xs">total poin</span>
          </div>
        </div>
        {result.was_created && (
          <p className="text-xs text-muted-foreground mt-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            Akun dibuat otomatis. Password = nomor HP. Customer bisa ubah setelah login.
          </p>
        )}
      </div>

      <button
        onClick={onNext}
        className="w-full h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
        style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
        data-testid="cashier-next-customer-button"
      >
        <RefreshCw className="h-4 w-4" /> Pelanggan Berikutnya
      </button>
    </motion.div>
  );
}

// ─── Main component ──────────────────────────────────────────────
export default function LoyaltyPointsEntry() {
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

  const handleConfirm = async ({ phone, amount_idr, note }) => {
    setLoading(true);
    try {
      const { data } = await axios.post(
        `${API}/api/outlet/loyalty/cashier/add-points`,
        { phone, amount_idr, note },
        { headers: { Authorization: `Bearer ${localStorage.getItem("aurora_access_token")}` } }
      );
      if (data?.success) {
        setResult(data.data);
        setPhase("success");
        toast.success("Poin berhasil ditambahkan!");
      } else {
        toast.error(data?.errors?.[0]?.message || "Gagal menambah poin");
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-['Cormorant_Garamond',serif] font-semibold">Input Poin Kasir</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Input nomor HP pelanggan dan nominal transaksi untuk menambah poin loyalty.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-7">
        {["Cari Pelanggan", "Input Transaksi", "Selesai"].map((s, i) => {
          const currentIdx = phase === "search" ? 0 : phase === "confirm" ? 1 : 2;
          const active = i === currentIdx;
          const done = i < currentIdx;
          return (
            <div key={s} className="flex items-center gap-2">
              <div
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all"
                style={{
                  background: active ? "hsl(var(--primary))" : done ? "hsl(var(--primary)/.15)" : "hsl(var(--muted))",
                  color: active ? "hsl(var(--primary-foreground))" : done ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                }}
              >
                {done ? <CheckCircle2 className="h-3 w-3" /> : <span>{i + 1}</span>}
                {s}
              </div>
              {i < 2 && <div className="h-px w-4 flex-shrink-0" style={{ background: "hsl(var(--border))" }} />}
            </div>
          );
        })}
      </div>

      {/* Card */}
      <div className="glass-card rounded-2xl p-6">
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
      </div>

      {/* Info box */}
      {phase === "search" && (
        <div className="mt-4 p-4 rounded-xl text-sm" style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}>
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
  );
}
