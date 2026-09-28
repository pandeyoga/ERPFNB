#!/usr/bin/env python3
"""
audit_ui_ia.py — UI density + Information-Architecture linter (READ-ONLY).

Mencegah UI-RC (lihat UI_IA_PARITY_GUARDRAILS.md):
  - IA bloat: terlalu banyak item sidebar per portal (target <= 12)
  - Single-item section (parent + 1 anak) -> harus di-flatten
  - Density: kelas "oversized" yang dilarang di halaman (text-3xl, p-5/p-6, gap-6/8, py-8, w-[280px])
  - Discoverability: route yang tidak ada di sidebar nav (selain tab/detail/new)

CARA PAKAI:
  python3 /app/scripts/audit_ui_ia.py
  python3 /app/scripts/audit_ui_ia.py --strict   # exit 1 jika ada portal > MAX_ITEMS

Catatan: heuristik. Gunakan sebagai gate review, bukan kebenaran absolut.
"""
import re, glob, os, sys, collections

FE = '/app/frontend/src'
NAV_DIR = f'{FE}/lib/navigationSchema'
MAX_ITEMS = 12
STRICT = '--strict' in sys.argv

BANNED_CLASSES = ['text-3xl', 'text-4xl', 'text-[28px]', 'text-[30px]',
                  'p-5', 'p-6', 'gap-6', 'gap-8', 'py-8', 'w-[280px]', 'w-[300px]']

def extract_items_blocks(src):
    """Return list of item-arrays (each a string) for every `items: [ ... ]`."""
    blocks = []
    for m in re.finditer(r'items\s*:\s*\[', src):
        i = m.end() - 1  # at '['
        depth = 0
        for j in range(i, len(src)):
            if src[j] == '[': depth += 1
            elif src[j] == ']':
                depth -= 1
                if depth == 0:
                    blocks.append(src[i+1:j]); break
    return blocks

print("== IA: jumlah item sidebar per portal (target <= %d) ==" % MAX_ITEMS)
violations = []
for f in sorted(glob.glob(f'{NAV_DIR}/*.js')):
    portal = os.path.basename(f)[:-3]
    src = open(f, errors='ignore').read()
    blocks = extract_items_blocks(src)
    total = 0; single = 0
    for b in blocks:
        n = len(re.findall(r'path\s*:', b))
        total += n
        if n == 1: single += 1
    flag = ' <== REVIEW (>%d)' % MAX_ITEMS if total > MAX_ITEMS else ''
    if total > MAX_ITEMS: violations.append(portal)
    print(f"  {portal:14s} sections={len(blocks):2d} leaf_items={total:2d} single_item_sections={single}{flag}")

print("\n== DENSITY: kelas oversized di src/portals (REVIEW) ==")
counter = collections.Counter()
files_hit = collections.Counter()
for f in glob.glob(f'{FE}/portals/**/*.jsx', recursive=True):
    src = open(f, errors='ignore').read()
    for cls in BANNED_CLASSES:
        c = src.count(cls)
        if c:
            counter[cls] += c
            files_hit[os.path.relpath(f, FE)] += c
for cls, c in counter.most_common():
    print(f"  {cls:14s} total={c}")
print("  -- top 10 file dengan kelas oversized --")
for fpath, c in files_hit.most_common(10):
    print(f"     {c:3d}  {fpath}")

print("\n== DISCOVERABILITY: route tanpa item sidebar (non-tab/detail) ==")
route_paths = set()
for f in glob.glob(f'{FE}/portals/**/*.jsx', recursive=True) + [f'{FE}/App.js']:
    src = open(f, errors='ignore').read()
    for mm in re.finditer(r'<Route\s+path=["\']([^"\']+)["\']', src):
        route_paths.add(mm.group(1))
nav_paths = set()
for f in glob.glob(f'{NAV_DIR}/*.js'):
    for mm in re.finditer(r'path:\s*["\']([^"\']+)["\']', open(f, errors='ignore').read()):
        nav_paths.add(mm.group(1).split('?')[0].rstrip('/'))
SKIP_TOK = ('/new', ':', 'login', 'register', 'no-access', 'portal-select', 'erp',
            'about', 'contact', 'careers', 'news', 'menu', 'reservation')
for rp in sorted(route_paths):
    if not rp or rp in ('/', '*'): continue
    if '*' in rp: continue  # wildcard portal routes, not pages
    if any(t in rp for t in SKIP_TOK): continue
    seg = rp.split('?')[0].rstrip('/')
    if not any(np.endswith('/' + seg) or np.endswith(seg) for np in nav_paths):
        # Heuristik: route yang kemungkinan halaman mandiri (bukan tab) -> tinjau
        print(f"   route_review: {rp}")

if STRICT and violations:
    print(f"\nFAIL (strict): portal melebihi {MAX_ITEMS} item: {violations}"); sys.exit(1)
print("\nOK")
