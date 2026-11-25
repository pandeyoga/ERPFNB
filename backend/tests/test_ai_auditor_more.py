"""AI Auditor — pemeriksaan tambahan: rekening supplier berubah lalu dibayar, supplier baru dibayar besar, invoice/GR
tidak sesuai PO, selisih opname berulang, jurnal manual ke akun sensitif. Tanpa jaringan."""
import asyncio
from datetime import date, datetime, timedelta, timezone

import mongomock_motor
import pytest

from core import db as core_db

T = date.today()


def d(n):
    return (T - timedelta(days=n)).isoformat()


@pytest.fixture()
def db(monkeypatch):
    mdb = mongomock_motor.AsyncMongoMockClient()["auditor_more"]
    monkeypatch.setattr(core_db, "_db", mdb)
    from services import gl_mapping
    gl_mapping.invalidate_cache()
    return mdb


def test_new_checks(db):
    from services.ai_audit import auditor

    async def go():
        await db.system_settings.insert_one({"key": "gl_mapping", "value": {"cash_on_hand": "c-kas", "inventory": {"o1": "c-inv"}}})
        await db.vendors.insert_many([
            {"id": "v1", "name": "CV Lama", "created_at": "2025-01-01T00:00:00+00:00", "deleted_at": None},
            {"id": "v2", "name": "PT Baru Sekali", "created_at": f"{d(20)}T03:00:00+00:00", "deleted_at": None}])
        await db.audit_log.insert_one({"entity_type": "vendors", "entity_id": "v1", "action": "update", "user_id": "u9",
                                       "before": {"bank_account_number": "111"}, "after": {"bank_account_number": "999"},
                                       "timestamp": f"{d(10)}T02:00:00+00:00"})
        await db.ap_ledgers.insert_many([
            {"id": "ap1", "vendor_id": "v1", "deleted_at": None, "payments": [{"date": d(5), "amount": 7_500_000, "ref": "TRF-1"}]},
            {"id": "ap2", "vendor_id": "v2", "deleted_at": None, "payments": [{"date": d(15), "amount": 12_000_000}]}])
        await db.purchase_orders.insert_one({"id": "po1", "doc_no": "PO-1", "vendor_id": "v1", "status": "received", "grand_total": 100_000,
                                             "deleted_at": None, "lines": [{"item_id": "i1", "item_name": "Ayam", "qty": 10, "unit_cost": 10_000}]})
        await db.goods_receipts.insert_one({"id": "gr1", "doc_no": "GR-1", "po_id": "po1", "vendor_id": "v1", "receive_date": d(4), "grand_total": 125_000,
                                            "deleted_at": None, "lines": [{"item_id": "i1", "item_name": "Ayam", "qty_received": 10, "unit_cost": 12_500}]})
        await db.opname_sessions.insert_many([
            {"id": f"op{i}", "doc_no": f"OP-{i}", "outlet_id": "o1", "status": "approved", "opname_date": d(30 * i + 1), "deleted_at": None,
             "lines": [{"item_id": "i1", "item_name": "Ayam", "variance": -2, "variance_value": -120_000}]} for i in range(3)])
        await db.journal_entries.insert_many([
            {"id": "j1", "doc_no": "JE-1", "status": "posted", "deleted_at": None, "entry_date": d(3), "source_type": "manual",
             "description": "koreksi kas", "lines": [{"coa_id": "c-kas", "dr": 0, "cr": 60_000_000}, {"coa_id": "c-x", "dr": 60_000_000, "cr": 0}]},
            {"id": "j2", "doc_no": "JE-2", "status": "posted", "deleted_at": None, "entry_date": d(3), "source_type": "manual",
             "reference": {"source": "ocr"}, "lines": [{"coa_id": "c-kas", "dr": 0, "cr": 50_000}, {"coa_id": "c-x", "dr": 50_000, "cr": 0}]}])
        res = await auditor.run(days=60, only=["vendor_risk", "invoice_mismatch", "opname_recurring", "sensitive_journals"])
        assert not res["errors"], res["errors"]
        ev = {e["type"]: e async for e in db.anomaly_events.find({})}
        assert ev["vendor_bank_changed"]["severity"] == "severe" and "999" not in ev["vendor_bank_changed"]["title"]
        assert ev["new_vendor_large_payment"]["vendor_id"] == "v2"
        assert "harga GR" in ev["invoice_mismatch"]["description"]
        assert ev["opname_recurring_loss"]["severity"] == "severe" and ev["opname_recurring_loss"]["amount"] == 360_000
        assert ev["sensitive_account_journal"]["details"]["journals"] == ["j1"] and ev["sensitive_account_journal"]["severity"] == "severe"
        assert await db.anomaly_events.count_documents({"type": "sensitive_account_journal"}) == 1        # OCR = sumber tepercaya
        again = await auditor.run(days=60, only=["vendor_risk"])
        assert again["temuan"] == 2 and await db.anomaly_events.count_documents({"type": "vendor_bank_changed"}) == 1   # tanpa dobel
    asyncio.run(go())
