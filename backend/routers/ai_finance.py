"""/api/ai/finance — AI Finance: foto/PDF struk → draf jurnal, rekonsiliasi bank dengan AI, asisten tutup buku.

Analisis tidak menulis data (dipakai Asisten AI & layar); pembukuan tetap lewat jurnal manual / apply yang dijalankan
sebagai pengguna dengan izinnya (dan lewat persetujuan bila dari Asisten AI).
"""
from fastapi import APIRouter, Body, Depends, Query

from core.exceptions import ok_envelope
from core.security import require_any_perm, require_perm
from services.ai_finance import close, receipts, recon

router = APIRouter(prefix="/api/ai/finance", tags=["ai-finance"])


@router.post("/receipts/analyze", summary="Baca foto/PDF struk & invoice → usulan jurnal (belum memposting)")
async def analyze_receipts(payload: dict = Body(...),
                           user: dict = Depends(require_any_perm("finance.journal_entry.create", "outlet.petty_cash.create"))):
    """{attachment_ids: [...], payment: cash|petty|bank|ap|<coa_id>, outlet_id?, creditable_vat?} → per lampiran: status
    (siap/perlu_cek/duplikat/gagal), hasil OCR, akun usulan & alasan, journal (body POST /api/finance/journals/manual)."""
    return ok_envelope(await receipts.analyze(user, [a for a in payload.get("attachment_ids") or [] if isinstance(a, str)],
                                              payment=str(payload.get("payment") or "cash"), outlet_id=payload.get("outlet_id"),
                                              creditable_vat=payload.get("creditable_vat")))


@router.post("/recon/{session_id}/analyze", summary="Analisis AI sesi rekonsiliasi bank (usulan cocok & jurnal penyesuaian)")
async def analyze_recon(session_id: str, payload: dict = Body(default={}),
                        user: dict = Depends(require_perm("finance.bank_reconciliation"))):
    return ok_envelope(await recon.analyze(session_id, user, use_ai=(payload or {}).get("use_ai", True)))


@router.post("/recon/{session_id}/apply", summary="Bukukan usulan rekonsiliasi terpilih & tandai mutasi cocok")
async def apply_recon(session_id: str, payload: dict = Body(...),
                      user: dict = Depends(require_perm("finance.bank_reconciliation"))):
    """{row_ids: [...], analysis_id?, learn?: true, entry_date?}"""
    perms = set(user.get("permissions") or [])
    if "*" not in perms and "finance.journal_entry.create" not in perms:
        from core.exceptions import ForbiddenError
        raise ForbiddenError("Butuh izin finance.journal_entry.create untuk membukukan jurnal penyesuaian")
    return ok_envelope(await recon.apply(session_id, user, row_ids=[r for r in payload.get("row_ids") or [] if isinstance(r, str)],
                                         analysis_id=payload.get("analysis_id"), learn=payload.get("learn", True),
                                         entry_date=payload.get("entry_date")))


@router.get("/recon-rules", summary="Aturan rekonsiliasi yang dipelajari")
async def rules(user: dict = Depends(require_perm("finance.bank_reconciliation"))):
    return ok_envelope(await recon.list_rules())


@router.post("/recon-rules", summary="Tambah/ubah aturan rekonsiliasi")
async def save_rule(payload: dict = Body(...), user: dict = Depends(require_perm("finance.bank_reconciliation"))):
    """{pattern: regex kata kunci keterangan mutasi, kind: payout|settlement|cash_deposit|bank_fee|interest|interest_tax|other,
    platform?: GoFood|GrabFood|ShopeeFood}"""
    return ok_envelope(await recon.save_rule(payload, user))


@router.delete("/recon-rules/{rule_id}", summary="Hapus aturan rekonsiliasi")
async def delete_rule(rule_id: str, user: dict = Depends(require_perm("finance.bank_reconciliation"))):
    await recon.delete_rule(rule_id)
    return ok_envelope({"deleted": True})


@router.get("/close/{period}", summary="Checklist tutup buku & fluktuasi akun per periode")
async def close_checklist(period: str, ai: bool = Query(False),
                          user: dict = Depends(require_any_perm("finance.journal_entry.read", "finance.report.profit_loss"))):
    return ok_envelope(await close.checklist(period, user, use_ai=ai))
