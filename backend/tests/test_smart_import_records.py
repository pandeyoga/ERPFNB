"""Impor Cerdas — target data lain: master item/supplier/pelanggan, pembelian historis (riwayat), hasil opname, saldo awal
GL/hutang/piutang/stok, budget. Kolom dipetakan dari nama + isi (urutan & nama kolom bebas), referensi dicocokkan
dengan kemiripan, value_maps, pratinjau berstatus, commit & rollback. Tanpa jaringan (mongomock)."""
import asyncio

import mongomock_motor
import pytest

from core import db as core_db

SUPER = {"id": "u-super", "email": "s@x", "full_name": "Super", "role_ids": ["r-super"], "permissions": ["*"], "outlet_ids": ["*"]}


def run(c):
    return asyncio.run(c)


@pytest.fixture()
def db(monkeypatch, tmp_path):
    mdb = mongomock_motor.AsyncMongoMockClient()["si_records"]
    monkeypatch.setattr(core_db, "_db", mdb)
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path))
    monkeypatch.setenv("STORAGE_BACKEND", "local")
    from core import runtime_config
    from services import gl_mapping
    runtime_config.invalidate()
    gl_mapping.invalidate_cache()

    async def seed():
        await mdb.roles.insert_one({"id": "r-super", "permissions": ["*"]})
        await mdb.users.insert_one({**SUPER, "status": "active", "deleted_at": None})
        await mdb.outlets.insert_many([{"id": "o1", "name": "The Lounge", "brand_id": "b1", "deleted_at": None},
                                       {"id": "o2", "name": "The Bistro", "brand_id": "b1", "deleted_at": None}])
        await mdb.categories.insert_one({"id": "cat1", "name": "Bahan Baku Dapur", "deleted_at": None})
        await mdb.items.insert_many([{"id": "i1", "code": "ITM-001", "name": "Bawang Putih", "unit_default": "kg", "deleted_at": None},
                                     {"id": "i2", "code": "ITM-002", "name": "Susu Full Cream", "unit_default": "l", "deleted_at": None}])
        await mdb.vendors.insert_one({"id": "v1", "code": "V-1", "name": "CV Sumber Segar", "npwp": "01.234.567.8-901.000", "deleted_at": None})
        await mdb.ar_customers.insert_one({"id": "c1", "code": "C-1", "name": "PT Mitra Boga", "deleted_at": None})
        coa = [("1101", "Kas", "asset", "cash_on_hand"), ("1110", "Bank BCA", "asset", "bank_default"), ("1301", "Persediaan", "asset", "inventory"),
               ("2101", "Hutang Usaha", "liability", "accounts_payable"), ("1130", "Piutang Usaha", "asset", "ar_receivable"),
               ("3100", "Laba Ditahan", "equity", "retained_earnings"), ("3001", "Modal Disetor", "equity", None),
               ("5201", "Beban Listrik", "expense", None), ("5202", "Beban Promosi", "expense", None)]
        await mdb.chart_of_accounts.insert_many([{"id": f"c{c}", "code": c, "name": n, "type": t, "is_postable": True, "active": True,
                                                  "deleted_at": None} for c, n, t, _ in coa])
        await mdb.system_settings.insert_one({"key": "gl_mapping", "value": {lg: f"c{c}" for c, _, _, lg in coa if lg}})
        await mdb.number_series.insert_many([{"code": c, "prefix": c, "padding": 5, "reset": "monthly", "current_value": 0,
                                              "format": c + "-{YY}{MM}-{0000}", "active": True} for c in ("JE", "JER", "OPN")])
    run(seed())
    return mdb


async def _batch(name, text, target=None, **opts):
    from services import upload_service
    from services.smart_import import service
    att = await upload_service.save_upload(file_bytes=text.encode(), filename=name, content_type="text/csv", user=SUPER, category="import")
    b = await service.create_batch(SUPER, attachment_id=att["id"], target=target, use_ai=False)
    if opts:
        b = await service.update_batch(b["id"], SUPER, options=opts)
    return b


def test_master_items_vendors_customers(db):
    from services.smart_import import service

    async def go():
        b = await _batch("daftar_barang.csv", "Nama Barang;SKU;Satuan;Kategori;Harga Beli\n"
                                              "Bawang Putih Kupas;;Kilogram;Bahan Baku Dapur;38.000\n"
                                              "Bawang putih;ITM-001;kg;Bahan Baku Dapur;35.000\n"
                                              "Gula Aren Cair;GA-01;Liter;Bahan Bar;45.500\n"
                                              ";;;;\n", target="items")
        assert not b["missing"]
        st = {r["name"]: r["status"] for r in b["records_preview"]}
        assert st == {"Bawang Putih Kupas": "baru", "Bawang putih": "ubah", "Gula Aren Cair": "baru"}
        res = await service.commit(b["id"], SUPER)
        assert res["result"]["dibuat"] == 2 and res["result"]["diperbarui"] == 1
        ga = await db.items.find_one({"name": "Gula Aren Cair"})
        assert ga["unit_default"] == "l" and ga["std_cost"] == 45_500 and ga["category_id"] != "cat1"
        assert (await db.items.find_one({"id": "i1"}))["std_cost"] == 35_000
        rb = (await service.rollback(b["id"], SUPER))["rollback"]
        assert rb["items"] == 2 and (await db.items.find_one({"name": "Gula Aren Cair"}))["deleted_at"]

        v = await _batch("supplier.csv", "Nama Supplier,NPWP,No HP,Nomor Rekening,Bank,TOP\n"
                                         "Sumber Segar,01.234.567.8-901.000,0811222333,123456789,BCA,30\n"
                                         "UD Ayam Jaya,,0812999888,555666777,BRI,14\n")
        assert v["target"] == "vendors"
        assert {r["name"]: r["status"] for r in v["records_preview"]} == {"Sumber Segar": "ubah", "UD Ayam Jaya": "baru"}
        await service.commit(v["id"], SUPER)
        assert (await db.vendors.find_one({"name": "UD Ayam Jaya"}))["payment_terms_days"] == 14
        assert (await db.vendors.find_one({"id": "v1"}))["bank_account_number"] == "123456789"

        c = await _batch("pelanggan.csv", "Nama Pelanggan;Telepon;Limit Kredit;Termin\nPT Mitra Boga Nusantara;021555;50.000.000;30\nCV Catering Sejahtera;0812;10.000.000;14\n",
                         target="customers")
        sts = {r["name"]: r["status"] for r in c["records_preview"]}
        assert sts["CV Catering Sejahtera"] == "baru" and sts["PT Mitra Boga Nusantara"] in ("mirip", "ubah")
    run(go())


def test_purchases_opname_and_budget(db):
    from services.smart_import import service

    async def go():
        b = await _batch("pembelian_2025.csv", "Tgl Faktur;No Faktur;Supplier;Outlet;Nama Barang;Qty;Satuan;Harga Satuan;Total\n"
                                               "05/03/2025;F-881;Sumber Segar;The Lounge;Bawang Putih;10;kg;36.000;360.000\n"
                                               "05/03/2025;F-881;Sumber Segar;The Lounge;Susu Full Cream;24;liter;;480.000\n"
                                               "06/03/2025;F-902;Toko Baru;The Lounge;Minyak Goreng;5;l;20.000;100.000\n", target="purchases")
        rows = b["records_preview"]
        assert [r["status"] for r in rows] == ["siap", "siap", "galat"] and rows[1]["unit_cost"] == 20_000
        assert "vendor" in b["unresolved"] and "item" in b["unresolved"]
        res = await service.commit(b["id"], SUPER)
        assert res["result"]["baris_riwayat"] == 2 and res["result"]["dilewati"] == 1
        again = await _batch("pembelian_2025_v2.csv", "Tgl Faktur;No Faktur;Supplier;Outlet;Nama Barang;Qty;Satuan;Harga Satuan\n"
                                                      "05/03/2025;F881;CV Sumber Segar;The Lounge;Bawang Putih;10;kg;36.000\n", target="purchases")
        assert again["records_preview"][0]["status"] == "duplikat"

        op = await _batch("hitung_stok.csv", "Kode;Nama Item;Stok Fisik;Satuan\nITM-001;Bawang Putih;4,5;kg\n;Susu Full Cream;12;l\n",
                          target="opname", outlet_id="o2")
        assert all(r["status"] == "siap" for r in op["records_preview"])
        res = await service.commit(op["id"], SUPER)
        sess = await db.opname_sessions.find_one({"id": res["result"]["sesi_opname"][0]["id"]})
        counted = {ln["item_id"]: ln["counted_qty"] for ln in sess["lines"]}
        assert counted["i1"] == 4.5 and counted["i2"] == 12 and sess["outlet_id"] == "o2"

        bu = await _batch("anggaran_2027.csv", "Periode;Toko;Kode Akun;Nama Akun;Anggaran\n2027-01;The Lounge;5201;Beban Listrik;5.000.000\n"
                                               "2027-01;The Lounge;5202;Beban Promosi;2.500.000\n2027-02;The Lounge;5201;Beban Listrik;5.200.000\n",
                          target="budget")
        assert all(r["status"] == "siap" for r in bu["records_preview"]) and bu["summary"]["total"] == 12_700_000
        res = await service.commit(bu["id"], SUPER)
        assert res["result"]["budget_dibuat"] == 2
        jan = await db.budgets.find_one({"period": "2027-01", "deleted_at": None})
        assert len(jan["lines"]) == 2 and jan["outlet_id"] == "o1"
    run(go())


def test_opening_balances_gl_ap_ar_stock(db):
    from services.smart_import import service

    async def go():
        gl = await _batch("neraca_saldo.csv", "Kode Akun;Nama Akun;Debit;Kredit\n1101;Kas;10.000.000;\n1110;Bank BCA;40.000.000;\n"
                                              "3001;Modal Disetor;;45.000.000\n", target="opening_gl", opening_date="2026-10-31")
        assert gl["summary"]["selisih"] == 5_000_000 and any("tidak seimbang" in i["pesan"] for i in gl["issues"])
        res = await service.commit(gl["id"], SUPER)
        je = await db.journal_entries.find_one({"id": res["result"]["created"]["journal_entries"][0]})
        assert je["entry_date"] == "2026-10-31" and abs(je["total_dr"] - je["total_cr"]) < 0.01
        assert any(ln["coa_id"] == "c3100" and ln["cr"] == 5_000_000 for ln in je["lines"])

        ap = await _batch("hutang_awal.csv", "Supplier;No Invoice;Tgl Invoice;Jatuh Tempo;Sisa Hutang\nCV Sumber Segar;INV-77;2026-10-10;2026-11-09;7.500.000\n",
                          target="opening_ap", opening_date="2026-10-31")
        res = await service.commit(ap["id"], SUPER)
        led = await db.ap_ledgers.find_one({"invoice_no": "INV-77"})
        assert led["balance"] == 7_500_000 and led["status"] == "open" and led["opening"]
        assert (await _batch("hutang_awal2.csv", "Supplier;No Invoice;Sisa Hutang\nCV Sumber Segar;INV-77;7.500.000\n", target="opening_ap"))["records_preview"][0]["status"] == "duplikat"

        ar = await _batch("piutang_awal.csv", "Pelanggan;No Invoice;Tanggal;Sisa Piutang\nPT Mitra Boga;AR-9;2026-10-01;3.000.000\n", target="opening_ar")
        await service.commit(ar["id"], SUPER)
        inv = await db.ar_invoices.find_one({"invoice_no": "AR-9"})
        assert inv["outstanding"] == 3_000_000 and inv["customer_id"] == "c1"

        stk = await _batch("stok_awal.csv", "Outlet;Kode;Nama Barang;Qty;Satuan;Harga Pokok\nThe Bistro;ITM-001;Bawang Putih;8;kg;35.000\n", target="opening_stock")
        res = await service.commit(stk["id"], SUPER)
        mv = await db.inventory_movements.find_one({"movement_type": "opening", "item_id": "i1"})
        assert mv["qty"] == 8 and mv["total_value"] == 280_000 and mv["outlet_id"] == "o2"
        rb = (await service.rollback(stk["id"], SUPER))["rollback"]
        assert rb["mutasi_stok"] == 1 and rb["jurnal_dibalik"] == 1
    run(go())
