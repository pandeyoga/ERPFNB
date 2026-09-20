"""Reward service for loyalty program."""
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
import uuid
import random
import string

from models.reward import (
    RewardCreate,
    RewardInDB,
    RewardUpdate,
    RedemptionResponse,
)
from services.loyalty_service import create_transaction
from services.customer_service import get_customer_by_id


def generate_voucher_code() -> str:
    """Generate random voucher code."""
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=10))


async def create_reward(db: AsyncIOMotorDatabase, reward_data: RewardCreate) -> RewardInDB:
    """Create new reward."""
    reward_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    reward_doc = {
        "id": reward_id,
        "name": reward_data.name,
        "description": reward_data.description,
        "points_required": reward_data.points_required,
        "category": reward_data.category,
        "image_url": reward_data.image_url,
        "stock": reward_data.stock,
        "is_active": reward_data.is_active,
        "created_at": now,
        "updated_at": now,
    }
    
    await db.rewards.insert_one(reward_doc)
    return RewardInDB(**reward_doc)


async def get_all_rewards(
    db: AsyncIOMotorDatabase,
    category: Optional[str] = None,
    is_active: Optional[bool] = True,
    limit: int = 50,
    skip: int = 0,
    search: Optional[str] = None,
) -> List[RewardInDB]:
    """Get all rewards with optional filters."""
    query = {}
    if category:
        query["category"] = category
    if is_active is not None:
        query["is_active"] = is_active
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    
    cursor = db.rewards.find(query).sort("points_required", 1).skip(skip).limit(limit)
    rewards = await cursor.to_list(length=limit)
    
    return [RewardInDB(**r) for r in rewards]


async def get_all_rewards_with_stats(
    db: AsyncIOMotorDatabase,
    category: Optional[str] = None,
    is_active: Optional[bool] = None,
    limit: int = 100,
    skip: int = 0,
    search: Optional[str] = None,
) -> List[dict]:
    """Get all rewards enriched with redemption_count stats."""
    query = {}
    if category:
        query["category"] = category
    if is_active is not None:
        query["is_active"] = is_active
    if search:
        query["name"] = {"$regex": search, "$options": "i"}

    cursor = db.rewards.find(query).sort("points_required", 1).skip(skip).limit(limit)
    rewards = await cursor.to_list(length=limit)

    if not rewards:
        return []

    # Aggregate redemption counts for all reward ids
    reward_ids = [r["id"] for r in rewards]
    pipeline = [
        {"$match": {"reward_id": {"$in": reward_ids}}},
        {"$group": {"_id": "$reward_id", "count": {"$sum": 1}}},
    ]
    count_map = {}
    async for row in db.redemptions.aggregate(pipeline):
        count_map[row["_id"]] = row["count"]

    enriched = []
    for r in rewards:
        r_dict = dict(r)
        # Remove MongoDB _id (ObjectId) which is not JSON serializable
        r_dict.pop("_id", None)
        r_dict["redemption_count"] = count_map.get(r["id"], 0)
        # Ensure datetime fields are serialized properly
        for field in ("created_at", "updated_at"):
            if field in r_dict and hasattr(r_dict[field], "isoformat"):
                r_dict[field] = r_dict[field].isoformat()
        enriched.append(r_dict)

    return enriched


async def get_reward_by_id(db: AsyncIOMotorDatabase, reward_id: str) -> Optional[RewardInDB]:
    """Get reward by ID."""
    reward_doc = await db.rewards.find_one({"id": reward_id})
    if reward_doc:
        return RewardInDB(**reward_doc)
    return None


async def update_reward(
    db: AsyncIOMotorDatabase,
    reward_id: str,
    update_data: RewardUpdate,
) -> Optional[RewardInDB]:
    """Update reward."""
    update_dict = {k: v for k, v in update_data.dict(exclude_unset=True).items() if v is not None}
    if not update_dict:
        return await get_reward_by_id(db, reward_id)
    
    update_dict["updated_at"] = datetime.now(timezone.utc)
    
    await db.rewards.update_one(
        {"id": reward_id},
        {"$set": update_dict}
    )
    
    return await get_reward_by_id(db, reward_id)


async def restock_reward(
    db: AsyncIOMotorDatabase,
    reward_id: str,
    add_stock: int,
) -> Optional[RewardInDB]:
    """Increment reward stock. Only works for limited-stock rewards."""
    if add_stock <= 0:
        raise ValueError("add_stock must be a positive integer")

    reward = await get_reward_by_id(db, reward_id)
    if not reward:
        return None

    if reward.stock is None:
        raise ValueError("This reward has unlimited stock. Set a stock limit first via edit.")

    await db.rewards.update_one(
        {"id": reward_id},
        {"$inc": {"stock": add_stock}, "$set": {"updated_at": datetime.now(timezone.utc)}}
    )
    return await get_reward_by_id(db, reward_id)


async def update_redemption_status(
    db: AsyncIOMotorDatabase,
    redemption_id: str,
    new_status: str,
    updated_by: Optional[str] = None,
) -> Optional[dict]:
    """Update redemption status with allowed transitions."""
    ALLOWED_STATUSES = {"pending", "claimed", "expired"}
    if new_status not in ALLOWED_STATUSES:
        raise ValueError(f"Invalid status. Must be one of: {', '.join(ALLOWED_STATUSES)}")

    doc = await db.redemptions.find_one({"id": redemption_id})
    if not doc:
        return None

    current = doc.get("status")
    # Transition rules: claimed is final (cannot revert)
    if current == "claimed" and new_status != "claimed":
        raise ValueError("Claimed redemptions cannot be changed.")

    update = {
        "status": new_status,
        "updated_at": datetime.now(timezone.utc),
    }
    if updated_by:
        update["updated_by"] = updated_by

    await db.redemptions.update_one({"id": redemption_id}, {"$set": update})
    return await db.redemptions.find_one({"id": redemption_id})


async def list_all_redemptions_filtered(
    db: AsyncIOMotorDatabase,
    limit: int = 50,
    skip: int = 0,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
) -> dict:
    """List redemptions with filters and customer enrichment."""
    # First find matching customers if search query
    customer_id_filter = None
    if search:
        customer_docs = await db.customers.find(
            {
                "$or": [
                    {"full_name": {"$regex": search, "$options": "i"}},
                    {"email": {"$regex": search, "$options": "i"}},
                ]
            },
            {"id": 1}
        ).to_list(length=200)
        customer_id_filter = [c["id"] for c in customer_docs]

    query = {}
    if status_filter and status_filter != "all":
        query["status"] = status_filter
    if search:
        search_conditions = [
            {"voucher_code": {"$regex": search, "$options": "i"}},
            {"reward_name": {"$regex": search, "$options": "i"}},
        ]
        if customer_id_filter:
            search_conditions.append({"customer_id": {"$in": customer_id_filter}})
        query["$or"] = search_conditions

    total = await db.redemptions.count_documents(query)
    cursor = db.redemptions.find(query).sort("created_at", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)

    # Enrich with customer info
    cids = list({d.get("customer_id") for d in docs})
    customer_map = {}
    if cids:
        async for c in db.customers.find(
            {"id": {"$in": cids}},
            {"id": 1, "email": 1, "full_name": 1},
        ):
            customer_map[c["id"]] = {"email": c.get("email"), "full_name": c.get("full_name")}

    items = []
    for d in docs:
        cid = d.get("customer_id")
        ci = customer_map.get(cid, {})
        created = d.get("created_at")
        expires = d.get("expires_at")
        items.append({
            "id": d.get("id"),
            "customer_id": cid,
            "customer_email": ci.get("email"),
            "customer_name": ci.get("full_name"),
            "reward_id": d.get("reward_id"),
            "reward_name": d.get("reward_name"),
            "points_used": d.get("points_used"),
            "voucher_code": d.get("voucher_code"),
            "status": d.get("status"),
            "created_at": created.isoformat() if hasattr(created, "isoformat") else str(created),
            "expires_at": expires.isoformat() if expires and hasattr(expires, "isoformat") else (str(expires) if expires else None),
        })

    return {"items": items, "total": total, "limit": limit, "skip": skip}


async def redeem_reward(
    db: AsyncIOMotorDatabase,
    customer_id: str,
    reward_id: str,
) -> RedemptionResponse:
    """Redeem reward for customer."""
    customer = await get_customer_by_id(db, customer_id)
    if not customer:
        raise ValueError("Customer not found")
    
    reward = await get_reward_by_id(db, reward_id)
    if not reward:
        raise ValueError("Reward not found")
    
    if not reward.is_active:
        raise ValueError("Reward is not available")
    
    if customer.total_points < reward.points_required:
        raise ValueError(f"Insufficient points. Need {reward.points_required}, have {customer.total_points}")
    
    if reward.stock is not None and reward.stock <= 0:
        raise ValueError("Reward out of stock")
    
    voucher_code = None
    if reward.category == "voucher":
        voucher_code = generate_voucher_code()
    
    redemption_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=30)
    
    redemption_doc = {
        "id": redemption_id,
        "customer_id": customer_id,
        "reward_id": reward_id,
        "reward_name": reward.name,
        "points_used": reward.points_required,
        "voucher_code": voucher_code,
        "status": "pending",
        "created_at": now,
        "expires_at": expires_at if voucher_code else None,
    }
    
    await db.redemptions.insert_one(redemption_doc)
    
    await create_transaction(
        db=db,
        customer_id=customer_id,
        transaction_type="redeem",
        points=-reward.points_required,
        description=f"Redeemed: {reward.name}",
        reference_type="redemption",
        reference_id=redemption_id,
    )
    
    if reward.stock is not None:
        await db.rewards.update_one(
            {"id": reward_id},
            {"$inc": {"stock": -1}}
        )
    
    return RedemptionResponse(**redemption_doc)


async def get_customer_redemptions(
    db: AsyncIOMotorDatabase,
    customer_id: str,
    limit: int = 50,
    skip: int = 0,
) -> List[RedemptionResponse]:
    """Get customer's redemption history."""
    cursor = db.redemptions.find({"customer_id": customer_id}).sort("created_at", -1).skip(skip).limit(limit)
    redemptions = await cursor.to_list(length=limit)
    return [RedemptionResponse(**r) for r in redemptions]
