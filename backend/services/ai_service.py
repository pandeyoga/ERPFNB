"""AI services for Phase 3+ — autocomplete & GL categorization (using Emergent LLM key).
Do NOT block users on AI; if LLM fails, fall back to local fuzzy.
"""
import json
import logging
import re
from typing import Optional

from core.config import settings
from core.runtime_config import get_setting
from core.db import get_db

logger = logging.getLogger("aurora.ai")


def _normalize(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").lower().strip())


async def suggest_items(query: str, limit: int = 8, outlet_id: Optional[str] = None) -> list[dict]:
    """Local fuzzy match items by name/code/SKU. (LLM fallback skipped — fast UX.)

    Phase 9C — also returns `last_vendor_name`, `last_unit_cost`, `last_purchase_date`,
    `last_purchase_days_ago` from the most recent posted GR (per item, optionally
    scoped to a specific outlet).
    """
    if not query or len(query) < 1:
        return []
    db = get_db()
    rx = {"$regex": re.escape(query), "$options": "i"}
    cursor = db.items.find({
        "deleted_at": None,
        "active": True,
        "$or": [{"name": rx}, {"code": rx}, {"sku": rx}, {"name_local": rx}],
    }).limit(limit)
    items = [it async for it in cursor]
    if not items:
        return []

    item_ids = [it["id"] for it in items]

    # ---------------- Phase 9C: last GR vendor + price hint ----------------
    # Collection list lookup is potentially expensive — fetch once.
    try:
        coll_names = await db.list_collection_names()
    except Exception:  # noqa: BLE001
        coll_names = []
    has_gr = "goods_receipts" in coll_names

    last_gr_by_item: dict[str, dict] = {}
    if has_gr:
        try:
            gr_match: dict = {
                "deleted_at": None,
                "status": "posted",
                "lines.item_id": {"$in": item_ids},
            }
            if outlet_id:
                gr_match["outlet_id"] = outlet_id
            pipeline = [
                {"$match": gr_match},
                {"$unwind": "$lines"},
                {"$match": {"lines.item_id": {"$in": item_ids}}},
                {"$sort": {"receive_date": -1, "created_at": -1}},
                {"$group": {
                    "_id": "$lines.item_id",
                    "vendor_id": {"$first": "$vendor_id"},
                    "unit_cost": {"$first": "$lines.unit_cost"},
                    "qty": {"$first": "$lines.qty_received"},
                    "received_date": {"$first": "$receive_date"},
                    "po_id": {"$first": "$po_id"},
                }},
            ]
            async for row in db.goods_receipts.aggregate(pipeline):
                last_gr_by_item[row["_id"]] = row
        except Exception as e:  # noqa: BLE001
            logger.warning(f"Last-GR aggregation failed: {e}")

    # Resolve vendor names in 1 batch
    vendor_ids = sorted({r.get("vendor_id") for r in last_gr_by_item.values() if r.get("vendor_id")})
    vendor_name_by_id: dict[str, str] = {}
    if vendor_ids:
        async for v in db.vendors.find({"id": {"$in": list(vendor_ids)}}, {"id": 1, "name": 1}):
            vendor_name_by_id[v["id"]] = v.get("name", "")

    # Fallback: item_price_history (legacy)
    has_iph = "item_price_history" in coll_names

    # B7 fix: pre-fetch item_price_history for items without GR hit (was N+1 find_one per item)
    no_gr_item_ids = [it["id"] for it in items if it["id"] not in last_gr_by_item]
    iph_fallback: dict[str, dict] = {}
    if has_iph and no_gr_item_ids:
        try:
            # Aggregate latest price per item
            iph_pipeline = [
                {"$match": {"item_id": {"$in": no_gr_item_ids}}},
                {"$sort": {"valid_from": -1}},
                {"$group": {"_id": "$item_id", "price": {"$first": "$price"},
                            "vendor_id": {"$first": "$vendor_id"},
                            "valid_from": {"$first": "$valid_from"}}},
            ]
            async for row in db.item_price_history.aggregate(iph_pipeline):
                iph_fallback[row["_id"]] = row
            # Batch-load any new vendor names not yet in vendor_name_by_id
            new_vendor_ids = [r["vendor_id"] for r in iph_fallback.values()
                              if r.get("vendor_id") and r["vendor_id"] not in vendor_name_by_id]
            if new_vendor_ids:
                async for v in db.vendors.find({"id": {"$in": new_vendor_ids}}, {"id": 1, "name": 1}):
                    vendor_name_by_id[v["id"]] = v.get("name", "")
        except Exception:  # noqa: BLE001
            pass

    results = []
    from datetime import datetime, timezone

    for it in items:
        last_price = None
        last_vendor_id = None
        last_vendor_name = None
        last_purchase_date = None
        last_days_ago: Optional[int] = None

        gr_hit = last_gr_by_item.get(it["id"])
        if gr_hit:
            last_price = gr_hit.get("unit_cost")
            last_vendor_id = gr_hit.get("vendor_id")
            last_vendor_name = vendor_name_by_id.get(last_vendor_id) if last_vendor_id else None
            last_purchase_date = gr_hit.get("received_date")
            if last_purchase_date:
                try:
                    raw = str(last_purchase_date)[:10]
                    d = datetime.strptime(raw, "%Y-%m-%d")
                    today = datetime.now(timezone.utc)
                    delta = (today.replace(tzinfo=None).date() - d.date()).days
                    last_days_ago = max(0, int(delta))
                except Exception:  # noqa: BLE001
                    pass

        # Legacy fallback for items with no GR yet — use pre-fetched iph_fallback map
        if last_price is None and has_iph:
            try:
                ph = iph_fallback.get(it["id"])
                if ph:
                    last_price = ph.get("price")
                    last_vendor_id = ph.get("vendor_id")
                    last_vendor_name = vendor_name_by_id.get(last_vendor_id) if last_vendor_id else None
                    last_purchase_date = ph.get("valid_from")
            except Exception:  # noqa: BLE001
                pass

        results.append({
            "id": it["id"], "code": it.get("code"),
            "name": it.get("name"), "unit": it.get("unit_default"),
            "category_id": it.get("category_id"),
            # Phase 9C — vendor/price hint fields
            "last_price": last_price,
            "last_unit_cost": last_price,           # alias for clarity in UI
            "last_vendor_id": last_vendor_id,
            "last_vendor_name": last_vendor_name,
            "last_purchase_date": last_purchase_date,
            "last_purchase_days_ago": last_days_ago,
        })
    return results


async def suggest_vendors(query: str, limit: int = 8) -> list[dict]:
    if not query or len(query) < 1:
        return []
    db = get_db()
    rx = {"$regex": re.escape(query), "$options": "i"}
    cursor = db.vendors.find({
        "deleted_at": None, "active": True,
        "$or": [{"name": rx}, {"code": rx}, {"phone": rx}],
    }).limit(limit)
    return [{"id": v["id"], "code": v.get("code"), "name": v.get("name"),
             "phone": v.get("phone"),
             "default_payment_terms_days": v.get("default_payment_terms_days", 30)}
            async for v in cursor]


async def categorize_expense(description: str, amount: float = 0,
                              outlet_id: Optional[str] = None) -> dict:
    """Suggest GL account (and optional cost center) for an expense description.

    Uses local rules first, LLM (Gemini 2.5 Flash for Phase 9D) if no rule matches.
    Returns {gl_id, gl_code, gl_name, confidence, reason, source,
             cost_center_outlet_id?, cost_center_outlet_name?}.
    """
    db = get_db()
    desc_lower = _normalize(description)

    # B7 fix: batch-load all active categorization rules at once
    rules_list = await db.categorization_rules.find({"active": True}).to_list(500)
    # Pre-build COA lookup and outlet lookup for matching rules
    rule_coa_ids = list({r["gl_account_id"] for r in rules_list if r.get("gl_account_id")})
    coa_docs_all = await db.chart_of_accounts.find(
        {"id": {"$in": rule_coa_ids}}, {"id": 1, "code": 1, "name": 1, "_id": 0}
    ).to_list(len(rule_coa_ids) + 1) if rule_coa_ids else []
    coa_cat_map = {c["id"]: c for c in coa_docs_all}
    # outlet lookup lazy (only once per outlet_id)
    _outlet_cat_cache: dict = {}

    # Local rules first
    for r in rules_list:
        pat = r.get("pattern", "")
        try:
            if re.search(pat, desc_lower):
                gl = coa_cat_map.get(r["gl_account_id"])
                if gl:
                    await db.categorization_rules.update_one(
                        {"id": r["id"]}, {"$inc": {"hit_count": 1}}
                    )
                    base = {
                        "gl_id": gl["id"], "gl_code": gl["code"],
                        "gl_name": gl["name"],
                        "confidence": min(1.0, 0.7 + r.get("hit_count", 0) * 0.01),
                        "reason": f"Matches rule: {pat}", "source": "rule",
                    }
                    if outlet_id:
                        if outlet_id not in _outlet_cat_cache:
                            _outlet_cat_cache[outlet_id] = await db.outlets.find_one({"id": outlet_id})
                        outlet = _outlet_cat_cache[outlet_id]
                        if outlet:
                            base["cost_center_outlet_id"] = outlet["id"]
                            base["cost_center_outlet_name"] = outlet.get("name", "")
                    return base
        except re.error:
            continue

    # LLM fallback (Phase 9D — switched to Gemini 2.5 Flash)
    llm_key = await get_setting("EMERGENT_LLM_KEY", default=settings.emergent_llm_key)
    if not settings.feature_ai_enabled or not llm_key:
        return {}
    try:
        coas_cursor = db.chart_of_accounts.find(
            {"deleted_at": None, "active": True, "is_postable": True,
             "type": {"$in": ["expense", "cogs"]}}
        )
        coa_list = [{"id": c["id"], "code": c["code"],
                     "name": c["name"]} async for c in coas_cursor]
        coa_str = "\n".join(
            f"- {c['code']}: {c['name']}" for c in coa_list
        )

        # Optional outlet hint for the LLM
        outlets_str = ""
        outlets_list: list[dict] = []
        async for o in db.outlets.find({"deleted_at": None, "active": True},
                                         {"id": 1, "name": 1, "code": 1}):
            outlets_list.append(o)
        if outlets_list:
            outlets_str = "\n".join(
                f"- {o.get('code') or o['id'][:6]}: {o.get('name', '')}" for o in outlets_list
            )

        from emergentintegrations.llm.chat import LlmChat, UserMessage
        sys = f"""You classify Indonesian F&B expense descriptions into GL accounts.
Available GL accounts (only use these codes):
{coa_str}

Available outlets (cost centers, optional — include outlet_code if mentioned in the description):
{outlets_str}

Output STRICT JSON ONLY (no prose, no markdown fences):
{{"gl_code":"...","confidence":0.0-1.0,"reason":"<short Indonesian, max 12 words>","outlet_code":"<one of the outlet codes or null>"}}"""
        chat = LlmChat(
            api_key=llm_key,
            session_id=f"categ-{description[:20]}",
            system_message=sys,
        ).with_model("gemini", "gemini-2.5-flash")
        resp = await chat.send_message(UserMessage(
            text=f'Description: "{description}"\nAmount: Rp {amount}\n\nOutput JSON.'
        ))
        m = re.search(r"\{.*\}", resp, re.DOTALL)
        if not m:
            return {}
        parsed = json.loads(m.group(0))
        gl = next((c for c in coa_list if c["code"] == parsed.get("gl_code")), None)
        if not gl:
            return {}
        result = {
            "gl_id": gl["id"], "gl_code": gl["code"], "gl_name": gl["name"],
            "confidence": float(parsed.get("confidence", 0.7)),
            "reason": parsed.get("reason", ""), "source": "llm",
        }
        # Resolve outlet_code → id if LLM provided one
        oc = parsed.get("outlet_code")
        if oc:
            chosen = next((o for o in outlets_list
                            if (o.get("code") == oc) or (str(o["id"])[:6] == oc)), None)
            if chosen:
                result["cost_center_outlet_id"] = chosen["id"]
                result["cost_center_outlet_name"] = chosen.get("name", "")
        elif outlet_id:
            outlet = await db.outlets.find_one({"id": outlet_id})
            if outlet:
                result["cost_center_outlet_id"] = outlet["id"]
                result["cost_center_outlet_name"] = outlet.get("name", "")
        return result
    except Exception as e:  # noqa: BLE001
        logger.warning(f"LLM categorize failed: {e}")
        return {}


async def learn_categorization(
    description: str = "",
    gl_account_id: str = "",
    *,
    user_id: str,
    pattern: Optional[str] = None,
) -> None:
    """Save user's categorization choice as a learning rule.

    Either:
      - `pattern` is given (regex-ish keyword pattern from the UI), OR
      - `description` is given and we derive a pattern from its keywords (legacy path).
    """
    db = get_db()
    # Build the pattern
    if pattern and pattern.strip():
        # Accept caller-provided pattern (already regex-safe-ish)
        # Wrap in word boundaries if it doesn't look like raw regex
        p = pattern.strip()
        if not (p.startswith("\\b") or p.startswith("(") or p.startswith("^")):
            # Use as-is; the categorize matcher does substring match via re.search
            final_pattern = p
        else:
            final_pattern = p
    else:
        desc_lower = _normalize(description)
        words = [w for w in desc_lower.split() if len(w) > 3][:3]
        if not words:
            return
        final_pattern = r"\b(" + "|".join(re.escape(w) for w in words) + r")\b"
    if not final_pattern or not gl_account_id:
        return
    existing = await db.categorization_rules.find_one({
        "pattern": final_pattern, "gl_account_id": gl_account_id,
    })
    if existing:
        await db.categorization_rules.update_one(
            {"id": existing["id"]}, {"$inc": {"hit_count": 1}}
        )
    else:
        import uuid
        from datetime import datetime, timezone
        await db.categorization_rules.insert_one({
            "id": str(uuid.uuid4()),
            "pattern": final_pattern, "gl_account_id": gl_account_id,
            "confidence": 0.7, "hit_count": 1, "active": True,
            "created_by": user_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
