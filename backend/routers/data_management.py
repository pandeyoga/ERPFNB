"""Data Management Router — Import / Export / Delete.

Endpoints:
  GET  /api/admin/data/collections       → list all collections with counts
  POST /api/admin/data/export            → export selected collections to JSON/XLSX
  POST /api/admin/data/import            → import data from JSON file
  POST /api/admin/data/delete            → delete specific categories of data
  GET  /api/admin/data/export/download/{task_id} → download exported file
"""
import io
import json
import logging
import uuid
import zipfile
from datetime import datetime, timezone
from typing import Any, Dict, List

import xlsxwriter
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Body
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core.db import get_db
from core.exceptions import ok_envelope
from core.security import current_user, get_user_permissions


def require_role(roles):
    """Dependency factory - allows SUPER_ADMIN (has '*' permission) or specific roles."""
    async def dep(user: dict = Depends(current_user)) -> dict:
        # Check via permissions: SUPER_ADMIN has '*'
        perms = await get_user_permissions(user)
        if "*" in perms:
            return user
        # Fallback: check role_codes if present
        user_roles = user.get("role_codes", [])
        if any(r in user_roles for r in roles):
            return user
        # Check by looking up role codes from DB
        db = get_db()
        role_ids = user.get("role_ids", [])
        user_role_codes = []
        async for role in db.roles.find({"id": {"$in": role_ids}}):
            user_role_codes.append(role.get("code", ""))
        if any(r in user_role_codes for r in roles):
            return user
        raise HTTPException(status_code=403, detail=f"Required roles: {roles}")
    return dep

logger = logging.getLogger("aurora")
router = APIRouter(prefix="/api/admin/data", tags=["data-management"])


# ── Collection Categories (for delete options) ──────────────────────────────
CATEGORIES: Dict[str, Dict[str, Any]] = {
    "master": {
        "label": "Master Data",
        "description": "COA, Items, Vendors, Payment Methods, Employees, Roles, Bank Accounts, Tax Codes, Categories",
        "color": "blue",
        "collections": ["chart_of_accounts", "items", "vendors", "payment_methods",
                         "bank_accounts", "tax_codes", "categories", "number_series",
                         "business_rules", "company_profile"],
    },
    "employees": {
        "label": "HR & Karyawan",
        "description": "Data karyawan, kasbon, payroll, service charge, incentive",
        "color": "purple",
        "collections": ["employees", "employee_advances", "payroll_runs",
                         "service_charge_runs", "incentive_runs", "leave_requests"],
    },
    "finance": {
        "label": "Data Finance",
        "description": "Journal entries, AP invoices, payment runs, bank recon, fixed assets",
        "color": "green",
        "collections": ["journal_entries", "journal_lines", "ap_invoices",
                         "payment_runs", "bank_reconciliations", "fixed_assets",
                         "periods", "forecast_snapshots"],
    },
    "outlet": {
        "label": "Data Outlet",
        "description": "Daily sales, petty cash, urgent purchase, daily close records",
        "color": "orange",
        "collections": ["daily_sales", "petty_cash", "urgent_purchases",
                         "daily_close_records", "cash_balance_snapshots", "foc_logs"],
    },
    "procurement": {
        "label": "Data Procurement",
        "description": "PR, PO, GR, RFQ, vendor scoring",
        "color": "yellow",
        "collections": ["purchase_requests", "purchase_orders", "goods_receipts",
                         "rfq_sessions", "vendor_scorecards", "payment_requests"],
    },
    "inventory": {
        "label": "Data Inventori",
        "description": "Stock balances, movements, transfers, adjustments, opname",
        "color": "cyan",
        "collections": ["inventory_movements", "stock_balances", "stock_movements",
                         "stock_transfers", "stock_adjustments", "opname_sessions"],
    },
    "crm": {
        "label": "CRM & Loyalty",
        "description": "Loyalty customers, rewards, redemptions, vouchers, reservations",
        "color": "pink",
        "collections": ["loyalty_users", "loyalty_transactions", "vouchers",
                         "reservations", "kdo_bdo_orders"],
    },
    "cms": {
        "label": "CMS & Content",
        "description": "Brands, outlets, articles, careers, menus, media",
        "color": "indigo",
        "collections": ["brands", "outlets", "groups", "cms_articles", "cms_careers",
                         "cms_pages", "cms_media"],
    },
    "system": {
        "label": "Data Sistem",
        "description": "Audit log, notifikasi, scheduler, refresh tokens, anomaly events",
        "color": "gray",
        "collections": ["audit_log", "notifications", "scheduler_runs", "refresh_tokens",
                         "anomaly_events", "digest_logs", "ai_categorize_history"],
    },
}

# All individual collections for export
ALL_COLLECTIONS = [
    "brands", "groups", "outlets", "users", "roles",
    "chart_of_accounts", "items", "vendors", "employees",
    "payment_methods", "bank_accounts", "tax_codes", "categories",
    "number_series", "business_rules", "company_profile",
    "journal_entries", "journal_lines", "ap_invoices",
    "payment_runs", "fixed_assets", "periods", "forecast_snapshots",
    "daily_sales", "petty_cash", "urgent_purchases",
    "daily_close_records", "cash_balance_snapshots", "foc_logs",
    "purchase_requests", "purchase_orders", "goods_receipts",
    "rfq_sessions", "payment_requests",
    "inventory_movements", "stock_balances", "stock_movements",
    "stock_transfers", "stock_adjustments", "opname_sessions",
    "loyalty_users", "loyalty_transactions", "vouchers",
    "reservations", "kdo_bdo_orders",
    "cms_articles", "cms_careers", "cms_pages", "cms_media",
    "employee_advances", "payroll_runs", "service_charge_runs",
    "incentive_runs", "leave_requests",
    "audit_log", "notifications", "scheduler_runs",
    "anomaly_events", "system_settings",
]


def serialize_doc(doc: dict) -> dict:
    """Convert MongoDB document to JSON-serializable dict."""
    if not isinstance(doc, dict):
        return doc
    result = {}
    for k, v in doc.items():
        if k == "_id":
            continue
        elif isinstance(v, datetime):
            result[k] = v.isoformat()
        elif isinstance(v, dict):
            result[k] = serialize_doc(v)
        elif isinstance(v, list):
            result[k] = [serialize_doc(i) if isinstance(i, dict) else
                          (i.isoformat() if isinstance(i, datetime) else i)
                          for i in v]
        else:
            result[k] = v
    return result


# ── Models ───────────────────────────────────────────────────────────────────
class ExportRequest(BaseModel):
    collections: List[str]  # list of collection names OR ["all"]
    format: str = "json"    # "json" or "xlsx" or "zip_json"
    include_system: bool = False


class DeleteRequest(BaseModel):
    categories: List[str]   # e.g. ["finance", "outlet"] or ["ALL"]
    confirm_phrase: str     # must be "HAPUS SEMUA DATA" to confirm


class ImportRequest(BaseModel):
    collection: str
    mode: str = "merge"  # "merge" (upsert) or "replace" (drop+insert)


# ── GET /api/admin/data/collections ──────────────────────────────────────────
@router.get("/collections")
async def list_collections(
    db=Depends(get_db),
    current_user=Depends(require_role(["SUPER_ADMIN"]))
):
    """Return all collections with document counts grouped by category."""
    db_colls = await db.list_collection_names()
    result = {}

    for cat_id, cat_info in CATEGORIES.items():
        cat_colls = []
        for coll_name in cat_info["collections"]:
            count = await db[coll_name].count_documents({}) if coll_name in db_colls else 0
            cat_colls.append({"name": coll_name, "count": count,
                              "exists": coll_name in db_colls})
        result[cat_id] = {
            **cat_info,
            "collections": cat_colls,
            "total_docs": sum(c["count"] for c in cat_colls),
        }

    # All collections summary
    all_stats = []
    for coll_name in sorted(db_colls):
        if coll_name.startswith("system."):
            continue
        count = await db[coll_name].count_documents({})
        all_stats.append({"name": coll_name, "count": count})

    return ok_envelope({"categories": result, "all_collections": all_stats})


# ── POST /api/admin/data/export ───────────────────────────────────────────────
@router.post("/export")
async def export_data(
    request: ExportRequest,
    db=Depends(get_db),
    current_user=Depends(require_role(["SUPER_ADMIN"]))
):
    """Export selected collections. Returns JSON or XLSX file."""
    db_colls = await db.list_collection_names()

    # Resolve collection list
    if "all" in request.collections:
        colls_to_export = [c for c in ALL_COLLECTIONS if c in db_colls]
    else:
        colls_to_export = [c for c in request.collections if c in db_colls]

    if not colls_to_export:
        raise HTTPException(400, "No valid collections selected")

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    if request.format == "xlsx":
        return await _export_xlsx(db, colls_to_export, timestamp)
    elif request.format == "zip_json":
        return await _export_zip_json(db, colls_to_export, timestamp)
    else:  # json
        return await _export_json(db, colls_to_export, timestamp)


async def _export_json(db, collections: List[str], timestamp: str) -> StreamingResponse:
    export_data = {
        "_meta": {
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "app": "FnB Group ERP",
            "company": "FnB Group",
            "version": "0.3.0",
            "collections": collections,
        }
    }
    for coll_name in collections:
        docs = await db[coll_name].find({}).limit(10000).to_list(10000)
        export_data[coll_name] = [serialize_doc(d) for d in docs]

    json_bytes = json.dumps(export_data, ensure_ascii=False, indent=2).encode("utf-8")
    filename = f"aurora_backup_{timestamp}.json"

    return StreamingResponse(
        io.BytesIO(json_bytes),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"',
                 "Content-Length": str(len(json_bytes))}
    )


async def _export_zip_json(db, collections: List[str], timestamp: str) -> StreamingResponse:
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        meta = {"exported_at": datetime.now(timezone.utc).isoformat(),
                "app": "FnB Group ERP", "company": "FnB Group",
                "collections": collections}
        zf.writestr("_meta.json", json.dumps(meta, ensure_ascii=False, indent=2))

        for coll_name in collections:
            docs = await db[coll_name].find({}).limit(10000).to_list(10000)
            data = [serialize_doc(d) for d in docs]
            zf.writestr(f"{coll_name}.json",
                        json.dumps(data, ensure_ascii=False, indent=2))

    zip_buffer.seek(0)
    filename = f"aurora_backup_{timestamp}.zip"
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


async def _export_xlsx(db, collections: List[str], timestamp: str) -> StreamingResponse:
    output = io.BytesIO()
    workbook = xlsxwriter.Workbook(output, {"in_memory": True})

    header_fmt = workbook.add_format({"bold": True, "bg_color": "#1a1a2e",
                                       "font_color": "white", "border": 1})
    cell_fmt = workbook.add_format({"border": 1, "text_wrap": False})

    # Summary sheet
    summary_ws = workbook.add_worksheet("_Summary")
    summary_ws.write(0, 0, "FnB Group ERP — Data Export", header_fmt)
    summary_ws.write(1, 0, f"Exported: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    summary_ws.write(2, 0, "Company: FnB Group")
    summary_ws.write(4, 0, "Collection", header_fmt)
    summary_ws.write(4, 1, "Records", header_fmt)
    summary_ws.set_column(0, 0, 35)
    summary_ws.set_column(1, 1, 12)

    row = 5
    for coll_name in collections:
        docs = await db[coll_name].find({}).limit(10000).to_list(10000)
        if not docs:
            summary_ws.write(row, 0, coll_name, cell_fmt)
            summary_ws.write(row, 1, 0, cell_fmt)
            row += 1
            continue

        # Serialize docs
        serialized = [serialize_doc(d) for d in docs]

        # Create worksheet (max 31 chars for sheet name)
        ws_name = coll_name[:31]
        ws = workbook.add_worksheet(ws_name)

        # Get all keys from first doc
        keys = list(serialized[0].keys()) if serialized else []
        # Write headers
        for col_idx, key in enumerate(keys):
            ws.write(0, col_idx, key, header_fmt)
            ws.set_column(col_idx, col_idx, max(12, len(key) + 2))

        # Write data
        for r_idx, record in enumerate(serialized):
            for c_idx, key in enumerate(keys):
                val = record.get(key, "")
                if isinstance(val, (dict, list)):
                    val = json.dumps(val, ensure_ascii=False)[:500]
                elif val is None:
                    val = ""
                ws.write(r_idx + 1, c_idx, val, cell_fmt)

        summary_ws.write(row, 0, coll_name, cell_fmt)
        summary_ws.write(row, 1, len(docs), cell_fmt)
        row += 1

    workbook.close()
    output.seek(0)
    xlsx_bytes = output.read()
    filename = f"aurora_export_{timestamp}.xlsx"

    return StreamingResponse(
        io.BytesIO(xlsx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"',
                 "Content-Length": str(len(xlsx_bytes))}
    )


# ── POST /api/admin/data/import ───────────────────────────────────────────────
@router.post("/import")
async def import_data(
    file: UploadFile = File(...),
    collection: str = Body(...),
    mode: str = Body("merge"),
    db=Depends(get_db),
    current_user=Depends(require_role(["SUPER_ADMIN"]))
):
    """Import JSON data into a collection.
    mode='merge': upsert by 'id' field
    mode='replace': drop collection then insert all
    """
    if not file.filename.endswith(".json"):
        raise HTTPException(400, "Only .json files are supported for import")

    content = await file.read()
    try:
        data = json.loads(content.decode("utf-8"))
    except json.JSONDecodeError as e:
        raise HTTPException(400, f"Invalid JSON: {e}")

    # Support both array format and full backup format
    if isinstance(data, list):
        records = data
    elif isinstance(data, dict) and collection in data:
        records = data[collection]
    elif isinstance(data, dict) and "_meta" in data:
        # Full backup file - look for the collection
        if collection in data:
            records = data[collection]
        else:
            available = [k for k in data.keys() if k != "_meta"]
            raise HTTPException(400, f"Collection '{collection}' not found in backup. Available: {available}")
    else:
        raise HTTPException(400, "Invalid file format. Expected array or full backup JSON.")

    if not records:
        return ok_envelope({"imported": 0, "collection": collection})

    # Clean _id fields
    for r in records:
        if isinstance(r, dict):
            r.pop("_id", None)

    if mode == "replace":
        await db[collection].drop()
        await db[collection].insert_many(records)
        count = len(records)
    else:  # merge - upsert by id
        from pymongo import UpdateOne
        ops = []
        for r in records:
            if isinstance(r, dict):
                filter_key = {"id": r["id"]} if "id" in r else {"_id": str(uuid.uuid4())}
                ops.append(UpdateOne(filter_key, {"$set": r}, upsert=True))
        if ops:
            result = await db[collection].bulk_write(ops)
            count = result.upserted_count + result.modified_count
        else:
            count = 0

    logger.info(f"data_import collection={collection} mode={mode} count={count} by={current_user.get('email')}")
    return ok_envelope({"imported": count, "collection": collection, "mode": mode})


# ── POST /api/admin/data/import/backup ────────────────────────────────────────
@router.post("/import/backup")
async def import_full_backup(
    file: UploadFile = File(...),
    mode: str = Body("merge"),
    db=Depends(get_db),
    current_user=Depends(require_role(["SUPER_ADMIN"]))
):
    """Import a full backup JSON file (all collections)."""
    if not file.filename.endswith(".json"):
        raise HTTPException(400, "Only .json files are supported")

    content = await file.read()
    try:
        data = json.loads(content.decode("utf-8"))
    except json.JSONDecodeError as e:
        raise HTTPException(400, f"Invalid JSON: {e}")

    if not isinstance(data, dict):
        raise HTTPException(400, "Full backup must be a JSON object")

    results = {}
    for coll_name, records in data.items():
        if coll_name.startswith("_") or not isinstance(records, list):
            continue
        # Clean _id
        for r in records:
            if isinstance(r, dict):
                r.pop("_id", None)

        if mode == "replace":
            await db[coll_name].drop()
            if records:
                await db[coll_name].insert_many(records)
            results[coll_name] = len(records)
        else:
            from pymongo import UpdateOne
            ops = [UpdateOne({"id": r["id"]}, {"$set": r}, upsert=True)
                   for r in records if isinstance(r, dict) and "id" in r]
            if ops:
                res = await db[coll_name].bulk_write(ops)
                results[coll_name] = res.upserted_count + res.modified_count
            else:
                results[coll_name] = 0

    total = sum(results.values())
    logger.info(f"full_backup_import mode={mode} total={total} by={current_user.get('email')}")
    return ok_envelope({"results": results, "total_records": total})


# ── POST /api/admin/data/delete ───────────────────────────────────────────────
@router.post("/delete")
async def delete_data(
    request: DeleteRequest,
    db=Depends(get_db),
    current_user=Depends(require_role(["SUPER_ADMIN"]))
):
    """Delete data by category. Requires confirm_phrase='HAPUS SEMUA DATA'."""
    CONFIRM = "HAPUS SEMUA DATA"
    if request.confirm_phrase != CONFIRM:
        raise HTTPException(400, f"Konfirmasi tidak valid. Ketik: {CONFIRM}")

    results = {}
    categories_to_delete = request.categories

    if "ALL" in categories_to_delete:
        # Delete everything except users, roles, number_series, system_settings
        PROTECTED = {"users", "roles", "number_series", "system_settings"}
        db_colls = await db.list_collection_names()
        for coll in db_colls:
            if coll in PROTECTED or coll.startswith("system."):
                continue
            res = await db[coll].delete_many({})
            results[coll] = res.deleted_count
    else:
        for cat_id in categories_to_delete:
            if cat_id not in CATEGORIES:
                continue
            for coll_name in CATEGORIES[cat_id]["collections"]:
                # Never delete protected collections
                if coll_name in {"users", "roles", "system_settings"}:
                    continue
                res = await db[coll_name].delete_many({})
                results[coll_name] = res.deleted_count

    total_deleted = sum(results.values())
    logger.warning(f"data_delete categories={categories_to_delete} total={total_deleted} by={current_user.get('email')}")

    return ok_envelope({"deleted": results, "total_deleted": total_deleted})


# ── GET /api/admin/data/preview/{collection} ─────────────────────────────────
@router.get("/preview/{collection}")
async def preview_collection(
    collection: str,
    limit: int = Query(10, ge=1, le=500),
    db=Depends(get_db),
    current_user=Depends(require_role(["SUPER_ADMIN"]))
):
    """Preview first N records of a collection."""
    docs = await db[collection].find({}).limit(limit).to_list(limit)
    total = await db[collection].count_documents({})
    return ok_envelope({"records": [serialize_doc(d) for d in docs],
                     "total": total, "preview_count": len(docs)})
