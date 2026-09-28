"""Sprint D — Dynamic CMS Backend Models untuk Compro Content.

Collections:
- public_brands: Brand entities (The Coffeeshop, The Restaurant, The Bistro, The Bakery)
- public_outlets: Outlet locations dengan lat/lng untuk map
- public_news: News/blog articles untuk News page
- public_menu_items: Menu items per brand untuk Menu page
"""
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime


# ============================================================================
# PUBLIC BRANDS
# ============================================================================

class PublicBrand(BaseModel):
    """Brand entity untuk Compro public pages."""
    id: str
    code: str  # e.g., "the-coffeeshop", "the-restaurant"
    name: str  # e.g., "The Coffeeshop Bistronomie"
    tagline: str
    short_desc: str
    story: str  # Long description/story
    color: str  # Brand color hex
    accent_color: str  # Brand accent color rgba
    tags: List[str]  # e.g., ["Fine Dining", "French", "Wine Bar"]
    hero_image: str  # URL
    card_image: str  # URL untuk card thumbnails
    signature_dishes: List[dict]  # [{"name": "...", "desc": "...", "price": "..."}]
    established: str  # Year
    status: str = "published"  # published | draft
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None


class CreateBrandRequest(BaseModel):
    code: str
    name: str
    tagline: str
    short_desc: str
    story: str
    color: str = "#8B4513"
    accent_color: str = "rgba(139,69,19,0.15)"
    tags: List[str] = []
    hero_image: str
    card_image: str
    signature_dishes: List[dict] = []
    established: str
    status: str = "published"


class SEOFields(BaseModel):
    """SEO metadata for CMS content."""
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    seo_og_image: Optional[str] = None
    seo_slug: Optional[str] = None


class UpdateBrandRequest(BaseModel):
    name: Optional[str] = None
    tagline: Optional[str] = None
    short_desc: Optional[str] = None
    story: Optional[str] = None
    color: Optional[str] = None
    accent_color: Optional[str] = None
    tags: Optional[List[str]] = None
    hero_image: Optional[str] = None
    card_image: Optional[str] = None
    signature_dishes: Optional[List[dict]] = None
    established: Optional[str] = None
    status: Optional[str] = None
    # SEO fields
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    seo_og_image: Optional[str] = None
    seo_slug: Optional[str] = None
    # Scheduling fields
    publish_at: Optional[datetime] = None
    unpublish_at: Optional[datetime] = None


# ============================================================================
# PUBLIC OUTLETS
# ============================================================================

class PublicOutlet(BaseModel):
    """Outlet location entity untuk Interactive Map."""
    id: str
    brand_id: str  # Reference to public_brands.id
    brand_name: str  # Denormalized for convenience
    code: str  # e.g., "the-coffeeshop-bandung"
    name: str  # e.g., "The Coffeeshop Bistronomie Bandung"
    address: str
    area: str  # e.g., "Bandung"
    phone: str
    email: str
    hours_weekday: str  # e.g., "07:00 – 22:00"
    hours_weekend: str  # e.g., "08:00 – 23:00"
    features: List[str]  # e.g., ["Dine In", "Takeaway", "Delivery"]
    map_url: str  # Google Maps URL
    lat: float  # Latitude
    lng: float  # Longitude
    status: str = "published"
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None


class CreateOutletRequest(BaseModel):
    brand_id: str
    code: str
    name: str
    address: str
    area: str
    phone: str
    email: str
    hours_weekday: str = "07:00 – 22:00"
    hours_weekend: str = "08:00 – 23:00"
    features: List[str] = []
    map_url: str = ""
    lat: float
    lng: float
    status: str = "published"


class UpdateOutletRequest(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    area: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    hours_weekday: Optional[str] = None
    hours_weekend: Optional[str] = None
    features: Optional[List[str]] = None
    map_url: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    status: Optional[str] = None
    image: Optional[str] = None
    # Scheduling fields
    publish_at: Optional[datetime] = None
    unpublish_at: Optional[datetime] = None


# ============================================================================
# PUBLIC NEWS
# ============================================================================

class PublicNews(BaseModel):
    """News/blog article untuk News page."""
    id: str
    title: str
    excerpt: str  # Short description
    content: str  # Full markdown/text content (optional untuk MVP)
    date: str  # ISO date string
    category: str  # e.g., "Events", "Announcement", "Awards"
    brand_id: Optional[str] = None  # Optional brand association
    image: str  # URL
    status: str = "published"  # published | draft
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None


class CreateNewsRequest(BaseModel):
    title: str
    excerpt: str
    content: str = ""
    date: str
    category: str
    brand_id: Optional[str] = None
    image: str
    status: str = "published"


class UpdateNewsRequest(BaseModel):
    title: Optional[str] = None
    excerpt: Optional[str] = None
    content: Optional[str] = None
    date: Optional[str] = None
    category: Optional[str] = None
    brand_id: Optional[str] = None
    image: Optional[str] = None
    status: Optional[str] = None
    # SEO fields
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    seo_og_image: Optional[str] = None
    seo_slug: Optional[str] = None
    # Scheduling fields
    publish_at: Optional[datetime] = None
    unpublish_at: Optional[datetime] = None


# ============================================================================
# PUBLIC MENU ITEMS
# ============================================================================

class PublicMenuItem(BaseModel):
    """Menu item per brand."""
    id: str
    brand_id: str  # Reference to public_brands.id
    brand_name: str  # Denormalized
    code: str  # e.g., "a1", "d1"
    category: str  # e.g., "Starters", "Mains", "Desserts"
    name: str
    description: str
    price: float  # In Rupiah
    image: Optional[str] = None  # Optional menu item image
    tags: List[str] = []  # e.g., ["Vegetarian", "Spicy", "Chef's Special"]
    available: bool = True  # Availability toggle
    status: str = "published"
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None


class CreateMenuItemRequest(BaseModel):
    brand_id: str
    code: str
    category: str
    name: str
    description: str
    price: float
    image: Optional[str] = None
    tags: List[str] = []
    available: bool = True
    status: str = "published"


class UpdateMenuItemRequest(BaseModel):
    category: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    image: Optional[str] = None
    tags: Optional[List[str]] = None
    available: Optional[bool] = None
    status: Optional[str] = None
    # Scheduling fields
    publish_at: Optional[datetime] = None
    unpublish_at: Optional[datetime] = None
