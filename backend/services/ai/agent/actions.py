"""Usulan aksi tulis dari agen → persetujuan pengguna → eksekusi lewat API sebagai pengguna.

Status: pending → executing → done | failed; pending → rejected | cancelled. Transisi atomik (klik dobel /
pesan WA terkirim ulang tidak mengeksekusi dua kali). Hanya pemilik sesi yang bisa menyetujui; izin domain tetap
dicek oleh route yang dipanggil. Semua tercatat di audit log (usulan asli, perubahan pengguna, hasil).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from core.audit import log as audit_log
from core.db import get_db, serialize
from core.exceptions import ForbiddenError, NotFoundError, ValidationError

from . import catalog, executor

RISK_LABEL = {"rendah": "Rendah", "sedang": "Sedang", "tinggi": "Tinggi", "kritis": "Kritis"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _preview(op: catalog.Op, user: dict, path_params: dict, body: Any, scope: Optional[dict]) -> Optional[dict]:
    """Untuk ubah/hapus: ambil data saat ini (bila ada GET pada path yang sama) agar UI bisa menampilkan sebelum→sesudah."""
    if op.method not in ("PUT", "PATCH", "DELETE"):
        return None
    get_op = next((o for o in catalog.catalog() if o.method == "GET" and o.path == op.path), None)
    if not get_op or not get_op.allowed_for(set(user.get("permissions") or [])):
        return None
    try:
        res = await executor.call(get_op, user, path_params=path_params, scope=scope)
    except Exception:  # noqa: BLE001
        return None
    cur = res.get("data")
    if not isinstance(cur, dict):
        return None
    if op.method == "DELETE":
        return {"sebelum": {k: v for k, v in cur.items() if not k.startswith("_")}}
    if isinstance(body, dict):
        return {"perubahan": [{"field": k, "sebelum": cur.get(k), "sesudah": v} for k, v in body.items()
                              if cur.get(k) != v]}
    return None


async def propose(*, user: dict, session_id: str, run_id: Optional[str], summary: str, items: list[dict],
                  scope: Optional[dict] = None) -> dict:
    """Buat satu batch usulan. Mengembalikan {batch_id, actions:[...]} atau error per item."""
    from services.ai import client as ai_client
    policy = await ai_client.get_policy()
    if not policy.get("write_actions_enabled", True):
        raise ValidationError("Aksi tulis oleh AI sedang dimatikan (AI Hub → Pengaturan).")
    if not items:
        raise ValidationError("Tidak ada aksi yang diusulkan")
    perms = set(user.get("permissions") or [])
    batch_id = str(uuid.uuid4())
    created, errors = [], []
    for i, it in enumerate(items[:50]):
        op = catalog.get(it.get("op_id", ""))
        if not op:
            errors.append({"index": i, "error": f"op_id tidak dikenal: {it.get('op_id')}"})
            continue
        if op.kind != "write":
            errors.append({"index": i, "error": f"{op.id} adalah aksi baca — jalankan dengan run_read"})
            continue
        if not op.allowed_for(perms):
            errors.append({"index": i, "error": f"Anda tidak punya izin untuk {op.summary} "
                                                f"({', '.join(op.perms_all or op.perms_any)})"})
            continue
        try:
            path = executor._resolve_path(op, it.get("path_params") or {})
        except executor.ActionError as e:
            errors.append({"index": i, "error": str(e)})
            continue
        doc = {
            "id": str(uuid.uuid4()), "batch_id": batch_id, "session_id": session_id, "run_id": run_id,
            "user_id": user["id"], "op_id": op.id, "method": op.method, "path_template": op.path, "path": path,
            "path_params": it.get("path_params") or {}, "query": it.get("query") or {}, "body": it.get("body"),
            "original_body": it.get("body"), "title": (it.get("title") or op.summary)[:200],
            "reason": (it.get("reason") or "")[:1000], "batch_summary": summary[:1000], "risk": op.risk,
            "scope": scope or {}, "status": "pending", "preview": None, "result": None, "error": None,
            "idempotency_key": str(uuid.uuid4()), "created_at": _now(), "decided_at": None, "decided_by": None,
        }
        doc["preview"] = await _preview(op, user, doc["path_params"], doc["body"], scope)
        await get_db().ai_actions.insert_one(doc)
        await audit_log(user_id=user["id"], entity_type="ai_action", entity_id=doc["id"], action="propose",
                        after={k: doc[k] for k in ("op_id", "method", "path", "body", "title", "risk")})
        created.append(serialize(doc))
    return {"batch_id": batch_id, "actions": created, "errors": errors}


async def _get_owned(action_id: str, user: dict) -> dict:
    a = await get_db().ai_actions.find_one({"id": action_id})
    if not a:
        raise NotFoundError("Usulan aksi")
    if a["user_id"] != user["id"]:
        raise ForbiddenError("Hanya peminta yang bisa memutuskan usulan ini")
    return a


async def approve(action_id: str, user: dict, *, body: Any = None) -> dict:
    """Setujui (opsional dengan body yang diedit) → jalankan. Idempoten: aksi yang sudah jalan tidak diulang."""
    from services.ai import client as ai_client
    a = await _get_owned(action_id, user)
    if a["status"] != "pending":
        return serialize(a)
    policy = await ai_client.get_policy()
    if not policy.get("write_actions_enabled", True):
        raise ValidationError("Aksi tulis oleh AI sedang dimatikan (AI Hub → Pengaturan).")
    db = get_db()
    upd: dict = {"status": "executing", "decided_at": _now(), "decided_by": user["id"]}
    if body is not None:
        upd["body"] = body
    claimed = await db.ai_actions.find_one_and_update({"id": action_id, "status": "pending"}, {"$set": upd},
                                                      return_document=True)
    if not claimed:  # keputusan lain sudah masuk duluan
        return serialize(await db.ai_actions.find_one({"id": action_id}))
    op = catalog.get(claimed["op_id"])
    if not op:
        res = {"status": 410, "error": "Aksi sudah tidak tersedia di sistem"}
    else:
        res = await executor.call(op, user, path_params=claimed["path_params"], query=claimed["query"],
                                  body=claimed.get("body"), scope=claimed.get("scope"),
                                  idempotency_key=claimed["idempotency_key"])
    ok = "error" not in res
    final = {"status": "done" if ok else "failed", "finished_at": _now(),
             "result": _short_result(res) if ok else None, "error": None if ok else res.get("error"),
             "errors": None if ok else res.get("errors")}
    await db.ai_actions.update_one({"id": action_id}, {"$set": final})
    await audit_log(user_id=user["id"], entity_type="ai_action", entity_id=action_id,
                    action="execute" if ok else "execute_failed",
                    before={"body": claimed.get("original_body")}, after={"body": claimed.get("body"), **final})
    return serialize(await db.ai_actions.find_one({"id": action_id}))


async def reject(action_id: str, user: dict, *, reason: str = "") -> dict:
    a = await _get_owned(action_id, user)
    if a["status"] != "pending":
        return serialize(a)
    db = get_db()
    await db.ai_actions.update_one({"id": action_id, "status": "pending"},
                                   {"$set": {"status": "rejected", "decided_at": _now(), "decided_by": user["id"],
                                             "reject_reason": (reason or "")[:500]}})
    await audit_log(user_id=user["id"], entity_type="ai_action", entity_id=action_id, action="reject",
                    after={"reason": reason})
    return serialize(await db.ai_actions.find_one({"id": action_id}))


def _short_result(res: dict) -> Any:
    if "file" in res:
        return {"file": res["file"]}
    data = res.get("data")
    if isinstance(data, dict):
        keep = ("id", "doc_no", "je_number", "status", "name", "code", "title", "grand_total", "total", "amount")
        return {k: data[k] for k in keep if k in data} or {"ok": True}
    return {"ok": True}


async def batch_settled(batch_id: str) -> bool:
    return await get_db().ai_actions.count_documents({"batch_id": batch_id, "status": {"$in": ["pending", "executing"]}}) == 0


def outcome_text(actions: list[dict]) -> str:
    """Ringkasan keputusan untuk diteruskan ke agen pada giliran berikutnya."""
    lines = []
    for a in actions:
        st = {"done": "BERHASIL", "failed": "GAGAL", "rejected": "DITOLAK pengguna", "cancelled": "DIBATALKAN"}.get(
            a["status"], a["status"])
        extra = ""
        if a["status"] == "done" and a.get("result"):
            extra = f" — hasil: {a['result']}"
        elif a["status"] == "failed":
            extra = f" — galat: {a.get('error')}"
        elif a["status"] == "rejected" and a.get("reject_reason"):
            extra = f" — alasan: {a['reject_reason']}"
        edited = " (isi diubah pengguna sebelum disetujui)" if a.get("body") != a.get("original_body") else ""
        lines.append(f"- {a['title']} [{a['method']} {a['path']}]: {st}{edited}{extra}")
    return "\n".join(lines)
