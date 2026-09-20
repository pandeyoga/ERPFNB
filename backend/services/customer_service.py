"""Customer service for CRM/Loyalty."""
from datetime import datetime, timezone
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from passlib.context import CryptContext
import uuid
import random
import string


def generate_referral_code() -> str:
    """Generate a unique 8-char referral code. Format: TORA-XXXX"""
    chars = string.ascii_uppercase + string.digits
    suffix = "".join(random.choices(chars, k=4))
    return f"TORA-{suffix}"

from models.customer import (
    CustomerCreate,
    CustomerInDB,
    CustomerUpdate,
    calculate_tier,
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash."""
    return pwd_context.verify(plain_password, hashed_password)


async def create_customer(db: AsyncIOMotorDatabase, customer_data: CustomerCreate) -> CustomerInDB:
    """Create new customer."""
    # Check if email already exists
    existing = await db.customers.find_one({"email": customer_data.email.lower()})
    if existing:
        raise ValueError("Email already registered")
    
    # Create customer document
    customer_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    customer_doc = {
        "id": customer_id,
        "email": customer_data.email.lower(),
        "full_name": customer_data.full_name,
        "phone": customer_data.phone,
        "date_of_birth": customer_data.date_of_birth,
        "gender": customer_data.gender,
        "hashed_password": hash_password(customer_data.password),
        "email_verified": False,
        "is_active": True,
        "loyalty_tier": "bronze",
        "total_points": 0,
        "lifetime_points": 0,
        "referral_code": generate_referral_code(),
        "created_at": now,
        "updated_at": now,
    }
    
    await db.customers.insert_one(customer_doc)
    return CustomerInDB(**customer_doc)


async def get_customer_by_email(db: AsyncIOMotorDatabase, email: str) -> Optional[CustomerInDB]:
    """Get customer by email."""
    customer_doc = await db.customers.find_one({"email": email.lower()})
    if customer_doc:
        return CustomerInDB(**customer_doc)
    return None


async def get_customer_by_id(db: AsyncIOMotorDatabase, customer_id: str) -> Optional[CustomerInDB]:
    """Get customer by ID."""
    customer_doc = await db.customers.find_one({"id": customer_id})
    if customer_doc:
        return CustomerInDB(**customer_doc)
    return None


async def get_customer_by_phone(db: AsyncIOMotorDatabase, phone: str) -> Optional[CustomerInDB]:
    """Get customer by phone number.
    
    Normalizes phone: strips spaces/dashes, handles +62 / 08xx variants.
    """
    normalized = _normalize_phone(phone)
    # Try multiple phone format variants
    variants = _phone_variants(normalized)
    customer_doc = await db.customers.find_one({"phone": {"$in": variants}})
    if customer_doc:
        return CustomerInDB(**customer_doc)
    return None


def _normalize_phone(phone: str) -> str:
    """Strip spaces, dashes, parentheses from phone string."""
    import re
    return re.sub(r"[\s\-\(\)]", "", phone or "").strip()


def _phone_variants(phone: str) -> list[str]:
    """Generate common Indonesian phone variants to match in DB."""
    variants = {phone}
    if phone.startswith("+62"):
        local = "0" + phone[3:]
        variants.add(local)
        variants.add(phone[1:])  # without +
    elif phone.startswith("62"):
        local = "0" + phone[2:]
        variants.add(local)
        variants.add("+" + phone)
    elif phone.startswith("0"):
        intl = "+62" + phone[1:]
        variants.add(intl)
        variants.add("62" + phone[1:])
    return list(variants)


async def authenticate_customer(db: AsyncIOMotorDatabase, email: str, password: str) -> Optional[CustomerInDB]:
    """Authenticate customer."""
    customer = await get_customer_by_email(db, email)
    if not customer:
        return None
    if not verify_password(password, customer.hashed_password):
        return None
    if not customer.is_active:
        return None
    return customer


async def authenticate_customer_by_phone(
    db: AsyncIOMotorDatabase, phone: str, password: str
) -> Optional[CustomerInDB]:
    """Authenticate customer by phone number + password."""
    customer = await get_customer_by_phone(db, phone)
    if not customer:
        return None
    if not verify_password(password, customer.hashed_password):
        return None
    if not customer.is_active:
        return None
    return customer


async def create_customer_from_phone(
    db: AsyncIOMotorDatabase, phone: str
) -> CustomerInDB:
    """Auto-create loyalty customer from phone number.

    Called by cashier when a customer's phone is not yet registered.
    - phone is the primary identifier
    - email is generated as an internal placeholder
    - initial password = normalized phone number
    - full_name = 'Member XXXX' (last 4 digits)
    - customer can change name/password after first login
    """
    import re
    normalized = re.sub(r"[\s\-\(\)]", "", phone or "").strip()
    # Ensure +62 canonical form
    if normalized.startswith("0"):
        normalized = "+62" + normalized[1:]
    elif normalized.startswith("62") and not normalized.startswith("+"):
        normalized = "+" + normalized

    # Check if already exists (race-condition guard)
    existing = await get_customer_by_phone(db, normalized)
    if existing:
        return existing

    last4 = normalized[-4:] if len(normalized) >= 4 else normalized
    full_name = f"Member {last4}"

    # Internal placeholder email (not exposed to customer)
    digits_only = re.sub(r"\D", "", normalized)
    email = f"{digits_only}@loyalty.fnbgroup.id"

    # Initial password = the raw phone string supplied by cashier
    initial_password = phone.strip()

    customer_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    customer_doc = {
        "id": customer_id,
        "email": email,
        "full_name": full_name,
        "phone": normalized,
        "date_of_birth": None,
        "gender": None,
        "hashed_password": hash_password(initial_password),
        "email_verified": False,
        "is_active": True,
        "is_auto_created": True,       # flag: created by cashier
        "loyalty_tier": "bronze",
        "total_points": 0,
        "lifetime_points": 0,
        "referral_code": generate_referral_code(),
        "created_at": now,
        "updated_at": now,
    }

    await db.customers.insert_one(customer_doc)
    return CustomerInDB(**customer_doc)


async def update_customer(db: AsyncIOMotorDatabase, customer_id: str, update_data: CustomerUpdate) -> Optional[CustomerInDB]:
    """Update customer profile."""
    update_dict = {k: v for k, v in update_data.dict(exclude_unset=True).items() if v is not None}
    if not update_dict:
        return await get_customer_by_id(db, customer_id)
    
    update_dict["updated_at"] = datetime.now(timezone.utc)
    
    await db.customers.update_one(
        {"id": customer_id},
        {"$set": update_dict}
    )
    
    return await get_customer_by_id(db, customer_id)


async def update_customer_points(db: AsyncIOMotorDatabase, customer_id: str, points_delta: int, is_lifetime: bool = True) -> Optional[CustomerInDB]:
    """Update customer points and recalculate tier.
    
    Args:
        customer_id: Customer ID
        points_delta: Points to add (positive) or subtract (negative)
        is_lifetime: Whether to update lifetime_points (True for earning, False for redemption)
    """
    customer = await get_customer_by_id(db, customer_id)
    if not customer:
        return None
    
    # Update points
    new_total = customer.total_points + points_delta
    new_lifetime = customer.lifetime_points + points_delta if is_lifetime else customer.lifetime_points
    
    # Ensure points don't go negative
    if new_total < 0:
        raise ValueError("Insufficient points")
    
    # Recalculate tier
    new_tier = calculate_tier(new_lifetime)
    
    # Update database
    await db.customers.update_one(
        {"id": customer_id},
        {
            "$set": {
                "total_points": new_total,
                "lifetime_points": new_lifetime,
                "loyalty_tier": new_tier,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return await get_customer_by_id(db, customer_id)


async def change_customer_password(
    db: AsyncIOMotorDatabase,
    customer_id: str,
    current_password: str,
    new_password: str,
) -> bool:
    """Change customer password.

    Verifies current password before updating.
    Raises ValueError on validation errors:
      - "Customer not found"
      - "Incorrect current password"
      - "Password must be at least 8 characters"
      - "New password must be different from current password"
    Returns True on success.
    """
    customer = await get_customer_by_id(db, customer_id)
    if not customer:
        raise ValueError("Customer not found")

    if not verify_password(current_password, customer.hashed_password):
        raise ValueError("Incorrect current password")

    if len(new_password) < 8:
        raise ValueError("Password must be at least 8 characters")

    if verify_password(new_password, customer.hashed_password):
        raise ValueError("New password must be different from current password")

    await db.customers.update_one(
        {"id": customer_id},
        {
            "$set": {
                "hashed_password": hash_password(new_password),
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )
    return True
