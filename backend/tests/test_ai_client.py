"""Klien Claude terpusat (services/ai/client.py): kebijakan & tombol darurat, biaya, pencatatan pemakaian,
blok file (gambar/PDF), dan `ask()` — tanpa jaringan (klien Anthropic tiruan) dan tanpa server (mongomock).
"""
import asyncio
import types

import mongomock_motor
import pytest

from core import db as core_db
from core.config import settings
from services.ai import client as ai


@pytest.fixture()
def mockdb(monkeypatch):
    db = mongomock_motor.AsyncMongoMockClient()["ai_client_test"]
    monkeypatch.setattr(core_db, "_db", db)
    monkeypatch.setattr(settings, "feature_ai_enabled", True)
    from core import runtime_config
    runtime_config.invalidate()
    return db


class _FakeMessages:
    def __init__(self, reply="OK", stop_reason="end_turn"):
        self.calls = []
        self.reply, self.stop_reason = reply, stop_reason

    async def create(self, **kw):
        self.calls.append(kw)
        return types.SimpleNamespace(
            model=kw["model"], stop_reason=self.stop_reason,
            content=[types.SimpleNamespace(type="text", text=self.reply)],
            usage=types.SimpleNamespace(input_tokens=1000, output_tokens=200, cache_read_input_tokens=0,
                                        cache_creation_input_tokens=0))


@pytest.fixture()
def fake_client(monkeypatch):
    msgs = _FakeMessages()
    fake = types.SimpleNamespace(messages=msgs, beta=types.SimpleNamespace(messages=msgs))

    async def _get_client(key=None):
        return fake
    monkeypatch.setattr(ai, "get_client", _get_client)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    return msgs


def run(coro):
    return asyncio.run(coro)


def test_cost_and_media_type():
    u = {"input_tokens": 1_000_000, "output_tokens": 100_000}
    assert ai.cost_usd("claude-opus-5-5", u) == 6.0  # 4 + 0.1×20
    assert ai.media_type_of(b"\x89PNG\r\n\x1a\nxxxx") == "image/png"
    assert ai.media_type_of(b"\xff\xd8\xff\xe0") == "image/jpeg"
    assert ai.media_type_of(b"%PDF-1.7") == "application/pdf"
    assert ai.file_block(b"%PDF-1.7 ...")["type"] == "document"
    assert ai.file_block(b"\xff\xd8\xff\xe0...")["type"] == "image"
    with pytest.raises(ValueError):
        ai.file_block(b"plain text")


def test_unavailable_without_key_or_when_disabled(mockdb, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    st = run(ai.status())
    assert st["available"] is False and st["reason"] == "no_api_key"
    with pytest.raises(ai.AIUnavailable):
        run(ai.ask(system="s", user="u", feature="t"))
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    from core import runtime_config
    runtime_config.invalidate()
    assert run(ai.status())["available"] is True
    # tombol darurat
    run(ai.update_policy({"enabled": False}, user={"id": "u1"}))
    st = run(ai.status())
    assert st["available"] is False and st["reason"] == "ai_disabled_policy"


def test_ask_records_usage_and_uses_fallback(mockdb, fake_client):
    out = run(ai.ask(system="sys", user="halo", feature="unit_test", user_id="u1",
                     files=[b"\x89PNG\r\n\x1a\nabc"], json_schema={"type": "object"}))
    assert out == "OK"
    call = fake_client.calls[-1]
    assert call["model"] == "claude-opus-5-5" and call["fallbacks"] == "default"
    assert call["betas"] == [ai.FALLBACK_BETA]
    content = call["messages"][0]["content"]
    assert content[0]["type"] == "image" and content[-1] == {"type": "text", "text": "halo"}
    assert call["output_config"]["format"]["type"] == "json_schema"
    rows = run(mockdb.ai_usage.find({}).to_list(10))
    assert len(rows) == 1 and rows[0]["feature"] == "unit_test" and rows[0]["cost_usd"] == pytest.approx(0.008)
    usage = run(ai.month_usage())
    assert usage["calls"] == 1 and usage["cost_usd"] == pytest.approx(0.008)


def test_refusal_returns_empty(mockdb, fake_client):
    fake_client.stop_reason = "refusal"
    assert run(ai.ask(system="s", user="u", feature="t")) == ""
    assert run(mockdb.ai_usage.find_one({}))["status"] == "refusal"


def test_budget_alert_once(mockdb, fake_client):
    run(mockdb.roles.insert_one({"id": "r-admin", "permissions": ["*"]}))
    run(mockdb.users.insert_one({"id": "a1", "role_ids": ["r-admin"], "deleted_at": None, "status": "active"}))
    run(ai.update_policy({"monthly_budget_usd": 0.01, "alert_pct": 50}, user={"id": "a1"}))
    run(ai.ask(system="s", user="u", feature="t"))   # 0.008 ≥ 50% × 0.01
    run(ai.ask(system="s", user="u", feature="t"))   # 0.016 ≥ 100%
    run(ai.ask(system="s", user="u", feature="t"))   # tidak ada notifikasi baru
    notes = run(mockdb.notifications.find({"user_id": "a1"}).to_list(10))
    assert sorted(n["title"][:20] for n in notes) == ["Pemakaian AI 100% da", "Pemakaian AI 50% dar"]
