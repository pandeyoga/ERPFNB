"""AI Data Steward: deteksi master data ganda (item, supplier, menu) dan data belum lengkap.

Nama dinormalisasi (huruf kecil, tanpa tanda baca, tanpa awalan badan usaha "PT/CV/UD/Toko", ukuran kemasan & kata
umum dibuang) lalu dibandingkan dengan rasio kemiripan; supplier juga dicocokkan lewat NPWP, nomor rekening & telepon
yang sama. Setiap kelompok berisi jumlah pemakaian per record (PO, GR, mutasi stok, penawaran, resep / hutang) supaya
record yang dipertahankan = yang paling banyak dipakai. Duplikat yang belum pernah dipakai bisa dinonaktifkan
(`deactivate`); yang sudah dipakai perlu penggabungan manual (tidak dipindah otomatis agar riwayat transaksi utuh).
"""
from __future__ import annotations

import re
from collections import defaultdict
from datetime import datetime, timezone
from difflib import SequenceMatcher
from typing import Optional

from core.audit import log as audit_log
from core.db import get_db
from core.exceptions import NotFoundError, ValidationError

_ENTITY = {"items": "items", "vendors": "vendors"}
_LEGAL = re.compile(r"^(pt|cv|ud|toko|tk|pd|koperasi|kop|fa|firma)\.?\s+|\s+(pt|cv|tbk)\.?$")
_SIZE = re.compile(r"\b\d+([.,]\d+)?\s*(kg|gr|g|gram|ml|l|lt|liter|ltr|pcs|pack|btl|dus|x)\b")
_STOP = {"premium", "fresh", "segar", "original", "asli", "baru", "new", "lokal", "import", "the", "dan", "&"}


def _tokens(s: Optional[str], entity: str) -> list[str]:
    s = (s or "").lower().strip()
    if entity == "vendors":
        s = _LEGAL.sub(" ", s)
    s = _SIZE.sub(" ", s)
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    return [t for t in s.split() if entity != "items" or t not in _STOP]


def norm_name(s: Optional[str], entity: str = "items") -> str:
    """Token terurut (urutan kata tidak berpengaruh)."""
    return " ".join(sorted(_tokens(s, entity)))


def compact(s: Optional[str], entity: str = "items") -> str:
    """Tanpa spasi, urutan asli ("Full Cream" = "FullCream")."""
    return "".join(_tokens(s, entity))


def similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    ta, tb = set(a.split()), set(b.split())
    jac = len(ta & tb) / len(ta | tb) if ta | tb else 0
    return max(SequenceMatcher(None, a, b).ratio(), jac)


def _digits(s) -> str:
    return re.sub(r"\D", "", str(s or ""))


async def _usage(entity: str, ids: list[str]) -> dict[str, dict]:
    db = get_db()
    out: dict[str, dict] = {i: {} for i in ids}
    if entity == "items":
        checks = [("PO", db.purchase_orders, "lines.item_id"), ("GR", db.goods_receipts, "lines.item_id"),
                  ("mutasi stok", db.inventory_movements, "item_id"), ("penawaran", db.supplier_prices, "item_id"),
                  ("resep", db.recipes, "lines.item_id")]
    else:
        checks = [("PO", db.purchase_orders, "vendor_id"), ("GR", db.goods_receipts, "vendor_id"),
                  ("hutang", db.ap_ledgers, "vendor_id"), ("penawaran", db.supplier_prices, "vendor_id")]
    for label, col, field in checks:
        for i in ids:
            n = await col.count_documents({field: i, "deleted_at": None})
            if n:
                out[i][label] = n
    return out


async def find_duplicates(entity: str, *, threshold: float = 0.88, limit: int = 100) -> dict:
    if entity not in _ENTITY:
        raise ValidationError("entity harus items | vendors")
    db = get_db()
    proj = {"_id": 0, "id": 1, "name": 1, "code": 1, "unit_default": 1, "category": 1, "category_id": 1, "npwp": 1,
            "bank_account_number": 1, "bank_account": 1, "phone": 1, "active": 1}
    rows = await db[_ENTITY[entity]].find({"deleted_at": None, "active": {"$ne": False}}, proj).to_list(20000)
    for r in rows:
        r["_n"] = norm_name(r.get("name"), entity)
        r["_c"] = compact(r.get("name"), entity)
    # union-find atas pasangan yang mirip / identitas sama
    parent = {r["id"]: r["id"] for r in rows}
    reason: dict[tuple, str] = {}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b, why):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra
        reason[tuple(sorted((a, b)))] = why

    if entity == "vendors":
        for key, label in (("npwp", "NPWP sama"), ("bank_account_number", "rekening sama"), ("phone", "telepon sama")):
            seen: dict[str, str] = {}
            for r in rows:
                v = _digits(r.get(key) or (r.get("bank_account") if key == "bank_account_number" else None))
                if len(v) >= 8:
                    if v in seen:
                        union(seen[v], r["id"], label)
                    else:
                        seen[v] = r["id"]
    # perbandingan nama: kelompokkan per token pertama agar tidak O(n²) penuh
    buckets: dict[str, list] = defaultdict(list)
    for r in rows:
        for t in set(r["_n"].split()[:3]):
            if len(t) >= 3:
                buckets[t].append(r)
    for bucket in buckets.values():
        if len(bucket) > 400:
            continue
        for i, a in enumerate(bucket):
            for b in bucket[i + 1:]:
                if a["id"] == b["id"] or find(a["id"]) == find(b["id"]):
                    continue
                if entity == "items" and a.get("unit_default") and b.get("unit_default"):
                    from services.ai_purchasing.units import dim_of
                    if dim_of(a["unit_default"])[0] != dim_of(b["unit_default"])[0]:
                        continue                      # beda dimensi satuan (kg vs pcs) → bukan duplikat
                sc = max(similarity(a["_n"], b["_n"]), similarity(a["_c"], b["_c"]))
                if sc >= threshold:
                    union(a["id"], b["id"], "nama sama" if sc == 1 else f"nama mirip {sc:.0%}")
    groups: dict[str, list] = defaultdict(list)
    for r in rows:
        groups[find(r["id"])].append(r)
    found = [g for g in groups.values() if len(g) > 1]
    usage = await _usage(entity, [r["id"] for g in found for r in g])
    out = []
    for g in found:
        recs = []
        for r in g:
            u = usage.get(r["id"]) or {}
            recs.append({"id": r["id"], "name": r.get("name"), "code": r.get("code"), "unit": r.get("unit_default"),
                         "pemakaian": u, "total_pemakaian": sum(u.values())})
        recs.sort(key=lambda x: -x["total_pemakaian"])
        ids = [r["id"] for r in g]
        whys = sorted({w for (a, b), w in reason.items() if a in ids and b in ids})
        keep = recs[0]
        out.append({"alasan": ", ".join(whys), "pertahankan": keep["id"], "records": recs,
                    "saran": [{"id": r["id"], "aksi": "nonaktifkan" if not r["total_pemakaian"] else "gabung manual"}
                              for r in recs[1:]]})
    out.sort(key=lambda g: -len(g["records"]))
    return {"entity": entity, "kelompok": out[:limit], "jumlah_kelompok": len(out)}


async def similar(entity: str, name: str, *, limit: int = 5) -> list[dict]:
    """Cek sebelum membuat master baru: record dengan nama mirip (≥ 0,75)."""
    if entity not in _ENTITY:
        raise ValidationError("entity harus items | vendors")
    n, c = norm_name(name, entity), compact(name, entity)
    rows = await get_db()[_ENTITY[entity]].find({"deleted_at": None}, {"_id": 0, "id": 1, "name": 1, "code": 1}).to_list(20000)
    scored = [(max(similarity(n, norm_name(r.get("name"), entity)), similarity(c, compact(r.get("name"), entity))), r) for r in rows]
    return [{**r, "kemiripan": round(s, 2)} for s, r in sorted(scored, key=lambda x: -x[0]) if s >= 0.75][:limit]


async def completeness(entity: str) -> dict:
    """Master yang belum lengkap: item tanpa satuan/kategori; supplier tanpa NPWP/rekening/telepon."""
    if entity not in _ENTITY:
        raise ValidationError("entity harus items | vendors")
    need = {"items": [("unit_default", "satuan"), ("category_id", "kategori")],
            "vendors": [("npwp", "NPWP"), ("bank_account_number", "rekening"), ("phone", "telepon")]}[entity]
    rows = await get_db()[_ENTITY[entity]].find({"deleted_at": None, "active": {"$ne": False}}, {"_id": 0}).to_list(20000)
    out = []
    for r in rows:
        miss = [label for f, label in need if not r.get(f) and not (f == "category_id" and r.get("category"))]
        if miss:
            out.append({"id": r["id"], "name": r.get("name"), "kurang": miss})
    return {"entity": entity, "total": len(rows), "belum_lengkap": len(out), "rows": out[:500]}


async def deactivate(entity: str, dup_id: str, keep_id: str, *, user: dict) -> dict:
    """Nonaktifkan duplikat yang belum pernah dipakai transaksi (riwayat tetap utuh)."""
    if entity not in _ENTITY or dup_id == keep_id:
        raise ValidationError("entity/id tidak valid")
    db = get_db()
    col = db[_ENTITY[entity]]
    dup = await col.find_one({"id": dup_id, "deleted_at": None}, {"_id": 0})
    keep = await col.find_one({"id": keep_id, "deleted_at": None}, {"_id": 0, "id": 1, "name": 1})
    if not dup or not keep:
        raise NotFoundError("Record")
    used = (await _usage(entity, [dup_id]))[dup_id]
    if used:
        raise ValidationError(f"'{dup.get('name')}' sudah dipakai ({', '.join(f'{k} {v}' for k, v in used.items())}) — "
                              "gabungkan manual agar riwayat transaksi tidak berubah")
    now = datetime.now(timezone.utc).isoformat()
    await col.update_one({"id": dup_id}, {"$set": {"active": False, "merged_into": keep_id, "updated_at": now}})
    await col.update_one({"id": keep_id}, {"$addToSet": {"aliases": dup.get("name")}})
    await audit_log(user_id=user["id"], entity_type=_ENTITY[entity], entity_id=dup_id, action="deactivate_duplicate",
                    before={"active": dup.get("active", True)}, after={"active": False, "merged_into": keep_id})
    return {"id": dup_id, "nonaktif": True, "digabung_ke": keep["name"]}
