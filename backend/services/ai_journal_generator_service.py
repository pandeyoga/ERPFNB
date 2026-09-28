"""AI Journal Entry Generator Service — Generate journal entries dari natural language.

User input: "Bayar sewa gedung The Bistro bulan Mei 2026 Rp 50 juta"
AI output: {
    "entry_date": "2026-05-01",
    "description": "Pembayaran sewa gedung The Bistro - Mei 2026",
    "lines": [
        {"coa_code": "6101", "coa_name": "Rent Expense", "dr": 50000000, "cr": 0, "memo": "Sewa Mei 2026", "dim_outlet": "outlet_the-bistro_id"},
        {"coa_code": "1101", "coa_name": "Cash", "dr": 0, "cr": 50000000, "memo": "Pembayaran sewa", "dim_outlet": "outlet_the-bistro_id"}
    ],
    "confidence": 0.95,
    "warnings": []
}
"""
import json
import logging
import re
from typing import Optional

from core.config import settings
from core.db import get_db
from core.runtime_config import get_setting

logger = logging.getLogger("aurora.ai_journal_generator")

PROVIDER = "gemini"
MODEL = "gemini-2.5-flash"


async def generate_journal_entry(
    *,
    user_input: str,
    context: Optional[dict] = None,
    user: dict,
) -> dict:
    """Generate journal entry dari natural language description.
    
    Args:
        user_input: Natural language description (mis: "Bayar listrik The Bistro Rp 2 juta")
        context: Optional context (outlet_id, brand_id, date hints)
        user: Current user dict
    
    Returns:
        {
            "entry_date": "YYYY-MM-DD",
            "description": "Generated description",
            "lines": [...],
            "confidence": 0.0-1.0,
            "warnings": [],
            "raw_ai_response": "..."  # For debugging
        }
    """
    llm_key = await get_setting("EMERGENT_LLM_KEY", default=settings.emergent_llm_key)
    if not settings.feature_ai_enabled or not llm_key:
        return {
            "error": "AI feature tidak aktif atau EMERGENT_LLM_KEY tidak tersedia",
            "entry_date": None,
            "description": user_input,
            "lines": [],
            "confidence": 0,
            "warnings": ["AI feature disabled"],
        }
    
    # Load COA untuk context
    db = get_db()
    coas = []
    async for coa in db.chart_of_accounts.find({"is_postable": True, "active": True}).limit(100):
        coas.append({
            "code": coa.get("code"),
            "name": coa.get("name"),
            "type": coa.get("type"),
            "id": coa.get("id"),
        })
    
    # Load outlets untuk context
    outlets = []
    async for outlet in db.outlets.find({"active": True}):
        outlets.append({
            "id": outlet.get("id"),
            "name": outlet.get("name"),
            "code": outlet.get("code"),
        })
    
    # Load brands
    brands = []
    async for brand in db.brands.find({"active": True}):
        brands.append({
            "id": brand.get("id"),
            "name": brand.get("name"),
            "code": brand.get("code"),
        })
    
    # Build system prompt
    system_prompt = _build_system_prompt(coas, outlets, brands)
    
    # Build user prompt with context
    user_prompt = _build_user_prompt(user_input, context or {})
    
    # Call LLM
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=llm_key,
            session_id=f"journal-gen-{user['id']}",
            system_message=system_prompt,
        ).with_model(PROVIDER, MODEL)
        
        response_text = await chat.send_message(UserMessage(text=user_prompt)) or ""
        
        if not response_text:
            return {
                "error": "AI tidak memberikan response",
                "entry_date": None,
                "description": user_input,
                "lines": [],
                "confidence": 0,
                "warnings": ["Empty AI response"],
                "raw_ai_response": "",
            }
        
        # Parse JSON response
        parsed = _extract_json(response_text)
        if not parsed:
            return {
                "error": "Gagal parse AI response ke JSON",
                "entry_date": None,
                "description": user_input,
                "lines": [],
                "confidence": 0,
                "warnings": ["Failed to parse JSON"],
                "raw_ai_response": response_text,
            }
        
        # Validate & enrich response
        result = _validate_and_enrich(parsed, coas, outlets, brands)
        result["raw_ai_response"] = response_text
        
        logger.info(f"AI Journal generated for user {user['id']}: {len(result.get('lines', []))} lines, confidence={result.get('confidence')}")
        
        return result
        
    except Exception as e:
        logger.exception(f"AI Journal generation failed: {e}")
        return {
            "error": f"Error saat generate: {str(e)}",
            "entry_date": None,
            "description": user_input,
            "lines": [],
            "confidence": 0,
            "warnings": [str(e)],
        }


def _build_system_prompt(coas: list[dict], outlets: list[dict], brands: list[dict]) -> str:
    """Build system prompt dengan context COA, outlets, brands."""
    coa_list = "\n".join([f"- {c['code']}: {c['name']} ({c['type']})" for c in coas[:50]])
    outlet_list = "\n".join([f"- {o['name']} (id: {o['id']})" for o in outlets])
    brand_list = "\n".join([f"- {b['name']} (id: {b['id']})" for b in brands])
    
    return f"""Kamu adalah AI Accounting Assistant untuk sistem ERP F&B (FnB ERP). Tugasmu adalah mengkonversi deskripsi transaksi dalam bahasa natural menjadi journal entry yang valid.

**CHART OF ACCOUNTS (Top 50 COA):**
{coa_list}

**OUTLETS:**
{outlet_list}

**BRANDS:**
{brand_list}

**ATURAN ACCOUNTING:**
1. Debit = Kredit (harus balance)
2. Expense/Asset bertambah di Debit
3. Revenue/Liability/Equity bertambah di Kredit
4. Cash/Bank berkurang di Kredit saat bayar
5. Cash/Bank bertambah di Debit saat terima

**OUTPUT FORMAT (JSON):**
{{
    "entry_date": "YYYY-MM-DD",
    "description": "Deskripsi journal entry yang clear",
    "lines": [
        {{
            "coa_id": "uuid-coa",
            "coa_code": "1101",
            "coa_name": "Cash",
            "dr": 0,
            "cr": 50000000,
            "memo": "Memo per line (optional)",
            "dim_outlet": "outlet-id (jika applicable)",
            "dim_brand": "brand-id (jika applicable)"
        }},
        {{
            "coa_id": "uuid-coa",
            "coa_code": "6101",
            "coa_name": "Rent Expense",
            "dr": 50000000,
            "cr": 0,
            "memo": "Sewa Mei 2026",
            "dim_outlet": "outlet-id"
        }}
    ],
    "confidence": 0.95,
    "warnings": ["List of potential issues or ambiguities"]
}}

**IMPORTANT:**
- Gunakan coa_id dari COA list yang ada
- Jika tidak pasti outlet/brand, set null
- Confidence: 0.0-1.0 (rendah jika input ambiguous)
- Warnings: List semua ambiguitas atau asumsi yang dibuat
- Selalu pastikan Dr = Cr
- Output HANYA JSON, tidak ada text tambahan
"""


def _build_user_prompt(user_input: str, context: dict) -> str:
    """Build user prompt dengan context tambahan."""
    parts = [f"Transaksi: {user_input}"]
    
    if context.get("outlet_id"):
        parts.append(f"Outlet context: {context['outlet_id']}")
    if context.get("brand_id"):
        parts.append(f"Brand context: {context['brand_id']}")
    if context.get("date"):
        parts.append(f"Tanggal context: {context['date']}")
    
    parts.append("\nGenerate journal entry dalam format JSON:")
    
    return "\n".join(parts)


def _extract_json(text: str) -> Optional[dict]:
    """Extract JSON dari AI response (bisa ada markdown wrapper)."""
    if not text:
        return None
    
    # Try to extract from markdown code block
    m = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass
    
    # Try to find raw JSON object
    m = re.search(r"\{[\s\S]+\}", text)
    if not m:
        return None
    
    try:
        return json.loads(m.group(0))
    except Exception:
        return None


def _validate_and_enrich(parsed: dict, coas: list[dict], outlets: list[dict], brands: list[dict]) -> dict:
    """Validate AI output dan enrich dengan data lookup."""
    result = {
        "entry_date": parsed.get("entry_date"),
        "description": parsed.get("description", ""),
        "lines": [],
        "confidence": float(parsed.get("confidence", 0.5)),
        "warnings": list(parsed.get("warnings", [])),
    }
    
    # Validate lines
    lines = parsed.get("lines", [])
    if not lines:
        result["warnings"].append("Tidak ada line items yang di-generate")
        return result
    
    # Build lookup maps
    coa_map = {c["id"]: c for c in coas}
    coa_code_map = {c["code"]: c for c in coas}
    outlet_map = {o["id"]: o for o in outlets}
    brand_map = {b["id"]: b for b in brands}
    
    total_dr = 0.0
    total_cr = 0.0
    
    for line in lines:
        coa_id = line.get("coa_id")
        coa_code = line.get("coa_code")
        
        # Try to find COA
        coa = None
        if coa_id:
            coa = coa_map.get(coa_id)
        if not coa and coa_code:
            coa = coa_code_map.get(coa_code)
        
        if not coa:
            result["warnings"].append(f"COA tidak ditemukan: {coa_code or coa_id}")
            continue
        
        dr = float(line.get("dr", 0) or 0)
        cr = float(line.get("cr", 0) or 0)
        total_dr += dr
        total_cr += cr
        
        # Validate outlet/brand jika ada
        dim_outlet = line.get("dim_outlet")
        dim_brand = line.get("dim_brand")
        
        if dim_outlet and dim_outlet not in outlet_map:
            result["warnings"].append(f"Outlet tidak ditemukan: {dim_outlet}")
            dim_outlet = None
        
        if dim_brand and dim_brand not in brand_map:
            result["warnings"].append(f"Brand tidak ditemukan: {dim_brand}")
            dim_brand = None
        
        result["lines"].append({
            "coa_id": coa["id"],
            "coa_code": coa["code"],
            "coa_name": coa["name"],
            "dr": dr,
            "cr": cr,
            "memo": line.get("memo", ""),
            "dim_outlet": dim_outlet,
            "dim_brand": dim_brand,
        })
    
    # Check balance
    if abs(total_dr - total_cr) > 0.01:
        result["warnings"].append(f"Journal entry tidak balance! Dr={total_dr}, Cr={total_cr}")
        result["confidence"] = min(result["confidence"], 0.3)
    
    return result
