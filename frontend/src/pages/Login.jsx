import { useState } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export default function Login() {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/erp" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Email dan password wajib diisi"); return; }
    setSubmitting(true);
    const result = await login(email, password);
    setSubmitting(false);
    if (result.ok) {
      toast.success(`Selamat datang, ${result.user.full_name}`);
      navigate("/erp", { replace: true });
    } else {
      toast.error(result.error || "Login gagal");
    }
  };

  const fillDemo = (which) => {
    const demos = {
      admin:        "admin@fnbgroup.id",
      executive:    "executive@fnbgroup.id",
      finance:      "finance@fnbgroup.id",
      procurement:  "procurement@fnbgroup.id",
      "the-coffeeshop":       "cfs.manager@fnbgroup.id",
    };
    setEmail(demos[which]);
    setPassword("Demo@2026");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16" style={{ background: "#F8F5EF" }} data-testid="login-page">
      {/* Very subtle back to website */}
      <div className="mb-8 text-center">
        <Link
          to="/"
          className="text-xs hover:underline transition-colors"
          style={{ color: "rgba(28,21,16,0.35)", fontFamily: "'Azeret Mono', monospace", letterSpacing: "0.1em" }}
          data-testid="login-back-to-website"
        >
          &larr; FNBGROUP.ID
        </Link>
      </div>

      {/* Compact form card */}
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-sm border p-8"
        style={{ borderColor: "rgba(28,21,16,0.08)" }}
      >
        {/* Header — minimal */}
        <div className="mb-6">
          <p
            className="text-[10px] uppercase tracking-[0.25em] mb-3"
            style={{ color: "rgba(28,21,16,0.35)", fontFamily: "'Azeret Mono', monospace" }}
          >
            FnB Group ERP — Staff Portal
          </p>
          <h1 className="text-xl font-semibold" style={{ color: "#1C1510", fontFamily: "'Cormorant Garamond', serif" }}>
            Masuk
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "rgba(28,21,16,0.45)" }}>
            Akses khusus karyawan FnB Group
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: "rgba(28,21,16,0.55)" }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@fnbgroup.id"
              className="w-full h-10 px-3 text-sm rounded-lg border outline-none transition-colors"
              style={{ background: "#F8F5EF", borderColor: "rgba(28,21,16,0.15)", color: "#1C1510" }}
              data-testid="login-email"
              autoFocus
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: "rgba(28,21,16,0.55)" }}>Password</label>
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-10 px-3 pr-10 text-sm rounded-lg border outline-none transition-colors"
                style={{ background: "#F8F5EF", borderColor: "rgba(28,21,16,0.15)", color: "#1C1510" }}
                data-testid="login-password"
                required
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "rgba(28,21,16,0.35)" }}
                data-testid="login-toggle-password"
              >
                {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            style={{ background: "#1C1510", color: "#F8F5EF" }}
            data-testid="login-submit"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Masuk
          </button>
        </form>

        {/* Demo accounts — collapsible */}
        <div className="mt-5 pt-5" style={{ borderTop: "1px solid rgba(28,21,16,0.07)" }}>
          <p className="text-[10px] mb-2.5" style={{ color: "rgba(28,21,16,0.35)", fontFamily: "'Azeret Mono', monospace" }}>
            DEMO — password: Demo@2026
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[
              { k: "admin", l: "Admin" },
              { k: "executive", l: "Executive" },
              { k: "finance", l: "Finance" },
              { k: "procurement", l: "Procurement" },
              { k: "the-coffeeshop", l: "Outlet" },
            ].map((d) => (
              <button
                key={d.k}
                type="button"
                onClick={() => fillDemo(d.k)}
                className="px-2 py-1 rounded-md text-[11px] font-medium transition-colors hover:bg-black/5"
                style={{ background: "rgba(28,21,16,0.04)", color: "rgba(28,21,16,0.55)" }}
                data-testid={`demo-${d.k}`}
              >
                {d.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Customer loyalty link */}
      <div className="mt-6 text-center">
        <p className="text-xs" style={{ color: "rgba(28,21,16,0.35)" }}>Pelanggan FnB Group?</p>
        <Link
          to="/loyalty/login"
          className="text-sm font-medium hover:underline mt-0.5 inline-block"
          style={{ color: "#1C1510" }}
          data-testid="login-loyalty-link"
        >
          Bergabung Loyalty Program &rarr;
        </Link>
      </div>
    </div>
  );
}
