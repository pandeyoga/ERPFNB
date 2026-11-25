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


# ── Rekonsiliasi lanjutan & accrual ────────────────────────────────────────────
from fastapi.responses import Response  # noqa: E402

from services.ai_finance import reconcile  # noqa: E402

_AP_RECON = require_any_perm("finance.ap.read", "finance.bank_reconciliation", "finance.journal_entry.read")
_INV_RECON = require_any_perm("finance.journal_entry.read", "finance.bank_reconciliation")


def _out(result: dict, export: str | None):
    if export in ("pdf", "xlsx"):
        data, fname, ct = reconcile.to_report(result, export)
        return Response(content=data, media_type=ct, headers={"Content-Disposition": f'attachment; filename="{fname}"'})
    return ok_envelope(result)


@router.post("/reconcile/vendor-statement", summary="Rekonsiliasi statement supplier vs buku hutang (foto/PDF/Excel atau baris)")
async def recon_vendor_statement(payload: dict = Body(...), export: str = Query(None), user: dict = Depends(_AP_RECON)):
    """{vendor_id, attachment_id? | rows?: [{tanggal, no_dokumen, jenis: invoice|payment|credit|debit, nominal, keterangan}],
    closing_balance?}"""
    return _out(await reconcile.vendor_statement(user, vendor_id=str(payload.get("vendor_id") or ""),
                                                 attachment_id=payload.get("attachment_id"), rows=payload.get("rows"),
                                                 closing_balance=payload.get("closing_balance")), export)


@router.get("/reconcile/three-way", summary="3-way match PO ↔ GR ↔ invoice")
async def recon_three_way(days: int = Query(60, ge=1, le=366), vendor_id: str = Query(None), outlet_id: str = Query(None),
                          export: str = Query(None), user: dict = Depends(_AP_RECON)):
    return _out(await reconcile.three_way(user, days=days, vendor_id=vendor_id, outlet_id=outlet_id), export)


@router.get("/reconcile/inventory-gl", summary="Persediaan: kartu stok vs saldo GL per toko (+ dalam perjalanan)")
async def recon_inventory_gl(as_of: str = Query(None), export: str = Query(None), user: dict = Depends(_INV_RECON)):
    return _out(await reconcile.inventory_vs_gl(user, as_of=as_of), export)


@router.get("/reconcile/petty-cash", summary="Kas kecil: saldo buku vs GL, transaksi tanpa jurnal/bukti")
async def recon_petty_cash(outlet_id: str = Query(None), export: str = Query(None),
                           user: dict = Depends(require_any_perm("finance.cash.read", "finance.journal_entry.read", "outlet.petty_cash.read"))):
    return _out(await reconcile.petty_cash(user, outlet_id=outlet_id), export)


@router.get("/reconcile/transfers", summary="Transfer antar toko: belum diterima, selisih kirim vs terima")
async def recon_transfers(days: int = Query(60, ge=1, le=366), export: str = Query(None),
                          user: dict = Depends(require_any_perm("inventory.view", "finance.journal_entry.read"))):
    return _out(await reconcile.transfers(user, days=days), export)


@router.post("/reconcile/non-cash", summary="Settlement EDC/QRIS (laporan bank/penyedia) vs penjualan POS per tanggal")
async def recon_non_cash(payload: dict = Body(...), export: str = Query(None),
                         user: dict = Depends(require_any_perm("finance.bank_reconciliation", "finance.sales.validate"))):
    """{attachment_id? | rows?: [{tanggal, kotor, mdr, bersih, jenis}], outlet_id?}"""
    return _out(await reconcile.non_cash(user, attachment_id=payload.get("attachment_id"), rows=payload.get("rows"),
                                         outlet_id=payload.get("outlet_id")), export)


@router.get("/close/{period}/accruals", summary="Usulan jurnal accrual (beban rutin & gaji yang belum dicatat) + jurnal balik")
async def close_accruals(period: str, user: dict = Depends(require_any_perm("finance.journal_entry.read", "finance.journal_entry.create"))):
    return ok_envelope(await close.accrual_proposals(period, user))


@router.post("/reconcile/export", summary="Ekspor hasil rekonsiliasi (PDF/Excel) dari hasil yang sudah ada — tanpa menghitung ulang")
async def recon_export(payload: dict = Body(...), user: dict = Depends(_AP_RECON)):
    """{format: pdf|xlsx, result: <objek hasil rekonsiliasi>}"""
    from core.exceptions import ValidationError
    fmt, result = payload.get("format"), payload.get("result")
    if fmt not in ("pdf", "xlsx") or not isinstance(result, dict) or not isinstance(result.get("rows"), list):
        raise ValidationError("format pdf|xlsx dan result {judul, ringkasan, rows} wajib")
    return _out(result, fmt)
