"""Peran & hak akses yang dapat dikonfigurasi penuh (routers/admin.py, core/perms_registry.py).

Peran bawaan bisa diubah & dikembalikan ke bawaan; Super Admin terkunci; izin di luar katalog / "*" ditolak;
pengubah tidak bisa memberi izin yang tidak ia miliki; riwayat & izin efektif tersedia. Tes membersihkan datanya sendiri.
"""
import uuid

import pytest
from pymongo import MongoClient

from core.perms_registry import grouped, known_codes

from .conftest import DEMO_PASSWORD, _load_backend_env, _login, api_get, api_post


def _ok(r):
    j = r.json()
    assert r.status_code == 200 and j.get("success") is True, f"{r.request.method} {r.request.url} → {r.status_code} {r.text[:300]}"
    return j.get("data")


def _patch(c, path, token, body):
    return c.patch(path, json=body, headers={"Authorization": f"Bearer {token}"})


def test_grouped_catalog_covers_every_code():
    g = grouped()
    codes = {p["code"] for portal in g["portals"] for m in portal["modules"] for p in m["permissions"]}
    assert codes | {"*"} == known_codes()
    for portal in g["portals"]:
        for m in portal["modules"]:
            assert m["label"]
            for p in m["permissions"]:
                assert p["action"] in {a["id"] for a in g["actions"]}
                assert p["label"]
                # dependensi hanya menunjuk izin "lihat" di modul yang sama
                for req in p["requires"]:
                    assert req in {x["code"] for x in m["permissions"] if x["action"] == "view"}


@pytest.fixture(scope="module")
def env(http_client, tokens):
    db = MongoClient(_load_backend_env()["MONGO_URL"])[_load_backend_env()["DB_NAME"]]
    created_roles, created_users = [], []
    roles = {r["code"]: r for r in _ok(api_get(http_client, "/admin/roles", tokens["admin"]))}
    yield {"c": http_client, "t": tokens, "roles": roles, "db": db, "created_roles": created_roles, "created_users": created_users}
    # bersihkan: kembalikan peran bawaan yang diubah, hapus peran/user uji
    for code in ("EXECUTIVE",):
        r = roles[code]
        db.roles.update_one({"id": r["id"]}, {"$set": {"permissions": r["permissions"]}})
    db.roles.delete_many({"id": {"$in": created_roles}})
    db.users.delete_many({"id": {"$in": created_users}})


def test_system_role_is_editable_and_resettable(env):
    c, t, roles = env["c"], env["t"], env["roles"]
    ex = roles["EXECUTIVE"]
    assert not ex["locked"] and ex["has_default"] and not ex["modified"]
    drop = sorted(ex["permissions"])[0]
    upd = _ok(_patch(c, f"/admin/roles/{ex['id']}", t["admin"], {"permissions": [p for p in ex["permissions"] if p != drop],
                                                                 "description": "QA edit"}))
    assert drop not in upd["permissions"] and upd["modified"] is True
    hist = _ok(api_get(c, f"/admin/roles/{ex['id']}/history", t["admin"]))
    assert hist and drop in hist[0]["removed"]
    back = _ok(api_post(c, f"/admin/roles/{ex['id']}/reset", t["admin"], json={}))
    assert set(back["permissions"]) == set(ex["default_permissions"]) and back["modified"] is False
    # perubahan langsung berlaku: izin efektif user executive mengikuti peran
    users = _ok(api_get(c, f"/admin/roles/{ex['id']}/users", t["admin"]))
    if users:
        eff = _ok(api_get(c, f"/admin/users/{users[0]['id']}/effective-permissions", t["admin"]))
        assert drop in {p["code"] for p in eff["permissions"]}


def test_guards(env):
    c, t, roles = env["c"], env["t"], env["roles"]
    sa = roles["SUPER_ADMIN"]
    assert sa["locked"]
    assert _patch(c, f"/admin/roles/{sa['id']}", t["admin"], {"permissions": []}).status_code in (400, 422)
    ex = roles["EXECUTIVE"]
    assert _patch(c, f"/admin/roles/{ex['id']}", t["admin"], {"permissions": ["tidak.ada.izin"]}).status_code in (400, 422)
    assert _patch(c, f"/admin/roles/{ex['id']}", t["admin"], {"permissions": ["*"]}).status_code in (400, 422)
    # peran bawaan tidak bisa dihapus
    assert c.delete(f"/admin/roles/{ex['id']}", headers={"Authorization": f"Bearer {t['admin']}"}).status_code in (400, 422)
    # kode peran harus format KODE_BESAR
    assert api_post(c, "/admin/roles", t["admin"], json={"code": "bad code", "name": "x"}).status_code in (400, 422)


def test_duplicate_custom_role_and_no_escalation(env):
    c, t, roles, db = env["c"], env["t"], env["roles"], env["db"]
    code = f"QA_ROLE_{uuid.uuid4().hex[:6].upper()}"
    dup = _ok(api_post(c, f"/admin/roles/{roles['PROCUREMENT_STAFF']['id']}/duplicate", t["admin"],
                       json={"code": code, "name": "QA Duplikat"}))
    env["created_roles"].append(dup["id"])
    assert dup["is_system"] is False and set(dup["permissions"]) == set(roles["PROCUREMENT_STAFF"]["permissions"])

    # pengelola peran non-super: tidak bisa menambah izin yang tidak ia miliki
    mgr = _ok(api_post(c, "/admin/roles", t["admin"], json={
        "code": f"QA_RM_{uuid.uuid4().hex[:6].upper()}", "name": "QA Role Manager",
        "permissions": ["admin.role.manage", "admin.user.read", "procurement.pr.read"]}))
    env["created_roles"].append(mgr["id"])
    email = f"qa.rolemgr.{uuid.uuid4().hex[:6]}@fnbgroup.id"
    u = _ok(api_post(c, "/admin/users", t["admin"], json={"email": email, "full_name": "QA Role Mgr",
                                                         "password": DEMO_PASSWORD, "role_ids": [mgr["id"]], "outlet_ids": ["*"]}))
    env["created_users"].append(u["id"])
    tok = _login(c, email)
    assert tok
    r = _patch(c, f"/admin/roles/{dup['id']}", tok, {"permissions": dup["permissions"] + ["finance.period.unlock"]})
    assert r.status_code == 403
    # mencabut izin yang ia tidak punya tetap boleh (bukan eskalasi)
    keep = [p for p in dup["permissions"] if p != dup["permissions"][0]]
    assert _patch(c, f"/admin/roles/{dup['id']}", tok, {"permissions": keep}).status_code == 200
    # hapus peran kustom tanpa user
    assert c.delete(f"/admin/roles/{dup['id']}", headers={"Authorization": f"Bearer {t['admin']}"}).status_code == 200


def test_grants_ledger_prevents_readding(env):
    led = env["db"].system_settings.find_one({"key": "rbac_grants_applied"})
    assert led and "PROCUREMENT_MANAGER:procurement.sourcing.read" in led["value"]
