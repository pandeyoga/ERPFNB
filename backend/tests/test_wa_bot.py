"""Bot WhatsApp Asisten AI (Evolution API): menautkan nomor dengan kode, abaikan nomor asing/pesan ganda, tanya-jawab lewat
agen, format WA, PIN untuk persetujuan, batas Rp10 jt via aplikasi. Gateway & agen di-mock (tanpa jaringan)."""
import asyncio
import types

import mongomock_motor
import pytest

from core import db as core_db
from services.wa_bot import render
from services.wa_bot import service as wa

USER = {"id": "u-owner", "email": "o@x", "full_name": "Pak Hadi", "role_ids": ["r-own"], "permissions": ["ai.wa.use", "ai.agent.use"]}


def run(coro):
    return asyncio.run(coro)


async def settle():
    for _ in range(50):
        pending = [t for t in asyncio.all_tasks() if t is not asyncio.current_task()]
        if not pending:
            return
        await asyncio.gather(*pending, return_exceptions=True)


def msg(jid, text, mid):
    return {"event": "MESSAGES_UPSERT", "instance": "erp-bot",
            "data": {"key": {"remoteJid": jid, "fromMe": False, "id": mid}, "pushName": "Hadi", "message": {"conversation": text}}}


@pytest.fixture()
def env(monkeypatch):
    db = mongomock_motor.AsyncMongoMockClient()["wa_test"]
    monkeypatch.setattr(core_db, "_db", db)
    run(db.users.insert_one({"id": "u-owner", "full_name": "Pak Hadi", "email": "o@x", "role_ids": ["r-own"], "deleted_at": None}))
    run(db.roles.insert_one({"id": "r-own", "permissions": ["ai.wa.use", "ai.agent.use"]}))
    sent = []
    from services import whatsapp_service

    async def fake_send(to, text, **kw):
        sent.append((to, text))
        return {"sent": True}

    async def fake_cfg():
        return True
    monkeypatch.setattr(whatsapp_service, "send_message", fake_send)
    monkeypatch.setattr(whatsapp_service, "is_configured", fake_cfg)
    return types.SimpleNamespace(db=db, sent=sent)


def test_link_flow_unknown_sender_and_dedupe(env):
    async def go():
        code = (await wa.start_link(USER))["code"]
        await wa.handle_webhook(msg("628111@s.whatsapp.net", "halo", "m1"))
        await settle()
        assert "belum terhubung" in env.sent[-1][1]
        n = len(env.sent)
        await wa.handle_webhook(msg("628111@s.whatsapp.net", "halo lagi", "m2"))
        await settle()
        assert len(env.sent) == n                      # tidak membalas berulang dalam 6 jam
        await wa.handle_webhook(msg("12345@lid", f"LINK {code}", "m3"))      # JID @lid (nomor tersembunyi) tetap bisa
        await settle()
        link = await env.db.wa_links.find_one({"status": "active"})
        assert link["jid"] == "12345@lid" and link["user_id"] == "u-owner" and "Terhubung sebagai" in env.sent[-1][1]
        r = await wa.handle_webhook(msg("12345@lid", f"LINK {code}", "m3"))   # pesan ganda dari gateway
        assert r["handled"] == 0
        await wa.handle_webhook(msg("12345@lid", "BANTUAN", "m4"))
        await settle()
        assert "SETUJUI 1" in env.sent[-1][1]
        st = await wa.my_status(USER)
        assert st["status"] == "active" and not st["pin_set"]
    run(go())


def test_agent_answer_pin_and_approval_limits(env, monkeypatch):
    from services.ai.agent import actions, runtime
    calls = {"approve": []}

    async def fake_start_run(user, **kw):
        await env.db.ai_actions.insert_many([
            {"id": "a1", "session_id": "s1", "status": "pending", "title": "Buat PO daging", "risk": "sedang", "created_at": "1",
             "body": {"lines": [{"qty": 10, "unit_cost": 120000}]}},
            {"id": "a2", "session_id": "s1", "status": "pending", "title": "Bayar AP besar", "risk": "tinggi", "created_at": "2",
             "body": {"amount": 25_000_000}}])
        return {"session_id": "s1", "run_id": "r1"}

    async def fake_get_run(run_id, user):
        return {"status": "done", "answer": {"text": "**Sales kemarin** Rp 71,7 jt\n| Toko | Net |\n|---|---|\n| Lounge | Rp 1 |",
                                             "ui": [{"type": "action", "action_id": "a1"}, {"type": "action", "action_id": "a2"}]}}

    async def fake_approve(aid, user, body=None):
        calls["approve"].append(aid)
        await env.db.ai_actions.update_one({"id": aid}, {"$set": {"status": "done"}})
        return {"id": aid, "status": "done", "batch_id": "b"}

    async def fake_continue(a, user):
        return None
    monkeypatch.setattr(runtime, "start_run", fake_start_run)
    monkeypatch.setattr(runtime, "get_run", fake_get_run)
    monkeypatch.setattr(actions, "approve", fake_approve)
    monkeypatch.setattr(runtime, "continue_after_decisions", fake_continue)

    async def go():
        code = (await wa.start_link(USER))["code"]
        await wa.handle_webhook(msg("628222@s.whatsapp.net", f"link {code}", "x1"))
        await settle()
        await wa.handle_webhook(msg("628222@s.whatsapp.net", "sales kemarin?", "x2"))
        await settle()
        texts = [t for _, t in env.sent]
        assert any("*Sales kemarin* Rp 71,7 jt" in t and "• Lounge — Net: Rp 1" in t for t in texts)
        assert "1. Buat PO daging" in texts[-1] and "2. Bayar AP besar" in texts[-1]
        await wa.handle_webhook(msg("628222@s.whatsapp.net", "SETUJUI 1", "x3"))
        await settle()
        assert "PIN" in env.sent[-1][1] and not calls["approve"]          # tanpa PIN → tidak dijalankan
        with pytest.raises(Exception):
            await wa.set_pin(USER, "111111")                               # PIN lemah ditolak
        await wa.set_pin(USER, "135790")
        await wa.handle_webhook(msg("628222@s.whatsapp.net", "PIN 000000", "x4"))
        await settle()
        assert env.sent[-1][1] == "PIN salah."
        await wa.handle_webhook(msg("628222@s.whatsapp.net", "PIN 135790", "x5"))
        await settle()
        await wa.handle_webhook(msg("628222@s.whatsapp.net", "SETUJUI SEMUA", "x6"))
        await settle()
        assert calls["approve"] == ["a1"]                                  # a2 > Rp10 jt → hanya lewat aplikasi
        assert any("di atas Rp10 jt" in t for _, t in env.sent) and any("✅ Buat PO daging" in t for _, t in env.sent)
        logs = await env.db.wa_messages.count_documents({})
        assert logs >= 10                                                   # semua pesan masuk/keluar tercatat
    run(go())


def test_whatsapp_formatting_and_chunks():
    t = render.to_whatsapp("# Judul\n**tebal** dan *miring* [web](https://x.id) [hal](/finance)\n- a")
    assert t.split("\n") == ["*Judul*", "*tebal* dan _miring_ web (https://x.id) hal", "• a"]
    parts = render.chunks("baris\n" * 2000, size=500)
    assert all(len(p) <= 500 for p in parts) and sum(p.count("baris") for p in parts) == 2000
    png = render.chart_png({"type": "line", "title": "Tren", "x_key": "d", "unit": "rp", "series": [{"key": "v"}],
                            "data": [{"d": f"2026-11-{i:02d}", "v": i * 1e6} for i in range(1, 15)]})
    assert png[:4] == b"\x89PNG"
