import { useState } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Palet hangat brand FnB Group (sama dengan situs publik). Tipografi tetap Inter —
// font display situs publik (Cormorant/Azeret) tidak dimuat di app ERP.
const INK = "#1C1510";
const PAPER = "#F8F5EF";
const inkA = (a) => `rgba(28,21,16,${a})`;

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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10" style={{ background: PAPER }} data-testid="login-page">
      {/* Very subtle back to website */}
      <div className="mb-6 text-center">
        <Link
          to="/"
          className="text-xs font-medium uppercase tracking-[0.1em] hover:underline transition-colors"
          style={{ color: inkA(0.45) }}
          data-testid="login-back-to-website"
        >
          &larr; fnbgroup.id
        </Link>
      </div>

      {/* Compact form card */}
      <div
        className="w-full max-w-sm bg-white rounded-xl shadow-sm border p-6"
        style={{ borderColor: inkA(0.08) }}
      >
        {/* Header — minimal */}
        <div className="mb-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] mb-2" style={{ color: inkA(0.45) }}>
            FnB Group ERP — Staff Portal
          </p>
          <h1 className="text-xl md:text-2xl font-semibold leading-tight" style={{ color: INK }}>
            Masuk
          </h1>
          <p className="text-xs md:text-sm mt-0.5" style={{ color: inkA(0.55) }}>
            Akses khusus karyawan FnB Group
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="login-email" className="text-xs md:text-sm font-medium" style={{ color: inkA(0.7) }}>Email *</Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@fnbgroup.id"
              style={{ background: PAPER, borderColor: inkA(0.15), color: INK }}
              data-testid="login-email"
              autoFocus
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="login-password" className="text-xs md:text-sm font-medium" style={{ color: inkA(0.7) }}>Password *</Label>
            <div className="relative">
              <Input
                id="login-password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pr-10"
                style={{ background: PAPER, borderColor: inkA(0.15), color: INK }}
                data-testid="login-password"
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setShow((v) => !v)}
                className="absolute right-0.5 top-1/2 -translate-y-1/2 hover:bg-black/5"
                style={{ color: inkA(0.5) }}
                aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
                aria-pressed={show}
                data-testid="login-toggle-password"
              >
                {show ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full font-semibold hover:opacity-90"
            style={{ background: INK, color: PAPER }}
            data-testid="login-submit"
          >
            {submitting && <Loader2 className="animate-spin" />}
            {submitting ? "Memproses…" : "Masuk"}
          </Button>
        </form>

        {/* Demo accounts */}
        <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${inkA(0.07)}` }}>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] mb-2" style={{ color: inkA(0.45) }}>
            Akun demo — password: Demo@2026
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[
              { k: "admin", l: "Admin" },
              { k: "executive", l: "Executive" },
              { k: "finance", l: "Finance" },
              { k: "procurement", l: "Procurement" },
              { k: "the-coffeeshop", l: "Outlet" },
            ].map((d) => (
              <Button
                key={d.k}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fillDemo(d.k)}
                className="hover:bg-black/5"
                style={{ background: inkA(0.04), color: inkA(0.65) }}
                aria-label={`Isi akun demo ${d.l}`}
                data-testid={`demo-${d.k}`}
              >
                {d.l}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Customer loyalty link */}
      <div className="mt-5 text-center">
        <p className="text-xs" style={{ color: inkA(0.5) }}>Pelanggan FnB Group?</p>
        <Link
          to="/loyalty/login"
          className="text-sm font-medium hover:underline mt-0.5 inline-block"
          style={{ color: INK }}
          data-testid="login-loyalty-link"
        >
          Bergabung Loyalty Program &rarr;
        </Link>
      </div>
    </div>
  );
}
