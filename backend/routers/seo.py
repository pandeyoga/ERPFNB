"""
SEO Management Router — Smart SEO Optimization Module
Endpoints:
  Public:  GET  /api/seo/public          — read override for a page path
  Admin:   GET  /api/seo/pages           — list all SEO settings
           POST /api/seo/pages           — create/upsert SEO setting
           PUT  /api/seo/pages/{id}      — update
           DELETE /api/seo/pages/{id}    — delete
  AI:      POST /api/seo/ai/analyze      — analyze keywords → intent + clusters
           POST /api/seo/ai/generate     — generate title/description from keywords
"""
import os
import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from core.db import get_db
from core.exceptions import ok_envelope
from core.security import current_user, require_perm

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/seo", tags=["seo"])

# Hard timeout for any single LLM call (prevents middleware/ingress timeout).
# Keep below typical 60s ingress timeout & front-end axios defaults.
LLM_CALL_TIMEOUT_SEC = 35

# ─── Helpers ───────────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()

def _serialize(doc: dict) -> dict:
    """Convert ObjectId → str and datetime → ISO."""
    if not doc:
        return doc
    doc = dict(doc)
    doc.pop("_id", None)
    for k, v in doc.items():
        if hasattr(v, "isoformat"):
            doc[k] = v.isoformat()
    return doc

# ─── Pydantic Models ────────────────────────────────────────────────────────────

class SeoPageIn(BaseModel):
    path: str = Field(..., description="Route path, e.g. '/' or '/brands/the-coffeeshop'")
    page_key: str = Field(..., description="Human-readable key, e.g. 'home'")
    title: Optional[str] = None
    description: Optional[str] = None
    og_title: Optional[str] = None
    og_description: Optional[str] = None
    og_image: Optional[str] = None
    keywords: Optional[str] = None          # comma-separated
    focus_keywords: list[str] = []          # AI-chosen main keywords
    canonical_path: Optional[str] = None
    noindex: bool = False
    json_ld: Optional[dict] = None
    ai_analysis: Optional[dict] = None
    notes: Optional[str] = None

class AiAnalyzeIn(BaseModel):
    path: str
    page_key: str
    page_name: str
    keywords: str                           # comma-separated user input
    page_context: Optional[str] = None     # brief description of the page

class AiGenerateIn(BaseModel):
    path: str
    page_key: str
    page_name: str
    keywords: str
    intent: Optional[str] = None
    suggestions: Optional[list] = None
    page_context: Optional[str] = None

# ─── Business Context ───────────────────────────────────────────────────────────

FNB_CONTEXT = """
FnB Group adalah perusahaan multi-brand F&B (Food & Beverage) yang berbasis di Bandung, Indonesia.
Didirikan dengan visi menghadirkan pengalaman kuliner berkualitas tinggi, FnB Group saat ini memiliki
5 brand restoran dengan konsep berbeda:
1. The Coffeeshop — Specialty Coffee & All-Day Dining (coffeeshop premium dengan menu brunch)
2. The Restaurant — Modern Latin & Mediterranean (restoran fine dining bertema Latin-Mediterania)
3. The Bistro — European Bistro & Wine (bistro Eropa dengan wine selection)
4. The Lounge — American Smokehouse & Sports Bar (bar & grill ala Amerika)
5. The Bakery — Artisan Bakery & Café (artisan bakery dengan konsep café)
Target pasar: kalangan menengah ke atas, usia 22-45 tahun, pecinta kuliner di Bandung dan sekitarnya.
"""

# ─── Public Endpoint ────────────────────────────────────────────────────────────

@router.get("/public")
async def get_public_seo(path: str = Query(...)):
    """
    Public (no auth) — return SEO override for a given route path.
    Used by frontend PageSEO component to fetch live overrides.
    """
    db = get_db()
    doc = await db.seo_settings.find_one({"path": path, "deleted_at": None})
    if not doc:
        return ok_envelope(None)
    return ok_envelope(_serialize(doc))

# ─── Admin CRUD ─────────────────────────────────────────────────────────────────

@router.get("/pages")
async def list_seo_pages(user=Depends(require_perm("admin.cms.read"))):
    db = get_db()
    cursor = db.seo_settings.find({"deleted_at": None}, {"_id": 0}).sort("path", 1)
    docs = [_serialize(d) async for d in cursor]
    return ok_envelope(docs, meta={"total": len(docs)})

@router.post("/pages")
async def upsert_seo_page(body: SeoPageIn, user=Depends(require_perm("admin.cms.write"))):
    db = get_db()
    now = _now()
    # Upsert by path
    existing = await db.seo_settings.find_one({"path": body.path, "deleted_at": None})
    payload = body.model_dump()
    if existing:
        payload["updated_at"] = now
        payload["updated_by"] = user["id"]
        await db.seo_settings.update_one(
            {"_id": existing["_id"]},
            {"$set": payload}
        )
        return ok_envelope(_serialize({**existing, **payload}))
    else:
        doc = {
            "id": str(uuid.uuid4()),
            "created_at": now,
            "updated_at": now,
            "created_by": user["id"],
            "updated_by": user["id"],
            "deleted_at": None,
            **payload,
        }
        await db.seo_settings.insert_one(doc)
        return ok_envelope(_serialize(doc))

@router.put("/pages/{seo_id}")
async def update_seo_page(seo_id: str, body: SeoPageIn, user=Depends(require_perm("admin.cms.write"))):
    db = get_db()
    now = _now()
    existing = await db.seo_settings.find_one({"id": seo_id, "deleted_at": None})
    if not existing:
        raise HTTPException(404, "SEO setting not found")
    payload = {**body.model_dump(), "updated_at": now, "updated_by": user["id"]}
    await db.seo_settings.update_one({"id": seo_id}, {"$set": payload})
    return ok_envelope(_serialize({**existing, **payload}))

@router.delete("/pages/{seo_id}")
async def delete_seo_page(seo_id: str, user=Depends(require_perm("admin.cms.write"))):
    db = get_db()
    now = _now()
    existing = await db.seo_settings.find_one({"id": seo_id, "deleted_at": None})
    if not existing:
        raise HTTPException(404, "SEO setting not found")
    await db.seo_settings.update_one(
        {"id": seo_id},
        {"$set": {"deleted_at": now, "updated_by": user["id"]}}
    )
    return ok_envelope({"deleted": True})

# ─── AI Endpoints ───────────────────────────────────────────────────────────────

async def _get_llm_client():
    """Get LLM client; returns None if key not configured."""
    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not api_key:
        return None
    try:
        from emergentintegrations.llm.chat import LlmChat
        chat = LlmChat(
            api_key=api_key,
            session_id=f"seo-{uuid.uuid4()}",
            system_message=(
                "You are an expert SEO consultant specializing in F&B restaurant chains in Indonesia. "
                "You understand Indonesian consumer search behavior, Google Indonesia trends, and local F&B market. "
                "Always respond in valid JSON only, no markdown, no explanation outside the JSON."
            )
        ).with_model("openai", "gpt-4.1-mini")
        return chat
    except Exception as e:
        logger.warning(f"LLM init failed: {e}")
        return None

@router.post("/ai/analyze")
async def ai_analyze_keywords(body: AiAnalyzeIn, user=Depends(require_perm("admin.cms.write"))):
    """
    AI keyword analysis: input keywords → search intent + keyword clusters + quick suggestions.
    Falls back to rule-based analysis if EMERGENT_LLM_KEY not configured.
    """
    chat = await _get_llm_client()
    if not chat:
        # Fallback: rule-based analysis
        return ok_envelope(_fallback_analysis(body), meta={"ai_powered": False, "message": "AI tidak aktif (EMERGENT_LLM_KEY belum dikonfigurasi). Menggunakan analisis dasar."})

    prompt = f"""FnB Group = multi-brand F&B premium di Bandung (The Coffeeshop coffee, The Restaurant Latin, The Bistro bistro, The Lounge smokehouse, The Bakery bakery). Target: 22-45yo kuliner Bandung.

Halaman: {body.page_name} | URL: {body.path}
Konteks: {body.page_context or 'Website FnB Group'}
Keywords: {body.keywords}

Kembalikan JSON saja (no markdown):
{{"primary_intent":"commercial|informational|navigational|transactional","intent_explanation":"1 kalimat","keyword_clusters":[{{"cluster_name":"nama","keywords":["kw1","kw2","kw3"],"intent":"commercial","estimated_volume":"medium","competition":"medium"}}],"suggested_title":"title 50-60 karakter","suggested_description":"desc 150-160 karakter dgn CTA","suggested_og_title":"OG title max 70 karakter","suggested_og_description":"OG desc max 200 karakter","focus_keywords":["kw1","kw2","kw3"],"lsi_keywords":["lsi1","lsi2","lsi3"],"quick_wins":["tip1","tip2"],"search_intent_analysis":"2 kalimat"}}"""

    try:
        from emergentintegrations.llm.chat import UserMessage
        response = await asyncio.wait_for(
            chat.send_message(UserMessage(text=prompt)),
            timeout=LLM_CALL_TIMEOUT_SEC,
        )
        import json
        # Clean up possible markdown code blocks
        clean = response.strip()
        if clean.startswith("```"):
            clean = clean.split("```")[1]
            if clean.startswith("json"):
                clean = clean[4:]
        data = json.loads(clean.strip())

        # Save analysis to DB
        db = get_db()
        await db.seo_settings.update_one(
            {"path": body.path, "deleted_at": None},
            {"$set": {"ai_analysis": data, "updated_at": _now()}},
            upsert=False
        )

        return ok_envelope(data, meta={"ai_powered": True})
    except asyncio.TimeoutError:
        logger.warning(f"AI analyze timeout after {LLM_CALL_TIMEOUT_SEC}s for path={body.path}")
        return ok_envelope(_fallback_analysis(body), meta={"ai_powered": False, "message": f"AI timeout setelah {LLM_CALL_TIMEOUT_SEC}s — pakai analisis dasar."})
    except asyncio.CancelledError:
        # Client disconnected mid-flight; return fallback so middleware always gets a response
        logger.warning(f"AI analyze cancelled (client disconnect?) path={body.path}")
        return ok_envelope(_fallback_analysis(body), meta={"ai_powered": False, "message": "Request dibatalkan."})
    except Exception as e:  # noqa: BLE001
        logger.error(f"AI analyze error: {e}")
        return ok_envelope(_fallback_analysis(body), meta={"ai_powered": False, "message": f"AI error: {str(e)}"})

@router.post("/ai/generate")
async def ai_generate_seo(body: AiGenerateIn, user=Depends(require_perm("admin.cms.write"))):
    """
    AI SEO content generation: keywords + intent → title/description/OG content + JSON-LD outline.
    Falls back to template-based generation if key not configured.
    """
    chat = await _get_llm_client()
    if not chat:
        return ok_envelope(_fallback_generate(body), meta={"ai_powered": False, "message": "AI tidak aktif (EMERGENT_LLM_KEY belum dikonfigurasi). Menggunakan template dasar."})

    intent_info = f"Intent utama: {body.intent}" if body.intent else ""
    suggestions_info = ""
    if body.suggestions:
        suggestions_info = f"Cluster keywords yang relevan: {', '.join([s.get('cluster_name','') for s in body.suggestions[:3]])}"

    prompt = f"""FnB Group = multi-brand F&B premium di Bandung (The Coffeeshop coffee, The Restaurant Latin, The Bistro bistro, The Lounge smokehouse, The Bakery bakery).

Halaman: {body.page_name} | URL: {body.path}
Keywords: {body.keywords}
Konteks: {body.page_context or 'Website FnB Group'}
{intent_info}
{suggestions_info}

Kembalikan JSON saja (no markdown):
{{"title":"title 50-60 karakter mengandung keyword & brand","description":"meta desc 148-158 karakter dgn CTA","og_title":"OG title max 65 karakter","og_description":"OG desc max 200 karakter","focus_keywords":["kw1","kw2","kw3"],"h1_suggestion":"H1 berbeda dari title","schema_type":"Restaurant|LocalBusiness|WebPage|Organization","content_tips":["tip1","tip2","tip3"]}}"""

    try:
        from emergentintegrations.llm.chat import UserMessage
        response = await asyncio.wait_for(
            chat.send_message(UserMessage(text=prompt)),
            timeout=LLM_CALL_TIMEOUT_SEC,
        )
        import json
        clean = response.strip()
        if clean.startswith("```"):
            clean = clean.split("```")[1]
            if clean.startswith("json"):
                clean = clean[4:]
        data = json.loads(clean.strip())
        return ok_envelope(data, meta={"ai_powered": True})
    except asyncio.TimeoutError:
        logger.warning(f"AI generate timeout after {LLM_CALL_TIMEOUT_SEC}s for path={body.path}")
        return ok_envelope(_fallback_generate(body), meta={"ai_powered": False, "message": f"AI timeout setelah {LLM_CALL_TIMEOUT_SEC}s — pakai template dasar."})
    except asyncio.CancelledError:
        logger.warning(f"AI generate cancelled (client disconnect?) path={body.path}")
        return ok_envelope(_fallback_generate(body), meta={"ai_powered": False, "message": "Request dibatalkan."})
    except Exception as e:  # noqa: BLE001
        logger.error(f"AI generate error: {e}")
        return ok_envelope(_fallback_generate(body), meta={"ai_powered": False, "message": f"AI error: {str(e)}"})

# ─── Fallback helpers (no-AI mode) ─────────────────────────────────────────────

def _fallback_analysis(body: AiAnalyzeIn) -> dict:
    kws = [k.strip() for k in body.keywords.split(",") if k.strip()]
    return {
        "primary_intent": "commercial",
        "intent_explanation": "Pengguna mencari informasi produk/layanan F&B di Bandung.",
        "keyword_clusters": [
            {
                "cluster_name": "Brand F&B Bandung",
                "keywords": kws[:3] + ["restoran bandung", "cafe bandung"],
                "intent": "commercial",
                "estimated_volume": "medium",
                "competition": "medium"
            }
        ],
        "suggested_title": f"{body.page_name} | FnB Group — F&B Bandung",
        "suggested_description": f"Nikmati pengalaman kuliner terbaik di FnB Group Bandung. {', '.join(kws[:2])}. Temukan menu spesial dan reservasi sekarang.",
        "suggested_og_title": f"{body.page_name} — FnB Group",
        "suggested_og_description": f"Pengalaman kuliner premium di Bandung. {', '.join(kws[:2])}.",
        "focus_keywords": kws[:5],
        "lsi_keywords": ["restoran bandung", "kuliner bandung", "cafe bandung premium"],
        "quick_wins": [
            "Tambahkan keyword lokasi Bandung di title tag",
            "Gunakan schema LocalBusiness untuk visibilitas Google Maps",
            "Tambahkan menu highlights di meta description"
        ],
        "search_intent_analysis": "Pengguna mencari rekomendasi restoran atau café di Bandung dengan konsep premium."
    }

def _fallback_generate(body: AiGenerateIn) -> dict:
    kws = [k.strip() for k in body.keywords.split(",") if k.strip()]
    main_kw = kws[0] if kws else body.page_name.lower()
    return {
        "title": f"{body.page_name} | FnB Group — F&B Terbaik di Bandung",
        "description": f"Temukan {main_kw} terbaik di FnB Group Bandung. Pengalaman kuliner premium dari fine dining hingga coffee shop. Reservasi sekarang!",
        "og_title": f"{body.page_name} — FnB Group Bandung",
        "og_description": f"Nikmati {main_kw} di {body.page_name} FnB Group. Kuliner premium khas Bandung untuk semua kesempatan.",
        "focus_keywords": kws[:5],
        "h1_suggestion": f"{body.page_name} FnB Group — Pengalaman Kuliner Terbaik Bandung",
        "schema_type": "Restaurant",
        "content_tips": [
            "Sertakan foto berkualitas tinggi dari menu andalan",
            "Tambahkan testimoni pelanggan di halaman",
            "Cantumkan informasi jam operasional dan lokasi secara eksplisit"
        ]
    }
