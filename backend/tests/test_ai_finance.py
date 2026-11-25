"""AI Finance: foto → jurnal (OCR di-mock, akun dipelajari, bukti ganda), jurnal manual menyimpan dimensi & bukti,
rekonsiliasi bank dengan AI (payout GoFood banyak-ke-satu, settlement QRIS − MDR, setoran tunai, biaya & bunga bank),
penerimaan QRIS/marketplace di jurnal Daily Sales, dan checklist tutup buku. Tanpa jaringan (mongomock)."""
import asyncio

import mongomock_motor
import pytest

from core import db as core_db

USER = {"id": "u-fin", "email": "f@x", "full_name": "Finance", "role_ids": ["r-super"], "permissions": ["*"], "outlet_ids": ["*"]}
COA = {  # code: (logical, type)
    "1101": ("cash_on_hand", "asset"), "1110": ("bank_default", "asset"), "1120": ("cards_receivable", "asset"),
    "1121": ("marketplace_receivable", "asset"), "1401": ("input_vat", "asset"), "2101": ("accounts_payable", "liability"),
    "4001": ("revenue_food", "revenue"), "4031": ("interest_income", "revenue"), "5303": (None, "expense"),
    "5430": ("card_processing_fee", "expense"), "5431": ("platform_commission", "expense"), "5432": ("bank_charges", "expense"),
}


def run(coro):
    return asyncio.run(coro)


def cid(code):
    return f"coa-{code}"


@pytest.fixture()
def db(monkeypatch, tmp_path):
    mdb = mongomock_motor.AsyncMongoMockClient()["ai_fin_test"]
    monkeypatch.setattr(core_db, "_db", mdb)
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path))
    from services import gl_mapping
    gl_mapping.invalidate_cache()

    async def seed():
        await mdb.roles.insert_one({"id": "r-super", "permissions": ["*"]})
        await mdb.chart_of_accounts.insert_many([{"id": cid(c), "code": c, "name": f"Akun {c}", "type": t, "is_postable": True,
                                                  "active": True, "deleted_at": None} for c, (_, t) in COA.items()])
        await mdb.system_settings.insert_one({"key": "gl_mapping", "value": {lg: cid(c) for c, (lg, _) in COA.items() if lg}})
        await mdb.number_series.insert_many([{"code": c, "prefix": c, "padding": 5, "reset": "monthly", "current_value": 0,
                                              "format": c + "-{YY}{MM}-{0000}", "active": True} for c in ("JE", "JER")])
        await mdb.outlets.insert_one({"id": "o1", "name": "The Lounge", "brand_id": "b1", "deleted_at": None})
        await mdb.payment_methods.insert_many([
            {"id": "pm-cash", "code": "CASH", "name": "Tunai", "type": "cash", "deleted_at": None},
            {"id": "pm-qris", "code": "QRIS", "name": "QRIS", "type": "qris", "deleted_at": None},
            {"id": "pm-gofood", "code": "GOFOOD", "name": "GoFood", "type": "marketplace", "deleted_at": None}])
        await mdb.bank_accounts.insert_one({"id": "ba1", "bank": "BCA", "account_number": "123", "name": "Ops",
                                            "gl_account_id": cid("1110"), "deleted_at": None})
        await mdb.daily_sales.insert_many([
            {"id": "ds1", "outlet_id": "o1", "sales_date": "2026-11-10", "status": "validated", "deleted_at": None,
             "payment_breakdown": [{"payment_method_id": "pm-qris", "amount": 1_000_000}, {"payment_method_id": "pm-cash", "amount": 500_000},
                                   {"payment_method_id": "pm-gofood", "amount": 800_000}]},
            {"id": "ds2", "outlet_id": "o1", "sales_date": "2026-11-11", "status": "validated", "deleted_at": None,
             "payment_breakdown": [{"payment_method_id": "pm-gofood", "amount": 700_000}]}])
    run(seed())
    return mdb


def test_recon_ai_proposes_and_applies_adjustments(db):
    from services.ai_finance import recon

    async def go():
        rows = [("r1", "2026-11-12", 1_200_000, "TRSF E-BANKING CR GOTO DOMPET ANAK BANGSA 8812"),
                ("r2", "2026-11-11", 985_000, "QRIS SETTLEMENT MERCHANT 0091"),
                ("r3", "2026-11-11", 500_000, "SETORAN TUNAI CABANG"),
                ("r4", "2026-11-30", -6_500, "BIAYA ADM BULANAN"),
                ("r5", "2026-11-30", 12_000, "BUNGA JASA GIRO"),
                ("r6", "2026-11-15", -250_000, "TRF KE BUDI SANTOSO")]
        await db.bank_recon_sessions.insert_one({"id": "s1", "bank_account_id": "ba1", "status": "pending", "deleted_at": None,
                                                 "start_date": "2026-11-11", "end_date": "2026-11-30",
                                                 "rows": [{"id": i, "date": d, "amount": a, "description": t, "matched": False}
                                                          for i, d, a, t in rows]})
        res = await recon.analyze("s1", USER, use_ai=False)
        by = {r["row_id"]: r for r in res["rows"]}
        assert by["r1"]["status"] == "usulan" and by["r1"]["kind"] == "payout" and by["r1"]["window"] == ["2026-11-11", "2026-11-10"]
        commission = next(ln for ln in by["r1"]["lines"] if ln["coa_id"] == cid("5431"))
        assert commission["dr"] == 300_000                                  # 1,5 jt piutang − 1,2 jt payout
        mdr = next(ln for ln in by["r2"]["lines"] if ln["coa_id"] == cid("5430"))
        assert mdr["dr"] == 15_000 and by["r3"]["outlet_id"] == "o1"
        assert by["r4"]["kind"] == "bank_fee" and by["r5"]["kind"] == "interest" and by["r6"]["status"] == "belum"
        assert res["ringkasan"]["persen_tertangani"] > 80
        out = await recon.apply("s1", USER, row_ids=["r1", "r2", "r3", "r4", "r5", "r6"])
        assert len(out["posted"]) == 5 and out["failed"][0]["row_id"] == "r6"
        s = await db.bank_recon_sessions.find_one({"id": "s1"})
        assert sum(1 for r in s["rows"] if r.get("matched")) == 5
        jes = await db.journal_entries.find({}).to_list(10)
        assert all(abs(j["total_dr"] - j["total_cr"]) < 0.01 for j in jes) and len(jes) == 5
        assert {ln["coa_id"] for j in jes for ln in j["lines"]} >= {cid("1121"), cid("1120"), cid("1101"), cid("5432"), cid("4031")}
    run(go())


def test_receipt_to_journal_learns_and_blocks_duplicates(db, monkeypatch):
    from services import ai_service, finance_service
    from services.ai_finance import receipts

    async def fake_ocr(att, user):
        return {"vendor_name": "SPBU Pertamina 34.401", "receipt_no": "A-77", "receipt_date": "24/11/2026", "total": 222_000,
                "tax": 0, "items": [{"name": "Pertalite"}], "confidence_overall": 0.95}, "hash-1"

    async def fake_cat(desc, amount=0, outlet_id=None):
        return {"gl_id": cid("5303"), "source": "llm", "reason": "BBM"}
    monkeypatch.setattr(receipts, "_ocr", fake_ocr)
    monkeypatch.setattr(ai_service, "categorize_expense", fake_cat)

    async def go():
        r = await receipts.analyze(USER, ["att-1", "att-2"], payment="cash", outlet_id="o1")
        a, b = r["items"]
        assert a["status"] == "siap" and b["status"] == "duplikat" and "lampiran #1" in b["duplikat"]
        j = a["journal"]
        assert j["lines"][0]["coa_id"] == cid("5303") and j["lines"][-1]["coa_id"] == cid("1101") and j["entry_date"] == "2026-11-24"
        await db.attachments.insert_one({"id": "att-1", "uploaded_by": "u-fin", "deleted_at": None, "filename": "s.jpg"})
        je = await finance_service.post_manual_journal(j, user=USER)
        assert je["lines"][0]["dim_outlet"] == "o1" and je["lines"][0]["dim_brand"] == "b1"      # dimensi tidak hilang
        assert (await db.attachments.find_one({"id": "att-1"}))["source_id"] == je["id"]           # bukti terlampir
        rule = await db.categorization_rules.find_one({"gl_account_id": cid("5303")})
        assert rule and "pertamina" in rule["pattern"]                                             # vendor dipelajari
        again = await receipts.analyze(USER, ["att-9"], payment="cash", outlet_id="o1")
        assert again["items"][0]["status"] == "duplikat" and je["doc_no"] in again["items"][0]["duplikat"]
        with pytest.raises(Exception):
            await finance_service.post_manual_journal(j, user=USER)                                 # bukti sama ditolak
    run(go())


def test_sales_receipt_targets_and_close_checklist(db):
    from services._journal._common import resolve_receipt_target
    from services.ai_finance import close

    async def go():
        pms = {p["id"]: p async for p in db.payment_methods.find({})}
        assert await resolve_receipt_target(pms["pm-qris"], "o1") == cid("1120")       # QRIS bukan kas di tangan
        assert await resolve_receipt_target(pms["pm-gofood"], "o1") == cid("1121")     # GoFood → piutang marketplace
        assert await resolve_receipt_target(pms["pm-cash"], "o1") == cid("1101")
        await db.daily_sales.insert_one({"id": "ds3", "outlet_id": "o1", "sales_date": "2026-11-20", "status": "draft", "deleted_at": None})
        c = await close.checklist("2026-11", USER)
        ds = next(i for i in c["checklist"] if i["key"] == "daily_sales")
        assert ds["jumlah"] == 1 and ds["status"] == "kritis" and not c["siap_tutup"]
    run(go())
