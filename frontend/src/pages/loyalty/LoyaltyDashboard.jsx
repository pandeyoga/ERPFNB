import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CreditCard, Gift, History, User, Zap, TrendingUp, TrendingDown,
  ChevronRight, Copy, CheckCheck, Crown, AlertCircle
} from "lucide-react";
import { useLoyaltyAuth } from "@/contexts/LoyaltyAuthContext";
import { Progress } from "@/components/ui/progress";
import LoyaltyUserDropdown from "@/components/loyalty/LoyaltyUserDropdown";
import { toast } from "sonner";
import axios from "axios";

const API_URL = process.env.REACT_APP_BACKEND_URL || "";

const TIER_CONFIG = {
  bronze: {
    label: "Bronze", next: "Silver", threshold: 5000,
    gradient: "linear-gradient(135deg, #7A4A1A 0%, #C9813C 100%)",
    badge: "bg-amber-900/30 text-amber-400 border border-amber-700/30",
  },
  silver: {
    label: "Silver", next: "Gold", threshold: 15000,
    gradient: "linear-gradient(135deg, #5A6070 0%, #A0AEC0 100%)",
    badge: "bg-slate-700/30 text-slate-300 border border-slate-600/30",
  },
  gold: {
    label: "Gold", next: null, threshold: null,
    gradient: "linear-gradient(135deg, #8B6914 0%, #C9A876 100%)",
    badge: "bg-yellow-900/30 text-yellow-400 border border-yellow-700/30",
  },
};

const QUICK_ACTIONS = [
  { label: "Kartu Digital", sublabel: "QR scan di kasir", icon: CreditCard, to: "/loyalty/card", cardClass: "loyalty-card-gold", testid: "dashboard-card-link" },
  { label: "Tukar Rewards", sublabel: "Voucher & pengalaman", icon: Gift, to: "/loyalty/rewards", cardClass: "loyalty-card-wine", testid: "dashboard-rewards-link" },
  { label: "Riwayat Poin", sublabel: "Semua transaksi", icon: History, to: "/loyalty/history", cardClass: "loyalty-card-forest", testid: "dashboard-history-link" },
  { label: "Profile Saya", sublabel: "Pengaturan akun", icon: User, to: "/loyalty/profile", cardClass: "loyalty-card-espresso", testid: "dashboard-profile-link" },
];

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
};

export default function LoyaltyDashboard() {
  const { customer, token } = useLoyaltyAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = "#0D0B07";
    return () => { document.body.style.background = prev; };
  }, []);

  const loadTx = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_URL}/api/loyalty/transactions?limit=5`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTransactions(res.data || []);
    } catch {}
    finally { setTxLoading(false); }
  }, [token]);

  useEffect(() => { loadTx(); }, [loadTx]);

  const copyReferral = () => {
    const code = customer?.referral_code || "FNB GROUP2026";
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Kode referral disalin!");
    setTimeout(() => setCopied(false), 2500);
  };

  if (!customer) return (
    <div className="loyalty-theme min-h-screen flex items-center justify-center" style={{ background: "#0D0B07" }}>
      <div className="text-center">
        <div className="h-2 w-2 rounded-full mx-auto mb-2 animate-pulse" style={{ background: "#C9A876" }} />
        <p className="text-sm" style={{ color: "rgba(240,234,224,0.4)" }}>Memuat...</p>
      </div>
    </div>
  );

  const tier = customer.loyalty_tier || "bronze";
  const tierConf = TIER_CONFIG[tier] || TIER_CONFIG.bronze;
  const points = customer.total_points || 0;
  const progressPct = tierConf.threshold ? Math.min(100, Math.round((points / tierConf.threshold) * 100)) : 100;

  const isToday = (d) => { const now = new Date(); const dd = new Date(d); return dd.toDateString() === now.toDateString(); };
  const birthday = customer.date_of_birth
    ? new Date(customer.date_of_birth).toDateString().slice(4, 9) === new Date().toDateString().slice(4, 9)
    : false;

  return (
    <div className="loyalty-theme min-h-screen" style={{ background: "#0D0B07", color: "#F0EAE0" }}>

      {/* Header */}
      <header
        className="sticky top-0 z-50"
        style={{ background: "rgba(13,11,7,0.9)", borderBottom: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(14px)" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/">
            <div className="flex items-center gap-2">
              <span className="font-['Cormorant_Garamond'] text-lg tracking-[0.18em] uppercase font-semibold" style={{ color: "#F0EAE0" }}>FNB GROUP</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(201,168,118,0.15)", color: "#C9A876", border: "1px solid rgba(201,168,118,0.2)" }}>Rewards</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <div
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{ background: "rgba(201,168,118,0.1)", border: "1px solid rgba(201,168,118,0.18)" }}
            >
              <Zap className="h-3.5 w-3.5" style={{ color: "#C9A876" }} />
              <span className="text-sm font-bold tabular-nums" style={{ color: "#C9A876" }} data-testid="loyalty-header-points">
                {points.toLocaleString("id-ID")}
              </span>
            </div>
            <LoyaltyUserDropdown />
          </div>
        </div>
      </header>

      {/* Birthday Banner */}
      {birthday && (
        <div className="border-b" style={{ background: "rgba(201,168,118,0.1)", borderColor: "rgba(201,168,118,0.2)" }} data-testid="birthday-banner">
          <div className="max-w-7xl mx-auto px-4 py-2.5 text-center text-sm" style={{ color: "#C9A876" }}>
            Selamat ulang tahun, {customer.full_name?.split(" ")[0]}! Bonus poin birthday telah dikirimkan.
          </div>
        </div>
      )}

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Greeting */}
        <div className="mb-8">
          <p className="text-sm mb-1" style={{ color: "rgba(240,234,224,0.45)" }}>Halo,</p>
          <h1 className="font-['Cormorant_Garamond'] text-3xl sm:text-4xl font-semibold" style={{ color: "#F0EAE0" }}>
            {customer.full_name?.split(" ")[0] || "Member"}
          </h1>
        </div>

        {/* BENTO GRID */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid grid-cols-12 gap-4 lg:gap-5"
        >
          {/* ─ POINTS HERO (col 1-7) */}
          <motion.div variants={fadeUp} className="col-span-12 lg:col-span-7">
            <div
              className="relative overflow-hidden rounded-2xl p-6 sm:p-8 h-full min-h-[200px]"
              style={{ background: "linear-gradient(135deg, #1A1408 0%, #2A1E0A 50%, #1A1408 100%)", border: "1px solid rgba(201,168,118,0.15)" }}
            >
              {/* Decorative glow */}
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(201,168,118,0.15), transparent 70%)", transform: "translate(30%, -30%)" }} />

              <div className="relative z-10">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "rgba(201,168,118,0.6)" }}>Total Poin</p>
                    <div className="font-['Cormorant_Garamond'] text-5xl sm:text-6xl font-semibold tabular-nums" style={{ color: "#F0EAE0" }} data-testid="loyalty-dashboard-points-value">
                      {points.toLocaleString("id-ID")}
                    </div>
                    <p className="text-xs mt-1" style={{ color: "rgba(240,234,224,0.35)" }}>poin tersedia</p>
                  </div>

                  {/* Tier badge */}
                  <div className="text-right">
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide"
                      style={{ background: "rgba(201,168,118,0.15)", color: "#C9A876", border: "1px solid rgba(201,168,118,0.25)" }}
                      data-testid="loyalty-dashboard-tier-label"
                    >
                      <Crown className="h-3 w-3" />
                      {tierConf.label}
                    </span>
                  </div>
                </div>

                {/* Tier progress */}
                {tierConf.next && (
                  <div>
                    <div className="flex justify-between text-xs mb-2" style={{ color: "rgba(240,234,224,0.4)" }}>
                      <span>Progress ke {tierConf.next}</span>
                      <span className="tabular-nums">{points.toLocaleString("id-ID")} / {tierConf.threshold?.toLocaleString("id-ID")} pts</span>
                    </div>
                    <div className="relative h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }} data-testid="loyalty-dashboard-tier-progress">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${progressPct}%`, background: "linear-gradient(90deg, #8B6914, #C9A876)", transition: "width 1s ease" }}
                      />
                    </div>
                    <p className="text-xs mt-1.5" style={{ color: "rgba(240,234,224,0.35)" }}>
                      Butuh {Math.max(0, (tierConf.threshold || 0) - points).toLocaleString("id-ID")} poin lagi untuk {tierConf.next}
                    </p>
                  </div>
                )}
                {!tierConf.next && (
                  <div className="flex items-center gap-2 mt-2">
                    <Crown className="h-4 w-4" style={{ color: "#C9A876" }} />
                    <span className="text-sm" style={{ color: "rgba(240,234,224,0.6)" }}>Anda adalah member tertinggi kami!</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* ─ QUICK ACTIONS BENTO (col 8-12) */}
          <motion.div variants={fadeUp} className="col-span-12 lg:col-span-5">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 h-full">
              {QUICK_ACTIONS.map((action) => (
                <Link
                  key={action.to}
                  to={action.to}
                  data-testid={action.testid}
                  className={`relative overflow-hidden rounded-2xl p-4 sm:p-5 flex flex-col justify-between group cursor-pointer hover:scale-[1.02] transition-transform duration-200 ${action.cardClass}`}
                  style={{ border: "1px solid rgba(255,255,255,0.08)", minHeight: "120px" }}
                >
                  {/* Shimmer overlay */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none" style={{ background: "radial-gradient(circle at top left, rgba(255,255,255,0.06), transparent 60%)", transition: "opacity 300ms" }} />
                  <div className="relative z-10">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center mb-3" style={{ background: "rgba(255,255,255,0.1)" }}>
                      <action.icon className="h-4 w-4" style={{ color: "#F0EAE0" }} />
                    </div>
                    <p className="text-sm font-semibold" style={{ color: "#F0EAE0" }}>{action.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(240,234,224,0.5)" }}>{action.sublabel}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 self-end opacity-40" style={{ color: "#F0EAE0" }} />
                </Link>
              ))}
            </div>
          </motion.div>

          {/* ─ RECENT TRANSACTIONS (col 1-8) */}
          <motion.div variants={fadeUp} className="col-span-12 lg:col-span-8">
            <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <h3 className="font-semibold text-sm" style={{ color: "#F0EAE0" }}>Transaksi Terbaru</h3>
                <Link to="/loyalty/history" className="text-xs hover:underline" style={{ color: "#C9A876" }}>Lihat semua</Link>
              </div>
              <div data-testid="loyalty-dashboard-recent-transactions">
                {txLoading ? (
                  <div className="p-6 space-y-4">
                    {[1,2,3].map(i => (
                      <div key={i} className="flex justify-between animate-pulse">
                        <div className="flex gap-3">
                          <div className="h-9 w-9 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />
                          <div className="space-y-2">
                            <div className="h-3 w-36 rounded" style={{ background: "rgba(255,255,255,0.06)" }} />
                            <div className="h-2 w-20 rounded" style={{ background: "rgba(255,255,255,0.04)" }} />
                          </div>
                        </div>
                        <div className="h-4 w-14 rounded" style={{ background: "rgba(255,255,255,0.06)" }} />
                      </div>
                    ))}
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="py-12 text-center">
                    <Zap className="h-8 w-8 mx-auto mb-3" style={{ color: "rgba(201,168,118,0.3)" }} />
                    <p className="text-sm" style={{ color: "rgba(240,234,224,0.4)" }}>Belum ada transaksi. Kunjungi outlet kami!</p>
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                    {transactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: tx.points > 0 ? "rgba(127,174,122,0.15)" : "rgba(224,107,90,0.15)" }}
                          >
                            {tx.points > 0
                              ? <TrendingUp className="h-4 w-4" style={{ color: "#7FAE7A" }} />
                              : <TrendingDown className="h-4 w-4" style={{ color: "#E06B5A" }} />}
                          </div>
                          <div>
                            <p className="text-sm font-medium" style={{ color: "#F0EAE0" }}>{tx.description}</p>
                            <p className="text-xs" style={{ color: "rgba(240,234,224,0.35)" }}>
                              {new Date(tx.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                            </p>
                          </div>
                        </div>
                        <span className="font-bold text-sm tabular-nums" style={{ color: tx.points > 0 ? "#7FAE7A" : "#E06B5A" }}>
                          {tx.points > 0 ? "+" : ""}{tx.points.toLocaleString("id-ID")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* ─ REFERRAL (col 9-12) */}
          <motion.div variants={fadeUp} className="col-span-12 lg:col-span-4">
            <div
              className="rounded-2xl p-6 h-full flex flex-col justify-between"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div>
                <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "rgba(201,168,118,0.6)" }}>Referral</p>
                <h3 className="font-['Cormorant_Garamond'] text-2xl font-semibold mb-2" style={{ color: "#F0EAE0" }}>Ajak Teman</h3>
                <p className="text-xs mb-4" style={{ color: "rgba(240,234,224,0.4)" }}>
                  Dapatkan bonus poin untuk setiap teman yang bergabung dengan kode Anda.
                </p>
              </div>

              <div>
                <p className="text-xs mb-2" style={{ color: "rgba(240,234,224,0.4)" }}>Kode Referral Anda</p>
                <div
                  className="flex items-center justify-between rounded-xl px-4 py-3 mb-3"
                  style={{ background: "rgba(201,168,118,0.08)", border: "1px solid rgba(201,168,118,0.18)" }}
                >
                  <span
                    className="font-mono font-bold tracking-widest text-sm"
                    style={{ color: "#C9A876" }}
                    data-testid="referral-code"
                  >
                    {customer.referral_code || "FNB GROUP2026"}
                  </span>
                  <button
                    onClick={copyReferral}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
                    style={{ color: copied ? "#7FAE7A" : "#C9A876", background: "rgba(255,255,255,0.05)" }}
                    data-testid="referral-copy-btn"
                  >
                    {copied ? <CheckCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Disalin" : "Salin"}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
