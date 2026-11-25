"""Menu & Resep: HPP per porsi dari harga beli (GR rata-rata 90 hari / penawaran), konversi satuan resep (g→kg, ml→l),
susut (waste), food cost %, versi resep, satuan yang tidak bisa dikonversi ditandai. Tanpa jaringan (mongomock)."""
import asyncio
from datetime import date, timedelta

import mongomock_motor
import pytest

from core import db as core_db

USER = {"id": "u1", "permissions": ["*"]}


def run(coro):
    return asyncio.run(coro)


@pytest.fixture()
def db(monkeypatch):
    mdb = mongomock_motor.AsyncMongoMockClient()["menu_test"]
    monkeypatch.setattr(core_db, "_db", mdb)
    recent = (date.today() - timedelta(days=10)).isoformat()

    async def seed():
        await mdb.items.insert_many([
            {"id": "beef", "name": "Daging Sapi", "unit_default": "kg", "deleted_at": None},
            {"id": "rice", "name": "Beras", "unit_default": "kg", "deleted_at": None},
            {"id": "milk", "name": "Susu", "unit_default": "liter", "deleted_at": None},
            {"id": "egg", "name": "Telur", "unit_default": "pcs", "deleted_at": None}])
        await mdb.goods_receipts.insert_many([
            {"id": "g1", "receive_date": recent, "deleted_at": None, "lines": [
                {"item_id": "beef", "unit": "kg", "unit_cost": 140000, "qty_received": 10},
                {"item_id": "rice", "unit": "kg", "unit_cost": 14000, "qty_received": 50}]},
            {"id": "g2", "receive_date": recent, "deleted_at": None, "lines": [
                {"item_id": "beef", "unit": "kg", "unit_cost": 160000, "qty_received": 10}]}])
        await mdb.supplier_prices.insert_one({"id": "o1", "item_id": "milk", "unit": "liter", "price": 20000, "deleted_at": None,
                                              "valid_from": "2026-01-01"})
        await mdb.menu_items.insert_one({"id": "m1", "brand_id": "b1", "name": "Nasi Daging Lada Hitam", "name_norm": "nasi daging lada hitam",
                                         "price": 55000, "deleted_at": None, "aliases": []})
    run(seed())
    return mdb


def test_recipe_costing_and_versions(db):
    from services import menu_recipe_service as svc

    async def go():
        r = await svc.save_recipe("m1", {"yield_qty": 1, "price": 55000, "lines": [
            {"item_id": "beef", "qty": 120, "unit": "g", "waste_pct": 10},      # 0,12 kg × 150.000 (rata-rata) × 1,1
            {"item_id": "rice", "qty": 200, "unit": "g"},                       # 0,2 kg × 14.000
            {"item_id": "milk", "qty": 30, "unit": "ml"}]}, user=USER)          # 0,03 l × 20.000 (penawaran)
        c = r["costing"]
        assert c["hpp_per_porsi"] == round(0.12 * 150000 * 1.1 + 0.2 * 14000 + 0.03 * 20000, 2) == 23200
        assert c["food_cost_pct"] == 42.2 and c["lengkap"] and "42.2%" in c["peringatan"]
        sim = await svc.cost_recipe([{"item_id": "egg", "qty": 2, "unit": "pcs"}, {"item_id": "beef", "qty": 1, "unit": "butir"}], 1, 10000)
        assert not sim["lengkap"] and len(sim["masalah"]) == 2                 # tanpa harga & satuan tak terkonversi
        r2 = await svc.save_recipe("m1", {"yield_qty": 2, "lines": [{"item_id": "beef", "qty": 0.5, "unit": "kg"}]}, user=USER)
        assert r2["recipe"]["version"] == 2 and r2["costing"]["hpp_per_porsi"] == 37500
        assert await db.recipe_versions.count_documents({}) == 1
        ov = await svc.costing_overview("b1")
        assert ov["rows"][0]["food_cost_pct"] == round(37500 / 55000 * 100, 1) and ov["ringkasan"]["di_atas_batas"] == 1
        with pytest.raises(Exception):
            await svc.save_recipe("m1", {"lines": [{"item_id": "beef", "qty": 0}]}, user=USER)
    run(go())
