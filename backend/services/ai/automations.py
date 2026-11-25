"""Monitor & Otomasi Asisten AI (`ai_automations`, riwayat `ai_automation_runs`).

Dua jenis:
- **kondisi** — pengecekan deterministik TANPA biaya AI: query dataset analitik (datasets.run) → satu angka → bandingkan
  dengan ambang (<, <=, >, >=). Bila terpenuhi → notifikasi. Contoh: penjualan kemarin < Rp 5 jt, ada anomali baru,
  selisih opname, hutang jatuh tempo.
- **agen** — instruksi bahasa biasa dijalankan Asisten AI terjadwal ("tiap Senin 07:00 laporan sales minggu lalu +
  PDF"; "cek harga cabai, kabari bila naik > 10%"). Bila instruksi bersifat pemantauan dan tidak ada temuan, agen
  menjawab TIDAK_ADA_TEMUAN → tidak dikirim.

Berjalan dengan izin PEMBUATNYA (izin dibaca ulang setiap kali jalan; akun nonaktif → otomasi berhenti). Aksi tulis
yang diusulkan agen tetap menunggu persetujuan. Hasil dikirim ke notifikasi aplikasi dan/atau WhatsApp (bila nomor
ditautkan). Jadwal dalam WIB; dicek scheduler tiap menit.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from core.db import get_db
from core.exceptions import ForbiddenError, NotFoundError, ValidationError

logger = logging.getLogger("aurora.ai.automations")
WIB = timezone(timedelta(hours=7))
NO_FINDING = "TIDAK_ADA_TEMUAN"
OPS = {"<": lambda a, b: a < b, "<=": lambda a, b: a <= b, ">": lambda a, b: a > b, ">=": lambda a, b: a >= b}
FREQS = ("hourly", "daily", "weekly", "monthly")
RUN_TIMEOUT_S = 600
MAX_PER_TICK = 5

# Templat kondisi siap pakai (UI). spec = spesifikasi query_data yang menghasilkan satu angka "nilai".
TEMPLATES = {
    "sales_low": {"label": "Penjualan kemarin di bawah", "unit": "rp", "op": "<",
                  "spec": {"dataset": "sales_daily", "period": "yesterday",
                           "filters": [{"field": "status", "op": "eq", "value": "validated"}],
                           "metrics": [{"fn": "sum", "field": "grand_total", "as": "nilai"}]}},
    "anomaly_new": {"label": "Temuan anomali baru hari ini lebih dari", "unit": "num", "op": ">", "threshold": 0,
                    "spec": {"dataset": "anomalies", "period": "today",
                             "filters": [{"field": "status", "op": "eq", "value": "open"}],
                             "metrics": [{"fn": "count", "as": "nilai"}]}},
    "opname_loss": {"label": "Selisih opname (nilai) 7 hari terakhir di bawah", "unit": "rp", "op": "<",
                    "spec": {"dataset": "opname_lines", "period": "last_7d",
                             "metrics": [{"fn": "sum", "field": "variance_value", "as": "nilai"}]}},
    "purchases_high": {"label": "Pembelian (PO) 7 hari terakhir di atas", "unit": "rp", "op": ">",
                       "spec": {"dataset": "purchase_orders", "period": "last_7d",
                                "metrics": [{"fn": "sum", "field": "grand_total", "as": "nilai"}]}},
    "petty_high": {"label": "Kas kecil kemarin di atas", "unit": "rp", "op": ">",
                   "spec": {"dataset": "petty_cash", "period": "yesterday",
                            "metrics": [{"fn": "sum", "field": "amount", "as": "nilai"}]}},
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _perms(user: dict) -> set[str]:
    return set(user.get("permissions") or [])


def _can_automate(user: dict) -> bool:
    p = _perms(user)
    return "*" in p or "ai.agent.automate" in p


def next_run(schedule: dict, after: datetime) -> datetime:
    """Waktu jalan berikutnya (UTC) setelah `after` untuk jadwal WIB {freq, time HH:MM, weekday 0=Senin, day 1–28}."""
    freq = schedule.get("freq") or "daily"
    hh, mm = (schedule.get("time") or "07:00").split(":")[:2]
    hh, mm = int(hh), int(mm)
    loc = after.astimezone(WIB)
    if freq == "hourly":
        cand = loc.replace(minute=mm, second=0, microsecond=0)
        while cand <= loc:
            cand += timedelta(hours=1)
        return cand.astimezone(timezone.utc)
    cand = loc.replace(hour=hh, minute=mm, second=0, microsecond=0)
    if freq == "daily":
        while cand <= loc:
            cand += timedelta(days=1)
    elif freq == "weekly":
        wd = int(schedule.get("weekday") or 0) % 7
        cand += timedelta(days=(wd - cand.weekday()) % 7)
        while cand <= loc:
            cand += timedelta(days=7)
    else:  # monthly
        day = min(max(int(schedule.get("day") or 1), 1), 28)
        cand = cand.replace(day=day)
        while cand <= loc:
            y, m = (cand.year + (cand.month // 12), cand.month % 12 + 1)
            cand = cand.replace(year=y, month=m)
    return cand.astimezone(timezone.utc)


def describe_schedule(s: dict) -> str:
    days = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
    f = s.get("freq")
    if f == "hourly":
        return f"tiap jam (menit {int((s.get('time') or '00:00').split(':')[1]):02d})"
    if f == "weekly":
        return f"tiap {days[int(s.get('weekday') or 0) % 7]} {s.get('time')} WIB"
    if f == "monthly":
        return f"tiap tanggal {s.get('day') or 1} {s.get('time')} WIB"
    return f"tiap hari {s.get('time')} WIB"


def _validate(payload: dict, user: dict) -> dict:
    name = str(payload.get("name") or "").strip()[:120]
    kind = payload.get("kind")
    if not name:
        raise ValidationError("Nama otomasi wajib")
    if kind not in ("kondisi", "agen"):
        raise ValidationError("kind harus kondisi | agen")
    sch = dict(payload.get("schedule") or {})
    if sch.get("freq") not in FREQS:
        raise ValidationError("schedule.freq harus hourly | daily | weekly | monthly")
    t = str(sch.get("time") or "07:00")
    try:
        hh, mm = (int(x) for x in t.split(":")[:2])
        assert 0 <= hh < 24 and 0 <= mm < 60
    except (ValueError, AssertionError):
        raise ValidationError("schedule.time format HH:MM")
    sch = {"freq": sch["freq"], "time": f"{hh:02d}:{mm:02d}", "weekday": int(sch.get("weekday") or 0) % 7,
           "day": min(max(int(sch.get("day") or 1), 1), 28)}
    channels = [c for c in (payload.get("channels") or ["app"]) if c in ("app", "whatsapp")] or ["app"]
    doc = {"name": name, "kind": kind, "schedule": sch, "channels": channels, "enabled": bool(payload.get("enabled", True)),
           "scope": payload.get("scope") if isinstance(payload.get("scope"), dict) else None}
    if kind == "agen":
        ins = str(payload.get("instruction") or "").strip()
        if len(ins) < 10:
            raise ValidationError("Instruksi terlalu pendek")
        doc["instruction"] = ins[:2000]
        doc["monitor"] = bool(payload.get("monitor", False))
    else:
        cond = dict(payload.get("condition") or {})
        tpl = TEMPLATES.get(cond.get("template") or "")
        spec = cond.get("spec") or (tpl or {}).get("spec")
        op = cond.get("op") or (tpl or {}).get("op")
        thr = cond.get("threshold", (tpl or {}).get("threshold"))
        if not isinstance(spec, dict) or op not in OPS or thr is None:
            raise ValidationError("condition butuh template (atau spec), op (<,<=,>,>=) & threshold")
        doc["condition"] = {"template": cond.get("template"), "spec": spec, "op": op, "threshold": float(thr),
                            "value_key": cond.get("value_key") or "nilai", "unit": cond.get("unit") or (tpl or {}).get("unit") or "num",
                            "label": cond.get("label") or (tpl or {}).get("label") or name}
    return doc


async def create(payload: dict, user: dict) -> dict:
    if not _can_automate(user):
        raise ForbiddenError("Butuh izin ai.agent.automate")
    doc = _validate(payload, user)
    if doc["kind"] == "kondisi":
        from services.ai.agent import datasets
        await datasets.run(user, doc["condition"]["spec"], max_rows=1)       # validasi izin & field sekarang
    now = _now()
    doc.update({"id": str(uuid.uuid4()), "owner_id": user["id"], "created_at": now.isoformat(), "updated_at": now.isoformat(),
                "next_run_at": next_run(doc["schedule"], now).isoformat(), "last_run_at": None, "last_status": None,
                "deleted_at": None})
    await get_db().ai_automations.insert_one(doc)
    doc.pop("_id", None)
    return _public(doc)


async def _own(automation_id: str, user: dict) -> dict:
    a = await get_db().ai_automations.find_one({"id": automation_id, "deleted_at": None}, {"_id": 0})
    if not a:
        raise NotFoundError("Otomasi")
    if a["owner_id"] != user["id"] and "*" not in _perms(user) and "ai.agent.admin" not in _perms(user):
        raise ForbiddenError("Otomasi milik pengguna lain")
    return a


async def update(automation_id: str, payload: dict, user: dict) -> dict:
    a = await _own(automation_id, user)
    if set(payload) <= {"enabled"}:
        patch = {"enabled": bool(payload.get("enabled"))}
    else:
        merged = {**a, **payload}
        patch = _validate(merged, user)
        if patch["kind"] == "kondisi":
            from services.ai.agent import datasets
            await datasets.run(user, patch["condition"]["spec"], max_rows=1)
    now = _now()
    patch["updated_at"] = now.isoformat()
    if patch.get("enabled", a.get("enabled")) and ("schedule" in patch or not a.get("enabled")):
        patch["next_run_at"] = next_run(patch.get("schedule") or a["schedule"], now).isoformat()
    await get_db().ai_automations.update_one({"id": automation_id}, {"$set": patch})
    return _public({**a, **patch})


async def delete(automation_id: str, user: dict) -> None:
    await _own(automation_id, user)
    await get_db().ai_automations.update_one({"id": automation_id}, {"$set": {"deleted_at": _now().isoformat(), "enabled": False}})


def _public(a: dict) -> dict:
    out = {k: v for k, v in a.items() if k != "_id"}
    out["jadwal"] = describe_schedule(a["schedule"])
    return out


async def list_for(user: dict, *, all_users: bool = False) -> list[dict]:
    q: dict = {"deleted_at": None}
    if not all_users:
        q["owner_id"] = user["id"]
    rows = await get_db().ai_automations.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [_public(r) for r in rows]


async def runs(automation_id: str, user: dict, limit: int = 30) -> list[dict]:
    await _own(automation_id, user)
    return await get_db().ai_automation_runs.find({"automation_id": automation_id}, {"_id": 0}).sort("started_at", -1).to_list(limit)


# ───────────────────────────── eksekusi ─────────────────────────────

def _fmt(v: float, unit: str) -> str:
    s = f"{v:,.0f}".replace(",", ".")
    return f"Rp {s}" if unit == "rp" else s


async def _check_condition(a: dict, user: dict) -> tuple[bool, str, Optional[float]]:
    from services.ai.agent import datasets
    c = a["condition"]
    res = await datasets.run(user, c["spec"], max_rows=5)
    rows = res.get("rows") or []
    val = float((rows[0] if rows else {}).get(c.get("value_key") or "nilai") or 0)
    hit = OPS[c["op"]](val, float(c["threshold"]))
    msg = (f"{c.get('label') or a['name']}: {_fmt(val, c.get('unit'))} "
           f"({'memenuhi' if hit else 'tidak memenuhi'} batas {c['op']} {_fmt(float(c['threshold']), c.get('unit'))})")
    return hit, msg, val


async def _run_agent(a: dict, user: dict) -> tuple[bool, str, Optional[str]]:
    from services.ai.agent import runtime
    ins = a["instruction"]
    if a.get("monitor"):
        ins += (f"\n\n(Ini pemantauan terjadwal. Bila tidak ada yang perlu dilaporkan, jawab persis: {NO_FINDING})")
    msg = f"[Otomasi terjadwal: {a['name']} — {describe_schedule(a['schedule'])}]\n{ins}"
    st = await runtime.start_run(user, message=msg, channel="automation", scope=a.get("scope"))
    t0 = _now()
    while True:
        r = await runtime.get_run(st["run_id"], user)
        if r["status"] != "running":
            break
        if (_now() - t0).total_seconds() > RUN_TIMEOUT_S:
            return True, "Otomasi masih berjalan lama — lihat percakapannya di aplikasi.", st["session_id"]
        await asyncio.sleep(2)
    text = ((r.get("answer") or {}).get("text") or "").strip()
    if r["status"] != "done":
        return True, f"Otomasi gagal: {r.get('error') or r['status']}", st["session_id"]
    if a.get("monitor") and text.upper().startswith(NO_FINDING):
        return False, "Tidak ada temuan", st["session_id"]
    return True, text or "(tanpa teks)", st["session_id"]


async def _deliver(a: dict, user: dict, text: str, session_id: Optional[str], run_id: Optional[str]) -> list[str]:
    from services import notification_service
    sent = []
    link = f"/ai?session={session_id}" if session_id else "/ai/automations"
    if "app" in a["channels"]:
        await notification_service.push(user_id=user["id"], type="ai_automation", title=f"Otomasi: {a['name']}",
                                        body=text[:500], link=link, source_type="ai_automation", source_id=a["id"])
        sent.append("app")
    if "whatsapp" in a["channels"]:
        try:
            from services.wa_bot import render, service as wa
            wl = await get_db().wa_links.find_one({"user_id": user["id"], "status": "active"}, {"_id": 0})
            if wl and wl.get("jid"):
                if run_id and a["kind"] == "agen":
                    await wa._deliver_run(wl, user, wl["jid"], run_id)          # teks + file laporan + grafik
                else:
                    await wa.send_text(wl, wl["jid"], f"🔔 *{a['name']}*\n{render.to_whatsapp(text)}")
                sent.append("whatsapp")
        except Exception:  # noqa: BLE001
            logger.warning("kirim WA otomasi gagal", exc_info=True)
    return sent


async def run_one(a: dict, *, manual: bool = False) -> dict:
    """Jalankan satu otomasi sekarang (dipanggil scheduler atau tombol Jalankan)."""
    from services.ai import client as ai_client
    from services.wa_bot.service import _load_user
    db = get_db()
    started = _now()
    rec = {"id": str(uuid.uuid4()), "automation_id": a["id"], "started_at": started.isoformat(), "manual": manual}
    user = await _load_user(a["owner_id"])
    status, text, sent, session_id, value = "error", "", [], None, None
    try:
        if not user:
            raise ForbiddenError("Pemilik otomasi tidak aktif")
        if not _can_automate(user):
            raise ForbiddenError("Pemilik tidak lagi punya izin ai.agent.automate")
        if a["kind"] == "kondisi":
            hit, text, value = await _check_condition(a, user)
            status = "terpenuhi" if hit else "aman"
            if hit:
                sent = await _deliver(a, user, text, None, None)
        else:
            if not await ai_client.is_available():
                raise ValidationError("Asisten AI sedang tidak tersedia (kill switch/kunci API)")
            hit, text, session_id = await _run_agent(a, user)
            status = "dikirim" if hit else "tidak_ada_temuan"
            if hit:
                r = await db.ai_runs.find_one({"session_id": session_id}, {"_id": 0, "id": 1}, sort=[("created_at", -1)])
                sent = await _deliver(a, user, text, session_id, (r or {}).get("id"))
    except Exception as e:  # noqa: BLE001
        status, text = "error", str(e)[:500]
        logger.warning("otomasi %s gagal: %s", a.get("id"), e)
    rec.update({"finished_at": _now().isoformat(), "status": status, "ringkasan": text[:2000], "terkirim": sent,
                "session_id": session_id, "nilai": value})
    await db.ai_automation_runs.insert_one(rec)
    rec.pop("_id", None)
    upd = {"last_run_at": started.isoformat(), "last_status": status, "last_summary": text[:300]}
    if not manual:
        upd["next_run_at"] = next_run(a["schedule"], started).isoformat()
    if status == "error" and not user:
        upd["enabled"] = False
    await db.ai_automations.update_one({"id": a["id"]}, {"$set": upd})
    return rec


async def run_now(automation_id: str, user: dict) -> dict:
    return await run_one(await _own(automation_id, user), manual=True)


async def tick() -> int:
    """Dipanggil scheduler tiap menit: jalankan otomasi yang sudah waktunya (maks. MAX_PER_TICK)."""
    db = get_db()
    now = _now().isoformat()
    due = await db.ai_automations.find({"deleted_at": None, "enabled": True, "next_run_at": {"$lte": now}},
                                       {"_id": 0}).sort("next_run_at", 1).to_list(MAX_PER_TICK)
    for a in due:
        # klaim dulu (geser next_run_at) agar tidak dobel bila tick berikutnya datang saat run masih berjalan
        claimed = await db.ai_automations.update_one({"id": a["id"], "next_run_at": a["next_run_at"]},
                                                     {"$set": {"next_run_at": next_run(a["schedule"], _now()).isoformat()}})
        if claimed.modified_count:
            if a["kind"] == "agen":
                asyncio.create_task(run_one(a))      # agen bisa lama → jangan tahan tick berikutnya
            else:
                await run_one(a)
    return len(due)
