"""Permission & step-matching helpers (perm | role | user modes)."""
from typing import Optional

from core.security import get_user_permissions

from services._approval.delegations import _check_delegation


async def _user_has_any_perm(user: dict, any_of_perms: list[str], *,
                              entity_type: Optional[str] = None) -> bool:
    if not any_of_perms:
        return True  # No requirement
    perms = await get_user_permissions(user)
    if "*" in perms:
        return True
    if any(p in perms for p in any_of_perms):
        return True
    # Check delegation
    return await _check_delegation(user["id"], any_of_perms, entity_type=entity_type)


async def _user_matches_step(user: dict, step: dict, *,
                              entity_type: Optional[str] = None) -> bool:
    """Check if user is eligible to take this step.

    Backwards compatible:
      - If step has only `any_of_perms` (no match_mode), behaves as legacy.
      - If `match_mode` is set, uses that mode primarily; legacy perm check
        is still applied as fallback for "*" superusers.
    """
    perms = await get_user_permissions(user)
    if "*" in perms:
        return True

    mode = step.get("match_mode") or "permission"

    if mode == "user":
        user_ids = step.get("any_of_user_ids") or []
        if user_ids and user["id"] in user_ids:
            return True
        return False

    if mode == "role":
        role_ids = step.get("any_of_role_ids") or []
        user_role_ids = user.get("role_ids") or []
        if role_ids and any(rid in user_role_ids for rid in role_ids):
            return True
        return False

    # Default: permission mode (backwards compat)
    required = step.get("any_of_perms") or []
    if not required:
        return True
    if any(p in perms for p in required):
        return True
    return await _check_delegation(user["id"], required, entity_type=entity_type)
