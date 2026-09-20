import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation, useSearchParams } from "react-router-dom";

import { useAuth } from "@/lib/auth";
import { NavigationProvider } from "@/contexts/NavigationContext";
import TopNav from "./TopNav";
import Sidebar from "./Sidebar";
import MobileSidebar from "./MobileSidebar";
import GlobalSearch from "@/components/shared/GlobalSearch";
import NotificationDrawer from "@/components/shared/NotificationDrawer";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

export default function AppShell() {
  const { user, loading } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Global outlet guard — warn when outlet staff hits a URL with out-of-scope outlet_id
  useEffect(() => {
    if (!user || loading) return;
    const isFullAccess = (user?.permissions || []).includes("*");
    if (isFullAccess) return;
    const userOutletIds = user?.outlet_ids || [];
    if (userOutletIds.length === 0) return;
    const urlOutletId = searchParams.get("outlet_id");
    if (urlOutletId && !userOutletIds.includes(urlOutletId)) {
      toast.warning("Akses dibatasi — Anda tidak memiliki akses ke outlet tersebut.", {
        id: "outlet-guard-warn",
        duration: 5000,
      });
      const next = new URLSearchParams(searchParams);
      next.delete("outlet_id");
      setSearchParams(next, { replace: true });
    }
  }, [location.pathname, location.search, user, loading]); // eslint-disable-line

  // ⌘K / Ctrl+K opens global search; sidebar "Cari menu…" juga memicu event ini
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    const openFromSidebar = () => setSearchOpen(true);
    window.addEventListener("keydown", handler);
    window.addEventListener("aurora-open-search", openFromSidebar);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("aurora-open-search", openFromSidebar);
    };
  }, []);

  // Redirect if not logged in (after loading completes)
  useEffect(() => {
    if (!loading && !user) {
      navigate("/login", { replace: true });
    }
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" role="status" aria-label="Memuat aplikasi">
        <div className="glass-card px-6 py-4 flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-aurora animate-pulse" />
          <span className="text-sm text-muted-foreground">Memuat…</span>
        </div>
      </div>
    );
  }

  return (
    <NavigationProvider>
      <div className="h-screen flex flex-col overflow-hidden">
        {/* Skip to content — a11y */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-3 focus:py-2 focus:rounded-lg focus:pill-active focus:text-sm focus:shadow-lg"
        >
          Lewati ke konten utama
        </a>

        {/* Level 1: Top Navigation */}
        <TopNav
          onSearchOpen={() => setSearchOpen(true)}
          onNotifOpen={() => setNotifOpen(true)}
        />

        {/* Mobile Sidebar (Sheet) — navigasi terpadu */}
        <MobileSidebar />

        {/* Level 2 & 3: Sidebar + Content */}
        <div className="flex-1 flex w-full min-h-0 overflow-hidden">
          {/* Level 2: Left Sidebar terpadu (Desktop only) */}
          <Sidebar />
          
          {/* Content area */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
            {/* Main content — scrolls independently */}
            <main
              id="main-content"
              tabIndex={-1}
              className="flex-1 overflow-y-auto px-4 sm:px-5 lg:px-8 py-5 lg:py-8 pb-20 lg:pb-8"
            >
              <div className="max-w-[1600px] mx-auto w-full">
                {/* Fix 2026-05-27: Removed AnimatePresence + motion.div wrapper.
                   framer-motion v11 + React 19 + mode="wait" has a known bug
                   where the new motion.div gets stuck at exit state (opacity: 0,
                   translateY(-3px)) when the route element is reused across
                   navigations (Operations wildcard, CMSStudio 9 routes, MasterDataHub
                   :entity, ConfigurationLayout nested Outlet). Result: 30 sub-pages
                   showed blank content despite DOM being fully populated.
                   See /app/memory_docs/blank_page_investigation/ for full analysis. */}
                <Outlet />
              </div>
            </main>
          </div>
        </div>
        
        <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
        <NotificationDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />
        <Toaster position="top-right" />
      </div>
    </NavigationProvider>
  );
}
