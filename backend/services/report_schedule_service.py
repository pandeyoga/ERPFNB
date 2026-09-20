"""Scheduled Reports Engine — Sprint E Phase 1.

Manages user-defined report schedules + dispatch via Email/WhatsApp/Telegram.

Report types supported:
  - owner_daily_digest        : Sales summary + anomalies for Owner (daily)
  - finance_ap_aging_weekly   : AP aging summary for Finance Manager (weekly)
  - exec_weekly_performance   : This week vs last week for Executive (weekly)
  - finance_daily_validation  : Pending validation queue reminder (daily)

Channels: email | telegram | whatsapp
Frequency: daily | weekly
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone, date, timedelta
from typing import Optional

from core.db import get_db, serialize

logger = logging.getLogger("aurora.report_schedule")


# ──────────────────────────────────────────
# 1. CONSTANTS
# ──────────────────────────────────────────

REPORT_TYPES = [
    {
        "id": "owner_daily_digest",
        "name": "Owner Daily Digest",
        "description": "Ringkasan penjualan harian, top outlet, dan anomali untuk Owner.",
        "default_frequency": "daily",
        "default_time": "07:00",
        "audience": ["owner"],
    },
    {
        "id": "finance_ap_aging_weekly",
        "name": "Finance AP Aging Summary",
        "description": "Ringkasan AP aging (overdue invoices) untuk Finance Manager setiap minggu.",
        "default_frequency": "weekly",
        "default_time": "08:00",
        "audience": ["finance_manager"],
    },
    {
        "id": "exec_weekly_performance",
        "name": "Executive Weekly Performance",
        "description": "Perbandingan performa minggu ini vs minggu lalu untuk Executive.",
        "default_frequency": "weekly",
        "default_time": "08:30",
        "audience": ["executive"],
    },
    {
        "id": "finance_daily_validation",
        "name": "Daily Validation Reminder",
        "description": "Pengingat antrean validasi sales yang belum diproses untuk Finance.",
        "default_frequency": "daily",
        "default_time": "09:00",
        "audience": ["finance_manager"],
    },
]

REPORT_TYPE_IDS = {rt["id"] for rt in REPORT_TYPES}


# ──────────────────────────────────────────
# 2. PAYLOAD BUILDERS
# ──────────────────────────────────────────

async def _build_owner_daily_digest() -> dict:
    """Build owner daily digest payload."""
    db = get_db()
    today = date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()

    # Sales yesterday
    sales_pipeline = [
        {"$match": {"date": yesterday}},
        {"$group": {
            "_id": "$outlet_id",
            "total": {"$sum": "$total_revenue"},
            "covers": {"$sum": "$covers"},
        }},
        {"$sort": {"total": -1}},
    ]
    sales_agg = await db["daily_sales"].aggregate(sales_pipeline).to_list(10)
    total_sales = sum(s["total"] for s in sales_agg)

    # Active anomalies
    open_anomalies = await db["anomaly_events"].count_documents({"status": "open"})
    severe_anomalies = await db["anomaly_events"].count_documents({"status": "open", "severity": "severe"})

    # Pending approvals
    pending = await db["approval_steps"].count_documents({"status": "pending"})

    # Format outlet summary
    outlet_lines = []
    for s in sales_agg[:5]:
        outlet = await db["outlets"].find_one({"id": s["_id"]})
        name = (outlet or {}).get("name", s["_id"] or "Unknown")
        outlet_lines.append(f"  {name}: Rp {s['total']:,.0f} ({s['covers']} covers)")

    text = (
        f"📊 *FnB ERP Daily Digest — {yesterday}*\n\n"
        f"💰 Total Penjualan: Rp {total_sales:,.0f}\n"
        f"🏪 Outlet aktif kemarin: {len(sales_agg)}\n"
        + ("\n".join(outlet_lines) + "\n" if outlet_lines else "")
        + f"\n⚠️  Anomali terbuka: {open_anomalies} ({severe_anomalies} severe)\n"
        f"📋 Persetujuan tertunda: {pending}\n\n"
        f"Lihat detail di FnB Group ERP → Owner Cockpit"
    )
    html = f"""<div style='font-family:sans-serif;max-width:600px'>
<h2 style='color:#1C1510'>Daily Digest — {yesterday}</h2>
<p><strong>Total Penjualan:</strong> Rp {total_sales:,.0f}</p>
<p><strong>Outlet aktif:</strong> {len(sales_agg)}</p>
<ul>{''.join(f'<li>{l.strip()}</li>' for l in outlet_lines)}</ul>
<p><strong>Anomali terbuka:</strong> {open_anomalies} ({severe_anomalies} severe)</p>
<p><strong>Persetujuan tertunda:</strong> {pending}</p>
<p><a href='/owner'>Buka FnB ERP Owner Cockpit →</a></p>
</div>"""
    return {
        "subject": f"FnB ERP Daily Digest — {yesterday}",
        "text": text,
        "html": html,
        "stats": {"total_sales": total_sales, "outlets": len(sales_agg), "anomalies": open_anomalies},
    }


async def _build_finance_ap_aging_weekly() -> dict:
    """Build finance AP aging weekly summary."""
    db = get_db()
    today_dt = datetime.now(timezone.utc).date()
    today = today_dt.isoformat()

    # AP invoices — group by aging bucket
    buckets = {"current": 0, "30": 0, "60": 0, "90": 0, "120plus": 0}
    total_outstanding = 0.0
    overdue_count = 0

    # AP subledger — canonical collection is `ap_ledgers` (NOT legacy `ap_invoices`,
    # which is empty). Remaining outstanding is the ledger `balance` field.
    async for inv in db["ap_ledgers"].find(
        {"status": {"$in": ["open", "partial", "overdue"]}, "deleted_at": None}
    ):
        remaining = float(inv.get("balance", 0) or 0)
        if remaining <= 0:
            # Fallback for ledgers that track amount/paid instead of a balance field.
            remaining = float(inv.get("amount", 0) or 0) - float(inv.get("paid_amount", 0) or 0)
        if remaining <= 0:
            continue
        due_date_str = inv.get("due_date") or inv.get("invoice_date")
        days_overdue = 0
        if due_date_str:
            try:
                due_dt = datetime.strptime(due_date_str[:10], "%Y-%m-%d").date()
                days_overdue = (today_dt - due_dt).days
            except Exception:
                pass
        total_outstanding += remaining
        if days_overdue > 0:
            overdue_count += 1
        if days_overdue <= 0:
            buckets["current"] += remaining
        elif days_overdue <= 30:
            buckets["30"] += remaining
        elif days_overdue <= 60:
            buckets["60"] += remaining
        elif days_overdue <= 90:
            buckets["90"] += remaining
        else:
            buckets["120plus"] += remaining

    text = (
        f"📊 *AP Aging Summary — Minggu {today}*\n\n"
        f"💳 Total Outstanding: Rp {total_outstanding:,.0f}\n"
        f"⚠️  Invoice overdue: {overdue_count}\n\n"
        f"Aging Breakdown:\n"
        f"  Current: Rp {buckets['current']:,.0f}\n"
        f"  1–30 hari: Rp {buckets['30']:,.0f}\n"
        f"  31–60 hari: Rp {buckets['60']:,.0f}\n"
        f"  61–90 hari: Rp {buckets['90']:,.0f}\n"
        f"  >90 hari: Rp {buckets['120plus']:,.0f}\n\n"
        f"Lihat detail di FnB Group ERP → Finance → AP Aging"
    )
    html = f"""<div style='font-family:sans-serif;max-width:600px'>
<h2 style='color:#1C1510'>AP Aging Summary — {today}</h2>
<p><strong>Total Outstanding:</strong> Rp {total_outstanding:,.0f} ({overdue_count} overdue)</p>
<table border='1' cellpadding='6' style='border-collapse:collapse;width:100%'>
<tr style='background:#f0f0f0'><th>Aging</th><th>Amount</th></tr>
<tr><td>Current</td><td>Rp {buckets['current']:,.0f}</td></tr>
<tr><td>1–30 hari</td><td>Rp {buckets['30']:,.0f}</td></tr>
<tr><td>31–60 hari</td><td>Rp {buckets['60']:,.0f}</td></tr>
<tr><td>61–90 hari</td><td>Rp {buckets['90']:,.0f}</td></tr>
<tr><td>&gt;90 hari</td><td style='color:red'>Rp {buckets['120plus']:,.0f}</td></tr>
</table>
<p><a href='/finance/ap-aging'>Buka FnB ERP Finance → AP Aging →</a></p>
</div>"""
    return {
        "subject": f"AP Aging Weekly — {today}",
        "text": text,
        "html": html,
        "stats": buckets,
    }


async def _build_exec_weekly_performance() -> dict:
    """Build executive weekly performance summary (this week vs last week)."""
    db = get_db()
    today_dt = date.today()
    # This week: Mon–today
    days_since_monday = today_dt.weekday()
    week_start = today_dt - timedelta(days=days_since_monday)
    prev_week_start = week_start - timedelta(weeks=1)
    prev_week_end = week_start - timedelta(days=1)

    async def week_sales(start: date, end: date) -> float:
        pipeline = [
            {"$match": {"date": {"$gte": start.isoformat(), "$lte": end.isoformat()}}},
            {"$group": {"_id": None, "total": {"$sum": "$total_revenue"}}},
        ]
        res = await db["daily_sales"].aggregate(pipeline).to_list(1)
        return float((res[0] if res else {}).get("total", 0))

    this_week_sales = await week_sales(week_start, today_dt)
    last_week_sales = await week_sales(prev_week_start, prev_week_end)
    change_pct = ((this_week_sales - last_week_sales) / last_week_sales * 100) if last_week_sales > 0 else 0
    direction = "▲" if change_pct >= 0 else "▼"

    # Open anomalies
    open_anomalies = await db["anomaly_events"].count_documents({"status": "open", "severity": "severe"})

    text = (
        f"📊 *Executive Weekly — Pekan {week_start.strftime('%d %b')} – {today_dt.strftime('%d %b %Y')}*\n\n"
        f"💰 Sales minggu ini: Rp {this_week_sales:,.0f}\n"
        f"📊 Sales minggu lalu: Rp {last_week_sales:,.0f}\n"
        f"{direction} Perubahan: {change_pct:+.1f}%\n\n"
        f"🔴 Anomali severe terbuka: {open_anomalies}\n\n"
        f"Lihat detail di FnB Group ERP → Executive Dashboard"
    )
    html = f"""<div style='font-family:sans-serif;max-width:600px'>
<h2>Weekly Performance Report</h2>
<p><strong>Periode:</strong> {week_start.strftime('%d %b')} – {today_dt.strftime('%d %b %Y')}</p>
<p><strong>Sales minggu ini:</strong> Rp {this_week_sales:,.0f}</p>
<p><strong>Sales minggu lalu:</strong> Rp {last_week_sales:,.0f}</p>
<p><strong>Perubahan:</strong> <span style='color:{"green" if change_pct>=0 else "red"}'>{change_pct:+.1f}%</span></p>
<p><strong>Anomali severe:</strong> {open_anomalies}</p>
<p><a href='/executive'>Buka FnB ERP Executive Dashboard →</a></p>
</div>"""
    return {
        "subject": f"FnB ERP Weekly Performance — {week_start.strftime('%d %b')}–{today_dt.strftime('%d %b')}",
        "text": text,
        "html": html,
        "stats": {"this_week": this_week_sales, "last_week": last_week_sales, "change_pct": change_pct},
    }


async def _build_finance_daily_validation() -> dict:
    """Build daily validation reminder for Finance team."""
    db = get_db()
    pending_sales = await db["daily_sales"].count_documents({"status": "pending_validation", "deleted_at": None})
    today = date.today().isoformat()
    text = (
        f"📋 *Validation Reminder — {today}*\n\n"
        f"Ada {pending_sales} Daily Sales yang menunggu validasi.\n\n"
        f"Segera proses di FnB Group ERP → Finance → Validation Queue."
    )
    html = f"""<div style='font-family:sans-serif;max-width:600px'>
<h2>Validation Queue Reminder — {today}</h2>
<p>Ada <strong>{pending_sales}</strong> Daily Sales menunggu validasi.</p>
<p><a href='/finance/validation'>Buka Validation Queue →</a></p>
</div>"""
    return {
        "subject": f"FnB ERP Validation Reminder — {today} ({pending_sales} pending)",
        "text": text,
        "html": html,
        "stats": {"pending_sales": pending_sales},
    }


PAYLOAD_BUILDERS = {
    "owner_daily_digest": _build_owner_daily_digest,
    "finance_ap_aging_weekly": _build_finance_ap_aging_weekly,
    "exec_weekly_performance": _build_exec_weekly_performance,
    "finance_daily_validation": _build_finance_daily_validation,
}


async def build_payload(report_type: str) -> dict:
    builder = PAYLOAD_BUILDERS.get(report_type)
    if not builder:
        return {"subject": report_type, "text": "Report unavailable.", "html": "<p>Report unavailable.</p>", "stats": {}}
    return await builder()


# ──────────────────────────────────────────
# 3. DISPATCH
# ──────────────────────────────────────────

async def dispatch_schedule(schedule: dict) -> dict:
    """Execute a single schedule: build payload + send via channel. Returns log entry."""
    log: dict = {
        "id": str(uuid.uuid4()),
        "schedule_id": schedule["id"],
        "report_type": schedule["report_type"],
        "channel": schedule["channel"],
        "started_at": datetime.now(timezone.utc).isoformat(),
        "status": "unknown",
        "error": None,
        "stats": {},
    }
    try:
        payload = await build_payload(schedule["report_type"])
        log["stats"] = payload.get("stats", {})
        recipients = schedule.get("recipients") or []
        channel = schedule.get("channel", "email")
        sent = 0

        if channel == "email":
            from services.email_service import send_email
            for to_addr in recipients:
                result = await send_email(
                    to=to_addr,
                    subject=payload["subject"],
                    html=payload.get("html", payload["text"]),
                    text=payload["text"],
                )
                if result.get("status") not in ("error",):
                    sent += 1
        elif channel == "telegram":
            from services.telegram_service import send_message as tg_send
            for chat_id in recipients:
                result = await tg_send(chat_id, payload["text"], parse_mode="Markdown")
                if result.get("ok"):
                    sent += 1
        elif channel == "whatsapp":
            from services.whatsapp_service import send_message as wa_send
            for phone in recipients:
                result = await wa_send(phone, payload["text"])
                if result.get("status") not in ("error",):
                    sent += 1

        log["status"] = "sent" if sent > 0 else "not_configured"
        log["recipients_sent"] = sent
        log["recipients_total"] = len(recipients)
    except Exception as exc:
        logger.exception(f"dispatch_schedule {schedule['id']} error: {exc}")
        log["status"] = "error"
        log["error"] = str(exc)

    log["finished_at"] = datetime.now(timezone.utc).isoformat()
    db = get_db()
    await db.report_schedule_runs.insert_one({k: v for k, v in log.items() if k != "_id"})
    return log


# ──────────────────────────────────────────
# 4. SCHEDULE CRUD
# ──────────────────────────────────────────

async def list_schedules(enabled_only: bool = False) -> list[dict]:
    db = get_db()
    q: dict = {}
    if enabled_only:
        q["enabled"] = True
    items = await db.report_schedules.find(q).sort("created_at", -1).to_list(100)
    return [serialize(i) for i in items]


async def get_schedule(schedule_id: str) -> Optional[dict]:
    db = get_db()
    doc = await db.report_schedules.find_one({"id": schedule_id})
    return serialize(doc) if doc else None


async def create_schedule(data: dict, user_id: str) -> dict:
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "report_type": data["report_type"],
        "name": data.get("name") or next(
            (rt["name"] for rt in REPORT_TYPES if rt["id"] == data["report_type"]), data["report_type"]
        ),
        "frequency": data.get("frequency", "daily"),  # daily | weekly
        "run_time": data.get("run_time", "07:00"),    # HH:MM WIB
        "day_of_week": data.get("day_of_week"),        # 0=Monday..6=Sunday (weekly only)
        "channel": data.get("channel", "email"),
        "recipients": data.get("recipients", []),
        "enabled": data.get("enabled", True),
        "created_by": user_id,
        "created_at": now,
        "updated_at": now,
        "last_run_at": None,
        "last_status": None,
    }
    await db.report_schedules.insert_one(doc)
    return serialize(doc)


async def update_schedule(schedule_id: str, data: dict) -> Optional[dict]:
    db = get_db()
    allowed = {"name", "frequency", "run_time", "day_of_week", "channel", "recipients", "enabled", "report_type"}
    updates = {k: v for k, v in data.items() if k in allowed}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.report_schedules.find_one_and_update(
        {"id": schedule_id},
        {"$set": updates},
        return_document=True,
    )
    return serialize(res) if res else None


async def delete_schedule(schedule_id: str) -> bool:
    db = get_db()
    res = await db.report_schedules.delete_one({"id": schedule_id})
    return res.deleted_count > 0


async def list_runs(schedule_id: Optional[str] = None, limit: int = 20) -> list[dict]:
    db = get_db()
    q: dict = {}
    if schedule_id:
        q["schedule_id"] = schedule_id
    items = await db.report_schedule_runs.find(q).sort("started_at", -1).limit(limit).to_list(limit)
    return [serialize(i) for i in items]


async def run_due_schedules():
    """Called by APScheduler every minute — run schedules that are due."""
    from datetime import datetime as dt
    now_jakarta = dt.now()  # server is UTC; APScheduler triggers in cron(timezone=WIB)
    current_time = now_jakarta.strftime("%H:%M")
    current_weekday = now_jakarta.weekday()  # 0=Mon

    schedules = await list_schedules(enabled_only=True)
    for sched in schedules:
        if sched.get("run_time") != current_time:
            continue
        if sched.get("frequency") == "weekly" and sched.get("day_of_week") is not None:
            if int(sched["day_of_week"]) != current_weekday:
                continue
        # Run!
        log = await dispatch_schedule(sched)
        db = get_db()
        await db.report_schedules.update_one(
            {"id": sched["id"]},
            {"$set": {"last_run_at": log["started_at"], "last_status": log["status"]}}
        )
        logger.info(f"report_schedule {sched['id']} ({sched['report_type']}) → {log['status']}")
