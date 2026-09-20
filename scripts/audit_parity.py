#!/usr/bin/env python3
"""
audit_parity.py — Backend <-> Frontend feature parity checker (READ-ONLY).

Tujuan: mencegah PAR-RC (lihat UI_IA_PARITY_GUARDRAILS.md):
  - Fitur backend yang belum ada UI (endpoint tanpa referensi frontend)
  - Endpoint usang/duplikat (drift)

CARA PAKAI:
  python3 /app/scripts/audit_parity.py
  python3 /app/scripts/audit_parity.py --strict   # exit 1 jika ada ORPHAN MODULE

Catatan: panggilan frontend yang dibangun dinamis (hook/variabel) TIDAK selalu
terdeteksi -> tool ini ADALAH "review prompt", bukan hard-gate untuk endpoint-level.
Yang dapat dipercaya sebagai hard-gate hanyalah "ORPHAN MODULE" (prefix 0 referensi).
"""
import re, os, glob, collections, sys

BACKEND_ROUTERS = glob.glob('/app/backend/routers/*.py')
FRONTEND_SRC = '/app/frontend/src'
STRICT = '--strict' in sys.argv

def norm(p):
    if not p: return '/'
    p = p.split('?')[0].split('#')[0]
    p = re.sub(r'\$\{[^}]*\}', '{}', p)
    p = re.sub(r'\{[^}]+\}', '{}', p)
    p = re.sub(r':[A-Za-z_][A-Za-z0-9_]*', '{}', p)
    if p.startswith('/api'): p = p[4:] or '/'
    if len(p) > 1 and p.endswith('/'): p = p[:-1]
    return p

backend, router_prefix = [], {}
for f in BACKEND_ROUTERS:
    src = open(f).read()
    m = re.search(r'APIRouter\(([^)]*)\)', src, re.S)
    prefix = ''
    if m:
        pm = re.search(r'prefix\s*=\s*["\']([^"\']+)["\']', m.group(1))
        if pm: prefix = pm.group(1)
    router_prefix[f] = prefix
    for dm in re.finditer(r'@\w+\.(get|post|put|patch|delete)\(\s*["\']([^"\']*)["\']', src):
        method, path = dm.group(1), dm.group(2)
        full = (prefix + path) if not path.startswith('/api') else path
        backend.append((method.upper(), norm(full), os.path.basename(f)))

fe = set()
for root, _, files in os.walk(FRONTEND_SRC):
    for fn in files:
        if not fn.endswith(('.js', '.jsx')): continue
        src = open(os.path.join(root, fn), errors='ignore').read()
        for mm in re.finditer(r'[`\'"](/[A-Za-z0-9_\-/${}:.]+)[`\'"]', src):
            fe.add(norm(mm.group(1)))
        for mm in re.finditer(r'API_(?:URL|BASE)\}(/[A-Za-z0-9_\-/${}:.]+)', src):
            fe.add(norm(mm.group(1)))

prefixes = sorted({norm(p) for p in router_prefix.values() if p}, key=len, reverse=True)
hits = collections.Counter(); epc = collections.Counter()
for x in fe:
    for pre in prefixes:
        if x == pre or x.startswith(pre + '/'):
            hits[pre] += 1; break
for (_, full, _) in backend:
    for pre in prefixes:
        if full == pre or full.startswith(pre + '/'):
            epc[pre] += 1; break

print(f"[parity] backend endpoints={len(backend)} | frontend path-literals={len(fe)}")
orphan_modules = [pre for pre in sorted(epc) if hits.get(pre, 0) == 0]
print("\n== ORPHAN MODULES (prefix 0 referensi FE — HARD SIGNAL) ==")
if orphan_modules:
    for pre in orphan_modules:
        print(f"  [ORPHAN] {pre:32s} endpoints={epc[pre]}")
else:
    print("  (none) OK")

print("\n== LOW COVERAGE (FE refs 1-3, endpoints>=5 — REVIEW) ==")
for pre in sorted(epc):
    h = hits.get(pre, 0)
    if 1 <= h <= 3 and epc[pre] >= 5:
        print(f"  [LOW] {pre:32s} endpoints={epc[pre]} fe_refs={h}")

covered = lambda np: np in fe
miss = sorted({(fn, m, full) for (m, full, fn) in backend if not covered(full)})
print(f"\n== ENDPOINT-LEVEL CANDIDATES (not literally matched) = {len(miss)} (REVIEW; banyak false-positive dari URL dinamis) ==")
print("  -> tinjau manual; bandingkan dengan PARITY_AUDIT_*.md")

if STRICT and orphan_modules:
    print("\nFAIL (strict): ada ORPHAN MODULE."); sys.exit(1)
print("\nOK")
