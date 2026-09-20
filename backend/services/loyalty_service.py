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
    
    await db.loyalty_transactions.insert_one(transaction_doc)
    
    # Update customer points
    is_lifetime = transaction_type == "earn"  # Only earning adds to lifetime
    await update_customer_points(db, customer_id, points, is_lifetime=is_lifetime)
    
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


async def award_points_for_daily_sales(
    db: AsyncIOMotorDatabase,
    daily_sales: dict,
    user_id: Optional[str] = None,
) -> Optional[LoyaltyTransactionInDB]:
    """Award loyalty points when a daily sales is validated.

    Idempotent: if a loyalty transaction already exists for this daily_sales_id,
    skip silently to prevent double-award on retry.

    Args:
        db: AsyncIOMotorDatabase instance
        daily_sales: The validated daily_sales document (must have id, grand_total, customer_phone)
        user_id: ERP user who triggered the validation

    Returns:
        LoyaltyTransactionInDB on success, None if skipped (no phone / customer not found / already awarded).
    """
    customer_phone = (daily_sales.get("customer_phone") or "").strip()
    if not customer_phone:
        return None

    daily_sales_id = daily_sales.get("id")
    if not daily_sales_id:
        return None

    # --- Idempotency guard ---
    existing_txn = await db.loyalty_transactions.find_one({
        "reference_type": "daily_sales",
        "reference_id": daily_sales_id,
        "transaction_type": "earn",
    })
    if existing_txn:
        log.info("Loyalty award skipped (already awarded) for daily_sales %s", daily_sales_id)
        return None

    # --- Lookup customer by phone ---
    from services.customer_service import get_customer_by_phone
    customer = await get_customer_by_phone(db, customer_phone)
    if not customer:
        log.info("Loyalty award skipped: phone %s not found in CRM", customer_phone)
        return None

    # --- Calculate points ---
    grand_total = float(daily_sales.get("grand_total") or 0)
    multiplier = TIER_MULTIPLIERS.get(customer.loyalty_tier, 1.0)
    points = calculate_points_from_amount(grand_total, tier_multiplier=multiplier)
    if points <= 0:
        log.info("Loyalty award skipped: 0 points for grand_total %.2f", grand_total)
        return None

    # --- Award points ---
    outlet_id = daily_sales.get("outlet_id", "")
    sales_date = daily_sales.get("sales_date", "")
    description = (
        f"Poin dari transaksi outlet {sales_date} "
        f"(Total: Rp {grand_total:,.0f}, {points} poin x{multiplier})"
    ).replace(",", ".")

    txn = await create_transaction(
        db=db,
        customer_id=customer.id,
        transaction_type="earn",
        points=points,
        description=description,
        reference_type="daily_sales",
        reference_id=daily_sales_id,
        created_by=user_id,
    )
    log.info(
        "Loyalty: awarded %d points to customer %s (phone %s) for daily_sales %s",
        points, customer.id, customer_phone, daily_sales_id,
    )
    return txn
