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
  const modulePortals = portals.filter((p) => !TOOL_PORTALS.has(p.id));
  if (modulePortals.length) {
    out.push({ type: "zone", id: "zone-modul", label: "Modul" });
    modulePortals.forEach((p) => out.push(portalGroup(p, perms)));
  }

  // ── Zona: Alat ───────────────────────────────────────────────────────────
  const toolPortals = portals.filter((p) => TOOL_PORTALS.has(p.id));
  if (toolPortals.length) {
    out.push({ type: "zone", id: "zone-alat", label: "Alat" });
    toolPortals.forEach((p) => out.push(portalGroup(p, perms, { icon: Settings })));
  }

  return out;
}

function portalGroup(portal, perms, overrides = {}) {
  const sections = getPortalSections(portal.id).filter((s) => hasPerm(perms, s.reqPerm));
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
 * Konteks lokasi untuk breadcrumb TopNav:
 * { portal, section, item } — mencocokkan path persis, lalu prefix terpanjang.
 */
export function resolveNavContext(pathname) {
  const portal = PORTALS.find((p) => pathname === p.path || pathname.startsWith(p.path + "/"));
  if (!portal) {
    if (pathname === "/my-approvals" || pathname === "/approvals") {
      return { portal: null, section: null, item: { name: "Pusat Persetujuan", path: pathname } };
    }
    return { portal: null, section: null, item: null };
  }
  const sections = getPortalSections(portal.id);
  let best = null;
  sections.forEach((section) => {
    section.items.forEach((item) => {
      if (pathname === item.path) {
        if (!best || best.score < 1000) best = { section, item, score: 1000 };
      } else if (pathname.startsWith(item.path + "/") && item.path !== portal.path) {
        const score = item.path.length;
        if (!best || best.score < score) best = { section, item, score };
      }
    });
  });
  return { portal, section: best?.section || null, item: best?.item || null };
}
