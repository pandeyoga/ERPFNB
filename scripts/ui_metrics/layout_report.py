"""Ringkas hasil layout.js → temuan komposisi per jenis (dedup per halaman) + fakta penempatan lintas halaman.

usage (dari folder out/): python3 ../layout_report.py [contoh_per_jenis=6]   → baca layout_*.json, tulis layout_summary.json
"""
import collections
import glob
import json
import sys

LABEL = {
    "tabs-overflow": "Bar tab terpotong (tab tersembunyi di luar layar)",
    "tabs-too-many": "Terlalu banyak tab (> 6) dalam satu bar",
    "frame-in-frame": "Bingkai di dalam bingkai (TabsList berbingkai di dalam kartu)",
    "toolbar-wrap": "Toolbar terlipat → baris setengah kosong",
    "header-actions-wrap": "Aksi header turun ke baris sendiri",
    "mixed-control-height": "Tinggi kontrol berbeda dalam satu baris",
    "grid-orphan": "Grid dengan 1 item yatim di baris terakhir",
    "card-empty-space": "Kartu tinggi tapi sebagian besar kosong",
    "clipped-number": "Angka terpotong (ellipsis)",
    "clipped-text": "Teks terpotong (ellipsis)",
    "intro-stacking": "Kalimat pengantar bertumpuk sebelum konten",
    "title-repeat": "Judul diulang (h1 = tab = judul kartu)",
    "many-primary": ">= 3 tombol utama bersaing",
    "term-mix": "Istilah campur untuk konsep sama (EN vs ID) di satu layar",
    "money-left": "Nominal rata kiri di tabel",
    "page-h-overflow": "Halaman melebar (scroll horizontal)",
    "table-h-scroll": "Tabel butuh scroll horizontal",
    "overlap": "Elemen interaktif bertumpuk",
    "duplicate-control": "Kontrol ganda (label sama 2x)",
    "narrow-columns": "Kolom tabel terlalu sempit (isi terlipat)",
    "rhythm": "Jarak antar blok tidak konsisten",
}
# Jenis yang detailnya bervariasi per state → dedup cukup per testid.
DEDUP_BY_TESTID = {"toolbar-wrap", "rhythm", "card-empty-space"}

recs = []
for f in sorted(glob.glob("layout_[0-9]*.json")):
    recs += json.load(open(f))
pages = [r for r in recs if "states" in r]
print(f"halaman: {len(pages)}, state: {sum(len(r['states']) for r in pages)}, error: {len(recs) - len(pages)}")

by_type = collections.defaultdict(list)
for r in pages:
    seen = set()
    for s in r["states"]:
        for f in s["findings"]:
            key = (f["type"], f["testid"], f["testid"] if f["type"] in DEDUP_BY_TESTID else f["detail"])
            if key in seen:
                continue
            seen.add(key)
            by_type[f["type"]].append((r["url"], s["state"], f["detail"], f["testid"], s["shot"]))

limit = int(sys.argv[1]) if len(sys.argv) > 1 else 6
out = {}
for t, items in sorted(by_type.items(), key=lambda x: -len({u for u, *_ in x[1]})):
    pages_t = sorted({u for u, *_ in items})
    print(f"\n## {LABEL.get(t, t)} [{t}] — {len(items)} temuan di {len(pages_t)} halaman")
    for u, st, d, tid, _shot in items[:limit]:
        print(f"   - {u} [{st}] {tid}: {d[:140]}")
    out[t] = {"label": LABEL.get(t, t), "count": len(items), "pages": pages_t, "items": items}

facts = collections.Counter()
for r in pages:
    for k, v in r["states"][0]["facts"].items():
        facts[(k, v)] += 1
print("\n## Fakta penempatan lintas halaman:")
for (k, v), n in sorted(facts.items()):
    print(f"   {k} = {v}: {n} halaman")
json.dump({"by_type": out, "facts": {f"{k}={v}": n for (k, v), n in facts.items()}},
          open("layout_summary.json", "w"), default=str)
