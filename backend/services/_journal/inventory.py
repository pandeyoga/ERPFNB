"""_journal/inventory.py — journal postings for inventory events."""
from typing import Optional

from services import gl_mapping
from services._journal._common import _post_journal


async def post_for_adjustment(adj: dict, *, user_id: str) -> dict:
    """Adjustment: total_value > 0 (positive correction) Dr Inv Cr Adjustment Income;
    < 0 (loss) Dr Loss/Breakage Cr Inventory."""
    inv_acc = await gl_mapping.resolve("inventory", scope_outlet_id=adj["outlet_id"])
    total = float(adj.get("total_value", 0))
    if total >= 0:
        income_acc = await gl_mapping.resolve("adjustment_income")
        lines = [
            {"coa_id": inv_acc, "dr": total, "cr": 0, "memo": "Adj +"},
            {"coa_id": income_acc, "dr": 0, "cr": total, "memo": "Adj income"},
        ]
    else:
        loss_acc = await gl_mapping.resolve("loss_breakage")
        amt = -total
        lines = [
            {"coa_id": loss_acc, "dr": amt, "cr": 0, "memo": f"Adj {adj.get('reason','')}"},
            {"coa_id": inv_acc, "dr": 0, "cr": amt, "memo": "Inv reduction"},
        ]
    return await _post_journal(
        entry_date=adj["adjustment_date"],
        description=f"Adjustment {adj.get('doc_no','')}: {adj.get('reason','')}",
        source_type="adjustment",
        source_id=adj["id"],
        lines=lines,
        user_id=user_id,
        dim_outlet=adj["outlet_id"],
    )


async def post_for_opname(session: dict, *, user_id: str) -> Optional[dict]:
    """Opname variance:
       negative variance (less stock) → Dr COGS, Cr Inventory
       positive variance (more stock) → Dr Inventory, Cr Adjustment Income
    """
    total = float(session.get("total_variance_value", 0))
    if abs(total) < 0.01:
        return None
    inv_acc = await gl_mapping.resolve("inventory", scope_outlet_id=session["outlet_id"])
    if total < 0:  # less than system
        cogs_acc = await gl_mapping.resolve("cogs")
        amt = -total
        lines = [
            {"coa_id": cogs_acc, "dr": amt, "cr": 0, "memo": "Opname variance (less)"},
            {"coa_id": inv_acc, "dr": 0, "cr": amt, "memo": "Inventory reduction"},
        ]
    else:
        income_acc = await gl_mapping.resolve("adjustment_income")
        lines = [
            {"coa_id": inv_acc, "dr": total, "cr": 0, "memo": "Opname variance (more)"},
            {"coa_id": income_acc, "dr": 0, "cr": total, "memo": "Adj income"},
        ]
    return await _post_journal(
        entry_date=session["opname_date"],
        description=f"Opname {session.get('doc_no','')} period {session['period']}",
        source_type="opname",
        source_id=session["id"],
        lines=lines,
        user_id=user_id,
        dim_outlet=session["outlet_id"],
    )


async def post_for_transfer(t: dict, *, stage: str, user_id: str) -> Optional[dict]:
    """A8: inter-outlet transfer. send: Dr In-Transit / Cr Inventory(from); receive: Dr Inventory(to) / Cr In-Transit."""
    total = round(sum(float(ln.get("total_cost", 0) or 0) for ln in t.get("lines", [])), 2)
    if total <= 0:
        return None
    transit = await gl_mapping.resolve("inventory_in_transit")
    outlet = t["from_outlet_id"] if stage == "send" else t["to_outlet_id"]
    inv = await gl_mapping.resolve("inventory", scope_outlet_id=outlet)
    dr, cr = (transit, inv) if stage == "send" else (inv, transit)
    return await _post_journal(
        entry_date=t["transfer_date"],
        description=f"Transfer {t.get('doc_no', '')} ({stage})",
        source_type="transfer",
        source_id=f"{t['id']}:{stage}",
        lines=[
            {"coa_id": dr, "dr": total, "cr": 0, "memo": f"Transfer {stage}"},
            {"coa_id": cr, "dr": 0, "cr": total, "memo": f"Transfer {stage}"},
        ],
        user_id=user_id,
        dim_outlet=outlet,
    )
