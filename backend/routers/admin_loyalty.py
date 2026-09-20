"""Admin Loyalty API routes — customer mgmt, points adjustment, rewards CRUD, analytics."""
from pathlib import Path
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field

from core.db import get_db
from core.exceptions import ok_envelope
from core.security import require_perm
from models.customer import CustomerCreate, CustomerResponse, CustomerUpdate
from models.loyalty_transaction import LoyaltyTransactionResponse
from models.reward import (
    RedemptionResponse,
    RewardCreate,
    RewardResponse,
    RewardUpdate,
)
from services.admin_loyalty_service import (
    get_customer_with_stats,
    get_overview_analytics,
    list_customers,
    set_customer_active,
)
from services.customer_service import (
    create_customer,
    get_customer_by_id,
    update_customer,
)
from services.loyalty_service import create_transaction, get_customer_transactions
from services.reward_service import (
    create_reward,
    get_all_rewards_with_stats,
    get_customer_redemptions,
    get_reward_by_id,
    list_all_redemptions_filtered,
    restock_reward,
    update_reward,
    update_redemption_status,
)

router = APIRouter(prefix="/api/admin/loyalty", tags=["admin-loyalty"])

# ── Upload config (mirrors CMS upload) ──────────────────────────────────────
UPLOAD_DIR = Path("/app/backend/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE_MB = 5
MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024


# ========== Pydantic helpers ==========
class CustomerListItem(BaseModel):
    id: str
    email: str
    full_name: str
    phone: Optional[str] = None
    loyalty_tier: str
    total_points: int
    lifetime_points: int
    is_active: bool
    created_at: str


class CustomerListResponse(BaseModel):
    items: List[CustomerListItem]
    total: int
    limit: int
    skip: int


class CustomerDetailResponse(BaseModel):
    customer: CustomerResponse
    transaction_count: int
    redemption_count: int
    is_active: bool


class AdjustPointsRequest(BaseModel):
    points: int = Field(..., description="Positive to add, negative to deduct")
    description: str = Field(..., min_length=3, max_length=255)
    is_lifetime: bool = Field(
        default=True,
        description="If true, update lifetime_points (affects tier)",
    )


class RestockRequest(BaseModel):
    add_stock: int = Field(..., ge=1, description="Number of stock units to add")


class UpdateRedemptionStatusRequest(BaseModel):
    status: str = Field(..., description="New status: pending | claimed | expired")


class AdminRedemptionItem(BaseModel):
    id: str
    customer_id: str
    customer_email: Optional[str] = None
    customer_name: Optional[str] = None
    reward_id: str
    reward_name: str
    points_used: int
    voucher_code: Optional[str] = None
    status: str
    created_at: str
    expires_at: Optional[str] = None


# ========== Analytics ==========
@router.get("/analytics/overview")
async def analytics_overview(
    _user: dict = Depends(require_perm("admin.loyalty.analytics.read")),
):
    """Get loyalty program analytics overview."""
    db = get_db()
    return await get_overview_analytics(db)


# ========== Customers ==========
@router.get("/customers", response_model=CustomerListResponse)
async def list_loyalty_customers(
    search:     Optional[str]  = Query(None),
    tier:       Optional[str]  = Query(None, description="bronze|silver|gold|all"),
    is_active:  Optional[bool] = Query(None),
    # B8: page/per_page alias (backward compat — skip/limit masih bisa dipakai)
    page:       Optional[int]  = Query(None, ge=1,  description="Halaman (mulai 1). Alternatif skip."),
    per_page:   Optional[int]  = Query(None, ge=1, le=500, description="Item/halaman. Alternatif limit."),
    limit:      int            = Query(50,   ge=1, le=500),
    skip:       int            = Query(0,    ge=0),
    _user: dict = Depends(require_perm("admin.loyalty.read")),
):
    """List loyalty customers with filters + search.
    Pagination: pakai page/per_page ATAU skip/limit (backward compatible).
    """
    db = get_db()
    # Resolve effective skip/limit
    eff_limit = per_page or limit
    eff_skip  = ((page - 1) * eff_limit) if page is not None else skip
    customers, total = await list_customers(
        db,
        search=search,
        tier=tier,
        is_active=is_active,
        limit=eff_limit,
        skip=eff_skip,
    )
    items = [
        CustomerListItem(
            id=c.id,
            email=c.email,
            full_name=c.full_name,
            phone=c.phone,
            loyalty_tier=c.loyalty_tier,
            total_points=c.total_points,
            lifetime_points=c.lifetime_points,
            is_active=c.is_active,
            created_at=c.created_at.isoformat(),
        )
        for c in customers
    ]
    return CustomerListResponse(items=items, total=total, limit=limit, skip=skip)


@router.post(
    "/customers",
    response_model=CustomerResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_loyalty_customer(
    payload: CustomerCreate,
    _user: dict = Depends(require_perm("admin.loyalty.manage_customers")),
):
    """Admin creates a new customer manually."""
    db = get_db()
    try:
        customer = await create_customer(db, payload)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        ) from e
    return CustomerResponse(**customer.dict())


@router.get("/customers/{customer_id}", response_model=CustomerDetailResponse)
async def get_loyalty_customer(
    customer_id: str,
    _user: dict = Depends(require_perm("admin.loyalty.read")),
):
    """Get full detail of a customer with aggregated stats."""
    db = get_db()
    data = await get_customer_with_stats(db, customer_id)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found"
        )
    customer = data["customer"]
    return CustomerDetailResponse(
        customer=CustomerResponse(**customer.dict()),
        transaction_count=data["transaction_count"],
        redemption_count=data["redemption_count"],
        is_active=customer.is_active,
    )


@router.put("/customers/{customer_id}", response_model=CustomerResponse)
async def update_loyalty_customer(
    customer_id: str,
    payload: CustomerUpdate,
    _user: dict = Depends(require_perm("admin.loyalty.manage_customers")),
):
    """Update a customer's profile (full_name, phone, dob, gender)."""
    db = get_db()
    updated = await update_customer(db, customer_id, payload)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found"
        )
    return CustomerResponse(**updated.dict())


@router.post("/customers/{customer_id}/disable", response_model=CustomerResponse)
async def disable_loyalty_customer(
    customer_id: str,
    _user: dict = Depends(require_perm("admin.loyalty.manage_customers")),
):
    """Disable (soft-delete) a customer."""
    db = get_db()
    existing = await get_customer_by_id(db, customer_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found"
        )
    updated = await set_customer_active(db, customer_id, False)
    return CustomerResponse(**updated.dict())


@router.post("/customers/{customer_id}/enable", response_model=CustomerResponse)
async def enable_loyalty_customer(
    customer_id: str,
    _user: dict = Depends(require_perm("admin.loyalty.manage_customers")),
):
    """Re-enable a disabled customer."""
    db = get_db()
    existing = await get_customer_by_id(db, customer_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found"
        )
    updated = await set_customer_active(db, customer_id, True)
    return CustomerResponse(**updated.dict())


@router.post("/customers/{customer_id}/adjust-points")
async def adjust_customer_points(
    customer_id: str,
    payload: AdjustPointsRequest,
    user: dict = Depends(require_perm("admin.loyalty.adjust_points")),
):
    """Adjust customer points (positive or negative) with audit via transaction."""
    db = get_db()
    existing = await get_customer_by_id(db, customer_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found"
        )

    transaction_type = "earn" if payload.points > 0 else "adjustment"
    try:
        transaction = await create_transaction(
            db=db,
            customer_id=customer_id,
            transaction_type=transaction_type,
            points=payload.points,
            description=payload.description,
            reference_type="admin_adjustment",
            created_by=user.get("id"),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        ) from e

    updated = await get_customer_by_id(db, customer_id)
    return {
        "success": True,
        "transaction": LoyaltyTransactionResponse(**transaction.dict()),
        "customer": CustomerResponse(**updated.dict()),
    }


@router.get(
    "/customers/{customer_id}/transactions",
    response_model=List[LoyaltyTransactionResponse],
)
async def get_customer_transaction_log(
    customer_id: str,
    limit: int = Query(100, ge=1, le=500),
    skip: int = Query(0, ge=0),
    _user: dict = Depends(require_perm("admin.loyalty.read")),
):
    """Transaction history for a single customer (admin view)."""
    db = get_db()
    return await get_customer_transactions(db, customer_id, limit=limit, skip=skip)


@router.get(
    "/customers/{customer_id}/redemptions",
    response_model=List[RedemptionResponse],
)
async def get_customer_redemption_log(
    customer_id: str,
    limit: int = Query(100, ge=1, le=500),
    skip: int = Query(0, ge=0),
    _user: dict = Depends(require_perm("admin.loyalty.read")),
):
    """Redemption history for a single customer (admin view)."""
    db = get_db()
    return await get_customer_redemptions(db, customer_id, limit=limit, skip=skip)


# ========== Rewards ==========
@router.post("/rewards/upload-image")
async def upload_reward_image(
    file: UploadFile = File(...),
    _user: dict = Depends(require_perm("admin.loyalty.manage_rewards")),
):
    """Upload an image for a reward. Returns usable /uploads/{filename} URL."""
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type: {file.content_type}. Allowed: jpeg, png, webp",
        )
    content = await file.read()
    if len(content) > MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large ({len(content)/1024/1024:.1f}MB). Max {MAX_SIZE_MB}MB.",
        )
    ext = Path(file.filename).suffix.lower() if file.filename else ".jpg"
    unique_name = f"{uuid.uuid4()}{ext}"
    dest = UPLOAD_DIR / unique_name
    with open(dest, "wb") as f:
        f.write(content)
    return ok_envelope({"url": f"/uploads/{unique_name}", "filename": unique_name})


@router.get("/rewards")
async def list_admin_rewards(
    category: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    skip: int = Query(0, ge=0),
    _user: dict = Depends(require_perm("admin.loyalty.read")),
):
    """List rewards (admin view includes inactive, enriched with redemption_count)."""
    db = get_db()
    rewards = await get_all_rewards_with_stats(
        db,
        category=category,
        is_active=is_active,
        limit=limit,
        skip=skip,
        search=search,
    )
    return rewards


@router.post(
    "/rewards",
    response_model=RewardResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_admin_reward(
    payload: RewardCreate,
    _user: dict = Depends(require_perm("admin.loyalty.manage_rewards")),
):
    """Create new reward."""
    db = get_db()
    reward = await create_reward(db, payload)
    return RewardResponse(**reward.dict())


@router.put("/rewards/{reward_id}", response_model=RewardResponse)
async def update_admin_reward(
    reward_id: str,
    payload: RewardUpdate,
    _user: dict = Depends(require_perm("admin.loyalty.manage_rewards")),
):
    """Update reward."""
    db = get_db()
    reward = await update_reward(db, reward_id, payload)
    if not reward:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Reward not found"
        )
    return RewardResponse(**reward.dict())


@router.post("/rewards/{reward_id}/restock")
async def restock_admin_reward(
    reward_id: str,
    payload: RestockRequest,
    _user: dict = Depends(require_perm("admin.loyalty.manage_rewards")),
):
    """Add stock to a limited-stock reward."""
    db = get_db()
    try:
        reward = await restock_reward(db, reward_id, payload.add_stock)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if not reward:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reward not found")
    return ok_envelope({"reward": RewardResponse(**reward.dict())})


@router.delete("/rewards/{reward_id}")
async def delete_admin_reward(
    reward_id: str,
    _user: dict = Depends(require_perm("admin.loyalty.manage_rewards")),
):
    """Soft-disable a reward (sets is_active=False)."""
    db = get_db()
    existing = await get_reward_by_id(db, reward_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Reward not found"
        )
    updated = await update_reward(db, reward_id, RewardUpdate(is_active=False))
    return ok_envelope({"reward": RewardResponse(**updated.dict())})


# ========== Redemptions ==========
@router.get("/redemptions")
async def list_redemptions(
    limit: int = Query(50, ge=1, le=500),
    skip: int = Query(0, ge=0),
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    _user: dict = Depends(require_perm("admin.loyalty.read")),
):
    """List all redemptions (cross-customer view) with filters, search and total count."""
    db = get_db()
    return await list_all_redemptions_filtered(
        db,
        limit=limit,
        skip=skip,
        status_filter=status_filter,
        search=search,
    )


@router.patch("/redemptions/{redemption_id}/status")
async def update_redemption_status_endpoint(
    redemption_id: str,
    payload: UpdateRedemptionStatusRequest,
    user: dict = Depends(require_perm("admin.loyalty.manage_rewards")),
):
    """Update redemption status (claimed / expired)."""
    db = get_db()
    try:
        updated = await update_redemption_status(
            db, redemption_id, payload.status, updated_by=user.get("id")
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Redemption not found")
    created = updated.get("created_at")
    expires = updated.get("expires_at")
    return {
        "success": True,
        "redemption": {
            "id": updated.get("id"),
            "status": updated.get("status"),
            "reward_name": updated.get("reward_name"),
            "created_at": created.isoformat() if hasattr(created, "isoformat") else str(created),
            "expires_at": expires.isoformat() if expires and hasattr(expires, "isoformat") else None,
        },
    }
