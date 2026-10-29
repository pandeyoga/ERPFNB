"""Ringkas hasil anatomy.js → temuan anatomi halaman per state + distribusi lintas halaman.

usage (dari folder out/): python3 ../anatomy_report.py            → baca an_*.json, tulis anatomy_summary.json
Temuan:
  heading-mix        judul blok konten campur: sebagian di luar kartu, sebagian di dalam kartu
  untitled-sibling   blok konten tanpa judul di antara blok lain yang berjudul
  kpi-group-mix      grup KPI berjudul & tanpa judul di halaman yang sama
  kpi-orphan         grup KPI menyisakan 1 kartu sendirian di baris terakhir
  kpi-cols-jump      dua grup KPI berurutan dengan jumlah kolom berbeda (tepi kartu tidak sejajar)
  filter-split       kartu filter/toolbar terpisah dari tabel yang difilternya
  page-filter-card   filter tingkat halaman dibungkus kartu (berbobot sama dengan konten)
  note-card          kartu berisi sedikit teks (pesan/catatan) → cukup alert/teks
  frame-depth        >= 3 lapis bingkai (kartu › kotak › kotak)
  save-far           tombol simpan di atas form panjang (form melewati layar) / tidak sticky
  save-below-fold    form panjang, simpan hanya di bawah & tidak sticky (harus scroll)
  save-per-row       >= 3 tombol simpan di satu form
  save-in-header     simpan form berada di header halaman (level aksi halaman)
  rows-as-cards      daftar homogen (>= 5 item) ditumpuk sebagai kartu terpisah → seharusnya baris dalam 1 kartu/tabel
  card-grid-uniform  >= 8 kartu kecil seragam berisi data sejenis → seharusnya tabel
  double-title       judul bagian di luar kartu + judul kartu tepat di bawahnya yang sama/mirip
  context-above-h1   kartu konteks/filter (mis. "Outlet aktif") di atas judul halaman
"""
import collections
import glob
import json
import re

recs = []
for f in sorted(glob.glob("an_[0-9]*.json")):
    recs += json.load(open(f))
pages = [r for r in recs if "states" in r]

CONTENT = re.compile(r"^(CARD:(?!toolbar)|GRID\[)")


def blocks(outline):
    """Blok konten berurutan + gaya judulnya: outside / inside / none."""
    out, pending_title = [], None
    for item in outline:
        if item.startswith("TITLE:"):
            pending_title = item[6:]
            continue
        if CONTENT.match(item):
            if item.endswith(":kpi") or item.startswith("CARD:kpi"):
                style = "kpi"  # label KPI = judulnya sendiri; grup KPI dinilai terpisah (kpi-group-mix)
            elif pending_title:
                style = "outside"
            elif item.startswith("CARD:") and "(untitled)" not in item:
                style = "inside"
            elif item.startswith("GRID[") and not item.endswith(":kpi"):
                style = "inside"  # grid widget: tiap kartu biasanya berjudul sendiri
            else:
                style = "none"
            out.append((item, style, pending_title))
        pending_title = None
    return out


findings = collections.defaultdict(list)  # type -> [(url, state, detail)]
dist = collections.defaultdict(collections.Counter)  # action kind -> zone counter (per page, first state)
hub_zone = collections.Counter()
card_counts = []

for r in pages:
    for i, s in enumerate(r["states"]):
        url, st = r["url"], s["state"]
        add = lambda t, d: findings[t].append((url, st, d))  # noqa: E731
        bl = blocks(s["outline"])
        styles = {b[1] for b in bl}
        if "outside" in styles and "inside" in styles:
            add("heading-mix", " | ".join(f"{b[0]}{'←'+b[2] if b[2] else ''}" for b in bl)[:220])
        if len(bl) >= 3 and "none" in styles and ({"outside", "inside"} & styles):
            un = [b[0] for b in bl if b[1] == "none"]
            add("untitled-sibling", f"{len(un)} blok tanpa judul di antara blok berjudul: {', '.join(un)[:160]}")
        kg = s["kpiGroups"]
        if len(kg) >= 2 and len({g["titled"] for g in kg}) == 2:
            add("kpi-group-mix", "; ".join(f"{g['n']} KPI {'«'+g['title']+'»' if g['titled'] else '(tanpa judul)'}" for g in kg))
        for g in kg:
            if g["cols"] >= 3 and g["n"] > g["cols"] and g["n"] % g["cols"] == 1:
                add("kpi-orphan", f"{g['n']} KPI di {g['cols']} kolom")
        for a, b in zip(kg, kg[1:]):
            if a["cols"] != b["cols"] and min(a["cols"], b["cols"]) >= 2 and abs(a["y"] - b["y"]) < 900:
                add("kpi-cols-jump", f"{a['cols']} kolom lalu {b['cols']} kolom")
        ol = s["outline"]
        for a, b in zip(ol, ol[1:]):
            if a.startswith("CARD:toolbar") and b.startswith("CARD:table"):
                add("filter-split", f"{a} → {b}")
                break
        if any(x.startswith("CARD:toolbar") for x in ol[:4]) and not any(
                a.startswith("CARD:toolbar") and b.startswith("CARD:table") for a, b in zip(ol, ol[1:])):
            add("page-filter-card", " > ".join(ol[:5]))
        cs = [c for c in s["cards"] if not c["flat"] and c["depth"] == 0]
        col = collections.defaultdict(list)
        for c in cs:
            col[(c["x"], c["w"], c["kind"])].append(c)
        rows = [(k, v) for k, v in col.items() if len(v) >= 5 and k[2] in ("note", "content", "form") and k[1] > 600]
        if rows:
            add("rows-as-cards", "; ".join(f"{len(v)} kartu {k[2]} ({v[0]['testid'][:28]})" for k, v in rows))
        small = collections.Counter((c["w"], c["h"] // 20) for c in cs if c["kind"] in ("note", "content") and c["w"] < 600)
        if small and small.most_common(1)[0][1] >= 8:
            add("card-grid-uniform", f"{small.most_common(1)[0][1]} kartu kecil seragam")
        ts = sorted(s["titles"], key=lambda t: t["y"])
        for j, t in enumerate(ts):
            nxt = [u for u in ts[j + 1:] if t["pos"] == "outside" and u["pos"] == "card-top" and 0 < u["y"] - t["y"] < 110]
            if nxt:
                a, b = set(re.findall(r"\w+", t["text"].lower())), set(re.findall(r"\w+", nxt[0]["text"].lower()))
                if a and len(a & b) / len(a) >= 0.5:
                    add("double-title", f"«{t['text']}» lalu kartu «{nxt[0]['text']}»")
        if s["outline"] and s["outline"][0].startswith("CARD:") and any(x.startswith("HEADER") for x in s["outline"][1:3]):
            add("context-above-h1", f"{s['outline'][0]} di atas judul halaman")
        notes = [c for c in s["cards"] if c["kind"] == "note" and not c["flat"] and c["h"] < 160]
        if notes and not rows:
            add("note-card", ", ".join(c["testid"] for c in notes)[:160])
        if s["maxFrame"] >= 3:
            add("frame-depth", f"{s['maxFrame']} lapis: " + ", ".join(d["testid"] or d["text"] for d in s["deepFrames"][:3]))
        fm = s["form"]
        if fm and fm["saves"]:
            long_form = fm["last"] > fm["viewH"]
            saves = fm["saves"]
            if len(saves) >= 3:
                add("save-per-row", f"{len(saves)} tombol simpan, {fm['fields']} field")
            elif all(x["where"] == "above" for x in saves) and long_form and not any(x["sticky"] for x in saves):
                add("save-far", f"simpan di atas ({saves[0]['label']}), field sampai y={fm['last']}px")
            elif all(x["where"] == "below" for x in saves) and long_form and not any(x["sticky"] for x in saves):
                add("save-below-fold", f"simpan di y={saves[0]['y']}px (layar 800px), {fm['fields']} field")
            if any(x["zone"] == "page-header" for x in saves):
                add("save-in-header", f"{', '.join(x['label'] for x in saves if x['zone'] == 'page-header')} di header halaman")
        if i == 0:
            seen = set()
            for a in s["actions"]:
                if a["kind"] in ("create", "export", "refresh", "save") and (a["kind"], a["zone"]) not in seen:
                    seen.add((a["kind"], a["zone"]))
                    dist[a["kind"]][a["zone"]] += 1
        if s["hasHubTabs"]:
            for a in s["actions"]:
                if a["kind"] in ("create", "export", "refresh") and a["zone"] != "page-header":
                    hub_zone[a["zone"]] += 1
        card_counts.append(len([c for c in s["cards"] if not c["flat"]]))


def base(u):
    return u.split("?")[0]


print(f"halaman: {len(pages)}, state: {sum(len(r['states']) for r in pages)}, error: {len(recs) - len(pages)}")
summary = {}
for t, items in sorted(findings.items(), key=lambda x: -len({base(u) for u, *_ in x[1]})):
    pg = sorted({base(u) for u, *_ in items})
    print(f"\n## {t} — {len(items)} state, {len(pg)} halaman")
    shown = set()
    for u, st, d in items:
        if base(u) in shown:
            continue
        shown.add(base(u))
        print(f"   - {u} [{st}] {d}")
        if len(shown) >= 8:
            break
    summary[t] = {"states": len(items), "pages": pg, "items": items}

print("\n## Zona aksi per jenis (state pertama tiap halaman):")
for k, c in dist.items():
    print(f"   {k}: " + ", ".join(f"{z} {n}" for z, n in c.most_common()))
print("   aksi tingkat-tab di hub (bukan page-header): " + ", ".join(f"{z} {n}" for z, n in hub_zone.most_common()))
cc = collections.Counter(min(n, 15) for n in card_counts)
print("\n## Jumlah kartu per state: " + ", ".join(f"{k}{'+' if k == 15 else ''}: {v}" for k, v in sorted(cc.items())))
json.dump({"findings": summary, "action_zones": {k: dict(v) for k, v in dist.items()}, "hub_tab_action_zones": dict(hub_zone),
           "card_counts": dict(cc)}, open("anatomy_summary.json", "w"), default=str)
