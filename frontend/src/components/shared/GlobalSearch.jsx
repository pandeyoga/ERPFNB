/** GlobalSearch — Phase D UX Improvement (Command Palette).
 *
 * Upgraded 2026-05-26 to include NAVIGATION search as the first section, so users
 * can quickly jump between menu items across portals. The lower sections still
 * search master data (items, vendors, employees, outlets, brands, COA, users).
 *
 * Triggers:
 *   - Cmd/Ctrl+K (global hotkey via AppShell)
 *   - Click search bar in TopNav
 *
 * Behavior:
 *   - User starts typing -> navigation results show INSTANTLY (no API call),
 *     then master-data results stream in after 150ms debounce when q.length >= 2.
 *   - Keyboard navigation: arrow keys + Enter
 *   - Esc closes.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Package, Building2, Users, Receipt, Hash, ArrowRight,
  Navigation, Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api, { unwrap } from "@/lib/api";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { useAuth } from "@/lib/auth";
import { visiblePortalsFor } from "@/lib/portals";
import { getPortalSections } from "@/lib/navigationSchema";

const SECTIONS = [
  { key: "items",     icon: Package,   label: "Items",     name: "name",        sub: "code" },
  { key: "vendors",   icon: Receipt,   label: "Vendors",   name: "name",        sub: "code" },
  { key: "employees", icon: Users,     label: "Employees", name: "full_name",   sub: "position" },
  { key: "outlets",   icon: Building2, label: "Outlets",   name: "name",        sub: "code" },
  { key: "brands",    icon: Building2, label: "Brands",    name: "name",        sub: "code" },
  { key: "coa",       icon: Hash,      label: "GL Accounts", name: "name",      sub: "code" },
  { key: "users",     icon: Users,     label: "Users",     name: "full_name",   sub: "email" },
];

/** Returns true if user perms grant access to the required perm string */
function hasPerm(perms, reqPerm) {
  if (!reqPerm) return true;
  if (perms.includes("*")) return true;
  return perms.some(p => p === reqPerm || p.startsWith(reqPerm + "."));
}

/**
 * Build a flat list of all navigation items the user can access.
 * Each item: { id, name, portalName, path, sectionName, searchKey }
 */
function buildNavIndex(user) {
  if (!user) return [];
  const userPerms = user.permissions || [];
  const portals = visiblePortalsFor(user);
  const result = [];
  for (const portal of portals) {
    const sections = getPortalSections(portal.id);
    for (const section of sections) {
      if (section.reqPerm && !hasPerm(userPerms, section.reqPerm)) continue;
      for (const item of section.items) {
        result.push({
          id: `${portal.id}::${section.id}::${item.id}`,
          name: item.name,
          path: item.path,
          portalName: portal.name,
          portalId: portal.id,
          sectionName: section.name,
          searchKey: `${item.name} ${section.name} ${portal.name}`.toLowerCase(),
        });
      }
    }
  }
  return result;
}

export default function GlobalSearch({ open, onClose }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Build nav index once per user session
  const navIndex = useMemo(() => buildNavIndex(user), [user]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQ("");
      setResults(null);
      setActiveIdx(0);
    } else {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Esc to close, arrow keys to navigate
  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => i + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(0, i - 1)); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  // Filtered navigation (instant, no debounce)
  const navResults = useMemo(() => {
    const trimmed = q.trim().toLowerCase();
    if (!trimmed) return [];
    // Top 8 best matches
    const matches = navIndex.filter(item => item.searchKey.includes(trimmed));
    // Score: prefer prefix matches on name, then portal
    matches.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const aPrefix = aName.startsWith(trimmed) ? 0 : 1;
      const bPrefix = bName.startsWith(trimmed) ? 0 : 1;
      if (aPrefix !== bPrefix) return aPrefix - bPrefix;
      return aName.length - bName.length;
    });
    return matches.slice(0, 8);
  }, [q, navIndex]);

  // Debounced master-data search (>= 2 chars)
  useEffect(() => {
    if (!open) return;
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get("/api/search", { params: { q: q.trim() } });
        setResults(unwrap(res));
      } catch (e) {
        logger.error("Global search failed", { error: e.message });
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => clearTimeout(handle);
  }, [q, open]);

  const handleNavClick = useCallback((item) => {
    onClose();
    navigate(item.path);
  }, [navigate, onClose]);

  const handleClick = useCallback((section, item) => {
    onClose();
    if (section === "items") navigate(`/admin/master/items?id=${item.id}`);
    else if (section === "vendors") navigate(`/admin/master/vendors?id=${item.id}`);
    else if (section === "employees") navigate(`/admin/master/employees?id=${item.id}`);
    else if (section === "outlets") navigate(`/admin/master/outlets?id=${item.id}`);
    else if (section === "brands") navigate(`/admin/master/brands?id=${item.id}`);
    else if (section === "coa") navigate(`/admin/master/chart-of-accounts?id=${item.id}`);
    else if (section === "users") navigate(`/admin/users?id=${item.id}`);
  }, [navigate, onClose]);

  // Flat keyboard navigation list (nav items first)
  const flatList = useMemo(() => {
    const arr = navResults.map(n => ({ kind: "nav", item: n }));
    if (results) {
      SECTIONS.forEach(sec => {
        (results[sec.key] || []).forEach(item => arr.push({ kind: "data", section: sec.key, item }));
      });
    }
    return arr;
  }, [navResults, results]);

  // Enter to navigate to active
  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (e.key === "Enter" && flatList.length > 0) {
        e.preventDefault();
        const sel = flatList[Math.min(activeIdx, flatList.length - 1)];
        if (!sel) return;
        if (sel.kind === "nav") handleNavClick(sel.item);
        else handleClick(sel.section, sel.item);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, flatList, activeIdx, handleNavClick, handleClick]);

  // Clamp activeIdx
  useEffect(() => {
    if (activeIdx >= flatList.length && flatList.length > 0) {
      setActiveIdx(flatList.length - 1);
    }
  }, [flatList, activeIdx]);

  // Scroll active into view
  useEffect(() => {
    if (!listRef.current) return;
    const node = listRef.current.querySelector(`[data-cmd-idx="${activeIdx}"]`);
    if (node && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ block: "nearest" });
    }
  }, [activeIdx]);

  const totalDataResults = results
    ? SECTIONS.reduce((sum, s) => sum + (results[s.key]?.length || 0), 0)
    : 0;
  const totalAllResults = navResults.length + totalDataResults;
  let runningIdx = 0;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-foreground/40"
            style={{ backdropFilter: "blur(8px)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: "none" }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 top-[10vh] mx-auto z-50 max-w-2xl px-4"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="glass-card overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border/50">
                <Search className="h-5 w-5 text-muted-foreground" />
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setActiveIdx(0); }}
                  placeholder="Cari menu, halaman, item, vendor, employee…"
                  className="flex-1 bg-transparent border-0 outline-none text-base placeholder:text-muted-foreground"
                  data-testid="global-search-input"
                />
                <kbd className="text-xs text-muted-foreground px-2 py-1 rounded bg-foreground/5">Esc</kbd>
              </div>
              <div className="max-h-[60vh] overflow-y-auto" ref={listRef}>
                {q.trim().length === 0 && (
                  <div className="py-10 px-5 text-center text-sm text-muted-foreground">
                    <Sparkles className="h-5 w-5 mx-auto mb-2 opacity-60" />
                    <div className="font-medium">Cari apapun dengan cepat</div>
                    <div className="text-xs mt-1">
                      Coba ketik <span className="font-mono bg-foreground/5 px-1.5 py-0.5 rounded">opname</span>,
                      {" "}<span className="font-mono bg-foreground/5 px-1.5 py-0.5 rounded">low stock</span>,
                      {" "}atau nama item / vendor
                    </div>
                    <div className="text-[11px] mt-3 flex items-center justify-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 rounded bg-foreground/5">↑↓</kbd> navigasi
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 rounded bg-foreground/5">Enter</kbd> buka
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 rounded bg-foreground/5">Esc</kbd> tutup
                      </span>
                    </div>
                  </div>
                )}

                {q.trim().length > 0 && totalAllResults === 0 && !loading && (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    Tidak ada hasil untuk "{q}"
                  </div>
                )}

                {/* Navigation results (instant) */}
                {navResults.length > 0 && (
                  <div className="py-2" data-testid="global-search-nav">
                    <div className="px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <Navigation className="h-3 w-3" />
                      Navigasi & Halaman
                    </div>
                    {navResults.map((item) => {
                      const idx = runningIdx++;
                      const isActive = idx === activeIdx;
                      return (
                        <button
                          key={item.id}
                          data-cmd-idx={idx}
                          onClick={() => handleNavClick(item)}
                          onMouseEnter={() => setActiveIdx(idx)}
                          className={cn(
                            "w-full flex items-center gap-3 px-5 py-2.5 transition-colors text-left",
                            isActive ? "bg-foreground/8" : "hover:bg-foreground/5",
                          )}
                          data-testid={`nav-result-${item.id}`}
                        >
                          <div className="h-8 w-8 rounded-lg grad-aurora-soft flex items-center justify-center shrink-0">
                            <Navigation className="h-4 w-4 text-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{item.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {item.portalName} · {item.sectionName}
                            </div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </button>
                      );
                    })}
                  </div>
                )}

                {loading && q.trim().length >= 2 && (
                  <div className="py-4 text-center text-xs text-muted-foreground">
                    Mencari data master…
                  </div>
                )}

                {/* Master data results */}
                {!loading && results && SECTIONS.map((sec) => {
                  const items = results[sec.key] || [];
                  if (items.length === 0) return null;
                  const Icon = sec.icon;
                  return (
                    <div key={sec.key} className="py-2">
                      <div className="px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {sec.label}
                      </div>
                      {items.map((item) => {
                        const idx = runningIdx++;
                        const isActive = idx === activeIdx;
                        return (
                          <button
                            key={item.id}
                            data-cmd-idx={idx}
                            onClick={() => handleClick(sec.key, item)}
                            onMouseEnter={() => setActiveIdx(idx)}
                            className={cn(
                              "w-full flex items-center gap-3 px-5 py-2.5 transition-colors text-left",
                              isActive ? "bg-foreground/8" : "hover:bg-foreground/5",
                            )}
                          >
                            <div className="h-8 w-8 rounded-lg grad-aurora-soft flex items-center justify-center shrink-0">
                              <Icon className="h-4 w-4 text-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{item[sec.name] || "—"}</div>
                              <div className="text-xs text-muted-foreground truncate">{item[sec.sub] || "—"}</div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
