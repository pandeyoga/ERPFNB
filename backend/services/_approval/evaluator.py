"""Amount computation + tier selection + state evaluation."""
from typing import Optional

from services._approval.workflow import get_workflow


def compute_amount(entity_type: str, entity: dict, amount_field: Optional[str] = None) -> float:
    """Try amount_field first; fallback to standard field per entity type."""
    if amount_field and entity.get(amount_field) is not None:
        try:
            return float(entity[amount_field])
        except Exception:  # noqa: BLE001
            pass
    if entity_type == "purchase_request":
        # Sum qty * est_cost over lines
        return sum(
            float(ln.get("qty", 0) or 0) * float(ln.get("est_cost", 0) or 0)
            for ln in (entity.get("lines") or [])
        )
    if entity_type == "purchase_order":
        return float(entity.get("grand_total", 0) or 0)
    if entity_type == "stock_adjustment":
        return abs(float(entity.get("total_value", 0) or 0))
    if entity_type == "payment_request":
        return float(entity.get("amount", 0) or 0)
    if entity_type == "employee_advance":
        return float(entity.get("amount", 0) or 0)
    return 0.0


def _tier_for_amount(workflow: dict, amount: float, *, entity: Optional[dict] = None) -> Optional[dict]:
    """Find best-matching tier for amount, optionally filtering by entity conditions."""
    tiers = (workflow.get("rule_data") or {}).get("tiers") or []
    candidates = []  # list of (specificity, tier)
    for t in tiers:
        lo = float(t.get("min_amount", 0) or 0)
        hi = t.get("max_amount")
        hi_f = float(hi) if hi is not None else None
        if not (amount >= lo and (hi_f is None or amount < hi_f)):
            continue
        # Check optional outlet/brand conditions
        cond_outlets = t.get("condition_outlet_ids") or []
        cond_brands = t.get("condition_brand_ids") or []
        if cond_outlets and entity:
            if entity.get("outlet_id") not in cond_outlets:
                continue
        if cond_brands and entity:
            if entity.get("brand_id") not in cond_brands:
                continue
        # Specificity: 2 = has both filters, 1 = has one, 0 = generic
        specificity = (1 if cond_outlets else 0) + (1 if cond_brands else 0)
        candidates.append((specificity, t))
    if not candidates:
        return tiers[-1] if tiers else None
    # Highest specificity wins; in tie, first added (preserve document order)
    candidates.sort(key=lambda x: -x[0])
    return candidates[0][1]


async def evaluate(entity_type: str, entity: dict) -> dict:
    """Inspect entity.approval_chain vs workflow tier; return state for UI/engine."""
    wf = await get_workflow(entity_type)
    chain: list[dict] = entity.get("approval_chain") or []
    # Pre-existing rejection terminates flow
    if any(s.get("action") == "rejected" for s in chain):
        return {
            "has_workflow": bool(wf), "tier": None, "amount": 0.0,
            "steps": [], "current_step_idx": None,
            "is_complete": False, "is_rejected": True,
            "executed_steps": chain,
        }
    if not wf:
        # No workflow configured → single-step (legacy single approve)
        executed = [s for s in chain if s.get("action") == "approved"]
        return {
            "has_workflow": False, "tier": None, "amount": 0.0,
            "steps": [{"label": "Approve", "any_of_perms": []}],
            "current_step_idx": 0 if not executed else None,
            "is_complete": bool(executed),
            "is_rejected": False,
            "executed_steps": chain,
        }
    amount_field = (wf.get("rule_data") or {}).get("amount_field")
    amount = compute_amount(entity_type, entity, amount_field)
    tier = _tier_for_amount(wf, amount, entity=entity)
    steps = (tier or {}).get("steps") or []
    executed_count = sum(1 for s in chain if s.get("action") == "approved")
    is_complete = executed_count >= len(steps) and len(steps) > 0
    current_step_idx = None if is_complete else executed_count if executed_count < len(steps) else None
    return {
        "has_workflow": True,
        "workflow_id": wf.get("id"),
        "tier": tier,
        "amount": round(amount, 2),
        "steps": steps,
        "current_step_idx": current_step_idx,
        "is_complete": is_complete,
        "is_rejected": False,
        "executed_steps": chain,
    }
