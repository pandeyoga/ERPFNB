// Page-anatomy crawler: every route (+ first-level tabs) → kerangka halaman untuk audit "anatomi halaman":
//   - outline   : urutan blok utama (header, tab, judul bagian, kartu & jenisnya, grid kartu)
//   - titles    : judul bagian/kartu — di luar kartu, di atas kartu, atau di tengah kartu
//   - cards     : jenis isi kartu (kpi/table/chart/toolbar/form/content), judul, kedalaman bingkai
//   - frames    : bingkai bertingkat (kartu + kotak berborder + TabsList) → kedalaman maksimum
//   - actions   : tombol aksi + zona letaknya (page-header, tab-row, intro-row, section-title, card-top, …)
//   - form      : field yang bisa diedit + posisi tombol simpan (di atas/bawah form, sticky, terlihat awal)
//   - kpiGroups : grup KPI (jumlah, kolom, berjudul atau tidak)
//   - strings   : teks UI per jenis (label, th, tab, tombol, judul, status, placeholder) untuk audit bahasa
// usage: node anatomy.js <outFile> <shotDir|-> [shardIdx=0] [shardCnt=1]   (env ONLY=<regex route>)
// env: UI_BASE (default http://localhost:3000), UI_EMAIL / UI_PASSWORD (default demo super admin)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.UI_BASE || 'http://localhost:3000';
const [, , outFile, shotDir = '-', shardIdx = '0', shardCnt = '1'] = process.argv;
const routes = JSON.parse(fs.readFileSync(path.join(__dirname, 'routes.json')));
const paramsFile = path.join(__dirname, 'params.json');
const params = fs.existsSync(paramsFile) ? JSON.parse(fs.readFileSync(paramsFile)) : {};
if (shotDir !== '-') fs.mkdirSync(shotDir, { recursive: true });

function anatomy() {
  const main = document.querySelector('main') || document.body;
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; };
  const R = (el) => el.getBoundingClientRect();
  const Y = (el) => Math.round(R(el).top + window.scrollY);
  const txt = (el) => (el.textContent || '').trim().replace(/\s+/g, ' ');
  const own = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').trim();
  const tid = (el) => (el && el.closest && el.closest('[data-testid]')?.dataset.testid) || '';
  const CARD = '.glass-card, .glass-card-hover';
  const cardOf = (el) => el.parentElement && el.parentElement.closest(CARD);
  const all = (sel, root = main) => [...root.querySelectorAll(sel)].filter(vis).filter((e) => !e.closest('[role=dialog]'));
  const sameRow = (a, b) => { const ra = R(a), rb = R(b); return Math.abs((ra.top + ra.height / 2) - (rb.top + rb.height / 2)) < 16; };
  const h1 = main.querySelector('h1');
  const header = h1 ? (h1.closest('[data-testid=page-header]') || h1.closest('.justify-between')?.parentElement || null) : null;

  // ---- titles --------------------------------------------------------------------------------------
  const isTitle = (el) => {
    if (el === h1 || (header && header.contains(el))) return false;
    if (el.closest('table, button, a, [role=tab], [role=tablist], label, [data-status], [role=combobox], select, [data-testid=kpi-card-label], [data-testid=kpi-card-value]')) return false;
    const t = txt(el); if (t.length < 2 || t.length > 70 || /^(Rp|[-+−]?\d)/.test(t)) return false;
    const cs = getComputedStyle(el); const fs = parseFloat(cs.fontSize); const fw = +cs.fontWeight;
    if (/^H[2-4]$/.test(el.tagName)) return fs >= 14 && fw >= 500;
    return fw >= 600 && fs >= 15.5 && own(el).length >= 2;
  };
  const cand = all('h2, h3, h4, div, span, p').filter(isTitle);
  const T = cand.filter((t) => !cand.some((o) => o !== t && t.contains(o)));
  const titlePos = (t) => { const c = t.closest(CARD); if (!c) return 'outside'; return R(t).top - R(c).top < 56 ? 'card-top' : 'card-inner'; };
  const titles = T.map((t) => ({ text: txt(t).slice(0, 60), tag: t.tagName, fs: Math.round(parseFloat(getComputedStyle(t).fontSize)),
    pos: titlePos(t), flat: !!t.closest('.nested-cards'), y: Y(t), card: tid(t.closest(CARD)) }));

  // ---- cards ---------------------------------------------------------------------------------------
  const textLen = (root) => { let n = 0; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) { const p = w.currentNode.parentElement; if (!p || p.closest('button, [role=tab], [role=combobox], select, option, label')) continue; n += w.currentNode.textContent.trim().length; } return n; };
  // Filter/toolbar = kontrol yang mengubah tampilan (periode, outlet, status, cari, …), bukan field data.
  const FILTER_RE = /^(semua|all)\b|periode|period|outlet|brand|status|scope|level|tanggal|dari|sampai|bulan|tahun|filter|tampilan|cari|search|tipe|jenis|kategori|vendor|akun/i;
  const isFilter = (c) => [...c.querySelectorAll('label, [role=combobox], input[placeholder], button')].filter(vis)
    .some((e) => FILTER_RE.test((e.getAttribute('placeholder') || txt(e) || '').trim()));
  const cardKind = (c) => {
    if (c.querySelector('[data-testid=kpi-card-label]') && R(c).height < 140) return 'kpi';
    if ([...c.querySelectorAll('table')].some(vis)) return 'table';
    if (c.querySelector('svg.recharts-surface, canvas')) return 'chart';
    const ctrls = [...c.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), [role=combobox], select, textarea, [role=tablist]')].filter(vis).length;
    const tl = textLen(c);
    if (ctrls >= 1 && tl < 60 && !c.querySelector(CARD) && isFilter(c)) return 'toolbar';
    if ([...c.querySelectorAll('button, a')].filter(vis).length >= 3 && tl < 60 && !ctrls) return 'nav-list';
    if (ctrls >= 3 || (ctrls >= 1 && tl < 120)) return 'form';
    if (tl < 120 && !c.querySelector(CARD)) return 'note';
    return 'content';
  };
  const cardEls = all(CARD);
  const cards = cardEls.map((c) => {
    let depth = 0; for (let p = c.parentElement; p; p = p.parentElement) if (p.matches && p.matches(CARD)) depth++;
    const titled = T.some((t) => c.contains(t) && t.closest(CARD) === c && R(t).top - R(c).top < 56);
    return { testid: c.dataset.testid || tid(c), kind: cardKind(c), titled, depth, flat: !!c.closest('.nested-cards'),
      y: Y(c), x: Math.round(R(c).left), w: Math.round(R(c).width), h: Math.round(R(c).height) };
  });

  // ---- frames (cards, bordered boxes, bordered tab lists) → nesting depth ---------------------------------
  const isFrame = (el) => {
    if (el.matches(CARD)) return true;
    if (el.matches('button, input, select, textarea, table, td, th, tr, [data-status], [role=combobox], img, svg, label') || el.closest('table')) return false;
    const r = R(el); if (r.width < 120 || r.height < 36) return false;
    const cs = getComputedStyle(el);
    const b = ['Top', 'Right', 'Bottom', 'Left'].every((s) => parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== 'none');
    const bg = cs.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor);
    return (b && parseFloat(cs.borderTopLeftRadius) >= 6) || (bg && parseFloat(cs.borderTopLeftRadius) >= 8 && !el.matches('[role=tab]'));
  };
  const frameEls = all('div, section, form, fieldset, details').filter(isFrame);
  let maxFrame = 0; const deepFrames = [];
  frameEls.forEach((f) => {
    let d = 1; for (let p = f.parentElement; p && p !== main; p = p.parentElement) if (frameEls.includes(p)) d++;
    if (d > maxFrame) maxFrame = d;
    if (d >= 3 && !frameEls.some((o) => o !== f && f.contains(o))) deepFrames.push({ depth: d, testid: tid(f), text: txt(f).slice(0, 40) });
  });

  // ---- actions -------------------------------------------------------------------------------------
  const hubTabs = (() => { const t = all('[role=tablist]')[0]; return t && !t.closest(CARD) && (!header || R(t).top - R(header).bottom < 40) ? t : null; })();
  const kindOf = (t) => (/^(\+\s*)?(buat|tambah|new|create)\b|\bbaru\b/i.test(t) ? 'create'
    : /^(simpan|save|submit|ajukan|terapkan|perbarui|update)\b/i.test(t) ? 'save'
      : /(ekspor|export|unduh|download|\bpdf\b|\bcsv\b|excel|cetak|print)/i.test(t) ? 'export'
        : /(muat ulang|refresh|reload)/i.test(t) ? 'refresh'
          : /(^lihat|^buka|kembali|detail|→)/i.test(t) ? 'nav' : 'other');
  const stickyOf = (el) => { for (let p = el; p && p !== document.body; p = p.parentElement) { const ps = getComputedStyle(p).position; if (ps === 'sticky' || ps === 'fixed') return true; } return false; };
  const btnEls = all('button, a').filter((b) => {
    if (b.closest('[role=tablist], table, [role=menu], [role=listbox], nav, aside')) return false;
    const role = b.getAttribute('role'); if (role && ['tab', 'combobox', 'checkbox', 'switch', 'radio', 'option', 'menuitem'].includes(role)) return false;
    if (/^Bantuan/.test(b.getAttribute('aria-label') || '') || b.hasAttribute('aria-pressed') || b.hasAttribute('aria-expanded') && !txt(b)) return false;
    const c = typeof b.className === 'string' ? b.className : '';
    return /\bh-(8|9|10)\b|\binline-flex\b[^"]*\bjustify-center\b/.test(c) && (txt(b).length > 1 || b.getAttribute('aria-label'));
  });
  const intros = all('p, div').filter((p) => !p.closest(CARD) && p.children.length === 0 && /muted-foreground/.test(p.className || '') && txt(p).length > 30 && !(header && header.contains(p)));
  const zoneOf = (b) => {
    if (header && header.contains(b)) return 'page-header';
    if (hubTabs && sameRow(b, hubTabs)) return 'tab-row';
    const c = b.closest(CARD);
    if (!c) {
      if (T.some((t) => !t.closest(CARD) && sameRow(b, t))) return 'section-title';
      if (intros.some((p) => sameRow(b, p))) return 'intro-row';
      return 'loose';
    }
    if (cardKind(c) === 'toolbar') return 'filter-card';
    const cr = R(c), br = R(b);
    if (br.top - cr.top < 64) return 'card-top';
    if (cr.bottom - br.bottom < 56) return 'card-bottom';
    return 'card-body';
  };
  const actions = btnEls.map((b) => { const t = txt(b) || b.getAttribute('aria-label') || ''; const c = typeof b.className === 'string' ? b.className : '';
    return { label: t.slice(0, 40), kind: kindOf(t), zone: zoneOf(b), primary: /\bbg-primary\b/.test(c), sticky: stickyOf(b), y: Y(b), x: Math.round(R(b).left) }; });

  // ---- editable form & save placement ---------------------------------------------------------------------
  const fields = all('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=search]), textarea, [role=combobox], select')
    .filter((f) => !/^cari/i.test(f.getAttribute('placeholder') || '') && !(f.closest(CARD) && cardKind(f.closest(CARD)) === 'toolbar') && !f.disabled);
  let form = null;
  if (fields.length >= 4) {
    const ys = fields.map((f) => [Y(f), Y(f) + R(f).height]);
    const first = Math.min(...ys.map((v) => v[0])); const last = Math.max(...ys.map((v) => v[1]));
    const saves = actions.filter((a) => a.kind === 'save').map((a) => ({ ...a, where: a.y < first ? 'above' : a.y > last ? 'below' : 'between', visibleAtLoad: a.y < window.innerHeight }));
    form = { fields: fields.length, first, last, docH: Math.max(main.scrollHeight, document.documentElement.scrollHeight), viewH: window.innerHeight, saves,
      dirtyHint: /belum disimpan|perubahan belum|unsaved/i.test(main.textContent || '') };
  }

  // ---- KPI groups ------------------------------------------------------------------------------------
  const kpiCards = [...new Set(all('[data-testid=kpi-card-label]').map((l) => l.closest(CARD)).filter(Boolean))];
  const kpiGroups = [...new Set(kpiCards.map((k) => k.parentElement))].map((g) => {
    const kids = [...g.children].filter(vis); const gr = R(g);
    const cols = kids.filter((k) => Math.abs(R(k).top - R(kids[0]).top) < 4).length;
    const t = T.find((x) => { const r = R(x); return r.bottom <= gr.top + 2 && gr.top - r.bottom < 48 && r.left < gr.right && r.right > gr.left; });
    return { n: kids.length, cols, titled: !!t, title: t ? txt(t).slice(0, 40) : '', y: Y(g), inCard: !!cardOf(g) };
  });

  // ---- outline (skeleton of main column) -----------------------------------------------------------------
  const describe = (el, depth) => {
    if (el === header) return ['HEADER' + (header.querySelectorAll('button, a').length ? '+actions' : '')];
    if (el.matches(CARD)) return [`CARD:${cardKind(el)}${T.some((t) => t.closest(CARD) === el && R(t).top - R(el).top < 56) ? '' : '(untitled)'}`];
    if (el.matches('[role=tablist]') || (el.querySelector(':scope > [role=tablist]') && !el.querySelector(CARD))) return [el === hubTabs || el.contains(hubTabs) ? 'HUB-TABS' : 'TABS'];
    if (T.includes(el)) return [`TITLE:${txt(el).slice(0, 30)}`];
    const kidCards = [...el.children].filter((k) => vis(k) && k.matches(CARD));
    if (kidCards.length >= 2 && kidCards.length === [...el.children].filter(vis).length) return [`GRID[${kidCards.length}]:${[...new Set(kidCards.map(cardKind))].join('/')}`];
    if (intros.includes(el)) return ['INTRO'];
    const kids = [...el.children].filter(vis);
    if (!kids.length) return txt(el) ? [`TEXT:${txt(el).slice(0, 24)}`] : [];
    if (depth >= 9) return [`BLOCK:${tid(el) || el.tagName}`];
    if (kids.every((k) => k.matches('button, a')) ) return [`ACTIONS:${kids.map((k) => txt(k).slice(0, 16)).join('|')}`];
    return kids.flatMap((k) => describe(k, depth + 1));
  };
  const outline = [...main.children].filter(vis).flatMap((k) => describe(k, 0)).slice(0, 40);

  // ---- UI strings for the language audit ---------------------------------------------------------------
  const S = new Set(); const push = (kind, t) => { t = (t || '').trim().replace(/\s+/g, ' '); if (t && t.length <= 90) S.add(`${kind}\t${t}`); };
  if (h1) push('h1', txt(h1));
  if (header) header.querySelectorAll('p').forEach((p) => push('subtitle', txt(p)));
  all('label').forEach((e) => push('label', txt(e)));
  all('th').forEach((e) => push('th', txt(e)));
  all('[role=tab]').forEach((e) => push('tab', txt(e)));
  btnEls.forEach((e) => push('button', txt(e)));
  all('[data-testid=kpi-card-label]').forEach((e) => push('kpi', txt(e)));
  T.forEach((e) => push('title', txt(e)));
  all('[data-status]').forEach((e) => push('status', txt(e)));
  all('[role=combobox]').forEach((e) => push('select', txt(e)));
  all('input[placeholder], textarea[placeholder]').forEach((e) => push('placeholder', e.getAttribute('placeholder')));
  intros.forEach((e) => push('intro', txt(e)));

  return { outline, titles, cards, maxFrame, deepFrames: deepFrames.slice(0, 8), actions, form, kpiGroups, strings: [...S],
    hasHubTabs: !!hubTabs, docH: Math.max(main.scrollHeight, document.documentElement.scrollHeight) };
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
        const a = await page.evaluate(anatomy);
        let shot = null;
        if (shotDir !== '-') { shot = `${safe(finalUrl)}__${safe(state)}.jpg`; await page.screenshot({ path: path.join(shotDir, shot), type: 'jpeg', quality: 60, fullPage: true }).catch(() => {}); }
        rec.states.push({ state, shot, ...a });
      };
      await snap('page');
      const tabs = await page.locator('main [role=tablist]').first().locator('[role=tab]').all().catch(() => []);
      for (const t of tabs.slice(1, 10)) {
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
