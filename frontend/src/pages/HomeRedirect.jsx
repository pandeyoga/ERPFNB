/** Default landing route after login (IA v3) — langsung ke Beranda modul user.
 *
 * Alur "Pilih Portal" DIHAPUS. Setelah login user langsung masuk ke:
 *   1. modul terakhir yang dikunjungi (jika masih boleh diakses), atau
 *   2. modul pertama yang boleh diakses (urutan PORTALS).
 * Semua modul lain tersedia dari sidebar terpadu.
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { defaultHomePath } from "@/lib/unifiedNav";

export default function HomeRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user) return;
    const home = defaultHomePath(user);
    if (!home) {
      navigate("/no-access", { replace: true });
      return;
    }
    navigate(home, { replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-[40vh] flex items-center justify-center" data-testid="home-redirect">
      <div className="glass-card px-6 py-4 flex items-center gap-3">
        <div className="h-2 w-2 rounded-full grad-aurora animate-pulse" />
        <span className="text-sm text-muted-foreground">Mengarahkan…</span>
      </div>
    </div>
  );
}
