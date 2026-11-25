"""AI Purchasing (normalisasi kemasan, analisis price list, restock) & AI Auditor (pemeriksaan pengendalian internal →
feed Anomali). Tanpa jaringan (mongomock; price list dikirim sebagai baris)."""
import asyncio

import mongomock_motor
import pytest

from core import db as core_db
from services.ai_purchasing.units import parse_pack, per_unit

SUPER = {"id": "u1", "permissions": ["*"], "outlet_ids": ["*"]}


def run(coro):
    return asyncio.run(coro)


def test_pack_normalization():
    assert parse_pack("Dus isi 12x1L") == (12.0, "l") and parse_pack("karton 24 x 250 ml") == (6.0, "l")
    assert parse_pack("tray 30 butir") == (30.0, "pcs") and parse_pack("@ 2,5 kg") == (2.5, "kg")
    assert parse_pack("500 gr") == (0.5, "kg") and parse_pack("1.000 gr") == (1.0, "kg")
    assert per_unit(180000, 12, "l", "liter") == 15000 and per_unit(65000, 0.5, "kg", "gram") == 130
    assert per_unit(58000, 30, "pcs", "kg") is None                 # beda satuan → tidak dibandingkan


@pytest.fixture()
def db(monkeypatch):
    mdb = mongomock_motor.AsyncMongoMockClient()["pur_test"]
    monkeypatch.setattr(core_db, "_db", mdb)

    async def seed():
        await mdb.vendors.insert_many([{"id": "v1", "name": "PT Lama", "deleted_at": None}, {"id": "v2", "name": "CV Murah", "deleted_at": None}])
        await mdb.items.insert_many([{"id": "i-milk", "name": "Susu UHT 1 Liter", "code": "M1", "unit_default": "liter", "deleted_at": None},
                                     {"id": "i-beef", "name": "Daging Sapi Has Dalam", "code": "B1", "unit_default": "kg", "deleted_at": None}])
        await mdb.goods_receipts.insert_one({"id": "gr1", "vendor_id": "v1", "outlet_id": "o1", "receive_date": "2026-11-01", "deleted_at": None,
                                             "status": "posted", "lines": [{"item_id": "i-milk", "unit": "liter", "unit_cost": 17000, "qty_received": 300},
                                                                           {"item_id": "i-beef", "unit": "kg", "unit_cost": 150000, "qty_received": 90}]})
        await mdb.supplier_prices.insert_one({"id": "of2", "vendor_id": "v2", "item_id": "i-beef", "unit": "kg", "unit_norm": "kg",
                                              "price": 140000, "valid_from": "2026-01-01", "valid_to": None, "deleted_at": None})
    run(seed())
    return mdb


def test_pricelist_flags_increase_shrinkflation_and_cheaper_vendor(db):
    from services.ai_purchasing import pricelist

    async def go():
        a = await pricelist.analyze(SUPER, vendor_id="v1", rows=[
            {"name": "SUSU UHT 1 LTR", "pack": "dus isi 12x1L", "price": 228000},
            {"name": "Daging sapi has dalam", "code": "B1", "pack": "1 kg", "price": 165000},
            {"name": "Keju Mozarella", "pack": "2 kg", "price": 240000}])
        milk, beef, cheese = a["baris"]
        assert milk["harga_per_satuan"] == 19000 and milk["rekomendasi"] == "negosiasi" and "naik 11.8%" in milk["temuan"][0]
        assert milk["dampak_per_bulan"] == round((19000 - 17000) * 100)          # 300 L / 3 bulan
        assert beef["rekomendasi"] == "pertimbangkan pindah" and any("CV Murah" in t for t in beef["temuan"])
        assert cheese["status"] == "item_baru" and a["draf_pesan_negosiasi"].startswith("Selamat siang")
        assert beef["offer"]["price"] == 165000 and beef["offer"]["vendor_id"] == "v1"
        # price list berikutnya: isi dus turun 12 → 10 dengan harga sama → kemasan mengecil
        b = await pricelist.analyze(SUPER, vendor_id="v1", rows=[{"name": "Susu UHT 1 Liter", "pack": "dus isi 10x1L", "price": 228000}])
        assert any("isi kemasan mengecil" in t for t in b["baris"][0]["temuan"])
    run(go())


def test_auditor_findings_go_to_anomaly_feed_once(db):
    from services.ai_audit import auditor

    async def go():
        await db.ap_ledgers.insert_many([
            {"id": "ap1", "vendor_id": "v1", "invoice_no": "INV-001", "amount": 5_000_000, "invoice_date": "2026-11-10", "deleted_at": None},
            {"id": "ap2", "vendor_id": "v1", "invoice_no": "inv 001", "amount": 5_000_000, "invoice_date": "2026-11-12", "deleted_at": None}])
        await db.purchase_orders.insert_many([
            {"id": f"po{i}", "doc_no": f"PO-{i}", "vendor_id": "v1", "outlet_id": "o1", "order_date": f"2026-11-1{i}", "grand_total": 4_000_000,
             "status": "approved", "deleted_at": None, "created_by": "u7", "approved_by": "u7" if i == 1 else "u8", "lines": []} for i in (1, 2, 3)])
        await db.attachments.insert_many([
            {"id": "a1", "sha256": "h1", "source_type": "petty_cash", "source_id": "pc1", "deleted_at": None},
            {"id": "a2", "sha256": "h1", "source_type": "journal_entry", "source_id": "je1", "deleted_at": None}])
        await db.journal_entries.insert_one({"id": "je9", "doc_no": "JE-9", "source_type": "manual", "entry_date": "2026-11-15",
                                             "created_at": "2026-11-15T17:30:00+00:00", "total_dr": 25_000_000, "deleted_at": None})
        r = await auditor.run(days=3650)
        types = {e["type"] async for e in db.anomaly_events.find({})}
        assert {"duplicate_invoice", "split_purchase", "maker_checker", "duplicate_evidence", "journal_off_hours", "round_journal"} <= types
        n = await db.anomaly_events.count_documents({})
        await auditor.run(days=3650)
        assert await db.anomaly_events.count_documents({}) == n and r["temuan"] == n          # diulang tanpa duplikat
    run(go())
