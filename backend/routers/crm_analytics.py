"""CRM Advanced Analytics router — Sprint CRM.

Endpoints:
  GET /api/admin/crm/analytics/overview      — KPI summary (retention, churn, CLV, segments, tiers)
  GET /api/admin/crm/analytics/retention     — Monthly retention + churn rate (last N months)
  GET /api/admin/crm/analytics/segments      — Customer segments with counts + %
  GET /api/admin/crm/analytics/cohorts       — Cohort retention matrix (signup month x activity month)
  GET /api/admin/crm/analytics/trends        — Monthly acquisition + transaction volume
  GET /api/admin/crm/analytics/top-customers — Top customers by CLV / spend
  GET /api/admin/crm/analytics/clv           — CLV distribution by tier + spending histogram
  GET /api/admin/crm/analytics/rfm           — RFM (Recency, Frequency, Monetary) segmentation
"""
from fastapi import APIRouter, Depends, Query
from datetime import datetime, timezone, timedelta
from dateutil.relativedelta import relativedelta

from core.db import get_db
from core.exceptions import ok_envelope
from core.security import require_perm

router = APIRouter(prefix="/api/admin/crm", tags=["crm-analytics"])

NOW = lambda: datetime.now(timezone.utc)  # noqa


def _ser(doc):
    """Serialize datetime to ISO string recursively."""
    if isinstance(doc, dict):
        return {k: _ser(v) for k, v in doc.items()}
    if isinstance(doc, list):
        return [_ser(i) for i in doc]
    if hasattr(doc, "isoformat"):
        return doc.isoformat()
    return doc


def _month_start(dt: datetime) -> datetime:
    return dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


# ============================================================================
# OVERVIEW / KPI SUMMARY
# ============================================================================

@router.get("/analytics/overview")
async def crm_overview(user: dict = Depends(require_perm("admin", "loyalty"))):
    """Return high-level CRM KPIs."""
    db = get_db()
    now = NOW()
    cutoff_active = now - timedelta(days=60)
    cutoff_new = now - timedelta(days=30)
    cutoff_at_risk_end = now - timedelta(days=120)

    total = await db.customers.count_documents({})
    new_count = await db.customers.count_documents({"created_at": {"$gte": cutoff_new}})
    active_count = await db.customers.count_documents({"last_transaction_at": {"$gte": cutoff_active}})
    at_risk_count = await db.customers.count_documents({
        "last_transaction_at": {"$lt": cutoff_active, "$gte": cutoff_at_risk_end}
    })
    churned_count = await db.customers.count_documents({
        "$or": [
            {"last_transaction_at": {"$lt": cutoff_at_risk_end}},
            {"last_transaction_at": None, "created_at": {"$lt": cutoff_active}},
        ]
    })
    repeat_count = await db.customers.count_documents({"visit_count": {"$gte": 2}})

    # Avg CLV (active customers)
    clv_pipeline = [
        {"$match": {"last_transaction_at": {"$gte": cutoff_active}, "total_spend": {"$gt": 0}}},
        {"$group": {
            "_id": None,
            "avg_clv": {"$avg": "$total_spend"},
            "max_clv": {"$max": "$total_spend"},
            "avg_visits": {"$avg": "$visit_count"},
        }},
    ]
    clv_r = await db.customers.aggregate(clv_pipeline).to_list(1)
    avg_clv = clv_r[0]["avg_clv"] if clv_r else 0
    max_clv = clv_r[0]["max_clv"] if clv_r else 0
    avg_visits = clv_r[0]["avg_visits"] if clv_r else 0

    # Total lifetime revenue
    rev_r = await db.customers.aggregate([{"$group": {"_id": None, "total": {"$sum": "$total_spend"}}}]).to_list(1)
    total_rev = rev_r[0]["total"] if rev_r else 0

    # Tier distribution
    tier_r = await db.customers.aggregate([{"$group": {"_id": "$loyalty_tier", "count": {"$sum": 1}}}]).to_list(10)
    tier_dist = {t["_id"]: t["count"] for t in tier_r}

    # Avg transaction value
    aov_r = await db.loyalty_transactions.aggregate([
        {"$match": {"transaction_type": "earn", "amount": {"$gt": 0}}},
        {"$group": {"_id": None, "aov": {"$avg": "$amount"}, "total_txns": {"$sum": 1}}},
    ]).to_list(1)
    avg_order_value = aov_r[0]["aov"] if aov_r else 0
    total_transactions = aov_r[0]["total_txns"] if aov_r else 0

    return ok_envelope({
        "total_customers": total,
        "new_customers_30d": new_count,
        "active_customers": active_count,
        "at_risk_customers": at_risk_count,
        "churned_customers": churned_count,
        "active_rate": round(active_count / total * 100, 1) if total else 0,
        "churn_rate": round(churned_count / total * 100, 1) if total else 0,
        "repeat_purchase_rate": round(repeat_count / total * 100, 1) if total else 0,
        "avg_clv": round(avg_clv, 0),
        "max_clv": round(max_clv, 0),
        "avg_visit_count": round(avg_visits, 1),
        "avg_order_value": round(avg_order_value, 0),
        "total_transactions": total_transactions,
        "total_lifetime_revenue": round(total_rev, 0),
        "tier_distribution": tier_dist,
    })


# ============================================================================
# MONTHLY RETENTION & CHURN
# ============================================================================

@router.get("/analytics/retention")
async def crm_retention(
    months: int = Query(12, ge=3, le=24),
    user: dict = Depends(require_perm("admin", "loyalty")),
):
    """Monthly retention rate and churn rate for the last N months."""
    db = get_db()
    now = NOW()
    result = []

    for m in range(months, 0, -1):
        curr_start = _month_start(now - relativedelta(months=m))
        curr_end   = curr_start + relativedelta(months=1)
        prev_start = curr_start - relativedelta(months=1)

        # Customers active in previous month
        prev_ids = await db.loyalty_transactions.distinct(
            "customer_id",
            {"created_at": {"$gte": prev_start, "$lt": curr_start}, "transaction_type": "earn"},
        )
        if not prev_ids:
            continue

        # How many of those returned this month
        retained = await db.loyalty_transactions.distinct(
            "customer_id",
            {"customer_id": {"$in": prev_ids}, "created_at": {"$gte": curr_start, "$lt": curr_end}, "transaction_type": "earn"},
        )
        retention = round(len(retained) / len(prev_ids) * 100, 1) if prev_ids else 0.0
        new_this_month = await db.loyalty_transactions.distinct(
            "customer_id",
            {"created_at": {"$gte": curr_start, "$lt": curr_end}, "customer_id": {"$nin": prev_ids}, "transaction_type": "earn"},
        )

        result.append({
            "month": curr_start.strftime("%Y-%m"),
            "label": curr_start.strftime("%b %Y"),
            "active_prev": len(prev_ids),
            "retained": len(retained),
            "new": len(new_this_month),
            "retention_rate": retention,
            "churn_rate": round(100 - retention, 1),
        })

    avg_ret = sum(r["retention_rate"] for r in result) / len(result) if result else 0
    avg_churn = 100 - avg_ret
    return ok_envelope({
        "monthly": result,
        "avg_retention": round(avg_ret, 1),
        "avg_churn": round(avg_churn, 1),
    })


# ============================================================================
# CUSTOMER SEGMENTS
# ============================================================================

@router.get("/analytics/segments")
async def crm_segments(user: dict = Depends(require_perm("admin", "loyalty"))):
    """Customer segment breakdown with counts and percentages."""
    db = get_db()
    now = NOW()
    cutoffs = {
        "active":   now - timedelta(days=60),
        "at_risk":  now - timedelta(days=120),
    }
    total = await db.customers.count_documents({})

    new_count = await db.customers.count_documents({"created_at": {"$gte": now - timedelta(days=30)}})
    active_count = await db.customers.count_documents({
        "last_transaction_at": {"$gte": cutoffs["active"]},
        "created_at": {"$lt": now - timedelta(days=30)},  # exclude new
    })
    at_risk_count = await db.customers.count_documents({
        "last_transaction_at": {"$lt": cutoffs["active"], "$gte": cutoffs["at_risk"]},
    })
    churned_count = await db.customers.count_documents({
        "$or": [
            {"last_transaction_at": {"$lt": cutoffs["at_risk"]}},
            {"last_transaction_at": None, "created_at": {"$lt": cutoffs["active"]}},
        ]
    })

    def pct(n): return round(n / total * 100, 1) if total else 0

    segments = [
        {"key": "new",      "label": "New",      "count": new_count,     "pct": pct(new_count),     "color": "#3B82F6", "desc": "Joined in last 30 days"},
        {"key": "active",   "label": "Active",   "count": active_count,  "pct": pct(active_count),  "color": "#10B981", "desc": "Transaction within 60 days"},
        {"key": "at_risk",  "label": "At Risk",  "count": at_risk_count, "pct": pct(at_risk_count), "color": "#F59E0B", "desc": "60–120 days since last visit"},
        {"key": "churned",  "label": "Churned",  "count": churned_count, "pct": pct(churned_count), "color": "#EF4444", "desc": "120+ days inactive"},
    ]
    return ok_envelope({"segments": segments, "total": total})


# ============================================================================
# COHORT ANALYSIS
# ============================================================================

@router.get("/analytics/cohorts")
async def crm_cohorts(
    months: int = Query(6, ge=3, le=12),
    user: dict = Depends(require_perm("admin", "loyalty")),
):
    """Cohort retention matrix: signup-month x activity-month-offset."""
    db = get_db()
    now = NOW()
    since = _month_start(now - relativedelta(months=months))

    # First transaction (activation) per customer
    first_tx_pipeline = [
        {"$match": {"created_at": {"$gte": since}, "transaction_type": "earn"}},
        {"$group": {"_id": "$customer_id", "first_tx": {"$min": "$created_at"}}},
    ]
    first_txs = {
        r["_id"]: r["first_tx"]
        for r in await db.loyalty_transactions.aggregate(first_tx_pipeline).to_list(10000)
    }

    # All monthly activity since
    monthly_pipeline = [
        {"$match": {"created_at": {"$gte": since}, "transaction_type": "earn"}},
        {"$group": {
            "_id": {
                "cid": "$customer_id",
                "ym": {"$dateToString": {"format": "%Y-%m", "date": "$created_at"}},
            }
        }},
    ]
    monthly_active = set()
    async for r in db.loyalty_transactions.aggregate(monthly_pipeline):
        monthly_active.add((r["_id"]["cid"], r["_id"]["ym"]))

    # Build cohort buckets
    cohort_months = []
    for i in range(months - 1, -1, -1):
        cm = _month_start(now - relativedelta(months=i + 1))
        cohort_months.append(cm)

    cohorts = []
    for cm in cohort_months:
        cm_key = cm.strftime("%Y-%m")
            # All customers whose first tx was in this cohort month
        # Ensure timezone-aware comparison
        cohort_customers = [
            cid for cid, ft in first_txs.items()
            if ft and ft.replace(tzinfo=timezone.utc if not ft.tzinfo else ft.tzinfo) >= cm 
            and ft.replace(tzinfo=timezone.utc if not ft.tzinfo else ft.tzinfo) < (cm + relativedelta(months=1))
        ]
        if not cohort_customers:
            continue
        cohort_size = len(cohort_customers)
        row = {
            "cohort_month": cm_key,
            "cohort_label": cm.strftime("%b '%y"),
            "cohort_size": cohort_size,
            "retention": {},
        }
        # For each subsequent month offset (0 = cohort month, 1 = +1 month, ...)
        for offset in range(months):
            target = cm + relativedelta(months=offset)
            if target > now:
                break
            target_key = target.strftime("%Y-%m")
            active_in_month = sum(
                1 for cid in cohort_customers if (cid, target_key) in monthly_active
            )
            row["retention"][str(offset)] = round(active_in_month / cohort_size * 100, 1)
        cohorts.append(row)

    return ok_envelope({"cohorts": cohorts, "months": months})


# ============================================================================
# ACQUISITION + TRANSACTION TRENDS
# ============================================================================

@router.get("/analytics/trends")
async def crm_trends(
    months: int = Query(12, ge=3, le=24),
    user: dict = Depends(require_perm("admin", "loyalty")),
):
    """Monthly acquisition (new customers) and transaction volume trends."""
    db = get_db()
    now = NOW()
    since = _month_start(now - relativedelta(months=months))

    # New customers per month
    cust_pipeline = [
        {"$match": {"created_at": {"$gte": since}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m", "date": "$created_at"}},
            "new_customers": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]
    cust_by_month = {r["_id"]: r["new_customers"] for r in await db.customers.aggregate(cust_pipeline).to_list(100)}

    # Transactions + revenue per month
    tx_pipeline = [
        {"$match": {"created_at": {"$gte": since}, "transaction_type": "earn"}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m", "date": "$created_at"}},
            "transactions": {"$sum": 1},
            "revenue": {"$sum": "$amount"},
            "active_customers": {"$addToSet": "$customer_id"},
        }},
        {"$sort": {"_id": 1}},
    ]
    tx_by_month = {}
    async for r in db.loyalty_transactions.aggregate(tx_pipeline):
        tx_by_month[r["_id"]] = {
            "transactions": r["transactions"],
            "revenue": round(r["revenue"], 0),
            "active_customers": len(r["active_customers"]),
        }

    # Build unified timeline
    timeline = []
    for i in range(months - 1, -1, -1):
        m = _month_start(now - relativedelta(months=i))
        mk = m.strftime("%Y-%m")
        timeline.append({
            "month": mk,
            "label": m.strftime("%b '%y"),
            "new_customers": cust_by_month.get(mk, 0),
            "transactions": tx_by_month.get(mk, {}).get("transactions", 0),
            "revenue": tx_by_month.get(mk, {}).get("revenue", 0),
            "active_customers": tx_by_month.get(mk, {}).get("active_customers", 0),
        })

    return ok_envelope({"timeline": timeline, "months": months})


# ============================================================================
# TOP CUSTOMERS
# ============================================================================

@router.get("/analytics/top-customers")
async def crm_top_customers(
    limit: int = Query(15, ge=5, le=50),
    sort_by: str = Query("total_spend"),
    user: dict = Depends(require_perm("admin", "loyalty")),
):
    """Top customers by total spend, visit count, or CLV."""
    db = get_db()
    now = NOW()
    cutoff = now - timedelta(days=60)

    sort_field = sort_by if sort_by in ("total_spend", "visit_count", "lifetime_points") else "total_spend"
    customers = await db.customers.find(
        {"total_spend": {"$gt": 0}},
        {"_id": 0, "id": 1, "full_name": 1, "email": 1, "loyalty_tier": 1,
         "total_spend": 1, "visit_count": 1, "lifetime_points": 1,
         "last_transaction_at": 1, "created_at": 1, "total_points": 1},
    ).sort(sort_field, -1).limit(limit).to_list(length=limit)

    result = []
    for c in customers:
        # CLV = annualized spend
        first_date = c.get("created_at", now)
        # Ensure timezone-aware comparison
        if first_date and not first_date.tzinfo:
            first_date = first_date.replace(tzinfo=timezone.utc)
        months_active = max(1, (now - first_date).days / 30)
        monthly_spend = c.get("total_spend", 0) / months_active
        clv_annual = monthly_spend * 12
        # Ensure timezone-aware comparison for last_transaction_at
        last_tx_at = c.get("last_transaction_at")
        if last_tx_at and not last_tx_at.tzinfo:
            last_tx_at = last_tx_at.replace(tzinfo=timezone.utc)
        is_active = last_tx_at and last_tx_at >= cutoff
        result.append({
            "id": c["id"],
            "full_name": c["full_name"],
            "email": c["email"],
            "loyalty_tier": c["loyalty_tier"],
            "total_spend": round(c.get("total_spend", 0), 0),
            "visit_count": c.get("visit_count", 0),
            "lifetime_points": c.get("lifetime_points", 0),
            "total_points": c.get("total_points", 0),
            "monthly_spend": round(monthly_spend, 0),
            "clv_annual": round(clv_annual, 0),
            "last_transaction_at": c.get("last_transaction_at"),
            "is_active": is_active,
        })

    return ok_envelope([_ser(r) for r in result])


# ============================================================================
# CLV DISTRIBUTION + TIER SPEND
# ============================================================================

@router.get("/analytics/clv")
async def crm_clv(user: dict = Depends(require_perm("admin", "loyalty"))):
    """CLV distribution by tier and spending histogram."""
    db = get_db()

    # CLV by tier
    tier_pipeline = [
        {"$match": {"total_spend": {"$gt": 0}}},
        {"$group": {
            "_id": "$loyalty_tier",
            "avg_spend": {"$avg": "$total_spend"},
            "avg_visits": {"$avg": "$visit_count"},
            "count": {"$sum": 1},
            "total_spend": {"$sum": "$total_spend"},
            "max_spend": {"$max": "$total_spend"},
        }},
    ]
    tier_data = await db.customers.aggregate(tier_pipeline).to_list(10)

    # Spending histogram (10 buckets)
    spend_data = await db.customers.find(
        {"total_spend": {"$gt": 0}},
        {"_id": 0, "total_spend": 1},
    ).to_list(length=10000)

    spend_values = [d["total_spend"] for d in spend_data if d.get("total_spend")]
    histogram = []
    if spend_values:
        max_spend = max(spend_values)
        bucket_size = max_spend / 8 if max_spend > 0 else 1
        buckets = [0] * 8
        for sv in spend_values:
            idx = min(7, int(sv / bucket_size))
            buckets[idx] += 1
        for i, cnt in enumerate(buckets):
            lo = round(i * bucket_size / 1000) * 1000
            hi = round((i + 1) * bucket_size / 1000) * 1000
            histogram.append({"range": f"Rp {lo:,.0f}–{hi:,.0f}", "count": cnt})

    return ok_envelope({
        "by_tier": [
            {
                "tier": t["_id"],
                "avg_spend": round(t["avg_spend"], 0),
                "avg_visits": round(t["avg_visits"], 1),
                "customer_count": t["count"],
                "total_spend": round(t["total_spend"], 0),
                "max_spend": round(t["max_spend"], 0),
            }
            for t in sorted(tier_data, key=lambda x: x["avg_spend"])
        ],
        "histogram": histogram,
    })


# ============================================================================
# RFM SEGMENTATION
# ============================================================================

@router.get("/analytics/rfm")
async def crm_rfm(user: dict = Depends(require_perm("admin", "loyalty"))):
    """RFM (Recency, Frequency, Monetary) distribution."""
    db = get_db()
    now = NOW()

    customers = await db.customers.find(
        {"visit_count": {"$gt": 0}},
        {"_id": 0, "id": 1, "full_name": 1, "loyalty_tier": 1,
         "total_spend": 1, "visit_count": 1, "last_transaction_at": 1},
    ).to_list(length=10000)

    if not customers:
        return ok_envelope({"segments": [], "stats": {}})

    # Compute R, F, M scores (1-5) for each customer
    def score_r(days_since):
        if days_since <= 30: return 5
        if days_since <= 60: return 4
        if days_since <= 90: return 3
        if days_since <= 120: return 2
        return 1

    def score_f(visits):
        if visits >= 20: return 5
        if visits >= 10: return 4
        if visits >= 5: return 3
        if visits >= 2: return 2
        return 1

    def score_m(spend):
        if spend >= 3_000_000: return 5
        if spend >= 1_500_000: return 4
        if spend >= 750_000: return 3
        if spend >= 300_000: return 2
        return 1

    rfm_data = []
    for c in customers:
        last_tx = c.get("last_transaction_at")
        # Ensure timezone-aware comparison
        if last_tx and not last_tx.tzinfo:
            last_tx = last_tx.replace(tzinfo=timezone.utc)
        days = (now - last_tx).days if last_tx else 999
        r = score_r(days)
        f = score_f(c.get("visit_count", 0))
        m = score_m(c.get("total_spend", 0))
        rfm_score = r + f + m
        # Segment
        if rfm_score >= 13:
            seg = "Champions"
        elif rfm_score >= 10:
            seg = "Loyal Customers"
        elif rfm_score >= 7:
            seg = "Potential Loyalists"
        elif r >= 4:
            seg = "New Customers"
        elif r == 1 and f >= 4:
            seg = "Cant Lose"
        elif r <= 2:
            seg = "Hibernating"
        else:
            seg = "Need Attention"
        rfm_data.append({"segment": seg, "r": r, "f": f, "m": m, "score": rfm_score})

    # Count by segment
    seg_counts = {}
    seg_colors = {
        "Champions": "#10B981",
        "Loyal Customers": "#3B82F6",
        "Potential Loyalists": "#8B5CF6",
        "New Customers": "#06B6D4",
        "Need Attention": "#F59E0B",
        "Cant Lose": "#F97316",
        "Hibernating": "#EF4444",
    }
    for d in rfm_data:
        s = d["segment"]
        seg_counts[s] = seg_counts.get(s, 0) + 1

    segments = [
        {"segment": s, "count": cnt, "pct": round(cnt / len(rfm_data) * 100, 1), "color": seg_colors.get(s, "#6B7280")}
        for s, cnt in sorted(seg_counts.items(), key=lambda x: -x[1])
    ]

    # Score distribution
    score_dist = {}
    for d in rfm_data:
        sc = d["score"]
        score_dist[str(sc)] = score_dist.get(str(sc), 0) + 1

    return ok_envelope({
        "segments": segments,
        "score_distribution": [{
            "score": k, "count": v
        } for k, v in sorted(score_dist.items())],
        "total": len(rfm_data),
    })
