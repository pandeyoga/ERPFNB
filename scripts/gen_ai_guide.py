#!/usr/bin/env python3
"""Bangun pengetahuan "AI Pemandu" dari frontend → backend/services/ai/agent/app_guide.json.

Isi: daftar halaman (path, nama menu, bagian, portal, izin route) dan isi tour interaktif (judul + langkah) per path.
Dipakai agen untuk menjawab "bagaimana cara …", menautkan halaman yang boleh dibuka pengguna, dan menjalankan tour.

Jalankan ulang setelah mengubah menu (lib/navigationSchema/*), tour (contexts/tour/*), atau guard route
(setelah scripts/gen_route_perms.py). Butuh Node.js; tidak butuh node_modules (ikon lucide diganti stub).

    python3 scripts/gen_ai_guide.py
"""
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "frontend" / "src"
OUT = ROOT / "backend" / "services" / "ai" / "agent" / "app_guide.json"

FILES = sorted([*(SRC / "contexts" / "tour" / "tours").glob("*.js"), SRC / "contexts" / "tour" / "tourMap.js",
                *(SRC / "lib" / "navigationSchema").glob("*.js"), SRC / "lib" / "routePerms.generated.js"])

IMPORT_RE = re.compile(r"""(from\s+['"])(\.{1,2}/[^'"]+)(['"])""")
LUCIDE_RE = re.compile(r"""import\s*\{([^}]*)\}\s*from\s*["']lucide-react["'];?""")


def main() -> int:
    if not shutil.which("node"):
        print("node tidak ditemukan — butuh Node.js untuk membaca file tour/menu", file=sys.stderr)
        return 1
    tmp = Path(tempfile.mkdtemp(prefix="ai_guide_"))
    try:
        icons: set[str] = set()
        for f in FILES:
            rel = f.relative_to(SRC)
            dest = (tmp / rel).with_suffix(".mjs")
            dest.parent.mkdir(parents=True, exist_ok=True)
            code = f.read_text(encoding="utf-8")
            for m in LUCIDE_RE.finditer(code):
                icons.update(n.strip().split(" as ")[-1] for n in m.group(1).split(",") if n.strip())
            depth = len(rel.parts) - 1
            code = LUCIDE_RE.sub(lambda m: "import {" + m.group(1) + "} from '" + "../" * depth + "lucide_stub.mjs';", code)
            code = IMPORT_RE.sub(lambda m: m.group(1) + (m.group(2) if m.group(2).endswith(".mjs")
                                 else re.sub(r"(\.js)?$", ".mjs", m.group(2))) + m.group(3), code)
            dest.write_text(code, encoding="utf-8")
        (tmp / "lucide_stub.mjs").write_text("".join(f"export const {n} = null;\n" for n in sorted(icons)), encoding="utf-8")
        runner = tmp / "run.mjs"
        runner.write_text("""
import { tourRegistry } from './contexts/tour/tours/registry.mjs';
import { pathToTours } from './contexts/tour/tourMap.mjs';
import { ROUTE_PERMS } from './lib/routePerms.generated.mjs';
import * as fs from 'node:fs';
const navs = {};
for (const f of fs.readdirSync(new URL('./lib/navigationSchema/', import.meta.url))) {
  const mod = await import('./lib/navigationSchema/' + f);
  for (const v of Object.values(mod)) if (v && v.sections) navs[v.id || f] = v;
}
const pages = [];
for (const [portal, nav] of Object.entries(navs)) {
  for (const s of nav.sections || []) for (const it of s.items || []) {
    const walk = (x, section) => {
      if (x.path) pages.push({ path: x.path, label: x.name || x.label, section, portal: nav.name || portal });
      for (const c of x.children || x.items || []) walk(c, section);
    };
    walk(it, s.name);
  }
}
const tours = Object.entries(tourRegistry).map(([id, t]) => ({
  id, name: t.name, description: t.description || '',
  steps: (t.steps || []).map(s => ({ title: s.title || '', content: (s.content || '').replace(/\\*\\*/g, '') })),
}));
console.log(JSON.stringify({ pages, tours, path_to_tours: pathToTours, route_perms: ROUTE_PERMS }));
""", encoding="utf-8")
        res = subprocess.run(["node", str(runner)], capture_output=True, text=True, cwd=tmp)
        if res.returncode != 0:
            print(res.stderr[-3000:], file=sys.stderr)
            return 1
        data = json.loads(res.stdout)
        seen = set()
        pages = []
        for p in data["pages"]:
            if p["path"] in seen:
                continue
            seen.add(p["path"])
            p["perms"] = data["route_perms"].get(p["path"], [])
            p["tours"] = data["path_to_tours"].get(p["path"], [])
            pages.append(p)
        out = {"_generated_by": "scripts/gen_ai_guide.py — jangan edit manual", "pages": pages, "tours": data["tours"],
               "route_perms": data["route_perms"]}
        OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
        print(f"OK: {OUT.relative_to(ROOT)} — {len(pages)} halaman, {len(data['tours'])} tour")
        return 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
