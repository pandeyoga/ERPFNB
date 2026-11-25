"""Parser nilai sel untuk file dari berbagai sumber (POS, aplikasi delivery, bank, Excel buatan tangan).

Prinsip: tidak pernah melempar galat untuk sel yang aneh — kembalikan None dan biarkan lapisan atas mencatat masalah.
Format yang ditangani:
- Angka Indonesia & Inggris: "Rp 1.234.567", "1.234.567,50", "1,234,567.50", "(1.000)", "-1.000", "1.500.000,00 CR",
  "1.5jt"/"2,5 juta"/"300rb", sel Excel numerik, persen. Pemisah desimal bisa disimpulkan per kolom (infer_decimal).
- Tanggal: objek datetime/date, nomor seri Excel, ISO, d/m/y, m/d/y (disimpulkan per kolom), "25 Nov 2026",
  "Selasa, 25 November 2026", "25-Nov-26", "Nov 25, 2026", tanpa tahun ("'01/11" di CSV bank) memakai year_hint.
- Jam: "19:30", "19.30", "7:30 PM", "19:30:15", pecahan hari Excel, datetime.
"""
from __future__ import annotations

import math
import re
from datetime import date, datetime, time, timedelta
from typing import Any, Iterable, Optional

MONTHS = {
    "jan": 1, "januari": 1, "january": 1, "feb": 2, "februari": 2, "february": 2, "peb": 2, "pebruari": 2,
    "mar": 3, "maret": 3, "march": 3, "apr": 4, "april": 4, "mei": 5, "may": 5, "jun": 6, "juni": 6, "june": 6,
    "jul": 7, "juli": 7, "july": 7, "agu": 8, "ags": 8, "agt": 8, "agus": 8, "agustus": 8, "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9, "okt": 10, "oktober": 10, "oct": 10, "october": 10,
    "nov": 11, "nop": 11, "nopember": 11, "november": 11, "des": 12, "desember": 12, "dec": 12, "december": 12,
}
WEEKDAYS = r"(senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu|ahad|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)"
EXCEL_EPOCH = datetime(1899, 12, 30)
_MULT = {"jt": 1e6, "juta": 1e6, "rb": 1e3, "ribu": 1e3, "k": 1e3, "m": 1e6, "miliar": 1e9, "milyar": 1e9, "b": 1e9}


def is_blank(v: Any) -> bool:
    if v is None:
        return True
    if isinstance(v, float) and math.isnan(v):
        return True
    return isinstance(v, str) and v.strip() in ("", "-", "—", "–", "nan", "NaN", "None", "null", "NULL", "#N/A")


def clean_text(v: Any) -> str:
    if is_blank(v):
        return ""
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    s = str(v).replace(" ", " ").strip()
    if s.startswith("'"):           # penanda teks Excel / CSV bank ("'01/11", "'1234567890")
        s = s[1:]
    return re.sub(r"\s+", " ", s).strip()


def _numeric_core(s: str) -> str:
    return re.sub(r"[^\d.,]", "", s)


def infer_decimal(values: Iterable[Any]) -> Optional[str]:
    """Simpulkan pemisah desimal kolom: "," (Indonesia), "." (Inggris), atau None (tidak ada bukti)."""
    comma = dot = 0
    for v in values:
        if isinstance(v, (int, float)) or is_blank(v):
            continue
        s = _numeric_core(clean_text(v))
        if not s:
            continue
        if "," in s and "." in s:
            if s.rfind(",") > s.rfind("."):
                comma += 2
            else:
                dot += 2
        elif "," in s:
            if re.fullmatch(r"\d{1,3}(,\d{3})+", s):
                dot += 1           # 1,234,567 → koma = ribuan → desimal titik
            else:
                comma += 1
        elif "." in s:
            if re.fullmatch(r"\d{1,3}(\.\d{3})+", s):
                comma += 1         # 1.234.567 → titik = ribuan → desimal koma
            else:
                dot += 1
    if comma == dot:
        return None
    return "," if comma > dot else "."


def parse_number(v: Any, decimal: Optional[str] = None) -> Optional[float]:
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return None if (isinstance(v, float) and math.isnan(v)) else float(v)
    s = clean_text(v)
    if not s:
        return None
    low = re.sub(r"[.,]-$", "", s.lower().strip())   # "Rp 45.000,-" = tanpa sen, bukan negatif
    neg = False
    if (low.startswith("(") and low.endswith(")")) or low.endswith("-") and len(low) > 1:
        neg = True
    low = low.strip("()")
    low = re.sub(r"\b(rp|idr|usd)\.?", "", low)
    low = re.sub(r"\s+(cr|db|dr|d|k|c|kredit|debit|debet)$", "", low).strip()
    if low.startswith("-") or low.startswith("−"):
        neg = True
    low = low.lstrip("-−+ ").rstrip("- ")
    pct = low.endswith("%")
    low = low.rstrip("% ")
    mult = 1.0
    m = re.fullmatch(r"([\d.,]+)\s*(jt|juta|rb|ribu|k|m|miliar|milyar|b)", low)
    if m:
        low, mult = m.group(1), _MULT[m.group(2)]
        if decimal is None and "," in low and "." not in low:
            decimal = ","          # "2,5 juta"
    if not re.fullmatch(r"[\d.,\s]+", low):
        return None
    s2 = low.replace(" ", "")
    if decimal is None:
        decimal = infer_decimal([s2]) or ("," if re.fullmatch(r"\d+,\d{1,2}", s2) else ".")
    if decimal == ",":
        s2 = s2.replace(".", "").replace(",", ".")
    else:
        s2 = s2.replace(",", "")
    if s2.count(".") > 1:          # "1.234.567" ditebak salah → titik = ribuan; "1.500.000.00" → .00 = desimal
        head, _, tail = s2.rpartition(".")
        s2 = head.replace(".", "") + ("." + tail if len(tail) == 2 else tail)
    try:
        val = float(s2) * mult
    except ValueError:
        return None
    if pct:
        val = val / 100.0
    return -val if neg else val


def dc_sign(v: Any) -> Optional[int]:
    """Penanda debit/kredit bank: CR/K/Kredit → +1 (masuk), DB/D/DR/Debit/Debet → −1 (keluar)."""
    s = clean_text(v).lower().strip(". ")
    if s in ("cr", "c", "k", "kr", "kredit", "credit", "masuk", "in", "+"):
        return 1
    if s in ("db", "d", "dr", "debit", "debet", "keluar", "out", "-"):
        return -1
    m = re.search(r"\b(cr|db|dr)\s*$", s)
    if m:
        return 1 if m.group(1) == "cr" else -1
    return None


def _excel_serial(n: float) -> Optional[datetime]:
    if 20000 <= n <= 80000:      # 1954–2119
        return EXCEL_EPOCH + timedelta(days=float(n))
    return None


def infer_date_order(values: Iterable[Any]) -> str:
    """'DMY' (default Indonesia), 'MDY' bila ada bukti bulan di depan, 'YMD' untuk ISO."""
    dmy = mdy = ymd = 0
    for v in values:
        if isinstance(v, (datetime, date)) or is_blank(v):
            continue
        s = clean_text(v)
        m = re.match(r"^(\d{1,4})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?", s)
        if not m:
            continue
        a, b = int(m.group(1)), int(m.group(2))
        if len(m.group(1)) == 4:
            ymd += 1
        elif a > 12 >= b:
            dmy += 1
        elif b > 12 >= a:
            mdy += 1
    if ymd > dmy + mdy:
        return "YMD"
    return "MDY" if mdy > dmy else "DMY"


def _year(y: Optional[str], hint: Optional[int]) -> Optional[int]:
    if y is None:
        return hint
    n = int(y)
    if n < 100:
        n += 2000 if n < 70 else 1900
    return n


def parse_date(v: Any, order: str = "DMY", year_hint: Optional[int] = None) -> Optional[date]:
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    if hasattr(v, "to_pydatetime"):            # pandas Timestamp
        try:
            return v.to_pydatetime().date()
        except Exception:  # noqa: BLE001
            return None
    if isinstance(v, (int, float)):
        if isinstance(v, float) and math.isnan(v):
            return None
        if 19000101 <= v <= 21001231 and float(v).is_integer():
            s = str(int(v))
            try:
                return date(int(s[:4]), int(s[4:6]), int(s[6:]))
            except ValueError:
                return None
        dt = _excel_serial(float(v))
        return dt.date() if dt else None
    s = clean_text(v).lower()
    if not s:
        return None
    s = re.sub(r"^" + WEEKDAYS + r",?\s+", "", s)
    s = re.sub(r"(\d)(st|nd|rd|th)\b", r"\1", s)
    try:
        # numerik: 2026-11-25 / 25/11/2026 / 11/25/26 / 25.11.2026 / 01/11 (tanpa tahun) / 20261125
        m = re.match(r"^(\d{1,4})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?(?=$|[\st,])", s)
        if m:
            a, b, c = m.group(1), m.group(2), m.group(3)
            if len(a) == 4:
                return date(int(a), int(b), int(c or 1))
            if order == "YMD" and c and len(c) <= 2:
                return date(_year(a, year_hint), int(b), int(c))
            d_, mo = (int(b), int(a)) if order == "MDY" else (int(a), int(b))
            y = _year(c, year_hint)
            return date(y, mo, d_) if y else None
        m = re.match(r"^(\d{8})$", s)
        if m:
            return date(int(s[:4]), int(s[4:6]), int(s[6:]))
        # "25 nov 2026", "25-nov-26", "25 november", "nov 25, 2026"
        m = re.match(r"^(\d{1,2})[\s\-/.]+([a-z]{3,10})\.?[\s\-/.,]*(\d{2,4})?", s)
        if m and m.group(2) in MONTHS:
            y = _year(m.group(3), year_hint)
            return date(y, MONTHS[m.group(2)], int(m.group(1))) if y else None
        m = re.match(r"^([a-z]{3,10})\.?\s+(\d{1,2}),?\s*(\d{2,4})?", s)
        if m and m.group(1) in MONTHS:
            y = _year(m.group(3), year_hint)
            return date(y, MONTHS[m.group(1)], int(m.group(2))) if y else None
    except (ValueError, TypeError):
        return None
    return None


def parse_time(v: Any) -> Optional[str]:
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, datetime):
        return v.strftime("%H:%M:%S") if (v.hour or v.minute or v.second) else None
    if isinstance(v, time):
        return v.strftime("%H:%M:%S")
    if isinstance(v, (int, float)):
        if isinstance(v, float) and math.isnan(v):
            return None
        f = float(v) % 1 if v >= 1 else float(v)
        if 0 <= f < 1:
            secs = round(f * 86400)
            return f"{secs // 3600 % 24:02d}:{secs // 60 % 60:02d}:{secs % 60:02d}"
        return None
    s = clean_text(v).lower()
    m = re.search(r"(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?(?:\s|$|[^\d])", s + " ")
    if not m:
        return None
    h, mi, se = int(m.group(1)), int(m.group(2)), int(m.group(3) or 0)
    ap = (m.group(4) or "").replace(".", "")
    if ap == "pm" and h < 12:
        h += 12
    if ap == "am" and h == 12:
        h = 0
    if h > 23 or mi > 59 or se > 59:
        return None
    return f"{h:02d}:{mi:02d}:{se:02d}"


def parse_datetime(v: Any, order: str = "DMY", year_hint: Optional[int] = None) -> tuple[Optional[date], Optional[str]]:
    """Sel yang berisi tanggal + jam sekaligus (mis. "25/11/2026 19:30", ISO "2026-11-25T19:30:00+07:00")."""
    if isinstance(v, datetime):
        return v.date(), parse_time(v)
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        dt = _excel_serial(float(v)) if not (isinstance(v, float) and math.isnan(v)) else None
        return (dt.date(), parse_time(float(v))) if dt else (parse_date(v, order, year_hint), None)
    d = parse_date(v, order, year_hint)
    if d is None:
        return None, None
    s = clean_text(v)
    rest = re.sub(r"^\S+\s*", "", s) if " " in s else (s.split("T", 1)[1] if "T" in s else "")
    t = parse_time(rest) if rest else None
    return d, t


def looks_like_date(v: Any) -> bool:
    if isinstance(v, (datetime, date)):
        return True
    if isinstance(v, (int, float)) or is_blank(v):
        return False
    s = clean_text(v).lower()
    if re.match(r"^\d{1,4}[/\-.]\d{1,2}([/\-.]\d{2,4})?(\s|t|$)", s):
        return parse_date(s, "DMY", 2000) is not None or parse_date(s, "MDY", 2000) is not None
    s2 = re.sub(r"^" + WEEKDAYS + r",?\s+", "", s)
    return bool(re.match(r"^\d{1,2}[\s\-/.]+[a-z]{3,10}", s2) and parse_date(s2, "DMY", 2000)) or \
        bool(re.match(r"^[a-z]{3,10}\.?\s+\d{1,2}", s2) and parse_date(s2, "DMY", 2000))


def looks_like_time(v: Any) -> bool:
    if isinstance(v, time):
        return True
    if isinstance(v, (int, float, datetime, date)) or is_blank(v):
        return False
    return bool(re.fullmatch(r"\d{1,2}[:.]\d{2}([:.]\d{2})?\s*(am|pm)?", clean_text(v).lower()))


def looks_like_number(v: Any) -> bool:
    if isinstance(v, bool):
        return False
    if isinstance(v, (int, float)):
        return not (isinstance(v, float) and math.isnan(v))
    s = clean_text(v)
    if not s or looks_like_date(s) or looks_like_time(s):
        return False
    return parse_number(s) is not None and bool(re.search(r"\d", s))
