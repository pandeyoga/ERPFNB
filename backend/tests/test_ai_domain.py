"""Agen domain: Inventory (teoretis vs aktual, waste, saran transfer), Outlet (briefing), HR (labor cost, cakupan cuti),
menu engineering, persona chat. Tanpa jaringan (mongomock)."""
import asyncio
from datetime import date, timedelta

import mongomock_motor
import pytest

from core import db as core_db

USER = {"id": "u1", "permissions": ["*"], "outlet_ids": ["*"]}
T = date.today()


def d(n):
    return (T - timedelta(days=n)).isoformat()


@pytest.fixture()
def db(monkeypatch):
    mdb = mongomock_motor.AsyncMongoMockClient()["ai_domain"]
    monkeypatch.setattr(core_db, "_db", mdb)

    async def seed():
        await mdb.outlets.insert_many([{"id": "o1", "name": "Lounge", "deleted_at": None}, {"id": "o2", "name": "Bistro", "deleted_at": None}])
        await mdb.items.insert_many([{"id": "kopi", "name": "Kopi Arabica", "unit_default": "kg", "deleted_at": None},
                                     {"id": "susu", "name": "Susu", "unit_default": "l", "deleted_at": None}])
        await mdb.menu_items.insert_many([
            {"id": "m-latte", "name": "Latte", "brand_id": "b1", "price": 30000, "deleted_at": None},
            {"id": "m-ame", "name": "Americano", "brand_id": "b1", "price": 25000, "deleted_at": None},
            {"id": "m-cake", "name": "Cheesecake", "brand_id": "b1", "price": 40000, "deleted_at": None},
            {"id": "m-tea", "name": "Teh Tarik", "brand_id": "b1", "price": 20000, "deleted_at": None}])
        await mdb.recipes.insert_many([
            {"menu_item_id": "m-latte", "yield_qty": 1, "deleted_at": None,
             "lines": [{"item_id": "kopi", "qty": 18, "unit": "g"}, {"item_id": "susu", "qty": 200, "unit": "ml"}]},
            {"menu_item_id": "m-ame", "yield_qty": 1, "deleted_at": None, "lines": [{"item_id": "kopi", "qty": 18, "unit": "g"}]}])
        await mdb.goods_receipts.insert_one({"id": "g1", "status": "posted", "deleted_at": None, "receive_date": d(20),
                                             "lines": [{"item_id": "kopi", "unit_cost": 200_000, "qty_received": 5, "unit": "kg"},
                                                       {"item_id": "susu", "unit_cost": 20_000, "qty_received": 50, "unit": "l"}]})
        lines = [("m-latte", 100), ("m-ame", 50), ("m-cake", 4), ("m-tea", 2)]
        await mdb.sales_lines.insert_many([{"id": f"sl{i}", "outlet_id": "o1", "brand_id": "b1", "business_date": d(5), "menu_item_id": m,
                                            "qty": q, "amount": q * 30000, "void": False, "deleted_at": None} for i, (m, q) in enumerate(lines)])
        await mdb.inventory_movements.insert_many([
            {"id": "mv1", "outlet_id": "o1", "item_id": "kopi", "movement_type": "sale", "movement_date": d(5), "qty": -3.0, "unit_cost": 200_000, "deleted_at": None},
            {"id": "mv2", "outlet_id": "o1", "item_id": "susu", "movement_type": "sale", "movement_date": d(5), "qty": -20.0, "unit_cost": 20_000, "deleted_at": None},
            {"id": "mv3", "outlet_id": "o1", "item_id": "susu", "movement_type": "wastage", "movement_date": d(4), "qty": -2.0, "unit_cost": 20_000,
             "total_value": -40_000, "deleted_at": None},
            {"id": "mv4", "outlet_id": "o1", "item_id": "kopi", "movement_type": "purchase_receive", "movement_date": d(6), "qty": 5, "unit_cost": 200_000,
             "total_value": 1_000_000, "deleted_at": None}])
    asyncio.run(seed())
    return mdb


def test_inventory_agent(db, monkeypatch):
    from services.ai_domain import inventory as inv

    async def go():
        uv = await inv.usage_variance(USER, start=d(10), end=d(1))
        by = {r["item"]: r for r in uv["rows"]}
        # teoretis kopi = 150 × 18 g = 2,7 kg; aktual 3 kg → +11,1% lebih boros
        assert by["Kopi Arabica"]["teoretis"] == 2.7 and by["Kopi Arabica"]["aktual"] == 3.0 and by["Kopi Arabica"]["status"] == "lebih_boros"
        assert by["Kopi Arabica"]["nilai_selisih"] == 60_000
        # susu teoretis 100 × 0,2 l = 20 l; aktual 20 (sale) + 2 (waste) = 22 → +10%
        assert by["Susu"]["teoretis"] == 20 and by["Susu"]["aktual"] == 22
        assert uv["ringkasan"]["menu_tanpa_resep"] == 2 and "belum punya resep" in uv["catatan"]
        w = await inv.waste(USER, days=30)
        assert w["rows"][0]["item"] == "Susu" and w["rows"][0]["nilai"] == 40_000 and w["per_toko"][0]["persen_dari_pembelian"] == 4.0

        async def fake_matrix(**kw):
            return {"outlets": [{"id": "o1", "name": "Lounge"}, {"id": "o2", "name": "Bistro"}],
                    "rows": [{"item_id": "kopi", "item_name": "Kopi Arabica", "unit": "kg", "cells": [
                        {"outlet_id": "o1", "qty": 10, "par_level": 2, "last_unit_cost": 200_000},
                        {"outlet_id": "o2", "qty": 0.5, "par_level": 2, "last_unit_cost": 200_000}]}]}
        from services import inventory_matrix_service
        monkeypatch.setattr(inventory_matrix_service, "stock_balance_matrix", fake_matrix)
        ts = await inv.transfer_suggestions(USER)
        assert ts["rows"][0]["dari"] == "Lounge" and ts["rows"][0]["ke"] == "Bistro" and ts["rows"][0]["qty"] == 1.5
        assert ts["draf_transfer"][0]["lines"] == [{"item_id": "kopi", "qty": 1.5}]
    asyncio.run(go())


def test_menu_engineering_outlet_hr_personas(db):
    from services import menu_recipe_service as mrs
    from services.ai.agent import personas
    from services.ai.agent.runtime import _context_block
    from services.ai_domain import outlet_hr

    async def go():
        me = await mrs.menu_engineering("b1", start=d(10), end=d(1))
        k = {r["menu"]: r["kelas"] for r in me["rows"]}
        assert k["Latte"] in ("Star", "Plowhorse") and k["Americano"] in ("Star", "Plowhorse")
        assert k["Cheesecake"].startswith("Kurang laku") and me["ringkasan"]["menu"] == 4

        await db.daily_sales.insert_many(
            [{"id": f"w{k}", "outlet_id": "o1", "sales_date": (T - timedelta(days=1 + 7 * k)).isoformat(), "status": "validated",
              "grand_total": 10_000_000, "transaction_count": 100, "deleted_at": None} for k in range(1, 5)] +
            [{"id": "y", "outlet_id": "o1", "sales_date": d(1), "status": "validated", "grand_total": 7_000_000, "transaction_count": 80, "deleted_at": None}])
        await db.anomaly_events.insert_one({"id": "a1", "outlet_id": "o1", "status": "open", "deleted_at": None})
        br = await outlet_hr.outlet_briefing(USER)
        o1 = next(r for r in br["rows"] if r["outlet_id"] == "o1")
        o2 = next(r for r in br["rows"] if r["outlet_id"] == "o2")
        assert o1["perubahan_pct"] == -30.0 and any("anomali" in n for n in o1["perhatian"])
        assert "Daily Sales kemarin belum diinput" in o2["perhatian"]

        period = d(1)[:7]
        await db.payroll_cycles.insert_one({"id": "pc", "period": period, "outlet_id": "o1", "status": "posted", "deleted_at": None,
                                            "total_gross": 2_000_000, "total_bpjs_employer": 100_000, "employees": [{}, {}]})
        lc = await outlet_hr.labor_cost(USER, period=period)
        r = next(x for x in lc["rows"] if x["outlet_id"] == "o1")
        assert r["biaya_tenaga_kerja"] == 2_100_000 and r["karyawan"] == 2

        await db.employees.insert_many([{"id": f"e{i}", "outlet_id": "o2", "full_name": f"Staf {i}", "status": "active", "deleted_at": None} for i in range(3)])
        await db.leave_requests.insert_many([
            {"id": f"l{i}", "doc_no": f"LV-{i}", "employee_id": f"e{i}", "outlet_id": "o2", "status": "approved" if i else "pending",
             "start_date": (T + timedelta(days=2)).isoformat(), "end_date": (T + timedelta(days=3)).isoformat(), "deleted_at": None} for i in range(2)])
        lv = await outlet_hr.leave_coverage(USER)
        assert lv["ringkasan"]["hari_kurang_orang"] == 2 and lv["ringkasan"]["cuti_menunggu"] == 1

        assert {p["id"] for p in personas.visible({"hr.read"})} == {"umum", "hr", "pemandu"}
        assert "Agen Inventory" in _context_block({"agent": "inventory"}, None, None)
        assert "Agen aktif" not in _context_block({"agent": "umum"}, None, None)
    asyncio.run(go())
