import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Zap, Search, Award, ShoppingBag, CheckCircle2, Crown } from "lucide-react";
import { useLoyaltyAuth } from "@/contexts/LoyaltyAuthContext";
import LoyaltyUserDropdown from "@/components/loyalty/LoyaltyUserDropdown";
import { toast } from "sonner";
import axios from "axios";

const API_URL = process.env.REACT_APP_BACKEND_URL || "";

const CATEGORIES = [
  { key: "all", label: "Semua" },
  { key: "voucher", label: "Voucher" },
  { key: "experience", label: "Pengalaman" },
  { key: "merchandise", label: "Merchandise" },
];

const CAT_PILL = {
  voucher: { bg: "rgba(201,168,118,0.15)", color: "#C9A876" },
  experience: { bg: "rgba(127,174,122,0.15)", color: "#7FAE7A" },
  merchandise: { bg: "rgba(100,150,200,0.15)", color: "#7BA8C8" },
};

function RewardCard({ reward, customerPoints, onRedeem, redeeming }) {
  const canRedeem = customerPoints >= reward.points_required;
  const isOOS = reward.stock !== null && reward.stock !== undefined && reward.stock <= 0;
  const cat = CAT_PILL[reward.category] || { bg: "rgba(255,255,255,0.1)", color: "rgba(240,234,224,0.6)" };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl overflow-hidden flex flex-col group"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      {/* Image */}
      <div className="relative aspect-video overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
        {reward.image_url ? (
          <img
            src={`${reward.image_url}&w=600`}
            alt={reward.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={(e) => { e.target.style.display = "none"; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Award className="h-8 w-8" style={{ color: "rgba(201,168,118,0.25)" }} />
          </div>
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(13,11,7,0.7), transparent 60%)" }} />

        {/* Category badge */}
        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: cat.bg, color: cat.color, border: `1px solid ${cat.color}25` }}>
          {reward.category}
        </span>

        {reward.stock !== null && reward.stock !== undefined && reward.stock <= 5 && reward.stock > 0 && (
          <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(224,107,90,0.85)", color: "#fff" }}>
            Sisa {reward.stock}
          </span>
        )}
        {isOOS && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
            <span className="font-semibold text-sm" style={{ color: "rgba(240,234,224,0.7)" }}>Habis</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-sm mb-1 line-clamp-2" style={{ color: "#F0EAE0" }}>{reward.name}</h3>
        <p className="text-xs mb-4 flex-1 line-clamp-2" style={{ color: "rgba(240,234,224,0.45)" }}>{reward.description}</p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Zap className="h-3.5 w-3.5" style={{ color: "#C9A876" }} />
            <span className="font-bold text-sm tabular-nums" style={{ color: "#C9A876" }}>{reward.points_required.toLocaleString("id-ID")}</span>
            <span className="text-xs" style={{ color: "rgba(240,234,224,0.35)" }}>poin</span>
          </div>

          <button
            disabled={!canRedeem || isOOS || redeeming === reward.id}
            onClick={() => canRedeem && !isOOS && onRedeem(reward)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: canRedeem && !isOOS ? "linear-gradient(135deg, #C9A876, #E0C28A)" : "rgba(255,255,255,0.06)",
              color: canRedeem && !isOOS ? "#1C1510" : "rgba(240,234,224,0.3)",
              cursor: canRedeem && !isOOS ? "pointer" : "not-allowed",
            }}
            data-testid={`redeem-btn-${reward.id}`}
          >
            {redeeming === reward.id ? "Proses..."
              : canRedeem && !isOOS ? <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Tukar</span>
              : isOOS ? "Habis"
              : `Kurang ${(reward.points_required - customerPoints).toLocaleString("id-ID")} pts`}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function RedeemModal({ reward, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: "#1A1408", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 30px 80px rgba(0,0,0,0.7)" }}
      >
        {reward.image_url && (
          <img src={`${reward.image_url}&w=400`} alt={reward.name} className="w-full h-36 object-cover" loading="lazy" decoding="async" />
        )}
        <div className="p-6">
          <h3 className="font-['Cormorant_Garamond'] text-2xl font-semibold mb-1" style={{ color: "#F0EAE0" }}>{reward.name}</h3>
          <p className="text-sm mb-4" style={{ color: "rgba(240,234,224,0.5)" }}>{reward.description}</p>
          <div className="flex items-center gap-2 rounded-xl p-3 mb-5" style={{ background: "rgba(201,168,118,0.1)", border: "1px solid rgba(201,168,118,0.15)" }}>
            <Zap className="h-4 w-4" style={{ color: "#C9A876" }} />
            <span className="font-bold" style={{ color: "#C9A876" }}>{reward.points_required.toLocaleString("id-ID")} poin</span>
            <span className="text-sm" style={{ color: "rgba(240,234,224,0.4)" }}>akan dikurangi</span>
          </div>
          <div className="flex gap-3">
            <button onClick={onCancel} disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(240,234,224,0.6)" }}>Batal</button>
            <button onClick={onConfirm} disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-semibold loyalty-btn-gold" data-testid="redeem-confirm-btn">
              {loading ? "Menukar..." : "Ya, Tukar!"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function RedeemSuccessModal({ redemption, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm rounded-2xl p-8 text-center"
        style={{ background: "#1A1408", border: "1px solid rgba(201,168,118,0.2)", boxShadow: "0 30px 80px rgba(0,0,0,0.7)" }}
      >
        <div className="h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(127,174,122,0.15)", border: "1px solid rgba(127,174,122,0.3)" }}>
          <CheckCircle2 className="h-8 w-8" style={{ color: "#7FAE7A" }} />
        </div>
        <h3 className="font-['Cormorant_Garamond'] text-2xl font-semibold mb-1" style={{ color: "#F0EAE0" }}>Berhasil Ditukar!</h3>
        <p className="text-sm mb-4" style={{ color: "rgba(240,234,224,0.5)" }}>{redemption.reward_name} telah berhasil ditukar.</p>
        {redemption.voucher_code && (
          <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(201,168,118,0.08)", border: "1px solid rgba(201,168,118,0.18)" }}>
            <p className="text-xs mb-1" style={{ color: "rgba(201,168,118,0.6)" }}>Kode Voucher Anda</p>
            <p className="font-mono font-bold text-2xl tracking-widest" style={{ color: "#C9A876" }}>{redemption.voucher_code}</p>
          </div>
        )}
        <p className="text-xs mb-5" style={{ color: "rgba(240,234,224,0.35)" }}>Tunjukkan kode ini kepada kasir saat berkunjung.</p>
        <button onClick={onClose} className="w-full py-3 rounded-xl font-semibold loyalty-btn-gold text-sm">Selesai</button>
      </motion.div>
    </div>
  );
}

export default function LoyaltyRewards() {
  const { customer, token, refreshCustomer } = useLoyaltyAuth();
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [redeeming, setRedeeming] = useState(null);
  const [confirmReward, setConfirmReward] = useState(null);
  const [successResult, setSuccessResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = "#0D0B07";
    return () => { document.body.style.background = prev; };
  }, []);

  const loadRewards = useCallback(async () => {
    try {
      const params = {};
      if (category !== "all") params.category = category;
      const res = await axios.get(`${API_URL}/api/loyalty/rewards`, { headers: { Authorization: `Bearer ${token}` }, params });
      setRewards(res.data || []);
    } catch {}
    finally { setLoading(false); }
  }, [token, category]);

  useEffect(() => { loadRewards(); }, [loadRewards]);

  const handleRedeem = async (reward) => {
    setConfirmReward(null);
    setRedeeming(reward.id);
    setErrorMsg("");
    try {
      const res = await axios.post(`${API_URL}/api/loyalty/rewards/redeem`, { reward_id: reward.id }, { headers: { Authorization: `Bearer ${token}` } });
      setSuccessResult(res.data);
      await refreshCustomer();
    } catch (err) {
      setErrorMsg(err?.response?.data?.detail || "Penukaran gagal. Coba lagi.");
      toast.error(err?.response?.data?.detail || "Penukaran gagal");
    } finally { setRedeeming(null); }
  };

  const filtered = rewards.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()));
  const customerPoints = customer?.total_points || 0;
  const canRedeemCount = filtered.filter(r => r.points_required <= customerPoints).length;

  return (
    <div className="loyalty-theme min-h-screen" style={{ background: "#0D0B07", color: "#F0EAE0" }}>
      {confirmReward && <RedeemModal reward={confirmReward} onConfirm={() => handleRedeem(confirmReward)} onCancel={() => setConfirmReward(null)} loading={!!redeeming} />}
      {successResult && <RedeemSuccessModal redemption={successResult} onClose={() => { setSuccessResult(null); loadRewards(); }} />}

      {/* Header */}
      <header className="sticky top-0 z-50" style={{ background: "rgba(13,11,7,0.9)", borderBottom: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(14px)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/loyalty" className="flex items-center gap-2 text-sm hover:opacity-70 transition-opacity" style={{ color: "#C9A876" }}>
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </Link>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>|</span>
            <span className="text-sm font-medium" style={{ color: "rgba(240,234,224,0.7)" }}>Rewards</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: "rgba(201,168,118,0.1)", border: "1px solid rgba(201,168,118,0.18)" }}>
              <Zap className="h-3.5 w-3.5" style={{ color: "#C9A876" }} />
              <span className="text-sm font-bold tabular-nums" style={{ color: "#C9A876" }}>{customerPoints.toLocaleString("id-ID")}</span>
            </div>
            <LoyaltyUserDropdown />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero */}
        <div className="mb-8">
          <h1 className="font-['Cormorant_Garamond'] text-3xl sm:text-4xl font-semibold mb-1" style={{ color: "#F0EAE0" }}>Rewards</h1>
          <p className="text-sm" style={{ color: "rgba(240,234,224,0.45)" }}>
            Tukar poin Anda dengan reward eksklusif FnB Group
            {canRedeemCount > 0 && (
              <span className="ml-2 font-medium" style={{ color: "#7FAE7A" }}>— {canRedeemCount} bisa ditukar sekarang!</span>
            )}
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "rgba(240,234,224,0.3)" }} />
          <input
            placeholder="Cari reward..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="loyalty-input w-full h-11 pl-10 pr-4 text-sm"
            data-testid="rewards-search"
          />
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }} data-testid="loyalty-rewards-filter-tabs">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setCategory(cat.key)}
              data-testid={`rewards-cat-${cat.key}`}
              className="px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all"
              style={{
                background: category === cat.key ? "rgba(201,168,118,0.2)" : "rgba(255,255,255,0.05)",
                border: category === cat.key ? "1px solid rgba(201,168,118,0.35)" : "1px solid rgba(255,255,255,0.08)",
                color: category === cat.key ? "#C9A876" : "rgba(240,234,224,0.5)",
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl text-sm" style={{ background: "rgba(224,107,90,0.12)", border: "1px solid rgba(224,107,90,0.25)", color: "#E88A7A" }}>
            {errorMsg}
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)", height: "260px" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag className="h-12 w-12 mx-auto mb-3" style={{ color: "rgba(201,168,118,0.2)" }} />
            <h3 className="font-semibold text-lg mb-1" style={{ color: "rgba(240,234,224,0.6)" }}>
              {search ? "Reward tidak ditemukan" : "Belum ada rewards"}
            </h3>
            <p className="text-sm" style={{ color: "rgba(240,234,224,0.35)" }}>Segera hadir!</p>
          </div>
        ) : (
          <motion.div layout className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {filtered.map((reward) => (
                <RewardCard key={reward.id} reward={reward} customerPoints={customerPoints} onRedeem={setConfirmReward} redeeming={redeeming} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </main>
    </div>
  );
}
