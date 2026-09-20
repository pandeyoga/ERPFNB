"""Reservation reports for Executive and Finance portals."""
from __future__ import annotations

from datetime import date
from typing import Optional

from core.db import get_db


async def executive_summary(
    *,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    outlet_id: Optional[str] = None,
) -> dict:
    """Aggregated reservation statistics for Executive Portal."""
    db = get_db()
    q: dict = {"deleted_at": None}
    if outlet_id:
        q["outlet_id"] = outlet_id
    if date_from:
        q.setdefault("reservation_date", {})["$gte"] = date_from
    if date_to:
        q.setdefault("reservation_date", {})["$lte"] = date_to

    pipeline = [
        {"$match": q},
        {
            "$group": {
                "_id": "$status",
                "count": {"$sum": 1},
                "total_pax": {"$sum": "$pax"},
            }
        },
    ]
    rows = await db.reservations.aggregate(pipeline).to_list(20)
    by_status = {r["_id"]: {"count": r["count"], "total_pax": r["total_pax"]} for r in rows}

    total = sum(v["count"] for v in by_status.values())
    total_pax = sum(v["total_pax"] for v in by_status.values())

    today = date.today().isoformat()
    upcoming_q = {
        **q,
        "status": {"$in": ["pending", "confirmed"]},
        "reservation_date": {"$gte": today},
    }
    upcoming = await db.reservations.count_documents(upcoming_q)

    outlet_pipeline = [
        {"$match": q},
        {"$group": {
            "_id": "$outlet_id",
            "count": {"$sum": 1},
            "pax": {"$sum": "$pax"},
            "confirmed": {"$sum": {"$cond": [{"$eq": ["$status", "confirmed"]}, 1, 0]}},
            "completed": {"$sum": {"$cond": [{"$eq": ["$status", "completed"]}, 1, 0]}},
        }},
    ]
    outlet_rows = await db.reservations.aggregate(outlet_pipeline).to_list(20)
    outlet_ids = [r["_id"] for r in outlet_rows if r["_id"]]
    outlet_names = {}
    async for o in db.outlets.find({"id": {"$in": outlet_ids}}):
        outlet_names[o["id"]] = o.get("name", o["id"])

    by_outlet = []
    for r in outlet_rows:
        oid = r["_id"]
        by_outlet.append({
            "outlet_id": oid,
            "outlet_name": outlet_names.get(oid, oid),
            "count": r["count"],
            "pax": r["pax"],
            "confirmed": r["confirmed"],
            "completed": r["completed"],
        })
    by_outlet.sort(key=lambda x: x["count"], reverse=True)

    return {
        "total": total,
        "total_pax": total_pax,
        "upcoming": upcoming,
        "by_status": by_status,
        "by_outlet": by_outlet,
        "date_from": date_from,
        "date_to": date_to,
    }


async def finance_deposit_summary(
    *,
    period: Optional[str] = None,
    outlet_id: Optional[str] = None,
) -> dict:
    """Deposit summary for Finance Portal."""
    db = get_db()
    q: dict = {"deleted_at": None}
    if outlet_id:
        q["outlet_id"] = outlet_id
    if period:
        q["reservation_date"] = {
            "$gte": f"{period}-01",
            "$lte": f"{period}-31",
        }

    pipeline = [
        {"$match": q},
        {"$group": {
            "_id": {"outlet_id": "$outlet_id", "deposit_status": "$deposit_status"},
            "count": {"$sum": 1},
            "total_deposit": {"$sum": "$deposit_amount"},
        }},
    ]
    rows = await db.reservations.aggregate(pipeline).to_list(100)

    totals = {"paid": 0.0, "pending": 0.0, "refunded": 0.0, "forfeited": 0.0, "none": 0.0}
    by_outlet: dict[str, dict] = {}
    outlet_ids = set()
    for r in rows:
        oid = r["_id"]["outlet_id"]
        ds = r["_id"]["deposit_status"]
        amt = r["total_deposit"]
        totals[ds] = totals.get(ds, 0) + amt
        outlet_ids.add(oid)
        if oid not in by_outlet:
            by_outlet[oid] = {"outlet_id": oid, "outlet_name": oid, "paid": 0, "pending": 0, "refunded": 0, "forfeited": 0, "count": 0}
        by_outlet[oid][ds] = by_outlet[oid].get(ds, 0) + amt
        by_outlet[oid]["count"] += r["count"]

    async for o in db.outlets.find({"id": {"$in": list(outlet_ids)}}):
        if o["id"] in by_outlet:
            by_outlet[o["id"]]["outlet_name"] = o.get("name", o["id"])

    return {
        "period": period,
        "outlet_id": outlet_id,
        "totals": totals,
        "total_amount": sum(totals.values()),
        "by_outlet": list(by_outlet.values()),
    }
