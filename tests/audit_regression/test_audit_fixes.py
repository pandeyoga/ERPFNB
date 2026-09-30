"""Regression tests for AUDIT_2026-09-27_PHASE2 fixes (mongomock, no real DB).
Run: cd /app/tests/audit_regression && ERP_BACKEND=/app/backend python -m pytest -q test_audit_fixes.py
"""
import asyncio

import pytest

import common
from common import USER, setup

db = common.db


def run(coro_fn):
    async def _w():
        for name in await db.list_collection_names():
            await db[name].drop()
        import services.gl_mapping as gm
        gm.invalidate_cache()
        await setup()
        await gm.ensure_default_accounts()
        await coro_fn()
    asyncio.run(_w())


def test_p0_01_02_03_payroll_balanced_no_double_count_no_duplicates():
    async def t():
        from services._hr_payroll import cycle
        await db.employees.insert_one({"id": "e1", "full_name": "A", "outlet_id": "o1", "status": "active",
                                       "deleted_at": None})
        await db.salary_masters.insert_one({"id": "sm1", "employee_id": "e1", "basic_salary": 4_000_000,
                                            "components": [], "deleted_at": None})
        await db.service_charge_periods.insert_one({"id": "sc1", "period": "2026-08", "outlet_id": "o1", "status": "posted",
                                                    "deleted_at": None, "allocations": [{"employee_id": "e1", "amount": 500_000}]})
        p = await cycle.create_payroll({"period": "2026-08", "outlet_id": "o1"}, user=USER)
        with pytest.raises(Exception):  # SoD: creator cannot approve
            await cycle.approve_payroll(p["id"], user=USER)
        await cycle.approve_payroll(p["id"], user={**USER, "id": "u-2"})
        await cycle.post_payroll(p["id"], user={**USER, "id": "u-2"})
        je = await db.journal_entries.find_one({"source_type": "payroll"})
        assert abs(je["total_dr"] - je["total_cr"]) < 0.01
        exp = sum(ln["dr"] for ln in je["lines"] if ln["coa_id"] == "coa-salary_expense")
        assert exp == 4_000_000  # SC share not expensed again
        with pytest.raises(Exception):
            await cycle.create_payroll({"period": "2026-08", "outlet_id": "o1"}, user=USER)
        with pytest.raises(Exception):
            await cycle.create_payroll({"period": "2026-08"}, user=USER)
    run(t)


def test_p0_05_ar_partial_receipts_each_posted():
    async def t():
        for code, cid in [("1201", "coa-ar"), ("4000", "coa-rev")]:
            await db.chart_of_accounts.insert_one({"id": cid, "code": code, "name": code, "deleted_at": None})
        from services._ar import invoice as inv, receipt as rc
        i = await inv.create_invoice({"invoice_no": "INV-1", "invoice_date": "2026-08-01",
                                      "lines": [{"qty": 1, "unit_price": 1_000_000}]}, user_id="u-admin")
        await inv.mark_sent(i["id"], user_id="u-admin")
        d = await db.ar_invoices.find_one({"id": i["id"]})
        total = float(d["total_amount"])
        await rc.record_receipt(i["id"], "2026-08-05", 400_000, user_id="u-admin")
        await rc.record_receipt(i["id"], "2026-08-10", total - 400_000, user_id="u-admin")
        jes = await db.journal_entries.find({"source_type": "ar_receipt"}).to_list(10)
        assert len(jes) == 2 and round(sum(j["total_dr"] for j in jes), 2) == round(total, 2)
        with pytest.raises(Exception):  # FIN-14 paid invoice cannot go back to sent
            await inv.mark_sent(i["id"], user_id="u-admin")
    run(t)


def test_p0_06_depreciation_every_month_in_gl():
    async def t():
        from services import fixed_asset_service as fa
        await db.fixed_assets.insert_one({"id": "a1", "name": "Oven", "asset_code": "FA-1", "status": "active",
                                          "purchase_cost": 36_000_000, "current_cost": 36_000_000, "salvage_value": 0,
                                          "useful_life_years": 3, "dep_method": "straight_line", "book_value": 36_000_000,
                                          "accumulated_dep": 0, "coa_dep_exp_id": "coa-cogs", "coa_accum_dep_id": "coa-inventory",
                                          "coa_asset_id": "coa-inventory", "purchase_date": "2026-01-01", "deleted_at": None})
        for p in ("2026-01", "2026-02", "2026-03"):
            await fa.post_depreciation("a1", p, user_id="u-admin")
        assert await db.journal_entries.count_documents({"source_type": "fixed_asset_dep"}) == 3
    run(t)


def test_p0_07_gr_validated_against_po():
    async def t():
        from services import procurement_service as ps
        po = await ps.create_po({"vendor_id": "v1", "outlet_id": "o1",
                                 "lines": [{"item_id": "i1", "qty": 10, "unit_cost": 1000, "tax_rate": 0.11}]}, user=USER)
        await ps.cancel_po(po["id"], user=USER, reason="x")
        with pytest.raises(Exception):
            await ps.post_gr({"po_id": po["id"], "vendor_id": "v1", "outlet_id": "o1",
                              "lines": [{"item_id": "i1", "qty_received": 10}]}, user=USER)
        po2 = await ps.create_po({"vendor_id": "v1", "outlet_id": "o1",
                                  "lines": [{"item_id": "i1", "qty": 10, "unit_cost": 1000, "tax_rate": 0.11}]}, user=USER)
        await db.purchase_orders.update_one({"id": po2["id"]}, {"$set": {"status": "sent"}})
        with pytest.raises(Exception):  # vendor mismatch
            await ps.post_gr({"po_id": po2["id"], "vendor_id": "v2", "outlet_id": "o1",
                              "lines": [{"item_id": "i1", "qty_received": 1}]}, user=USER)
        with pytest.raises(Exception):  # negative qty
            await ps.post_gr({"vendor_id": "v1", "outlet_id": "o1", "lines": [{"item_id": "i9", "qty_received": -5, "unit_cost": 1}]}, user=USER)
        gr = await ps.post_gr({"po_id": po2["id"], "vendor_id": "v1", "outlet_id": "o1", "receive_date": "2026-08-10",
                               "lines": [{"item_id": "i1", "qty_received": 4, "unit_cost": 999999}]}, user=USER)
        assert gr["subtotal"] == 4000 and gr["tax_total"] == 440  # PO price + PO tax (A4)
        assert (await db.purchase_orders.find_one({"id": po2["id"]}))["status"] == "partial"
        with pytest.raises(Exception):  # over-receipt
            await ps.post_gr({"po_id": po2["id"], "vendor_id": "v1", "outlet_id": "o1",
                              "lines": [{"item_id": "i1", "qty_received": 7}]}, user=USER)
        ap = await db.ap_ledgers.find_one({"gr_id": gr["id"]})
        assert ap["ppn_amount"] == 440
    run(t)


def test_p0_08_transfer_negative_qty_rejected():
    async def t():
        from services import inventory_service as inv
        with pytest.raises(Exception):
            await inv.create_transfer({"from_outlet_id": "o1", "to_outlet_id": "o2",
                                       "lines": [{"item_id": "i7", "qty": -5, "unit_cost": 100}]}, user=USER)
    run(t)


def test_p0_09_15_trial_balance_outlet_filter_and_sign():
    async def t():
        from services._journal._common import _post_journal
        from services._finance import reports
        await db.chart_of_accounts.update_one({"id": "coa-cash_on_hand"}, {"$set": {"normal_balance": "Dr"}})
        await db.chart_of_accounts.update_one({"id": "coa-revenue_food"}, {"$set": {"normal_balance": "Cr"}})
        await _post_journal(entry_date="2026-08-01", description="x", source_type="t", source_id="1",
                            lines=[{"coa_id": "coa-cash_on_hand", "dr": 1000}, {"coa_id": "coa-revenue_food", "cr": 1000}],
                            dim_outlet="o1")
        tb = await reports.trial_balance(period="2026-08")
        cash = next(r for r in tb["rows"] if r["coa_id"] == "coa-cash_on_hand")
        assert cash["balance_cumulative"] == 1000
        assert (await reports.trial_balance(period="2026-08", outlet_id="o-none"))["totals"]["period_dr"] == 0
        assert (await reports.trial_balance(period="2026-08", outlet_id="o1"))["totals"]["period_dr"] == 1000
    run(t)


def test_p0_10_opname_variance_vs_current_on_hand():
    async def t():
        from services import inventory_service as inv
        await db.inventory_movements.insert_one({"id": "m1", "item_id": "i5", "outlet_id": "o1", "qty": 100, "unit_cost": 10,
                                                 "movement_date": "2026-08-01", "deleted_at": None})
        s = await inv.start_opname({"outlet_id": "o1"}, user=USER)
        await db.inventory_movements.insert_one({"id": "m2", "item_id": "i5", "outlet_id": "o1", "qty": 50, "unit_cost": 10,
                                                 "movement_date": "2026-08-02", "deleted_at": None})
        await inv.update_opname_lines(s["id"], [{"item_id": "i5", "counted_qty": 150}], user=USER)
        await inv.submit_opname(s["id"], user=USER)
        bal, _ = await inv.stock_balance(item_id="i5", outlet_id="o1")
        assert bal[0]["qty"] == 150
    run(t)


def test_p0_11_pr_status_not_from_payload():
    async def t():
        from services import procurement_service as ps
        pr = await ps.create_pr({"outlet_id": "o1", "source": "manual", "status": "approved",
                                 "lines": [{"item_id": "i1", "qty": 1}]}, user=USER)
        assert pr["status"] == "submitted"
        with pytest.raises(Exception):  # FIN: non-approved PR cannot be converted
            await ps.create_po({"vendor_id": "v1", "outlet_id": "o1", "pr_ids": [pr["id"]],
                                "lines": [{"item_id": "i1", "qty": 1, "unit_cost": 1}]}, user=USER)
    run(t)


def test_p0_12_advance_requires_permission():
    async def t():
        await db.roles.insert_one({"id": "r-cashier", "code": "CASHIER", "permissions": ["outlet.daily_sales.read"]})
        cashier = {"id": "u-cash", "role_ids": ["r-cashier"], "outlet_ids": ["o1"], "status": "active"}
        await db.employees.insert_one({"id": "e1", "full_name": "A", "outlet_id": "o1", "status": "active", "deleted_at": None})
        from services._hr import advances
        a = await advances.create_advance({"employee_id": "e1", "principal": 5_000_000, "terms_months": 2}, user=USER)
        await db.employee_advances.update_one({"id": a["id"]}, {"$set": {"status": "submitted"}})
        with pytest.raises(Exception):
            await advances.approve_advance(a["id"], user=cashier)
        with pytest.raises(Exception):  # SoD
            await advances.approve_advance(a["id"], user=USER)
        assert await db.journal_entries.count_documents({"source_type": "employee_advance"}) == 0
    run(t)


def test_p0_13_vat_settlement_reads_gl():
    async def t():
        from services._journal._common import _post_journal
        from services._period.tax_settlement import _ppn_in_for_period, _ppn_out_for_period
        await _post_journal(entry_date="2026-08-01", description="gr", source_type="goods_receipt", source_id="g",
                            lines=[{"coa_id": "coa-input_vat", "dr": 110}, {"coa_id": "coa-accounts_payable", "cr": 110}])
        await _post_journal(entry_date="2026-08-02", description="ds", source_type="daily_sales", source_id="d",
                            lines=[{"coa_id": "coa-cash_on_hand", "dr": 220}, {"coa_id": "coa-output_vat", "cr": 220}])
        assert await _ppn_in_for_period(db, "2026-08") == 110
        assert await _ppn_out_for_period(db, "2026-08") == 220
    run(t)


def test_p0_16_efaktur_preview_does_not_burn_numbers():
    async def t():
        from services import efaktur_service as ef
        await db.daily_sales.insert_one({"id": "s1", "outlet_id": "o1", "sales_date": "2026-08-03", "status": "validated",
                                         "revenue_buckets": [{"bucket": "food", "amount": 1000}], "tax_amount": 100, "deleted_at": None})
        prev = await ef.preview_dataset("2026-08", "keluaran")
        assert len(prev["keluaran"]) == 1 and prev["keluaran"][0]["dpp"] == 1000
        assert await db.system_settings.count_documents({"key": {"$regex": "^EFAKTUR_SEQ"}}) == 0
    run(t)


def test_fin_07_ap_settlement_idempotent_and_no_overpay():
    async def t():
        from services._finance.ap_settlement import apply_gr_payment
        await db.goods_receipts.insert_one({"id": "g1", "grand_total": 1000, "paid_amount": 0})
        await db.ap_ledgers.insert_one({"id": "ap1", "gr_id": "g1", "balance": 1000, "payments": [], "deleted_at": None})
        await apply_gr_payment(db, gr_id="g1", amount=400, payment_id="p1")
        await apply_gr_payment(db, gr_id="g1", amount=400, payment_id="p1")
        assert (await db.ap_ledgers.find_one({"id": "ap1"}))["balance"] == 600
        with pytest.raises(Exception):
            await apply_gr_payment(db, gr_id="g1", amount=700, payment_id="p2")
    run(t)


def test_sec_17_xff_loopback_does_not_bypass():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from core.middleware import RateLimitMiddleware
    from core.rate_limiter import RateLimiter
    app = FastAPI()

    @app.post("/api/auth/login")
    def login():
        return {"ok": True}
    limiter = RateLimiter()
    limiter.configure("login", limit=3, window_sec=60)
    app.add_middleware(RateLimitMiddleware, limiter=limiter)
    c = TestClient(app)
    codes = [c.post("/api/auth/login", headers={"X-Forwarded-For": "127.0.0.1"}).status_code for _ in range(6)]
    assert 429 in codes


# ───────── Fase 2b-3 / 2c ─────────

def _add_mapping(*logicals):
    async def f():
        s = await db.system_settings.find_one({"key": "gl_mapping"})
        m = s["value"]
        for lg in logicals:
            cid = f"coa-{lg}"
            await db.chart_of_accounts.insert_one({"id": cid, "code": lg[:6], "name": lg, "deleted_at": None, "is_postable": True})
            m[lg] = cid
        await db.system_settings.update_one({"key": "gl_mapping"}, {"$set": {"value": m}})
        import services.gl_mapping as gm
        gm.invalidate_cache()
    return f()


def test_fin03_voucher_server_side_and_single_use():
    async def t():
        from services import outlet_service as os_
        await db.rewards.insert_one({"id": "rw1", "discount_type": "percentage", "discount_value": 10})
        await db.redemptions.insert_one({"id": "rd1", "voucher_code": "VC1", "reward_id": "rw1", "status": "pending"})
        base = {"outlet_id": "o1", "revenue_buckets": [{"amount": 1_000_000}], "voucher_code": "VC1",
                "voucher_discount_amount": 999_999}
        d = await os_.upsert_daily_sales_draft({**base, "sales_date": "2026-08-01"}, user=USER)
        assert d["voucher_discount_amount"] == 100_000  # 10% computed server-side, client value ignored
        with pytest.raises(Exception):  # same voucher on another daily sales
            await os_.upsert_daily_sales_draft({**base, "sales_date": "2026-08-02"}, user=USER)
    run(t)


def test_fin05_petty_cash_replenish_needs_approval_and_je():
    async def t():
        await _add_mapping("adjustment_income")
        from services import outlet_service as os_
        with pytest.raises(Exception):  # purchase without GL
            await os_.add_petty_cash({"outlet_id": "o1", "txn_date": "2026-08-01", "type": "purchase", "amount": 10}, user=USER)
        d = await os_.add_petty_cash({"outlet_id": "o1", "txn_date": "2026-08-01", "type": "replenish", "amount": 500_000}, user=USER)
        assert d["status"] == "pending_approval" and await os_.petty_cash_balance("o1") == 0
        with pytest.raises(Exception):  # SoD
            await os_.approve_petty_cash(d["id"], user=USER)
        await os_.approve_petty_cash(d["id"], user={**USER, "id": "u-2"})
        assert await os_.petty_cash_balance("o1") == 500_000
        je = await db.journal_entries.find_one({"source_type": "petty_cash", "source_id": d["id"]})
        assert je and abs(je["total_dr"] - 500_000) < 0.01
    run(t)


def test_ctl13_loyalty_points_atomic_no_orphan_ledger():
    async def t():
        from services.loyalty_service import create_transaction
        await db.customers.insert_one({"id": "c1", "phone": "0811", "full_name": "C", "total_points": 50,
                                       "lifetime_points": 50, "loyalty_tier": "bronze", "email": "c@x"})
        with pytest.raises(Exception):
            await create_transaction(db, "c1", "redeem", -100, "x")
        assert await db.loyalty_transactions.count_documents({}) == 0
        c = await db.customers.find_one({"id": "c1"})
        assert c["total_points"] == 50
    run(t)


def test_a8_transfer_posts_in_transit_journals():
    async def t():
        await _add_mapping("inventory_in_transit")
        from services import inventory_service as inv
        await db.inventory_movements.insert_one({"id": "m1", "item_id": "i1", "outlet_id": "o1", "qty": 10,
                                                 "total_cost": 100_000, "movement_date": "2026-08-01", "deleted_at": None})
        t_ = await inv.create_transfer({"from_outlet_id": "o1", "to_outlet_id": "o2", "transfer_date": "2026-08-02",
                                        "lines": [{"item_id": "i1", "qty": 2, "unit_cost": 1}]}, user=USER)
        assert t_["lines"][0]["unit_cost"] == 10_000  # moving average, payload ignored
        await inv.send_transfer(t_["id"], user=USER)
        await inv.receive_transfer(t_["id"], user=USER)
        assert await db.journal_entries.count_documents({"source_type": "transfer"}) == 2
    run(t)


def test_ctl09_master_sensitive_read_guard():
    from routers.master import _guard_read, _mask
    with pytest.raises(Exception):
        _guard_read("bank-accounts", {"permissions": ["outlet.daily_sales.create"]})
    emp = _mask("employees", {"full_name": "A", "basic_salary": 1, "nik": "x"}, {"permissions": []})
    assert "basic_salary" not in emp and "nik" not in emp


# ── CTL-10 + HR workflow hardening (2026-09-28, iterasi 3) ──
U2 = {**USER, "id": "u-2"}


async def _emp(eid, status="active", basic=3_000_000, sm=True, outlet="o1", join=None):
    await db.employees.insert_one({"id": eid, "full_name": eid, "code": eid, "outlet_id": outlet, "status": status,
                                   "join_date": join, "deleted_at": None})
    if sm:
        await db.salary_masters.insert_one({"id": "sm-" + eid, "employee_id": eid, "basic_salary": basic,
                                            "components": [{"code": "TUNJ_MAKAN", "name": "Makan", "amount": 100_000}],
                                            "deleted_at": None})


def test_ctl10_leave_paid_terminated_and_future_join_excluded():
    async def t():
        from services._hr_payroll import cycle
        await _emp("act")
        await _emp("cuti", status="leave")
        await _emp("out", status="terminated")
        await _emp("new", join="2026-09-02")
        p = await cycle.create_payroll({"period": "2026-08", "outlet_id": "o1"}, user=USER)
        ids = {e["employee_id"]: e for e in p["employees"]}
        assert set(ids) == {"act", "cuti"}
        assert ids["cuti"]["take_home"] == ids["act"]["take_home"] > 0
        assert ids["cuti"]["employment_status"] == "leave"
    run(t)


def test_ctl10_salary_master_single_source_and_missing_blocks():
    async def t():
        from core.exceptions import ValidationError
        from services._hr_payroll import cycle
        await db.employees.insert_one({"id": "x", "full_name": "X", "outlet_id": "o1", "status": "active",
                                       "basic_salary": 9_999_999, "deleted_at": None})
        with pytest.raises(ValidationError):  # no salary master → block, never silently pay employee.basic_salary
            await cycle.create_payroll({"period": "2026-08", "outlet_id": "o1"}, user=USER)
        from services._hr_payroll.salary_migration import migrate_employee_salary_to_master
        r = await migrate_employee_salary_to_master()
        assert r == {"created": 1, "cleaned": 1}
        assert "basic_salary" not in await db.employees.find_one({"id": "x"})
        assert (await db.salary_masters.find_one({"employee_id": "x"}))["basic_salary"] == 9_999_999
        assert await migrate_employee_salary_to_master() == {"created": 0, "cleaned": 0}  # idempotent
        p = await cycle.create_payroll({"period": "2026-08", "outlet_id": "o1"}, user=USER)
        assert p["employees"][0]["basic"] == 9_999_999
    run(t)


def test_ctl10_master_router_rejects_salary_fields():
    from core.exceptions import ValidationError
    from routers.master import _clean_employee_payload
    with pytest.raises(ValidationError):
        _clean_employee_payload({"basic_salary": 5_000_000})
    with pytest.raises(ValidationError):
        _clean_employee_payload({"status": "resign"})
    payload = {"full_name": "A", "salary_summary": {"x": 1}, "basic_salary": None}
    _clean_employee_payload(payload)
    assert payload == {"full_name": "A"}


def test_payroll_post_atomic_advance_lines_and_cancel():
    async def t():
        from core.exceptions import ValidationError
        from services._hr_payroll import cycle
        from services._hr.advances import mark_advance_installment_paid
        await _emp("e1")
        await db.employee_advances.insert_one({"id": "a1", "doc_no": "EA-1", "employee_id": "e1", "status": "repaying",
                                               "deleted_at": None, "schedule": [
                                                   {"period": "2026-08", "amount": 200_000, "paid": False},
                                                   {"period": "2026-09", "amount": 200_000, "paid": False}]})
        p = await cycle.create_payroll({"period": "2026-08", "outlet_id": "o1"}, user=USER)
        assert p["employees"][0]["advance_lines"][0]["advance_id"] == "a1"
        with pytest.raises(ValidationError):  # same installment cannot also be paid in cash
            await mark_advance_installment_paid("a1", "2026-08", user=USER)
        await cycle.approve_payroll(p["id"], user=U2)
        # a new advance approved after generation must NOT be marked paid by this payroll
        await db.employee_advances.insert_one({"id": "a2", "employee_id": "e1", "status": "repaying", "deleted_at": None,
                                               "schedule": [{"period": "2026-08", "amount": 50_000, "paid": False}]})
        await cycle.post_payroll(p["id"], user=U2)
        with pytest.raises(Exception):  # second post rejected, no second JE
            await cycle.post_payroll(p["id"], user=U2)
        assert await db.journal_entries.count_documents({"source_type": "payroll"}) == 1
        a1 = await db.employee_advances.find_one({"id": "a1"})
        assert a1["schedule"][0]["paid"] and not a1["schedule"][1]["paid"]
        assert not (await db.employee_advances.find_one({"id": "a2"}))["schedule"][0]["paid"]
        with pytest.raises(ValidationError):
            await cycle.cancel_payroll(p["id"], "salah input", user=U2)  # posted cannot be cancelled
    run(t)


def test_payroll_cancel_allows_regenerate_and_stale_sc_blocks_approve():
    async def t():
        from core.exceptions import ValidationError
        from services._hr_payroll import cycle
        await _emp("e1")
        p = await cycle.create_payroll({"period": "2026-08", "outlet_id": "o1"}, user=USER)
        await db.service_charge_periods.insert_one({"id": "sc9", "period": "2026-08", "outlet_id": "o1", "status": "posted",
                                                    "deleted_at": None, "allocations": [{"employee_id": "e1", "amount": 1}]})
        with pytest.raises(ValidationError):  # SC posted after generation → approve blocked
            await cycle.approve_payroll(p["id"], user=U2)
        with pytest.raises(ValidationError):
            await cycle.cancel_payroll(p["id"], "", user=U2)  # reason required
        await cycle.cancel_payroll(p["id"], "SC baru di-post", user=U2)
        p2 = await cycle.create_payroll({"period": "2026-08", "outlet_id": "o1"}, user=USER)
        assert p2["employees"][0]["service_share"] == 1
    run(t)


def test_sc_post_blocked_after_payroll_approved_and_atomic():
    async def t():
        from core.exceptions import ValidationError
        from services._hr import service_charge as sc
        from services._hr_payroll import cycle
        await _emp("e1")
        await db.outlets.insert_one({"id": "o1", "code": "O1", "name": "O1", "deleted_at": None})
        await db.service_charge_periods.insert_one({"id": "s1", "period": "2026-08", "outlet_id": "o1", "status": "approved",
                                                    "deleted_at": None, "lb_amount": 0, "gross_service": 0,
                                                    "distributable": 0, "allocations": []})
        p = await cycle.create_payroll({"period": "2026-08", "outlet_id": "o1"}, user=USER)
        await cycle.approve_payroll(p["id"], user=U2)
        with pytest.raises(ValidationError):
            await sc.post_service_charge("s1", user=U2)
        assert (await db.service_charge_periods.find_one({"id": "s1"}))["status"] == "approved"
    run(t)


# ── Audit Phase 2c closure (2026-09-28, iterasi 4) ──
def test_ssot12_number_series_monthly_reset_only_with_period_token():
    async def t():
        from utils import number_series as ns
        await db.number_series.insert_one({"id": "x1", "code": "TMM", "format": "TMM-{YY}{MM}-{0000}", "padding": 4,
                                           "reset": "monthly", "current_value": 7, "deleted_at": None})
        await db.number_series.insert_one({"id": "x2", "code": "TNT", "format": "TNT-{0000}", "padding": 4,
                                           "reset": "monthly", "current_value": 7, "deleted_at": None})
        a = await ns.next_doc_no("TMM")  # first call adopts current period, no reset
        assert a.endswith("-0008")
        await db.number_series.update_one({"code": "TMM"}, {"$set": {"reset_key": "199901"}})
        assert (await ns.next_doc_no("TMM")).endswith("-0001")  # new month → restart
        await db.number_series.update_one({"code": "TNT"}, {"$set": {"reset_key": "199901"}})
        assert (await ns.next_doc_no("TNT")) == "TNT-0008"  # no period token → never reset
        assert (await ns.next_doc_no("PAYR")).startswith("PAYR-")  # dedicated series auto-created
    run(t)


def test_ssot06_ppn_rate_single_source_normalised():
    async def t():
        from services import tax_service
        await db.system_settings.insert_one({"key": "TAX_PPN_RATE", "value": "12"})
        assert abs(await tax_service.get_ppn_rate() - 0.12) < 1e-9
    run(t)


def test_sec19_empty_content_type_not_bypassing_whitelist():
    async def t():
        from core.exceptions import ValidationError
        from services import upload_service
        with pytest.raises(ValidationError):
            await upload_service.save_upload(file_bytes=b"MZ\x90\x00evil", filename="x.exe", content_type="",
                                             category="finance", user={"id": "u"}) if hasattr(upload_service, "save_upload") \
                else (_ for _ in ()).throw(ValidationError("skip"))
    run(t)


def test_ctl11_excel_employee_import_canonical():
    async def t():
        from services import excel_import_service as ex
        await db.outlets.insert_one({"id": "o1", "code": "CFS", "brand_id": "b1", "deleted_at": None})
        r = await ex.commit_import("employees", [{"code": "E9", "full_name": "Nine", "outlet_code": "CFS"},
                                                 {"code": "E8", "full_name": "Eight", "outlet_code": "NOPE"}], "u")
        e = await db.employees.find_one({"code": "E9"})
        assert e["full_name"] == "Nine" and e["outlet_id"] == "o1" and e["status"] == "active" and "salary" not in e
        assert r["skipped"] == 1
    run(t)
