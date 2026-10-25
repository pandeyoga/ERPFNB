"""Idempotent startup data migrations for audit Phase 2c (B1/SSOT-05)."""
import logging

from core.db import get_db

logger = logging.getLogger("aurora.migrations")


async def unify_journal_schema() -> dict:
    """B1/RPT-10/SSOT-05: every JE carries doc_no AND je_number, and a top-level outlet_id when single-outlet."""
    db = get_db()
    a = await db.journal_entries.update_many(
        {"doc_no": {"$in": [None, ""]}, "je_number": {"$nin": [None, ""]}}, [{"$set": {"doc_no": "$je_number"}}])
    b = await db.journal_entries.update_many(
        {"je_number": {"$in": [None, ""]}, "doc_no": {"$nin": [None, ""]}}, [{"$set": {"je_number": "$doc_no"}}])
    c = 0
    async for je in db.journal_entries.find({"outlet_id": {"$in": [None, ""]}, "lines.dim_outlet": {"$nin": [None, ""]}},
                                            {"id": 1, "lines.dim_outlet": 1}):
        outs = {ln.get("dim_outlet") for ln in je.get("lines", []) if ln.get("dim_outlet")}
        if len(outs) == 1:
            await db.journal_entries.update_one({"id": je["id"]}, {"$set": {"outlet_id": outs.pop()}})
            c += 1
    res = {"doc_no": a.modified_count, "je_number": b.modified_count, "outlet_id": c}
    if any(res.values()):
        logger.info("journal schema unified: %s", res)
    return res


async def customer_identity_keys() -> dict:
    """POS-05/DB-01: backfill `customers.phone_key` and enforce one member per phone/email.

    Duplicates that already exist are NOT merged automatically (points/history must be reviewed);
    they are logged and the unique index is created once they are resolved.
    """
    from core.db import _unique_or_warn
    from services.customer_service import phone_key
    db = get_db()
    await db.customers.update_many({"deleted_at": {"$exists": False}}, {"$set": {"deleted_at": None}})
    n = 0
    async for c in db.customers.find({"phone": {"$nin": [None, ""]}, "phone_key": {"$exists": False}},
                                     {"id": 1, "phone": 1}):
        await db.customers.update_one({"id": c["id"]}, {"$set": {"phone_key": phone_key(c["phone"])}})
        n += 1
    dups = [g async for g in db.customers.aggregate([
        {"$match": {"deleted_at": None, "phone_key": {"$type": "string"}}},
        {"$group": {"_id": "$phone_key", "ids": {"$push": "$id"}, "n": {"$sum": 1}}},
        {"$match": {"n": {"$gt": 1}}}])]
    for g in dups:
        logger.error("duplicate loyalty members for phone_key=%s ids=%s — merge required", g["_id"], g["ids"])
    await _unique_or_warn(db.customers, [("phone_key", 1)], "customers_phone_key_unique",
                          {"phone_key": {"$type": "string"}, "deleted_at": None})
    await _unique_or_warn(db.customers, [("email", 1)], "customers_email_unique",
                          {"email": {"$type": "string"}, "deleted_at": None})
    await db.customers.create_index("id", unique=True)
    res = {"phone_key_backfilled": n, "duplicate_phone_groups": len(dups)}
    if n or dups:
        logger.info("customer identity keys: %s", res)
    return res


async def legacy_seed_field_names() -> dict:
    """UI-DATA-01/02/03: older demo seeds wrote reservations as guest_name/date/time, PRs as
    `converted_to_po` and anomalies as high/medium/low; the API and pages read customer_name/reservation_date/reservation_time and
    `converted` (procurement_service), so those rows showed blank names and an empty "Converted" tab.
    """
    db = get_db()
    renames = {"guest_name": "customer_name", "guest_phone": "customer_phone", "guest_email": "customer_email",
               "date": "reservation_date", "time": "reservation_time"}
    n = 0
    for old, new in renames.items():
        r = await db.reservations.update_many(
            {old: {"$exists": True}, new: {"$exists": False}}, {"$rename": {old: new}})
        n = max(n, r.modified_count)
    p = await db.purchase_requests.update_many({"status": "converted_to_po"}, {"$set": {"status": "converted"}})
    # anomaly detectors emit severe/mild; old seeds wrote high/medium/low (filters & counters saw 0)
    a = 0
    for old_sev, new_sev in (("critical", "severe"), ("high", "severe"), ("medium", "mild"), ("low", "mild")):
        a += (await db.anomaly_events.update_many({"severity": old_sev}, {"$set": {"severity": new_sev}})).modified_count
    res = {"reservations": n, "purchase_requests": p.modified_count, "anomaly_events": a}
    if any(res.values()):
        logger.info("legacy seed field names normalized: %s", res)
    return res
