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

from . import actions, catalog, executor

GUIDE_PATH = Path(__file__).with_name("app_guide.json")
_GUIDE: Optional[dict] = None

TOOLS_VERSION = "2026-11-25.1"

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
        return f"Alat tidak dikenal: {name}", True
    except Exception as e:  # noqa: BLE001 — galat alat dikembalikan ke model, bukan menghentikan run
        return f"Galat: {type(e).__name__}: {str(e)[:500]}", True


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
