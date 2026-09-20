"""/api/ai router — autocomplete + categorization (Phase 3 integration)."""
from typing import Optional
from fastapi import APIRouter, Body, Depends, Query

from core.exceptions import ok_envelope
from core.security import require_perm
from services import ai_service, ai_journal_generator_service

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.get("/items/suggest")
async def items_suggest(q: str = Query(..., min_length=1),
                         limit: int = Query(8, ge=1, le=20),
                         outlet_id: Optional[str] = Query(None),
                         user: dict = Depends(require_perm("ai.autocomplete.use"))):
    """Item autocomplete with last-vendor/price hint (Phase 9C).

    `outlet_id` (optional) scopes the last-GR lookup to a specific outlet
    so e.g. KDO/BDO requests for outlet A see vendor history for outlet A.
    """
    return ok_envelope(await ai_service.suggest_items(q, limit=limit, outlet_id=outlet_id))


@router.get("/vendors/suggest")
async def vendors_suggest(q: str = Query(..., min_length=1),
                           limit: int = Query(8, ge=1, le=20),
                           user: dict = Depends(require_perm("ai.autocomplete.use"))):
    return ok_envelope(await ai_service.suggest_vendors(q, limit=limit))


@router.post("/categorize")
async def categorize(payload: dict = Body(...),
                      user: dict = Depends(require_perm("ai.categorize.use"))):
    desc = payload.get("description", "")
    amount = float(payload.get("amount", 0) or 0)
    outlet_id = payload.get("outlet_id")
    suggestion = await ai_service.categorize_expense(desc, amount, outlet_id)
    return ok_envelope(suggestion)


@router.post("/categorize/learn")
async def categorize_learn(payload: dict = Body(...),
                            user: dict = Depends(require_perm("ai.categorize.use"))):
    """Learn a categorization rule.

    Body (either form is accepted):
      {"pattern": "...", "gl_account_id": "..."}             # explicit pattern (preferred)
      {"description": "...", "gl_account_id": "..."}         # derived from keywords (legacy)
    """
    await ai_service.learn_categorization(
        payload.get("description", ""),
        payload.get("gl_account_id", ""),
        user_id=user["id"],
        pattern=payload.get("pattern"),
    )
    return ok_envelope({"message": "Learned"})


# =================== OCR (Phase 5 + Phase 8C) ===================
@router.post("/extract-receipt", deprecated=True)
async def extract_receipt(payload: dict = Body(...),
                           user: dict = Depends(require_perm("ai.ocr.use"))):
    """[DEPRECATED] Extract structured fields from a receipt image (base64).

    DEPRECATED: use POST /api/ai/ocr/receipt instead (Phase 8C) — it integrates
    with Phase 8B uploads (`file_id`) and benefits from server-side caching.
    Kept for backward compatibility; not used by the current frontend.

    Body:
      {
        "image_base64": "<base64 string, NO data: prefix>",
        "mime_type":    "image/jpeg" | "image/png" | "image/webp",
        "use_cache":    true (default) — short-circuits on prior identical image
      }

    Returns parsed receipt dict (or {error: ...} on failure).
    Non-blocking: caller should always allow manual override.

    NOTE: Prefer the new POST /api/ai/ocr/receipt endpoint with `file_id` —
    it integrates with Phase 8B uploads and benefits from server-side caching.
    """
    from services import ai_ocr_service
    image_b64 = payload.get("image_base64") or ""
    if not image_b64:
        return ok_envelope({"error": "image_base64 required"})
    # Strip data URL prefix if user accidentally included it
    if image_b64.startswith("data:"):
        comma = image_b64.find(",")
        if comma > 0:
            image_b64 = image_b64[comma + 1:]
    mime_type = (payload.get("mime_type") or "image/jpeg").lower()
    result = await ai_ocr_service.extract_receipt(
        image_base64=image_b64,
        mime_type=mime_type,
        use_cache=payload.get("use_cache", True),
    )
    return ok_envelope(result)


@router.post("/ocr/receipt")
async def ocr_receipt(payload: dict = Body(...),
                      user: dict = Depends(require_perm("ai.ocr.use"))):
    """Phase 8C — preferred OCR endpoint.

    Body (one of these is required):
      { "file_id": "<attachment id from Phase 8B uploads>", "use_cache": true }
      { "image_base64": "...", "mime_type": "image/jpeg", "use_cache": true }

    Behavior:
      - If `file_id` is provided, the file is loaded server-side from disk and
        SHA-256-hashed for cache lookup. This is the preferred path because:
        (1) avoids round-tripping the bytes through the request body;
        (2) ties the OCR result to a persisted attachment for audit;
        (3) cache hit is automatic when the same file is re-processed.
      - On low confidence or error the caller should preserve manual entry.

    Response shape:
      { vendor_name, vendor_npwp, receipt_no, receipt_date, subtotal, tax,
        service, total, items[], currency, confidence_overall,
        confidence_per_field, _cache_hit, _image_hash }
    """
    from services import ai_ocr_service

    file_id = (payload.get("file_id") or "").strip()
    use_cache = payload.get("use_cache", True)

    if file_id:
        result = await ai_ocr_service.extract_from_file_id(
            file_id, use_cache=use_cache, user=user,
        )
        return ok_envelope(result)

    image_b64 = payload.get("image_base64") or ""
    if not image_b64:
        return ok_envelope({"error": "file_id atau image_base64 wajib"})
    if image_b64.startswith("data:"):
        comma = image_b64.find(",")
        if comma > 0:
            image_b64 = image_b64[comma + 1:]
    mime_type = (payload.get("mime_type") or "image/jpeg").lower()
    result = await ai_ocr_service.extract_receipt(
        image_base64=image_b64,
        mime_type=mime_type,
        use_cache=use_cache,
    )
    return ok_envelope(result)


@router.get("/ocr/cache-stats")
async def ocr_cache_stats(user: dict = Depends(require_perm("ai.ocr.use"))):
    """Diagnostic — returns cache size + hit count for the OCR cache."""
    from services import ai_ocr_service
    return ok_envelope(await ai_ocr_service.cache_stats())


# =================== PHASE 9C+ — AI VARIANCE EXPLAINER (Opname) ===================
@router.post("/opname/{session_id}/explain-variance")
async def explain_opname_variance(
    session_id: str,
    payload: dict = Body(default={}),
    user: dict = Depends(require_perm("outlet.opname.execute")),
):
    """Generate AI-powered explanation for opname variance.

    Loads the opname session by id, extracts variance lines, calls the LLM
    via emergentintegrations, and returns:
      { summary, top_drivers[], recommended_actions[], confidence }

    Non-blocking: failures return { error: "..." } and UI shows manual variance.
    """
    from services import ai_variance_service
    from core.db import get_db

    db = get_db()
    sess = await db.opname_sessions.find_one({"id": session_id})
    if not sess:
        return ok_envelope({"error": "Sesi opname tidak ditemukan"})

    # Try to enrich session with outlet_name for the prompt
    outlet_name = None
    if sess.get("outlet_id"):
        o = await db.outlets.find_one({"id": sess["outlet_id"]})
        outlet_name = (o or {}).get("name")

    session_info = {
        "id": sess.get("id"),
        "outlet_id": sess.get("outlet_id"),
        "outlet_name": outlet_name or sess.get("outlet_id"),
        "opname_date": sess.get("opname_date"),
        "period": sess.get("period"),
        "counted_items": sess.get("counted_items") or 0,
        "total_items": sess.get("total_items") or 0,
        "total_variance_value": sess.get("total_variance_value") or 0,
    }

    # Build lines with computed variance (use server-side data as authoritative)
    raw_lines = sess.get("lines") or []
    lines = []
    for ln in raw_lines:
        if ln.get("counted_qty") is None:
            continue
        system_qty = float(ln.get("system_qty") or 0)
        counted_qty = float(ln.get("counted_qty") or 0)
        variance = counted_qty - system_qty
        unit_cost = float(ln.get("unit_cost") or 0)
        lines.append({
            "item_id": ln.get("item_id"),
            "item_name": ln.get("item_name") or "-",
            "unit": ln.get("unit") or "",
            "system_qty": system_qty,
            "counted_qty": counted_qty,
            "variance": variance,
            "variance_value": variance * unit_cost,
        })

    top_n = int(payload.get("top_n", 10) or 10)
    top_n = max(3, min(top_n, 25))

    result = await ai_variance_service.explain_opname_variance(
        session=session_info, lines=lines, top_n=top_n,
    )
    return ok_envelope(result)


# =================== PHASE 9D — EXECUTIVE Q&A (TOOL-CALLING) ===================
@router.post("/exec-qa")
async def exec_qa(
    payload: dict = Body(...),
    user: dict = Depends(require_perm("ai.exec_qa.use")),
):
    """Tool-calling Executive Q&A.

    Body: {"question": "...", "session_id": "..." (optional)}
    Returns: {answer, tool_calls[], session_id, history[]}
    """
    from services import ai_executive_qa_service
    question = (payload.get("question") or "").strip()
    session_id = payload.get("session_id")
    return ok_envelope(await ai_executive_qa_service.ask(
        question, user=user, session_id=session_id,
    ))


@router.get("/exec-qa/sessions")
async def exec_qa_sessions(
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("ai.exec_qa.use")),
):
    """List recent Q&A sessions for the current user."""
    from services import ai_executive_qa_service
    return ok_envelope(await ai_executive_qa_service.list_sessions(user, limit=limit))


@router.delete("/exec-qa/sessions/{session_id}")
async def exec_qa_delete(
    session_id: str,
    user: dict = Depends(require_perm("ai.exec_qa.use")),
):
    """Delete a Q&A session (only if owned by current user)."""
    from services import ai_executive_qa_service
    deleted = await ai_executive_qa_service.delete_session(session_id, user)
    return ok_envelope({"deleted": deleted})


@router.get("/exec-qa/tools")
async def exec_qa_tools(
    user: dict = Depends(require_perm("ai.exec_qa.use")),
):
    """Diagnostic — returns the read-only tool catalog used by exec-qa."""
    from services import ai_executive_qa_service
    return ok_envelope({
        "tools": [
            {"name": k, "params": v["params"], "desc": v["desc"]}
            for k, v in ai_executive_qa_service.TOOL_REGISTRY.items()
        ],
        "model": ai_executive_qa_service.MODEL,
        "provider": ai_executive_qa_service.PROVIDER,
    })


# =================== PHASE 9D — VENDOR RECOMMENDATION ===================
@router.post("/vendor-recommend")
async def vendor_recommend(
    payload: dict = Body(...),
    user: dict = Depends(require_perm("ai.vendor_recommend.use")),
):
    """Recommend top vendors for an item (or for a PR's items).

    Body: one of
      {"item_id": "...", "top_k": 3 (optional, default 3)}
      {"pr_id":   "...", "top_k": 3 (optional, default 3)}
    """
    from services import ai_vendor_service
    top_k = int(payload.get("top_k", 3) or 3)
    top_k = max(1, min(top_k, 5))

    item_id = (payload.get("item_id") or "").strip()
    pr_id = (payload.get("pr_id") or "").strip()

    if item_id:
        return ok_envelope(await ai_vendor_service.recommend_for_item(item_id, top_k=top_k))
    if pr_id:
        return ok_envelope(await ai_vendor_service.recommend_for_pr(pr_id, top_k=top_k))
    return ok_envelope({"error": "item_id atau pr_id wajib"})



# =================== AI JOURNAL GENERATOR (Fase 1 - Excel Migration) ===================
@router.post("/generate-journal-entry")
async def generate_journal_entry(
    payload: dict = Body(...),
    user: dict = Depends(require_perm("finance.journal_entry.create")),
):
    """Generate journal entry dari natural language description.
    
    Body:
    {
        "user_input": "Bayar sewa gedung The Bistro bulan Mei 2026 Rp 50 juta",
        "context": {
            "outlet_id": "optional",
            "brand_id": "optional",
            "date": "optional YYYY-MM-DD"
        }
    }
    
    Response:
    {
        "entry_date": "YYYY-MM-DD",
        "description": "Generated description",
        "lines": [...],
        "confidence": 0.0-1.0,
        "warnings": []
    }
    """
    user_input = payload.get("user_input", "").strip()
    context = payload.get("context") or {}
    
    if not user_input:
        return ok_envelope({"error": "user_input wajib diisi"})
    
    result = await ai_journal_generator_service.generate_journal_entry(
        user_input=user_input,
        context=context,
        user=user,
    )
    
    return ok_envelope(result)
