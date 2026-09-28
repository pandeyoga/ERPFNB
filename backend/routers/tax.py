"""Tax router — Sprint 1 Compliance Indonesia 2026.

Endpoints:
  GET  /api/tax/config              — current tax config (all types)
  PUT  /api/tax/config              — update one or more config keys
  GET  /api/tax/types               — PPh type metadata + service subtypes
  POST /api/tax/calculate           — preview calculation (no side effects)
  GET  /api/tax/withholding         — list withholding transactions
  GET  /api/tax/withholding/summary — monthly rollup per type
  GET  /api/tax/pph21/brackets      — bracket table for display
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query

from core.exceptions import ok_envelope
from core.security import current_user, require_perm, require_any_perm
from models.tax import PPH21_BRACKETS, PPH23_SERVICE_TYPES, PPH42_SERVICE_TYPES, PPH_TYPES
from services import tax_service
from services.system_settings_service import set_value

router = APIRouter(prefix="/api/tax", tags=["tax"])


@router.get("/config")
async def get_tax_config(user: dict = Depends(current_user)):
    """Return full tax configuration."""
    config = await tax_service.get_tax_config()
    return ok_envelope(config)


@router.put("/config")
async def update_tax_config(
    payload: dict,
    user: dict = Depends(require_perm("system.settings.manage")),
):
    """Update tax configuration keys. Payload is a flat dict of key→value.

    Supported keys:
      TAX_PPN_ENABLED, TAX_PPN_RATE,
      TAX_PPH21_ENABLED, TAX_PPH21_METHOD,
      TAX_PPH23_ENABLED, TAX_PPH23_RATE,
      TAX_PPH42_ENABLED, TAX_PPH42_RATE
    """
    ALLOWED_KEYS = {
        "TAX_PPN_ENABLED", "TAX_PPN_RATE",
        "TAX_PPH21_ENABLED", "TAX_PPH21_METHOD",
        "TAX_PPH23_ENABLED", "TAX_PPH23_RATE",
        "TAX_PPH42_ENABLED", "TAX_PPH42_RATE",
    }
    updated = []
    for k, v in payload.items():
        if k not in ALLOWED_KEYS:
            continue
        await set_value(k, str(v), user=user)
        updated.append(k)
    config = await tax_service.get_tax_config()
    return ok_envelope({"updated": updated, "config": config})


@router.get("/types")
async def get_tax_types(user: dict = Depends(current_user)):
    """Return metadata about all PPh types and their subtypes."""
    return ok_envelope({
        "pph_types": PPH_TYPES,
        "pph23_service_types": PPH23_SERVICE_TYPES,
        "pph42_service_types": PPH42_SERVICE_TYPES,
    })


@router.post("/calculate")
async def calculate_preview(payload: dict, user: dict = Depends(current_user)):
    """Preview tax calculation — no side effects.

    Payload:
      { tax_type: 'ppn'|'pph21'|'pph23'|'pph42',
        gross_amount: float,
        service_type: str (for pph23/pph42),
        monthly_gross: float (for pph21),
        ptkp_status: str (for pph21, default 'TK/0') }
    """
    tax_type = payload.get("tax_type", "ppn")
    gross = float(payload.get("gross_amount", 0) or 0)

    if tax_type == "ppn":
        result = await tax_service.calc_ppn(gross)
    elif tax_type == "pph21":
        monthly = float(payload.get("monthly_gross", gross) or gross)
        ptkp = payload.get("ptkp_status", "TK/0")
        result = tax_service.calc_pph21_monthly(monthly, ptkp)
    elif tax_type == "pph23":
        st = payload.get("service_type", "jasa")
        result = await tax_service.calc_pph23(gross, st)
    elif tax_type == "pph42":
        st = payload.get("service_type", "sewa_bangunan")
        result = await tax_service.calc_pph42(gross, st)
    else:
        result = {"error": f"Unknown tax_type: {tax_type}"}

    return ok_envelope(result)


@router.get("/withholding")
async def list_withholding(
    period: Optional[str] = Query(None),
    wh_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    user: dict = Depends(require_any_perm("finance.tax.manage", "finance.report.profit_loss", "system.settings.manage")),
):
    items, meta = await tax_service.list_withholding(
        period=period, wh_type=wh_type, page=page, per_page=per_page,
    )
    return ok_envelope(items, meta=meta)


@router.get("/withholding/summary")
async def withholding_summary(
    year: Optional[str] = Query(None),
    user: dict = Depends(require_any_perm("finance.tax.manage", "finance.report.profit_loss", "system.settings.manage")),
):
    result = await tax_service.withholding_summary(year=year)
    return ok_envelope(result)


@router.get("/pph21/brackets")
async def pph21_brackets(user: dict = Depends(current_user)):
    """Return PPh 21 progressive bracket table for UI display."""
    from models.tax import PTKP_BY_STATUS
    brackets_fmt = [
        {
            "lower": lower,
            "upper": upper if upper != float("inf") else None,
            "rate": rate,
            "rate_pct": round(rate * 100, 0),
            "label": f"Rp {lower/1_000_000:.0f}jt – {'∞' if upper == float('inf') else f'Rp {upper/1_000_000:.0f}jt'}",
        }
        for lower, upper, rate in PPH21_BRACKETS
    ]
    return ok_envelope({
        "brackets": brackets_fmt,
        "ptkp_table": PTKP_BY_STATUS,
        "law_ref": "UU HPP No. 7/2021 - berlaku mulai 1 Jan 2022",
    })



@router.get("/pph21/spt-export")
async def export_pph21_spt(
    period: str = Query(..., description="YYYY-MM"),
    user: dict = Depends(require_any_perm("finance.tax.manage", "finance.report.profit_loss", "system.settings.manage")),
):
    """Export PPh21 Monthly SPT mass CSV from payroll cycles.
    Format: DJP e-SPT PPh 21 Masa (simplified 1721-I equivalent).
    """
    from fastapi.responses import StreamingResponse
    import csv
    import io
    db_ref = None
    from core.db import get_db
    db_ref = get_db()

    # Get all posted payroll cycles for the period
    cycles = await db_ref.payroll_cycles.find({
        "period": period,
        "status": {"$in": ["posted", "approved", "draft"]},
        "deleted_at": None,
    }).to_list(50)

    rows = []
    for cycle in cycles:
        for emp in cycle.get("employees", []):
            pph21_detail = emp.get("pph21_detail", {})
            rows.append({
                "NPWP": emp.get("npwp", "000000000000000"),
                "Nama Pegawai": emp.get("name", ""),
                "Periode": period,
                "Penghasilan Bruto Bulanan": emp.get("gross", 0),
                "Penghasilan Bruto Setahun": pph21_detail.get("annual_gross", emp.get("gross", 0) * 12),
                "Biaya Jabatan": pph21_detail.get("biaya_jabatan", 0),
                "PTKP": pph21_detail.get("ptkp", 54_000_000),
                "Status PTKP": emp.get("ptkp_status", "TK/0"),
                "PKP Setahun": pph21_detail.get("annual_pkp", 0),
                "PPh 21 Setahun": pph21_detail.get("annual_tax", 0),
                "PPh 21 Sebulan": emp.get("pph21", 0),
                "BPJS TK (Karyawan)": round(
                    (emp.get("bpjs_detail", {}).get("jht_employee", 0) or 0) +
                    (emp.get("bpjs_detail", {}).get("jp_employee", 0) or 0), 2
                ),
                "BPJS Kesehatan (Karyawan)": emp.get("bpjs_detail", {}).get("jkes_employee", 0) or 0,
                "Take Home Pay": emp.get("take_home", 0),
                "Doc No": cycle.get("doc_no", ""),
            })

    output = io.StringIO()
    if rows:
        writer = csv.DictWriter(output, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    else:
        # Write header only
        output.write("NPWP,Nama Pegawai,Periode,Penghasilan Bruto Bulanan,Penghasilan Bruto Setahun,Biaya Jabatan,PTKP,Status PTKP,PKP Setahun,PPh 21 Setahun,PPh 21 Sebulan,BPJS TK (Karyawan),BPJS Kesehatan (Karyawan),Take Home Pay,Doc No\n")

    output.seek(0)
    filename = f"SPT_PPh21_Masa_{period}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/pph21/summary")
async def pph21_summary(
    period: str = Query(..., description="YYYY-MM"),
    user: dict = Depends(require_any_perm("finance.tax.manage", "finance.report.profit_loss", "system.settings.manage")),
):
    """PPh21 monthly summary from payroll cycles for the given period."""
    from core.db import get_db
    db_ref = get_db()
    cycles = await db_ref.payroll_cycles.find({
        "period": period,
        "status": {"$in": ["posted", "approved", "draft"]},
        "deleted_at": None,
    }).to_list(50)

    total_pph21 = 0.0
    total_employees = 0
    employees_with_pph21 = 0
    breakdown = []

    for cycle in cycles:
        for emp in cycle.get("employees", []):
            pph21 = float(emp.get("pph21", 0) or 0)
            total_pph21 += pph21
            total_employees += 1
            if pph21 > 0:
                employees_with_pph21 += 1
            breakdown.append({
                "name": emp.get("name"),
                "ptkp_status": emp.get("ptkp_status", "TK/0"),
                "gross_monthly": emp.get("gross", 0),
                "pph21_monthly": pph21,
                "doc_no": cycle.get("doc_no"),
            })

    return ok_envelope({
        "period": period,
        "total_pph21": round(total_pph21, 2),
        "total_employees": total_employees,
        "employees_with_pph21": employees_with_pph21,
        "breakdown": breakdown,
    })
