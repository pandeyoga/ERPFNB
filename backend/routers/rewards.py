"""Rewards API routes."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional

from core.db import get_db
from core.security import require_perm
from models.reward import (
    RewardCreate,
    RewardResponse,
    RewardUpdate,
    RedemptionCreate,
    RedemptionResponse,
)
from services.reward_service import (
    create_reward,
    get_all_rewards,
    get_reward_by_id,
    update_reward,
    redeem_reward,
    get_customer_redemptions,
)
from routers.loyalty import get_current_customer

router = APIRouter(prefix="/api/loyalty/rewards", tags=["loyalty-rewards"])


@router.get("", response_model=List[RewardResponse])
async def list_rewards(
    category: Optional[str] = None,
    is_active: bool = True,
    limit: int = Query(50, ge=1, le=200),
    skip: int  = Query(0,  ge=0)
):
    """Get all rewards (public endpoint)."""
    db = get_db()
    rewards = await get_all_rewards(db, category=category, is_active=is_active, limit=limit, skip=skip)
    return [RewardResponse(**r.dict()) for r in rewards]


@router.get("/{reward_id}", response_model=RewardResponse)
async def get_reward(reward_id: str):
    """Get reward by ID."""
    db = get_db()
    reward = await get_reward_by_id(db, reward_id)
    
    if not reward:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reward not found"
        )
    
    return RewardResponse(**reward.dict())


@router.post("/redeem", response_model=RedemptionResponse)
async def redeem_reward_endpoint(
    redemption_data: RedemptionCreate,
    customer=Depends(get_current_customer)
):
    """Redeem a reward (customer authenticated)."""
    db = get_db()
    
    try:
        redemption = await redeem_reward(db, customer.id, redemption_data.reward_id)
        return redemption
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/my/redemptions", response_model=List[RedemptionResponse])
async def get_my_redemptions(
    limit: int = Query(50, ge=1, le=200),
    skip: int  = Query(0,  ge=0),
    customer=Depends(get_current_customer)
):
    """Get customer's redemption history."""
    db = get_db()
    redemptions = await get_customer_redemptions(db, customer.id, limit=limit, skip=skip)
    return redemptions


# Admin endpoints — dilindungi dengan require_perm (A4 fix: SEC-005)
@router.post("/admin/create", response_model=RewardResponse, status_code=status.HTTP_201_CREATED)
async def create_reward_admin(
    reward_data: RewardCreate,
    user: dict = Depends(require_perm("admin.loyalty.manage")),
):
    """Create new reward (admin only)."""
    db = get_db()
    reward = await create_reward(db, reward_data)
    return RewardResponse(**reward.dict())


@router.put("/admin/{reward_id}", response_model=RewardResponse)
async def update_reward_admin(
    reward_id: str,
    update_data: RewardUpdate,
    user: dict = Depends(require_perm("admin.loyalty.manage")),
):
    """Update reward (admin only)."""
    db = get_db()
    
    reward = await update_reward(db, reward_id, update_data)
    if not reward:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reward not found"
        )
    
    return RewardResponse(**reward.dict())
