"""Bulk Excel Import Router

Endpoints for Admin to upload and import master data via Excel.

Endpoints:
  GET  /api/admin/bulk-import/entity-types          List supported entities
  GET  /api/admin/bulk-import/template/{entity}     Download Excel template
  POST /api/admin/bulk-import/preview/{entity}      Upload & validate (preview)
  POST /api/admin/bulk-import/commit/{entity}       Commit import (upsert)
"""
import logging
from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import Response

from core.audit import log as audit_log
from core.exceptions import ok_envelope, ValidationError
from core.security import require_perm
from services import excel_import_service

router = APIRouter(prefix="/api/admin/bulk-import", tags=["bulk-import"])
logger = logging.getLogger("aurora.bulk_import_router")


@router.get("/entity-types")
async def list_entity_types(user: dict = Depends(require_perm("admin.master_data.write"))):
    """List all supported entity types for bulk import."""
    items = []
    for entity_type, config in excel_import_service.ENTITY_CONFIGS.items():
        items.append({
            "value": entity_type,
            "label": config["label"],
            "unique_key": config["unique_key"],
            "required_fields": config["required_fields"],
        })
    return ok_envelope({"items": items, "total": len(items)})


@router.get("/template/{entity_type}")
async def download_template(
    entity_type: str,
    user: dict = Depends(require_perm("admin.master_data.write")),
):
    """Download Excel template for entity type."""
    if entity_type not in excel_import_service.ENTITY_CONFIGS:
        raise ValidationError(f"Entity type tidak didukung: {entity_type}")

    config = excel_import_service.ENTITY_CONFIGS[entity_type]
    
    # Generate template
    template_bytes = excel_import_service.generate_template(entity_type)

    # Audit log
    await audit_log(
        action="bulk_import.template.download",
        entity_type="bulk_import",
        entity_id=entity_type,
        user_id=user["id"],
        after={"entity_type": entity_type},
    )

    filename = f"template_{entity_type}_{config['label'].replace(' ', '_')}.xlsx"
    
    return Response(
        content=template_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )


@router.post("/preview/{entity_type}")
async def preview_import(
    entity_type: str,
    file: UploadFile = File(...),
    user: dict = Depends(require_perm("admin.master_data.write")),
):
    """Upload Excel file and preview validation results (does not commit)."""
    if entity_type not in excel_import_service.ENTITY_CONFIGS:
        raise ValidationError(f"Entity type tidak didukung: {entity_type}")

    # Validate file type
    if not file.filename.endswith((".xlsx", ".xls")):
        raise ValidationError("File harus berformat .xlsx atau .xls")

    # Read file
    file_bytes = await file.read()

    # Parse and validate
    result = excel_import_service.parse_excel(entity_type, file_bytes)

    # Audit log
    await audit_log(
        action="bulk_import.preview",
        entity_type="bulk_import",
        entity_id=entity_type,
        user_id=user["id"],
        after={
            "entity_type": entity_type,
            "filename": file.filename,
            "total_rows": result["total_rows"],
            "valid": result["summary"]["valid"],
            "invalid": result["summary"]["invalid"],
        },
    )

    logger.info(
        f"Bulk import preview: {entity_type}, "
        f"total={result['total_rows']}, "
        f"valid={result['summary']['valid']}, "
        f"invalid={result['summary']['invalid']}"
    )

    return ok_envelope(result)


@router.post("/commit/{entity_type}")
async def commit_import(
    entity_type: str,
    file: UploadFile = File(...),
    user: dict = Depends(require_perm("admin.master_data.write")),
):
    """Upload Excel file and commit import (upsert to database)."""
    if entity_type not in excel_import_service.ENTITY_CONFIGS:
        raise ValidationError(f"Entity type tidak didukung: {entity_type}")

    # Validate file type
    if not file.filename.endswith((".xlsx", ".xls")):
        raise ValidationError("File harus berformat .xlsx atau .xls")

    # Read file
    file_bytes = await file.read()

    # Parse and validate
    parse_result = excel_import_service.parse_excel(entity_type, file_bytes)

    if parse_result["summary"]["valid"] == 0:
        raise ValidationError(
            f"Tidak ada data valid untuk di-import. "
            f"Total {parse_result['summary']['invalid']} rows dengan error."
        )

    # Commit valid rows
    import_result = await excel_import_service.commit_import(
        entity_type,
        parse_result["valid_rows"],
        user["id"],
    )

    # Audit log
    await audit_log(
        action="bulk_import.commit",
        entity_type="bulk_import",
        entity_id=entity_type,
        user_id=user["id"],
        after={
            "entity_type": entity_type,
            "filename": file.filename,
            "total_rows": parse_result["total_rows"],
            "created": import_result["created"],
            "updated": import_result["updated"],
            "skipped": import_result["skipped"],
        },
    )

    logger.info(
        f"Bulk import committed: {entity_type}, "
        f"created={import_result['created']}, "
        f"updated={import_result['updated']}, "
        f"skipped={import_result['skipped']}"
    )

    return ok_envelope({
        "parse_summary": parse_result["summary"],
        "import_result": import_result,
        "invalid_rows": parse_result["invalid_rows"],  # Return errors for download
    })
