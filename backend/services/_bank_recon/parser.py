"""Bank statement CSV/XLSX parser."""
from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime
from typing import Optional


def _parse_date(s: str) -> Optional[str]:
    """Accept various Indonesian date formats, return ISO YYYY-MM-DD."""
    if not s:
        return None
    s = str(s).strip()
    fmts = ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y", "%d/%m/%y", "%d-%m-%y", "%Y/%m/%d"]
    for f in fmts:
        try:
            return datetime.strptime(s, f).strftime("%Y-%m-%d")
        except Exception:  # noqa: BLE001
            continue
    return None


def _parse_amount(s: str) -> Optional[float]:
    if s is None or s == "":
        return None
    s = str(s).strip()
    neg = False
    if s.startswith("(") and s.endswith(")"):
        neg = True
        s = s[1:-1]
    if s.startswith("-"):
        neg = True
        s = s[1:]
    if "," in s and "." in s:
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "," in s:
        parts = s.split(",")
        if len(parts[-1]) == 2:
            s = s.replace(",", ".")
        else:
            s = s.replace(",", "")
    try:
        v = float(s)
        return -v if neg else v
    except Exception:  # noqa: BLE001
        return None


def parse_statement_csv(content: bytes) -> list[dict]:
    """Parse bank CSV."""
    text = content.decode("utf-8-sig", errors="ignore")
    reader = csv.DictReader(io.StringIO(text))
    rows: list[dict] = []
    field_map: dict[str, set[str]] = {
        "date": {"date", "transaction_date", "tanggal", "tgl", "trx_date"},
        "description": {"description", "keterangan", "note", "remark", "memo", "narasi"},
        "amount": {"amount", "nominal", "jumlah", "value"},
        "debit": {"debit", "dr", "db", "debet"},
        "credit": {"credit", "cr", "kredit"},
        "reference": {"reference", "ref", "ref_no", "no_ref", "reference_no"},
    }

    def find(col_row: dict, keys: set[str]) -> Optional[str]:
        for k in col_row:
            if k and k.strip().lower() in keys:
                return k
        return None

    for raw in reader:
        if not raw:
            continue
        d_col = find(raw, field_map["date"])
        desc_col = find(raw, field_map["description"]) or ""
        amt_col = find(raw, field_map["amount"])
        db_col = find(raw, field_map["debit"])
        cr_col = find(raw, field_map["credit"])
        ref_col = find(raw, field_map["reference"])
        date_iso = _parse_date(raw.get(d_col, "") if d_col else "")
        if not date_iso:
            continue
        amount: Optional[float] = None
        if amt_col:
            amount = _parse_amount(raw.get(amt_col))
        elif db_col or cr_col:
            dr_val = _parse_amount(raw.get(db_col, "") if db_col else "") or 0.0
            cr_val = _parse_amount(raw.get(cr_col, "") if cr_col else "") or 0.0
            amount = cr_val - dr_val
        if amount is None or amount == 0:
            continue
        rows.append({
            "id": str(uuid.uuid4()), "date": date_iso,
            "description": str(raw.get(desc_col, "") or "").strip(),
            "amount": round(amount, 2),
            "reference": str(raw.get(ref_col, "") or "").strip() if ref_col else None,
            "matched": False, "match_type": None, "match_target_type": None,
            "match_target_id": None, "match_target_doc_no": None,
            "match_confidence": None, "match_reason": None,
        })
    return rows
