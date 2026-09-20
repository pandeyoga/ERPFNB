import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, TrendingUp, TrendingDown, Zap } from "lucide-react";
import { useLoyaltyAuth } from "@/contexts/LoyaltyAuthContext";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LoyaltyUserDropdown from "@/components/loyalty/LoyaltyUserDropdown";
import axios from "axios";

const API_URL = process.env.REACT_APP_BACKEND_URL || "";

export default function LoyaltyHistory() {
  const { customer, token } = useLoyaltyAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = "#0D0B07";
    return () => { document.body.style.background = prev; };
  }, []);

  useEffect(() => {
    setLoading(true);
    axios.get(`${API_URL}/api/loyalty/transactions?limit=50`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setTransactions(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const filtered = filter === "all" ? transactions
    : filter === "earned" ? transactions.filter((t) => t.points > 0)
    : transactions.filter((t) => t.points < 0);

  const totalEarned = transactions.filter((t) => t.points > 0).reduce((s, t) => s + t.points, 0);
  const totalSpent = Math.abs(transactions.filter((t) => t.points < 0).reduce((s, t) => s + t.points, 0));

  if (!customer) return null;

  return (
    <div className="loyalty-theme min-h-screen" style={{ background: "#0D0B07", color: "#F0EAE0" }}>
      {/* Header */}
      <header className="sticky top-0 z-50" style={{ background: "rgba(13,11,7,0.9)", borderBottom: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(14px)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/loyalty" className="flex items-center gap-2 text-sm hover:opacity-70 transition-opacity" style={{ color: "#C9A876" }} data-testid="loyalty-history-back">
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </Link>
            <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>
            <span className="text-sm font-medium" style={{ color: "rgba(240,234,224,0.7)" }}>Riwayat</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: "rgba(201,168,118,0.1)", border: "1px solid rgba(201,168,118,0.18)" }}>
              <Zap className="h-3.5 w-3.5" style={{ color: "#C9A876" }} />
              <span className="text-sm font-bold tabular-nums" style={{ color: "#C9A876" }} data-testid="loyalty-history-balance">{(customer.total_points || 0).toLocaleString("id-ID")}</span>
            </div>
            <LoyaltyUserDropdown />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "rgba(201,168,118,0.6)" }}>Total Poin</p>
            <p className="font-['Cormorant_Garamond'] text-3xl font-semibold tabular-nums" style={{ color: "#F0EAE0" }}>{(customer.total_points || 0).toLocaleString("id-ID")}</p>
          </div>
          <div className="rounded-2xl p-5" style={{ background: "rgba(127,174,122,0.06)", border: "1px solid rgba(127,174,122,0.12)" }}>
            <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "rgba(127,174,122,0.6)" }}>Didapat</p>
            <p className="font-['Cormorant_Garamond'] text-3xl font-semibold tabular-nums" style={{ color: "#7FAE7A" }}>+{totalEarned.toLocaleString("id-ID")}</p>
          </div>
          <div className="rounded-2xl p-5 col-span-2 sm:col-span-1" style={{ background: "rgba(224,107,90,0.06)", border: "1px solid rgba(224,107,90,0.12)" }}>
            <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "rgba(224,107,90,0.6)" }}>Ditukar</p>
            <p className="font-['Cormorant_Garamond'] text-3xl font-semibold tabular-nums" style={{ color: "#E06B5A" }}>-{totalSpent.toLocaleString("id-ID")}</p>
          </div>
        </div>

        {/* Filter */}
        <div className="mb-5">
          <div className="flex gap-2">
            {[{ v: "all", l: "Semua" }, { v: "earned", l: "Diterima" }, { v: "redeemed", l: "Ditukar" }].map(({ v, l }) => (
              <button
                key={v}
                onClick={() => setFilter(v)}
                className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
                style={{
                  background: filter === v ? "rgba(201,168,118,0.18)" : "rgba(255,255,255,0.05)",
                  border: filter === v ? "1px solid rgba(201,168,118,0.3)" : "1px solid rgba(255,255,255,0.08)",
                  color: filter === v ? "#C9A876" : "rgba(240,234,224,0.5)",
                }}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Transactions */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }} data-testid="loyalty-history-table">
          {loading ? (
            <div className="p-6 space-y-5">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between animate-pulse">
                  <div className="flex gap-3">
                    <div className="h-10 w-10 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }} />
                    <div className="space-y-2">
                      <div className="h-3 w-40 rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
                      <div className="h-2 w-24 rounded" style={{ background: "rgba(255,255,255,0.03)" }} />
                    </div>
                  </div>
                  <div className="h-4 w-16 rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Zap className="h-8 w-8 mx-auto mb-3" style={{ color: "rgba(201,168,118,0.2)" }} />
              <p className="text-sm" style={{ color: "rgba(240,234,224,0.4)" }}>Belum ada transaksi</p>
              <Link to="/loyalty/rewards" className="text-xs mt-2 inline-block hover:underline" style={{ color: "#C9A876" }}>Lihat Rewards</Link>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              {filtered.map((tx) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center justify-between px-6 py-4"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: tx.points > 0 ? "rgba(127,174,122,0.12)" : "rgba(224,107,90,0.12)" }}
                    >
                      {tx.points > 0
                        ? <TrendingUp className="h-4 w-4" style={{ color: "#7FAE7A" }} />
                        : <TrendingDown className="h-4 w-4" style={{ color: "#E06B5A" }} />}
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: "#F0EAE0" }}>{tx.description}</p>
                      <p className="text-xs" style={{ color: "rgba(240,234,224,0.35)" }}>
                        {new Date(tx.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-base tabular-nums" style={{ color: tx.points > 0 ? "#7FAE7A" : "#E06B5A" }}>
                    {tx.points > 0 ? "+" : ""}{tx.points.toLocaleString("id-ID")}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
