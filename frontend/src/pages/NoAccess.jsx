import { useState } from "react";
import { Lock, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

/** No Access — akun login tetapi belum punya permission portal apa pun. */
export default function NoAccess() {
  const { logout, user } = useAuth();
  const [busy, setBusy] = useState(false);

  const handleLogout = async () => {
    setBusy(true);
    try { await logout(); } finally { window.location.href = "/login"; }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background" data-testid="no-access-page">
      <div className="glass-card p-6 w-full max-w-md text-center">
        <div className="h-12 w-12 mx-auto rounded-[calc(var(--radius)-2px)] bg-amber-500/15 flex items-center justify-center mb-3">
          <Lock className="h-6 w-6 text-amber-600" />
        </div>
        <h1 className="text-xl md:text-2xl font-semibold leading-tight">Akses Belum Tersedia</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Akun {user?.email ? <span className="font-medium text-foreground">{user.email}</span> : "Anda"} belum
          memiliki akses ke portal mana pun. Hubungi administrator untuk meminta akses.
        </p>
        <div className="mt-4 flex flex-col-reverse sm:flex-row items-center justify-center gap-2">
          <Button variant="outline" onClick={() => window.location.assign("/erp")} data-testid="no-access-reload">
            <RefreshCw /> Muat ulang
          </Button>
          <Button onClick={handleLogout} disabled={busy} data-testid="no-access-logout">
            <LogOut /> Keluar &amp; kembali ke Login
          </Button>
        </div>
      </div>
    </div>
  );
}
