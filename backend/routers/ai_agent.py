"""/api/ai/agent — Asisten AI agentic (chat, run, sesi, usulan aksi & persetujuan, file hasil).

Semua butuh `ai.agent.use`. Aksi yang dijalankan agen tetap dicek izinnya oleh route domain masing-masing.
Rencana: docs/ai/AGENTIC_AI_PLAN_2026-11-25.md.
"""
from typing import Optional

from fastapi import APIRouter, Body, Depends, Query
from fastapi.responses import Response

from core.db import get_db
from core.exceptions import NotFoundError, ValidationError, ok_envelope
from core.security import require_perm
from services.ai.agent import actions, catalog, runtime

router = APIRouter(prefix="/api/ai/agent", tags=["ai-agent"])
USE = "ai.agent.use"


@router.post("/chat")
async def chat(payload: dict = Body(...), user: dict = Depends(require_perm(USE))):
    """{message, session_id?, attachments?: [attachment_id], context?: {path, title}, scope?: {brand_id, outlet_id,
    brand_name, outlet_name}} → {session_id, run_id}. Poll GET /runs/{run_id} untuk langkah & jawaban."""
    return ok_envelope(await runtime.start_run(
        user, message=str(payload.get("message") or ""), session_id=payload.get("session_id") or None,
        attachments=[a for a in (payload.get("attachments") or []) if isinstance(a, str)][:10],
        context=payload.get("context") or None, scope=payload.get("scope") or None))


@router.get("/runs/{run_id}")
async def get_run(run_id: str, user: dict = Depends(require_perm(USE))):
    return ok_envelope(await runtime.get_run(run_id, user))


@router.get("/sessions")
async def list_sessions(limit: int = Query(30, ge=1, le=100), user: dict = Depends(require_perm(USE))):
    return ok_envelope(await runtime.list_sessions(user, limit))


@router.get("/sessions/{session_id}")
async def get_session(session_id: str, user: dict = Depends(require_perm(USE))):
    return ok_envelope(await runtime.session_view(session_id, user))


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, user: dict = Depends(require_perm(USE))):
    await runtime.delete_session(session_id, user)
    return ok_envelope({"deleted": True})


@router.get("/actions")
async def list_actions(status: Optional[str] = Query(None), limit: int = Query(50, ge=1, le=200),
                       user: dict = Depends(require_perm(USE))):
    q: dict = {"user_id": user["id"]}
    if status:
        q["status"] = {"$in": status.split(",")}
    rows = await get_db().ai_actions.find(q, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return ok_envelope(rows)


@router.get("/actions/{action_id}")
async def get_action(action_id: str, user: dict = Depends(require_perm(USE))):
    a = await get_db().ai_actions.find_one({"id": action_id, "user_id": user["id"]}, {"_id": 0})
    if not a:
        raise NotFoundError("Usulan aksi")
    return ok_envelope(a)


@router.post("/actions/{action_id}/approve")
async def approve(action_id: str, payload: dict = Body(default={}), user: dict = Depends(require_perm(USE))):
    """Setujui & jalankan. Body opsional: {body: <isi yang diedit pengguna>, continue: true}."""
    payload = payload or {}
    a = await actions.approve(action_id, user, body=payload.get("body") if "body" in payload else None)
    follow = await runtime.continue_after_decisions(a, user) if payload.get("continue", True) else None
    return ok_envelope({"action": a, "followup": follow})


@router.post("/actions/{action_id}/reject")
async def reject(action_id: str, payload: dict = Body(default={}), user: dict = Depends(require_perm(USE))):
    payload = payload or {}
    a = await actions.reject(action_id, user, reason=str(payload.get("reason") or ""))
    follow = await runtime.continue_after_decisions(a, user) if payload.get("continue", True) else None
    return ok_envelope({"action": a, "followup": follow})


@router.post("/actions/batch")
async def decide_batch(payload: dict = Body(...), user: dict = Depends(require_perm(USE))):
    """{ids: [...], decision: "approve"|"reject", reason?} — keputusan massal (mis. 15 jurnal dari foto struk)."""
    ids = [i for i in (payload.get("ids") or []) if isinstance(i, str)][:100]
    out = []
    last = None
    for i in ids:
        a = (await actions.approve(i, user) if payload.get("decision") == "approve"
             else await actions.reject(i, user, reason=str(payload.get("reason") or "")))
        out.append(a)
        last = a
    follow = await runtime.continue_after_decisions(last, user) if last and payload.get("continue", True) else None
    return ok_envelope({"actions": out, "followup": follow})


@router.get("/files", summary="Pustaka laporan: file yang dibuat Asisten AI untuk saya")
async def list_files(user: dict = Depends(require_perm("ai.agent.use"))):
    rows = await get_db().ai_files.find({"user_id": user["id"], "deleted_at": None},
                                        {"_id": 0, "storage_path": 0}).sort("created_at", -1).to_list(500)
    return ok_envelope(rows)


@router.delete("/files/{file_id}", summary="Hapus file dari pustaka laporan")
async def delete_file(file_id: str, user: dict = Depends(require_perm("ai.agent.use"))):
    from datetime import datetime, timezone
    res = await get_db().ai_files.update_one({"id": file_id, "user_id": user["id"]},
                                             {"$set": {"deleted_at": datetime.now(timezone.utc).isoformat()}})
    if not res.matched_count:
        raise NotFoundError("File")
    return ok_envelope({"deleted": True})


@router.get("/files/{file_id}")
async def download_file(file_id: str, user: dict = Depends(require_perm(USE))):
    f = await get_db().ai_files.find_one({"id": file_id, "user_id": user["id"]})
    if not f:
        raise NotFoundError("File")
    from core.object_storage import get_object
    data, _ = await get_object(f["storage_path"])
    return Response(content=data, media_type=f.get("content_type") or "application/octet-stream",
                    headers={"Content-Disposition": f'attachment; filename="{f["filename"]}"'})


# ---------------- Dashboard AI (grafik yang disematkan) ----------------

@router.get("/pins")
async def list_pins(user: dict = Depends(require_perm(USE))):
    rows = await get_db().ai_pins.find({"user_id": user["id"], "deleted_at": None}, {"_id": 0}).sort(
        "position", 1).to_list(100)
    return ok_envelope(rows)


@router.post("/pins")
async def create_pin(payload: dict = Body(...), user: dict = Depends(require_perm(USE))):
    """{spec: <spesifikasi grafik dari jawaban AI, boleh berisi source_query>, title?, session_id?}"""
    import uuid
    from datetime import datetime, timezone
    from services.ai.agent import datasets, tools
    raw = dict(payload.get("spec") or {})
    if raw.get("source_query"):
        # isi data dari sumbernya (sekaligus cek izin & field) → grafik tersemat selalu data terbaru
        res = await datasets.run(user, raw["source_query"], max_rows=200)
        raw["data"] = res["rows"]
    spec = tools.chart_spec(raw)
    if raw.get("source_query"):
        spec["source_query"] = raw["source_query"]
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    count = await db.ai_pins.count_documents({"user_id": user["id"], "deleted_at": None})
    if count >= 30:
        raise ValidationError("Maksimal 30 grafik di Dashboard AI — hapus yang tidak dipakai")
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], "title": str(payload.get("title") or spec["title"] or "Grafik")[:120],
           "spec": spec, "session_id": payload.get("session_id"), "position": count, "created_at": now,
           "refreshed_at": now, "deleted_at": None}
    await db.ai_pins.insert_one(doc)
    doc.pop("_id", None)
    return ok_envelope(doc)


@router.post("/pins/{pin_id}/refresh")
async def refresh_pin(pin_id: str, user: dict = Depends(require_perm(USE))):
    """Jalankan ulang source_query (periode relatif → data terbaru) sebagai pengguna ini."""
    from datetime import datetime, timezone
    from services.ai.agent import datasets
    db = get_db()
    pin = await db.ai_pins.find_one({"id": pin_id, "user_id": user["id"], "deleted_at": None}, {"_id": 0})
    if not pin:
        raise NotFoundError("Grafik")
    q = (pin.get("spec") or {}).get("source_query")
    if not q:
        raise ValidationError("Grafik ini tidak punya sumber data — minta AI membuat ulang dengan source_query")
    res = await datasets.run(user, q, max_rows=200)
    keep = {pin["spec"]["x_key"], *[s["key"] for s in pin["spec"]["series"]]}
    data = [{k: v for k, v in r.items() if k in keep or k.endswith("_name")} for r in res["rows"]]
    now = datetime.now(timezone.utc).isoformat()
    await db.ai_pins.update_one({"id": pin_id}, {"$set": {"spec.data": data, "refreshed_at": now}})
    return ok_envelope({**pin, "spec": {**pin["spec"], "data": data}, "refreshed_at": now})


@router.delete("/pins/{pin_id}")
async def delete_pin(pin_id: str, user: dict = Depends(require_perm(USE))):
    from datetime import datetime, timezone
    r = await get_db().ai_pins.update_one({"id": pin_id, "user_id": user["id"], "deleted_at": None},
                                          {"$set": {"deleted_at": datetime.now(timezone.utc).isoformat()}})
    if not r.matched_count:
        raise NotFoundError("Grafik")
    return ok_envelope({"deleted": True})


@router.get("/capabilities")
async def capabilities(user: dict = Depends(require_perm(USE))):
    """Ringkasan domain & jumlah aksi yang bisa dipakai AI untuk pengguna ini (untuk UI & diagnosa)."""
    perms = set(user.get("permissions") or [])
    ops = [o for o in catalog.catalog() if o.allowed_for(perms)]
    return ok_envelope({"domains": catalog.domains(perms), "total": len(ops),
                        "read": sum(o.kind == "read" for o in ops), "write": sum(o.kind == "write" for o in ops)})
