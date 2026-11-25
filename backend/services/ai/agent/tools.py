"""Alat (tools) yang dipakai agen + eksekusinya.

Alat kustom (dijalankan server ERP): cari/jelaskan/jalankan aksi katalog, usulkan aksi tulis (persetujuan),
pemandu aplikasi, tautan halaman, baca lampiran. Alat server Anthropic: web search & web fetch (riset sumber luar).
Daftar alat dibekukan per sesi (urutan & isi tetap) agar riwayat append-only tetap valid (preserved thinking).
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Optional

from core.db import get_db

from . import actions, catalog, datasets, executor, reports

GUIDE_PATH = Path(__file__).with_name("app_guide.json")
_GUIDE: Optional[dict] = None

TOOLS_VERSION = "2026-11-25.3"

TOOL_DEFS: list[dict] = [
    {
        "name": "search_actions",
        "description": (
            "Cari aksi/endpoint ERP yang relevan (semua modul: penjualan, pembelian, stok, keuangan, HR, reservasi, "
            "loyalty, sourcing, master data, laporan, dll.). Hanya aksi yang diizinkan untuk pengguna ini yang muncul. "
            "Pakai kata kunci Indonesia atau Inggris. kind: read (baca/laporan) | write (ubah data) | any."),
        "input_schema": {"type": "object", "properties": {
            "query": {"type": "string", "description": "Kata kunci, mis. 'laba rugi per toko', 'buat PO', 'reservasi'"},
            "kind": {"type": "string", "enum": ["read", "write", "any"]},
            "domain": {"type": "string", "description": "Opsional: segmen path, mis. finance, procurement, hr"},
        }, "required": ["query"]},
    },
    {
        "name": "describe_action",
        "description": "Rincian satu aksi: parameter, isi body (skema/petunjuk), izin, risiko. Wajib sebelum mengusulkan aksi tulis yang belum pernah dipakai di percakapan ini.",
        "input_schema": {"type": "object", "properties": {"op_id": {"type": "string"}}, "required": ["op_id"]},
    },
    {
        "name": "run_read",
        "description": (
            "Jalankan aksi BACA (GET/laporan/ekspor) dan dapatkan datanya. Ekspor Excel/PDF menghasilkan tautan unduh. "
            "Konteks brand/toko pengguna otomatis dipakai bila parameter tidak diisi. Daftar panjang dipotong — "
            "pakai filter (tanggal, toko, status) untuk mempersempit."),
        "input_schema": {"type": "object", "properties": {
            "op_id": {"type": "string"},
            "path_params": {"type": "object", "description": "Nilai {param} di path"},
            "query": {"type": "object", "description": "Query string, mis. {\"date_from\":\"2026-11-01\"}"},
            "body": {"type": "object", "description": "Hanya untuk aksi baca berbentuk POST (mis. price-check)"},
        }, "required": ["op_id"]},
    },
    {
        "name": "propose_actions",
        "description": (
            "Usulkan satu atau beberapa aksi TULIS (buat/ubah/hapus/setujui/posting). Aksi TIDAK langsung dijalankan: "
            "pengguna melihat kartu usulan dan menyetujui/menolak. Setelah memanggil alat ini, akhiri giliran dengan "
            "ringkasan singkat dan jangan mengklaim aksi sudah terjadi. Kelompokkan aksi sejenis dalam satu panggilan."),
        "input_schema": {"type": "object", "properties": {
            "summary": {"type": "string", "description": "Ringkasan batch untuk pengguna (bahasa Indonesia)"},
            "actions": {"type": "array", "items": {"type": "object", "properties": {
                "op_id": {"type": "string"},
                "title": {"type": "string", "description": "Judul singkat, mis. 'Buat PO ke CV Daging Berkah'"},
                "reason": {"type": "string", "description": "Alasan/dasar data, singkat"},
                "path_params": {"type": "object"}, "query": {"type": "object"},
                "body": {"description": "Isi body sesuai skema/petunjuk describe_action"},
            }, "required": ["op_id", "title"]}},
        }, "required": ["summary", "actions"]},
    },
    {
        "name": "app_guide",
        "description": (
            "Pengetahuan cara memakai aplikasi: halaman/menu yang bisa dibuka pengguna, langkah-langkah dari tour "
            "interaktif, dan tour yang bisa dijalankan. Pakai untuk pertanyaan 'bagaimana cara…', 'di mana…', "
            "'apa arti…'."),
        "input_schema": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]},
    },
    {
        "name": "open_page",
        "description": "Tampilkan tombol untuk membuka halaman aplikasi (hanya halaman yang boleh dibuka pengguna). Boleh menyertakan tour_id untuk menjalankan tour di halaman itu.",
        "input_schema": {"type": "object", "properties": {
            "path": {"type": "string", "description": "Path aplikasi, mis. /procurement/po?status=draft"},
            "label": {"type": "string"}, "tour_id": {"type": "string"},
        }, "required": ["path", "label"]},
    },
    {
        "name": "read_attachment",
        "description": "Baca lampiran yang diunggah pengguna (foto/PDF/Excel/CSV/teks) berdasarkan attachment_id. Foto & PDF dikembalikan untuk dibaca langsung; Excel/CSV sebagai tabel.",
        "input_schema": {"type": "object", "properties": {
            "attachment_id": {"type": "string"},
            "max_rows": {"type": "integer", "description": "Untuk Excel/CSV (default 200)"},
        }, "required": ["attachment_id"]},
    },    {
        "name": "data_catalog",
        "description": (
            "Daftar dataset analitik yang boleh dibaca pengguna (penjualan harian/channel/pembayaran, jurnal GL, PO, GR, PR, "
            "AP, AR, kas kecil, mutasi stok, transfer, KDO/BDO, reservasi, karyawan, cuti, payroll, kasbon, pelanggan, "
            "loyalty, aset, budget toko) + KAMUS METRIK resmi (definisi revenue, food cost %, labor %, dll.). "
            "Tanpa argumen → daftar; dengan dataset → field & tipe. Pakai sebelum query_data."),
        "input_schema": {"type": "object", "properties": {"dataset": {"type": "string"}}},
    },
    {
        "name": "query_data",
        "description": (
            "Query aman atas dataset (filter, group_by termasuk tanggal per hari/minggu/bulan/kuartal/hari-dalam-minggu, "
            "metrik sum/avg/min/max/count/count_distinct/median, sort, limit). Otomatis dibatasi ke toko yang boleh "
            "diakses pengguna. Kolom id (outlet_id, vendor_id, item_id, coa_id, …) diberi nama otomatis (<kolom>_name). "
            "export=xlsx|csv → file lengkap untuk diunduh pengguna (sampai 50.000 baris). Untuk angka resmi ikuti kamus "
            "metrik (mis. revenue = sales_daily status validated)."),
        "input_schema": {**{"type": "object", "properties": {
            "dataset": {"type": "string"},
            "period": {"type": "string", "description": "today|yesterday|last_7d|last_30d|this_week|last_week|mtd|last_month|qtd|last_quarter|ytd|last_year (relatif, WIB)"},
            "date_from": {"type": "string", "description": "YYYY-MM-DD (bila tidak memakai period)"},
            "date_to": {"type": "string"},
            "outlet_ids": {"type": "array", "items": {"type": "string"}},
            "brand_ids": {"type": "array", "items": {"type": "string"}},
            "filters": {"type": "array", "items": {"type": "object", "properties": {
                "field": {"type": "string"}, "op": {"type": "string", "enum": ["eq", "ne", "in", "nin", "gt", "gte", "lt", "lte", "contains", "exists"]},
                "value": {}}, "required": ["field"]}},
            "group_by": {"type": "array", "items": {"type": "string"}, "description": "Field atau tanggal: date:day|week|month|quarter|year|weekday"},
            "metrics": {"type": "array", "items": {"type": "object", "properties": {
                "fn": {"type": "string", "enum": ["sum", "avg", "min", "max", "count", "count_distinct", "median"]},
                "field": {"type": "string"}, "as": {"type": "string"}}, "required": ["fn"]}},
            "fields": {"type": "array", "items": {"type": "string"}, "description": "Mode baris mentah (tanpa group_by/metrics)"},
            "sort": {"type": "array", "items": {"type": "object", "properties": {"by": {"type": "string"}, "dir": {"type": "string", "enum": ["asc", "desc"]}}}},
            "limit": {"type": "integer"},
        }, "required": ["dataset"]}, "properties": {**{"type": "object", "properties": {
            "dataset": {"type": "string"},
            "period": {"type": "string", "description": "today|yesterday|last_7d|last_30d|this_week|last_week|mtd|last_month|qtd|last_quarter|ytd|last_year (relatif, WIB)"},
            "date_from": {"type": "string", "description": "YYYY-MM-DD (bila tidak memakai period)"},
            "date_to": {"type": "string"},
            "outlet_ids": {"type": "array", "items": {"type": "string"}},
            "brand_ids": {"type": "array", "items": {"type": "string"}},
            "filters": {"type": "array", "items": {"type": "object", "properties": {
                "field": {"type": "string"}, "op": {"type": "string", "enum": ["eq", "ne", "in", "nin", "gt", "gte", "lt", "lte", "contains", "exists"]},
                "value": {}}, "required": ["field"]}},
            "group_by": {"type": "array", "items": {"type": "string"}, "description": "Field atau tanggal: date:day|week|month|quarter|year|weekday"},
            "metrics": {"type": "array", "items": {"type": "object", "properties": {
                "fn": {"type": "string", "enum": ["sum", "avg", "min", "max", "count", "count_distinct", "median"]},
                "field": {"type": "string"}, "as": {"type": "string"}}, "required": ["fn"]}},
            "fields": {"type": "array", "items": {"type": "string"}, "description": "Mode baris mentah (tanpa group_by/metrics)"},
            "sort": {"type": "array", "items": {"type": "object", "properties": {"by": {"type": "string"}, "dir": {"type": "string", "enum": ["asc", "desc"]}}}},
            "limit": {"type": "integer"},
        }, "required": ["dataset"]}["properties"],
                         "export": {"type": "string", "enum": ["xlsx", "csv"]},
                         "export_title": {"type": "string"}}},
    },
    {
        "name": "show_chart",
        "description": (
            "Tampilkan grafik interaktif di percakapan (bar/line/area/pie). data = baris hasil query (≤200 titik, ≤6 seri). "
            "Sertakan source_query (spesifikasi query_data yang menghasilkan data, pakai period relatif) agar pengguna bisa "
            "menyematkan grafik ke Dashboard AI dan diperbarui otomatis."),
        "input_schema": {**{"type": "object", "properties": {
                "type": {"type": "string", "enum": ["bar", "line", "area", "pie"]},
                "title": {"type": "string"},
                "x_key": {"type": "string", "description": "Kolom sumbu X / label irisan"},
                "series": {"type": "array", "items": {"type": "object", "properties": {"key": {"type": "string"}, "label": {"type": "string"}}, "required": ["key"]}},
                "data": {"type": "array", "items": {"type": "object"}},
                "unit": {"type": "string", "enum": ["rp", "num", "pct"]},
                "stacked": {"type": "boolean"},
            }, "required": ["type", "x_key", "series", "data"]}, "properties": {**{"type": "object", "properties": {
                "type": {"type": "string", "enum": ["bar", "line", "area", "pie"]},
                "title": {"type": "string"},
                "x_key": {"type": "string", "description": "Kolom sumbu X / label irisan"},
                "series": {"type": "array", "items": {"type": "object", "properties": {"key": {"type": "string"}, "label": {"type": "string"}}, "required": ["key"]}},
                "data": {"type": "array", "items": {"type": "object"}},
                "unit": {"type": "string", "enum": ["rp", "num", "pct"]},
                "stacked": {"type": "boolean"},
            }, "required": ["type", "x_key", "series", "data"]}["properties"],
                         "source_query": {"type": "object", "description": "Spesifikasi query_data sumber data (opsional)"}}},
    },
    {
        "name": "create_report",
        "description": (
            "Buat file laporan Excel (xlsx: sheet ringkasan + sheet per tabel + grafik native) atau PDF (A4: judul, narasi, "
            "tabel, grafik). sections: [{heading, text (markdown sederhana), table: {columns, rows, number_format: rp|num|pct}, "
            "chart: {type, x_key, series, data, title}}]. Judul membawa konteks brand/toko & periode. Hasil: tombol unduh."),
        "input_schema": {"type": "object", "properties": {
            "title": {"type": "string"}, "subtitle": {"type": "string"},
            "format": {"type": "string", "enum": ["xlsx", "pdf"]},
            "sections": {"type": "array", "items": {"type": "object", "properties": {
                "heading": {"type": "string"}, "text": {"type": "string"},
                "table": {"type": "object", "properties": {
                    "columns": {"type": "array", "items": {"type": "string"}},
                    "rows": {"type": "array", "items": {"type": "array", "items": {}}},
                    "number_format": {"type": "string", "enum": ["rp", "num", "pct"]}}},
                "chart": {"type": "object", "properties": {
                "type": {"type": "string", "enum": ["bar", "line", "area", "pie"]},
                "title": {"type": "string"},
                "x_key": {"type": "string", "description": "Kolom sumbu X / label irisan"},
                "series": {"type": "array", "items": {"type": "object", "properties": {"key": {"type": "string"}, "label": {"type": "string"}}, "required": ["key"]}},
                "data": {"type": "array", "items": {"type": "object"}},
                "unit": {"type": "string", "enum": ["rp", "num", "pct"]},
                "stacked": {"type": "boolean"},
            }, "required": ["type", "x_key", "series", "data"]},
            }}},
        }, "required": ["title", "format", "sections"]},
    },
    {
        "name": "remember",
        "description": (
            "Simpan memori jangka panjang: preferensi pengguna, aturan bisnis, target KPI, koreksi (mis. 'TRF GOTO = payout "
            "GoFood', 'food cost target 32%'). Pakai bila pengguna meminta diingat atau mengoreksi Anda dengan fakta yang "
            "berlaku ke depan. scope 'perusahaan' hanya bila pengguna berhak (ai.knowledge.manage) & memang berlaku untuk "
            "semua; selain itu 'pribadi'. Jangan simpan data sensitif (password, gaji, rekening)."),
        "input_schema": {"type": "object", "properties": {
            "content": {"type": "string", "description": "Satu fakta ringkas (≤ 600 karakter)"},
            "kind": {"type": "string", "enum": ["preferensi", "aturan", "target", "koreksi", "fakta"]},
            "scope": {"type": "string", "enum": ["pribadi", "perusahaan"]}}, "required": ["content", "kind", "scope"]},
    },
    {
        "name": "forget",
        "description": "Hapus memori (id dari blok Memori, 8 karakter awal cukup) bila pengguna memintanya atau memori sudah salah.",
        "input_schema": {"type": "object", "properties": {"memory_id": {"type": "string"}}, "required": ["memory_id"]},
    },
    {
        "name": "search_knowledge",
        "description": (
            "Cari di basis pengetahuan perusahaan (SOP, kontrak supplier, kebijakan, resep standar) & catatan riset "
            "tersimpan. Pakai untuk pertanyaan prosedur/kebijakan/kontrak. Jawab dengan kutipan: judul dokumen + bagian/hal."),
        "input_schema": {"type": "object", "properties": {"query": {"type": "string"}, "k": {"type": "integer"}},
                         "required": ["query"]},
    },
    {
        "name": "save_research_note",
        "description": (
            "Simpan hasil riset sumber luar (harga pasar, regulasi, supplier, tren) sebagai Catatan Riset agar bisa dipakai "
            "lagi: ringkasan berisi angka & kesimpulan, sources [{title, url, tanggal}]. Pakai setelah web_search yang "
            "hasilnya berguna untuk keputusan."),
        "input_schema": {"type": "object", "properties": {
            "topic": {"type": "string"}, "summary": {"type": "string"},
            "sources": {"type": "array", "items": {"type": "object", "properties": {
                "title": {"type": "string"}, "url": {"type": "string"}, "tanggal": {"type": "string"}}}},
            "tags": {"type": "array", "items": {"type": "string"}}}, "required": ["topic", "summary", "sources"]},
    },
]

SERVER_TOOLS: list[dict] = [
    {"type": "web_search_20260209", "name": "web_search", "max_uses": 6,
     "user_location": {"type": "approximate", "country": "ID", "timezone": "Asia/Jakarta"}},
    {"type": "web_fetch_20260209", "name": "web_fetch", "max_uses": 6},
]


# Alat server yang ditolak API untuk akun/jaringan ini (mis. "not allowed to use tool web_fetch_…" dari jaringan
# terbatas) — dilepas untuk seluruh proses agar agen tetap jalan tanpa riset web.
BLOCKED_SERVER_TOOLS: set[str] = set()


def tool_list() -> list[dict]:
    """Urutan stabil (cache & preserved thinking)."""
    return [*TOOL_DEFS, *[t for t in SERVER_TOOLS if t["type"] not in BLOCKED_SERVER_TOOLS]]


def block_server_tool_from_error(message: str) -> bool:
    """True bila galat API menolak salah satu alat server → alat itu dilepas (panggil ulang setelahnya)."""
    hit = False
    for t in SERVER_TOOLS:
        if t["type"] in message and t["type"] not in BLOCKED_SERVER_TOOLS and "not allowed" in message:
            BLOCKED_SERVER_TOOLS.add(t["type"])
            hit = True
    return hit


# ---------------- pemandu ----------------

def guide() -> dict:
    global _GUIDE
    if _GUIDE is None:
        try:
            _GUIDE = json.loads(GUIDE_PATH.read_text(encoding="utf-8"))
        except FileNotFoundError:
            _GUIDE = {"pages": [], "tours": [], "route_perms": {}}
    return _GUIDE


def can_open(path: str, perms: set[str]) -> bool:
    if "*" in perms:
        return True
    base = path.split("?")[0].rstrip("/") or "/"
    rp = guide().get("route_perms", {})
    need = rp.get(base)
    if need is None:  # cocokkan pola :id
        for pat, req in rp.items():
            if ":" in pat and re.fullmatch(re.sub(r":[^/]+", "[^/]+", pat), base):
                need = req
                break
    if need is None:
        return True  # route tanpa guard spesifik (gate portal tetap berlaku di UI)
    return any(p in perms or any(x.startswith(p + ".") for x in perms) for p in need)


def guide_search(query: str, perms: set[str], limit: int = 6) -> dict:
    g = guide()
    words = {w for w in re.split(r"[^a-z0-9]+", query.lower()) if len(w) > 2}
    expanded = set(words)
    for w in words:
        expanded.update(catalog.SYNONYMS.get(w, []))

    def score(text: str) -> int:
        t = text.lower()
        return sum(2 if w in words else 1 for w in expanded if w in t)
    pages = []
    for p in g.get("pages", []):
        s = score(f"{p['label']} {p['section']} {p['path']} {p.get('portal', '')}")
        if s and can_open(p["path"], perms):
            pages.append((s, p))
    tours = []
    for t in g.get("tours", []):
        s = score(t["name"] + " " + t.get("description", "")) * 2 + score(" ".join(x["title"] for x in t["steps"]))
        if s:
            tours.append((s, t))
    pages.sort(key=lambda x: -x[0])
    tours.sort(key=lambda x: -x[0])
    tour_paths = {tid: [p["path"] for p in g.get("pages", []) if tid in p.get("tours", [])] for _, t in tours[:limit]
                  for tid in [t["id"]]}
    return {
        "halaman": [{"path": p["path"], "nama": p["label"], "bagian": p["section"], "portal": p.get("portal")}
                    for _, p in pages[:limit]],
        "tour": [{"tour_id": t["id"], "nama": t["name"], "deskripsi": t.get("description"),
                  "halaman": tour_paths.get(t["id"], []),
                  "langkah": [f"{x['title']}: {x['content'][:300]}" for x in t["steps"][:10]]} for _, t in tours[:4]],
    }


# ---------------- eksekusi alat ----------------

def chart_spec(args: dict) -> dict:
    """Validasi spesifikasi grafik untuk UI (recharts) — ukuran dibatasi agar riwayat percakapan tetap ringan."""
    from core.exceptions import ValidationError
    t = args.get("type")
    if t not in ("bar", "line", "area", "pie"):
        raise ValidationError("type harus bar/line/area/pie")
    data = [r for r in (args.get("data") or []) if isinstance(r, dict)][:200]
    series = [x for x in (args.get("series") or []) if isinstance(x, dict) and x.get("key")][:6]
    if not data or not series or not args.get("x_key"):
        raise ValidationError("Grafik butuh x_key, series, dan data")
    keys = {args["x_key"], *[x["key"] for x in series]}
    data = [{k: v for k, v in r.items() if k in keys or k.endswith("_name")} for r in data]
    return {"type": t, "title": str(args.get("title") or "")[:120], "x_key": args["x_key"],
            "series": [{"key": x["key"], "label": str(x.get("label") or x["key"])[:60]} for x in series],
            "data": data, "unit": args.get("unit") if args.get("unit") in ("rp", "num", "pct") else "num",
            "stacked": bool(args.get("stacked"))}


class ToolContext:
    def __init__(self, *, user: dict, session: dict, run_id: str, scope: Optional[dict]):
        self.user, self.session, self.run_id, self.scope = user, session, run_id, scope or {}
        self.perms = set(user.get("permissions") or [])
        self.ui: list[dict] = []        # kartu/tautan/file untuk ditampilkan di jawaban
        self.steps: list[dict] = []     # jejak langkah (untuk "cara AI bekerja")


async def run_tool(name: str, args: dict, ctx: ToolContext) -> tuple[Any, bool]:
    """Kembalikan (content_untuk_tool_result, is_error)."""
    try:
        if name == "search_actions":
            kind = args.get("kind") if args.get("kind") in ("read", "write") else None
            ops = catalog.search(args.get("query", ""), ctx.perms, kind=kind, domain=args.get("domain"))
            ctx.steps.append({"tool": name, "label": f"Mencari aksi: {args.get('query', '')}"})
            if not ops:
                return json.dumps({"hasil": [], "catatan": "Tidak ada aksi yang cocok/diizinkan. Coba kata kunci lain "
                                   "atau sampaikan izin yang dibutuhkan."}, ensure_ascii=False), False
            return json.dumps({"hasil": [o.public() for o in ops]}, ensure_ascii=False), False
        if name == "describe_action":
            op = catalog.get(args.get("op_id", ""))
            if not op:
                return "op_id tidak dikenal — cari dulu dengan search_actions", True
            d = op.public(detail=True)
            d["izin"] = {"semua": op.perms_all, "salah_satu": op.perms_any, "anda_boleh": op.allowed_for(ctx.perms)}
            return json.dumps(d, ensure_ascii=False, default=str), False
        if name == "run_read":
            op = catalog.get(args.get("op_id", ""))
            if not op:
                return "op_id tidak dikenal — cari dulu dengan search_actions", True
            if op.kind != "read":
                return "Ini aksi tulis — usulkan lewat propose_actions agar disetujui pengguna", True
            if not op.allowed_for(ctx.perms):
                return f"Pengguna tidak punya izin: {', '.join(op.perms_all or op.perms_any)}", True
            ctx.steps.append({"tool": name, "label": op.summary, "path": op.path})
            res = await executor.call(op, ctx.user, path_params=args.get("path_params") or {},
                                      query=args.get("query") or {}, body=args.get("body"), scope=ctx.scope)
            if "file" in res:
                ctx.ui.append({"type": "file", **res["file"]})
            return executor.compact_for_model(res), "error" in res
        if name == "propose_actions":
            out = await actions.propose(user=ctx.user, session_id=ctx.session["id"], run_id=ctx.run_id,
                                        summary=args.get("summary", ""), items=args.get("actions") or [],
                                        scope=ctx.scope)
            for a in out["actions"]:
                ctx.ui.append({"type": "action", "action_id": a["id"]})
            ctx.steps.append({"tool": name, "label": f"Mengusulkan {len(out['actions'])} aksi"})
            return json.dumps({
                "dibuat": [{"action_id": a["id"], "judul": a["title"], "risiko": a["risk"]} for a in out["actions"]],
                "gagal": out["errors"],
                "catatan": "Menunggu persetujuan pengguna. Jangan menyatakan aksi sudah terjadi.",
            }, ensure_ascii=False), bool(out["errors"]) and not out["actions"]
        if name == "app_guide":
            ctx.steps.append({"tool": name, "label": f"Membaca panduan: {args.get('query', '')}"})
            return json.dumps(guide_search(args.get("query", ""), ctx.perms), ensure_ascii=False), False
        if name == "open_page":
            path = str(args.get("path") or "")
            if not path.startswith("/") or path.startswith("//"):
                return "Path harus diawali '/' (path aplikasi)", True
            if not can_open(path, ctx.perms):
                return "Halaman ini tidak bisa dibuka pengguna (izin route) — jangan tautkan", True
            ctx.ui.append({"type": "link", "path": path, "label": (args.get("label") or path)[:80],
                           "tour_id": args.get("tour_id")})
            return "Tombol tautan ditampilkan ke pengguna.", False
        if name == "read_attachment":
            return await _read_attachment(args.get("attachment_id", ""), int(args.get("max_rows") or 200), ctx)
        if name == "data_catalog":
            ctx.steps.append({"tool": name, "label": "Membaca katalog data" + (f": {args['dataset']}" if args.get("dataset") else "")})
            return json.dumps(datasets.describe(ctx.perms, args.get("dataset")), ensure_ascii=False), False
        if name == "query_data":
            spec = {k: v for k, v in args.items() if k not in ("export", "export_title")}
            d = datasets.DATASETS.get(str(spec.get("dataset")))
            ctx.steps.append({"tool": name, "label": f"Menganalisis data: {d.label if d else spec.get('dataset')}"})
            fmt = args.get("export")
            res = await datasets.run(ctx.user, spec, for_export=bool(fmt))
            out = {k: v for k, v in res.items() if k != "rows"}
            if fmt in ("xlsx", "csv"):
                data, fname, ct = datasets.to_file(res, fmt, args.get("export_title") or res["label"])
                f = await executor.save_file(data, filename=fname, content_type=ct, user=ctx.user, source="query_data")
                ctx.ui.append({"type": "file", **f})
                out["file"] = {"filename": f["filename"], "baris": res["rows_shown"]}
                out["catatan_file"] = "File siap diunduh pengguna (tombol muncul di jawaban)."
            out["rows"] = res["rows"][:datasets.ROWS_TO_MODEL]
            if res["truncated"]:
                out["peringatan"] = (f"Hanya {len(out['rows'])} dari {res['total_rows']} baris ditampilkan — "
                                     "agregasikan/filter lebih spesifik, atau pakai export untuk data lengkap.")
            return json.dumps(out, ensure_ascii=False, default=str)[:60_000], False
        if name == "show_chart":
            spec = chart_spec(args)
            if args.get("source_query"):
                await datasets.run(ctx.user, args["source_query"], max_rows=1)  # validasi izin & field sumber
                spec["source_query"] = args["source_query"]
            ctx.ui.append({"type": "chart", "spec": spec})
            ctx.steps.append({"tool": name, "label": f"Membuat grafik: {spec.get('title') or spec['type']}"})
            return "Grafik ditampilkan ke pengguna (bisa disematkan ke Dashboard AI).", False
        if name == "create_report":
            ctx.steps.append({"tool": name, "label": f"Menyusun laporan {str(args.get('format') or 'xlsx').upper()}: {args.get('title', '')}"})
            data, fname, ct = reports.build(args)
            f = await executor.save_file(data, filename=fname, content_type=ct, user=ctx.user, source="create_report")
            ctx.ui.append({"type": "file", **f})
            return json.dumps({"file": f["filename"], "ukuran_kb": round(len(data) / 1024, 1),
                               "catatan": "Tombol unduh muncul di jawaban; jangan tulis URL."}, ensure_ascii=False), False
        if name in ("remember", "forget", "search_knowledge", "save_research_note"):
            return await _knowledge_tool(name, args, ctx)
        return f"Alat tidak dikenal: {name}", True
    except Exception as e:  # noqa: BLE001 — galat alat dikembalikan ke model, bukan menghentikan run
        return f"Galat: {type(e).__name__}: {str(e)[:500]}", True


async def _knowledge_tool(name: str, args: dict, ctx: ToolContext) -> tuple[Any, bool]:
    from services.ai import knowledge as kb
    if name == "remember":
        scope = args.get("scope") if args.get("scope") in ("pribadi", "perusahaan") else "pribadi"
        if scope == "perusahaan" and not kb.can_manage(ctx.user):
            scope = "pribadi"
        m = await kb.save_memory(ctx.user, content=str(args.get("content") or ""), kind=str(args.get("kind") or "fakta"),
                                 scope=scope, source="chat", session_id=ctx.session["id"])
        ctx.steps.append({"tool": name, "label": f"Mengingat ({m['scope']}): {m['content'][:60]}"})
        ctx.ui.append({"type": "link", "path": "/ai/knowledge", "label": "Lihat memori"})
        return json.dumps({"disimpan": {"id": m["id"], "scope": m["scope"]},
                           "catatan": "Beri tahu pengguna apa yang diingat (bisa dihapus di Memori & Pengetahuan)."}, ensure_ascii=False), False
    if name == "forget":
        mid = str(args.get("memory_id") or "")
        mems = await kb.list_memories(ctx.user)
        hit = [m for m in mems if m["id"] == mid or (len(mid) >= 6 and m["id"].startswith(mid))]
        if len(hit) != 1:
            return "Memori tidak ditemukan / id ambigu", True
        await kb.delete_memory(ctx.user, hit[0]["id"])
        ctx.steps.append({"tool": name, "label": "Menghapus memori"})
        return json.dumps({"dihapus": hit[0]["content"][:120]}, ensure_ascii=False), False
    if name == "search_knowledge":
        ctx.steps.append({"tool": name, "label": f"Mencari di basis pengetahuan: {args.get('query', '')}"})
        return json.dumps(await kb.search(str(args.get("query") or ""), k=min(int(args.get("k") or 6), 12)),
                          ensure_ascii=False)[:40_000], False
    n = await kb.save_research(ctx.user, topic=str(args.get("topic") or ""), summary=str(args.get("summary") or ""),
                               sources=args.get("sources"), tags=args.get("tags"), session_id=ctx.session["id"])
    ctx.steps.append({"tool": name, "label": f"Menyimpan catatan riset: {n['topic'][:60]}"})
    return json.dumps({"disimpan": n["id"]}, ensure_ascii=False), False


# Format gambar yang bisa dibaca model; HEIC/HEIF (kamera iPhone) belum → minta JPG/PNG.
MODEL_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"}


def model_readable(ct: str) -> bool:
    return ct in MODEL_IMAGE_TYPES or ct == "application/pdf"


async def _read_attachment(att_id: str, max_rows: int, ctx: ToolContext):
    from services import upload_service
    meta = await upload_service.get_attachment(att_id, user=ctx.user)
    data = await upload_service.get_attachment_bytes(att_id, user=ctx.user)
    ct = (meta.get("content_type") or "").lower()
    name = meta.get("filename") or att_id
    ctx.steps.append({"tool": "read_attachment", "label": f"Membaca lampiran {name}"})
    if model_readable(ct):
        block = await file_content_block(att_id, data, ct, name)
        return [block, {"type": "text", "text": f"Lampiran: {name} ({ct})"}], False
    if ct in ("text/csv", "application/vnd.ms-excel", "application/csv") or name.lower().endswith((".csv", ".xlsx", ".xls")):
        return table_preview(data, name, max_rows), False
    if ct.startswith("text/"):
        return data.decode("utf-8", errors="replace")[:30_000], False
    if ct.startswith("image/"):
        return f"Format gambar {ct} belum bisa dibaca — minta pengguna mengirim ulang sebagai JPG/PNG", True
    return f"Jenis lampiran {ct} belum bisa dibaca", True


def table_preview(data: bytes, name: str, max_rows: int = 200) -> str:
    import io
    import pandas as pd
    out = []
    if name.lower().endswith(".csv"):
        sheets = {"csv": pd.read_csv(io.BytesIO(data), dtype=str, sep=None, engine="python", header=None)}
    else:
        sheets = pd.read_excel(io.BytesIO(data), dtype=str, sheet_name=None, header=None)
    for sname, df in list(sheets.items())[:6]:
        df = df.dropna(how="all").dropna(axis=1, how="all")
        out.append(f"## Sheet {sname}: {len(df)} baris × {df.shape[1]} kolom (baris mentah, termasuk kop)")
        out.append(df.head(max_rows).fillna("").to_csv(index=False, header=False))
    return "\n".join(out)[:40_000]


async def file_content_block(att_id: str, data: bytes, content_type: str, name: str) -> dict:
    """Unggah sekali ke Files API Anthropic (simpan file_id) → blok konten ringan untuk riwayat percakapan."""
    from services.ai import client as ai_client
    db = get_db()
    rec = await db.attachments.find_one({"id": att_id}, {"anthropic_file_id": 1})
    fid = (rec or {}).get("anthropic_file_id")
    if not fid:
        client = await ai_client.get_client()
        up = await client.files.upload(file=(name, data, content_type), expires_in_seconds=30 * 24 * 3600)
        fid = up.id
        await db.attachments.update_one({"id": att_id}, {"$set": {"anthropic_file_id": fid}})
    kind = "document" if content_type == "application/pdf" else "image"
    return {"type": kind, "source": {"type": "file", "file_id": fid}}
