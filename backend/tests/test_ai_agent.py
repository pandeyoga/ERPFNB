"""Agen AI: katalog aksi (otomatis dari route + izin), usulan & persetujuan (anti-dobel, kepemilikan, tombol darurat),
pemandu (izin route), dan loop agen dengan model tiruan. Tanpa jaringan & tanpa server (mongomock)."""
import asyncio
import types

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
    db = mongomock_motor.AsyncMongoMockClient()["ai_agent_test"]
    monkeypatch.setattr(core_db, "_db", db)
    monkeypatch.setattr(settings, "feature_ai_enabled", True)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    from core import runtime_config
    runtime_config.invalidate()
    return db


USER = {"id": "u1", "email": "u1@x", "full_name": "Uji", "role_ids": [], "outlet_ids": ["*"],
        "permissions": ["reservations.create", "procurement.po.create", "ai.agent.use"]}


def test_catalog_built_from_routes_with_permissions(app_catalog):
    from services.ai.agent import catalog
    assert len(app_catalog) > 500
    ids = {o.id for o in app_catalog}
    assert "post_reservations" in ids and "post_procurement_pos" in ids and "get_finance_profit_loss" in ids
    assert not any(o.path.startswith("/api/auth") for o in app_catalog)                 # D5: login/token
    assert not any(o.path.startswith("/api/system-settings") for o in app_catalog)      # D5: pengaturan
    assert not any(o.kind == "write" and o.path.startswith("/api/admin/roles") for o in app_catalog)  # D5: peran
    po = catalog.get("post_procurement_pos")
    assert po.perms_all == ["procurement.po.create"] and po.kind == "write" and po.body_hint
    assert catalog.get("get_finance_profit_loss").kind == "read"
    assert catalog.get("post_sourcing_price_check").kind == "read"   # POST yang hanya membaca
    assert catalog.get("delete_sourcing_offers_offer_id").risk == "kritis"
    # pencarian Indonesia + izin
    assert "post_procurement_pos" in [o.id for o in catalog.search("buat PO", {"*"})]
    allowed = {o.id for o in catalog.search("reservasi", set(USER["permissions"]), kind="write")}
    assert "post_reservations" in allowed
    assert not [o for o in catalog.search("hapus jurnal manual", {"reservations.create"}, kind="write")
                if o.path.startswith("/api/finance")]
    # penjaga peran (require_role) → hanya Super Admin; endpoint pelanggan & hapus massal tidak masuk katalog
    assert not any(o.path.startswith(("/api/admin/data", "/api/loyalty/login", "/api/loyalty/card")) for o in app_catalog)
    assert not any(o.kind == "write" and o.path.startswith("/api/admin/business-rules") for o in app_catalog)
    assert catalog.get("post_forecasting_guard_check").kind == "read"


def test_propose_approve_once_and_ownership(app_catalog, mockdb, monkeypatch):
    from services.ai.agent import actions, executor
    calls = []

    async def fake_call(op, user, **kw):
        calls.append((op.id, kw.get("body"), kw.get("idempotency_key")))
        return {"status": 200, "data": {"id": "res-1", "status": "pending"}}
    monkeypatch.setattr(executor, "call", fake_call)
    out = run(actions.propose(user=USER, session_id="s1", run_id="r1", summary="uji",
                              items=[{"op_id": "post_reservations", "title": "Reservasi Budi", "body": {"pax": 4}},
                                     {"op_id": "get_reservations", "title": "baca"},              # bukan aksi tulis
                                     {"op_id": "post_finance_journals_manual", "title": "jurnal"}]))  # tanpa izin
    assert len(out["actions"]) == 1 and len(out["errors"]) == 2
    aid = out["actions"][0]["id"]
    with pytest.raises(Exception):
        run(actions.approve(aid, {**USER, "id": "u2"}))                       # bukan pemilik
    a1 = run(actions.approve(aid, USER, body={"pax": 5}))                     # pengguna mengubah isi
    a2 = run(actions.approve(aid, USER))                                      # klik dobel
    assert a1["status"] == a2["status"] == "done" and len(calls) == 1
    assert calls[0][1] == {"pax": 5} and a1["original_body"] == {"pax": 4}
    assert "BERHASIL" in actions.outcome_text([a1]) and "diubah pengguna" in actions.outcome_text([a1])
    assert run(actions.batch_settled(out["batch_id"])) is True
    logs = run(mockdb.audit_log.find({"entity_type": "ai_action"}).to_list(10))
    assert {log["action"] for log in logs} >= {"propose", "execute"}


def test_kill_switch_blocks_writes(app_catalog, mockdb):
    from services.ai import client as ai
    from services.ai.agent import actions
    run(ai.update_policy({"write_actions_enabled": False}, user={"id": "admin"}))
    with pytest.raises(Exception):
        run(actions.propose(user=USER, session_id="s", run_id=None, summary="x",
                            items=[{"op_id": "post_reservations", "title": "t", "body": {}}]))


def test_guide_respects_route_permissions():
    from services.ai.agent import tools
    assert tools.can_open("/procurement/sourcing", {"procurement.sourcing.read"})
    assert not tools.can_open("/procurement/sourcing", {"hr.read"})
    assert tools.can_open("/anything", {"*"})
    res = tools.guide_search("cara buat purchase order", {"*"})
    assert res["halaman"] or res["tour"]


def test_agent_loop_with_scripted_model(app_catalog, mockdb, monkeypatch):
    """Model tiruan: panggil search_actions, lalu jawab. Riwayat append-only & run selesai."""
    from services.ai import client as ai
    from services.ai.agent import runtime
    replies = [
        types.SimpleNamespace(stop_reason="tool_use", model="claude-opus-5-5", usage=types.SimpleNamespace(
            input_tokens=100, output_tokens=10), content=[types.SimpleNamespace(
                model_dump=lambda **k: {"type": "tool_use", "id": "tu1", "name": "search_actions",
                                        "input": {"query": "reservasi", "kind": "write"}})]),
        types.SimpleNamespace(stop_reason="end_turn", model="claude-opus-5-5", usage=types.SimpleNamespace(
            input_tokens=200, output_tokens=20), content=[types.SimpleNamespace(
                model_dump=lambda **k: {"type": "text", "text": "Siap membuat reservasi."})]),
    ]
    sent = []

    async def fake_create(**kw):
        sent.append([dict(m) for m in kw["messages"]])
        return replies[len(sent) - 1]
    monkeypatch.setattr(ai, "create", fake_create)
    run(mockdb.outlets.insert_one({"id": "o1", "name": "Toko 1", "deleted_at": None}))

    async def go():
        out = await runtime.start_run(USER, message="buat reservasi")
        while (await runtime.get_run(out["run_id"], USER))["status"] == "running":
            await asyncio.sleep(0.01)
        return out
    out = run(go())
    r = run(runtime.get_run(out["run_id"], USER))
    assert r["status"] == "done" and r["answer"]["text"] == "Siap membuat reservasi."
    s = run(mockdb.ai_sessions.find_one({"id": out["session_id"]}))
    roles = [m["role"] for m in s["messages"]]
    assert roles == ["user", "assistant", "user", "assistant"]          # tool_result dikirim sebagai pesan user
    assert sent[1][:2] == sent[0][:2] or sent[1][0] == sent[0][0]        # awal riwayat tidak berubah (append-only)
    assert s["messages"][2]["content"][0]["type"] == "tool_result"


def test_agent_keeps_interim_explanation(app_catalog, mockdb, monkeypatch):
    """Penjelasan substantif yang ditulis model sebelum memanggil alat tidak hilang dari jawaban akhir."""
    from services.ai import client as ai
    from services.ai.agent import runtime
    expl = ("Jurnal tidak bisa diposting karena periode bulan lalu sudah dikunci (lock) di Period Closing; "
            "saya cek status periodenya dulu.")

    def blk(d):
        return types.SimpleNamespace(model_dump=lambda **k: d)
    replies = [
        types.SimpleNamespace(stop_reason="tool_use", model="claude-opus-5-5", usage=types.SimpleNamespace(
            input_tokens=100, output_tokens=10), content=[blk({"type": "text", "text": expl}), blk(
                {"type": "tool_use", "id": "tu1", "name": "search_actions", "input": {"query": "periode", "kind": "read"}})]),
        types.SimpleNamespace(stop_reason="end_turn", model="claude-opus-5-5", usage=types.SimpleNamespace(
            input_tokens=200, output_tokens=20), content=[blk({"type": "text", "text": "Buka kunci periode lewat Period Closing."})]),
    ]
    n = []

    async def fake_create(**kw):
        n.append(1)
        return replies[len(n) - 1]
    monkeypatch.setattr(ai, "create", fake_create)

    async def go():
        out = await runtime.start_run(USER, message="kenapa jurnal tidak bisa diposting")
        while (await runtime.get_run(out["run_id"], USER))["status"] == "running":
            await asyncio.sleep(0.01)
        return (await runtime.get_run(out["run_id"], USER))["answer"]["text"]
    text = run(go())
    assert text.startswith(expl) and text.endswith("Buka kunci periode lewat Period Closing.")


def test_query_data_scope_permissions_and_aggregation(mockdb):
    from services.ai.agent import datasets
    rows = [{"id": f"s{i}", "outlet_id": o, "brand_id": "b1", "sales_date": d, "status": st, "grand_total": gt,
             "transaction_count": 10, "deleted_at": None}
            for i, (o, d, st, gt) in enumerate([("o1", "2026-11-01", "validated", 100.0), ("o1", "2026-11-02", "validated", 50.0),
                                               ("o2", "2026-11-01", "validated", 70.0), ("o2", "2026-11-02", "draft", 999.0),
                                               ("o3", "2026-10-15", "validated", 30.0)])]
    run(mockdb.daily_sales.insert_many(rows))
    run(mockdb.outlets.insert_many([{"id": "o1", "name": "Satu"}, {"id": "o2", "name": "Dua"}, {"id": "o3", "name": "Tiga"}]))
    spec = {"dataset": "sales_daily", "date_from": "2026-11-01", "date_to": "2026-11-30",
            "filters": [{"field": "status", "value": "validated"}], "group_by": ["outlet_id"],
            "metrics": [{"fn": "sum", "field": "grand_total", "as": "rev"}]}
    sup = run(datasets.run({"id": "a", "permissions": ["*"], "outlet_ids": ["*"]}, spec))
    assert {(r["outlet_id_name"], r["rev"]) for r in sup["rows"]} == {("Satu", 150.0), ("Dua", 70.0)}
    scoped = run(datasets.run({"id": "b", "permissions": ["outlet.daily_sales.read"], "outlet_ids": ["o2"]}, spec))
    assert [r["outlet_id"] for r in scoped["rows"]] == ["o2"]                       # dibatasi akses toko
    asked = run(datasets.run({"id": "b", "permissions": ["outlet.daily_sales.read"], "outlet_ids": ["o2"]},
                             {**spec, "outlet_ids": ["o1"]}))
    assert asked["rows"] == []                                                        # tidak pernah melebar
    month = run(datasets.run({"id": "a", "permissions": ["*"], "outlet_ids": ["*"]},
                             {"dataset": "sales_daily", "group_by": ["date:month"], "metrics": [{"fn": "count"}]}))
    assert {r["sales_date:month"]: r["count"] for r in month["rows"]} == {"2026-10": 1, "2026-11": 4}
    with pytest.raises(Exception):
        run(datasets.run({"id": "b", "permissions": ["outlet.daily_sales.read"], "outlet_ids": ["*"]}, {"dataset": "payroll"}))
    with pytest.raises(Exception):
        run(datasets.run({"id": "a", "permissions": ["*"]}, {"dataset": "customers", "fields": ["hashed_password"]}))
    a, b = datasets.resolve_period("last_month", today=datasets.date(2026, 3, 15))
    assert (a, b) == ("2026-02-01", "2026-02-28")


def test_reports_build_xlsx_and_pdf():
    from services.ai.agent import reports
    spec = {"title": "Uji", "format": "xlsx", "sections": [
        {"heading": "Per toko", "text": "**Naik** 5%", "table": {"columns": ["Toko", "Rev"], "rows": [["A", "1.000.000"]], "number_format": "rp"},
         "chart": {"type": "bar", "x_key": "t", "series": [{"key": "v"}], "data": [{"t": "A", "v": 1}]}},
        {"table": {"columns": ["x"], "rows": [[1]]}}]}
    x, fx, _ = reports.build(spec)
    p, fp, ct = reports.build({**spec, "format": "pdf"})
    assert x[:2] == b"PK" and fx.endswith(".xlsx") and p[:4] == b"%PDF" and ct == "application/pdf"
    with pytest.raises(Exception):
        reports.build({"title": "", "format": "xlsx", "sections": [{}]})


def test_rate_limit_buckets_and_cookie_user_key():
    """Polling GET /api/ai/* tidak memakai kuota LLM (30/menit); pengguna browser (cookie) dikunci per user, bukan IP."""
    from starlette.requests import Request
    from core.middleware import RateLimitMiddleware
    from core.security import ACCESS_COOKIE, create_access_token

    def req(method, path, cookie=None):
        headers = [(b"cookie", f"{ACCESS_COOKIE}={cookie}".encode())] if cookie else []
        return Request({"type": "http", "method": method, "path": path, "headers": headers, "query_string": b"",
                        "client": ("10.0.0.9", 1234), "server": ("x", 80), "scheme": "http"})
    mw = RateLimitMiddleware.__new__(RateLimitMiddleware)
    tok = create_access_token("user-42", {})
    assert mw._classify(req("GET", "/api/ai/agent/runs/r1", tok)) == ("api", "user:user-42")
    assert mw._classify(req("POST", "/api/ai/agent/chat", tok)) == ("ai", "user:user-42")
    assert mw._classify(req("POST", "/api/ai/agent/pins/p1/refresh", tok))[0] == "api"
    assert mw._classify(req("GET", "/api/finance/journals"))[1].startswith("ip:")
