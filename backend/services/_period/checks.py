"""Period closing readiness checks (8-step checklist)."""
from __future__ import annotations

from core.db import get_db
from core.exceptions import ValidationError
from services._period._common import _valid_period
from services._period.crud import get_period


async def closing_checks(period: str) -> dict:
    """Run all readiness checks for closing the given period."""
    if not _valid_period(period):
        raise ValidationError("period harus YYYY-MM")
    db = get_db()
    p = await db.accounting_periods.find_one({"period": period})
    if not p:
        await get_period(period)
        p = await db.accounting_periods.find_one({"period": period})

    checks: list[dict] = []

    # 1) Pending sales validations
    pending_sales = await db.daily_sales.count_documents({
        "deleted_at": None,
        "status": "submitted",
        "sales_date": {"$gte": f"{period}-01", "$lte": f"{period}-31"},
    })
    checks.append({
        "id": "pending_sales_validation",
        "label": "Sales submission yang belum divalidasi",
        "status": "ok" if pending_sales == 0 else "warn",
        "value": pending_sales,
        "detail": f"{pending_sales} daily sales status=submitted",
        "fix_link": "/finance/validation",
        "blocker": False,
    })

    # 2) Trial Balance balanced
    try:
        from services import finance_service
        tb = await finance_service.trial_balance(period=period)
        balanced = bool(tb.get("totals", {}).get("is_balanced_period"))
        diff = round(abs(tb["totals"]["period_dr"] - tb["totals"]["period_cr"]), 2)
        checks.append({
            "id": "tb_balanced",
            "label": "Trial Balance period seimbang (Dr = Cr)",
            "status": "ok" if balanced else "fail",
            "value": diff,
            "detail": "Selisih Dr-Cr: Rp " + f"{diff:,.0f}".replace(",", ".") if not balanced else "Period balance Dr = Cr",
            "fix_link": f"/finance/trial-balance?period={period}",
            "blocker": True,
        })
    except Exception as e:  # noqa: BLE001
        checks.append({
            "id": "tb_balanced", "label": "Trial Balance period seimbang (Dr = Cr)",
            "status": "warn", "value": 0,
            "detail": f"Tidak dapat menghitung TB: {e}",
            "fix_link": None, "blocker": False,
        })

    # 3) Pending PR/PO approvals
    pending_pr = await db.purchase_requests.count_documents({"deleted_at": None, "status": {"$in": ["submitted", "awaiting_approval"]}})
    pending_po = await db.purchase_orders.count_documents({"deleted_at": None, "status": {"$in": ["awaiting_approval"]}})
    pending_total = pending_pr + pending_po
    checks.append({
        "id": "pending_approvals", "label": "PR/PO menunggu approval",
        "status": "ok" if pending_total == 0 else "info",
        "value": pending_total,
        "detail": f"{pending_pr} PR + {pending_po} PO menunggu",
        "fix_link": "/procurement/prs", "blocker": False,
    })

    # 4) AP open balance
    grs = await db.goods_receipts.find({"deleted_at": None}).to_list(20000)
    ap_open_count = sum(1 for g in grs if not g.get("paid_at") and g.get("payment_status") != "paid" and float(g.get("grand_total", 0) or 0) > 0)
    checks.append({
        "id": "ap_open", "label": "AP terbuka (info)",
        "status": "info", "value": ap_open_count,
        "detail": f"{ap_open_count} GR open di AP ledger",
        "fix_link": "/finance/ap-aging", "blocker": False,
    })

    # 5) Negative stock balance
    neg_count = 0
    try:
        agg = [
            {"$match": {"deleted_at": None}},
            {"$group": {"_id": {"item_id": "$item_id", "outlet_id": "$outlet_id"}, "qty": {"$sum": "$qty"}}},
            {"$match": {"qty": {"$lt": 0}}},
            {"$count": "n"},
        ]
        async for d in db.inventory_movements.aggregate(agg):
            neg_count = int(d.get("n", 0))
    except Exception:  # noqa: BLE001
        pass
    checks.append({
        "id": "negative_stock", "label": "Stock balance negatif",
        "status": "ok" if neg_count == 0 else "warn",
        "value": neg_count,
        "detail": f"{neg_count} pasangan (item × outlet) saldo negatif",
        "fix_link": "/inventory/balance", "blocker": False,
    })

    # 6) Manual JE count
    manual_je = await db.journal_entries.count_documents({"deleted_at": None, "period": period, "source_type": "manual", "status": "posted"})
    checks.append({
        "id": "manual_je", "label": "Jumlah Manual Journal di period ini",
        "status": "info", "value": manual_je,
        "detail": f"{manual_je} manual JE",
        "fix_link": f"/finance/journals?period={period}&source_type=manual", "blocker": False,
    })

    # 7) Open opname sessions
    open_opname = 0
    try:
        open_opname = await db.opname_sessions.count_documents({"deleted_at": None, "status": {"$in": ["draft", "in_progress"]}})
    except Exception:  # noqa: BLE001
        pass
    checks.append({
        "id": "open_opname", "label": "Opname session terbuka",
        "status": "ok" if open_opname == 0 else "warn",
        "value": open_opname,
        "detail": f"{open_opname} opname session belum disubmit",
        "fix_link": "/inventory/opname", "blocker": False,
    })

    # 8) Period status
    cur_status = (p or {}).get("status", "open")
    checks.append({
        "id": "period_status", "label": "Status period saat ini",
        "status": "info", "value": cur_status,
        "detail": f"Period {period} sekarang berstatus '{cur_status}'",
        "fix_link": None, "blocker": False,
    })

    blocker_failed = any(c["status"] == "fail" and c.get("blocker") for c in checks)
    warns = [c for c in checks if c["status"] == "warn"]
    ready_to_close = (cur_status == "open") and not blocker_failed
    ready_to_lock = cur_status in ("open", "closed") and not blocker_failed

    return {
        "period": period,
        "current_status": cur_status,
        "checks": checks,
        "summary": {
            "blockers": int(blocker_failed),
            "warnings": len(warns),
            "ready_to_close": ready_to_close,
            "ready_to_lock": ready_to_lock,
        },
    }
