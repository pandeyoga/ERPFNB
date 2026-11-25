"""Kualitas & tata kelola Asisten AI: mode latihan (usulan disimulasikan, tidak dijalankan), samarkan data pribadi
sebelum ke model, retensi, ekspor/hapus data saya (UU PDP), umpan balik & ringkasan kualitas, kumpulan uji agen valid.
Tanpa jaringan (mongomock)."""
import asyncio
from datetime import datetime, timedelta, timezone

import mongomock_motor
import pytest

from core import db as core_db
from core.config import settings


def run(coro):
    return asyncio.run(coro)


@pytest.fixture(scope="module")
def app_catalog():
    import server
    from services.ai.agent import catalog, executor
    executor.set_app(server.app)
    catalog.reset()
    return catalog.catalog(server.app)


@pytest.fixture()
def mockdb(monkeypatch):
    db = mongomock_motor.AsyncMongoMockClient()["ai_quality_test"]
    monkeypatch.setattr(core_db, "_db", db)
    monkeypatch.setattr(settings, "feature_ai_enabled", True)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    from core import runtime_config
    runtime_config.invalidate()
    return db


USER = {"id": "u1", "email": "u1@x", "outlet_ids": ["*"], "permissions": ["reservations.create", "reservations.read", "ai.agent.use"]}


def test_practice_mode_simulates(app_catalog, mockdb, monkeypatch):
    from services.ai import client as ai
    from services.ai.agent import actions, executor
    calls = []

    async def fake_call(op, user, **kw):
        calls.append(op.id)
        return {"status": 200, "data": {"id": "x"}}
    monkeypatch.setattr(executor, "call", fake_call)

    async def go():
        await mockdb.ai_user_prefs.insert_one({"user_id": "u1", "practice": True})
        out = await actions.propose(user=USER, session_id="s1", run_id="r1", summary="uji",
                                    items=[{"op_id": "post_reservations", "title": "Reservasi", "body": {"pax": 2}}])
        a = await actions.approve(out["actions"][0]["id"], USER)
        assert a["status"] == "simulated" and not calls and a["result"]["akan_dijalankan"] == "POST /api/reservations"
        assert "SIMULASI" in actions.outcome_text([a]) and await actions.batch_settled(out["batch_id"])
        await mockdb.ai_user_prefs.update_one({"user_id": "u1"}, {"$set": {"practice": False}})
        await ai.update_policy({"practice_mode": True}, user={"id": "admin"})                  # mode latihan global
        out = await actions.propose(user=USER, session_id="s1", run_id="r2", summary="uji",
                                    items=[{"op_id": "post_reservations", "title": "Reservasi", "body": {"pax": 3}}])
        assert (await actions.approve(out["actions"][0]["id"], USER))["status"] == "simulated" and not calls
        await ai.update_policy({"practice_mode": False}, user={"id": "admin"})
        out = await actions.propose(user=USER, session_id="s1", run_id="r3", summary="uji",
                                    items=[{"op_id": "post_reservations", "title": "Reservasi", "body": {"pax": 4}}])
        assert (await actions.approve(out["actions"][0]["id"], USER))["status"] == "done" and calls == ["post_reservations"]
    run(go())


def test_pii_masking_in_tools(app_catalog, mockdb, monkeypatch):
    from services.ai import client as ai
    from services.ai import privacy
    from services.ai.agent import executor, tools
    m = privacy.mask({"customer_name": "Budi", "phone": "081234567890", "email": "budi@mail.com", "pax": 4,
                      "notes": "hubungi 081298765432 / budi@mail.com, NIK 3171234567890001", "npwp": "01.234.567.8-901.000",
                      "bank_account_number": "1234567890", "lines": [{"alamat": "Jl. Mawar 1", "qty": 2}]})
    assert m["customer_name"] == "Budi" and m["pax"] == 4 and m["phone"] != "081234567890" and "@mail.com" not in m["email"]
    assert "081298765432" not in m["notes"] and "budi@mail.com" not in m["notes"] and "3171234567890001" not in m["notes"]
    assert m["npwp"].startswith("01*") and m["lines"][0]["qty"] == 2 and m["lines"][0]["alamat"] != "Jl. Mawar 1"

    async def fake_call(op, user, **kw):
        return {"status": 200, "data": [{"customer_name": "Budi", "phone": "081234567890", "pax": 4}]}
    monkeypatch.setattr(executor, "call", fake_call)

    async def go():
        ctx = tools.ToolContext(user=USER, session={"id": "s1"}, run_id="r1", scope={})
        out, _ = await tools.run_tool("run_read", {"op_id": "get_reservations"}, ctx)
        assert "081234567890" in out                                                        # kebijakan mati
        await ai.update_policy({"mask_pii": True}, user={"id": "admin"})
        ctx = tools.ToolContext(user=USER, session={"id": "s1"}, run_id="r1", scope={})
        out, _ = await tools.run_tool("run_read", {"op_id": "get_reservations"}, ctx)
        assert "081234567890" not in out and "Budi" in out
    run(go())


def test_retention_export_delete_feedback_quality(mockdb, monkeypatch):
    from routers import ai as ai_router
    from routers import ai_agent
    from services.ai import privacy
    old = (datetime.now(timezone.utc) - timedelta(days=400)).isoformat()
    new = datetime.now(timezone.utc).isoformat()

    async def go():
        await mockdb.ai_sessions.insert_many([{"id": "s-old", "user_id": "u1", "updated_at": old, "deleted_at": None, "display": []},
                                              {"id": "s-new", "user_id": "u1", "updated_at": new, "deleted_at": None, "display": [],
                                               "title": "Sales", "channel": "web", "created_at": new}])
        await mockdb.ai_runs.insert_many([{"id": "r-old", "user_id": "u1", "session_id": "s-old", "created_at": old, "status": "done"},
                                          {"id": "r-new", "user_id": "u1", "session_id": "s-new", "created_at": new, "status": "done",
                                           "finished_at": new, "usage": {"cost_usd": 0.12}, "channel": "web"}])
        await mockdb.wa_messages.insert_one({"id": "w1", "created_at": old})
        assert (await privacy.apply_retention())["aktif"] is False                          # default: simpan
        res = await privacy.apply_retention(180)
        assert res["percakapan"] == 1 and res["run"] == 1 and res["pesan_wa"] == 1
        assert await mockdb.ai_sessions.count_documents({}) == 1

        fb = await ai_agent.feedback({"run_id": "r-new", "rating": "down", "comment": "angka salah"}, user=USER)
        assert fb.get("success", True)
        with pytest.raises(Exception):
            await ai_agent.feedback({"run_id": "r-new", "rating": "down"}, user={**USER, "id": "u2"})   # bukan miliknya
        q = (await ai_router.ai_quality(days=30, user={"id": "admin", "permissions": ["*"]}))["data"]
        assert q["run"]["total"] == 1 and q["umpan_balik"]["tidak_suka"] == 1 and q["umpan_balik"]["keluhan_terbaru"][0]["comment"] == "angka salah"

        await mockdb.ai_memories.insert_one({"id": "m1", "user_id": "u1", "scope": "pribadi", "content": "x", "deleted_at": None})
        exp = await privacy.export_my_data(USER)
        assert [s["id"] for s in exp["percakapan"]] == ["s-new"] and exp["memori_pribadi"] and exp["umpan_balik"]
        out = await privacy.delete_my_data(USER)
        assert out["percakapan"] == 1 and out["memori"] == 1 and out["umpan_balik"] == 1
        assert not await mockdb.ai_sessions.count_documents({"user_id": "u1"})
    run(go())


def test_eval_cases_are_valid(app_catalog):
    """Kumpulan uji agen (dijalankan dengan Claude sungguhan lewat scripts/ai_eval.py) mengacu ke dataset & aksi yang ada."""
    from services.ai.agent import catalog, datasets
    from tests.ai_evals import CASES
    assert len(CASES) >= 20 and len({c["id"] for c in CASES}) == len(CASES)
    agents = {c["agen"] for c in CASES}
    assert {"pemandu", "analis", "finance", "purchasing", "inventory", "hr", "pengetahuan", "aksi", "outlet", "impor"} <= agents
    from pathlib import Path
    from services.ai.agent import personas
    base = Path(__file__).parent / "ai_evals"
    for c in CASES:
        if c.get("lampiran"):
            assert (base / c["lampiran"]).exists(), c["id"]
        if c.get("persona"):
            assert any(p["id"] == c["persona"] for p in personas.PERSONAS), c["id"]
    paths = {(o.method, o.path) for o in catalog.catalog()}
    for c in CASES:
        e = c["harap"]
        for ds in e.get("dataset", []):
            assert ds in datasets.DATASETS, (c["id"], ds)
        for ep in e.get("aksi", []):
            meth, path = ep.split(" ", 1)
            assert (meth, path) in paths, (c["id"], ep)
