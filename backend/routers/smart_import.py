"""/api/imports — Impor Cerdas (penjualan detail per struk/item & mutasi bank dari file format apa pun).

Alur: POST /api/imports (attachment_id) atau /api/imports/upload (file) → GET pratinjau → PATCH pemetaan/opsi/nilai →
POST /{id}/commit → (bila perlu) POST /{id}/rollback. Lihat services/smart_import/service.py.
"""
from typing import Optional

from fastapi import APIRouter, Body, Depends, File, Form, Query, UploadFile

from core.exceptions import ok_envelope
from core.security import require_perm
from services import upload_service
from services.smart_import import service

router = APIRouter(prefix="/api/imports", tags=["smart-import"])
USE = "import.smart.use"


@router.get("")
async def list_batches(limit: int = Query(50, ge=1, le=200), user: dict = Depends(require_perm(USE))):
    return ok_envelope(await service.list_batches(user, limit))


@router.post("")
async def create_batch(payload: dict = Body(...), user: dict = Depends(require_perm(USE))):
    """{attachment_id, target?: "sales"|"bank", options?: {outlet_id, channel, bank_account_id, cutoff_hour, default_bucket,
    date_order: DMY|MDY|YMD, decimal: ","|"."}} → batch + pratinjau (belum menyimpan data)."""
    return ok_envelope(await service.create_batch(user, attachment_id=str(payload.get("attachment_id") or ""),
                                                  target=payload.get("target") or None, options=payload.get("options") or None))


@router.post("/upload")
async def upload_and_create(file: UploadFile = File(...), target: Optional[str] = Form(None),
                            outlet_id: Optional[str] = Form(None), bank_account_id: Optional[str] = Form(None),
                            user: dict = Depends(require_perm(USE))):
    """Unggah file lalu langsung buat batch impor."""
    data = await file.read()
    att = await upload_service.save_upload(file_bytes=data, filename=file.filename or "impor",
                                           content_type=file.content_type or "application/octet-stream", user=user,
                                           category="import", source_type="import_batch")
    opts = {k: v for k, v in {"outlet_id": outlet_id, "bank_account_id": bank_account_id}.items() if v}
    return ok_envelope(await service.create_batch(user, attachment_id=att["id"], target=target or None, options=opts or None))


@router.get("/recipes")
async def list_recipes(user: dict = Depends(require_perm(USE))):
    return ok_envelope(await service.list_recipes(user))


@router.delete("/recipes/{recipe_id}")
async def delete_recipe(recipe_id: str, user: dict = Depends(require_perm(USE))):
    await service.delete_recipe(recipe_id, user)
    return ok_envelope({"deleted": True})


@router.get("/{batch_id}")
async def get_batch(batch_id: str, user: dict = Depends(require_perm(USE))):
    """Pratinjau: kolom & pemetaan, ringkasan, rekap per toko/hari dengan status duplikasi, masalah, contoh transaksi."""
    return ok_envelope(await service.view(batch_id, user))


@router.patch("/{batch_id}")
async def update_batch(batch_id: str, payload: dict = Body(...), user: dict = Depends(require_perm(USE))):
    """{mapping?: {nama_kolom|index: field|null}, options?: {..., day_actions: {"<outlet_id>|<YYYY-MM-DD>":
    "create"|"replace"|"merge"|"skip"}, allow_duplicate_file}, value_maps?: {outlet: {nilai_file: outlet_id},
    payment: {nilai_file: payment_method_id}}, sheet?, header_row?, target?, source?}"""
    return ok_envelope(await service.update_batch(
        batch_id, user, mapping=payload.get("mapping"), options=payload.get("options"), value_maps=payload.get("value_maps"),
        sheet=payload.get("sheet"), header_row=payload.get("header_row"), target=payload.get("target"),
        source=payload.get("source")))


@router.post("/{batch_id}/commit")
async def commit(batch_id: str, payload: dict = Body(default={}), user: dict = Depends(require_perm(USE))):
    """Simpan transaksi + rekap ke Daily Sales DRAF (penjualan) atau buat sesi rekonsiliasi (bank).
    {save_recipe?: true, recipe_name?}"""
    payload = payload or {}
    return ok_envelope(await service.commit(batch_id, user, save_recipe=payload.get("save_recipe", True),
                                            recipe_name=payload.get("recipe_name")))


@router.post("/{batch_id}/rollback")
async def rollback(batch_id: str, user: dict = Depends(require_perm(USE))):
    """Batalkan impor: transaksi dihapus, Daily Sales draf dihitung ulang / dikembalikan (yang sudah divalidasi tidak diubah)."""
    return ok_envelope(await service.rollback(batch_id, user))
