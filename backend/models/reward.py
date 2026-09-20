"""Reward model for loyalty program."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class RewardBase(BaseModel):
    """Base reward fields."""
    name: str
    description: str
    points_required: int
    category: str  # voucher, merchandise, experience
    image_url: Optional[str] = None
    stock: Optional[int] = None  # None = unlimited
    is_active: bool = True


class RewardCreate(RewardBase):
    """Create reward."""
    pass


class RewardUpdate(BaseModel):
    """Update reward."""
    name: Optional[str] = None
    description: Optional[str] = None
    points_required: Optional[int] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    stock: Optional[int] = None
    is_active: Optional[bool] = None


class RewardInDB(RewardBase):
    """Reward in database."""
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RewardResponse(BaseModel):
    """Reward response."""
    id: str
    name: str
    description: str
    points_required: int
    category: str
    image_url: Optional[str] = None
    stock: Optional[int] = None
    is_active: bool
    created_at: datetime
    redemption_count: Optional[int] = 0

    class Config:
        from_attributes = True


class RewardAdminResponse(RewardResponse):
    """Reward response with admin stats."""
    redemption_count: int = 0


class RedemptionCreate(BaseModel):
    """Redeem reward request."""
    reward_id: str


class RedemptionResponse(BaseModel):
    """Redemption response."""
    id: str
    customer_id: str
    reward_id: str
    reward_name: str
    points_used: int
    voucher_code: Optional[str] = None
    status: str  # pending, claimed, expired
    created_at: datetime
    expires_at: Optional[datetime] = None

    class Config:
        from_attributes = True
