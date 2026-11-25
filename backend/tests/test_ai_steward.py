"""AI Data Steward: deteksi item/supplier ganda (nama dinormalisasi, NPWP/rekening sama), pemakaian per record,
nonaktifkan duplikat yang belum dipakai, tolak bila sudah dipakai, cek nama mirip & kelengkapan. Tanpa jaringan."""
import asyncio

import mongomock_motor
import pytest

from core import db as core_db

USER = {"id": "u1", "permissions": ["*"]}


@pytest.fixture()
def db(monkeypatch):
    mdb = mongomock_motor.AsyncMongoMockClient()["steward_test"]
    monkeypatch.setattr(core_db, "_db", mdb)

    async def seed():
        await mdb.items.insert_many([
            {"id": "i1", "name": "Bawang Putih", "unit_default": "kg", "category_id": "c1", "deleted_at": None},
            {"id": "i2", "name": "bawang putih 1 kg", "unit_default": "kg", "deleted_at": None},
            {"id": "i3", "name": "Bawang Merah", "unit_default": "kg", "category_id": "c1", "deleted_at": None},
            {"id": "i4", "name": "Bawang Putih", "unit_default": "pcs", "category_id": "c1", "deleted_at": None},   # beda dimensi
            {"id": "i5", "name": "Susu UHT Full Cream", "unit_default": "liter", "category_id": "c2", "deleted_at": None},
            {"id": "i6", "name": "Susu UHT FullCream", "unit_default": "l", "category_id": "c2", "deleted_at": None}])
        await mdb.vendors.insert_many([
            {"id": "v1", "name": "PT Sumber Segar", "npwp": "01.234.567.8-901.000", "deleted_at": None},
            {"id": "v2", "name": "Sumber Segar", "deleted_at": None},
            {"id": "v3", "name": "CV Maju Jaya", "npwp": "01.234.567.8-901.000", "phone": "0812", "deleted_at": None},
            {"id": "v4", "name": "Toko Berkah", "deleted_at": None}])
        await mdb.purchase_orders.insert_many([{"id": "po1", "vendor_id": "v1", "lines": [{"item_id": "i1"}], "deleted_at": None},
                                              {"id": "po2", "vendor_id": "v1", "lines": [{"item_id": "i1"}, {"item_id": "i6"}], "deleted_at": None}])
    asyncio.run(seed())
    return mdb


def test_duplicates_usage_and_deactivate(db):
    from services.ai_steward import duplicates as st

    async def go():
        it = await st.find_duplicates("items")
        groups = [{r["id"] for r in g["records"]} for g in it["kelompok"]]
        assert {"i1", "i2"} in groups and not any("i3" in g or "i4" in g for g in groups)
        assert any(g >= {"i5", "i6"} for g in groups)
        g1 = next(g for g in it["kelompok"] if g["pertahankan"] == "i1")
        assert g1["records"][0]["pemakaian"] == {"PO": 2} and g1["saran"][0] == {"id": "i2", "aksi": "nonaktifkan"}

        ve = await st.find_duplicates("vendors")
        vg = next(g for g in ve["kelompok"] if any(r["id"] == "v1" for r in g["records"]))
        assert {r["id"] for r in vg["records"]} == {"v1", "v2", "v3"} and "NPWP sama" in vg["alasan"]

        out = await st.deactivate("items", "i2", "i1", user=USER)
        assert out["nonaktif"] and (await db.items.find_one({"id": "i2"}))["active"] is False
        assert "bawang putih 1 kg" in (await db.items.find_one({"id": "i1"}))["aliases"]
        with pytest.raises(Exception):
            await st.deactivate("items", "i6", "i5", user=USER)            # i6 sudah dipakai PO
        assert (await st.find_duplicates("items"))["jumlah_kelompok"] == 1   # i2 sudah tidak aktif

        sim = await st.similar("vendors", "sumber segar abadi")
        assert sim and sim[0]["id"] in ("v1", "v2")
        comp = await st.completeness("vendors")
        assert comp["belum_lengkap"] == 4 and "telepon" in next(r for r in comp["rows"] if r["id"] == "v1")["kurang"]
    asyncio.run(go())
