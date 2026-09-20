import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Crown, Zap } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useLoyaltyAuth } from "@/contexts/LoyaltyAuthContext";
import LoyaltyUserDropdown from "@/components/loyalty/LoyaltyUserDropdown";
import axios from "axios";

const API_URL = process.env.REACT_APP_BACKEND_URL || "";

const TIER_GRADIENT = {
  bronze: "linear-gradient(135deg, #5C3310 0%, #C9813C 100%)",
  silver: "linear-gradient(135deg, #404855 0%, #A0AEC0 100%)",
  gold:   "linear-gradient(135deg, #6B4A0A 0%, #C9A876 100%)",
};

export default function LoyaltyCard() {
  const navigate = useNavigate();
  const { customer, token } = useLoyaltyAuth();
  const [cardData, setCardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = "#0D0B07";
    return () => { document.body.style.background = prev; };
  }, []);

  useEffect(() => {
    axios.get(`${API_URL}/api/loyalty/card`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setCardData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div className="loyalty-theme min-h-screen flex items-center justify-center" style={{ background: "#0D0B07" }}>
      <div className="text-center">
        <div className="h-2 w-2 rounded-full mx-auto animate-pulse" style={{ background: "#C9A876" }} />
        <p className="text-xs mt-2" style={{ color: "rgba(240,234,224,0.4)" }}>Memuat kartu...</p>
      </div>
    </div>
  );

  const tier = cardData?.loyalty_tier || "bronze";
  const cardGradient = TIER_GRADIENT[tier] || TIER_GRADIENT.bronze;

  return (
    <div className="loyalty-theme min-h-screen" style={{ background: "#0D0B07", color: "#F0EAE0" }}>
      {/* Header */}
      <header className="sticky top-0 z-50" style={{ background: "rgba(13,11,7,0.9)", borderBottom: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(14px)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button onClick={() => navigate("/loyalty")} className="flex items-center gap-2 text-sm hover:opacity-70 transition-opacity" style={{ color: "#C9A876" }} data-testid="loyalty-card-close">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </button>
          <LoyaltyUserDropdown />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* LEFT: Digital Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <div
              className="relative overflow-hidden rounded-3xl p-8 shadow-2xl"
              style={{ background: cardGradient, minHeight: "360px", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}
            >
              {/* Pattern overlay */}
              <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
              <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at top right, rgba(255,255,255,0.12), transparent 60%)" }} />

              <div className="relative z-10 flex flex-col h-full min-h-[300px]">
                {/* Card header */}
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <p className="text-white/60 text-xs tracking-[0.2em] uppercase mb-0.5">FNB GROUP</p>
                    <p className="text-white font-['Cormorant_Garamond'] text-xl font-semibold">Rewards Program</p>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }}>
                    <Crown className="h-3 w-3 text-white" />
                    <span className="text-white text-xs font-semibold uppercase tracking-wide">{tier}</span>
                  </div>
                </div>

                {/* QR */}
                <div className="flex-1 flex items-center justify-center">
                  <div className="p-4 rounded-2xl shadow-lg" style={{ background: "rgba(255,255,255,0.95)" }} data-testid="loyalty-card-qr">
                    {cardData?.qr_data ? (
                      <QRCodeSVG value={cardData.qr_data} size={160} level="H" includeMargin={false} />
                    ) : (
                      <div className="h-40 w-40 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.05)" }}>
                        <p className="text-xs text-gray-400">QR tidak tersedia</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card footer */}
                <div className="mt-6 flex items-end justify-between">
                  <div>
                    <p className="text-white/50 text-[10px] uppercase tracking-wider mb-0.5">Card Number</p>
                    <p className="text-white font-mono text-sm font-semibold tracking-widest" data-testid="loyalty-card-member-id">
                      {cardData?.card_number || "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-white/50 text-[10px] uppercase tracking-wider mb-0.5">Member</p>
                    <p className="text-white text-sm font-medium">{cardData?.customer_name || customer?.full_name}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Points */}
            <div className="mt-4 rounded-2xl px-6 py-4 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" style={{ color: "#C9A876" }} />
                <span className="text-sm" style={{ color: "rgba(240,234,224,0.55)" }}>Poin tersedia</span>
              </div>
              <span className="font-bold text-xl tabular-nums font-['Cormorant_Garamond']" style={{ color: "#F0EAE0" }}>
                {(cardData?.total_points || 0).toLocaleString("id-ID")}
              </span>
            </div>
          </motion.div>

          {/* RIGHT: Details */}
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-5"
          >
            <div>
              <h2 className="font-['Cormorant_Garamond'] text-3xl font-semibold mb-1" style={{ color: "#F0EAE0" }}>Kartu Digital</h2>
              <p className="text-sm" style={{ color: "rgba(240,234,224,0.45)" }}>Tunjukkan QR code kepada kasir saat berkunjung</p>
            </div>

            {/* How to use */}
            <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-xs uppercase tracking-wider mb-3" style={{ color: "rgba(201,168,118,0.6)" }}>Cara Pakai</p>
              <div className="space-y-3">
                {[
                  { step: "01", text: "Buka kartu digital ini saat di outlet" },
                  { step: "02", text: "Tunjukkan QR code kepada kasir" },
                  { step: "03", text: "Poin otomatis terkreditkan setelah transaksi" },
                ].map((s) => (
                  <div key={s.step} className="flex items-start gap-3">
                    <span className="font-mono text-xs font-bold" style={{ color: "#C9A876" }}>{s.step}</span>
                    <p className="text-sm" style={{ color: "rgba(240,234,224,0.65)" }}>{s.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tier benefits */}
            {cardData?.tier_benefits?.perks && (
              <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="text-xs uppercase tracking-wider mb-3" style={{ color: "rgba(201,168,118,0.6)" }}>Benefit {tier.charAt(0).toUpperCase()+tier.slice(1)}</p>
                <div className="space-y-2">
                  {cardData.tier_benefits.perks.map((perk, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-xs mt-0.5" style={{ color: "#7FAE7A" }}>&#10003;</span>
                      <p className="text-sm" style={{ color: "rgba(240,234,224,0.65)" }}>{perk}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Back button */}
            <button
              onClick={() => navigate("/loyalty")}
              className="w-full py-3 rounded-xl text-sm font-medium transition-colors"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(240,234,224,0.6)" }}
              data-testid="loyalty-card-download-button"
            >
              Kembali ke Dashboard
            </button>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
