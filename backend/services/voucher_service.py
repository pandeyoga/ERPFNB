"""Voucher service untuk Sprint C - Voucher Redemption di Outlet.

Configurable rules via System Settings:
  - voucher.rules.allow_multiple_per_sale
  - voucher.rules.require_customer_phone
  - voucher.rules.max_discount_amount
  - voucher.ui.accepted_formats_hint
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from core.db import get_db
from services.system_settings_service import get_value

logger = logging.getLogger("aurora.voucher")


async def get_voucher_rules() -> dict:
    """Ambil konfigurasi rules voucher dari System Settings.
    
    Returns dict dengan keys:
      - allow_multiple_per_sale (bool, default False)
      - require_customer_phone (bool, default False)
      - max_discount_amount (float|None)
      - accepted_formats_hint (str, untuk helper text UI)
    """
    return {
        "allow_multiple_per_sale": (await get_value("voucher.rules.allow_multiple_per_sale") or "false").lower() == "true",
        "require_customer_phone": (await get_value("voucher.rules.require_customer_phone") or "false").lower() == "true",
        "max_discount_amount": _parse_float(await get_value("voucher.rules.max_discount_amount")),
        "accepted_formats_hint": await get_value("voucher.ui.accepted_formats_hint") or "Masukkan kode voucher (contoh: VCH12345)",
    }


def _parse_float(val: Optional[str]) -> Optional[float]:
    if not val:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


async def validate_voucher(
    code: str,
    *,
    outlet_id: Optional[str] = None,
    sales_date: Optional[str] = None,
    customer_phone: Optional[str] = None,
) -> dict:
    """Validasi voucher untuk digunakan di Daily Sales.
    
    Args:
        code: Kode voucher
        outlet_id: Optional outlet_id untuk validasi outlet-specific
        sales_date: Optional tanggal sales untuk validasi periode
        customer_phone: Optional customer phone untuk validasi customer-bound voucher
    
    Returns:
        {
            "valid": bool,
            "status": "valid" | "invalid" | "expired" | "used" | "customer_mismatch" | "not_allowed",
            "discount_type": "percentage" | "fixed" | None,
            "discount_value": float,
            "reward_name": str,
            "expiry": str (ISO date) | None,
            "customer_id": str | None,
            "message": str (error/info message)
        }
    """
    db = get_db()
    rules = await get_voucher_rules()
    
    code_clean = (code or "").strip().upper()
    if not code_clean:
        return {
            "valid": False,
            "status": "invalid",
            "discount_type": None,
            "discount_value": 0,
            "reward_name": "",
            "expiry": None,
            "customer_id": None,
            "message": "Kode voucher wajib diisi",
        }
    
    # Cari redemption dengan voucher_code (dari reward_service.redeem_reward)
    redemption = await db.redemptions.find_one({"voucher_code": code_clean})
    if not redemption:
        return {
            "valid": False,
            "status": "invalid",
            "discount_type": None,
            "discount_value": 0,
            "reward_name": "",
            "expiry": None,
            "customer_id": None,
            "message": f"Kode voucher '{code_clean}' tidak ditemukan",
        }
    
    # Check status
    if redemption.get("status") == "expired":
        return {
            "valid": False,
            "status": "expired",
            "discount_type": None,
            "discount_value": 0,
            "reward_name": redemption.get("reward_name", ""),
            "expiry": redemption.get("expires_at"),
            "customer_id": redemption.get("customer_id"),
            "message": "Voucher sudah kadaluarsa",
        }
    
    if redemption.get("status") == "claimed":
        return {
            "valid": False,
            "status": "used",
            "discount_type": None,
            "discount_value": 0,
            "reward_name": redemption.get("reward_name", ""),
            "expiry": redemption.get("expires_at"),
            "customer_id": redemption.get("customer_id"),
            "message": "Voucher sudah digunakan",
        }
    
    # Check expiry date (handle both datetime objects and ISO strings)
    expires_at = redemption.get("expires_at")
    if expires_at:
        try:
            if isinstance(expires_at, datetime):
                expiry_dt = expires_at if expires_at.tzinfo else expires_at.replace(tzinfo=timezone.utc)
            else:
                expiry_dt = datetime.fromisoformat(str(expires_at).replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > expiry_dt:
                # Auto-mark as expired
                await db.redemptions.update_one(
                    {"id": redemption["id"]},
                    {"$set": {"status": "expired", "updated_at": datetime.now(timezone.utc)}},
                )
                return {
                    "valid": False,
                    "status": "expired",
                    "discount_type": None,
                    "discount_value": 0,
                    "reward_name": redemption.get("reward_name", ""),
                    "expiry": expires_at,
                    "customer_id": redemption.get("customer_id"),
                    "message": "Voucher sudah kadaluarsa",
                }
        except (ValueError, AttributeError):
            pass
    
    # Check customer binding (jika rules require_customer_phone)
    voucher_customer_id = redemption.get("customer_id")
    if voucher_customer_id and customer_phone:
        # Lookup customer by phone untuk match customer_id
        from services.customer_service import get_customer_by_phone
        customer = await get_customer_by_phone(db, customer_phone)
        if not customer or customer.id != voucher_customer_id:
            if rules["require_customer_phone"]:
                return {
                    "valid": False,
                    "status": "customer_mismatch",
                    "discount_type": None,
                    "discount_value": 0,
                    "reward_name": redemption.get("reward_name", ""),
                    "expiry": expires_at,
                    "customer_id": voucher_customer_id,
                    "message": "Voucher ini milik customer lain",
                }
    
    # Ambil reward detail untuk discount info
    reward_id = redemption.get("reward_id")
    reward = await db.rewards.find_one({"id": reward_id}) if reward_id else None
    
    # Default discount: assume voucher is fixed discount of 10000 (configurable via reward schema)
    discount_type = "fixed"  # or "percentage"
    discount_value = 10000.0  # default; should come from reward.discount_value jika ada
    
    if reward:
        # Jika reward memiliki field discount_type dan discount_value
        discount_type = reward.get("discount_type") or "fixed"
        discount_value = float(reward.get("discount_value") or 10000)
    
    # Apply max_discount_amount cap
    if rules["max_discount_amount"] and discount_value > rules["max_discount_amount"]:
        discount_value = rules["max_discount_amount"]
    
    return {
        "valid": True,
        "status": "valid",
        "discount_type": discount_type,
        "discount_value": discount_value,
        "reward_name": redemption.get("reward_name", ""),
        "expiry": expires_at,
        "customer_id": voucher_customer_id,
        "message": f"Voucher valid - diskon {discount_type}: {discount_value}",
        "redemption_id": redemption.get("id"),
    }


async def consume_voucher(
    code: str,
    daily_sales_id: str,
    *,
    customer_phone: Optional[str] = None,
) -> bool:
    """Mark voucher as used (claim redemption).
    
    Idempotent: jika sudah claimed dengan reference_id sama, skip.
    
    Args:
        code: Voucher code
        daily_sales_id: Daily sales ID sebagai reference
        customer_phone: Optional customer phone
    
    Returns:
        True jika berhasil claimed, False jika sudah claimed sebelumnya
    """
    db = get_db()
    code_clean = (code or "").strip().upper()
    if not code_clean:
        return False
    
    redemption = await db.redemptions.find_one({"voucher_code": code_clean})
    if not redemption:
        logger.warning("consume_voucher: code %s not found", code_clean)
        return False
    
    # Idempotency guard: jika sudah claimed dengan reference_id yang sama, skip
    if redemption.get("status") == "claimed" and redemption.get("claimed_reference_id") == daily_sales_id:
        logger.info("consume_voucher: code %s already claimed for daily_sales %s", code_clean, daily_sales_id)
        return True
    
    # Jika status bukan pending, tidak bisa consume
    if redemption.get("status") != "pending":
        logger.warning("consume_voucher: code %s has status %s, cannot consume", code_clean, redemption.get("status"))
        return False
    
    # Mark as claimed
    await db.redemptions.update_one(
        {"id": redemption["id"]},
        {
            "$set": {
                "status": "claimed",
                "claimed_at": datetime.now(timezone.utc).isoformat(),
                "claimed_reference_type": "daily_sales",
                "claimed_reference_id": daily_sales_id,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )
    logger.info("consume_voucher: code %s claimed for daily_sales %s", code_clean, daily_sales_id)
    return True
