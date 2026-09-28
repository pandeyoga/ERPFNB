/** Sidebar — desktop sidebar TERPADU (IA v3, 2026-07).
 *
 * Menggantikan sidebar per-portal + halaman "Pilih Portal". Semua modul yang boleh
 * diakses user tampil di satu sidebar dalam zona: Kerja Saya · Modul · Alat.
 * Desain (warna, tipografi, lebar 248px, leaf-only active) TETAP mengikuti
 * design_guidelines.md — hanya struktur informasinya yang berubah.
 *
 * Mode collapsed (76px): tampilkan ikon Beranda, Persetujuan, dan tiap modul
 * (klik → landing modul), dengan tooltip.
 */
import { useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronsLeft, ChevronsRight, LogOut, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigation } from "@/contexts/NavigationContext";
import { useAuth } from "@/lib/auth";
import { initials } from "@/lib/format";
import { buildUnifiedNav } from "@/lib/unifiedNav";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import NavTree from "./NavTree";

function CollapsedRail({ nav, pathname }) {
  const entries = nav.filter((e) => e.type === "link" || e.type === "group");
  return (
    <nav className="flex flex-col items-center gap-1" aria-label="Navigasi ringkas">
      {entries.map((e) => {
        const Icon = e.icon;
        const active = e.type === "link" ? pathname === e.path : (pathname === e.path || pathname.startsWith(e.path + "/"));
        return (
          <Tooltip key={e.id}>
            <TooltipTrigger asChild>
              <Link
                to={e.path}
                aria-label={e.name}
                data-testid={e.type === "group" ? `sidebar-portal-group-${e.id}` : `nav-${e.id}`}
                className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center transition-colors",
                  active ? "text-foreground bg-foreground/[0.08]" : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]"
                )}
              >
                <Icon className="h-4 w-4" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[260px]">
              <div className="text-xs font-semibold">{e.name}</div>
              {e.type === "group" && e.sections?.length > 0 && (
                <div className="text-[10px] text-muted-foreground mt-1">
                  {e.sections.map((s) => s.name).join(" · ")}
                </div>
              )}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useNavigation();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const nav = useMemo(() => buildUnifiedNav(user), [user]);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const openSearch = () => window.dispatchEvent(new CustomEvent("aurora-open-search"));

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        className={cn(
          "hidden lg:flex flex-col border-r border-border bg-card/30 backdrop-blur-md transition-all duration-300",
          sidebarCollapsed ? "w-[76px]" : "w-[248px]"
        )}
        data-testid="sidebar"
      >
        {/* Header: brand + collapse toggle */}
        <div className="h-14 md:h-16 flex items-center justify-between px-3 border-b border-border">
          {!sidebarCollapsed && (
            <Link to="/erp" className="flex items-center gap-2 min-w-0" data-testid="sidebar-brand" aria-label="Beranda FnB Group ERP">
              <div className="h-8 w-8 rounded-lg grad-aurora flex items-center justify-center shadow-md shrink-0">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div className="flex flex-col leading-tight min-w-0">
                <span className="text-sm font-bold tracking-tight truncate">FnB Group ERP</span>
                <span className="text-[10px] text-muted-foreground truncate">Multi-brand F&amp;B ERP</span>
              </div>
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className={cn("h-8 w-8 shrink-0", sidebarCollapsed && "mx-auto")}
            data-testid="sidebar-collapse-toggle"
            aria-label={sidebarCollapsed ? "Buka sidebar" : "Tutup sidebar"}
          >
            {sidebarCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Body */}
        <ScrollArea className="flex-1 px-2.5 py-3 h-0">
          {sidebarCollapsed ? (
            <CollapsedRail nav={nav} pathname={location.pathname} />
          ) : (
            <>
              <button
                type="button"
                onClick={openSearch}
                className="w-full mb-3 flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-dashed border-border text-[13px] text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] transition-colors"
                data-testid="sidebar-open-search"
                aria-label="Cari menu (⌘K)"
              >
                <Search className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">Cari menu…</span>
                <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-foreground/10" aria-hidden="true">⌘K</kbd>
              </button>
              <NavTree />
            </>
          )}
        </ScrollArea>

        {/* Footer: user chip + logout */}
        <div className={cn("border-t border-border p-2.5", sidebarCollapsed ? "flex flex-col items-center gap-2" : "flex items-center gap-2")} data-testid="sidebar-footer">
          <div className="h-8 w-8 rounded-full grad-aurora flex items-center justify-center text-white text-[11px] font-bold shrink-0">
            {initials(user?.full_name) || "U"}
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col min-w-0 flex-1 leading-tight">
              <span className="text-[12.5px] font-semibold truncate">{user?.full_name}</span>
              <span className="text-[10.5px] text-muted-foreground truncate">{user?.role_name || user?.role || user?.email}</span>
            </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={handleLogout}
                data-testid="sidebar-logout-button"
                aria-label="Keluar"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Keluar</TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
