"""Impor Cerdas: 13 format file (POS, delivery, bank, rekap manual), parser angka/tanggal Indonesia, commit ke Daily Sales
draf, cek duplikasi 4 lapis (file, transaksi, tanggal yang sudah ada, pesanan ganda POS vs aplikasi), rollback, dan
mutasi bank → sesi rekonsiliasi. Tanpa jaringan (mongomock + storage lokal sementara)."""
import asyncio

import mongomock_motor
import pytest

from tests import smart_import_samples as smp
from core import db as core_db
from services.smart_import import engine, parsing, service

SUPER = {"id": "u-super", "email": "s@x", "full_name": "Super", "role_ids": ["r-super"], "permissions": ["*"], "outlet_ids": ["*"]}


def run(coro):
    return asyncio.run(coro)


@pytest.mark.parametrize("sample", smp.ALL, ids=lambda f: f.__name__)
def test_every_sample_format_is_read_correctly(sample):
    name, data, exp = sample()
    prof = engine.profile(data, name)
    assert prof["target"] == exp["target"]
    ex = engine.extract(prof)
    if exp["target"] == "bank":
        s = engine.summarize_bank(ex["rows"])
        assert s["baris"] == exp["rows"] and abs((s["masuk"] - s["keluar"]) - exp["net"]) < 1
    else:
        s = engine.summarize_sales(ex["transactions"])
        assert s["transaksi"] + s["void"] == exp.get("receipts", exp["rows"])
        if "total" in exp:
            assert abs(s["total"] - exp["total"]) < 1
        if "void" in exp:
            assert s["void"] == exp["void"]
        if exp.get("source"):
            assert prof["source"] == exp["source"] and set(s["channel"]) == {exp["source"]}


def test_indonesian_number_and_date_parsing():
    n = parsing.parse_number
    assert n("Rp 1.234.567") == 1234567 and n("1.234.567,50") == 1234567.5 and n("1,234,567.50") == 1234567.5
    assert n("(1.000)") == -1000 and n("Rp. 45.000,-") == 45000 and n("2,5 juta") == 2500000 and n("1.500.000,00 CR") == 1500000
    assert n("abc") is None and n("-") is None
    d = parsing.parse_date
    assert str(d("Selasa, 25 November 2026")) == "2026-11-25" and str(d("'01/11", year_hint=2026)) == "2026-11-01"
    assert str(d("11/25/2026", "MDY")) == "2026-11-25" and str(d(46351)) == "2026-11-25" and d("31/02/2026") is None
    assert parsing.parse_time("7:30 PM") == "19:30:00" and parsing.infer_date_order(["11/25/2026", "12/31/2026"]) == "MDY"


@pytest.fixture()
def db(monkeypatch, tmp_path):
    mdb = mongomock_motor.AsyncMongoMockClient()["smart_import_test"]
    monkeypatch.setattr(core_db, "_db", mdb)
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path))
    monkeypatch.setenv("STORAGE_BACKEND", "local")
    from core import runtime_config
    runtime_config.invalidate()

    async def seed():
        await mdb.roles.insert_one({"id": "r-super", "permissions": ["*"]})
        await mdb.outlets.insert_many([
            {"id": "o-lounge", "name": "The Lounge", "code": "LNG", "brand_id": "b1", "deleted_at": None},
            {"id": "o-bistro", "name": "The Bistro", "code": "BST", "brand_id": "b1", "deleted_at": None},
            {"id": "o-bakery", "name": "The Bakery", "code": "BKR", "brand_id": "b2", "deleted_at": None}])
        await mdb.payment_methods.insert_many([
            {"id": "pm-cash", "code": "CASH", "name": "Tunai", "type": "cash", "deleted_at": None},
            {"id": "pm-qris", "code": "QRIS", "name": "QRIS", "type": "qris", "deleted_at": None},
            {"id": "pm-card", "code": "CARD", "name": "Debit/Kredit", "type": "card", "deleted_at": None},
            {"id": "pm-bca", "code": "BCA-TRF", "name": "Transfer BCA", "type": "transfer", "deleted_at": None}])
        await mdb.bank_accounts.insert_one({"id": "ba-1", "bank": "BCA", "account_number": "1234567890", "name": "Ops",
                                            "gl_account_id": None, "deleted_at": None})
    run(seed())
    return mdb


async def _attach(sample) -> str:
    from services import upload_service
    name, data, _ = sample() if callable(sample) else sample
    ct = "text/csv" if name.endswith((".csv", ".txt")) else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    att = await upload_service.save_upload(file_bytes=data, filename=name, content_type=ct, user=SUPER, category="import")
    return att["id"]


def _gofood_matching_moka():
    lines = ["ID Pesanan;Waktu Pesanan;Nama Outlet;Status;Harga Makanan;Promo Ditanggung Merchant;Komisi;Pendapatan Bersih",
             "F-0001;21 Nov 2026 11:05;The Lounge - Cihampelas;Selesai;95.000;0;19.000;76.000",
             "F-0002;21 Nov 2026 13:00;The Lounge - Cihampelas;Selesai;120.000;0;24.000;96.000"]
    return "gobiz_21nov.csv", "\n".join(lines).encode(), {}


def test_sales_import_dedupe_merge_and_rollback(db):
    async def go():
        moka_att = await _attach(smp.moka_transactions)
        b = await service.create_batch(SUPER, attachment_id=moka_att, use_ai=False)
        assert b["target"] == "sales" and not b["missing"]
        assert {d["verdict"] for d in b["days"]} == {"baru"} and len(b["days"]) == 2
        assert {v["raw"]: v["id"] for v in b["value_maps_resolved"]["payment"]} == {
            "Cash": "pm-cash", "Debit Card": "pm-card", "GoFood": "auto:GoFood", "QRIS": "pm-qris"}
        res = await service.commit(b["id"], SUPER)
        assert res["result"]["transactions"] == 4 and {d["status"] for d in res["result"]["days"]} == {"dibuat"}
        ds20 = await db.daily_sales.find_one({"outlet_id": "o-lounge", "sales_date": "2026-11-20"})
        assert ds20["grand_total"] == 173250 + 79200 + 462000 and ds20["transaction_count"] == 3 and ds20["import_managed"]

        # lapis 1 & 2: file yang sama → ditandai; dipaksa → semua transaksi duplikat, tidak ada yang bertambah
        b2 = await service.create_batch(SUPER, attachment_id=await _attach(smp.moka_transactions), use_ai=False)
        assert b2["duplicate_file_of"]
        with pytest.raises(Exception):
            await service.commit(b2["id"], SUPER)
        b2 = await service.update_batch(b2["id"], SUPER, options={"allow_duplicate_file": True})
        assert {d["verdict"] for d in b2["days"]} == {"kosong"}
        await service.commit(b2["id"], SUPER)
        assert await db.sales_transactions.count_documents({"deleted_at": None}) == 4

        # lapis 4: pesanan GoFood yang sudah tercatat di POS → kemungkinan ganda; pesanan baru → gabung ke hari itu
        g = await service.create_batch(SUPER, attachment_id=await _attach(_gofood_matching_moka), use_ai=False)
        dups = [t for t in g["preview"] if t["dup"]]
        assert len(dups) == 1 and "kemungkinan ganda" in dups[0]["dup"]
        day = next(d for d in g["days"] if d["date"] == "2026-11-21")
        assert day["verdict"] == "gabung" and day["transaksi"] == 1
        await service.commit(g["id"], SUPER)
        ds21 = await db.daily_sales.find_one({"outlet_id": "o-lounge", "sales_date": "2026-11-21", "deleted_at": None})
        assert ds21["grand_total"] == 104500 + 120000          # POS (dengan pajak) + GoFood baru (harga kotor)
        gofood_pm = await db.payment_methods.find_one({"code": "GOFOOD"})
        assert gofood_pm["type"] == "marketplace"                # dibuat otomatis → jurnal validasi seimbang
        pays = {p["payment_method_id"]: p["amount"] for p in ds21["payment_breakdown"]}
        assert pays[gofood_pm["id"]] == 104500 + 120000          # seluruh pesanan GoFood (POS & aplikasi) via platform

        # rollback GoFood → hari dihitung ulang dari transaksi POS saja; rollback POS → draf impor dihapus
        await service.rollback(g["id"], SUPER)
        ds21 = await db.daily_sales.find_one({"outlet_id": "o-lounge", "sales_date": "2026-11-21", "deleted_at": None})
        assert ds21["grand_total"] == 104500
        await service.rollback(b["id"], SUPER)
        assert await db.daily_sales.count_documents({"outlet_id": "o-lounge", "deleted_at": None}) == 0
        assert await db.sales_transactions.count_documents({"deleted_at": None}) == 0
        assert await db.import_recipes.count_documents({}) >= 1       # resep per sumber tersimpan
    run(go())


def test_manual_draft_conflict_replace_and_restore(db):
    async def go():
        from services import outlet_service
        await outlet_service.upsert_daily_sales_draft({
            "outlet_id": "o-bistro", "sales_date": "2026-11-01", "transaction_count": 1, "service_charge": 0, "tax_amount": 0,
            "channels": [{"channel": "Dine-in", "gross": 50000, "discount": 0, "net": 50000}],
            "revenue_buckets": [{"bucket": "food", "amount": 50000}],
            "payment_breakdown": [{"payment_method_id": "pm-cash", "amount": 50000}]}, user=SUPER)
        b = await service.create_batch(SUPER, attachment_id=await _attach(smp.majoo_detail), use_ai=False)
        d1 = next(d for d in b["days"] if d["date"] == "2026-11-01")
        assert d1["outlet_id"] == "o-bistro" and d1["verdict"] in ("ganti", "konflik")
        b = await service.update_batch(b["id"], SUPER, options={"day_actions": {"o-bistro|2026-11-01": "replace"}})
        res = await service.commit(b["id"], SUPER)
        ds = await db.daily_sales.find_one({"outlet_id": "o-bistro", "sales_date": "2026-11-01"})
        assert ds["grand_total"] == 144375 + 63360 and {p["payment_method_id"] for p in ds["payment_breakdown"]} == {"pm-cash", "pm-qris"}
        assert any(d.get("before") for d in res["result"]["days"])
        await service.rollback(b["id"], SUPER)
        ds = await db.daily_sales.find_one({"outlet_id": "o-bistro", "sales_date": "2026-11-01", "deleted_at": None})
        assert ds["grand_total"] == 50000                        # isi manual dikembalikan
    run(go())


def test_wide_recap_and_menu_items(db):
    async def go():
        b = await service.create_batch(SUPER, attachment_id=await _attach(smp.rekap_manual_wide), use_ai=False)
        await service.commit(b["id"], SUPER)
        ds = await db.daily_sales.find_one({"outlet_id": "o-bakery", "sales_date": "2026-11-02"})
        assert {c["channel"]: c["net"] for c in ds["channels"]} == {"Dine-in": 1200000, "Take-Away": 450000, "GoFood": 300000}
        assert {p["payment_method_id"]: p["amount"] for p in ds["payment_breakdown"]} == {"pm-cash": 900000, "pm-qris": 750000, "pm-card": 300000}
        assert ds["transaction_count"] == 85
        # file per item → master menu otomatis + bucket food/beverage
        b2 = await service.create_batch(SUPER, attachment_id=await _attach(smp.moka_items), use_ai=False,
                                        options={"outlet_id": "o-lounge"})
        r = await service.commit(b2["id"], SUPER)
        assert r["result"]["lines"] == 4 and r["result"]["menu_items_created"] == 4
        ds = await db.daily_sales.find_one({"outlet_id": "o-lounge", "sales_date": "2026-11-20"})
        buckets = {x["bucket"]: x["amount"] for x in ds["revenue_buckets"]}
        assert buckets["beverage"] == 30000 + 67500 and buckets["food"] == 90000 + 40000   # 00:35 → hari bisnis 20 Nov
    run(go())


def test_bank_statement_import_creates_recon_session_once(db):
    async def go():
        b = await service.create_batch(SUPER, attachment_id=await _attach(smp.klikbca), use_ai=False,
                                       options={"bank_account_id": "ba-1"})
        assert b["target"] == "bank" and b["summary"]["baris"] == 3
        r = await service.commit(b["id"], SUPER)
        s = await db.bank_recon_sessions.find_one({"id": r["result"]["session_id"]})
        assert len(s["rows"]) == 3 and s["total_inflow"] == 1500000 and s["total_outflow"] == 975500
        b2 = await service.create_batch(SUPER, attachment_id=await _attach(smp.klikbca), use_ai=False,
                                        options={"bank_account_id": "ba-1", "allow_duplicate_file": True})
        assert b2["duplicates"] == 3
        with pytest.raises(Exception):
            await service.commit(b2["id"], SUPER)
        # unggahan langsung di layar Rekonsiliasi Bank kini memakai parser yang sama (XLSX Mandiri, angka 1.500.000)
        from services._bank_recon.session import parse_statement_any
        name, data, _ = smp.mandiri()
        rows = parse_statement_any(data, name)
        assert [r["amount"] for r in rows] == [2350000.0, -12500.0]
    run(go())
