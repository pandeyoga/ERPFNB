/** TopNav — header aplikasi (IA v3, 2026-07).
 *
 * Portal switcher (pill per portal) DIHAPUS — semua modul kini ada di sidebar terpadu.
 * Ruang tengah dipakai untuk breadcrumb + judul halaman ("Beranda › Modul › Halaman")
 * sehingga user selalu tahu posisinya. Klaster kanan (search, notifikasi, approvals,
 * help/tour, tema, user menu) TIDAK berubah — test-id dipertahankan untuk tour.
 */
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Sparkles, Search, Menu, Store, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth";
import { useNavigation } from "@/contexts/NavigationContext";
import { resolveNavContext } from "@/lib/unifiedNav";
import api, { unwrap } from "@/lib/api";
import UserMenu from "@/components/shared/UserMenu";
import NotificationBell from "@/components/shared/NotificationBell";
import ApprovalsInboxButton from "@/components/shared/ApprovalsInboxButton";
import ThemeToggle from "@/components/shared/ThemeToggle";
import HelpTourButton from "@/components/shared/HelpTourButton";

export default function TopNav({ onSearchOpen }) {
  const { user } = useAuth();
  const { openMobileDrawer } = useNavigation();
  const location = useLocation();
  const navigate = useNavigate();
  const [outlets, setOutlets] = useState([]);

  useEffect(() => {
    // Load outlet list to resolve names (lightweight, cached)
    api.get("/master/outlets", { params: { per_page: 100 } })
      .then((r) => setOutlets(unwrap(r) || []))
      .catch(() => {});
  }, []);

  const ctx = resolveNavContext(location.pathname);
  const crumbs = [];
  if (ctx.portal) crumbs.push({ label: ctx.portal.name, path: ctx.portal.path });
  if (ctx.section && ctx.section.items.length > 1) crumbs.push({ label: ctx.section.name });
  const title = ctx.item?.name || ctx.section?.name || ctx.portal?.name || "Beranda";
  const isHomeOfPortal = ctx.portal && ctx.item?.path === ctx.portal.path;

  // Determine scope context for the logged-in user
  const isFullAccess = (user?.permissions || []).includes("*");
  const userOutletIds = user?.outlet_ids || [];
  const isRestricted = !isFullAccess && userOutletIds.length > 0 && userOutletIds.length < outlets.length;
  const scopeOutlets = outlets.filter((o) => userOutletIds.includes(o.id));

  return (
    <header
      className="glass-panel sticky top-0 z-40 px-3 sm:px-4 lg:px-6 h-[64px] lg:h-[72px] flex items-center justify-between gap-2"
      style={{ borderBottom: "1px solid rgb(var(--glass-border))" }}
      role="banner"
    >
      {/* Logo + mobile menu */}
      <div className="flex items-center gap-2 min-w-0 shrink-0">
        <button
          onClick={openMobileDrawer}
          className="lg:hidden h-10 w-10 rounded-full glass-input flex items-center justify-center hover:bg-foreground/5 transition-colors"
          aria-label="Buka menu navigasi"
          data-testid="topnav-menu-toggle"
        >
          <Menu className="h-5 w-5" />
        </button>
        <button
          onClick={() => navigate("/erp")}
          className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg pr-2"
          aria-label="FnB Group ERP - Beranda"
          data-testid="logo-home-button"
        >
          <div className="h-9 w-9 rounded-xl grad-aurora flex items-center justify-center shadow-md flex-shrink-0">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div className="hidden sm:flex lg:hidden flex-col leading-none">
            <span className="font-bold text-sm tracking-tight">FnB Group</span>
          </div>
        </button>

        {/* Outlet context indicator — visible ONLY when user is restricted to specific outlets */}
        {isRestricted && scopeOutlets.length > 0 && (
          <div className="hidden sm:flex items-center gap-1 ml-1">
            {scopeOutlets.slice(0, 2).map((o) => (
              <span
                key={o.id}
                className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/20"
                title="Anda hanya dapat melihat data outlet ini"
              >
                <Store className="h-3 w-3" />
                {o.name}
              </span>
            ))}
            {scopeOutlets.length > 2 && (
              <span className="text-[11px] text-muted-foreground">+{scopeOutlets.length - 2}</span>
            )}
          </div>
        )}
      </div>

      {/* Breadcrumb + judul (desktop) */}
      <div className="hidden lg:flex flex-1 min-w-0 flex-col justify-center px-2" data-testid="topnav-title-block">
        <nav className="flex items-center gap-1 text-[11px] text-muted-foreground min-w-0" aria-label="Breadcrumb" data-testid="breadcrumb">
          <Link to="/erp" className="hover:text-foreground transition-colors shrink-0">Beranda</Link>
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1 min-w-0">
              <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
              {c.path ? (
                <Link to={c.path} className="hover:text-foreground transition-colors truncate">{c.label}</Link>
              ) : (
                <span className="truncate">{c.label}</span>
              )}
            </span>
          ))}
        </nav>
        <h1 className="text-sm font-semibold leading-tight truncate" data-testid="page-title">
          {isHomeOfPortal ? `${ctx.portal.name} — ${title}` : title}
        </h1>
      </div>

      {/* Current page label (mobile) */}
      <div className="lg:hidden flex-1 min-w-0 text-center">
        <span className="text-sm font-semibold truncate block">{title}</span>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button
          onClick={onSearchOpen}
          className="hidden sm:flex h-10 px-3 rounded-full glass-input items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors min-w-[180px]"
          data-testid="open-global-search"
          aria-label="Cari (⌘K)"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Cari…</span>
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-foreground/10" aria-hidden="true">⌘K</kbd>
        </button>
        <button
          onClick={onSearchOpen}
          className="sm:hidden h-10 w-10 rounded-full glass-input flex items-center justify-center hover:bg-foreground/5"
          aria-label="Cari"
          data-testid="open-global-search-mobile"
        >
          <Search className="h-5 w-5" />
        </button>
        <NotificationBell />
        <ApprovalsInboxButton />
        <HelpTourButton />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
