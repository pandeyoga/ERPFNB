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
