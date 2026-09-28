"""_journal/core.py — core journal operations (reverse)."""



async def reverse_journal(je_id: str, *, user_id: str, reason: str) -> dict:
    """FIN-02: single implementation lives in services._finance.journals.reverse_journal."""
    from core.db import get_db
    from services._finance.journals import reverse_journal as _impl
    user = await get_db().users.find_one({"id": user_id}) or {"id": user_id}
    return await _impl(je_id, user=user, reason=reason)
