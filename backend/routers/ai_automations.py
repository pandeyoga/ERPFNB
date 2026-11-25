"""/api/ai/automations — Monitor & Otomasi Asisten AI (instruksi terjadwal & pengecekan kondisi).

Dibuat dari layar Monitor & Otomasi atau diusulkan Asisten AI (POST lewat persetujuan pengguna). Berjalan dengan izin
pembuatnya; lihat services/ai/automations.py.
"""
from fastapi import APIRouter, Body, Depends, Query

from core.exceptions import ok_envelope
from core.security import require_perm
from services.ai import automations as auto

router = APIRouter(prefix="/api/ai/automations", tags=["ai-automations"])
_AUTO = require_perm("ai.agent.automate")


@router.get("", summary="Daftar monitor & otomasi saya")
async def list_automations(all: bool = Query(False), user: dict = Depends(_AUTO)):
    perms = set(user.get("permissions") or [])
    return ok_envelope(await auto.list_for(user, all_users=all and ("*" in perms or "ai.agent.admin" in perms)))


@router.get("/templates", summary="Templat kondisi monitor (tanpa biaya AI)")
async def templates(user: dict = Depends(_AUTO)):
    return ok_envelope([{"id": k, "label": v["label"], "unit": v["unit"], "op": v["op"], "threshold": v.get("threshold"),
                         "dataset": v["spec"]["dataset"]} for k, v in auto.TEMPLATES.items()])


@router.post("", summary="Buat monitor/otomasi")
async def create_automation(payload: dict = Body(...), user: dict = Depends(_AUTO)):
    """{name, kind: agen|kondisi, schedule: {freq: hourly|daily|weekly|monthly, time: "HH:MM", weekday?: 0=Senin, day?: 1-28},
    channels: ["app","whatsapp"], instruction? (agen), monitor?: bool (agen: kirim hanya bila ada temuan),
    condition? (kondisi): {template: sales_low|anomaly_new|opname_loss|purchases_high|petty_high | spec: <query_data>,
    op: < <= > >=, threshold, value_key?: "nilai"}}"""
    return ok_envelope(await auto.create(payload, user))


@router.patch("/{automation_id}", summary="Ubah / aktifkan / nonaktifkan otomasi")
async def update_automation(automation_id: str, payload: dict = Body(...), user: dict = Depends(_AUTO)):
    return ok_envelope(await auto.update(automation_id, payload, user))


@router.delete("/{automation_id}", summary="Hapus otomasi")
async def delete_automation(automation_id: str, user: dict = Depends(_AUTO)):
    await auto.delete(automation_id, user)
    return ok_envelope({"deleted": True})


@router.post("/{automation_id}/run", summary="Jalankan otomasi sekarang")
async def run_automation(automation_id: str, user: dict = Depends(_AUTO)):
    return ok_envelope(await auto.run_now(automation_id, user))


@router.get("/{automation_id}/runs", summary="Riwayat jalan otomasi")
async def automation_runs(automation_id: str, user: dict = Depends(_AUTO)):
    return ok_envelope(await auto.runs(automation_id, user))


# ── Kotak masuk email Asisten AI ───────────────────────────────────────────────
from services.ai import inbox  # noqa: E402

inbox_router = APIRouter(prefix="/api/ai/inbox", tags=["ai-inbox"])
_USE = require_perm("ai.agent.use")


@inbox_router.get("", summary="Dokumen dari kotak masuk email Asisten AI")
async def inbox_items(status: str = Query(None), user: dict = Depends(_USE)):
    return ok_envelope({"info": await inbox.status_info(user), "rows": await inbox.list_items(user, status)})


@inbox_router.patch("/{item_id}", summary="Tandai item kotak masuk (baru | diproses | diabaikan)")
async def inbox_status(item_id: str, payload: dict = Body(...), user: dict = Depends(_USE)):
    return ok_envelope(await inbox.set_status(item_id, str(payload.get("status") or ""), user))


@inbox_router.post("/poll", summary="Periksa kotak masuk sekarang")
async def inbox_poll(user: dict = Depends(require_perm("ai.agent.admin"))):
    return ok_envelope({"baru": await inbox.poll()})
