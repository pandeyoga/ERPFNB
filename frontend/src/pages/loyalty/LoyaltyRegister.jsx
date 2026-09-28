import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, CheckCircle } from "lucide-react";
import { useLoyaltyAuth } from "@/contexts/LoyaltyAuthContext";
import { toast } from "sonner";

const BG_IMAGE = "https://images.unsplash.com/photo-1579708776106-eeb62aa0af7b?w=800&q=85";

export default function LoyaltyRegister() {
  const navigate = useNavigate();
  const { register } = useLoyaltyAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showCPw, setShowCPw] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = "#0D0B07";
    return () => { document.body.style.background = prev; };
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) { setError("Password tidak cocok"); return; }
    if (form.password.length < 8) { setError("Password minimal 8 karakter"); return; }
    setLoading(true);
    try {
      await register({
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        phone: form.phone,
      });
      toast.success("Registrasi berhasil! Selamat datang 🎉");
      navigate("/loyalty");
    } catch (err) {
      const msg = err.response?.data?.errors?.[0]?.message ||
                  err.response?.data?.detail || "Registrasi gagal";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const FIELDS = [
    { name: "full_name", label: "Nama Lengkap", type: "text", placeholder: "John Doe", testid: "register-full-name" },
    { name: "email", label: "Email", type: "email", placeholder: "john@email.com", testid: "register-email" },
    { name: "phone", label: "No. Telepon", type: "tel", placeholder: "+628123456789", testid: "register-phone" },
  ];

  const pwStrength = form.password.length >= 12 ? "Kuat" : form.password.length >= 8 ? "Cukup" : form.password.length > 0 ? "Lemah" : "";
  const pwColor = pwStrength === "Kuat" ? "#7FAE7A" : pwStrength === "Cukup" ? "#C9A876" : "#E06B5A";

  return (
    <div
      className="loyalty-theme min-h-screen flex"
      style={{ background: "#0D0B07", color: "#F0EAE0" }}
    >
      {/* LEFT PANEL */}
      <div className="hidden lg:flex lg:w-[40%] relative flex-col overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${BG_IMAGE})` }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, rgba(13,11,7,0.90), rgba(26,20,12,0.78))" }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 40% at 20% 80%, rgba(201,168,118,0.10), transparent 70%)" }} />

        <div className="relative z-10 flex flex-col h-full p-10 xl:p-14">
          <Link to="/" className="inline-block">
            <div className="font-['Cormorant_Garamond'] text-2xl tracking-[0.22em] uppercase font-semibold" style={{ color: "#F0EAE0" }}>FNB GROUP</div>
            <div className="text-[10px] tracking-[0.3em] uppercase font-medium mt-0.5" style={{ color: "#C9A876" }}>REWARDS PROGRAM</div>
          </Link>

          <div className="my-auto">
            <h1 className="font-['Cormorant_Garamond'] text-4xl xl:text-5xl font-semibold leading-tight mb-6" style={{ color: "#F0EAE0" }}>
              Bergabung &<br />Mulai Perjalanan<br />
              <span style={{ color: "#C9A876" }}>Rewards Anda</span>
            </h1>

            <div className="space-y-4">
              {[
                "Daftarkan diri gratis, tanpa biaya",
                "Langsung dapat poin dari transaksi pertama",
                "Akses eksklusif rewards & pengalaman premium",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: "#C9A876" }} />
                  <span className="text-sm" style={{ color: "rgba(240,234,224,0.72)" }}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[10px] tracking-widest uppercase" style={{ color: "rgba(240,234,224,0.2)" }}>FnB Group &copy; {new Date().getFullYear()}</div>
        </div>
      </div>

      {/* RIGHT FORM PANEL */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 overflow-y-auto" style={{ background: "#0D0B07" }}>
        <div className="lg:hidden mb-8 text-center">
          <Link to="/">
            <div className="font-['Cormorant_Garamond'] text-2xl tracking-[0.22em] uppercase font-semibold" style={{ color: "#F0EAE0" }}>FNB GROUP</div>
            <div className="text-[10px] tracking-[0.3em] uppercase mt-0.5" style={{ color: "#C9A876" }}>REWARDS</div>
          </Link>
        </div>

        <motion.div
          className="w-full max-w-md py-8"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="mb-8">
            <h2 className="font-['Cormorant_Garamond'] text-3xl lg:text-4xl font-semibold" style={{ color: "#F0EAE0" }}>Buat Akun</h2>
            <p className="text-sm mt-1" style={{ color: "rgba(240,234,224,0.5)" }}>Daftar gratis dan mulai kumpulkan poin</p>
          </div>

          <div className="loyalty-glass rounded-2xl p-6 sm:p-8">
            {error && (
              <div className="mb-5 p-3 rounded-xl text-sm" style={{ background: "rgba(224,107,90,0.12)", border: "1px solid rgba(224,107,90,0.25)", color: "#E88A7A" }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {FIELDS.map((f) => (
                <div key={f.name} className="space-y-1.5">
                  <label className="text-xs font-medium tracking-wide uppercase" style={{ color: "rgba(240,234,224,0.5)" }}>{f.label}</label>
                  <input
                    name={f.name}
                    type={f.type}
                    value={form[f.name]}
                    onChange={handleChange}
                    placeholder={f.placeholder}
                    className="loyalty-input w-full h-11 px-4 text-sm"
                    data-testid={f.testid}
                    required
                  />
                </div>
              ))}

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium tracking-wide uppercase" style={{ color: "rgba(240,234,224,0.5)" }}>Password</label>
                <div className="relative">
                  <input
                    name="password"
                    type={showPw ? "text" : "password"}
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Minimal 8 karakter"
                    className="loyalty-input w-full h-11 px-4 pr-11 text-sm"
                    data-testid="register-password"
                    required
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(240,234,224,0.4)" }}>
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {pwStrength && (
                  <div className="flex items-center gap-1.5">
                    <div className="flex gap-1">
                      {[1,2,3].map(i => (
                        <div key={i} className="h-1 w-8 rounded-full" style={{ background: i <= (pwStrength === "Kuat" ? 3 : pwStrength === "Cukup" ? 2 : 1) ? pwColor : "rgba(255,255,255,0.1)" }} />
                      ))}
                    </div>
                    <span className="text-xs" style={{ color: pwColor }}>{pwStrength}</span>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium tracking-wide uppercase" style={{ color: "rgba(240,234,224,0.5)" }}>Konfirmasi Password</label>
                <div className="relative">
                  <input
                    name="confirmPassword"
                    type={showCPw ? "text" : "password"}
                    value={form.confirmPassword}
                    onChange={handleChange}
                    placeholder="Ketik ulang password"
                    className="loyalty-input w-full h-11 px-4 pr-11 text-sm"
                    data-testid="register-confirm-password"
                    required
                  />
                  <button type="button" onClick={() => setShowCPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(240,234,224,0.4)" }}>
                    {showCPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="loyalty-btn-gold w-full h-12 text-sm mt-2"
                data-testid="register-submit"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Mendaftar...
                  </span>
                ) : "Daftar Sekarang"}
              </button>
            </form>

            <div className="mt-5 text-center text-sm">
              <span style={{ color: "rgba(240,234,224,0.45)" }}>Sudah punya akun? </span>
              <Link to="/loyalty/login" className="font-semibold hover:underline" style={{ color: "#C9A876" }}>Masuk</Link>
            </div>
          </div>

          <div className="mt-5 text-center">
            <Link to="/" className="text-xs hover:underline" style={{ color: "rgba(240,234,224,0.25)" }}>&larr; Kembali ke Website</Link>
          </div>
          <div className="mt-2 text-center">
            <Link to="/login" className="text-[10px] hover:opacity-60" style={{ color: "rgba(240,234,224,0.18)" }}>Staff Access</Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
