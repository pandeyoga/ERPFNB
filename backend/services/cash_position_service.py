"""Phase 11B — Cash Position service.

Manages liquid asset master (cash_accounts) + balance snapshots + aggregated
position with projection (AP-out, AR-in) for the Owner Cockpit.
"""
import csv
import io
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from core.db import get_db, serialize
from core.exceptions import NotFoundError, ValidationError
from services.cache_service import cache_or_compute, cache_invalidate

logger = logging.getLogger("aurora.cash_position")

VALID_TYPES = ("bank", "petty_cash", "ewallet", "other")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _doc(extra: dict | None = None) -> dict:
    base = {
        "id": str(uuid.uuid4()),
        "created_at": _now(),
        "updated_at": _now(),
        "deleted_at": None,
        "is_active": True,
    }
    if extra:
        base.update(extra)
    return base


# ====================== CASH ACCOUNT CRUD ======================

async def list_accounts(
    *, account_type: Optional[str] = None, outlet_id: Optional[str] = None,
    brand_id: Optional[str] = None, active: Optional[bool] = True,
) -> list[dict]:
    db = get_db()
    q: dict = {"deleted_at": None}
    if account_type:
        q["type"] = account_type
    if outlet_id:
        q["outlet_id"] = outlet_id
    if brand_id:
        q["brand_id"] = brand_id
    if active is not None:
        q["is_active"] = active
    # B13 fix: asyncio.gather untuk load accounts + outlets + brands secara paralel
    import asyncio as _aio
    accounts_future = db.cash_accounts.find(q).sort([("type", 1), ("name", 1)]).to_list(500)
    outlet_ids_future = db.outlets.find({"deleted_at": None}, {"id": 1, "name": 1, "_id": 0}).to_list(100)
    brand_ids_future  = db.brands.find({"deleted_at": None},  {"id": 1, "name": 1, "_id": 0}).to_list(20)
    accounts, outlets_all, brands_all = await _aio.gather(
        accounts_future, outlet_ids_future, brand_ids_future
    )
    outlet_map = {o["id"]: o["name"] for o in outlets_all}
    brand_map  = {b["id"]: b["name"] for b in brands_all}
    out = []
    for r in accounts:
        d = serialize(r)
        d["outlet_name"] = outlet_map.get(d.get("outlet_id"))
        d["brand_name"]  = brand_map.get(d.get("brand_id"))
        out.append(d)
    return out


async def get_account(account_id: str) -> dict:
    db = get_db()
    row = await db.cash_accounts.find_one({"id": account_id, "deleted_at": None})
    if not row:
        raise NotFoundError("Cash account tidak ditemukan")
    return serialize(row)


async def create_account(payload: dict, *, user: dict) -> dict:
    db = get_db()
    if not payload.get("name"):
        raise ValidationError("Nama akun wajib diisi", field="name")
    if payload.get("type") not in VALID_TYPES:
        raise ValidationError(
            f"Tipe akun harus salah satu: {', '.join(VALID_TYPES)}", field="type")
    code = payload.get("code") or f"CA-{uuid.uuid4().hex[:6].upper()}"
    # Uniqueness on code
    if await db.cash_accounts.find_one({"code": code, "deleted_at": None}):
        raise ValidationError("Kode akun sudah dipakai", field="code")
    rec = _doc({
        "code": code,
        "name": payload["name"],
        "type": payload["type"],
        "outlet_id": payload.get("outlet_id"),
        "brand_id": payload.get("brand_id"),
        "bank_name": payload.get("bank_name"),
        "bank_account_no": payload.get("bank_account_no"),
        "currency": payload.get("currency", "IDR"),
        "current_balance": float(payload.get("current_balance", 0)),
        "opening_balance": float(payload.get("opening_balance", 0)),
        "last_updated_at": _now(),
        "last_updated_by": user.get("id"),
        "last_reconciled_at": None,
        "notes": payload.get("notes"),
        "linked_coa_id": payload.get("linked_coa_id"),
    })
    await db.cash_accounts.insert_one(rec)
    # Initial snapshot
    await _snapshot(rec["id"], rec["current_balance"], source="opening", user=user)
    await _audit(user, "cash_account.create", rec["id"], rec)
    return serialize(rec)


async def update_account(account_id: str, payload: dict, *, user: dict) -> dict:
    db = get_db()
    existing = await db.cash_accounts.find_one({"id": account_id, "deleted_at": None})
    if not existing:
        raise NotFoundError("Cash account tidak ditemukan")
    update_fields = {}
    for k in ("name", "bank_name", "bank_account_no", "currency", "notes",
              "linked_coa_id", "is_active", "outlet_id", "brand_id"):
        if k in payload:
            update_fields[k] = payload[k]
    if "type" in payload:
        if payload["type"] not in VALID_TYPES:
            raise ValidationError("Tipe akun invalid", field="type")
        update_fields["type"] = payload["type"]
    update_fields["updated_at"] = _now()
    await db.cash_accounts.update_one({"id": account_id}, {"$set": update_fields})
    await _audit(user, "cash_account.update", account_id, update_fields)
    return await get_account(account_id)


async def delete_account(account_id: str, *, user: dict) -> bool:
    db = get_db()
    existing = await db.cash_accounts.find_one({"id": account_id, "deleted_at": None})
    if not existing:
        raise NotFoundError("Cash account tidak ditemukan")
    await db.cash_accounts.update_one(
        {"id": account_id},
        {"$set": {"deleted_at": _now(), "is_active": False, "updated_at": _now()}},
    )
    await _audit(user, "cash_account.delete", account_id, {})
    return True


# ====================== BALANCE UPDATE ======================

async def update_balance(
    account_id: str, balance: float, *, user: dict,
    source: str = "manual", notes: Optional[str] = None,
    attachment_id: Optional[str] = None, recorded_at: Optional[str] = None,
) -> dict:
    db = get_db()
    existing = await db.cash_accounts.find_one({"id": account_id, "deleted_at": None})
    if not existing:
        raise NotFoundError("Cash account tidak ditemukan")
    if balance < 0:
        raise ValidationError("Saldo tidak boleh negatif", field="balance")
    prev = float(existing.get("current_balance", 0))
    delta = balance - prev
    await db.cash_accounts.update_one(
        {"id": account_id},
        {"$set": {
            "current_balance": float(balance),
            "last_updated_at": _now(),
            "last_updated_by": user.get("id"),
            "updated_at": _now(),
        }},
    )
    snap = await _snapshot(
        account_id, balance, source=source, user=user,
        notes=notes, attachment_id=attachment_id, recorded_at=recorded_at,
        delta=delta,
    )
    await _audit(user, "cash_account.balance_update", account_id, {
        "prev": prev, "new": balance, "delta": delta, "source": source,
    })
    # Invalidate cache so next read reflects new balance
    try:
        await cache_invalidate("cash_position")
        await cache_invalidate("cash_projection")
        await cache_invalidate("owner_cockpit")
    except Exception:  # noqa: BLE001
        pass
    return {
        "account_id": account_id,
        "prev_balance": prev,
        "new_balance": balance,
        "delta": delta,
        "snapshot": snap,
    }


async def reconcile_account(account_id: str, *, user: dict) -> dict:
    db = get_db()
    existing = await db.cash_accounts.find_one({"id": account_id, "deleted_at": None})
    if not existing:
        raise NotFoundError("Cash account tidak ditemukan")
    await db.cash_accounts.update_one(
        {"id": account_id},
        {"$set": {
            "last_reconciled_at": _now(),
            "updated_at": _now(),
        }},
    )
    await _audit(user, "cash_account.reconcile", account_id, {})
    return await get_account(account_id)


async def _snapshot(
    account_id: str, balance: float, *, source: str, user: dict,
    notes: Optional[str] = None, attachment_id: Optional[str] = None,
    recorded_at: Optional[str] = None, delta: float = 0,
) -> dict:
    db = get_db()
    rec = {
        "id": str(uuid.uuid4()),
        "cash_account_id": account_id,
        "balance": float(balance),
        "delta": float(delta),
        "recorded_at": recorded_at or _now(),
        "source": source,
        "uploaded_by": user.get("id"),
        "attachment_id": attachment_id,
        "notes": notes,
        "created_at": _now(),
    }
    await db.cash_balance_snapshots.insert_one(rec)
    return serialize(rec)


async def list_history(account_id: str, *, days: int = 30) -> list[dict]:
    db = get_db()
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    rows = await db.cash_balance_snapshots.find({
        "cash_account_id": account_id,
        "recorded_at": {"$gte": since},
    }).sort([("recorded_at", -1)]).to_list(500)
    return [serialize(r) for r in rows]


# ====================== AGGREGATED POSITION ======================

@cache_or_compute("cash_position", ttl_sec=45)
async def compute_position(
    *, outlet_ids: Optional[list[str]] = None,
    brand_ids: Optional[list[str]] = None,
) -> dict:
    """Net liquid cash + breakdown by type, with optional scope filters."""
    db = get_db()
    q: dict = {"deleted_at": None, "is_active": True}
    if outlet_ids:
        q["$or"] = [{"outlet_id": {"$in": outlet_ids}}, {"outlet_id": None}]
    if brand_ids:
        q.setdefault("$or", []).append({"brand_id": {"$in": brand_ids}})
    accounts = await db.cash_accounts.find(q).to_list(500)

    # B2 fix: pre-load all unique outlet IDs to avoid N+1 in loop below
    _all_oids = list({a["outlet_id"] for a in accounts if a.get("outlet_id")})
    _outlets_raw = await db.outlets.find({"id": {"$in": _all_oids}}, {"id": 1, "name": 1, "_id": 0}).to_list(len(_all_oids) + 1) if _all_oids else []
    _outlet_map_cache: dict = {o["id"]: o for o in _outlets_raw}

    by_type: dict = {t: {"total": 0, "count": 0, "accounts": []} for t in VALID_TYPES}
    by_outlet: dict = {}
    total = 0.0

    for a in accounts:
        bal = float(a.get("current_balance", 0))
        total += bal
        t = a.get("type", "other")
        if t not in by_type:
            by_type[t] = {"total": 0, "count": 0, "accounts": []}
        by_type[t]["total"] += bal
        by_type[t]["count"] += 1
        by_type[t]["accounts"].append({
            "id": a["id"], "name": a.get("name"), "balance": bal,
            "last_updated_at": a.get("last_updated_at"),
        })
        oid = a.get("outlet_id")
        if oid:
            if oid not in by_outlet:
                # B2 fix: outlets fetched lazily here (max 5 unique outlets in practice)
                outlet = _outlet_map_cache.get(oid)
                if outlet is None:
                    outlet = await db.outlets.find_one({"id": oid}, {"name": 1})
                    _outlet_map_cache[oid] = outlet
                by_outlet[oid] = {"name": (outlet or {}).get("name", oid),
                                  "total": 0, "count": 0}
            by_outlet[oid]["total"] += bal
            by_outlet[oid]["count"] += 1

    # AP exposure (unpaid ledger entries) — canonical store is `ap_ledgers` (field: balance)
    ap_q: dict = {"status": {"$in": ["open", "partial", "overdue"]}, "deleted_at": None}
    ap_rows = await db.ap_ledgers.find(ap_q, {"balance": 1, "due_date": 1}).to_list(2000)
    ap_total = sum(float(r.get("balance", 0)) for r in ap_rows)

    # 30-day burn rate (avg daily expenses from journal_entries last 30 days)
    cut = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    pipeline = [
        {"$match": {"status": "posted", "entry_date": {"$gte": cut}}},
        {"$unwind": "$lines"},
        {"$lookup": {"from": "chart_of_accounts", "localField": "lines.coa_id",
                     "foreignField": "id", "as": "coa"}},
        {"$match": {"coa.type": "expense"}},
        {"$group": {"_id": None, "total": {"$sum": "$lines.dr"}}},
    ]
    burn_rows = await db.journal_entries.aggregate(pipeline).to_list(1)
    burn_30d = float(burn_rows[0]["total"]) if burn_rows else 0
    daily_burn = burn_30d / 30 if burn_30d else 0
    days_runway = round(total / daily_burn, 1) if daily_burn > 0 else None

    health = "green"
    if days_runway is not None:
        if days_runway < 14:
            health = "red"
        elif days_runway < 45:
            health = "amber"

    return {
        "net_liquid_cash": total,
        "ap_exposure": ap_total,
        "net_after_ap": total - ap_total,
        "daily_burn": daily_burn,
        "burn_30d": burn_30d,
        "days_runway": days_runway,
        "health": health,
        "by_type": by_type,
        "by_outlet": list(by_outlet.values()),
        "account_count": len(accounts),
        "computed_at": _now(),
    }


@cache_or_compute("cash_projection", ttl_sec=60)
async def project_position(*, days: int = 30) -> dict:
    """Project net liquid cash over next N days based on AP due + burn rate.
    AR collection currently mocked-zero (no AR ledger yet beyond petty cash)."""
    pos = await compute_position()
    db = get_db()
    # AP outflow projection by due_date
    today = datetime.now(timezone.utc).date()
    horizon = today + timedelta(days=days)
    ap_rows = await db.ap_ledgers.find({
        "status": {"$in": ["open", "partial", "overdue"]}, "deleted_at": None,
        "due_date": {"$lte": horizon.isoformat()},
    }, {"balance": 1, "due_date": 1}).to_list(5000)
    ap_buckets: dict[str, float] = {}
    for r in ap_rows:
        due = r.get("due_date")
        if not due:
            continue
        ap_buckets[due] = ap_buckets.get(due, 0) + float(r.get("balance", 0))

    # Burn rate flat distribution
    daily_burn = float(pos.get("daily_burn", 0))

    series = []
    running = float(pos["net_liquid_cash"])
    for i in range(days + 1):
        d = today + timedelta(days=i)
        ap_today = ap_buckets.get(d.isoformat(), 0)
        # apply AP outflow
        running -= ap_today
        # apply daily burn (smoothed)
        running -= daily_burn
        series.append({
            "date": d.isoformat(),
            "balance": round(running, 2),
            "ap_outflow": round(ap_today, 2),
            "burn": round(daily_burn, 2),
        })

    end_balance = series[-1]["balance"] if series else pos["net_liquid_cash"]
    return {
        "days": days,
        "start_balance": pos["net_liquid_cash"],
        "end_balance": end_balance,
        "end_change": end_balance - pos["net_liquid_cash"],
        "daily_burn": daily_burn,
        "ap_total": sum(ap_buckets.values()),
        "series": series,
        "health": pos["health"],
        "days_runway": pos["days_runway"],
    }


async def daily_snapshot_all(*, user_id: str = "system") -> dict:
    """Scheduled daily job — take a snapshot of every active account's current balance."""
    db = get_db()
    accounts = await db.cash_accounts.find({"deleted_at": None, "is_active": True}).to_list(500)
    n = 0
    for a in accounts:
        await _snapshot(a["id"], float(a.get("current_balance", 0)),
                        source="daily_auto",
                        user={"id": user_id})
        n += 1
    return {"snapshots_created": n}


# ====================== CSV BULK UPDATE ======================

async def bulk_update_via_csv(file_bytes: bytes, *, user: dict) -> dict:
    """CSV format: account_code,balance,recorded_at(optional ISO),notes(optional).
    Returns a summary with per-row outcome.
    """
    db = get_db()
    text = file_bytes.decode("utf-8-sig", errors="ignore")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames or "account_code" not in reader.fieldnames or "balance" not in reader.fieldnames:
        raise ValidationError(
            "CSV harus memiliki kolom 'account_code' dan 'balance'", field="file")
    summary = {"updated": 0, "skipped": 0, "errors": [], "rows": []}
    for i, row in enumerate(reader, start=2):
        code = (row.get("account_code") or "").strip()
        if not code:
            summary["skipped"] += 1
            summary["errors"].append({"row": i, "reason": "empty account_code"})
            continue
        try:
            balance = float((row.get("balance") or "0").replace(",", "").strip())
        except ValueError:
            summary["skipped"] += 1
            summary["errors"].append({"row": i, "reason": "balance bukan angka"})
            continue
        acc = await db.cash_accounts.find_one({"code": code, "deleted_at": None})
        if not acc:
            summary["skipped"] += 1
            summary["errors"].append({"row": i, "reason": f"account_code {code} tidak ditemukan"})
            continue
        try:
            res = await update_balance(
                acc["id"], balance, user=user, source="csv_upload",
                notes=(row.get("notes") or None),
                recorded_at=(row.get("recorded_at") or None),
            )
            summary["updated"] += 1
            summary["rows"].append({
                "row": i, "code": code, "prev": res["prev_balance"],
                "new": res["new_balance"], "delta": res["delta"],
            })
        except Exception as e:  # noqa: BLE001
            summary["skipped"] += 1
            summary["errors"].append({"row": i, "reason": str(e)})
    return summary


# ====================== AUDIT ======================

async def _audit(user: dict, action: str, entity_id: str, payload: dict) -> None:
    db = get_db()
    await db.audit_log.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": (user or {}).get("id"),
        "user_email": (user or {}).get("email"),
        "action": action,
        "entity_type": "cash_account",
        "entity_id": entity_id,
        "payload": payload,
        "timestamp": _now(),
    })
