"""Phase 11C — Owner Daily Digest service.

Builds + dispatches the daily owner digest:
  - Yesterday's revenue per outlet
  - MTD vs target  - AP due this week
  - Top anomalies last 24h
  - Pending approvals count

Channels: telegram, in-app (notifications). Email is a future stub.
"""
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from core.db import get_db, serialize
from services import telegram_service, whatsapp_service, email_service
from services.cache_service import cache_or_compute

logger = logging.getLogger("aurora.owner_digest")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ====================== SUBSCRIPTION CRUD ======================

async def list_subscriptions(user_id: str) -> list[dict]:
    db = get_db()
    rows = await db.digest_subscriptions.find({
        "user_id": user_id, "deleted_at": None,
    }).to_list(50)
    return [serialize(r) for r in rows]


async def upsert_subscription(
    user_id: str, *, channel: str, target: str,
    enabled: bool = True, schedule_cron: str = "0 6 * * *",
) -> dict:
    db = get_db()
    if channel not in ("telegram", "email", "inapp", "whatsapp"):
        from core.exceptions import ValidationError
        raise ValidationError(
            "Channel harus telegram | whatsapp | email | inapp", field="channel")
    existing = await db.digest_subscriptions.find_one({
        "user_id": user_id, "channel": channel, "deleted_at": None,
    })
    if existing:
        await db.digest_subscriptions.update_one(
            {"id": existing["id"]},
            {"$set": {
                "target": target,
                "enabled": enabled,
                "schedule_cron": schedule_cron,
                "updated_at": _now(),
            }},
        )
        return await get_subscription(existing["id"])
    rec = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "channel": channel,
        "target": target,
        "enabled": enabled,
        "schedule_cron": schedule_cron,
        "last_sent_at": None,
        "registered_at": _now(),
        "created_at": _now(),
        "updated_at": _now(),
        "deleted_at": None,
    }
    await db.digest_subscriptions.insert_one(rec)
    return serialize(rec)


async def get_subscription(sub_id: str) -> Optional[dict]:
    db = get_db()
    row = await db.digest_subscriptions.find_one({"id": sub_id, "deleted_at": None})
    return serialize(row) if row else None


async def delete_subscription(sub_id: str, user_id: str) -> bool:
    db = get_db()
    res = await db.digest_subscriptions.update_one(
        {"id": sub_id, "user_id": user_id, "deleted_at": None},
        {"$set": {"deleted_at": _now(), "enabled": False, "updated_at": _now()}},
    )
    return res.modified_count > 0


# ====================== DIGEST BUILDER ======================

@cache_or_compute("owner_digest_payload", ttl_sec=45)
async def build_digest_payload(user: dict | None = None) -> dict:
    """Aggregate yesterday's stats + MTD + alerts into a structured payload."""
    db = get_db()
    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)
    month_start = today.replace(day=1)
    week_end = today + timedelta(days=7)

    # 1) Yesterday revenue per outlet
    sales_pipeline = [
        {"$match": {"sales_date": yesterday.isoformat(), "status": "validated"}},
        {"$group": {"_id": "$outlet_id",
                     "revenue": {"$sum": "$grand_total"},
                     "transactions": {"$sum": "$transactions_count"}}},
    ]
    yesterday_rows = await db.daily_sales.aggregate(sales_pipeline).to_list(100)
    yesterday_total = sum(float(r["revenue"] or 0) for r in yesterday_rows)
    outlet_map = {}
    async for o in db.outlets.find({"deleted_at": None}, {"name": 1, "id": 1}):
        outlet_map[o["id"]] = o.get("name", "-")
    yesterday_by_outlet = []
    for r in yesterday_rows:
        yesterday_by_outlet.append({
            "outlet_id": r["_id"],
            "outlet_name": outlet_map.get(r["_id"], "-"),
            "revenue": float(r["revenue"] or 0),
            "transactions": int(r.get("transactions", 0) or 0),
        })
    yesterday_by_outlet.sort(key=lambda x: x["revenue"], reverse=True)

    # 2) MTD
    mtd_rows = await db.daily_sales.aggregate([
        {"$match": {"sales_date": {"$gte": month_start.isoformat(),
                                     "$lte": today.isoformat()},
                     "status": "validated"}},
        {"$group": {"_id": None, "revenue": {"$sum": "$grand_total"}}}
    ]).to_list(1)
    mtd_revenue = float(mtd_rows[0]["revenue"]) if mtd_rows else 0

    # 3) AP due this week — canonical store is `ap_ledgers` (field: balance)
    ap_due_rows = await db.ap_ledgers.find({
        "status": {"$in": ["open", "partial", "overdue"]}, "deleted_at": None,
        "due_date": {"$lte": week_end.isoformat()},
    }, {"vendor_id": 1, "balance": 1, "due_date": 1}).to_list(500)
    ap_due_total = sum(float(r.get("balance", 0) or 0) for r in ap_due_rows)

    # 4) Anomalies last 24h
    cut_24h = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    anomaly_rows = await db.anomaly_events.find({
        "detected_at": {"$gte": cut_24h},
        "status": {"$ne": "resolved"},
    }, {"type": 1, "severity": 1, "description": 1, "detected_at": 1}).sort([("detected_at", -1)]).to_list(20)
    anomaly_count = len(anomaly_rows)
    anomaly_severe = sum(1 for r in anomaly_rows if r.get("severity") == "severe")

    # 5) Pending approvals (assigned to user; if user None just count all open)
    pending_q = {"status": "pending", "deleted_at": None}
    if user and user.get("id"):
        pending_q["approver_user_id"] = user["id"]
    pending_count = await db.approval_steps.count_documents(pending_q)

    # 6) Cash position snapshot
    cash_total = 0.0
    async for a in db.cash_accounts.find({"deleted_at": None, "is_active": True},
                                            {"current_balance": 1}):
        cash_total += float(a.get("current_balance", 0) or 0)

    return {
        "date": today.isoformat(),
        "yesterday": yesterday.isoformat(),
        "yesterday_total": yesterday_total,
        "yesterday_by_outlet": yesterday_by_outlet,
        "mtd_revenue": mtd_revenue,
        "mtd_period": today.strftime("%Y-%m"),
        "ap_due_total": ap_due_total,
        "ap_due_count": len(ap_due_rows),
        "anomaly_count": anomaly_count,
        "anomaly_severe": anomaly_severe,
        "anomalies": [serialize(r) for r in anomaly_rows[:5]],
        "pending_approvals": pending_count,
        "cash_total": cash_total,
        "computed_at": _now(),
    }


def render_telegram_text(payload: dict) -> str:
    """Format digest as Telegram Markdown."""
    def fmt_rp(v):
        return f"Rp {int(v):,}".replace(",", ".")
    
    lines = []
    lines.append("*🌅 FnB Group — Daily Digest*")
    lines.append(f"_{payload['yesterday']}_\n")
    lines.append(f"💵 *Cash Position:* {fmt_rp(payload['cash_total'])}")
    lines.append(f"💰 *Revenue Kemarin:* {fmt_rp(payload['yesterday_total'])}")
    if payload["yesterday_by_outlet"]:
        lines.append("")
        lines.append("*Per Outlet:*")
        for o in payload["yesterday_by_outlet"][:6]:
            lines.append(f"  • {o['outlet_name']}: {fmt_rp(o['revenue'])} ({o['transactions']} txn)")
    lines.append("")
    lines.append(f"📊 *MTD:* {fmt_rp(payload['mtd_revenue'])}")
    lines.append(f"📋 *AP jatuh tempo 7 hari:* {fmt_rp(payload['ap_due_total'])} ({payload['ap_due_count']} invoice)")
    lines.append(f"⏳ *Pending approvals:* {payload['pending_approvals']}")
    if payload["anomaly_count"]:
        lines.append(f"⚠️ *Anomalies 24h:* {payload['anomaly_count']} ({payload['anomaly_severe']} severe)")
        for a in payload.get("anomalies", [])[:3]:
            lines.append(f"  • _{a.get('type')}_: {a.get('description', '-')[:80]}")
    else:
        lines.append("✅ Tidak ada anomaly 24 jam terakhir")
    lines.append("")
    lines.append("_Sent by FnB Group Owner Digest_")
    return "\n".join(lines)


def render_inapp(payload: dict) -> dict:
    def fmt_rp(v):
        return f"Rp {int(v):,}".replace(",", ".")
    
    return {
        "title": f"\U0001f305 Daily Digest \u2014 {payload['yesterday']}",
        "body": (
            f"Cash {fmt_rp(payload['cash_total'])} | "
            f"Revenue kemarin {fmt_rp(payload['yesterday_total'])} | "
            f"MTD {fmt_rp(payload['mtd_revenue'])} | "
            f"AP 7d {fmt_rp(payload['ap_due_total'])} | "
            f"Pending approval {payload['pending_approvals']} | "
            f"Anomalies {payload['anomaly_count']}"
        ),
        "link": "/owner/cockpit",
    }


def render_whatsapp_text(payload: dict) -> str:
    """Format digest as plain-text for WhatsApp (no markdown)."""
    def fmt_rp(v):
        return f"Rp {int(v):,}".replace(",", ".")
    
    lines = []
    lines.append(f"*FnB Group \u2014 Daily Digest*\n_{payload['yesterday']}_\n")
    lines.append(f"\U0001f4b5 Cash Position: {fmt_rp(payload['cash_total'])}")
    lines.append(f"\U0001f4b0 Revenue Kemarin: {fmt_rp(payload['yesterday_total'])}")
    if payload["yesterday_by_outlet"]:
        lines.append("\n*Per Outlet:*")
        for o in payload["yesterday_by_outlet"][:6]:
            lines.append(f"  - {o['outlet_name']}: {fmt_rp(o['revenue'])} ({o['transactions']} txn)")
    lines.append(f"\n\U0001f4c8 MTD: {fmt_rp(payload['mtd_revenue'])}")
    lines.append(f"\U0001f4cb AP 7d: {fmt_rp(payload['ap_due_total'])} ({payload['ap_due_count']} inv)")
    lines.append(f"\u23f3 Pending: {payload['pending_approvals']}")
    if payload["anomaly_count"]:
        lines.append(f"\u26a0\ufe0f Anomalies: {payload['anomaly_count']} ({payload['anomaly_severe']} severe)")
    else:
        lines.append("\u2705 No anomaly")
    return "\n".join(lines)


def render_email_html(payload: dict) -> tuple[str, str]:
    """Return (subject, html) for the digest email."""
    fmt_rp = lambda v: f"Rp {int(v):,}".replace(",", ".")
    subject = f"FnB Group \u2014 Daily Digest {payload['yesterday']}"
    html = f"""
    <div style="font-family:system-ui,Segoe UI,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#0f172a">
      <h2 style="margin:0 0 6px">\U0001f305 FnB Group \u2014 Daily Digest</h2>
      <div style="color:#64748b;margin-bottom:16px">{payload['yesterday']}</div>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:6px 0">\U0001f4b5 Cash Position</td><td style="text-align:right"><b>{fmt_rp(payload['cash_total'])}</b></td></tr>
        <tr><td style="padding:6px 0">\U0001f4b0 Revenue Kemarin</td><td style="text-align:right"><b>{fmt_rp(payload['yesterday_total'])}</b></td></tr>
        <tr><td style="padding:6px 0">\U0001f4c8 MTD Revenue</td><td style="text-align:right"><b>{fmt_rp(payload['mtd_revenue'])}</b></td></tr>
        <tr><td style="padding:6px 0">\U0001f4cb AP 7d</td><td style="text-align:right">{fmt_rp(payload['ap_due_total'])} ({payload['ap_due_count']} inv)</td></tr>
        <tr><td style="padding:6px 0">\u23f3 Pending Approvals</td><td style="text-align:right">{payload['pending_approvals']}</td></tr>
        <tr><td style="padding:6px 0">\u26a0\ufe0f Anomalies (24h)</td><td style="text-align:right">{payload['anomaly_count']} ({payload['anomaly_severe']} severe)</td></tr>
      </table>
      <div style="margin-top:16px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b">
        Sent by FnB Group Owner Digest. Manage subscription at /owner/digest-settings.
      </div>
    </div>
    """
    return subject, html


# ====================== DISPATCH ======================

async def send_digest_to_user(user: dict) -> dict:
    """Build digest + send to all active subscriptions of the user."""
    db = get_db()
    payload = await build_digest_payload(user)
    subs = await list_subscriptions(user["id"])
    if not subs:
        # Fallback: in-app notification anyway
        inapp = render_inapp(payload)
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "type": "owner_digest",
            "title": inapp["title"],
            "body": inapp["body"],
            "link": inapp["link"],
            "read_at": None,
            "created_at": _now(),
        })
        await _log_digest(user["id"], "inapp", "sent", payload)
        return {"sent": 1, "channels": ["inapp"]}

    sent_channels = []
    text = render_telegram_text(payload)
    inapp = render_inapp(payload)
    wa_text = render_whatsapp_text(payload)
    email_subject, email_html = render_email_html(payload)
    for sub in subs:
        if not sub.get("enabled"):
            continue
        ch = sub["channel"]
        if ch == "telegram":
            res = await telegram_service.send_message(sub["target"], text)
            await _log_digest(user["id"], "telegram", "sent" if res.get("sent") else "failed", payload, target=sub["target"], detail=res)
            if res.get("sent"):
                sent_channels.append("telegram")
        elif ch == "whatsapp":
            res = await whatsapp_service.send_message(sub["target"], wa_text)
            await _log_digest(user["id"], "whatsapp", "sent" if res.get("sent") else "failed", payload, target=sub["target"], detail=res)
            if res.get("sent"):
                sent_channels.append("whatsapp")
        elif ch == "inapp":
            await db.notifications.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "type": "owner_digest",
                "title": inapp["title"],
                "body": inapp["body"],
                "link": inapp["link"],
                "read_at": None,
                "created_at": _now(),
            })
            await _log_digest(user["id"], "inapp", "sent", payload)
            sent_channels.append("inapp")
        elif ch == "email":
            target = sub.get("target") or user.get("email")
            if not target:
                await _log_digest(user["id"], "email", "skipped_no_target", payload)
            elif not (await email_service.is_real_provider_configured_async()):
                await _log_digest(user["id"], "email", "skipped_no_provider", payload, target=target)
            else:
                res = await email_service.send_email(
                    to=[target], subject=email_subject, html=email_html,
                )
                ok = res.get("status") == "sent"
                await _log_digest(user["id"], "email", "sent" if ok else "failed", payload, target=target, detail=res)
                if ok:
                    sent_channels.append("email")
        # Update last_sent
        await db.digest_subscriptions.update_one(
            {"id": sub["id"]},
            {"$set": {"last_sent_at": _now()}},
        )
    return {"sent": len(sent_channels), "channels": sent_channels}


async def send_digest_to_all_subscribers() -> dict:
    """Scheduler entry point. Iterates over distinct user_ids with active subs.
    B10 fix: batch-load user docs (was N+1 find_one per uid in loop).
    """
    db = get_db()
    user_ids = await db.digest_subscriptions.distinct(
        "user_id", {"enabled": True, "deleted_at": None})
    # Batch-load all subscriber users in one query
    users_raw = await db.users.find(
        {"id": {"$in": user_ids}, "deleted_at": None, "status": "active"}
    ).to_list(len(user_ids) + 1) if user_ids else []
    users_map = {u["id"]: u for u in users_raw}
    sent_total = 0
    for uid in user_ids:
        u = users_map.get(uid)
        if not u:
            continue
        try:
            res = await send_digest_to_user(u)
            sent_total += res.get("sent", 0)
        except Exception:  # noqa: BLE001
            logger.exception(f"send_digest_to_user failed for user {uid}")
    return {"users": len(user_ids), "sends_total": sent_total}


async def _log_digest(user_id: str, channel: str, status: str,
                       payload: dict, *, target: str | None = None,
                       detail: dict | None = None) -> None:
    db = get_db()
    await db.digest_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "channel": channel,
        "status": status,
        "target": target,
        "summary": {
            "yesterday_total": payload["yesterday_total"],
            "mtd_revenue": payload["mtd_revenue"],
            "ap_due_total": payload["ap_due_total"],
            "anomaly_count": payload["anomaly_count"],
        },
        "detail": detail,
        "sent_at": _now(),
    })
