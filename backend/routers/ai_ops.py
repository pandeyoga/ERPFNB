"""/api/ai/purchasing & /api/ai/audit — AI Purchasing (analisis price list, restock) dan AI Auditor.

Analisis tidak menulis data bisnis; penyimpanan penawaran / PR / PO tetap lewat endpoint domainnya (dan persetujuan bila
dari Asisten AI). Temuan Auditor masuk feed Anomali (/api/anomalies) untuk triase.
"""
from fastapi import APIRouter, Body, Depends, Query

from core.exceptions import ok_envelope
from core.security import require_any_perm, require_perm
from services.ai_audit import auditor
from services.ai_purchasing import pricelist, restock

router = APIRouter(tags=["ai-purchasing-audit"])


@router.post("/api/ai/purchasing/pricelist/analyze", summary="Analisis price list supplier (foto/PDF/Excel atau baris) vs harga lama, pasar & vendor lain")
async def analyze_pricelist(payload: dict = Body(...),
                            user: dict = Depends(require_any_perm("procurement.sourcing.read", "procurement.price_list.manage",
                                                                  "procurement.po.create"))):
    """{vendor_id, attachment_id? | rows?: [{name, code?, pack?, unit?, price, moq?}], outlet_id?}"""
    return ok_envelope(await pricelist.analyze(user, vendor_id=str(payload.get("vendor_id") or ""),
                                               attachment_id=payload.get("attachment_id"), rows=payload.get("rows"),
                                               outlet_id=payload.get("outlet_id")))


@router.get("/api/ai/purchasing/restock", summary="Saran restock: item di bawah par → draf PR per toko & saran PO per supplier")
async def restock_suggest(outlet_id: str = Query(None), user: dict = Depends(require_any_perm("procurement.pr.create", "inventory.balance.read"))):
    return ok_envelope(await restock.suggest(user, outlet_id=outlet_id))


@router.post("/api/ai/audit/run", summary="Jalankan AI Auditor sekarang (temuan → feed Anomali)")
async def run_audit(payload: dict = Body(default={}), user: dict = Depends(require_perm("anomaly.scan.trigger"))):
    """{days?: 60, split_limit?: 10000000}"""
    payload = payload or {}
    return ok_envelope(await auditor.run(days=int(payload.get("days") or 60), user_id=user["id"],
                                         split_limit=float(payload.get("split_limit") or auditor.SPLIT_LIMIT)))


@router.get("/api/ai/audit/types", summary="Jenis pemeriksaan AI Auditor")
async def audit_types(user: dict = Depends(require_any_perm("anomaly.feed.read", "anomaly.scan.trigger"))):
    return ok_envelope([{"value": k, "label": v} for k, v in auditor.TYPES.items()])


# ── AI Data Steward ────────────────────────────────────────────────────────────
from services.ai_steward import duplicates as steward  # noqa: E402

_STEWARD_READ = require_any_perm("admin.master_data.manage", "inventory.view", "procurement.vendor.read")


@router.get("/api/ai/steward/duplicates", summary="Master data ganda (items | vendors) + pemakaian & saran")
async def steward_duplicates(entity: str = Query("items"), threshold: float = Query(0.88, ge=0.6, le=1.0),
                             user: dict = Depends(_STEWARD_READ)):
    return ok_envelope(await steward.find_duplicates(entity, threshold=threshold))


@router.get("/api/ai/steward/similar", summary="Cek nama mirip sebelum membuat item/supplier baru")
async def steward_similar(entity: str = Query("items"), name: str = Query(..., min_length=2), user: dict = Depends(_STEWARD_READ)):
    return ok_envelope(await steward.similar(entity, name))


@router.get("/api/ai/steward/completeness", summary="Master data belum lengkap (satuan/kategori; NPWP/rekening/telepon)")
async def steward_completeness(entity: str = Query("items"), user: dict = Depends(_STEWARD_READ)):
    return ok_envelope(await steward.completeness(entity))


@router.post("/api/ai/steward/deactivate", summary="Nonaktifkan duplikat yang belum dipakai transaksi")
async def steward_deactivate(payload: dict = Body(...), user: dict = Depends(require_perm("admin.master_data.manage"))):
    """{entity: items|vendors, id: <duplikat>, keep_id: <yang dipertahankan>}"""
    return ok_envelope(await steward.deactivate(str(payload.get("entity") or ""), str(payload.get("id") or ""),
                                                str(payload.get("keep_id") or ""), user=user))
