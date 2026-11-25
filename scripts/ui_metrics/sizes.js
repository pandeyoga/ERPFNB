// Component size crawler: every route (+ each first-level tab) → computed sizes of UI primitives.
// usage: node sizes.js <outFile> [shardIdx=0] [shardCnt=1] [theme=light|dark]
// env: UI_BASE (default http://localhost:3000), UI_EMAIL / UI_PASSWORD (default demo super admin)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.UI_BASE || 'http://localhost:3000';
const [, , outFile, shardIdx = '0', shardCnt = '1', theme = 'light'] = process.argv;
const routes = JSON.parse(fs.readFileSync(path.join(__dirname, 'routes.json')));
// params.json (opsional): { "/route/:id": "<id contoh>" } — tanpa file ini route berparameter dilewati.
const paramsFile = path.join(__dirname, 'params.json');
const params = fs.existsSync(paramsFile) ? JSON.parse(fs.readFileSync(paramsFile)) : {};

function measure() {
  const scope = [document.querySelector('main') || document.body, ...document.querySelectorAll('[role=dialog]')];
  const vis = (el) => {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05;
  };
  const all = (sel) => [...new Set(scope.flatMap((s) => [...s.querySelectorAll(sel)]))].filter(vis);
  const n = (v) => Math.round(parseFloat(v) * 10) / 10;
  const label = (el) => (el.dataset.testid || el.getAttribute('aria-label') || (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40) || el.tagName.toLowerCase());
  const cls = (el) => (typeof el.className === 'string' ? el.className : el.getAttribute('class') || '').slice(0, 220);
  const box = (el) => { const r = el.getBoundingClientRect(); return { h: n(r.height), w: n(r.width) }; };

  // --- colour helpers (approximate contrast: composite ancestor backgrounds onto body bg) ---
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const over = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  // Body/html are transparent (gradient backdrop) → resolve the --background token as the base colour.
  const probe = document.createElement('div'); probe.style.background = 'hsl(var(--background))'; document.body.appendChild(probe);
  const bodyBg = parse(getComputedStyle(probe).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 }; probe.remove();
  const bgOf = (el) => {
    const chain = []; let e = el;
    while (e && e !== document.documentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) chain.push(c); if (c && c.a >= 1) break; e = e.parentElement; }
    let bg = { ...bodyBg, a: 1 };
    for (let i = chain.length - 1; i >= 0; i--) bg = over(chain[i], bg);
    return bg;
  };

  const out = { buttons: [], inputs: [], tabs: [], cards: [], kpis: [], headings: [], text: {}, small_text: [], contrast: [], th: [], td: [], rows: [], pills: [], icons: {} };

  // Buttons: shadcn Button (or anything sized like one), excluding tabs/comboboxes
  all('button, a').forEach((b) => {
    const c = cls(b); const role = b.getAttribute('role');
    if (['tab', 'combobox', 'checkbox', 'switch', 'radio', 'menuitem', 'option'].includes(role) || b.closest('[role=tablist]') || /glass-card/.test(c)) return;
    const cs = getComputedStyle(b);
    const looksButton = /\bh-(\d|\[)|\bsize-\d|\binline-flex\b.*\bjustify-center\b/.test(c) || cs.borderStyle !== 'none' && parseFloat(cs.borderTopWidth) > 0 && b.tagName === 'BUTTON';
    if (!looksButton) return;
    const t = (b.textContent || '').trim();
    const bb = box(b);
    const al = b.getAttribute('aria-label') || '';
    // Selectable rows/cards implemented as <button> and the "?" help trigger are reported separately.
    const kind = /^Bantuan/.test(al) ? 'help' : /underline-offset-4/.test(c) ? 'link' : (bb.h > 48 || /\btext-left\b|\bw-full\b/.test(c)) ? 'option' : t ? 'text' : 'icon';
    out.buttons.push({ id: label(b), kind, h: bb.h, w: bb.w, fs: n(cs.fontSize), fw: cs.fontWeight, pl: n(cs.paddingLeft), rad: n(cs.borderTopLeftRadius), cls: c });
  });
  all('input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file]):not([type=range]), button[role=combobox], select').forEach((i) => {
    const cs = getComputedStyle(i);
    out.inputs.push({ id: label(i), tag: i.tagName.toLowerCase() + (i.type ? ':' + i.type : ''), h: box(i).h, fs: n(cs.fontSize), rad: n(cs.borderTopLeftRadius), cls: cls(i) });
  });
  all('[role=tab]').forEach((t) => { const cs = getComputedStyle(t); out.tabs.push({ id: label(t), h: box(t).h, fs: n(cs.fontSize), cls: cls(t) }); });
  all('.glass-card, .glass-card-hover').forEach((c) => {
    const cs = getComputedStyle(c);
    const parent = c.parentElement && c.parentElement.closest('.glass-card, .glass-card-hover');
    const flat = !!c.closest('.nested-cards');
    const title = c.querySelector('h2, h3');
    out.cards.push({ id: label(c).slice(0, 30), pt: n(cs.paddingTop), pl: n(cs.paddingLeft), rad: n(cs.borderTopLeftRadius), nested: !!parent && !flat, h: box(c).h,
      title_fs: title && title.closest('.glass-card, .glass-card-hover') === c ? n(getComputedStyle(title).fontSize) : null, cls: cls(c) });
  });
  [...new Set(all('[data-testid=kpi-card-label]').map((l) => l.closest('.glass-card, .glass-card-hover') || l.parentElement))]
    .forEach((k) => out.kpis.push({ id: (k.querySelector('[data-testid=kpi-card-label]')?.textContent || '').trim().slice(0, 30), h: box(k).h, pt: n(getComputedStyle(k).paddingTop) }));
  all('h1, h2, h3, h4').forEach((h) => { const cs = getComputedStyle(h); out.headings.push({ tag: h.tagName, id: label(h).slice(0, 40), fs: n(cs.fontSize), fw: cs.fontWeight }); });

  // Text: every element that directly owns visible text
  const texty = all('*').filter((e) => [...e.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim().length > 1));
  texty.forEach((e) => {
    const cs = getComputedStyle(e); const fsz = n(cs.fontSize); out.text[fsz] = (out.text[fsz] || 0) + 1;
    const upper = cs.textTransform === 'uppercase';
    if (fsz < 11 || (fsz < 12 && !upper && !e.closest('[data-status], .badge'))) out.small_text.push({ fs: fsz, upper, id: (e.textContent || '').trim().slice(0, 40), cls: cls(e) });
    if (out.contrast.length < 400) {
      const fg = parse(cs.color); if (!fg) return;
      const bg = bgOf(e); const fgc = fg.a < 1 ? over(fg, bg) : fg; const r = ratio(fgc, bg);
      const large = fsz >= 24 || (fsz >= 18.6 && +cs.fontWeight >= 700);
      if (r < (large ? 3 : 4.5)) out.contrast.push({ r: Math.round(r * 100) / 100, fs: fsz, id: (e.textContent || '').trim().slice(0, 40), color: cs.color, cls: cls(e) });
    }
  });
  all('table thead th').slice(0, 40).forEach((th) => { const cs = getComputedStyle(th); out.th.push({ fs: n(cs.fontSize), pt: n(cs.paddingTop), pl: n(cs.paddingLeft), h: box(th).h }); });
  all('table tbody td').slice(0, 80).forEach((td) => { const cs = getComputedStyle(td); out.td.push({ fs: n(cs.fontSize), pt: n(cs.paddingTop), pl: n(cs.paddingLeft) }); });
  all('table tbody tr').slice(0, 30).forEach((tr) => out.rows.push(box(tr).h));
  all('[data-status]').forEach((p) => { const cs = getComputedStyle(p); out.pills.push({ h: box(p).h, fs: n(cs.fontSize), rad: n(cs.borderTopLeftRadius) }); });
  all('button svg, a svg').forEach((s) => { const w = n(s.getBoundingClientRect().width); out.icons[w] = (out.icons[w] || 0) + 1; });
  return out;
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const lr = await ctx.request.post(BASE + '/api/auth/login', { data: { email: process.env.UI_EMAIL || 'admin@fnbgroup.id', password: process.env.UI_PASSWORD || 'Demo@2026' } });
  if (!lr.ok()) { console.error('login gagal', lr.status()); process.exit(1); }
  if (theme === 'dark') await ctx.addInitScript(() => { try { localStorage.setItem('aurora_theme', 'dark'); } catch (e) {} document.documentElement.classList.add('dark'); });
  const page = await ctx.newPage();
  const results = []; const seen = new Set();
  const mine = routes.filter((_, i) => i % +shardCnt === +shardIdx);
  for (const rt of mine) {
    let url = rt.route;
    if (url.includes(':')) { const v = params[url]; if (!v) continue; url = url.replace(/:[A-Za-z]+/, v); }
    if (url.startsWith('/loyalty') || ['/login', '/no-access', '/erp', '/portal-select', '/master'].includes(url)) continue;
    try {
      await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(600);
      if (theme === 'dark') await page.evaluate(() => document.documentElement.classList.add('dark'));
      const finalUrl = page.url().replace(BASE, '');
      if (seen.has(finalUrl) || finalUrl.startsWith('/no-access')) continue;
      seen.add(finalUrl);
      const rec = { route: rt.route, url: finalUrl, states: [{ state: 'page', m: await page.evaluate(measure) }] };
      const tabs = await page.locator('main [role=tablist]').first().locator('[role=tab]').all().catch(() => []);
      for (const t of tabs.slice(1, 8)) {
        const name = ((await t.textContent().catch(() => '')) || '').trim().slice(0, 30);
        try { await t.click({ timeout: 3000 }); await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {}); await page.waitForTimeout(400);
          rec.states.push({ state: `tab:${name}`, m: await page.evaluate(measure) }); } catch (e) { /* tab not clickable */ }
      }
      results.push(rec);
    } catch (e) { results.push({ route: rt.route, url, error: String(e).slice(0, 120) }); }
  }
  fs.writeFileSync(outFile, JSON.stringify(results));
  await browser.close();
  console.log('done', outFile, results.length);
})();
