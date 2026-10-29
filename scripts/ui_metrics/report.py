"""Aggregate sizes_<prefix>_*.json → distribusi per komponen, % sesuai spec (docs/DESIGN_SYSTEM.md), halaman off-spec.
usage: python3 report.py [prefix=sizes_light]  (jalankan di folder berisi file hasil sizes.js)"""
import collections
import glob
import json
import re
import sys

prefix = sys.argv[1] if len(sys.argv) > 1 else "sizes_light"
recs = []
for f in sorted(glob.glob(f"{prefix}_[0-9]*.json")):
    recs += json.load(open(f))
pages = [r for r in recs if "states" in r]
print(f"pages measured: {len(pages)}  states: {sum(len(r['states']) for r in pages)}  errors: {len(recs) - len(pages)}")

# spec from design_guidelines.md (1280px viewport → md: values)
SPEC = {
    "button_text_h": {32, 36},        # sm h-8, default h-9 (lg h-10 = 40 tolerated, flagged separately)
    "button_icon_h": {32, 36},
    "button_fs": {13, 14},
    "input_h": {32, 36},
    "input_fs": {13, 14},
    "tab_h": {32},
    "card_pad": {0, 12, 16},          # 0 = table wrapper with overflow-hidden; p-3; p-4
    "card_rad": {18},                 # glass-card = calc(var(--radius) + 4px)
    "h1": {24}, "h2": {18}, "h3": {16},
    "kpi_h": (64, 96),
    "row_h": (32, 56),
}


def dist(vals):
    c = collections.Counter(vals)
    return ", ".join(f"{k}:{v}" for k, v in sorted(c.items(), key=lambda x: -x[1])[:10])


def collect(key):
    out = []
    for r in pages:
        for s in r["states"]:
            for it in s["m"][key]:
                out.append((r["url"], s["state"], it))
    return out


def report(title, items, val, ok, sample_fields=("id",), dedupe=True):
    vals = [val(it) for _, _, it in items]
    bad = [(u, st, it) for (u, st, it), v in zip(items, vals) if not ok(v)]
    pct = 100 * (len(items) - len(bad)) / max(1, len(items))
    print(f"\n## {title}: n={len(items)}  sesuai spec {pct:.1f}%")
    print("   distribusi:", dist(vals))
    seen = set(); shown = 0
    by_page = collections.Counter(u for u, _, _ in bad)
    if bad:
        print("   halaman terbanyak off-spec:", ", ".join(f"{u}({c})" for u, c in by_page.most_common(8)))
    for u, st, it in bad:
        key = (it.get("cls", "")[:80], val(it)) if dedupe else id(it)
        if key in seen:
            continue
        seen.add(key); shown += 1
        print(f"   - {val(it)} @ {u} [{st}] {it.get('id', '')!r} :: {it.get('cls', '')[:110]}")
        if shown >= 12:
            break
    return {"n": len(items), "ok_pct": round(pct, 1), "dist": dist(vals), "bad_pages": by_page.most_common(15)}


summary = {}
btn = collect("buttons")
for _, _, it in btn:  # link-button (variant="link") & sel/baris lebar penuh bukan "tombol"
    c = it.get("cls", "")
    if "underline-offset-4" in c:
        it["kind"] = "link"
    elif it["kind"] == "text" and re.search(r"\bw-full\b", c):
        it["kind"] = "option"
summary["button_text_h"] = report("Tombol teks — tinggi (px)", [x for x in btn if x[2]["kind"] == "text"], lambda i: round(i["h"]), lambda v: v in SPEC["button_text_h"])
summary["button_icon_h"] = report("Tombol ikon — tinggi (px)", [x for x in btn if x[2]["kind"] == "icon"], lambda i: round(i["h"]), lambda v: v in SPEC["button_icon_h"])
summary["button_fs"] = report("Tombol teks — font-size", [x for x in btn if x[2]["kind"] == "text"], lambda i: i["fs"], lambda v: v in SPEC["button_fs"])
summary["button_rad"] = report("Tombol — radius", [x for x in btn if x[2]["kind"] in ("text", "icon")], lambda i: i["rad"], lambda v: v in {12, 10, 8} or v >= 999)
summary["option_rad"] = report("Kartu/baris pilihan (<button>) — radius", [x for x in btn if x[2]["kind"] == "option"], lambda i: i["rad"], lambda v: v in {12})
summary["help_h"] = report("Ikon bantuan (?) — ukuran target", [x for x in btn if x[2]["kind"] == "help"], lambda i: round(i["h"]), lambda v: v >= 24)
inp = collect("inputs")
summary["input_h"] = report("Input/select — tinggi", inp, lambda i: round(i["h"]), lambda v: v in SPEC["input_h"])
summary["input_fs"] = report("Input/select — font-size", inp, lambda i: i["fs"], lambda v: v in SPEC["input_fs"])
tabs = collect("tabs")
summary["tab_h"] = report("Tab — tinggi", tabs, lambda i: round(i["h"]), lambda v: v in SPEC["tab_h"])
cards = collect("cards")
summary["card_pad"] = report("Kartu — padding", cards, lambda i: i["pt"], lambda v: v in SPEC["card_pad"])
summary["card_rad"] = report("Kartu — radius (di luar .nested-cards)", [x for x in cards if "nested-cards" not in x[2].get("cls", "")], lambda i: i["rad"], lambda v: v in SPEC["card_rad"] | {14})
summary["card_nested"] = report("Kartu bersarang (card-in-card)", cards, lambda i: i["nested"], lambda v: not v)
summary["card_title"] = report("Judul kartu — font-size", [x for x in cards if x[2]["title_fs"]], lambda i: i["title_fs"], lambda v: v in {14, 16, 18})
kpi = collect("kpis")
summary["kpi_h"] = report("Kartu KPI — tinggi", kpi, lambda i: round(i["h"]), lambda v: SPEC["kpi_h"][0] <= v <= SPEC["kpi_h"][1])
hd = collect("headings")
for tag, exp in (("H1", SPEC["h1"]), ("H2", SPEC["h2"]), ("H3", SPEC["h3"])):
    summary[f"{tag.lower()}"] = report(f"{tag} — font-size", [x for x in hd if x[2]["tag"] == tag], lambda i: i["fs"], lambda v, e=exp: v in e)
# h1 per page state
h1c = collections.Counter()
for r in pages:
    for s in r["states"][:1]:
        h1c[sum(1 for h in s["m"]["headings"] if h["tag"] == "H1")] += 1
print("\n## Jumlah H1 per halaman:", dict(h1c))
th = collect("th"); td = collect("td")
summary["th_fs"] = report("Header tabel — font-size", th, lambda i: i["fs"], lambda v: v in {11, 12})
summary["td_fs"] = report("Sel tabel — font-size", td, lambda i: i["fs"], lambda v: v in {13, 14})
rows = [(r["url"], s["state"], {"h": h}) for r in pages for s in r["states"] for h in s["m"]["rows"]]
summary["row_h"] = report("Baris tabel — tinggi", rows, lambda i: round(i["h"]), lambda v: SPEC["row_h"][0] <= v <= SPEC["row_h"][1])
pills = [(r["url"], s["state"], p) for r in pages for s in r["states"] for p in s["m"]["pills"]]
summary["pill_h"] = report("Status pill — tinggi", pills, lambda i: round(i["h"]), lambda v: 18 <= v <= 24)

# text sizes
tx = collections.Counter()
for r in pages:
    for s in r["states"]:
        for k, v in s["m"]["text"].items():
            tx[float(k)] += v
total = sum(tx.values())
print("\n## Ukuran teks (elemen pemilik teks):", ", ".join(f"{k:g}px:{v} ({100*v/total:.1f}%)" for k, v in sorted(tx.items())))
small = [(r["url"], s["state"], it) for r in pages for s in r["states"] for it in s["m"]["small_text"]]
summary["small_text"] = report("Teks < 11px, atau 11px bukan uppercase (bukan badge)", small, lambda i: i["fs"], lambda v: False)
con = [(r["url"], s["state"], it) for r in pages for s in r["states"] for it in s["m"]["contrast"]]
summary["contrast"] = report("Teks kontras di bawah WCAG AA", con, lambda i: i["r"], lambda v: False)
ic = collections.Counter()
for r in pages:
    for s in r["states"]:
        for k, v in s["m"]["icons"].items():
            ic[float(k)] += v
print("\n## Ikon dalam tombol (lebar px):", ", ".join(f"{k:g}:{v}" for k, v in sorted(ic.items(), key=lambda x: -x[1])[:10]))
json.dump(summary, open(f"{prefix}_summary.json", "w"), indent=1, default=str)
