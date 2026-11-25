// Role crawler: login sebagai tiap peran demo → kumpulkan SEMUA link sidebar yang terlihat → buka tiap halaman
// (+ tab tingkat pertama) → catat API 403/5xx, error JS, redirect ke /no-access atau /login, halaman kosong.
// Tujuannya: menu yang tampil untuk sebuah peran harus bisa dipakai peran itu (tidak ada menu "jebakan").
// usage: node roles.js <outFile> [roleKey,…]     (default: semua peran demo)
// env: UI_BASE (default http://localhost:3000), UI_PASSWORD (default Demo@2026)
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.UI_BASE || 'http://localhost:3000';
const PASSWORD = process.env.UI_PASSWORD || 'Demo@2026';
const ROLES = {
  admin: 'admin@fnbgroup.id', executive: 'executive@fnbgroup.id', finance: 'finance@fnbgroup.id',
  procurement: 'procurement@fnbgroup.id', hr_manager: 'hr.manager@fnbgroup.id', hr_officer: 'hr.officer@fnbgroup.id',
  cfs_manager: 'cfs.manager@fnbgroup.id', rst_manager: 'rst.manager@fnbgroup.id', bky_manager: 'bky.manager@fnbgroup.id',
  cfs_area: 'cfs.area@fnbgroup.id', owner: 'owner@fnbgroup.id',
};
const [, , outFile = 'out/roles.json', only] = process.argv;
const keys = only ? only.split(',') : Object.keys(ROLES);

async function collectNav(page) {
  // Accordion sidebar: buka tiap grup modul satu per satu lalu kumpulkan link.
  const hrefs = new Set();
  const grab = async () => (await page.$$eval('[data-testid=sidebar] a[href]', (as) => as.map((a) => a.getAttribute('href')))).forEach((h) => hrefs.add(h));
  await grab();
  const groups = await page.$$('[data-testid^=sidebar-portal-group-]');
  for (const g of groups) { try { await g.click({ timeout: 2000 }); await page.waitForTimeout(250); await grab(); } catch (e) { /* skip */ } }
  return [...hrefs].filter((h) => h && h.startsWith('/') && !h.startsWith('/loyalty'));
}

async function crawlRole(browser, key) {
  const email = ROLES[key];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const login = await ctx.request.post(BASE + '/api/auth/login', { data: { email, password: PASSWORD } });
  if (!login.ok()) { await ctx.close(); return { role: key, email, error: `login ${login.status()}` }; }
  const page = await ctx.newPage();
  let cur = null; // halaman yang sedang dicatat
  const note = (kind, detail) => { if (cur) cur.issues.push({ kind, detail: String(detail).slice(0, 240) }); };
  page.on('response', (r) => {
    const u = r.url(); if (!u.includes('/api/')) return;
    const s = r.status();
    if (s === 403 || s >= 500 || s === 404) note(`api-${s}`, `${r.request().method()} ${u.replace(BASE, '').replace(/^https?:\/\/[^/]+/, '')}`);
  });
  page.on('pageerror', (e) => note('js-error', e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|posthog|unsplash|net::ERR/i.test(m.text())) note('console-error', m.text()); });

  await page.goto(BASE + '/erp', { waitUntil: 'domcontentloaded', timeout: 30000 }); // '/' = website publik
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(800);
  const landing = new URL(page.url()).pathname;
  const nav = await collectNav(page);
  const pages = [];
  for (const href of nav) {
    cur = { href, issues: [], tabs: [] };
    pages.push(cur);
    try {
      await page.goto(BASE + href, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(600);
      const path = new URL(page.url()).pathname;
      if (path === '/no-access') note('no-access', 'menu terlihat tetapi diarahkan ke /no-access');
      else if (path === '/login') note('logged-out', 'diarahkan ke /login');
      cur.landed = path;
      const info = await page.evaluate(() => {
        const main = document.querySelector('main') || document.body;
        const t = (main.innerText || '').trim();
        return {
          h1: (document.querySelector('main h1')?.textContent || '').trim(),
          len: t.length,
          boundary: /Terjadi kesalahan|Something went wrong|Halaman gagal dimuat/i.test(t),
          restricted: /Akses dibatasi|tidak memiliki akses|Tidak ada akses/i.test(t),
          tabs: [...main.querySelectorAll('[role=tablist]:not([data-variant=line]) [role=tab]')].filter((x) => x.offsetParent).map((x) => x.textContent.trim()).slice(0, 12),
        };
      });
      cur.h1 = info.h1;
      if (info.boundary) note('error-state', 'ErrorBoundary/ErrorState tampil');
      if (info.restricted) note('restricted-text', 'teks akses dibatasi tampil');
      if (!info.h1 && path !== '/no-access') note('no-h1', 'tanpa <h1>');
      if (info.len < 40) note('empty', `isi main hanya ${info.len} karakter`);
      // Tab tingkat pertama: tiap tab memanggil API sendiri; 403 di sini = tab terlihat tetapi tidak bisa dipakai.
      for (let i = 1; i < info.tabs.length; i++) {
        const before = cur.issues.length;
        try {
          const tab = page.locator('main [role=tablist]:not([data-variant=line]) [role=tab]').nth(i);
          await tab.click({ timeout: 3000 });
          await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
          await page.waitForTimeout(400);
        } catch (e) { /* skip */ }
        cur.issues.slice(before).forEach((x) => { x.tab = info.tabs[i]; });
        cur.tabs.push(info.tabs[i]);
      }
    } catch (e) { note('nav-error', e.message.split('\n')[0]); }
  }
  cur = null;
  await ctx.close();
  return { role: key, email, landing, navCount: nav.length, pages };
}

(async () => {
  const browser = await chromium.launch();
  const out = [];
  for (const k of keys) {
    const t0 = Date.now();
    const r = await crawlRole(browser, k);
    out.push(r);
    const bad = (r.pages || []).filter((p) => p.issues.length).length;
    console.log(`${k}: ${r.error || `${r.navCount} menu, ${bad} bermasalah`} (${Math.round((Date.now() - t0) / 1000)}s)`);
    fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
  }
  await browser.close();
})();
