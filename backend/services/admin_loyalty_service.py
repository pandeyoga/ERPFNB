"""Admin loyalty service — aggregated queries & management helpers."""
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple
from motor.motor_asyncio import AsyncIOMotorDatabase

from models.customer import CustomerInDB


async def list_customers(
    db: AsyncIOMotorDatabase,
    search: Optional[str] = None,
    tier: Optional[str] = None,
    is_active: Optional[bool] = None,
    limit: int = 50,
    skip: int = 0,
) -> Tuple[List[CustomerInDB], int]:
    """List customers with filters + total count."""
    query: dict = {}

    if search:
        regex = {"$regex": search, "$options": "i"}
        query["$or"] = [
            {"email": regex},
            {"full_name": regex},
            {"phone": regex},
        ]
    if tier and tier != "all":
        query["loyalty_tier"] = tier
    if is_active is not None:
        query["is_active"] = is_active

    total = await db.customers.count_documents(query)

    cursor = (
        db.customers.find(query)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)
    customers = [CustomerInDB(**d) for d in docs]
    return customers, total


async def get_customer_with_stats(
    db: AsyncIOMotorDatabase,
    customer_id: str,
) -> Optional[dict]:
    """Get customer with extended stats (transactions + redemptions counts)."""
    doc = await db.customers.find_one({"id": customer_id})
    if not doc:
        return None

    tx_count = await db.loyalty_transactions.count_documents({"customer_id": customer_id})
    redemption_count = await db.redemptions.count_documents({"customer_id": customer_id})

    return {
        "customer": CustomerInDB(**doc),
        "transaction_count": tx_count,
        "redemption_count": redemption_count,
    }


async def set_customer_active(
    db: AsyncIOMotorDatabase,
    customer_id: str,
    is_active: bool,
) -> Optional[CustomerInDB]:
    """Enable/disable a customer (soft delete via is_active)."""
    await db.customers.update_one(
        {"id": customer_id},
        {
            "$set": {
                "is_active": is_active,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )
    doc = await db.customers.find_one({"id": customer_id})
    return CustomerInDB(**doc) if doc else None


async def get_overview_analytics(db: AsyncIOMotorDatabase) -> dict:
    """Aggregate loyalty metrics for the admin overview."""
    total_customers = await db.customers.count_documents({})
    active_customers = await db.customers.count_documents({"is_active": True})

    # Tier distribution
    tier_pipeline = [
        {"$group": {"_id": "$loyalty_tier", "count": {"$sum": 1}}},
    ]
    tier_cursor = db.customers.aggregate(tier_pipeline)
    tier_distribution = {"bronze": 0, "silver": 0, "gold": 0}
    async for row in tier_cursor:
        tier = row.get("_id") or "bronze"  # untiered customers default to base tier (bronze)
        # Accumulate (not overwrite): None→bronze must add to any explicit 'bronze'
        # bucket, otherwise Σtiers < total_customers (RC-7 calc drift).
        tier_distribution[tier] = tier_distribution.get(tier, 0) + row.get("count", 0)

    # Total points outstanding
    points_pipeline = [
        {"$group": {"_id": None, "total": {"$sum": "$total_points"}}},
    ]
    points_cursor = db.customers.aggregate(points_pipeline)
    total_points_outstanding = 0
    async for row in points_cursor:
        total_points_outstanding = row.get("total", 0) or 0

    # Redemptions last 30 days
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    redemptions_30d = await db.redemptions.count_documents(
        {"created_at": {"$gte": thirty_days_ago}}
    )

    # Points earned last 30 days (positive transactions)
    earn_pipeline = [
        {
            "$match": {
                "created_at": {"$gte": thirty_days_ago},
                "points": {"$gt": 0},
            }
        },
        {"$group": {"_id": None, "total": {"$sum": "$points"}}},
    ]
    earn_cursor = db.loyalty_transactions.aggregate(earn_pipeline)
    points_earned_30d = 0
    async for row in earn_cursor:
        points_earned_30d = row.get("total", 0) or 0

    # Top rewards by redemption count (last 90 days)
    ninety_days_ago = datetime.now(timezone.utc) - timedelta(days=90)
    top_rewards_pipeline = [
        {"$match": {"created_at": {"$gte": ninety_days_ago}}},
        {
            "$group": {
                "_id": "$reward_id",
                "reward_name": {"$first": "$reward_name"},
                "count": {"$sum": 1},
                "points_used": {"$sum": "$points_used"},
            }
        },
        {"$sort": {"count": -1}},
        {"$limit": 5},
    ]
    top_rewards = []
    async for row in db.redemptions.aggregate(top_rewards_pipeline):
        top_rewards.append(
            {
                "reward_id": row.get("_id"),
                "reward_name": row.get("reward_name"),
                "redemption_count": row.get("count", 0),
                "points_used": row.get("points_used", 0),
            }
        )

    # Total rewards
    total_rewards = await db.rewards.count_documents({})
    active_rewards = await db.rewards.count_documents({"is_active": True})

    return {
        "total_customers": total_customers,
        "active_customers": active_customers,
        "inactive_customers": total_customers - active_customers,
        "total_points_outstanding": total_points_outstanding,
        "points_earned_30d": points_earned_30d,
        "redemptions_30d": redemptions_30d,
        "tier_distribution": tier_distribution,
        "top_rewards": top_rewards,
        "total_rewards": total_rewards,
        "active_rewards": active_rewards,
    }


async def list_all_redemptions(
    db: AsyncIOMotorDatabase,
    limit: int = 100,
    skip: int = 0,
) -> List[dict]:
    """List all redemptions (admin view)."""
    cursor = (
        db.redemptions.find({}).sort("created_at", -1).skip(skip).limit(limit)
    )
    docs = await cursor.to_list(length=limit)

    # Enrich with customer email/name
    customer_ids = list({d.get("customer_id") for d in docs})
    customer_map = {}
    if customer_ids:
        async for c in db.customers.find(
            {"id": {"$in": customer_ids}},
            {"id": 1, "email": 1, "full_name": 1},
        ):
            customer_map[c["id"]] = {
                "email": c.get("email"),
                "full_name": c.get("full_name"),
            }

    enriched = []
    for d in docs:
        cid = d.get("customer_id")
        customer_info = customer_map.get(cid, {})
        enriched.append(
            {
                "id": d.get("id"),
                "customer_id": cid,
                "customer_email": customer_info.get("email"),
                "customer_name": customer_info.get("full_name"),
                "reward_id": d.get("reward_id"),
                "reward_name": d.get("reward_name"),
                "points_used": d.get("points_used"),
                "voucher_code": d.get("voucher_code"),
                "status": d.get("status"),
                "created_at": d.get("created_at"),
                "expires_at": d.get("expires_at"),
            }
        )
    return enriched
