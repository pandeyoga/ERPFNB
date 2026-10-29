// Composition-level UI crawler: every route (+ first-level tabs) → layout heuristics + screenshot when flagged.
// Menangkap masalah "garis besar" yang lolos dari cek per elemen: toolbar terlipat, tab terpotong,
// kalimat pengantar bertumpuk, istilah campur, angka terpotong, tombol utama bersaing, dst.
// usage: node layout.js <outFile> <shotDir> [shardIdx=0] [shardCnt=1]   (env ONLY=<regex route> untuk sebagian)
// env: UI_BASE (default http://localhost:3000), UI_EMAIL / UI_PASSWORD (default demo super admin)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.UI_BASE || 'http://localhost:3000';
const [, , outFile, shotDir, shardIdx = '0', shardCnt = '1'] = process.argv;
const routes = JSON.parse(fs.readFileSync(path.join(__dirname, 'routes.json')));
const paramsFile = path.join(__dirname, 'params.json');
const params = fs.existsSync(paramsFile) ? JSON.parse(fs.readFileSync(paramsFile)) : {};
fs.mkdirSync(shotDir, { recursive: true });

function analyze() {
  const main = document.querySelector('main') || document.body;
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; };
  const R = (el) => el.getBoundingClientRect();
  const txt = (el) => (el.textContent || '').trim().replace(/\s+/g, ' ');
  const tid = (el) => el.dataset?.testid || '';
  const F = []; // findings
  const add = (type, detail, el, extra = {}) => { const r = el ? R(el) : null;
    F.push({ type, detail: String(detail).slice(0, 220), testid: el ? (tid(el) || tid(el.closest('[data-testid]') || {}) || '') : '',
      rect: r ? [Math.round(r.x), Math.round(r.y + window.scrollY), Math.round(r.width), Math.round(r.height)] : null, ...extra }); };
  const isControl = (el) => el.matches('button, a[class*="h-8"], a[class*="h-9"], input:not([type=checkbox]):not([type=radio]):not([type=hidden]), [role=combobox], select');
  const all = (sel, root = main) => [...root.querySelectorAll(sel)].filter(vis);

  // 1. Tab lists: overflow (hidden tabs) & too many tabs
  all('[role=tablist]').forEach((tl) => {
    const tabs = [...tl.querySelectorAll('[role=tab]')].filter(vis);
    const r = R(tl);
    const hidden = tabs.filter((t) => R(t).right > r.right + 2 || R(t).left < r.left - 2);
    if (tl.scrollWidth > tl.clientWidth + 2 || hidden.length) add('tabs-overflow', `${tabs.length} tab, ${hidden.length} tersembunyi/terpotong: ${hidden.map(txt).join(', ')}`, tl);
    else if (tabs.length > 6) add('tabs-too-many', `${tabs.length} tab: ${tabs.map(txt).join(' | ')}`, tl);
    // frame in frame: bordered tablist directly inside a card
    const cs = getComputedStyle(tl);
    if (parseFloat(cs.borderTopWidth) > 0 && tl.closest('.glass-card') && !tl.closest('.nested-cards')) add('frame-in-frame', 'TabsList berbingkai di dalam kartu', tl);
  });

  // 2. Wrapped flex toolbars leaving sparse rows
  all('*').filter((el) => { const cs = getComputedStyle(el); return cs.display.includes('flex') && cs.flexWrap === 'wrap' && cs.flexDirection.startsWith('row'); })
    .forEach((c) => {
      const r = R(c); if (r.width < 500 || r.height > 220) return;
      const kids = [...c.children].filter(vis); if (kids.length < 2) return;
      // hanya baris kontrol (toolbar), bukan pembungkus halaman/header
      const ctrlKids = kids.filter((k) => isControl(k) || k.matches('[role=tablist]') || k.querySelector(':scope > input, :scope > button, :scope > [role=tablist], :scope > [role=combobox]'));
      if (ctrlKids.length < 2) return;
      const rows = [];
      kids.forEach((k) => { const kr = R(k); const row = rows.find((x) => Math.abs(x.top - kr.top) < 6); if (row) row.items.push(kr); else rows.push({ top: kr.top, items: [kr] }); });
      if (rows.length < 2) return;
      const cs = getComputedStyle(c); const inner = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const fills = rows.map((x) => x.items.reduce((s, i) => s + i.width, 0) / inner);
      const sparse = fills.filter((f) => f < 0.5).length;
      if (sparse) add('toolbar-wrap', `${rows.length} baris, isi per baris ${fills.map((f) => Math.round(f * 100) + '%').join(' / ')}`, c);
    });

  // 3. Mixed control heights in one visual row
  const rowsSeen = new Set();
  all('*').filter((el) => { const cs = getComputedStyle(el); return cs.display.includes('flex') && cs.flexDirection.startsWith('row'); }).forEach((c) => {
    const ctrls = [...c.children].filter(vis).map((k) => (isControl(k) ? k : k.querySelector(':scope > button, :scope > input, :scope > [role=combobox], :scope > a[class*="h-"]'))).filter((k) => k && vis(k) && !k.closest('[role=tablist]') && !k.closest('table'));
    if (ctrls.length < 2) return;
    const hs = ctrls.map((k) => Math.round(R(k).height)).filter((h) => h >= 24 && h <= 48);
    const tops = ctrls.map((k) => R(k).top + R(k).height / 2);
    if (Math.max(...tops) - Math.min(...tops) > 12) return;
    const uniq = [...new Set(hs)];
    if (uniq.length > 1 && Math.max(...uniq) - Math.min(...uniq) >= 4) {
      const key = uniq.join('/') + Math.round(R(c).top);
      if (!rowsSeen.has(key)) { rowsSeen.add(key); add('mixed-control-height', `tinggi kontrol sebaris: ${hs.join('/')}px — ${ctrls.map((k) => (txt(k) || k.getAttribute('aria-label') || k.placeholder || k.tagName).slice(0, 18)).join(' · ')}`, c); }
    }
  });

  // 4. Grids: orphan last item, uneven heights
  all('*').filter((el) => getComputedStyle(el).display === 'grid').forEach((g) => {
    const kids = [...g.children].filter(vis); if (kids.length < 3) return;
    const firstTop = R(kids[0]).top; const cols = kids.filter((k) => Math.abs(R(k).top - firstTop) < 4).length;
    if (cols >= 3 && kids.length % cols === 1 && kids.length > cols) add('grid-orphan', `${kids.length} item di grid ${cols} kolom → 1 item sendirian di baris terakhir`, g);
  });

  // 5. Stretched cards with mostly empty space
  all('.glass-card, .glass-card-hover').forEach((card) => {
    const r = R(card); if (r.height < 240) return;
    let bottom = r.top;
    card.querySelectorAll('*').forEach((d) => { if (!vis(d) || d.children.length) return; const dr = R(d); if (dr.bottom > bottom && dr.bottom <= r.bottom) bottom = dr.bottom; });
    const used = (bottom - r.top) / r.height;
    if (used < 0.55) add('card-empty-space', `isi hanya ${Math.round(used * 100)}% tinggi kartu (${Math.round(r.height)}px)`, card);
  });

  // 6. Clipped (truncated) values
  all('*').filter((el) => el.children.length === 0 && txt(el).length > 1).forEach((el) => {
    const cs = getComputedStyle(el);
    if ((cs.textOverflow === 'ellipsis' || cs.overflow === 'hidden') && el.scrollWidth > el.clientWidth + 1) {
      const t = txt(el); const numeric = /\d/.test(t) && /(Rp|\d[.,]\d|%)/.test(t);
      add(numeric ? 'clipped-number' : 'clipped-text', t.slice(0, 60), el);
    }
  });

  // 7. Intro text stacking & repeated titles
  const h1 = main.querySelector('h1');
  if (h1) {
    const firstCard = main.querySelector('.glass-card, table');
    const h1r = R(h1); const fcTop = firstCard ? R(firstCard).top : Infinity;
    const intros = all('p, div').filter((el) => el.children.length === 0 && /muted-foreground/.test(el.className || '') && txt(el).length > 45 && R(el).top > h1r.bottom - 2 && R(el).bottom < fcTop + 2);
    if (intros.length >= 2) add('intro-stacking', `${intros.length} kalimat pengantar sebelum konten: ${intros.map((e) => txt(e).slice(0, 50)).join(' || ')}`, intros[1]);
    const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const h1t = norm(txt(h1));
    const active = main.querySelector('[role=tab][data-state=active]');
    const heads = all('h2, h3').map((h) => norm(txt(h)));
    if (active && norm(txt(active)) === h1t && heads.includes(h1t)) add('title-repeat', `"${txt(h1)}" muncul sebagai judul halaman, tab aktif, dan judul kartu`, h1);
    else if (heads.filter((h) => h === h1t).length) add('title-repeat', `"${txt(h1)}" diulang sebagai judul kartu/bagian`, h1);
  }

  // 8. Competing primary CTAs (filled primary buttons)
  const prim = all('button, a').filter((b) => /\bbg-primary\b/.test(b.className || '') && txt(b).length > 1);
  if (prim.length >= 3) add('many-primary', `${prim.length} tombol utama terlihat: ${prim.map(txt).slice(0, 6).join(' · ')}`, prim[2]);

  // 9. Terminology mix on one page (English vs Indonesian for the same concept)
  const PAIRS = [['approved', 'disetujui'], ['paid', 'dibayar'], ['rejected', 'ditolak'], ['cancelled', 'dibatalkan'], ['submitted', 'diajukan'],
    ['pending', 'menunggu'], ['completed', 'selesai'], ['active', 'aktif'], ['received', 'diterima'], ['overdue', 'jatuh tempo'], ['outstanding', 'belum dibayar']];
  const labels = all('[data-testid=kpi-card-label], [role=tab], [data-status], th, h2, h3, label').map((e) => txt(e).toLowerCase());
  PAIRS.forEach(([en, id]) => {
    const hasEn = labels.some((l) => new RegExp(`\\b${en}\\b`).test(l)); const hasId = labels.some((l) => l.includes(id));
    if (hasEn && hasId) add('term-mix', `"${en}" dan "${id}" dipakai bersamaan untuk konsep yang sama`, null);
  });

  // 10. Money left-aligned in tables
  const leftMoney = all('td').filter((td) => /^-?\s*Rp/.test(txt(td)) && ['left', 'start'].includes(getComputedStyle(td).textAlign));
  if (leftMoney.length >= 2) add('money-left', `${leftMoney.length} sel nominal rata kiri`, leftMoney[0]);

  // 11. Horizontal overflow
  if (document.documentElement.scrollWidth > window.innerWidth + 2) add('page-h-overflow', `lebar halaman ${document.documentElement.scrollWidth}px > ${window.innerWidth}px`, null);
  all('table').forEach((t) => { const sc = t.parentElement; if (sc && sc.scrollWidth > sc.clientWidth + 4) add('table-h-scroll', `tabel ${t.querySelectorAll('thead th').length} kolom butuh scroll horizontal (${sc.scrollWidth}px > ${sc.clientWidth}px)`, t); });

  // 12. Overlapping interactive elements
  const inter = all('button, a, input, [role=combobox]').slice(0, 300);
  for (let i = 0; i < inter.length; i++) for (let j = i + 1; j < inter.length; j++) {
    const a = inter[i], b = inter[j]; if (a.contains(b) || b.contains(a)) continue;
    // tombol overlay sengaja (absolute inset-0, mis. header fase yang bisa diklik) bukan tumpang tindih
    if ([a, b].some((x) => /\babsolute\b.*\binset-0\b|\binset-0\b.*\babsolute\b/.test(x.className || ''))) continue;
    const ra = R(a), rb = R(b); const ix = Math.max(0, Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left)); const iy = Math.max(0, Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top));
    const area = ix * iy; const small = Math.min(ra.width * ra.height, rb.width * rb.height);
    if (small > 0 && area / small > 0.3) { add('overlap', `${(txt(a) || a.getAttribute('aria-label') || a.tagName).slice(0, 20)} ⟂ ${(txt(b) || b.getAttribute('aria-label') || b.tagName).slice(0, 20)}`, a); break; }
  }

  // 13. Duplicate controls (same label twice in view)
  const btnTexts = all('button, a[role=button], a[class*="inline-flex"]').map((b) => txt(b)).filter((t) => t.length > 2 && t.length < 30 && !/^\d/.test(t));
  const dup = Object.entries(btnTexts.reduce((m, t) => ((m[t] = (m[t] || 0) + 1), m), {})).filter(([t, n]) => n >= 2 && /muat ulang|refresh|ekspor|export|filter|tambah|baru|simpan|cari/i.test(t));
  dup.forEach(([t, n]) => add('duplicate-control', `"${t}" muncul ${n}x di layar yang sama`, null));

  // 14. Narrow wrapped table columns
  const tables = all('table');
  tables.forEach((t) => {
    const wrapped = [...t.querySelectorAll('tbody tr:first-child td, tbody tr:nth-child(2) td')].filter(vis).filter((td) => {
      const lh = parseFloat(getComputedStyle(td).lineHeight) || 20; const inner = td.firstElementChild || td;
      return R(td).width < 150 && R(inner).height > lh * 1.9 && txt(td).length > 8;
    });
    if (wrapped.length >= 2) add('narrow-columns', `${wrapped.length} sel terlipat di kolom sempit (<150px): ${wrapped.slice(0, 3).map((w) => txt(w).slice(0, 20)).join(' · ')}`, t);
  });

  // 15. Page header: actions dropped onto their own row (long subtitle + flex-wrap)
  if (h1) {
    const row = h1.closest('.justify-between');
    const slot = row && row.children.length > 1 ? row.lastElementChild : null;
    if (slot && !slot.contains(h1) && vis(slot) && R(slot).top > R(h1).bottom - 2) add('header-actions-wrap', `aksi header turun ke baris sendiri: ${all('button, a', slot).map(txt).filter(Boolean).slice(0, 4).join(' · ')}`, slot);
  }

  // 16. Vertical rhythm of the main column (gaps between top-level blocks)
  const col = main.querySelector('[data-testid$="-page"], [data-testid$="-hub"], [data-testid*="portal"] > div') || main.firstElementChild;
  const blocks = col ? [...col.children].filter(vis) : [];
  const gaps = []; for (let i = 1; i < blocks.length; i++) gaps.push(Math.round(R(blocks[i]).top - R(blocks[i - 1]).bottom));
  const g = gaps.filter((x) => x >= 0 && x < 80);
  if (g.length >= 3 && Math.max(...g) - Math.min(...g) >= 12) add('rhythm', `jarak antar blok tidak konsisten: ${g.join(', ')}px`, col);

  // cross-page placement facts
  const facts = {};
  const search = all('input[placeholder^="Cari"], input[type=search]')[0];
  if (search) { const sr = R(search), mr = R(main); facts.search_side = (sr.left + sr.width / 2) < (mr.left + mr.width / 2) ? 'kiri' : 'kanan'; facts.search_in_card = !!search.closest('.glass-card'); }
  const create = all('button, a').find((b) => /^(\+\s*)?(tambah|buat|baru|new)\b|\bbaru$/i.test(txt(b)));
  if (create) facts.create_zone = create.closest('[data-testid*="header"], [data-testid*="page-header"]') ? 'header' : create.closest('.glass-card') ? 'kartu' : 'lainnya';
  return { findings: F, facts, h: document.documentElement.scrollHeight };
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.request.post(BASE + '/api/auth/login', { data: { email: process.env.UI_EMAIL || 'admin@fnbgroup.id', password: process.env.UI_PASSWORD || 'Demo@2026' } });
  const page = await ctx.newPage();
  const results = []; const seen = new Set();
  const safe = (s) => s.replace(/[^a-z0-9]+/gi, '_').slice(0, 80);
  const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
  for (const rt of routes.filter((r, i) => (only ? only.test(r.route) : i % +shardCnt === +shardIdx))) {
    let url = rt.route;
    if (url.includes(':')) { const v = params[url]; if (!v) continue; url = url.replace(/:[A-Za-z]+/, v); }
    if (url.startsWith('/loyalty') || ['/login', '/no-access', '/erp', '/portal-select', '/master'].includes(url)) continue;
    try {
      await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {}); await page.waitForTimeout(700);
      const finalUrl = page.url().replace(BASE, '');
      if (seen.has(finalUrl) || finalUrl.startsWith('/no-access')) continue; seen.add(finalUrl);
      const rec = { route: rt.route, url: finalUrl, states: [] };
      const snap = async (state) => {
        const a = await page.evaluate(analyze);
        let shot = null;
        if (a.findings.length) { shot = `${safe(finalUrl)}__${safe(state)}.png`; await page.screenshot({ path: path.join(shotDir, shot), fullPage: true }).catch(() => {}); }
        rec.states.push({ state, shot, ...a });
      };
      await snap('page');
      const tabs = await page.locator('main [role=tablist]').first().locator('[role=tab]').all().catch(() => []);
      for (const t of tabs.slice(1, 9)) {
        const name = ((await t.textContent().catch(() => '')) || '').trim().slice(0, 30);
        try { await t.click({ timeout: 3000 }); await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {}); await page.waitForTimeout(400); await snap(`tab:${name}`); } catch (e) { /* skip */ }
      }
      results.push(rec);
    } catch (e) { results.push({ route: rt.route, url, error: String(e).slice(0, 120) }); }
  }
  fs.writeFileSync(outFile, JSON.stringify(results));
  await browser.close();
  console.log('done', outFile, results.length);
})();
