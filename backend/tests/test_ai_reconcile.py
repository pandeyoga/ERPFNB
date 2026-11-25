"""Rekonsiliasi lanjutan & accrual (AI Finance): statement vendor vs hutang, 3-way match, stok vs GL, kas kecil,
transfer antar toko, settlement EDC/QRIS vs POS, ekspor PDF/Excel, usulan accrual tutup buku. Tanpa jaringan."""
import asyncio
from datetime import date, timedelta

import mongomock_motor
import pytest

from core import db as core_db

USER = {"id": "u-fin", "permissions": ["*"], "outlet_ids": ["*"]}
T = date.today()


def d(n):
    return (T - timedelta(days=n)).isoformat()


def run(c):
    return asyncio.run(c)


@pytest.fixture()
def db(monkeypatch):
    mdb = mongomock_motor.AsyncMongoMockClient()["recon_more"]
    monkeypatch.setattr(core_db, "_db", mdb)
    from services import gl_mapping
    gl_mapping.invalidate_cache()

    async def seed():
        coa = {"1101": ("cash_on_hand", "asset", "Kas"), "1105": ("petty_cash", "asset", "Kas Kecil"), "1301": ("inventory", "asset", "Persediaan"),
               "1302": ("inventory_in_transit", "asset", "Persediaan dalam perjalanan"), "2101": ("accounts_payable", "liability", "Hutang"),
               "2105": ("accrued_expenses", "liability", "Beban YMH Dibayar"), "1120": ("cards_receivable", "asset", "Piutang kartu"),
               "5201": (None, "expense", "Beban Listrik PLN"), "5202": (None, "expense", "Beban Promosi"),
               "6101": ("salary_expense", "expense", "Beban Gaji"), "2201": ("salary_payable", "liability", "Utang Gaji")}
        await mdb.chart_of_accounts.insert_many([{"id": f"c{k}", "code": k, "name": n, "type": t, "is_postable": True, "deleted_at": None}
                                                 for k, (_, t, n) in coa.items()])
        await mdb.system_settings.insert_one({"key": "gl_mapping", "value": {lg: f"c{k}" for k, (lg, _, _) in coa.items() if lg}})
        await mdb.outlets.insert_many([{"id": "o1", "name": "Lounge", "deleted_at": None}, {"id": "o2", "name": "Bistro", "deleted_at": None}])
        await mdb.vendors.insert_one({"id": "v1", "name": "CV Sayur", "deleted_at": None})
        await mdb.items.insert_one({"id": "i1", "name": "Bawang", "unit": "kg", "deleted_at": None})
    run(seed())
    return mdb


def test_vendor_statement_and_three_way(db):
    from services.ai_finance import reconcile as rc

    async def go():
        await db.purchase_orders.insert_many([
            {"id": "po1", "doc_no": "PO-1", "vendor_id": "v1", "outlet_id": "o1", "status": "received", "grand_total": 100_000, "deleted_at": None,
             "lines": [{"item_id": "i1", "item_name": "Bawang", "qty": 10, "unit_cost": 10_000}]},
            {"id": "po2", "doc_no": "PO-2", "vendor_id": "v1", "outlet_id": "o1", "status": "sent", "grand_total": 50_000, "deleted_at": None,
             "expected_delivery_date": d(10), "lines": []}])
        await db.goods_receipts.insert_one({"id": "gr1", "doc_no": "GR-1", "po_id": "po1", "vendor_id": "v1", "outlet_id": "o1",
                                            "receive_date": d(5), "grand_total": 132_000, "deleted_at": None,
                                            "lines": [{"item_id": "i1", "item_name": "Bawang", "qty_received": 12, "unit_cost": 11_000}]})
        await db.ap_ledgers.insert_many([
            {"id": "ap1", "vendor_id": "v1", "gr_id": "gr1", "invoice_no": "INV-001", "invoice_date": d(5), "amount": 132_000, "balance": 132_000,
             "status": "open", "deleted_at": None, "payments": []},
            {"id": "ap2", "vendor_id": "v1", "invoice_no": "INV-002", "invoice_date": d(20), "amount": 80_000, "balance": 0, "status": "paid",
             "deleted_at": None, "payments": [{"amount": 80_000, "date": d(10)}]},
            {"id": "ap3", "vendor_id": "v1", "invoice_no": "INV-009", "invoice_date": d(8), "amount": 45_000, "balance": 45_000, "status": "open",
             "deleted_at": None, "payments": []}])
        st = await rc.vendor_statement(USER, vendor_id="v1", closing_balance=230_000, rows=[
            {"tanggal": d(5), "no_dokumen": "INV 001", "jenis": "invoice", "nominal": 132_000},
            {"tanggal": d(20), "no_dokumen": "INV-002", "jenis": "invoice", "nominal": 85_000},
            {"tanggal": d(10), "no_dokumen": "TRF", "jenis": "payment", "nominal": 80_000},
            {"tanggal": d(3), "no_dokumen": "INV-010", "jenis": "invoice", "nominal": 98_000}])
        by = {(r["jenis"], r.get("no_statement") or r.get("no_buku")): r for r in st["rows"]}
        assert by[("invoice", "INV 001")]["status"] == "cocok"
        assert by[("invoice", "INV-002")]["status"] == "selisih_nominal" and by[("invoice", "INV-002")]["selisih"] == 5_000
        assert by[("pembayaran", "TRF")]["status"] == "cocok"
        assert by[("invoice", "INV-010")]["status"] == "hanya_statement"
        assert by[("invoice", "INV-009")]["status"] == "hanya_buku"
        assert st["ringkasan"]["saldo_buku"] == 177_000 and st["ringkasan"]["selisih_saldo"] == 53_000

        tw = await rc.three_way(USER, days=30)
        g = next(r for r in tw["rows"] if r["gr"] == "GR-1")
        assert g["status"] == "selisih" and "harga GR" in g["keterangan"] and "diterima 12" in g["keterangan"]
        late = next(r for r in tw["rows"] if r["po"] == "PO-2")
        assert late["status"] == "terlambat"
        data, fname, ct = rc.to_report(tw, "pdf")
        assert data[:4] == b"%PDF" and fname.endswith(".pdf")
        data, fname, _ = rc.to_report(st, "xlsx")
        assert data[:2] == b"PK"
    run(go())


def test_inventory_petty_transfers(db):
    from services.ai_finance import reconcile as rc

    async def go():
        await db.inventory_movements.insert_many([
            {"id": "m1", "item_id": "i1", "outlet_id": "o1", "qty": 10, "unit_cost": 10_000, "movement_date": d(5), "movement_type": "purchase_receive", "deleted_at": None},
            {"id": "m2", "item_id": "i1", "outlet_id": "o2", "qty": 5, "unit_cost": 10_000, "movement_date": d(5), "movement_type": "purchase_receive", "deleted_at": None},
            {"id": "m3", "item_id": "i1", "outlet_id": "o2", "qty": -1, "unit_cost": 10_000, "movement_date": d(2), "movement_type": "adjustment",
             "journal_entry_id": None, "deleted_at": None}])
        await db.journal_entries.insert_many([
            {"id": "j1", "status": "posted", "deleted_at": None, "entry_date": d(5), "period": d(5)[:7], "outlet_id": "o1",
             "lines": [{"coa_id": "c1301", "dr": 100_000, "cr": 0, "dim_outlet": "o1"}, {"coa_id": "c2101", "dr": 0, "cr": 100_000}]},
            {"id": "j2", "status": "posted", "deleted_at": None, "entry_date": d(5), "period": d(5)[:7], "outlet_id": "o2",
             "lines": [{"coa_id": "c1301", "dr": 50_000, "cr": 0, "dim_outlet": "o2"}, {"coa_id": "c2101", "dr": 0, "cr": 50_000}]},
            {"id": "j3", "status": "posted", "deleted_at": None, "entry_date": d(3), "period": d(3)[:7], "outlet_id": "o1",
             "lines": [{"coa_id": "c1105", "dr": 500_000, "cr": 0, "dim_outlet": "o1"}, {"coa_id": "c1101", "dr": 0, "cr": 500_000}]}])
        inv = await rc.inventory_vs_gl(USER)
        by = {r["toko"]: r for r in inv["rows"]}
        assert by["Lounge"]["status"] == "cocok" and by["Bistro"]["status"] == "selisih" and by["Bistro"]["selisih"] == -10_000
        assert inv["ringkasan"]["mutasi_penyesuaian_tanpa_jurnal"] == 1

        await db.petty_cash_transactions.insert_many([
            {"id": "p1", "doc_no": "PC-1", "outlet_id": "o1", "type": "replenish", "amount": 500_000, "status": "approved", "txn_date": d(3),
             "journal_entry_id": "j3", "deleted_at": None, "balance_after": 500_000},
            {"id": "p2", "doc_no": "PC-2", "outlet_id": "o1", "type": "purchase", "amount": 150_000, "status": "approved", "txn_date": d(2),
             "journal_entry_id": None, "receipt_url": None, "deleted_at": None, "balance_after": 350_000}])
        pc = await rc.petty_cash(USER)
        r = pc["rows"][0]
        assert r["status"] == "selisih" and r["selisih"] == -150_000 and "tanpa jurnal" in r["keterangan"] and "tanpa foto" in r["keterangan"]

        await db.transfers.insert_many([
            {"id": "t1", "doc_no": "TR-1", "from_outlet_id": "o1", "to_outlet_id": "o2", "status": "sent", "transfer_date": d(6), "total_value": 20_000,
             "deleted_at": None, "lines": [{"item_id": "i1", "qty": 2}]},
            {"id": "t2", "doc_no": "TR-2", "from_outlet_id": "o1", "to_outlet_id": "o2", "status": "received", "transfer_date": d(4), "total_value": 30_000,
             "deleted_at": None, "lines": [{"item_id": "i1", "item_name": "Bawang", "qty": 3, "qty_received": 2.5}]}])
        tr = await rc.transfers(USER)
        by = {r["transfer"]: r for r in tr["rows"]}
        assert "belum diterima" in by["TR-1"]["keterangan"] and "kirim 3, terima 2.5" in by["TR-2"]["keterangan"]
        inv = await rc.inventory_vs_gl(USER)
        assert inv["ringkasan"]["dalam_perjalanan_buku"] == 20_000
    run(go())


def test_non_cash_and_accruals(db):
    from services.ai_finance import close, reconcile as rc

    async def go():
        await db.payment_methods.insert_one({"id": "pm-q", "code": "QRIS", "type": "qris", "deleted_at": None})
        await db.daily_sales.insert_many([
            {"id": f"ds{i}", "outlet_id": "o1", "sales_date": d(i), "status": "validated", "deleted_at": None,
             "payment_breakdown": [{"payment_method_id": "pm-q", "amount": 1_000_000}]} for i in (3, 4, 5)])
        nc = await rc.non_cash(USER, rows=[{"tanggal": d(3), "kotor": 1_000_000, "mdr": 7_000, "bersih": 993_000},
                                           {"tanggal": d(5), "kotor": 950_000, "mdr": 40_000, "bersih": 910_000}])
        by = {r["tanggal"]: r for r in nc["rows"]}
        assert by[d(3)]["status"] == "cocok" and by[d(5)]["status"] == "selisih" and "MDR" in by[d(5)]["keterangan"]
        assert by[d(4)]["status"] == "hanya_pos" and nc["ringkasan"]["kotor"] == 1_950_000

        cur = T.strftime("%Y-%m")
        y, m = T.year, T.month
        prev = []
        for _ in range(3):
            m -= 1
            if not m:
                y, m = y - 1, 12
            prev.append(f"{y}-{m:02d}")
        jes = []
        for i, pp in enumerate(prev):
            jes.append({"id": f"e{i}", "status": "posted", "deleted_at": None, "period": pp, "entry_date": f"{pp}-25", "outlet_id": "o1",
                        "lines": [{"coa_id": "c5201", "dr": 2_000_000 + i * 50_000, "cr": 0, "dim_outlet": "o1"},
                                  {"coa_id": "c1101", "dr": 0, "cr": 2_000_000 + i * 50_000}]})
            jes.append({"id": f"s{i}", "status": "posted", "deleted_at": None, "period": pp, "entry_date": f"{pp}-28",
                        "lines": [{"coa_id": "c6101", "dr": 30_000_000, "cr": 0}, {"coa_id": "c2201", "dr": 0, "cr": 30_000_000}]})
        jes.append({"id": "promo", "status": "posted", "deleted_at": None, "period": prev[0], "entry_date": f"{prev[0]}-10",
                    "lines": [{"coa_id": "c5202", "dr": 900_000, "cr": 0}, {"coa_id": "c1101", "dr": 0, "cr": 900_000}]})
        await db.journal_entries.insert_many(jes)
        ac = await close.accrual_proposals(cur, USER)
        kinds = {(p["jenis"], p["akun"]) for p in ac["usulan"]}
        assert ("beban_rutin", "5201 Beban Listrik PLN") in kinds and ("gaji", "Beban gaji") in kinds
        assert not any("Promosi" in p["akun"] for p in ac["usulan"])              # tidak rutin
        listrik = next(p for p in ac["usulan"] if p["jenis"] == "beban_rutin")
        j, r = listrik["journal"], listrik["reversal"]
        assert j["lines"][0]["coa_id"] == "c5201" and j["lines"][1]["coa_id"] == "c2105" and j["lines"][0]["dr"] == listrik["nominal"]
        assert r["entry_date"].endswith("-01") and r["lines"][0]["coa_id"] == "c2105"
    run(go())
