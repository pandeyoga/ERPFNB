"""Customer model for CRM/Loyalty system."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class CustomerBase(BaseModel):
    """Base customer fields."""
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None  # YYYY-MM-DD
    gender: Optional[str] = None  # male, female, other


class CustomerCreate(CustomerBase):
    """Customer creation (registration)."""
    password: str = Field(..., min_length=8)


class CustomerUpdate(BaseModel):
    """Customer profile update."""
    full_name: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None


class CustomerInDB(CustomerBase):
    """Customer as stored in database."""
    id: str
    hashed_password: Optional[str] = None
    email_verified: bool = False
    is_active: bool = True
    loyalty_tier: str = "bronze"  # bronze, silver, gold
    total_points: int = 0
    lifetime_points: int = 0  # For tier calculation
    referral_code: Optional[str] = None  # Unique referral code e.g. TORA-XK9M
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CustomerResponse(CustomerBase):
    """Customer response (public)."""
    id: str
    email_verified: bool
    loyalty_tier: str
    total_points: int
    lifetime_points: int
    referral_code: Optional[str] = None
    date_of_birth: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class LoyaltyCardResponse(BaseModel):
    """Digital loyalty card data."""
    customer_id: str
    customer_name: str
    loyalty_tier: str
    total_points: int
    card_number: str  # Format: TORA-XXXX-XXXX
    qr_data: str  # QR code data
    tier_benefits: dict


def generate_card_number(customer_id: str) -> str:
    """Generate loyalty card number from customer ID."""
    # Format: TORA-XXXX-XXXX (first 4 and last 4 chars of UUID)
    clean_id = customer_id.replace("-", "").upper()
    return f"TORA-{clean_id[:4]}-{clean_id[-4:]}"


def calculate_tier(lifetime_points: int) -> str:
    """Calculate loyalty tier based on lifetime points.
    
    Bronze: 0-999 points
    Silver: 1000-4999 points
    Gold: 5000+ points
    """
    if lifetime_points >= 5000:
        return "gold"
    elif lifetime_points >= 1000:
        return "silver"
    else:
        return "bronze"


def get_tier_benefits(tier: str) -> dict:
    """Get benefits for each tier."""
    benefits = {
        "bronze": {
            "discount": "5%",
            "points_multiplier": 1.0,
            "birthday_bonus": 100,
            "perks": ["Earn 1 point per Rp 10.000", "Birthday bonus points"]
        },
        "silver": {
            "discount": "10%",
            "points_multiplier": 1.2,
            "birthday_bonus": 250,
            "perks": ["Earn 1.2x points", "10% discount on all purchases", "Birthday bonus points", "Priority support"]
        },
        "gold": {
            "discount": "15%",
            "points_multiplier": 1.5,
            "birthday_bonus": 500,
            "perks": ["Earn 1.5x points", "15% discount on all purchases", "Birthday bonus points", "VIP support", "Exclusive events"]
        }
    }
    return benefits.get(tier, benefits["bronze"])
