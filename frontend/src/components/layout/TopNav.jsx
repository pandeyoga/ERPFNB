/** TopNav — header aplikasi (IA v3.1, 2026-10).
 *
 * Satu-satunya tempat brand (logo + nama), pencarian global, dan identitas user —
 * sidebar tidak lagi menduplikasinya. Area brand selebar sidebar (248px / 76px saat
 * collapsed) sehingga breadcrumb sejajar dengan tepi kiri konten.
 *
 * Header hanya menampilkan breadcrumb (bukan <h1>): judul halaman adalah milik
 * PageHeader di tiap halaman, jadi tidak ada judul ganda. Test-id yang dipakai tour
 * (`logo-home-button`, `open-global-search`, `help-tour-button`) dipertahankan.
 */
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Sparkles, Search, Menu, Store, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useNavigation } from "@/contexts/NavigationContext";
import { resolveNavContext } from "@/lib/unifiedNav";
import { fetchAll, unwrap } from "@/lib/api";
import UserMenu from "@/components/shared/UserMenu";
import NotificationBell from "@/components/shared/NotificationBell";
import ApprovalsInboxButton from "@/components/shared/ApprovalsInboxButton";
import ThemeToggle from "@/components/shared/ThemeToggle";
import HelpTourButton from "@/components/shared/HelpTourButton";

/** Breadcrumb trail: Beranda › Modul › Seksi › Halaman (› Detail). */
export function buildCrumbs(pathname) {
  const ctx = resolveNavContext(pathname);
  const crumbs = [];
  if (ctx.portal) crumbs.push({ label: ctx.portal.name, path: ctx.portal.path });
  const item = ctx.item;
  if (ctx.section && ctx.section.items.length > 1 && ctx.section.name !== item?.name) {
    crumbs.push({ label: ctx.section.name });
  }
  if (item && ctx.portal && item.name === ctx.portal.name) {
    // Item bernama sama dengan modulnya (Report Center › Report Center) tidak diulang;
    // sub-halamannya (mis. /reports/daily-sales) → "Report Center › Detail".
    if (pathname !== item.path) crumbs.push({ label: "Detail" });
  } else if (item) {
    // Halaman detail (prefix) → "… › Purchase Requests › Detail"; sub-halaman hub (alias)
    // dan halaman persis → item adalah crumb terakhir.
    const isDetail = ctx.match === "prefix";
    crumbs.push({ label: item.name, path: isDetail ? item.path : null });
    if (isDetail) crumbs.push({ label: "Detail" });
  }
  const title = crumbs.length ? crumbs[crumbs.length - 1].label : "Beranda";
  return { crumbs, title };
}

export default function TopNav({ onSearchOpen }) {
  const { user } = useAuth();
  const { openMobileDrawer, sidebarCollapsed } = useNavigation();
  const location = useLocation();
  const navigate = useNavigate();
  const [outlets, setOutlets] = useState([]);

  useEffect(() => {
    // Load outlet list to resolve names (lightweight, cached)
    fetchAll("/master/outlets")
      .then((r) => setOutlets(unwrap(r) || []))
      .catch(() => {});
  }, []);

  const { crumbs, title } = buildCrumbs(location.pathname);

  // Determine scope context for the logged-in user
  const isFullAccess = (user?.permissions || []).includes("*");
  const userOutletIds = user?.outlet_ids || [];
  const isRestricted = !isFullAccess && userOutletIds.length > 0 && userOutletIds.length < outlets.length;
  const scopeOutlets = outlets.filter((o) => userOutletIds.includes(o.id));

  return (
    <header
      className="glass-panel sticky top-0 z-40 h-14 flex items-center gap-2 pr-3 sm:pr-4 lg:pr-5"
      style={{ borderBottom: "1px solid rgb(var(--glass-border))" }}
      role="banner"
    >
      {/* Brand — selebar sidebar di desktop */}
      <div
        className={cn(
          "h-full flex items-center gap-2 pl-3 shrink-0 lg:border-r lg:border-border transition-[width] duration-300",
          sidebarCollapsed ? "lg:w-[76px] lg:justify-center lg:pl-0" : "lg:w-[248px]"
        )}
      >
        <button
          onClick={openMobileDrawer}
          className="lg:hidden h-9 w-9 rounded-full glass-input flex items-center justify-center hover:bg-foreground/5 transition-colors"
          aria-label="Buka menu navigasi"
          data-testid="topnav-menu-toggle"
        >
          <Menu className="h-4 w-4" />
        </button>
        <button
          onClick={() => navigate("/erp")}
          className="hidden sm:flex items-center gap-2 min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="FnB Group ERP - Beranda"
          data-testid="logo-home-button"
        >
          <span className="h-8 w-8 rounded-lg grad-aurora flex items-center justify-center shadow-md shrink-0">
            <Sparkles className="h-4 w-4 text-white" />
          </span>
          <span
            className={cn(
              "hidden sm:flex flex-col items-start leading-tight min-w-0",
              sidebarCollapsed && "lg:hidden"
            )}
          >
            <span className="text-sm font-semibold tracking-tight truncate">FnB Group ERP</span>
            <span className="text-[11px] text-muted-foreground truncate">Multi-brand F&amp;B</span>
          </span>
        </button>
      </div>

      {/* Breadcrumb (desktop) — lokasi saat ini; judul halaman ada di PageHeader */}
      <div className="hidden lg:flex flex-1 min-w-0 items-center gap-3 pl-3" data-testid="topnav-title-block">
        <nav className="flex items-center gap-1 text-[13px] text-muted-foreground min-w-0" aria-label="Breadcrumb" data-testid="breadcrumb">
          {crumbs.length === 0 ? (
            <span className="font-medium text-foreground" aria-current="page" data-testid="page-title">Beranda</span>
          ) : (
            <Link to="/erp" className="hover:text-foreground transition-colors shrink-0">Beranda</Link>
          )}
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <span key={i} className="flex items-center gap-1 min-w-0">
                <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
                {last ? (
                  <span className="font-medium text-foreground truncate" aria-current="page" data-testid="page-title">{c.label}</span>
                ) : c.path ? (
                  <Link to={c.path} className="hover:text-foreground transition-colors truncate">{c.label}</Link>
                ) : (
                  <span className="truncate">{c.label}</span>
                )}
              </span>
            );
          })}
        </nav>

        {/* Outlet context indicator — hanya untuk user yang dibatasi ke outlet tertentu */}
        {isRestricted && scopeOutlets.length > 0 && (
          <div className="flex items-center gap-1 shrink-0" data-testid="topnav-outlet-scope">
            {scopeOutlets.slice(0, 2).map((o) => (
              <span
                key={o.id}
                className="inline-flex items-center gap-1 text-[11px] h-6 px-2 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/20"
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

      {/* Current page label (mobile) */}
      <div className="lg:hidden flex-1 min-w-0 text-left sm:text-center">
        <span className="text-sm font-semibold truncate block">{title}</span>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onSearchOpen}
          className="hidden sm:flex h-9 px-3 rounded-full glass-input items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors min-w-[200px]"
          data-testid="open-global-search"
          aria-label="Cari menu & dokumen (⌘K)"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Cari…</span>
          <kbd className="text-[11px] px-1.5 py-0.5 rounded bg-foreground/10" aria-hidden="true">⌘K</kbd>
        </button>
        <button
          onClick={onSearchOpen}
          className="sm:hidden h-9 w-9 rounded-full glass-input flex items-center justify-center hover:bg-foreground/5"
          aria-label="Cari"
          data-testid="open-global-search-mobile"
        >
          <Search className="h-4 w-4" />
        </button>
        <NotificationBell />
        <ApprovalsInboxButton />
        <HelpTourButton />
        {/* Di layar sempit tombol tema disembunyikan (tetap ada di Preferensi) agar judul
            halaman tidak terpotong. */}
        <div className="hidden sm:flex">
          <ThemeToggle />
        </div>
        <UserMenu />
      </div>
    </header>
  );
}
