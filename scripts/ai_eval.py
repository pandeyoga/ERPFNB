#!/usr/bin/env python3
"""Jalankan kumpulan uji Asisten AI (backend/tests/ai_evals) terhadap backend yang berjalan — memakai Claude sungguhan
(BERBIAYA; kira-kira $0,05–0,40 per kasus). Tidak ada aksi tulis yang dijalankan: usulan hanya diperiksa, tidak disetujui.

  python3 scripts/ai_eval.py --base http://localhost:8001 --email owner@fnbgroup.id --password '...' [--cases id1,id2]
                             [--agen analis,finance] [--max-cost 2.0]

Hasil: tabel lulus/gagal per kasus + alasan + biaya; kode keluar 1 bila ada yang gagal.
"""
import argparse
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from tests.ai_evals import CASES  # noqa: E402


def call(base, method, path, token=None, body=None, timeout=120):
    req = urllib.request.Request(base + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"content-type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read() or b"{}")


def upload(base, token, path):
    boundary = "----aievalboundary"
    data = path.read_bytes()
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"category\"\r\n\r\ngeneral\r\n"
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{path.name}\"\r\n"
            f"Content-Type: text/csv\r\n\r\n").encode() + data + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(base + "/api/uploads", method="POST", data=body,
                                 headers={"Authorization": f"Bearer {token}", "content-type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())["data"]["id"]


def check(case, session, actions):
    e = case["harap"]
    disp = [d for d in session.get("display", []) if d.get("role") == "assistant"]
    last = disp[-1] if disp else {}
    steps = [s for d in disp for s in d.get("steps") or []]
    tools = {s.get("tool") for s in steps}
    datasets = {s.get("dataset") for s in steps if s.get("dataset")}
    read_paths = {f"{s.get('method') or 'GET'} {s['path']}" for s in steps if s.get("path")}
    act_paths = {f"{a['method']} {a['path']}" for a in actions}
    text = last.get("text") or ""
    fails = []
    if e.get("alat") and not tools & set(e["alat"]):
        fails.append(f"alat {e['alat']} tidak dipakai (dipakai: {sorted(t for t in tools if t)})")
    ds_ok = bool(datasets & set(e.get("dataset") or []))
    act_ok = bool((read_paths | act_paths) & set(e.get("aksi") or []))
    if e.get("dataset") and e.get("aksi"):          # dua sumber alternatif: dataset analitik ATAU laporan/aksi resmi
        if not (ds_ok or act_ok):
            fails.append(f"sumber {e['dataset'] + e['aksi']} tidak dipakai (dataset: {sorted(datasets)}, aksi: {sorted(read_paths | act_paths)[:6]})")
    elif e.get("dataset") and not ds_ok:
        fails.append(f"dataset {e['dataset']} tidak dipakai (dipakai: {sorted(datasets)})")
    elif e.get("aksi") and not act_ok:
        fails.append(f"aksi {e['aksi']} tidak dibaca/diusulkan (dipakai: {sorted(read_paths | act_paths)[:6]})")
    if e.get("usul") and not actions:
        fails.append("tidak ada usulan aksi")
    for rx in e.get("memuat", []):
        if not re.search(rx, text, re.I):
            fails.append(f"jawaban tidak memuat /{rx}/")
    for rx in e.get("tidak_memuat", []):
        if re.search(rx, text, re.I):
            fails.append(f"jawaban memuat /{rx}/")
    if last.get("error"):
        fails.append(f"galat: {last['error']}")
    return fails


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8001")
    ap.add_argument("--email", required=True)
    ap.add_argument("--password", required=True)
    ap.add_argument("--cases", default="")
    ap.add_argument("--agen", default="")
    ap.add_argument("--max-cost", type=float, default=3.0)
    ap.add_argument("--save", default="", help="simpan jawaban & langkah kasus gagal ke file JSON ini")
    a = ap.parse_args()
    token = call(a.base, "POST", "/api/auth/login", body={"email": a.email, "password": a.password})["data"]["access_token"]
    sel = [c for c in CASES if (not a.cases or c["id"] in a.cases.split(",")) and (not a.agen or c["agen"] in a.agen.split(","))]
    total_cost, results, saved = 0.0, [], []
    for c in sel:
        if total_cost >= a.max_cost:
            print(f"Batas biaya ${a.max_cost} tercapai — berhenti.")
            break
        t0 = time.time()
        atts = []
        if c.get("lampiran"):
            atts.append(upload(a.base, token, Path(__file__).resolve().parents[1] / "backend" / "tests" / "ai_evals" / c["lampiran"]))
        body = {"message": c["pertanyaan"], "attachments": atts, "context": {"path": "/ai", "agent": c.get("persona") or "umum"}}
        st = call(a.base, "POST", "/api/ai/agent/chat", token, body)["data"]
        while True:
            r = call(a.base, "GET", f"/api/ai/agent/runs/{st['run_id']}", token)["data"]
            if r["status"] != "running":
                break
            if time.time() - t0 > 600:
                break
            time.sleep(2)
        s = call(a.base, "GET", f"/api/ai/agent/sessions/{st['session_id']}", token)["data"]
        acts = s.get("actions") or []
        acts = list(acts.values()) if isinstance(acts, dict) else acts
        fails = check(c, s, acts)
        cost = float((s.get("usage") or {}).get("cost_usd") or 0)
        total_cost += cost
        results.append((c["id"], not fails, fails, cost, time.time() - t0))
        print(f"{'LULUS' if not fails else 'GAGAL'}  {c['id']:<22} ${cost:.3f}  {time.time() - t0:5.0f}s  {'; '.join(fails)}")
        if fails and a.save:
            last = [d for d in s.get("display", []) if d.get("role") == "assistant"]
            saved.append({"id": c["id"], "gagal": fails, "jawaban": (last[-1].get("text") if last else ""),
                          "langkah": [st for d in last for st in d.get("steps") or []],
                          "usulan": [f"{x['method']} {x['path']}" for x in acts]})
            Path(a.save).write_text(json.dumps(saved, ensure_ascii=False, indent=1))
        call(a.base, "DELETE", f"/api/ai/agent/sessions/{st['session_id']}", token)
    ok = sum(1 for r in results if r[1])
    print(f"\n{ok}/{len(results)} lulus · biaya ${total_cost:.2f}")
    sys.exit(0 if ok == len(results) else 1)


if __name__ == "__main__":
    main()
