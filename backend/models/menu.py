"""Menu models for E-Menu system (per brand)."""
from pydantic import BaseModel, Field
from typing import Optional, List


# =================== MENU ITEM MODELS ===================

class CreateMenuItemRequest(BaseModel):
    """Create menu item request."""
    brand_id: str
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    price: float = Field(..., gt=0)
    category: str = Field(..., min_length=1)
    dietary_tags: List[str] = Field(default_factory=list)  # e.g., ["vegetarian", "halal", "spicy"]
    image_url: Optional[str] = None
    is_featured: bool = False
    is_available: bool = True
    sort_order: int = 0


class UpdateMenuItemRequest(BaseModel):
    """Update menu item request."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    price: Optional[float] = Field(None, gt=0)
    category: Optional[str] = None
    dietary_tags: Optional[List[str]] = None
    image_url: Optional[str] = None
    is_featured: Optional[bool] = None
    is_available: Optional[bool] = None
    sort_order: Optional[int] = None


# =================== CATEGORY MODELS ===================

class CreateMenuCategoryRequest(BaseModel):
    """Create menu category request."""
    brand_id: str
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    sort_order: int = 0


class UpdateMenuCategoryRequest(BaseModel):
    """Update menu category request."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    sort_order: Optional[int] = None


# =================== PDF MENU MODELS ===================

class UploadMenuPDFRequest(BaseModel):
    """Upload menu PDF request."""
    brand_id: str
    pdf_url: str
    is_active: bool = True
    version: Optional[str] = None  # e.g., "2026-05", "Summer 2026"


class UpdateMenuPDFRequest(BaseModel):
    """Update menu PDF request."""
    is_active: Optional[bool] = None
    version: Optional[str] = None
