"""
Alur bisnis LINTAS PERAN — tiap langkah dijalankan oleh peran demo pemiliknya (bukan admin), dan peran lain ditolak.

  P2P   : Outlet Manager buat PR (diajukan) → Procurement approve → Procurement buat PO dari PR → ajukan →
          approver lain approve (SoD: pembuat tidak boleh) → Procurement terima barang (GR, JE seimbang)
          → Finance buat Payment untuk GR (debit Hutang Usaha) → approver lain approve → Finance mark paid
          → JE pembayaran seimbang, GR lunas.
  Sales : Outlet Manager input & ajukan Daily Sales toko sendiri → Outlet Manager TIDAK bisa validasi →
          Finance validasi → JE seimbang = grand total.
  Scope : Outlet Manager toko lain tidak bisa membaca PR toko ini.
  Period: hanya Finance yang bisa menjalankan cek closing / close / lock.

Melengkapi test_deep_business_logic.py (yang menjalankan alur yang sama sebagai admin). DB demo dipulihkan oleh
fixture snapshot di conftest.
"""
from datetime import date, timedelta

import pytest
from pymongo import MongoClient

from .conftest import _load_backend_env, api_get, api_post

pytestmark = pytest.mark.e2e


def _ok(r):
    j = r.json()
    assert r.status_code == 200 and j.get("success") is True, f"{r.request.method} {r.request.url} → {r.status_code} {r.text[:300]}"
    return j.get("data")


def _denied(r):
    """Ditolak = 401/403/409/422 atau envelope success=false — tidak pernah 5xx, tidak pernah sukses."""
    assert r.status_code < 500, f"5xx: {r.status_code} {r.text[:200]}"
    assert not (r.status_code == 200 and r.json().get("success") is True), f"seharusnya ditolak: {r.text[:200]}"


def _je_totals(client, token, je_id):
    je = _ok(api_get(client, f"/finance/journals/{je_id}", token))
    lines = je.get("lines") or []
    dr = round(sum(float(x.get("debit") or x.get("dr") or 0) for x in lines), 2)
    cr = round(sum(float(x.get("credit") or x.get("cr") or 0) for x in lines), 2)
    return dr, cr


def _approve_until_done(client, path, doc_id, approvers, tokens):
    """Jalankan semua step approval: tiap step dicoba oleh peran di `approvers` (urut) sampai satu berhasil."""
    for _ in range(6):
        r = api_get(client, f"{path}/{doc_id}/approval-state", tokens["admin"])
        # Payment tidak punya /approval-state; statusnya ikut di detail dokumen (approval_state)
        state = _ok(r) if r.status_code != 404 else (_ok(api_get(client, f"{path}/{doc_id}", tokens["admin"])).get("approval_state") or {})
        if not state.get("has_workflow") or state.get("is_complete"):
            return state
        errors = []
        for role in approvers:
            r = api_post(client, f"{path}/{doc_id}/approve", tokens[role], json={})
            if r.status_code == 200 and r.json().get("success"):
                break
            errors.append(f"{role}: {r.status_code} {r.text[:120]}")
        else:
            pytest.fail(f"tidak ada approver yang bisa menyetujui step {state.get('current_step_idx')} "
                        f"({state.get('steps')}): {errors}")
    pytest.fail("approval tidak selesai dalam 6 step")


@pytest.fixture(scope="module")
def db():
    env = _load_backend_env()
    client = MongoClient(env["MONGO_URL"])
    yield client[env["DB_NAME"]]
    client.close()


@pytest.fixture(scope="module")
def roles(tokens):
    need = ["admin", "executive", "finance", "procurement", "alt_manager", "dls_manager"]
    missing = [k for k in need if k not in tokens]
    if missing:
        pytest.skip(f"peran demo tidak bisa login: {missing}")
    return tokens


@pytest.fixture(scope="module")
def mgr_outlet(http_client, roles):
    me = _ok(api_get(http_client, "/auth/me", roles["alt_manager"]))
    outlet = me.get("default_outlet_id") or (me.get("outlet_ids") or [None])[0]
    if not outlet:
        pytest.skip("cfs.manager tidak punya toko")
    return outlet


@pytest.fixture(scope="module")
def vendor_and_item(http_client, roles):
    vendors = _ok(api_get(http_client, "/master/vendors?per_page=5", roles["admin"]))
    items = _ok(api_get(http_client, "/master/items?per_page=20", roles["admin"]))
    vendors = vendors if isinstance(vendors, list) else vendors.get("items", [])
    items = items if isinstance(items, list) else items.get("items", [])
    stock_items = [i for i in items if i.get("unit")] or items
    if not vendors or not stock_items:
        pytest.skip("butuh vendor & item master")
    return vendors[0]["id"], stock_items[0]


def test_procure_to_pay_by_role(http_client, roles, mgr_outlet, vendor_and_item, db):
    c, t = http_client, roles
    vendor_id, item = vendor_and_item
    qty, unit_cost = 2, 10000  # Rp 20.000 — Tier 1, di bawah budget toko

    # 1) Outlet Manager: buat & ajukan PR untuk tokonya sendiri
    pr = _ok(api_post(c, "/procurement/prs", t["alt_manager"], json={
        "outlet_id": mgr_outlet, "status": "submitted", "request_date": date.today().isoformat(),
        "notes": "QA-ROLE-FLOW PR",
        "lines": [{"item_id": item["id"], "item_name": item["name"], "qty": qty, "unit": item.get("unit") or "PCS",
                   "est_cost": unit_cost}],
    }))
    assert pr["status"] == "submitted" and pr["outlet_id"] == mgr_outlet

    # Outlet Manager tidak bisa menyetujui PR-nya sendiri; outlet manager brand lain tidak bisa membacanya
    _denied(api_post(c, f"/procurement/prs/{pr['id']}/approve", t["alt_manager"], json={}))
    r_other = api_get(c, f"/procurement/prs/{pr['id']}", t["dls_manager"])
    assert r_other.status_code in (403, 404), f"PR toko lain terbaca oleh manager lain: {r_other.status_code}"
    listed = _ok(api_get(c, "/procurement/prs?per_page=100", t["dls_manager"]))
    listed = listed if isinstance(listed, list) else listed.get("items", [])
    assert pr["id"] not in {x["id"] for x in listed}, "PR toko lain muncul di daftar manager lain"

    # 2) Procurement: approve PR
    _approve_until_done(c, "/procurement/prs", pr["id"], ["procurement", "executive", "admin"], t)
    assert _ok(api_get(c, f"/procurement/prs/{pr['id']}", t["procurement"]))["status"] == "approved"

    # 3) Procurement: buat PO dari PR (Outlet Manager tidak boleh membuat PO)
    po_payload = {
        "vendor_id": vendor_id, "outlet_id": mgr_outlet, "pr_ids": [pr["id"]], "order_date": date.today().isoformat(),
        "lines": [{"item_id": item["id"], "item_name": item["name"], "qty": qty, "unit": item.get("unit") or "PCS",
                   "unit_cost": unit_cost, "tax_rate": 0}],
    }
    _denied(api_post(c, "/procurement/pos", t["alt_manager"], json=po_payload))
    po = _ok(api_post(c, "/procurement/pos", t["procurement"], json=po_payload))
    assert abs(float(po["grand_total"]) - qty * unit_cost) < 0.01
    assert _ok(api_get(c, f"/procurement/prs/{pr['id']}", t["procurement"]))["status"] == "converted"

    # 4) Ajukan PO; pembuat (procurement) tidak boleh approve sendiri (SoD) → approver lain
    _ok(api_post(c, f"/procurement/pos/{po['id']}/submit", t["procurement"]))
    _denied(api_post(c, f"/procurement/pos/{po['id']}/approve", t["procurement"], json={}))
    _approve_until_done(c, "/procurement/pos", po["id"], ["executive", "finance", "admin"], t)
    assert _ok(api_get(c, f"/procurement/pos/{po['id']}", t["procurement"]))["status"] == "approved"

    # 5) GR oleh Procurement (Outlet Manager tidak punya izin GR) → stok & JE hutang seimbang
    gr_payload = {
        "po_id": po["id"], "vendor_id": vendor_id, "outlet_id": mgr_outlet,
        "receive_date": date.today().isoformat(), "tax_rate": 0,
        "lines": [{"item_id": item["id"], "item_name": item["name"], "qty_ordered": qty, "qty_received": qty,
                   "unit_cost": unit_cost, "unit": item.get("unit") or "PCS"}],
    }
    _denied(api_post(c, "/procurement/grs", t["alt_manager"], json=gr_payload))
    gr = _ok(api_post(c, "/procurement/grs", t["procurement"], json=gr_payload))
    assert gr.get("journal_entry_id"), f"GR tanpa JE: {gr}"
    dr, cr = _je_totals(c, t["finance"], gr["journal_entry_id"])
    assert dr == cr == qty * unit_cost, f"JE GR tidak seimbang/tidak sama nilai: {dr}/{cr}"

    # 6) Finance: Payment untuk GR (debit Hutang Usaha); Outlet Manager & Procurement tidak boleh membuat Payment
    mapping = (db.system_settings.find_one({"key": "gl_mapping"}) or {}).get("value") or {}
    ap_id = mapping.get("accounts_payable")
    bank = db.bank_accounts.find_one({"deleted_at": None, "gl_account_id": {"$ne": None}})
    if not ap_id or not bank:
        pytest.skip("GL mapping AP / rekening bank tidak tersedia")
    pay_payload = {
        "payee_type": "vendor", "payee_id": vendor_id, "amount": float(gr["grand_total"]),
        "description": f"QA-ROLE-FLOW bayar {gr['doc_no']}", "gl_debit_id": ap_id,
        "bank_account_id": bank["id"], "gr_id": gr["id"], "request_date": date.today().isoformat(),
    }
    _denied(api_post(c, "/finance/payments", t["alt_manager"], json=pay_payload))
    _denied(api_post(c, "/finance/payments", t["procurement"], json=pay_payload))
    pay = _ok(api_post(c, "/finance/payments", t["finance"], json=pay_payload))
    _ok(api_post(c, f"/finance/payments/{pay['id']}/submit", t["finance"]))
    _denied(api_post(c, f"/finance/payments/{pay['id']}/approve", t["finance"], json={}))  # SoD
    _approve_until_done(c, "/finance/payments", pay["id"], ["executive", "admin"], t)

    # 7) Finance: mark paid → JE pembayaran seimbang, GR lunas, Outlet Manager tidak bisa mark paid
    _denied(api_post(c, f"/finance/payments/{pay['id']}/mark-paid", t["alt_manager"], json={}))
    paid = _ok(api_post(c, f"/finance/payments/{pay['id']}/mark-paid", t["finance"], json={
        "payment_date": date.today().isoformat(), "bank_account_id": bank["id"], "payment_ref": "QA-ROLE-FLOW"}))
    assert paid["status"] == "paid", paid
    je_id = paid.get("journal_entry_id") or paid.get("je_id")
    assert je_id, f"Payment paid tanpa JE: {paid}"
    dr, cr = _je_totals(c, t["finance"], je_id)
    assert dr == cr == float(gr["grand_total"]), f"JE pembayaran {dr}/{cr}"
    gr_doc = db.goods_receipts.find_one({"id": gr["id"]})
    assert gr_doc.get("payment_status") == "paid" or gr_doc.get("paid_at"), f"GR belum lunas: {gr_doc.get('payment_status')}"


def _free_sales_date(c, token, outlet_id):
    d = date.today()
    for _ in range(120):
        s = d.isoformat()
        rows = _ok(api_get(c, f"/outlet/daily-sales?outlet_id={outlet_id}&date_from={s}&date_to={s}", token))
        st = api_get(c, f"/outlet/daily-close/status?outlet_id={outlet_id}&date={s}", token)
        closed = st.status_code == 200 and (st.json().get("data") or {}).get("closed")
        if not rows and not closed:
            return s
        d -= timedelta(days=1)
    pytest.skip("tidak ada tanggal kosong untuk daily sales")


def test_daily_sales_by_role(http_client, roles, mgr_outlet):
    c, t = http_client, roles
    pms = _ok(api_get(c, "/master/payment-methods", t["alt_manager"]))
    pms = pms if isinstance(pms, list) else pms.get("items", [])
    grand = 450000
    ds = _ok(api_post(c, "/outlet/daily-sales/draft", t["alt_manager"], json={
        "outlet_id": mgr_outlet, "sales_date": _free_sales_date(c, t["alt_manager"], mgr_outlet),
        "revenue_buckets": [{"bucket": "food", "amount": 250000}, {"bucket": "beverage", "amount": 200000}],
        "payment_breakdown": [{"payment_method_id": pms[0]["id"] if pms else None, "amount": grand}],
        "grand_total": grand, "notes": "QA-ROLE-FLOW daily sales",
    }))
    _ok(api_post(c, f"/outlet/daily-sales/{ds['id']}/submit", t["alt_manager"], json={}))

    # Outlet Manager & Procurement tidak boleh memvalidasi; Finance boleh → JE seimbang = grand total
    _denied(api_post(c, f"/outlet/daily-sales/{ds['id']}/validate", t["alt_manager"], json={}))
    _denied(api_post(c, f"/outlet/daily-sales/{ds['id']}/validate", t["procurement"], json={}))
    v = _ok(api_post(c, f"/outlet/daily-sales/{ds['id']}/validate", t["finance"], json={}))
    je_id = v.get("journal_entry_id") or v.get("je_id")
    assert je_id, f"validasi tanpa JE: {v}"
    dr, cr = _je_totals(c, t["finance"], je_id)
    assert dr == cr == grand, f"JE daily sales {dr}/{cr} ≠ {grand}"


def test_period_closing_by_role(http_client, roles):
    """Penutupan periode hanya Finance: peran operasional ditolak (403), Finance bisa menjalankan cek closing."""
    c, t = http_client, roles
    period = date.today().strftime("%Y-%m")
    for role in ("alt_manager", "procurement"):
        _denied(api_get(c, f"/finance/periods/{period}/closing-checks", t[role]))
        _denied(api_post(c, "/finance/periods/2099-12/close", t[role], json={"reason": "QA"}))
        _denied(api_post(c, "/finance/periods/2099-12/lock", t[role], json={"reason": "QA"}))
    checks = _ok(api_get(c, f"/finance/periods/{period}/closing-checks", t["finance"]))
    assert checks is not None


def test_po_approver_can_read_pos(http_client, roles):
    """Approver PO tanpa izin create (Owner) tetap bisa membuka daftar & detail PO yang ia setujui;
    Outlet Manager (tanpa create/approve) tetap ditolak."""
    c, t = http_client, roles
    if "owner" not in t:
        pytest.skip("owner demo tidak tersedia")
    me = _ok(api_get(c, "/auth/me", t["owner"]))
    perms = set(me.get("permissions") or [])
    assert "procurement.po.approve" in perms and "procurement.po.create" not in perms, "asumsi seed owner berubah"
    pos = _ok(api_get(c, "/procurement/pos?per_page=5", t["owner"]))
    pos = pos if isinstance(pos, list) else pos.get("items", [])
    if pos:
        _ok(api_get(c, f"/procurement/pos/{pos[0]['id']}", t["owner"]))
    _denied(api_get(c, "/procurement/pos?per_page=5", t["alt_manager"]))
