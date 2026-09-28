/**
 * PWAInstallBanner — Sprint F
 * Shows an "Install FnB ERP" prompt when the browser fires beforeinstallprompt.
 * Also handles app-update-available notification.
 */
import { useEffect, useState } from "react";
import { Download, X, RefreshCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

let deferredPrompt = null;

export default function PWAInstallBanner() {
  const [showInstall, setShowInstall] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [updateReg, setUpdateReg] = useState(null);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem("aurora-pwa-install-dismissed") === "1"
  );

  useEffect(() => {
    // Install prompt
    const onBeforeInstall = (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (!dismissed) setShowInstall(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // App update available
    const onUpdate = (e) => {
      setUpdateReg(e.detail?.reg);
      setShowUpdate(true);
    };
    window.addEventListener("aurora-sw-update", onUpdate);

    // If already installed (standalone mode), hide install banner
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setShowInstall(false);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("aurora-sw-update", onUpdate);
    };
  }, [dismissed]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    deferredPrompt = null;
    setShowInstall(false);
    if (result.outcome === "accepted") {
      toast.success("FnB ERP berhasil dipasang di home screen!");
    }
  };

  const handleDismiss = () => {
    setShowInstall(false);
    setDismissed(true);
    localStorage.setItem("aurora-pwa-install-dismissed", "1");
  };

  const handleUpdate = () => {
    if (updateReg?.waiting) {
      updateReg.waiting.postMessage({ type: "SKIP_WAITING" });
    }
    setShowUpdate(false);
    window.location.reload();
  };

  return (
    <>
      {/* Install Banner */}
      {showInstall && !dismissed && (
        <div
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md
                     rounded-2xl border border-primary/20 bg-background/95 backdrop-blur-md
                     shadow-xl p-4 flex items-start gap-3 animate-in slide-in-from-bottom-4"
          data-testid="pwa-install-banner"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">Pasang FnB ERP di HP Anda</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Install untuk akses cepat seperti aplikasi native
            </p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Button size="sm" onClick={handleInstall} className="gap-1.5 h-8 text-xs">
              <Download className="h-3.5 w-3.5" />
              Install
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleDismiss}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Update Banner */}
      {showUpdate && (
        <div
          className="fixed top-4 left-1/2 z-50 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm
                     rounded-2xl border border-amber-500/20 bg-amber-500/10 backdrop-blur-md
                     shadow-lg p-3 flex items-center gap-3"
          data-testid="pwa-update-banner"
        >
          <RefreshCw className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="flex-1 text-sm font-medium text-amber-800 dark:text-amber-200">
            Update tersedia
          </p>
          <Button size="sm" variant="outline" className="h-7 text-xs border-amber-500/30" onClick={handleUpdate}>
            Refresh
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowUpdate(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </>
  );
}
