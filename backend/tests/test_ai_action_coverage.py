"""Jaminan "AI bisa menjalankan semua aksi": setiap endpoint staf masuk katalog agen dengan izin yang terbaca, setiap
aksi tulis ber-body punya skema/petunjuk, dan TIDAK ADA aksi katalog yang galat 500 saat dijalankan lewat jalur
eksekusi agen dengan masukan kosong/id tidak dikenal (harus 4xx yang menjelaskan apa yang kurang). Tanpa jaringan."""
import asyncio

import mongomock_motor
import pytest
from fastapi.routing import APIRoute

from core import db as core_db
from core.config import settings

DUMMY = "00000000-0000-4000-8000-00000000dead"
SPECIAL = {"entity": "items", "period": "2026-11", "date": "2026-11-24", "month": "2026-11", "year": "2026", "kind": "kdo",
           "fmt": "xlsx", "format": "xlsx", "job_id": "anomaly_scan", "level": "group"}
SKIP = ("/api/admin/scheduler/jobs",)          # menjalankan job sungguhan


@pytest.fixture(scope="module")
def app():
    import server
    from services.ai.agent import catalog, executor
    executor.set_app(server.app)
    catalog.reset()
    catalog.catalog(server.app)
    return server.app


def _val(p):
    n = p["name"]
    if n in SPECIAL:
        return SPECIAL[n]
    if p.get("default") not in (None, ""):
        return p["default"]
    if "date" in n or n.endswith(("_from", "_to")):
        return "2026-11-24"
    t = p.get("type") or "string"
    if t in ("integer", "number", "int", "float"):
        return 1
    if t in ("boolean", "bool"):
        return False
    return DUMMY if n.endswith("id") else "x"


def test_every_staff_write_route_is_in_catalog_with_body_guidance(app):
    from services.ai.agent import catalog
    ops = {(o.method, o.path): o for o in catalog.catalog()}
    missing, no_hint = [], []
    for r in app.routes:
        if not isinstance(r, APIRoute) or not r.path.startswith("/api"):
            continue
        if r.path.startswith(catalog.EXCLUDED_PREFIXES) or r.path in catalog.EXCLUDED_PATHS:
            continue
        if catalog.CUSTOMER_DEPS & catalog._dep_names(r.dependant):
            continue
        for m in r.methods - {"HEAD", "OPTIONS"}:
            op = ops.get((m, r.path))
            if op is None:
                if m != "GET" and r.path.startswith(catalog.READ_ONLY_PREFIXES):
                    continue
                missing.append(f"{m} {r.path}")
            elif op.kind == "write" and r.body_field is not None and not (op.body_schema or op.body_hint):
                no_hint.append(f"{m} {r.path}")
    assert not missing, f"endpoint tidak bisa dijalankan AI: {missing[:20]}"
    assert not no_hint, f"aksi tulis tanpa skema/petunjuk body: {no_hint[:20]}"
    writes = [o for o in ops.values() if o.kind == "write"]
    # aksi tanpa izin eksplisit = endpoint yang memeriksa sendiri (cuti milik sendiri, mesin persetujuan) — tetap dijaga login
    assert len(writes) > 250 and sum(1 for o in writes if o.perms_all or o.perms_any) > len(writes) * 0.9


def test_no_catalog_action_crashes_through_agent_executor(app, monkeypatch):
    from services.ai.agent import catalog, executor
    mdb = mongomock_motor.AsyncMongoMockClient()["ai_cov_test"]
    monkeypatch.setattr(core_db, "_db", mdb)
    monkeypatch.setattr(settings, "feature_ai_enabled", False)       # jangan memanggil Claude
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    user = {"id": "u-admin", "email": "a@x", "full_name": "Admin", "role_ids": [], "outlet_ids": ["*"], "permissions": ["*"]}

    async def go():
        await mdb.users.insert_one({**user, "is_active": True, "status": "active", "deleted_at": None})
        await mdb.roles.insert_one({"id": "r-super", "code": "SUPER_ADMIN", "permissions": ["*"]})
        await mdb.users.update_one({"id": "u-admin"}, {"$set": {"role_ids": ["r-super"]}})
        crashed = []
        for op in catalog.catalog():
            if op.path.startswith(SKIP):
                continue
            pp = {p["name"]: _val(p) for p in op.path_params}
            q = {p["name"]: _val(p) for p in op.query_params if p.get("required")}
            body = {} if op.method in ("POST", "PUT", "PATCH") else None
            try:
                r = await asyncio.wait_for(executor.call(op, user, path_params=pp, query=q, body=body), timeout=30)
                if isinstance(r.get("status"), int) and r["status"] >= 500:
                    crashed.append(f"{op.method} {op.path}: {r.get('error')}")
            except Exception as e:  # noqa: BLE001
                crashed.append(f"{op.method} {op.path}: {type(e).__name__} {e}")
        return crashed
    crashed = asyncio.run(go())
    assert not crashed, "aksi galat 500 lewat agen:\n" + "\n".join(crashed[:30])


def test_crud_through_proposal_pipeline(app, monkeypatch):
    """Buat → ubah → hapus lewat usulan AI yang disetujui (dijalankan sebagai pengguna, tercatat di audit)."""
    from services.ai.agent import actions, catalog
    mdb = mongomock_motor.AsyncMongoMockClient()["ai_crud_test"]
    monkeypatch.setattr(core_db, "_db", mdb)
    user = {"id": "u-admin", "email": "a@x", "full_name": "Admin", "role_ids": ["r-super"], "outlet_ids": ["*"], "permissions": ["*"]}

    def op(method, path):
        return next(o.id for o in catalog.catalog() if o.method == method and o.path == path)

    async def do(method, path, body=None, pp=None):
        out = await actions.propose(user=user, session_id="s", run_id="r", summary="uji",
                                    items=[{"op_id": op(method, path), "title": path, "path_params": pp or {}, "body": body}])
        a = await actions.approve(out["actions"][0]["id"], user)
        assert a["status"] == "done", (method, path, a.get("error"))
        return a["result"]

    async def go():
        await mdb.users.insert_one({**user, "is_active": True, "status": "active", "deleted_at": None})
        await mdb.roles.insert_one({"id": "r-super", "code": "SUPER_ADMIN", "permissions": ["*"]})
        await mdb.outlets.insert_one({"id": "o1", "name": "Lounge", "brand_id": "b1", "deleted_at": None, "active": True})
        await mdb.brands.insert_one({"id": "b1", "name": "The Lounge", "deleted_at": None})
        r = await do("POST", "/api/master/{entity}", {"code": "IT-1", "name": "Bawang", "unit_default": "kg"}, {"entity": "items"})
        await do("PATCH", "/api/master/{entity}/{id_}", {"name": "Bawang Putih"}, {"entity": "items", "id_": r["id"]})
        assert (await mdb.items.find_one({"id": r["id"]}))["name"] == "Bawang Putih"
        await do("DELETE", "/api/master/{entity}/{id_}", None, {"entity": "items", "id_": r["id"]})
        assert (await mdb.items.find_one({"id": r["id"]}))["deleted_at"]
        m = await do("POST", "/api/menu/items", {"name": "Es Kopi", "brand_id": "b1", "price": 25000})
        await do("PATCH", "/api/menu/items/{item_id}", {"price": 27000}, {"item_id": m["id"]})
        assert (await mdb.menu_items.find_one({"id": m["id"]}))["price"] == 27000
        await do("DELETE", "/api/menu/items/{item_id}", None, {"item_id": m["id"]})
        logs = {x["action"] async for x in mdb.audit_log.find({"entity_type": "ai_action"})}
        assert {"propose", "execute"} <= logs
    asyncio.run(go())
