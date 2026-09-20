import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Zap, Gift, Crown, Loader2, Phone, Mail } from "lucide-react";
import { useLoyaltyAuth } from "@/contexts/LoyaltyAuthContext";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const BG_IMAGE = "https://images.unsplash.com/photo-1579708776106-eeb62aa0af7b?w=800&q=85";
const API = process.env.REACT_APP_BACKEND_URL || "";

const BENEFITS = [
  { icon: Zap, text: "Earn 1 poin setiap Rp 10.000 transaksi" },
  { icon: Gift, text: "Tukar dengan voucher & rewards eksklusif" },
  { icon: Crown, text: "Naik tier untuk keuntungan lebih besar" },
];

const TIERS = [
  { label: "Bronze", color: "rgba(180,120,40,0.25)" },
  { label: "Silver", color: "rgba(180,180,200,0.2)" },
  { label: "Gold", color: "rgba(201,168,118,0.28)" },
];

export default function LoyaltyLogin() {
  const navigate = useNavigate();
  const { login, loginByPhone } = useLoyaltyAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [phonePassword, setPhonePassword] = useState("");
  const [show, setShow] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = "#0D0B07";
    return () => { document.body.style.background = prev; };
  }, []);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !password) { setError("Email dan password wajib diisi"); return; }
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Selamat datang kembali!");
      navigate("/loyalty");
    } catch (err) {
      const msg = err.response?.data?.errors?.[0]?.message ||
                  err.response?.data?.detail || "Email atau password salah";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!phone || !phonePassword) { setError("Nomor HP dan password wajib diisi"); return; }
    setLoading(true);
    try {
      await loginByPhone(phone.trim(), phonePassword);
      toast.success("Selamat datang!");
      navigate("/loyalty");
    } catch (err) {
      const msg = err.response?.data?.detail || "Nomor HP atau password salah";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="loyalty-theme min-h-screen flex"
      style={{ background: "#0D0B07", color: "#F0EAE0" }}
    >
      {/* ── LEFT BRAND PANEL ── */}
      <div className="hidden lg:flex lg:w-[44%] xl:w-[40%] relative flex-col overflow-hidden">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${BG_IMAGE})` }}
        />
        {/* Overlay */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(160deg, rgba(13,11,7,0.88) 0%, rgba(26,20,12,0.75) 100%)" }}
        />
        {/* Subtle gold glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 40% at 20% 80%, rgba(201,168,118,0.12), transparent 70%)" }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full p-10 xl:p-14">
          {/* Logo */}
          <div>
            <Link to="/" className="inline-block">
              <div className="font-['Cormorant_Garamond'] text-2xl tracking-[0.22em] uppercase font-semibold text-[#F0EAE0]">
                FNB GROUP
              </div>
              <div className="text-[#C9A876] text-[10px] tracking-[0.3em] uppercase font-medium mt-0.5">
                REWARDS PROGRAM
              </div>
            </Link>
          </div>

          {/* Hero text */}
          <div className="my-auto">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="font-['Cormorant_Garamond'] text-4xl xl:text-5xl font-semibold leading-tight mb-6"
              style={{ color: "#F0EAE0" }}
            >
              Kumpulkan Poin,<br />
              Nikmati Rewards<br />
              <span style={{ color: "#C9A876" }}>Eksklusif</span>
            </motion.h1>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-4 mb-10"
            >
              {BENEFITS.map((b, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(201,168,118,0.12)", border: "1px solid rgba(201,168,118,0.2)" }}
                  >
                    <b.icon className="h-4 w-4" style={{ color: "#C9A876" }} />
                  </div>
                  <span className="text-sm" style={{ color: "rgba(240,234,224,0.75)" }}>{b.text}</span>
                </div>
              ))}
            </motion.div>

            {/* Tier chips */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex gap-2"
            >
              {TIERS.map((t) => (
                <span
                  key={t.label}
                  className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{ background: t.color, border: "1px solid rgba(255,255,255,0.1)", color: "rgba(240,234,224,0.65)" }}
                >
                  {t.label}
                </span>
              ))}
            </motion.div>
          </div>

          {/* Bottom footnote */}
          <div className="text-[10px] tracking-widest uppercase" style={{ color: "rgba(240,234,224,0.25)" }}>
            FnB Group &copy; {new Date().getFullYear()}
          </div>
        </div>
      </div>

      {/* ── RIGHT FORM PANEL ── */}
      <div
        className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 lg:p-14"
        style={{ background: "#0D0B07" }}
      >
        {/* Mobile logo */}
        <div className="lg:hidden mb-10 text-center">
          <Link to="/">
            <div className="font-['Cormorant_Garamond'] text-2xl tracking-[0.22em] uppercase font-semibold" style={{ color: "#F0EAE0" }}>
              FNB GROUP
            </div>
            <div className="text-[10px] tracking-[0.3em] uppercase mt-0.5" style={{ color: "#C9A876" }}>REWARDS</div>
          </Link>
        </div>

        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Heading */}
          <div className="mb-8">
            <h2
              className="font-['Cormorant_Garamond'] text-3xl lg:text-4xl font-semibold"
              style={{ color: "#F0EAE0" }}
            >
              Selamat Datang
            </h2>
            <p className="text-sm mt-1" style={{ color: "rgba(240,234,224,0.5)" }}>
              Masuk untuk akses loyalty rewards Anda
            </p>
          </div>

          {/* Form card */}
          <div className="loyalty-glass rounded-2xl p-6 sm:p-8">
            {error && (
              <div
                className="mb-5 p-3 rounded-xl text-sm"
                style={{ background: "rgba(224,107,90,0.12)", border: "1px solid rgba(224,107,90,0.25)", color: "#E88A7A" }}
                data-testid="loyalty-login-error"
              >
                {error}
              </div>
            )}

            <Tabs defaultValue="email" className="w-full" onValueChange={() => setError("")}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger 
                  value="email" 
                  className="flex items-center gap-2"
                  data-testid="loyalty-login-email-tab"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </TabsTrigger>
                <TabsTrigger 
                  value="phone" 
                  className="flex items-center gap-2"
                  data-testid="loyalty-login-phone-tab"
                >
                  <Phone className="h-3.5 w-3.5" />
                  Nomor HP
                </TabsTrigger>
              </TabsList>

              {/* Email Login Tab */}
              <TabsContent value="email">
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium tracking-wide uppercase" style={{ color: "rgba(240,234,224,0.5)" }}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(""); }}
                      placeholder="nama@email.com"
                      className="loyalty-input w-full h-11 px-4 text-sm"
                      data-testid="loyalty-login-email"
                      autoFocus
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium tracking-wide uppercase" style={{ color: "rgba(240,234,224,0.5)" }}>
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={show ? "text" : "password"}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(""); }}
                        placeholder="••••••••"
                        className="loyalty-input w-full h-11 px-4 pr-11 text-sm"
                        data-testid="loyalty-login-password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShow((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: "rgba(240,234,224,0.4)" }}
                      >
                        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="loyalty-btn-gold w-full h-12 text-sm mt-2"
                    data-testid="loyalty-login-submit"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Masuk...
                      </span>
                    ) : "Masuk"}
                  </button>
                </form>
              </TabsContent>

              {/* Phone Login Tab */}
              <TabsContent value="phone">
                <form onSubmit={handlePhoneSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium tracking-wide uppercase" style={{ color: "rgba(240,234,224,0.5)" }}>
                      Nomor HP
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value); setError(""); }}
                      placeholder="081234567890"
                      className="loyalty-input w-full h-11 px-4 text-sm"
                      data-testid="loyalty-login-phone-input"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium tracking-wide uppercase" style={{ color: "rgba(240,234,224,0.5)" }}>
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPhone ? "text" : "password"}
                        value={phonePassword}
                        onChange={(e) => { setPhonePassword(e.target.value); setError(""); }}
                        placeholder="••••••••"
                        className="loyalty-input w-full h-11 px-4 pr-11 text-sm"
                        data-testid="loyalty-login-phone-password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPhone((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: "rgba(240,234,224,0.4)" }}
                      >
                        {showPhone ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Akun baru? Password awal = nomor HP Anda
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="loyalty-btn-gold w-full h-12 text-sm mt-2"
                    data-testid="loyalty-login-phone-submit"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Masuk...
                      </span>
                    ) : "Masuk"}
                  </button>
                </form>
              </TabsContent>
            </Tabs>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
              <span className="text-xs" style={{ color: "rgba(240,234,224,0.3)" }}>atau</span>
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
            </div>

            {/* Register link */}
            <div className="text-center text-sm">
              <span style={{ color: "rgba(240,234,224,0.45)" }}>Belum punya akun? </span>
              <Link
                to="/loyalty/register"
                className="font-semibold hover:underline"
                style={{ color: "#C9A876" }}
                data-testid="loyalty-login-register-link"
              >
                Daftar sekarang
              </Link>
            </div>
          </div>

          {/* Back to website */}
          <div className="mt-5 text-center">
            <Link
              to="/"
              className="text-xs hover:underline transition-opacity"
              style={{ color: "rgba(240,234,224,0.25)" }}
            >
              &larr; Kembali ke Website
            </Link>
          </div>

          {/* Staff access — very subtle */}
          <div className="mt-2 text-center">
            <Link
              to="/login"
              className="text-[10px] hover:opacity-60 transition-opacity"
              style={{ color: "rgba(240,234,224,0.18)" }}
              data-testid="loyalty-login-staff-access-link"
            >
              Staff Access
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
