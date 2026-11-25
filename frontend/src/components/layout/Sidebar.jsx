/** Sidebar — desktop sidebar TERPADU (IA v3.1, 2026-10).
 *
 * Semua modul yang boleh diakses user tampil di satu sidebar dalam zona:
 * Kerja Saya · Modul · Alat. Lebar 248px, leaf-only active (design_guidelines.md).
 *
 * Sidebar HANYA berisi navigasi. Brand, pencarian global (⌘K) dan identitas user +
 * logout ada di TopNav — sebelumnya ketiganya tampil dua kali (logo di header dan
 * "FnB Group ERP" di sidebar, "Super Admin" di kanan atas dan kiri bawah).
 *
 * Mode collapsed (76px): tampilkan ikon Beranda, Persetujuan, dan tiap modul
 * (klik → landing modul), dengan tooltip.
 */
import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigation } from "@/contexts/NavigationContext";
import { useAuth } from "@/lib/auth";
import { buildUnifiedNav } from "@/lib/unifiedNav";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import NavTree from "./NavTree";

function CollapsedRail({ nav, pathname }) {
  const entries = nav.filter((e) => e.type === "link" || e.type === "group");
  return (
    <nav className="flex flex-col items-center gap-1" aria-label="Navigasi ringkas">
      {entries.map((e) => {
        const Icon = e.icon;
        const under = pathname === e.path || pathname.startsWith(e.path + "/");
        const active = e.type === "link" && !e.portalId ? pathname === e.path : under;
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
                <div className="text-xs text-muted-foreground mt-1">
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
  const { user } = useAuth();
  const location = useLocation();
  const nav = useMemo(() => buildUnifiedNav(user), [user]);

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        className={cn(
          "hidden lg:flex flex-col border-r border-border bg-card/30 backdrop-blur-md transition-all duration-300",
          sidebarCollapsed ? "w-[76px]" : "w-[248px]"
        )}
        data-testid="sidebar"
      >
        <ScrollArea className="flex-1 px-2.5 py-3 h-0">
          {sidebarCollapsed ? (
            <CollapsedRail nav={nav} pathname={location.pathname} />
          ) : (
            <NavTree />
          )}
        </ScrollArea>

        {/* Footer: collapse toggle */}
        <div className="border-t border-border p-2" data-testid="sidebar-footer">
          <button
            type="button"
            onClick={toggleSidebar}
            className={cn(
              "h-8 w-full flex items-center gap-2 rounded-md px-2.5 text-[13px] text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] transition-colors",
              sidebarCollapsed && "justify-center px-0"
            )}
            data-testid="sidebar-collapse-toggle"
            aria-label={sidebarCollapsed ? "Buka sidebar" : "Ciutkan sidebar"}
            title={sidebarCollapsed ? "Buka sidebar" : "Ciutkan sidebar"}
          >
            {sidebarCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            {!sidebarCollapsed && <span>Ciutkan sidebar</span>}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
