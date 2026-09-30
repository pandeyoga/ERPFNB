"""Loyalty transaction service."""
from datetime import datetime, timezone
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging
import uuid

from models.loyalty_transaction import (
    LoyaltyTransactionInDB,
    LoyaltyTransactionResponse,
)
from services.customer_service import update_customer_points

log = logging.getLogger("aurora.loyalty")


async def create_transaction(
    db: AsyncIOMotorDatabase,
    customer_id: str,
    transaction_type: str,
    points: int,
    description: str,
    reference_type: Optional[str] = None,
    reference_id: Optional[str] = None,
    created_by: Optional[str] = None,
) -> LoyaltyTransactionInDB:
    """Create loyalty transaction and update customer points.
    
    Args:
        transaction_type: earn, redeem, adjustment, expire
        points: Positive for earn, negative for redeem/expire
    """
    # Create transaction record
    transaction_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    transaction_doc = {
        "id": transaction_id,
        "customer_id": customer_id,
        "transaction_type": transaction_type,
        "points": points,
        "description": description,
        "reference_type": reference_type,
        "reference_id": reference_id,
        "created_at": now,
        "created_by": created_by,
    }
    
    # CTL-13: change the balance FIRST (atomic, raises if insufficient), then record the ledger row
    is_lifetime = transaction_type == "earn"  # Only earning adds to lifetime
    await update_customer_points(db, customer_id, points, is_lifetime=is_lifetime)
    await db.loyalty_transactions.insert_one(transaction_doc)
    
    return LoyaltyTransactionInDB(**transaction_doc)


async def get_customer_transactions(
    db: AsyncIOMotorDatabase,
    customer_id: str,
    limit: int = 50,
    skip: int = 0
) -> List[LoyaltyTransactionResponse]:
    """Get customer transaction history."""
    cursor = db.loyalty_transactions.find({"customer_id": customer_id}).sort("created_at", -1).skip(skip).limit(limit)
    transactions = await cursor.to_list(length=limit)
    
    return [LoyaltyTransactionResponse(**t) for t in transactions]


def calculate_points_from_amount(amount: float, tier_multiplier: float = 1.0) -> int:
    """Calculate loyalty points from purchase amount.
    
    Rule: Rp 10,000 = 1 point (before multiplier)
    
    Args:
        amount: Purchase amount in Rupiah
        tier_multiplier: Tier-based multiplier (1.0 for bronze, 1.2 for silver, 1.5 for gold)
    
    Returns:
        Points earned (rounded down)
    """
    base_points = int(amount / 10000)
    return int(base_points * tier_multiplier)


TIER_MULTIPLIERS = {
    "bronze": 1.0,
    "silver": 1.2,
    "gold": 1.5,
    "platinum": 2.0,
}


