"""Report Builder (lite) — ad-hoc multi-dimensional aggregation."""
from typing import Any, Optional

from core.db import get_db
from core.exceptions import ValidationError

from services._reports_analytics._common import (
    SUPPORTED_DIMENSIONS, SUPPORTED_METRICS, _dim_value,
)


async def report_builder(
    *,
    dimensions: list[str],
    metrics: list[str],
    period_from: Optional[str] = None,
    period_to: Optional[str] = None,
    outlet_ids: Optional[list[str]] = None,
    brand_ids: Optional[list[str]] = None,
    vendor_ids: Optional[list[str]] = None,
    category_ids: Optional[list[str]] = None,
    sort_by: Optional[str] = None,
    sort_dir: str = "desc",
    limit: int = 100,
) -> dict[str, Any]:
    """Run an ad-hoc aggregation. Returns rows keyed by dimension tuple + metric values."""
    if not dimensions:
        raise ValidationError("Pilih minimal 1 dimensi")
    if not metrics:
        raise ValidationError("Pilih minimal 1 metrik")
    bad_dims = [d for d in dimensions if d not in SUPPORTED_DIMENSIONS]
    if bad_dims:
        raise ValidationError(f"Dimensi tidak didukung: {bad_dims}")
    bad_metrics = [m for m in metrics if m not in SUPPORTED_METRICS]
    if bad_metrics:
        raise ValidationError(f"Metrik tidak didukung: {bad_metrics}")

    db = get_db()

    # Lookup maps for human-readable labels
    outlets_map: dict[str, dict] = {}
    brands_map: dict[str, dict] = {}
    vendors_map: dict[str, dict] = {}
    categories_map: dict[str, dict] = {}
    items_map: dict[str, dict] = {}

    if "outlet" in dimensions or outlet_ids:
        async for o in db.outlets.find({"deleted_at": None}):
            outlets_map[o["id"]] = {"id": o["id"], "name": o.get("name", o["id"]),
                                     "brand_id": o.get("brand_id"), "code": o.get("code", "")}
    if "brand" in dimensions or brand_ids:
        async for b in db.brands.find({"deleted_at": None}):
            brands_map[b["id"]] = {"id": b["id"], "name": b.get("name", b["id"]), "code": b.get("code", "")}
    if "vendor" in dimensions or vendor_ids:
        async for v in db.vendors.find({"deleted_at": None}):
            vendors_map[v["id"]] = {"id": v["id"], "name": v.get("name", v["id"]), "code": v.get("code", "")}
    if "category" in dimensions or category_ids:
        async for c in db.categories.find({"deleted_at": None}):
            categories_map[c["id"]] = {"id": c["id"], "name": c.get("name", c["id"]), "code": c.get("code", "")}
        async for it in db.items.find({"deleted_at": None}, {"id": 1, "category_id": 1}):
            items_map[it["id"]] = {"category_id": it.get("category_id")}

    # Build aggregation result per dim_tuple
    agg: dict[tuple, dict[str, float]] = {}

    # ---- Sales / transaction_count / gross_profit (sales side) ----
    if any(m in metrics for m in ("sales", "transaction_count", "gross_profit")):
        sales_match: dict = {"deleted_at": None, "status": "validated"}
        if period_from or period_to:
            sales_match["sales_date"] = {}
            if period_from:
                sales_match["sales_date"]["$gte"] = period_from
            if period_to:
                sales_match["sales_date"]["$lte"] = period_to
        if outlet_ids:
            sales_match["outlet_id"] = {"$in": outlet_ids}
        if brand_ids:
            sales_match["brand_id"] = {"$in": brand_ids}
        async for d in db.daily_sales.find(sales_match):
            outlet = outlets_map.get(d.get("outlet_id"))
            brand_id = (outlet or {}).get("brand_id") or d.get("brand_id")
            if brand_ids and brand_id not in brand_ids:
                continue
            month = (d.get("sales_date") or "")[:7]
            dim_key = tuple(_dim_value(dim, d.get("outlet_id"), brand_id, None, None, month) for dim in dimensions)
            row = agg.setdefault(dim_key, {})
            row["sales"] = row.get("sales", 0.0) + float(d.get("grand_total", 0) or 0)
            row["transaction_count"] = row.get("transaction_count", 0.0) + float(d.get("transaction_count", 0) or 0)

    # ---- Purchase value / PO count / GR count / AP exposure ----
    if any(m in metrics for m in ("purchase_value", "po_count", "gr_count", "ap_exposure")):
        gr_match: dict = {"deleted_at": None}
        if period_from or period_to:
            gr_match["receive_date"] = {}
            if period_from:
                gr_match["receive_date"]["$gte"] = period_from
            if period_to:
                gr_match["receive_date"]["$lte"] = period_to
        if vendor_ids:
            gr_match["vendor_id"] = {"$in": vendor_ids}
        if outlet_ids:
            gr_match["outlet_id"] = {"$in": outlet_ids}
        async for gr in db.goods_receipts.find(gr_match):
            vendor_id = gr.get("vendor_id")
            outlet_id = gr.get("outlet_id")
            outlet = outlets_map.get(outlet_id)
            brand_id = (outlet or {}).get("brand_id")
            if brand_ids and brand_id not in brand_ids:
                continue
            month = (gr.get("receive_date") or "")[:7]

            grand = float(gr.get("grand_total", 0) or 0)
            unpaid = not (gr.get("paid_at") or gr.get("payment_status") == "paid")

            # If category dimension requested → split by line.item.category
            if "category" in dimensions:
                lines = gr.get("lines", [])
                # Split grand_total weighted by line total
                line_totals = [float(ln.get("total", 0) or 0) for ln in lines]
                line_sum = sum(line_totals) or 1
                for ln, lt in zip(lines, line_totals):
                    cat_id = (items_map.get(ln.get("item_id"), {}) or {}).get("category_id")
                    if category_ids and cat_id not in category_ids:
                        continue
                    weight = lt / line_sum
                    dim_key = tuple(_dim_value(dim, outlet_id, brand_id, vendor_id, cat_id, month) for dim in dimensions)
                    r = agg.setdefault(dim_key, {})
                    r["purchase_value"] = r.get("purchase_value", 0.0) + grand * weight
                    r["po_count"] = r.get("po_count", 0.0)  # po_count is per PO - skip line split
                    r["gr_count"] = r.get("gr_count", 0.0) + (1 / max(len(lines), 1))
                    if unpaid:
                        r["ap_exposure"] = r.get("ap_exposure", 0.0) + grand * weight
            else:
                if category_ids:
                    continue  # filter doesn't apply at GR level
                dim_key = tuple(_dim_value(dim, outlet_id, brand_id, vendor_id, None, month) for dim in dimensions)
                r = agg.setdefault(dim_key, {})
                r["purchase_value"] = r.get("purchase_value", 0.0) + grand
                r["gr_count"] = r.get("gr_count", 0.0) + 1
                if unpaid:
                    r["ap_exposure"] = r.get("ap_exposure", 0.0) + grand

        # PO count
        if "po_count" in metrics:
            po_match: dict = {"deleted_at": None}
            if period_from or period_to:
                po_match["order_date"] = {}
                if period_from:
                    po_match["order_date"]["$gte"] = period_from
                if period_to:
                    po_match["order_date"]["$lte"] = period_to
            if vendor_ids:
                po_match["vendor_id"] = {"$in": vendor_ids}
            if outlet_ids:
                po_match["outlet_id"] = {"$in": outlet_ids}
            async for po in db.purchase_orders.find(po_match):
                vendor_id = po.get("vendor_id")
                outlet_id = po.get("outlet_id")
                outlet = outlets_map.get(outlet_id)
                brand_id = (outlet or {}).get("brand_id")
                month = (po.get("order_date") or "")[:7]
                if "category" in dimensions:
                    continue  # category dim not meaningful at PO header
                dim_key = tuple(_dim_value(dim, outlet_id, brand_id, vendor_id, None, month) for dim in dimensions)
                r = agg.setdefault(dim_key, {})
                r["po_count"] = r.get("po_count", 0.0) + 1

    # ---- COGS / Gross Profit (JE side) ----
    if any(m in metrics for m in ("cogs", "gross_profit")):
        # Find COGS COA ids
        cogs_coa_ids: list[str] = []
        async for c in db.chart_of_accounts.find({"type": "cogs", "is_postable": True, "deleted_at": None}):
            cogs_coa_ids.append(c["id"])
        if cogs_coa_ids:
            je_match: dict = {"deleted_at": None, "status": "posted"}
            if period_from or period_to:
                je_match["entry_date"] = {}
                if period_from:
                    je_match["entry_date"]["$gte"] = period_from
                if period_to:
                    je_match["entry_date"]["$lte"] = period_to
            async for je in db.journal_entries.find(je_match):
                month = (je.get("entry_date") or je.get("period") or "")[:7]
                for ln in je.get("lines", []):
                    if ln.get("coa_id") not in cogs_coa_ids:
                        continue
                    cogs_amt = float(ln.get("dr", 0) or 0) - float(ln.get("cr", 0) or 0)
                    if cogs_amt == 0:
                        continue
                    outlet_id = ln.get("dim_outlet")
                    if outlet_ids and outlet_id not in outlet_ids:
                        continue
                    outlet = outlets_map.get(outlet_id)
                    brand_id = (outlet or {}).get("brand_id") or ln.get("dim_brand")
                    if brand_ids and brand_id not in brand_ids:
                        continue
                    dim_key = tuple(_dim_value(dim, outlet_id, brand_id, None, None, month) for dim in dimensions)
                    r = agg.setdefault(dim_key, {})
                    r["cogs"] = r.get("cogs", 0.0) + cogs_amt

    # Compute derived gross_profit & finalize
    rows_out: list[dict[str, Any]] = []
    grand_totals: dict[str, float] = {m: 0.0 for m in metrics}
    for dim_key, vals in agg.items():
        if "gross_profit" in metrics:
            vals["gross_profit"] = vals.get("sales", 0) - vals.get("cogs", 0)
        # Extract only requested metrics
        out_row: dict[str, Any] = {}
        for i, dim in enumerate(dimensions):
            label_id = dim_key[i]
            label = label_id
            if dim == "outlet":
                label = outlets_map.get(label_id, {}).get("name", label_id) if label_id else "(tanpa outlet)"
            elif dim == "brand":
                label = brands_map.get(label_id, {}).get("name", label_id) if label_id else "(tanpa brand)"
            elif dim == "vendor":
                label = vendors_map.get(label_id, {}).get("name", label_id) if label_id else "(tanpa vendor)"
            elif dim == "category":
                label = categories_map.get(label_id, {}).get("name", label_id) if label_id else "(tanpa kategori)"
            elif dim == "month":
                label = label_id or "(no date)"
            out_row[f"dim_{dim}"] = label
            out_row[f"dim_{dim}_id"] = label_id
        for m in metrics:
            v = round(vals.get(m, 0.0), 2)
            out_row[m] = v
            grand_totals[m] = grand_totals.get(m, 0.0) + v
        rows_out.append(out_row)

    # Sort
    if sort_by:
        if sort_by in metrics or sort_by.startswith("dim_"):
            rows_out.sort(key=lambda r: (r.get(sort_by) or 0), reverse=(sort_dir.lower() == "desc"))
    else:
        # Default: sort by first metric desc
        first_metric = metrics[0]
        rows_out.sort(key=lambda r: r.get(first_metric, 0), reverse=True)

    if limit and len(rows_out) > limit:
        rows_out = rows_out[:limit]

    return {
        "rows": rows_out,
        "totals": {m: round(grand_totals.get(m, 0), 2) for m in metrics},
        "row_count": len(rows_out),
        "config": {
            "dimensions": dimensions,
            "metrics": metrics,
            "filters": {
                "period_from": period_from, "period_to": period_to,
                "outlet_ids": outlet_ids, "brand_ids": brand_ids,
                "vendor_ids": vendor_ids, "category_ids": category_ids,
            },
            "sort_by": sort_by, "sort_dir": sort_dir,
        },
    }
