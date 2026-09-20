/** NavTree — pohon navigasi terpadu (dipakai Sidebar desktop & MobileSidebar).
 *
 * Struktur: Zona → (link | grup modul) → seksi → item.
 *  - Grup modul (portal) collapsible; grup yang memuat route aktif otomatis terbuka.
 *  - Seksi dengan 1 item DIRATAKAN menjadi link langsung (aturan flatten_rule).
 *  - Leaf-only active model: hanya route terdalam yang mendapat background aktif.
 *  - Favorit (pin) per user, maks 6, disimpan di localStorage.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, ChevronRight, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { buildUnifiedNav, favKeyOf, flattenNavItems } from "@/lib/unifiedNav";

const MAX_FAVS = 6;

function useFavorites(user) {
  const storageKey = `aurora_favs_${user?.email || "anon"}`;
  const [favs, setFavs] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  });
  const toggleFav = useCallback((key) => {
    setFavs((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key].slice(-MAX_FAVS);
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }, [storageKey]);
  return { favs, toggleFav };
}

function FavStar({ active, onToggle, testId }) {
  return (
    <span
      role="button"
      tabIndex={-1}
      data-testid={testId}
      title={active ? "Hapus dari favorit" : "Pin ke favorit"}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
      className={cn(
        "ml-auto inline-flex shrink-0 items-center transition-opacity",
        active ? "opacity-100 text-amber-500" : "opacity-0 group-hover/item:opacity-50 hover:!opacity-100"
      )}
    >
      <Star className="h-3 w-3" fill={active ? "currentColor" : "none"} />
    </span>
  );
}

function ZoneLabel({ entry }) {
  return (
    <p
      data-testid={`nav-${entry.id}`}
      className="mt-4 mb-1 px-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80 first:mt-0"
    >
      {entry.label}
    </p>
  );
}

export default function NavTree({ onNavigate }) {
  const { user } = useAuth();
  const location = useLocation();
  const pathname = location.pathname;

  const nav = useMemo(() => buildUnifiedNav(user), [user]);
  const itemIndex = useMemo(() => flattenNavItems(user), [user]);
  const { favs, toggleFav } = useFavorites(user);

  // Grup portal yang memuat route aktif
  const activeGroupId = useMemo(() => {
    const g = nav.find((e) => e.type === "group" && (pathname === e.path || pathname.startsWith(e.path + "/")));
    return g?.id || null;
  }, [nav, pathname]);

  // Grup yang terbuka (persist) — default: grup aktif saja
  const [expandedGroups, setExpandedGroups] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("aurora_nav_expanded") || "null");
      if (Array.isArray(stored)) return new Set(stored);
    } catch { /* ignore */ }
    return new Set();
  });
  useEffect(() => {
    if (activeGroupId && !expandedGroups.has(activeGroupId)) {
      setExpandedGroups((prev) => {
        const next = new Set(prev);
        next.add(activeGroupId);
        localStorage.setItem("aurora_nav_expanded", JSON.stringify([...next]));
        return next;
      });
    }
  }, [activeGroupId]); // eslint-disable-line

  const toggleGroup = (id) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem("aurora_nav_expanded", JSON.stringify([...next]));
      return next;
    });
  };

  // Seksi (level 3) — kompatibel dengan key lama `aurora_sidebar_sections`
  const [expandedSections, setExpandedSections] = useState(() => {
    try {
      const saved = localStorage.getItem("aurora_sidebar_sections");
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const toggleSection = (key) => {
    setExpandedSections((prev) => {
      const next = { ...prev, [key]: !(prev[key] ?? true) };
      localStorage.setItem("aurora_sidebar_sections", JSON.stringify(next));
      return next;
    });
  };

  const isActive = (path) => pathname === path;
  const itemTestId = (item) => `sidebar-nav-item-${item.id || item.path.replace(/[^a-z0-9]/gi, "-")}`;

  const leafClass = (active) => cn(
    "group/item flex items-center gap-2 px-2.5 py-1 rounded-md text-[13px] transition-all duration-150",
    active
      ? "text-foreground font-semibold bg-foreground/[0.08] border-l-2 border-foreground/30 pl-2"
      : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]"
  );

  const renderLeaf = (portalId, item, opts = {}) => {
    const key = favKeyOf(portalId, item);
    const active = isActive(item.path);
    const Icon = opts.icon;
    return (
      <Link
        key={key}
        to={item.path}
        onClick={onNavigate}
        className={leafClass(active)}
        data-testid={opts.testId || itemTestId(item)}
        aria-current={active ? "page" : undefined}
      >
        {Icon && <Icon className="h-4 w-4 shrink-0" />}
        <span className="flex-1 truncate">{opts.label || item.name}</span>
        {item.badge && (
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-foreground/10 text-foreground/70">{item.badge}</span>
        )}
        <FavStar active={favs.includes(key)} onToggle={() => toggleFav(key)} testId={`fav-toggle-${portalId}-${item.id}`} />
      </Link>
    );
  };

  const favItems = favs.map((k) => itemIndex[k]).filter(Boolean);

  return (
    <nav className="space-y-0.5" data-testid="main-navigation" aria-label="Navigasi utama">
      {/* Favorit */}
      {favItems.length > 0 && (
        <div data-testid="nav-favorites">
          <p className="mb-1 px-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80 flex items-center gap-1">
            <Star className="h-3 w-3" /> Favorit
          </p>
          <div className="space-y-0.5 mb-2">
            {favItems.map((it) =>
              renderLeaf(it.portalId, it, { icon: it.icon, testId: `nav-fav-${it.portalId}-${it.id}`, label: `${it.name}` })
            )}
          </div>
        </div>
      )}

      {nav.map((entry) => {
        if (entry.type === "zone") return <ZoneLabel key={entry.id} entry={entry} />;

        if (entry.type === "link") {
          const Icon = entry.icon;
          const active = isActive(entry.path);
          return (
            <Link
              key={entry.id}
              to={entry.path}
              onClick={onNavigate}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors",
                active ? "text-foreground bg-foreground/[0.08]" : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]"
              )}
              data-testid={`nav-${entry.id}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left truncate">{entry.name}</span>
            </Link>
          );
        }

        // ── Grup modul (portal) ──
        const GroupIcon = entry.icon;
        const isOpen = expandedGroups.has(entry.id);
        const groupActive = activeGroupId === entry.id;
        return (
          <div key={entry.id} className="space-y-0.5" data-testid={`sidebar-portal-group-${entry.id}`}>
            <button
              type="button"
              onClick={() => toggleGroup(entry.id)}
              aria-expanded={isOpen}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors",
                groupActive ? "text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]"
              )}
              data-testid={`nav-group-toggle-${entry.id}`}
              title={entry.name}
            >
              <GroupIcon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left truncate">{entry.name}</span>
              {isOpen ? <ChevronDown className="h-3 w-3 shrink-0 opacity-60" /> : <ChevronRight className="h-3 w-3 shrink-0 opacity-60" />}
            </button>

            {isOpen && (
              <div className="ml-[11px] space-y-0.5 border-l border-border pl-2">
                {entry.sections.map((section) => {
                  const SIcon = section.icon;
                  const sKey = `${entry.id}/${section.id}`;

                  // Seksi 1 item → link langsung
                  if (section.items.length === 1) {
                    const only = section.items[0];
                    return renderLeaf(entry.id, only, {
                      icon: SIcon,
                      label: section.name,
                      testId: `sidebar-section-${section.id}`,
                    });
                  }

                  const sOpen = expandedSections[sKey] ?? true;
                  const sActive = section.items.some((it) => isActive(it.path));
                  return (
                    <div key={sKey} className="space-y-0.5">
                      <button
                        type="button"
                        onClick={() => toggleSection(sKey)}
                        aria-expanded={sOpen}
                        className={cn(
                          "w-full flex items-center gap-2 px-2.5 py-1 rounded-md text-[13px] font-medium transition-colors",
                          sActive ? "text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]"
                        )}
                        data-testid={`sidebar-section-${section.id}`}
                        aria-label={section.name}
                      >
                        <SIcon className="h-4 w-4 shrink-0" />
                        <span className="flex-1 text-left truncate">{section.name}</span>
                        {sOpen ? <ChevronDown className="h-3 w-3 shrink-0 opacity-60" /> : <ChevronRight className="h-3 w-3 shrink-0 opacity-60" />}
                      </button>
                      {sOpen && (
                        <div className="ml-[19px] space-y-0.5 border-l border-border pl-2">
                          {section.items.map((item) => renderLeaf(entry.id, item))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
