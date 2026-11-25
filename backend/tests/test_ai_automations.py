"""Monitor & Otomasi Asisten AI (jadwal WIB, kondisi tanpa AI, instruksi agen + TIDAK_ADA_TEMUAN, tick tanpa dobel),
kotak masuk email (parse, tebak jenis, simpan lampiran) & voice note WA (STT). Tanpa jaringan (mongomock, model tiruan)."""
import asyncio
from datetime import datetime, timezone
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import mongomock_motor
import pytest

from core import db as core_db

OWNER = {"id": "u-own", "email": "own@x", "permissions": ["ai.agent.use", "ai.agent.automate", "outlet.daily_sales.read", "ai.wa.use"],
         "outlet_ids": ["*"]}


@pytest.fixture()
def db(monkeypatch):
    mdb = mongomock_motor.AsyncMongoMockClient()["auto_test"]
    monkeypatch.setattr(core_db, "_db", mdb)
    from services.wa_bot import service as wa

    async def load_user(uid):
        return dict(OWNER) if uid == OWNER["id"] else None
    monkeypatch.setattr(wa, "_load_user", load_user)

    async def seed():
        await mdb.outlets.insert_one({"id": "o1", "name": "Lounge", "brand_id": "b1", "deleted_at": None})
        await mdb.daily_sales.insert_one({"id": "d1", "outlet_id": "o1", "sales_date": _yesterday(), "status": "validated",
                                          "grand_total": 3_200_000, "deleted_at": None})
    asyncio.run(seed())
    return mdb


def _yesterday():
    from services.ai.agent.datasets import resolve_period
    return resolve_period("yesterday")[0]


def test_next_run_schedules():
    from services.ai.automations import next_run
    base = datetime(2026, 11, 25, 1, 30, tzinfo=timezone.utc)                    # Rabu 08:30 WIB
    assert next_run({"freq": "daily", "time": "07:00"}, base).isoformat() == "2026-11-26T00:00:00+00:00"
    assert next_run({"freq": "daily", "time": "09:00"}, base).isoformat() == "2026-11-25T02:00:00+00:00"
    assert next_run({"freq": "weekly", "time": "07:00", "weekday": 0}, base).isoformat() == "2026-11-30T00:00:00+00:00"
    assert next_run({"freq": "monthly", "time": "07:00", "day": 1}, base).isoformat() == "2026-12-01T00:00:00+00:00"
    assert next_run({"freq": "hourly", "time": "00:15"}, base).isoformat() == "2026-11-25T02:15:00+00:00"


def test_condition_monitor_notifies_without_ai(db):
    from services.ai import automations as auto

    async def go():
        a = await auto.create({"name": "Sales kemarin rendah", "kind": "kondisi", "schedule": {"freq": "daily", "time": "08:00"},
                               "channels": ["app"], "condition": {"template": "sales_low", "threshold": 5_000_000}}, OWNER)
        assert a["jadwal"] == "tiap hari 08:00 WIB" and a["condition"]["op"] == "<"
        r = await auto.run_now(a["id"], OWNER)
        assert r["status"] == "terpenuhi" and r["nilai"] == 3_200_000 and r["terkirim"] == ["app"]
        n = await db.notifications.find_one({"user_id": "u-own", "type": "ai_automation"})
        assert n and "3.200.000" in n["body"]
        await auto.update(a["id"], {"condition": {"template": "sales_low", "op": "<", "threshold": 1_000_000}}, OWNER)
        r = await auto.run_now(a["id"], OWNER)
        assert r["status"] == "aman" and r["terkirim"] == []
        with pytest.raises(Exception):                                         # tanpa izin dataset → ditolak saat dibuat
            await auto.create({"name": "x", "kind": "kondisi", "schedule": {"freq": "daily", "time": "08:00"},
                               "condition": {"template": "opname_loss", "threshold": -1}}, OWNER)
    asyncio.run(go())


def test_agent_automation_and_tick(db, monkeypatch):
    from services.ai import automations as auto
    from services.ai import client as ai_client
    from services.ai.agent import runtime
    answers = iter(["TIDAK_ADA_TEMUAN", "Harga cabai naik 12% (PIHPS) — pertimbangkan stok."])

    async def avail():
        return True

    async def start_run(user, *, message, channel, scope=None, **kw):
        assert channel == "automation" and "TIDAK_ADA_TEMUAN" in message
        rid = f"r{await db.ai_runs.count_documents({})}"
        await db.ai_runs.insert_one({"id": rid, "session_id": f"s-{rid}", "user_id": user["id"], "status": "done",
                                     "answer": {"text": next(answers)}, "created_at": datetime.now(timezone.utc).isoformat()})
        return {"run_id": rid, "session_id": f"s-{rid}"}

    async def get_run(rid, user):
        return await db.ai_runs.find_one({"id": rid}, {"_id": 0})
    monkeypatch.setattr(ai_client, "is_available", avail)
    monkeypatch.setattr(runtime, "start_run", start_run)
    monkeypatch.setattr(runtime, "get_run", get_run)

    async def go():
        a = await auto.create({"name": "Pantau cabai", "kind": "agen", "monitor": True, "channels": ["app"],
                               "schedule": {"freq": "daily", "time": "06:00"},
                               "instruction": "Cek harga cabai rawit hari ini, kabari bila naik > 10%"}, OWNER)
        await db.ai_automations.update_one({"id": a["id"]}, {"$set": {"next_run_at": "2000-01-01T00:00:00+00:00"}})
        assert await auto.tick() == 1
        for _ in range(50):
            if await db.ai_automation_runs.count_documents({}):
                break
            await asyncio.sleep(0.02)
        run1 = await db.ai_automation_runs.find_one({})
        assert run1["status"] == "tidak_ada_temuan" and not await db.notifications.count_documents({})
        assert await auto.tick() == 0                                          # sudah diklaim → tidak dobel
        r = await auto.run_now(a["id"], OWNER)
        assert r["status"] == "dikirim" and r["terkirim"] == ["app"]
        n = await db.notifications.find_one({})
        assert "cabai naik 12%" in n["body"] and n["link"].startswith("/ai?session=")
        other = {**OWNER, "id": "u-lain", "permissions": ["ai.agent.automate"]}
        with pytest.raises(Exception):
            await auto.run_now(a["id"], other)                                  # bukan pemilik
    asyncio.run(go())


def _mail(subject, fname, data, ctype="pdf"):
    m = MIMEMultipart()
    m["Subject"], m["From"], m["Message-ID"] = subject, "Toko Sayur <sales@sayur.id>", f"<{subject}@x>"
    m.attach(MIMEText("Terlampir price list terbaru, berlaku 1 Des.", "plain"))
    part = MIMEApplication(data, _subtype=ctype)
    part.add_header("Content-Disposition", "attachment", filename=fname)
    m.attach(part)
    return m.as_bytes()


def test_inbox_ingest(db, monkeypatch):
    from services import upload_service
    from services.ai import inbox
    saved = []

    async def save_upload(**kw):
        saved.append(kw["filename"])
        return {"id": f"att-{len(saved)}"}
    monkeypatch.setattr(upload_service, "save_upload", save_upload)

    async def go():
        raw = [_mail("Price List Desember", "pricelist_des.pdf", b"%PDF-1.4 x"),
               _mail("Mutasi rekening November", "mutasi_nov.csv", b"Tanggal,Keterangan\n", "csv")]
        p = inbox.parse_message(raw[0])
        assert p["from"] == "sales@sayur.id" and p["attachments"][0]["filename"] == "pricelist_des.pdf" and "berlaku" in p["body"]
        assert await inbox.ingest(raw, OWNER) == 2
        assert await inbox.ingest(raw, OWNER) == 0                              # Message-ID sama → tidak dobel
        rows = await inbox.list_items(OWNER)
        types = {r["subject"]: r["doc_type"] for r in rows}
        assert types == {"Price List Desember": "price_list", "Mutasi rekening November": "mutasi_bank"}
        assert all(r["saran_prompt"] for r in rows) and rows[0]["attachments"][0]["attachment_id"].startswith("att-")
        assert await db.notifications.count_documents({"type": "ai_inbox"}) == 2
        it = await inbox.set_status(rows[0]["id"], "diproses", OWNER)
        assert it["status"] == "diproses"
    asyncio.run(go())


def test_voice_note_transcribed(db, monkeypatch):
    from services import whatsapp_service
    from services.ai import stt
    from services.wa_bot import service as wa
    sent, asked = [], []

    async def configured():
        return True

    async def transcribe(data, mime):
        return "berapa penjualan kemarin"

    async def fetch(msg):
        return b"OggS", "audio/ogg; codecs=opus"

    async def send_text(link, jid, text):
        sent.append(text)

    async def ask(link, user, jid, msg, text, media):
        asked.append(text)
    monkeypatch.setattr(stt, "configured", configured)
    monkeypatch.setattr(stt, "transcribe", transcribe)
    monkeypatch.setattr(whatsapp_service, "fetch_media", fetch)
    monkeypatch.setattr(wa, "send_text", send_text)
    monkeypatch.setattr(wa, "_ask_agent", ask)

    async def go():
        link = {"id": "l1", "user_id": "u-own", "status": "active", "jid": "62811@s.whatsapp.net"}
        await db.wa_links.insert_one(dict(link))
        msg = {"key": {"id": "m1", "remoteJid": link["jid"]}, "message": {"audioMessage": {"mimetype": "audio/ogg"}}}
        await wa._process(link, link["jid"], "62811", msg, "", {"kind": "audioMessage"})
        assert asked == ["berapa penjualan kemarin"] and sent and "berapa penjualan" in sent[0]
    asyncio.run(go())
