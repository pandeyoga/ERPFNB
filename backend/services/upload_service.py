"""File Upload Service — Phase 8B foundation.

Stores uploaded files on local disk under /app/uploads/{category}/{yyyy-mm}/{uuid}.{ext}
and creates an `attachments` Mongo doc per upload for retrieval + RBAC.

Design goals:
- Pragmatic local-disk storage (per PRD): no S3/GCS yet. Easy to swap later.
- Defensive: clear errors on size/type, idempotent file write, no path traversal.
- Auth-gated: any retrieval requires the file_id which is a UUID (unguessable),
  but additional scope checks happen via category/source linkage.
- Lightweight metadata: filename, content_type, size_bytes, sha256, category,
  source_type/id (optional linkage), uploaded_by, created_at.
"""
import hashlib
import logging
import mimetypes
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from core.audit import log as audit_log
from core.db import get_db, serialize
from core.exceptions import ForbiddenError, NotFoundError, ValidationError

logger = logging.getLogger("aurora.uploads")

UPLOAD_ROOT = Path("/app/uploads")
UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)

# Configuration
MAX_BYTES = 10 * 1024 * 1024  # 10 MB

# Magic bytes (first bytes) yang valid per tipe file — A17 fix: SEC-014
_MAGIC_SIGNATURES: dict[str, list[bytes]] = {
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/jpg":  [b"\xff\xd8\xff"],
    "image/png":  [b"\x89PNG\r\n\x1a\n"],
    "image/webp": [b"RIFF"],
    "image/gif":  [b"GIF87a", b"GIF89a"],
    "application/pdf": [b"%PDF"],
    # CSV, XLSX, XLS, HEIC/HEIF tidak punya magic bytes yang mudah dicheck
    # — dikecualikan dari magic check, tapi sudah dilindungi MIME whitelist
}
ALLOWED_MIME = {
    # images
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/heic": ".heic",
    "image/heif": ".heif",
    # documents
    "application/pdf": ".pdf",
    # spreadsheets
    "text/csv": ".csv",
    "application/csv": ".csv",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedefault.sheet": ".xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    # plain text
    "text/plain": ".txt",
}

ALLOWED_CATEGORIES = {
    "receipt",        # struk / nota for petty cash, urgent purchase, etc.
    "deposit_slip",   # bukti setor bank for daily close
    "invoice",        # invoice vendor for GR / AP
    "bank_statement", # rekening koran for bank recon
    "po_attachment",  # PO docs / signed PO
    "gr_attachment",  # GR docs
    "opname_evidence",
    "general",        # catch-all
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _yyyy_mm() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


def _verify_magic_bytes(file_bytes: bytes, content_type: str) -> None:
    """Verifikasi magic bytes untuk mencegah file extension spoofing — A17 fix: SEC-014."""
    signatures = _MAGIC_SIGNATURES.get(content_type)
    if not signatures:
        # Tipe file tidak ada di magic dict → skip check (CSV, XLSX, dll.)
        return
    if not any(file_bytes.startswith(sig) for sig in signatures):
        raise ValidationError(
            f"Isi file tidak cocok dengan tipe yang diklaim ({content_type}). "
            "Pastikan file tidak dimodifikasi atau diubah ekstensinya.",
            field="file",
        )


def _normalize_category(category: Optional[str]) -> str:
    cat = (category or "general").strip().lower()
    if cat not in ALLOWED_CATEGORIES:
        return "general"
    return cat


def _safe_ext_from_mime(content_type: str, fallback_filename: str = "") -> str:
    ct = (content_type or "").lower().split(";")[0].strip()
    if ct in ALLOWED_MIME:
        return ALLOWED_MIME[ct]
    # try filename ext
    ext = Path(fallback_filename or "").suffix.lower()
    if ext and len(ext) <= 6 and ext.startswith("."):
        return ext
    # default
    guess = mimetypes.guess_extension(ct or "application/octet-stream") or ""
    return guess if guess else ""


async def save_upload(
    *,
    file_bytes: bytes,
    filename: str,
    content_type: str,
    user: dict,
    category: Optional[str] = None,
    source_type: Optional[str] = None,
    source_id: Optional[str] = None,
    description: Optional[str] = None,
) -> dict:
    """Persist file to disk + insert attachment doc.

    Returns the attachment document (with id, url, etc.).
    """
    if not file_bytes:
        raise ValidationError("File kosong / tidak terbaca", field="file")
    size = len(file_bytes)
    if size > MAX_BYTES:
        raise ValidationError(
            f"Ukuran file {size // 1024 // 1024}MB melebihi batas {MAX_BYTES // 1024 // 1024}MB",
            field="file",
        )
    ct = (content_type or "").lower().split(";")[0].strip()
    if ct and ct not in ALLOWED_MIME:
        raise ValidationError(
            f"Tipe file '{ct}' tidak didukung. Gunakan JPG/PNG/WEBP/PDF/CSV/XLSX.",
            field="file",
        )
    # A17 fix: SEC-014 — Verifikasi magic bytes untuk tipe yang kita kenal
    _verify_magic_bytes(file_bytes, ct)
    cat = _normalize_category(category)
    sha = hashlib.sha256(file_bytes).hexdigest()
    file_id = str(uuid.uuid4())
    ext = _safe_ext_from_mime(ct, filename)
    if not ext:
        ext = ".bin"
    yyyy_mm = _yyyy_mm()
    target_dir = UPLOAD_ROOT / cat / yyyy_mm
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / f"{file_id}{ext}"

    # Write file (sync; small files OK; for very large async aiofiles could be used)
    with open(target_path, "wb") as f:
        f.write(file_bytes)

    rel_path = str(target_path.relative_to(UPLOAD_ROOT))

    db = get_db()
    doc = {
        "id": file_id,
        "filename": filename or f"upload{ext}",
        "content_type": ct or "application/octet-stream",
        "size_bytes": size,
        "sha256": sha,
        "category": cat,
        "source_type": source_type,
        "source_id": source_id,
        "description": description,
        "storage_path": rel_path,            # relative to UPLOAD_ROOT
        "absolute_path": str(target_path),    # convenience
        "url": f"/api/uploads/{file_id}",     # served via GET endpoint
        "uploaded_by": user.get("id"),
        "uploaded_by_name": user.get("full_name") or user.get("email"),
        "created_at": _now_iso(),
        "deleted_at": None,
    }
    await db.attachments.insert_one(doc)
    await audit_log(
        user_id=user.get("id"),
        entity_type="attachment",
        entity_id=file_id,
        action="upload",
        after={"category": cat, "size_bytes": size, "content_type": ct},
    )
    logger.info(
        "upload saved id=%s cat=%s size=%dKB by=%s",
        file_id, cat, size // 1024, user.get("email") or user.get("id"),
    )
    return serialize(doc)


async def _assert_can_access_attachment(user: Optional[dict], attachment: dict) -> None:
    """Ownership/scope guard for reading or mutating an attachment.

    Allow if:
      - caller is the uploader (uploaded_by == user.id), OR
      - caller is super ('*' in perms), OR
      - attachment has source_type/source_id linkage AND caller holds any relevant
        read/manage permission for that source domain (best-effort — errs on the
        side of allowing if the caller has broad read perms on that domain).

    Otherwise raise 403. Enforced consistently across get/serve/link/delete so a
    UUID file_id is NOT the only access control.
    """
    if not user:
        # /uploads endpoints are already behind current_user; None only happens
        # via a bug — treat as forbidden.
        raise ForbiddenError("Auth diperlukan", code="UPLOAD_OWNERSHIP_REQUIRED")

    if attachment.get("uploaded_by") == user.get("id"):
        return

    from core.security import get_user_permissions
    perms = await get_user_permissions(user)
    if "*" in perms:
        return

    # Optional source-linked scope: if attachment is linked to a business entity,
    # allow any user who can read that domain (e.g. procurement PO attachment
    # visible to procurement.po.read holders). This matches the "attachments are
    # part of the record" mental model without exposing bare uploads across users.
    src = (attachment.get("source_type") or "").strip().lower()
    if src:
        domain = src.split("_")[0]  # 'purchase_order' -> 'purchase' etc; also 'ar' 'ap' 'pr' 'po' 'gr'
        # Cheap wildcard: any read/create/write perm in that domain OR common aliases.
        aliases = {
            "purchase": ("procurement", "purchase"),
            "goods": ("procurement", "gr"),
            "ap": ("finance",),
            "ar": ("finance",),
            "je": ("finance",),
            "leave": ("hr",),
            "payroll": ("hr",),
            "employee": ("hr",),
            "asset": ("finance",),
            "inventory": ("inventory",),
            "adjustment": ("inventory",),
            "transfer": ("inventory",),
        }
        candidate_domains = {domain} | set(aliases.get(domain, ()))
        for p in perms:
            head = p.split(".")[0]
            if head in candidate_domains:
                return

    raise ForbiddenError(
        "Tidak boleh mengakses attachment yang bukan milik Anda",
        code="UPLOAD_OWNERSHIP_REQUIRED",
    )


async def get_attachment(file_id: str, *, user: Optional[dict] = None) -> dict:
    db = get_db()
    a = await db.attachments.find_one({"id": file_id, "deleted_at": None})
    if not a:
        raise NotFoundError("Attachment")
    if user is not None:
        await _assert_can_access_attachment(user, a)
    return serialize(a)


async def get_attachment_path(file_id: str, *, user: Optional[dict] = None) -> Path:
    a = await get_attachment(file_id, user=user)
    p = Path(a.get("absolute_path") or (UPLOAD_ROOT / a["storage_path"]))
    if not p.exists():
        raise NotFoundError("File hilang dari storage")
    return p


async def list_attachments(
    *, source_type: Optional[str] = None, source_id: Optional[str] = None,
    category: Optional[str] = None, page: int = 1, per_page: int = 50,
) -> tuple[list[dict], dict]:
    db = get_db()
    q: dict = {"deleted_at": None}
    if source_type:
        q["source_type"] = source_type
    if source_id:
        q["source_id"] = source_id
    if category:
        q["category"] = category
    skip = max(0, (page - 1) * per_page)
    items = await db.attachments.find(q).sort("created_at", -1).skip(skip).limit(per_page).to_list(per_page)
    total = await db.attachments.count_documents(q)
    return [serialize(d) for d in items], {"page": page, "per_page": per_page, "total": total}


async def delete_attachment(file_id: str, *, user: dict) -> dict:
    db = get_db()
    a = await db.attachments.find_one({"id": file_id, "deleted_at": None})
    if not a:
        raise NotFoundError("Attachment")
    # Only uploader or super can delete
    from core.security import get_user_permissions
    perms = await get_user_permissions(user)
    if a.get("uploaded_by") != user.get("id") and "*" not in perms:
        raise ForbiddenError("Hanya uploader yang dapat menghapus file ini")
    await db.attachments.update_one({"id": file_id}, {"$set": {"deleted_at": _now_iso()}})
    # Soft-delete only — disk file untouched (can be cleaned by separate purge job).
    await audit_log(
        user_id=user.get("id"), entity_type="attachment", entity_id=file_id, action="delete",
    )
    return {"id": file_id, "deleted_at": _now_iso()}


async def link_attachment(
    file_id: str, *, source_type: str, source_id: str, user: dict,
) -> dict:
    """Update an attachment's source linkage (e.g. when later attached to a record).

    IDOR guard: only the uploader OR super may re-link. Prevents an attacker
    from re-parenting someone else's file into their own record.
    """
    db = get_db()
    a = await db.attachments.find_one({"id": file_id, "deleted_at": None})
    if not a:
        raise NotFoundError("Attachment")
    # Only uploader or super can re-link
    from core.security import get_user_permissions
    perms = await get_user_permissions(user)
    if a.get("uploaded_by") != user.get("id") and "*" not in perms:
        raise ForbiddenError(
            "Hanya uploader yang dapat mengubah linkage attachment ini",
            code="UPLOAD_OWNERSHIP_REQUIRED",
        )
    await db.attachments.update_one(
        {"id": file_id},
        {"$set": {
            "source_type": source_type,
            "source_id": source_id,
            "updated_at": _now_iso(),
        }},
    )
    return await get_attachment(file_id, user=user)
