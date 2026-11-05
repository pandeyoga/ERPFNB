/**
 * unifiedNav.js — Unified Information Architecture (IA v3, 2026-07).
 *
 * Menggantikan alur "Pilih Portal" dengan SATU sidebar yang memuat semua modul
 * (mengikuti pola hub-and-zone: Kerja Saya · Modul · Alat).
 *
 * PENTING: Ini hanya lapisan presentasi. Route, permission (RBAC), navigationSchema
 * per-portal, dan tourMap TIDAK berubah — semua path yang dirender di sini adalah
 * path yang sama persis dengan sebelumnya, sehingga tour tetap valid.
 */
import { Home, Inbox, Settings } from "lucide-react";
import { PORTALS, visiblePortalsFor } from "@/lib/portals";
import { getPortalSections } from "@/lib/navigationSchema";
import { ROUTE_PERMS } from "@/lib/routePerms.generated";

/** Zona sidebar — urutan tetap. */
export const NAV_ZONES = [
  { id: "kerja", label: "Kerja Saya" },
  { id: "modul", label: "Modul" },
  { id: "alat", label: "Alat" },
];

/** Portal yang masuk zona "Alat" (konfigurasi/administrasi diletakkan terakhir). */
const TOOL_PORTALS = new Set(["admin"]);

/** Returns true if `perms` grants access to `reqPerm` (sama dengan Sidebar lama). */
export function hasPerm(perms, reqPerm) {
  if (!reqPerm) return true;
  if (perms.includes("*")) return true;
  return perms.some((p) => p === reqPerm || p.startsWith(reqPerm + "."));
}

/** Kunci favorit yang unik lintas portal. */
export const favKeyOf = (portalId, item) => `${portalId}:${item.path}`;

/**
 * Path default "Beranda" untuk user:
 *  1. modul terakhir yang dikunjungi (jika masih boleh diakses & preferensi tidak dimatikan)
 *  2. modul pertama yang boleh diakses (urutan PORTALS)
 */
export function defaultHomePath(user) {
  const portals = visiblePortalsFor(user);
  if (!portals.length) return null;
  const remember = localStorage.getItem("aurora_remember_last_portal") !== "false";
  // Per-user key (fallback ke key legacy) — agar user berbeda di browser yang sama
  // tidak saling "mewarisi" modul terakhir.
  const lastId = localStorage.getItem(lastPortalKey(user));
  if (remember && lastId) {
    const last = portals.find((p) => p.id === lastId);
    if (last) return last.path;
  }
  return portals[0].path;
}

export const lastPortalKey = (user) => `aurora_last_portal_${user?.email || "anon"}`;

/** Izin guard route untuk sebuah path menu (lib/routePerms.generated.js; "/x/*" = prefix). null = tanpa guard. */
export function routeNeed(path) {
  const clean = String(path || "").split(/[?#]/)[0].replace(/\/$/, "") || "/";
  if (ROUTE_PERMS[clean]) return ROUTE_PERMS[clean];
  let best = null;
  Object.keys(ROUTE_PERMS).forEach((k) => {
    if (!k.endsWith("/*")) return;
    const base = k.slice(0, -2);
    if ((clean === base || clean.startsWith(base + "/")) && (!best || k.length > best.length)) best = k;
  });
  return best ? ROUTE_PERMS[best] : null;
}

/** True bila guard route `path` meloloskan user — untuk tautan/kartu di halaman (sama dengan aturan menu). */
export function canOpenPath(user, path) {
  const need = routeNeed(path);
  return !need || need.some((n) => hasPerm((user && user.permissions) || [], n));
}

/** Item menu hanya tampil bila guard route-nya akan meloloskan user (tidak ada menu yang berujung /no-access). */
export function itemVisible(perms, item) {
  const need = routeNeed(item.path);
  return !need || need.some((n) => hasPerm(perms, n));
}

/**
 * Bangun pohon navigasi terpadu.
 * Output: array entri bertipe `zone` | `link` | `group`.
 *   group = { type, id, name, icon, path, sections: [{ id, name, icon, items:[{id,name,path,badge}] }] }
 */
export function buildUnifiedNav(user) {
  if (!user) return [];
  const perms = user.permissions || [];
  const portals = visiblePortalsFor(user);
  const out = [];

  // ── Zona: Kerja Saya ─────────────────────────────────────────────────────
  out.push({ type: "zone", id: "zone-kerja", label: "Kerja Saya" });
  out.push({ type: "link", id: "home", name: "Beranda", icon: Home, path: "/erp", matchPaths: [] });
  out.push({ type: "link", id: "approval-inbox", name: "Pusat Persetujuan", icon: Inbox, path: "/my-approvals" });

  // ── Zona: Modul ──────────────────────────────────────────────────────────
  const moduleGroups = portals.filter((p) => !TOOL_PORTALS.has(p.id)).map((p) => portalGroup(p, perms)).filter(Boolean);
  if (moduleGroups.length) {
    out.push({ type: "zone", id: "zone-modul", label: "Modul" });
    out.push(...moduleGroups);
  }

  // ── Zona: Alat ───────────────────────────────────────────────────────────
  const toolGroups = portals.filter((p) => TOOL_PORTALS.has(p.id)).map((p) => portalGroup(p, perms, { icon: Settings })).filter(Boolean);
  if (toolGroups.length) {
    out.push({ type: "zone", id: "zone-alat", label: "Alat" });
    out.push(...toolGroups);
  }

  return out;
}

function portalGroup(portal, perms, overrides = {}) {
  const sections = getPortalSections(portal.id)
    .filter((s) => hasPerm(perms, s.reqPerm))
    .map((s) => ({ ...s, items: s.items.filter((i) => itemVisible(perms, i)) }))
    .filter((s) => s.items.length > 0);
  const items = sections.flatMap((s) => s.items);
  if (!items.length) return null;
  // Modul dengan satu halaman (mis. Report Center) → link langsung, bukan grup yang
  // berisi satu item bernama sama.
  if (items.length === 1) {
    return { type: "link", id: portal.id, portalId: portal.id, name: portal.name, icon: overrides.icon || portal.icon, path: items[0].path };
  }
  return {
    type: "group",
    id: portal.id,
    name: portal.name,
    icon: overrides.icon || portal.icon,
    path: portal.path,
    sections,
  };
}

/** Semua leaf item (untuk favorit & pencarian) → { key, portalId, portalName, ...item } */
export function flattenNavItems(user) {
  const idx = {};
  buildUnifiedNav(user).forEach((entry) => {
    if (entry.type !== "group") return;
    entry.sections.forEach((section) => {
      section.items.forEach((item) => {
        const key = favKeyOf(entry.id, item);
        idx[key] = { key, portalId: entry.id, portalName: entry.name, sectionName: section.name, icon: section.icon, ...item };
      });
    });
  });
  return idx;
}

/**
 * Konteks lokasi untuk breadcrumb TopNav & item aktif sidebar:
 * { portal, section, item, match } — `match` = "exact" | "alias" | "prefix".
 *  - exact : path sama persis dengan item
 *  - alias : path termasuk `matchPaths` item (sub-halaman/tab sebuah hub)
 *  - prefix: halaman detail di bawah path item (mis. /procurement/pr/123)
 * Dipilih kecocokan terpanjang sehingga hanya SATU item yang aktif.
 */
export function resolveNavContext(pathname) {
  const under = (p) => pathname === p || pathname.startsWith(p + "/");
  const portal = PORTALS.find((p) => under(p.path));
  if (!portal) {
    if (pathname === "/my-approvals" || pathname === "/approvals") {
      return { portal: null, section: null, item: { name: "Pusat Persetujuan", path: pathname }, match: "exact" };
    }
    return { portal: null, section: null, item: null, match: null };
  }
  const sections = getPortalSections(portal.id);
  let best = null;
  const offer = (section, item, score, match) => {
    if (!best || score > best.score) best = { section, item, score, match };
  };
  sections.forEach((section) => {
    section.items.forEach((item) => {
      if (pathname === item.path) offer(section, item, 10000, "exact");
      (item.matchPaths || []).forEach((mp) => {
        if (under(mp)) offer(section, item, 5000 + mp.length, "alias");
      });
      if (item.path !== portal.path && pathname.startsWith(item.path + "/")) {
        offer(section, item, item.path.length, "prefix");
      }
    });
  });
  return { portal, section: best?.section || null, item: best?.item || null, match: best?.match || null };
}
