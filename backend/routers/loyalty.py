"""Customer loyalty API routes."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field
from typing import List
import jwt
from datetime import datetime, timedelta, timezone
import os

from core.security import require_perm
from core.exceptions import ok_envelope

from core.db import get_db
from models.customer import (
    CustomerCreate,
    CustomerResponse,
    CustomerUpdate,
    LoyaltyCardResponse,
    generate_card_number,
    get_tier_benefits,
)
from models.loyalty_transaction import LoyaltyTransactionResponse
from services.customer_service import (
    create_customer,
    authenticate_customer,
    change_customer_password,
    get_customer_by_id,
    update_customer,
)
from services.loyalty_service import (
    get_customer_transactions,
    create_transaction,
)

router = APIRouter(prefix="/api/loyalty", tags=["loyalty"])
security = HTTPBearer()

# JWT settings untuk customer loyalty (terpisah dari ERP JWT)
# Menggunakan JWT_SECRET dari .env (A5 fix: SEC-002 + unify secrets)
SECRET_KEY = os.environ.get("JWT_SECRET", os.environ.get("JWT_SECRET_KEY", "loyalty-default-change-me"))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 hari untuk customer loyalty


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    customer: CustomerResponse


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


def create_access_token(customer_id: str) -> str:
    """Create JWT access token."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {
        "sub": customer_id,
        "exp": expire,
        "type": "customer"
    }
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_customer(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current authenticated customer from JWT."""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        customer_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if customer_id is None or token_type != "customer":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.InvalidTokenError:
        # PyJWT 2.x base class for all JWT decode errors (signature mismatch,
        # invalid claims, malformed token, etc). Note: `jwt.JWTError` is from
        # `python-jose` (different library) and does NOT exist in PyJWT — using
        # it crashes with AttributeError -> HTTP 500 for non-customer tokens.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )
    
    db = get_db()
    customer = await get_customer_by_id(db, customer_id)
    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    
    return customer


@router.post("/register", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
async def register_customer(customer_data: CustomerCreate):
    """Register new customer."""
    db = get_db()
    
    try:
        customer = await create_customer(db, customer_data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    # Auto-login after registration
    access_token = create_access_token(customer.id)
    customer_response = CustomerResponse(**customer.dict())
    
    return LoginResponse(
        access_token=access_token,
        customer=customer_response
    )


@router.post("/login", response_model=LoginResponse)
async def login_customer(login_data: LoginRequest):
    """Customer login by email."""
    db = get_db()
    
    customer = await authenticate_customer(db, login_data.email, login_data.password)
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    access_token = create_access_token(customer.id)
    customer_response = CustomerResponse(**customer.dict())
    
    return LoginResponse(
        access_token=access_token,
        customer=customer_response
    )


class PhoneLoginRequest(BaseModel):
    phone: str
    password: str


@router.post("/login-phone", response_model=LoginResponse)
async def login_customer_by_phone(payload: PhoneLoginRequest):
    """Customer login by phone number (for auto-created accounts).

    Auto-created accounts by cashier use phone as both identifier and initial password.
    Customer can change name/password later in their profile.
    """
    from services.customer_service import authenticate_customer_by_phone

    db = get_db()
    phone = payload.phone.strip()

    customer = await authenticate_customer_by_phone(db, phone, payload.password)
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nomor HP atau password salah"
        )

    access_token = create_access_token(customer.id)
    return LoginResponse(
        access_token=access_token,
        customer=CustomerResponse(**customer.dict())
    )


@router.get("/me", response_model=CustomerResponse)
async def get_current_customer_profile(
    customer=Depends(get_current_customer),
    db=Depends(get_db),
):
    """Get current customer profile — auto-generate referral code if missing."""
    # Ensure referral_code exists (backfill for old accounts)
    if not customer.referral_code:
        from services.customer_service import generate_referral_code
        code = generate_referral_code()
        await db.customers.update_one(
            {"id": customer.id},
            {"$set": {"referral_code": code}}
        )
        customer = customer.copy(update={"referral_code": code})
    return CustomerResponse(**customer.dict())


@router.get("/me/stats")
async def get_customer_stats(
    customer=Depends(get_current_customer),
    db=Depends(get_db),
):
    """Rich stats for the enhanced loyalty dashboard.
    
    Returns:
    - available_rewards: count of rewards the customer can redeem right now
    - next_tier_points: how many more lifetime points needed to reach next tier
    - is_birthday_month: True if today is in the customer's birthday month
    - recent_transactions: last 5 transactions
    - referral_code: customer's referral code
    """
    from datetime import date as dt_date
    from services.reward_service import get_all_rewards

    # Count redeemable rewards
    rewards = await get_all_rewards(db, is_active=True, limit=100)
    available = sum(1 for r in rewards if r.points_required <= customer.total_points)

    # Next tier progress
    tier_thresholds = {"bronze": 0, "silver": 1000, "gold": 5000}
    next_tier_threshold = None
    next_tier_name = None
    if customer.loyalty_tier == "bronze":
        next_tier_threshold = 1000
        next_tier_name = "silver"
    elif customer.loyalty_tier == "silver":
        next_tier_threshold = 5000
        next_tier_name = "gold"

    points_to_next = max(0, next_tier_threshold - customer.lifetime_points) if next_tier_threshold else 0
    tier_progress_pct = 0
    if next_tier_threshold:
        current_floor = tier_thresholds[customer.loyalty_tier]
        tier_progress_pct = min(100, int(
            (customer.lifetime_points - current_floor) / (next_tier_threshold - current_floor) * 100
        ))

    # Birthday check
    is_birthday_month = False
    birthday_bonus = 0
    if customer.date_of_birth:
        try:
            today = dt_date.today()
            bday_month = int(customer.date_of_birth.split("-")[1])
            if today.month == bday_month:
                is_birthday_month = True
                from models.customer import get_tier_benefits
                benefits = get_tier_benefits(customer.loyalty_tier)
                birthday_bonus = benefits.get("birthday_bonus", 0)
        except Exception:
            pass

    # Recent 5 transactions
    txn_cursor = db.loyalty_transactions.find(
        {"customer_id": customer.id}
    ).sort("created_at", -1).limit(5)
    raw_txns = await txn_cursor.to_list(5)
    recent_txns = []
    for t in raw_txns:
        recent_txns.append({
            "id": t.get("id", ""),
            "points": t.get("points", 0),
            "type": t.get("transaction_type", "adjustment"),
            "description": t.get("description", ""),
            "created_at": t.get("created_at", "").isoformat() if hasattr(t.get("created_at", ""), "isoformat") else str(t.get("created_at", "")),
        })

    return {
        "available_rewards": available,
        "total_rewards": len(rewards),
        "points_to_next_tier": points_to_next,
        "next_tier": next_tier_name,
        "tier_progress_pct": tier_progress_pct,
        "is_birthday_month": is_birthday_month,
        "birthday_bonus": birthday_bonus,
        "recent_transactions": recent_txns,
        "referral_code": customer.referral_code,
        "total_points": customer.total_points,
        "loyalty_tier": customer.loyalty_tier,
        "lifetime_points": customer.lifetime_points,
    }
async def update_customer_profile(
    update_data: CustomerUpdate,
    customer = Depends(get_current_customer)
):
    """Update customer profile."""
    db = get_db()
    updated_customer = await update_customer(db, customer.id, update_data)
    
    if not updated_customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    
    return CustomerResponse(**updated_customer.dict())


@router.post("/me/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    customer = Depends(get_current_customer)
):
    """Change customer password (requires current password)."""
    db = get_db()
    try:
        await change_customer_password(
            db,
            customer.id,
            payload.current_password,
            payload.new_password,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    return ok_envelope({"message": "Password berhasil diubah"})


@router.get("/card", response_model=LoyaltyCardResponse)
async def get_loyalty_card(customer = Depends(get_current_customer)):
    """Get digital loyalty card."""
    card_number = generate_card_number(customer.id)
    tier_benefits = get_tier_benefits(customer.loyalty_tier)
    
    # QR data format: LOYALTY:{customer_id}
    qr_data = f"LOYALTY:{customer.id}"
    
    return LoyaltyCardResponse(
        customer_id=customer.id,
        customer_name=customer.full_name,
        loyalty_tier=customer.loyalty_tier,
        total_points=customer.total_points,
        card_number=card_number,
        qr_data=qr_data,
        tier_benefits=tier_benefits
    )


@router.get("/transactions", response_model=List[LoyaltyTransactionResponse])
async def get_transaction_history(
    limit: int = Query(50, ge=1, le=200),
    skip: int  = Query(0,  ge=0),
    customer = Depends(get_current_customer)
):
    """Get customer transaction history."""
    db = get_db()
    transactions = await get_customer_transactions(db, customer.id, limit=limit, skip=skip)
    return transactions


# Admin endpoint untuk manual points adjustment
# A5 fix: SEC-005 — require_perm("admin.loyalty.manage") agar hanya ERP admin yang bisa akses
@router.post("/admin/adjust-points")
async def adjust_customer_points(
    customer_id: str,
    points: int,
    description: str,
    admin_user: dict = Depends(require_perm("admin.loyalty.manage")),
):
    """Manual points adjustment — admin ERP only (dilindungi RBAC).
    """
    db = get_db()
    
    customer = await get_customer_by_id(db, customer_id)
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    
    transaction_type = "earn" if points > 0 else "adjustment"
    
    try:
        transaction = await create_transaction(
            db=db,
            customer_id=customer_id,
            transaction_type=transaction_type,
            points=points,
            description=description,
            reference_type="manual",
        )
        
        # Get updated customer
        updated_customer = await get_customer_by_id(db, customer_id)
        
        return {
            "success": True,
            "transaction": LoyaltyTransactionResponse(**transaction.dict()),
            "customer": CustomerResponse(**updated_customer.dict())
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
