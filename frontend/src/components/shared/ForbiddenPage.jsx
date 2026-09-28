/** 403 Forbidden page — Phase 3 hardening.
 *
 * Shown when the user lands on a route they don't have permission for, or
 * when an API responds with 403. Uses react-router's <Navigate> redirect by
 * default but also exposes a static rendered fallback.
 */
import { Link } from "react-router-dom";
import { ShieldAlert, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export default function ForbiddenPage({ requiredPerm }) {
  const { user } = useAuth();
  return (
    <div className="max-w-xl mx-auto py-16 px-6" data-testid="forbidden-page">
      <div className="glass-card p-8 text-center">
        <div className="h-16 w-16 mx-auto rounded-2xl grad-aurora-soft flex items-center justify-center mb-4">
          <ShieldAlert className="h-7 w-7 text-rose-600" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Akses Ditolak</h1>
        <p className="text-sm text-muted-foreground mb-1">
          Anda tidak punya izin untuk mengakses halaman ini.
        </p>
        {requiredPerm && (
          <p className="text-[11px] text-muted-foreground font-mono mb-4">
            Permission yang dibutuhkan: <b>{requiredPerm}</b>
          </p>
        )}
        {user?.email && (
          <p className="text-[11px] text-muted-foreground mb-6">
            Login sebagai <b>{user.email}</b>. Hubungi admin jika Anda merasa ini error.
          </p>
        )}
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" onClick={() => window.history.back()} className="rounded-full gap-2">
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Button>
          <Button asChild className="rounded-full pill-active gap-2">
            <Link to="/"><Home className="h-4 w-4" /> Beranda</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
