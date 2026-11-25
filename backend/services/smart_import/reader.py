"""Baca file mentah (CSV/TXT/XLSX/XLS) → tabel, lalu profil: baris header, kop (metadata), baris total/kosong, tipe kolom.

Tahan terhadap: BOM & encoding Windows (cp1252/latin-1), pemisah ; , tab |, baris kop/judul di atas header
(mis. CSV KlikBCA: "No. rekening : ,'123…"), sel gabung di Excel (nilai disebar ke seluruh area gabungan), kolom
header kosong (mis. penanda CR/DB di samping "Jumlah"), header ganda, baris total/subtotal/saldo di bawah tabel.
"""
from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass, field
from typing import Any, Optional

from core.exceptions import ValidationError

from .parsing import clean_text, is_blank, looks_like_date, looks_like_number, looks_like_time

MAX_ROWS = 200_000
MAX_COLS = 80
FOOTER_RE = re.compile(r"^(grand\s*total|sub\s*total|total|jumlah|saldo\s*(awal|akhir)|mutasi\s*(kredit|debet|debit)|"
                       r"total\s*(transaksi|penjualan|kredit|debet|debit)|summary|ringkasan|dicetak|printed|halaman|page\s*\d)",
                       re.I)


@dataclass
class Sheet:
    name: str
    rows: list[list[Any]]


@dataclass
class Table:
    sheet: str
    header_row: int
    headers: list[str]
    rows: list[list[Any]]              # baris data (sudah tanpa kop/footer/kosong)
    meta: dict = field(default_factory=dict)
    dropped: dict = field(default_factory=dict)
    source_rows: list[int] = field(default_factory=list)   # nomor baris asli (1-based) per baris data


def _decode(data: bytes) -> str:
    if data[:2] in (b"\xff\xfe", b"\xfe\xff"):          # UTF-16 hanya bila ada BOM (ekspor Excel "Unicode Text")
        return data.decode("utf-16", errors="replace")
    try:
        return data.decode("utf-8-sig")
    except UnicodeDecodeError:
        return data.decode("cp1252", errors="replace")    # ekspor Windows/Excel lama (é, ü, …)


def _sniff_delimiter(text: str) -> str:
    sample = "\n".join(text.splitlines()[:40])
    try:
        return csv.Sniffer().sniff(sample, delimiters=",;\t|").delimiter
    except csv.Error:
        counts = {d: sum(line.count(d) for line in sample.splitlines()) for d in (",", ";", "\t", "|")}
        return max(counts, key=counts.get) if any(counts.values()) else ","


def read_sheets(data: bytes, filename: str) -> list[Sheet]:
    name = (filename or "").lower()
    if not data:
        raise ValidationError("File kosong")
    if name.endswith((".xlsx", ".xlsm")) or data[:2] == b"PK":
        return _read_xlsx(data)
    head = data[:4096].lower()
    if (b"<table" in head or b"<html" in head) and not data[:2] == b"PK":   # "xls" dari web/POS yang sebenarnya HTML
        return _read_html(_decode(data))
    if name.endswith(".xls") or data[:8] == b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1":
        return _read_xls(data)
    if name.endswith((".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic")):
        raise ValidationError("File gambar/PDF tidak bisa dibaca sebagai tabel — kirim ke Asisten AI (OCR) atau ekspor ke Excel/CSV")
    text = _decode(data)
    if "<table" in text[:5000].lower():                 # beberapa "xls" dari web sebenarnya HTML
        return _read_html(text)
    delim = _sniff_delimiter(text)
    rows = [list(r) for r in csv.reader(io.StringIO(text), delimiter=delim)][:MAX_ROWS]
    return [Sheet("csv", rows)]


def _read_xlsx(data: bytes) -> list[Sheet]:
    import openpyxl
    try:
        wb = openpyxl.load_workbook(io.BytesIO(data), data_only=True, read_only=len(data) > 15_000_000)
    except Exception as e:  # noqa: BLE001
        raise ValidationError(f"File Excel tidak bisa dibuka: {str(e)[:120]}")
    out = []
    for ws in wb.worksheets:
        if getattr(ws, "sheet_state", "visible") != "visible":
            continue
        rows = [list(r[:MAX_COLS]) for r in ws.iter_rows(values_only=True)][:MAX_ROWS]
        for rng in getattr(ws, "merged_cells", None) and list(ws.merged_cells.ranges) or []:
            v = rows[rng.min_row - 1][rng.min_col - 1] if rng.min_row - 1 < len(rows) and rng.min_col - 1 < len(rows[rng.min_row - 1]) else None
            for r in range(rng.min_row - 1, min(rng.max_row, len(rows))):
                for c in range(rng.min_col - 1, min(rng.max_col, MAX_COLS)):
                    while len(rows[r]) <= c:
                        rows[r].append(None)
                    if rows[r][c] is None:
                        rows[r][c] = v
        out.append(Sheet(ws.title, rows))
    return out


def _read_xls(data: bytes) -> list[Sheet]:
    try:
        import xlrd
    except ImportError:
        raise ValidationError("File .xls lama belum didukung server ini — simpan ulang sebagai .xlsx atau .csv")
    try:
        book = xlrd.open_workbook(file_contents=data)
    except Exception as e:  # noqa: BLE001
        raise ValidationError(f"File .xls tidak bisa dibuka: {str(e)[:120]}")
    out = []
    for sh in book.sheets():
        rows = []
        for r in range(min(sh.nrows, MAX_ROWS)):
            row = []
            for c in range(min(sh.ncols, MAX_COLS)):
                cell = sh.cell(r, c)
                if cell.ctype == xlrd.XL_CELL_DATE:
                    try:
                        row.append(xlrd.xldate.xldate_as_datetime(cell.value, book.datemode))
                    except Exception:  # noqa: BLE001
                        row.append(cell.value)
                else:
                    row.append(cell.value)
            rows.append(row)
        out.append(Sheet(sh.name, rows))
    return out


def _read_html(text: str) -> list[Sheet]:
    """Tabel HTML (ekspor "xls" dari web/POS) dengan parser bawaan Python — tanpa lxml."""
    from html.parser import HTMLParser

    class P(HTMLParser):
        def __init__(self):
            super().__init__(convert_charrefs=True)
            self.tables: list[list[list[str]]] = []
            self.row: Optional[list[str]] = None
            self.cell: Optional[list[str]] = None
            self.span = 1

        def handle_starttag(self, tag, attrs):
            if tag == "table":
                self.tables.append([])
            elif tag == "tr" and self.tables:
                self.row = []
            elif tag in ("td", "th") and self.row is not None:
                self.cell = []
                try:
                    self.span = max(1, min(50, int(dict(attrs).get("colspan") or 1)))
                except ValueError:
                    self.span = 1
            elif tag == "br" and self.cell is not None:
                self.cell.append(" ")

        def handle_endtag(self, tag):
            if tag in ("td", "th") and self.cell is not None and self.row is not None:
                v = " ".join("".join(self.cell).split())
                self.row.extend([v] + [None] * (self.span - 1))
                self.cell = None
            elif tag == "tr" and self.row is not None and self.tables:
                self.tables[-1].append(self.row)
                self.row = None

        def handle_data(self, data):
            if self.cell is not None:
                self.cell.append(data)

    p = P()
    p.feed(text)
    tables = [t for t in p.tables if t]
    if not tables:
        raise ValidationError("Tidak ada tabel di file HTML")
    return [Sheet(f"tabel {i + 1}", [[c if c != "" else None for c in r] for r in t][:MAX_ROWS]) for i, t in enumerate(tables)]


# ------------------------------------------------------------------ profil

def _nonblank(row: list[Any]) -> list[Any]:
    return [c for c in row if not is_blank(c)]


def _is_text_label(v: Any) -> bool:
    if is_blank(v) or isinstance(v, (int, float)):
        return False
    s = clean_text(v)
    return bool(re.search(r"[A-Za-z]", s)) and not looks_like_date(s) and len(s) <= 60


def find_header(rows: list[list[Any]], known: set[str], normalize) -> int:
    """Baris header = baris dengan banyak label teks yang dikenal, diikuti baris data yang konsisten."""
    best, best_score = 0, -1.0
    limit = min(len(rows), 40)
    for i in range(limit):
        row = rows[i]
        cells = _nonblank(row)
        if len(cells) < 2:
            continue
        labels = [c for c in cells if _is_text_label(c)]
        hits = sum(1 for c in labels if normalize(c) in known or any(k in normalize(c) for k in known if len(k) >= 5))
        follow = rows[i + 1:i + 6]
        filled = [len(_nonblank(r)) for r in follow]
        consistent = sum(1 for f in filled if f >= max(2, len(cells) * 0.5))
        datas = sum(1 for r in follow for c in r if looks_like_number(c) or looks_like_date(c))
        score = hits * 4 + len(labels) / max(1, len(cells)) * 3 + consistent + min(datas, 10) * 0.3 - (len(cells) - len(labels)) * 0.5
        if score > best_score:
            best, best_score = i, score
    return best


def _meta_from(rows: list[list[Any]]) -> dict:
    meta: dict = {}
    lines = []
    for r in rows:
        cells = []
        for c in r:                                        # sel gabung menyebar nilai yang sama → ambil sekali
            t = clean_text(c)
            if t and (not cells or cells[-1] != t):
                cells.append(t)
        if not cells:
            continue
        lines.append(" ".join(cells))
        if len(cells) >= 2 and cells[0].rstrip(": ").strip():
            meta[cells[0].rstrip(": ").strip()] = " ".join(cells[1:]).strip(": ").strip()
        elif ":" in cells[0]:
            k, _, v = cells[0].partition(":")
            if k.strip() and v.strip():
                meta[k.strip()] = v.strip()
    if lines:
        meta["_teks"] = " | ".join(lines)[:600]
    return meta


def build_table(sheet: Sheet, header_row: int) -> Table:
    rows = sheet.rows
    width = max((len(r) for r in rows[header_row:header_row + 200]), default=0)
    head = [clean_text(c) for c in (rows[header_row] + [None] * width)[:width]]
    # header kosong di kolom yang berisi data → beri nama; header duplikat → tambahkan nomor
    seen: dict[str, int] = {}
    headers = []
    for i, h in enumerate(head):
        h = h or f"Kolom {i + 1}"
        if h.lower() in seen:
            seen[h.lower()] += 1
            h = f"{h} ({seen[h.lower()]})"
        else:
            seen[h.lower()] = 1
        headers.append(h)
    data, src = [], []
    dropped = {"kosong": 0, "total/ringkasan": 0, "header_ulang": 0}
    footer_meta: list[list[Any]] = []
    head_norm = [h.lower() for h in head]
    for idx in range(header_row + 1, len(rows)):
        r = (list(rows[idx]) + [None] * width)[:width]
        cells = _nonblank(r)
        if not cells:
            dropped["kosong"] += 1
            continue
        first = clean_text(cells[0])
        if [clean_text(c).lower() for c in r] == head_norm:
            dropped["header_ulang"] += 1
            continue
        if FOOTER_RE.match(first) and (len(cells) <= max(3, width // 2) or "total" in first.lower()):
            dropped["total/ringkasan"] += 1
            footer_meta.append(r)
            continue
        data.append(r)
        src.append(idx + 1)
    # buang kolom yang seluruhnya kosong (header & data)
    keep = [i for i in range(width) if head[i] or any(not is_blank(r[i]) for r in data[:2000])]
    meta = _meta_from(rows[:header_row])
    if footer_meta:
        meta.update({f"ringkasan: {k}": v for k, v in _meta_from(footer_meta).items() if k != "_teks"})
    return Table(sheet=sheet.name, header_row=header_row + 1, headers=[headers[i] for i in keep],
                 rows=[[r[i] for i in keep] for r in data], meta=meta, dropped=dropped, source_rows=src)


def column_type(values: list[Any]) -> str:
    vals = [v for v in values if not is_blank(v)][:300]
    if not vals:
        return "kosong"
    n = len(vals)
    dates = sum(1 for v in vals if looks_like_date(v))
    times = sum(1 for v in vals if looks_like_time(v))
    nums = sum(1 for v in vals if looks_like_number(v))
    dt_with_time = sum(1 for v in vals if (hasattr(v, "hour") and (v.hour or v.minute)) or
                       (isinstance(v, str) and re.search(r"\d[:.]\d{2}", v) and looks_like_date(v)))
    if dates >= 0.8 * n:
        return "datetime" if dt_with_time >= 0.5 * n else "date"
    if times >= 0.8 * n:
        return "time"
    if nums >= 0.8 * n:
        return "number"
    return "text"
