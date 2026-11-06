/** Helper murni untuk editor Peran & Hak Akses (tanpa React). Katalog: GET /admin/permissions?grouped=true. */

export const LEVELS = [
  { value: "none", label: "Tidak ada" },
  { value: "view", label: "Lihat" },
  { value: "full", label: "Penuh" },
];

/** Tingkat modul/portal dari izin yang aktif: none | view | full | custom. */
export function levelOf(perms, set) {
  if (!perms.length) return "none";
  const on = perms.filter((p) => set.has(p.code));
  if (!on.length) return "none";
  if (on.length === perms.length) return "full";
  const views = perms.filter((p) => p.action === "view");
  if (views.length && on.length === views.length && views.every((p) => set.has(p.code))) return "view";
  return "custom";
}

/** Terapkan tingkat ke sekumpulan izin. `allowed(code)` = pengubah boleh memberi izin ini (anti eskalasi). */
export function applyLevel(set, perms, level, allowed = () => true) {
  const next = new Set(set);
  perms.forEach((p) => {
    const want = level === "full" || (level === "view" && p.action === "view");
    if (want && allowed(p.code)) next.add(p.code);
    if (!want) next.delete(p.code);
  });
  return next;
}

/** Toggle satu izin + dependensi: menyalakan izin non-lihat ikut menyalakan izin lihatnya; mematikan izin lihat
 *  ikut mematikan izin yang bergantung padanya. Mengembalikan { next, auto: [kode yang ikut berubah] }. */
export function togglePerm(set, perm, modulePerms) {
  const next = new Set(set);
  const auto = [];
  if (next.has(perm.code)) {
    next.delete(perm.code);
    modulePerms.forEach((p) => {
      if (p.requires?.includes(perm.code) && next.has(p.code)) { next.delete(p.code); auto.push(p.code); }
    });
  } else {
    next.add(perm.code);
    (perm.requires || []).forEach((r) => { if (!next.has(r)) { next.add(r); auto.push(r); } });
  }
  return { next, auto };
}

export function diff(before, after) {
  const b = new Set(before || []);
  const a = new Set(after || []);
  return { added: [...a].filter((x) => !b.has(x)).sort(), removed: [...b].filter((x) => !a.has(x)).sort() };
}

/** Indeks kode → { perm, module, portal } untuk label & pencarian. */
export function indexCatalog(catalog) {
  const idx = {};
  (catalog?.portals || []).forEach((portal) => portal.modules.forEach((m) => m.permissions.forEach((p) => {
    idx[p.code] = { perm: p, module: m, portal };
  })));
  if (catalog?.super) idx["*"] = { perm: catalog.super, module: { label: "Akses penuh" }, portal: { label: "Super Admin" } };
  return idx;
}

export function allCodes(catalog) {
  return (catalog?.portals || []).flatMap((portal) => portal.modules.flatMap((m) => m.permissions.map((p) => p.code)));
}
