"""Loyalty transaction model."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class LoyaltyTransactionBase(BaseModel):
    """Base loyalty transaction fields."""
    customer_id: str
    transaction_type: str  # earn, redeem, adjustment, expire
    points: int  # Positive for earn, negative for redeem
    description: str
    reference_type: Optional[str] = None  # sale, reward, manual, etc.
    reference_id: Optional[str] = None


class LoyaltyTransactionCreate(LoyaltyTransactionBase):
    """Create loyalty transaction."""
    pass


class LoyaltyTransactionInDB(LoyaltyTransactionBase):
    """Loyalty transaction in database."""
    id: str
    created_at: datetime
    created_by: Optional[str] = None  # User ID who created (for manual adjustments)

    class Config:
        from_attributes = True


class LoyaltyTransactionResponse(BaseModel):
    """Loyalty transaction response."""
    id: str
    transaction_type: str
    points: int
    description: str
    created_at: datetime

    class Config:
        from_attributes = True
