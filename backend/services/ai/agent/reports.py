"""Pembuat laporan Excel & PDF untuk Asisten AI.

Spesifikasi (tool `create_report`):
  {title, subtitle?, format: "xlsx"|"pdf", sections: [
     {heading?, text?, table?: {columns: [..], rows: [[..]], number_format?: "rp"|"num"|"pct"},
      chart?: {type: bar|line|pie|area, x_key, series: [{key, label}], data: [{..}], title?}}
  ]}
Excel: sheet "Ringkasan" (judul, teks, tabel kecil) + satu sheet per tabel + grafik native Excel.
PDF: A4, judul, paragraf, tabel, grafik (reportlab.graphics). Angka uang ditulis format Indonesia (titik ribuan).
"""
from __future__ import annotations

import io
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from core.exceptions import ValidationError

WIB = timezone(timedelta(hours=7))
MAX_SECTIONS = 30
MAX_TABLE_ROWS = 5000


def _num(v: Any) -> Any:
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return v
    if isinstance(v, str):
        s = v.strip().replace("Rp", "").replace(" ", "")
        if re.fullmatch(r"-?[\d.]+(,\d+)?", s) and ("." in s or "," in s or s.lstrip("-").isdigit()):
            try:
                return float(s.replace(".", "").replace(",", "."))
            except ValueError:
                return v
    return v


def fmt_id(v: Any, kind: str = "num") -> str:
    if not isinstance(v, (int, float)) or isinstance(v, bool):
        return "" if v is None else str(v)
    if kind == "pct":
        return f"{v:,.1f}%".replace(",", "X").replace(".", ",").replace("X", ".")
    s = f"{v:,.0f}".replace(",", ".")
    return f"Rp {s}" if kind == "rp" else s


def validate(spec: dict) -> dict:
    title = str(spec.get("title") or "").strip()
    if not title:
        raise ValidationError("Judul laporan wajib diisi")
    fmt = str(spec.get("format") or "xlsx").lower()
    if fmt not in ("xlsx", "pdf"):
        raise ValidationError("format harus xlsx atau pdf")
    sections = spec.get("sections") or []
    if not isinstance(sections, list) or not sections:
        raise ValidationError("sections kosong")
    clean = []
    for s in sections[:MAX_SECTIONS]:
        if not isinstance(s, dict):
            continue
        t = s.get("table")
        if t:
            cols = [str(c) for c in (t.get("columns") or [])]
            rows = [list(r) if isinstance(r, (list, tuple)) else [r.get(c) for c in cols] for r in (t.get("rows") or [])][:MAX_TABLE_ROWS]
            t = {"columns": cols, "rows": [[_num(x) for x in r] for r in rows], "number_format": t.get("number_format") or "num"}
        c = s.get("chart")
        if c:
            if c.get("type") not in ("bar", "line", "pie", "area") or not c.get("x_key") or not c.get("series") or not c.get("data"):
                raise ValidationError("chart butuh type (bar/line/pie/area), x_key, series, data")
            c = {**c, "data": list(c["data"])[:200], "series": list(c["series"])[:6]}
        clean.append({"heading": s.get("heading"), "text": s.get("text"), "table": t, "chart": c})
    return {"title": title, "subtitle": spec.get("subtitle") or "", "format": fmt, "sections": clean}


def _filename(title: str, ext: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9_-]+", "_", title).strip("_")[:60] or "laporan"
    return f"{safe}_{datetime.now(WIB):%Y%m%d-%H%M}.{ext}"


def _plain(md: str) -> list[str]:
    """Markdown sederhana → baris teks (tebal/miring dibuang, butir dipertahankan)."""
    out = []
    for line in str(md or "").splitlines():
        line = re.sub(r"\*\*(.+?)\*\*", r"\1", line)
        line = re.sub(r"(?<!\*)\*(?!\s)(.+?)\*", r"\1", line)
        line = re.sub(r"^#+\s*", "", line)
        line = re.sub(r"^\s*[-*]\s+", "• ", line)
        out.append(line)
    return out


# ---------------------------------------------------------------- Excel

def build_xlsx(spec: dict) -> bytes:
    import xlsxwriter
    buf = io.BytesIO()
    wb = xlsxwriter.Workbook(buf, {"in_memory": True})
    f_title = wb.add_format({"bold": True, "font_size": 15})
    f_sub = wb.add_format({"font_color": "#555555", "italic": True})
    f_head = wb.add_format({"bold": True, "font_size": 12})
    f_th = wb.add_format({"bold": True, "bg_color": "#EEF0F7", "border": 1, "text_wrap": True, "valign": "top"})
    f_td = wb.add_format({"border": 1, "valign": "top"})
    f_num = wb.add_format({"border": 1, "num_format": "#,##0"})
    f_rp = wb.add_format({"border": 1, "num_format": '"Rp" #,##0'})
    f_pct = wb.add_format({"border": 1, "num_format": "0.0"})
    f_wrap = wb.add_format({"text_wrap": True, "valign": "top"})
    sumws = wb.add_worksheet("Ringkasan")
    sumws.set_column(0, 0, 100)
    sumws.write(0, 0, spec["title"], f_title)
    sumws.write(1, 0, f"{spec['subtitle']} · dibuat {datetime.now(WIB):%d %b %Y %H:%M} WIB".strip(" ·"), f_sub)
    r = 3
    used = {"Ringkasan"}
    for i, s in enumerate(spec["sections"], 1):
        if s.get("heading"):
            sumws.write(r, 0, s["heading"], f_head)
            r += 1
        for line in _plain(s.get("text") or ""):
            sumws.write(r, 0, line, f_wrap)
            r += 1
        t, c = s.get("table"), s.get("chart")
        sheet = None
        if t and t["columns"]:
            name = re.sub(r"[\[\]:*?/\\]", "", (s.get("heading") or f"Tabel {i}"))[:28] or f"Tabel {i}"
            base, n = name, 2
            while name in used:
                name = f"{base[:25]} {n}"
                n += 1
            used.add(name)
            sheet = wb.add_worksheet(name)
            sheet.write(0, 0, s.get("heading") or spec["title"], f_head)
            nf = {"rp": f_rp, "pct": f_pct}.get(t["number_format"], f_num)
            for ci, col in enumerate(t["columns"]):
                sheet.write(2, ci, col, f_th)
                width = max([len(str(col))] + [len(fmt_id(row[ci])) if ci < len(row) else 0 for row in t["rows"][:200]])
                sheet.set_column(ci, ci, min(45, max(10, width + 2)))
            for ri, row in enumerate(t["rows"]):
                for ci, v in enumerate(row[:len(t["columns"])]):
                    if isinstance(v, (int, float)) and not isinstance(v, bool):
                        sheet.write_number(3 + ri, ci, v, nf)
                    else:
                        sheet.write(3 + ri, ci, "" if v is None else str(v), f_td)
            sheet.autofilter(2, 0, 2 + len(t["rows"]), len(t["columns"]) - 1)
            sheet.freeze_panes(3, 0)
            sumws.write(r, 0, f"→ Tabel lengkap di sheet '{name}' ({len(t['rows'])} baris)", f_sub)
            r += 1
        if c:
            data_ws = sheet or wb.add_worksheet(f"Grafik {i}"[:31])
            if not sheet:
                used.add(f"Grafik {i}")
            # tulis data grafik di kolom kanan sheet (sumber seri)
            col0 = (len(t["columns"]) + 2) if (sheet and t) else 0
            keys = [c["x_key"]] + [x["key"] for x in c["series"]]
            for ki, k in enumerate(keys):
                data_ws.write(2, col0 + ki, k if ki == 0 else next((x.get("label") or x["key"] for x in c["series"] if x["key"] == k), k), f_th)
                for di, row in enumerate(c["data"]):
                    v = _num(row.get(k))
                    if isinstance(v, (int, float)) and ki > 0:
                        data_ws.write_number(3 + di, col0 + ki, v)
                    else:
                        data_ws.write(3 + di, col0 + ki, "" if v is None else str(v))
            ctype = {"bar": "column", "line": "line", "area": "area", "pie": "pie"}[c["type"]]
            ch = wb.add_chart({"type": ctype})
            n = len(c["data"])
            for si, ser in enumerate(c["series"] if ctype != "pie" else c["series"][:1]):
                ch.add_series({"name": ser.get("label") or ser["key"],
                               "categories": [data_ws.name, 3, col0, 2 + n, col0],
                               "values": [data_ws.name, 3, col0 + 1 + si, 2 + n, col0 + 1 + si]})
            ch.set_title({"name": c.get("title") or s.get("heading") or ""})
            ch.set_size({"width": 720, "height": 360})
            if ctype != "pie":
                ch.set_y_axis({"num_format": "#,##0"})
            data_ws.insert_chart(3 + n + 2 if not sheet else 3 + len(t["rows"]) + 2, 0, ch)
            sumws.write(r, 0, f"→ Grafik di sheet '{data_ws.name}'", f_sub)
            r += 1
        r += 1
    wb.close()
    return buf.getvalue()


# ---------------------------------------------------------------- PDF

def build_pdf(spec: dict) -> bytes:
    from reportlab.graphics.charts.barcharts import VerticalBarChart
    from reportlab.graphics.charts.legends import Legend
    from reportlab.graphics.charts.linecharts import HorizontalLineChart
    from reportlab.graphics.charts.piecharts import Pie
    from reportlab.graphics.shapes import Drawing, String
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import KeepTogether, LongTable, Paragraph, SimpleDocTemplate, Spacer, TableStyle
    from xml.sax.saxutils import escape

    palette = [colors.HexColor(x) for x in ("#4F46E5", "#7C3AED", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444")]
    ss = getSampleStyleSheet()
    st_title = ParagraphStyle("t", parent=ss["Title"], fontSize=16, spaceAfter=4, alignment=0)
    st_sub = ParagraphStyle("s", parent=ss["Normal"], fontSize=8.5, textColor=colors.HexColor("#555555"), spaceAfter=10)
    st_h = ParagraphStyle("h", parent=ss["Heading2"], fontSize=12, spaceBefore=8, spaceAfter=4)
    st_p = ParagraphStyle("p", parent=ss["Normal"], fontSize=9, leading=12.5)
    st_cell = ParagraphStyle("c", parent=ss["Normal"], fontSize=7.5, leading=9)
    st_num = ParagraphStyle("n", parent=st_cell, alignment=2)
    buf = io.BytesIO()
    width = A4[0] - 30 * mm
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=14 * mm,
                            bottomMargin=14 * mm, title=spec["title"])
    story: list = [Paragraph(escape(spec["title"]), st_title),
                   Paragraph(escape(f"{spec['subtitle']} · dibuat {datetime.now(WIB):%d %b %Y %H:%M} WIB".strip(" ·")), st_sub)]

    def chart_drawing(c: dict) -> Drawing:
        h = 62 * mm
        d = Drawing(width, h)
        cats = [str(r.get(c["x_key"]))[:14] for r in c["data"]]
        series = c["series"]
        vals = [[float(_num(r.get(s["key"])) or 0) if isinstance(_num(r.get(s["key"])), (int, float)) else 0.0
                 for r in c["data"]] for s in series]
        if c["type"] == "pie":
            p = Pie()
            p.x, p.y, p.width, p.height = 20, 10, h - 20, h - 20
            p.data = vals[0] or [1]
            p.labels = None
            for i in range(len(p.data)):
                p.slices[i].fillColor = palette[i % len(palette)]
            lg = Legend()
            lg.x, lg.y, lg.alignment = h + 20, h - 10, "right"
            lg.fontSize, lg.fontName = 7, "Helvetica"
            lg.colorNamePairs = [(palette[i % len(palette)], f"{cats[i]}: {fmt_id(p.data[i])}") for i in range(min(len(cats), 12))]
            d.add(p)
            d.add(lg)
            return d
        ch = VerticalBarChart() if c["type"] == "bar" else HorizontalLineChart()
        ch.x, ch.y, ch.width, ch.height = 40, 22, width - 60, h - 40
        ch.data = vals
        ch.categoryAxis.categoryNames = cats
        ch.categoryAxis.labels.fontSize = 6.5
        ch.categoryAxis.labels.angle = 30 if len(cats) > 8 else 0
        ch.categoryAxis.labels.boxAnchor = "ne" if len(cats) > 8 else "n"
        ch.valueAxis.labels.fontSize = 6.5
        ch.valueAxis.labels.fontName = ch.categoryAxis.labels.fontName = "Helvetica"
        ch.valueAxis.labelTextFormat = lambda v: fmt_id(v)
        flat = [v for row in vals for v in row]
        if flat and min(flat) >= 0:
            ch.valueAxis.valueMin = 0  # batang/garis selalu mulai dari nol (tidak menyesatkan)
        for i in range(len(vals)):
            if c["type"] == "bar":
                ch.bars[i].fillColor = palette[i % len(palette)]
            else:
                ch.lines[i].strokeColor = palette[i % len(palette)]
                ch.lines[i].strokeWidth = 1.5
        d.add(ch)
        if len(series) > 1:
            lg = Legend()
            lg.x, lg.y, lg.fontSize, lg.fontName = 40, h - 2, 7, "Helvetica"
            lg.columnMaximum, lg.alignment = 1, "right"
            lg.colorNamePairs = [(palette[i % len(palette)], s.get("label") or s["key"]) for i, s in enumerate(series)]
            d.add(lg)
        if c.get("title"):
            d.add(String(40, h - 10, c["title"], fontSize=8, fontName="Helvetica"))
        return d

    for s in spec["sections"]:
        block: list = []
        if s.get("heading"):
            block.append(Paragraph(escape(s["heading"]), st_h))
        for line in _plain(s.get("text") or ""):
            if line.strip():
                block.append(Paragraph(escape(line), st_p))
        if s.get("chart"):
            block += [Spacer(1, 4), chart_drawing(s["chart"]), Spacer(1, 6)]
        # judul tidak boleh terpisah dari grafik/paragraf pertamanya
        if block and (s.get("chart") or len(block) <= 2):
            story.append(KeepTogether(block))
        elif block:
            story += [KeepTogether(block[:2]), *block[2:]]
        t = s.get("table")
        if t and t["columns"]:
            nf = t["number_format"]
            data = [[Paragraph(f"<b>{escape(c)}</b>", st_cell) for c in t["columns"]]]
            for row in t["rows"][:2000]:
                data.append([Paragraph(escape(fmt_id(v, nf) if isinstance(v, (int, float)) else ("" if v is None else str(v))),
                                       st_num if isinstance(v, (int, float)) else st_cell) for v in row[:len(t["columns"])]])
            tbl = LongTable(data, repeatRows=1, colWidths=[width / len(t["columns"])] * len(t["columns"]))
            tbl.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EEF0F7")),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#CCCCCC")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FAFAFC")]),
            ]))
            story += [Spacer(1, 4), tbl, Spacer(1, 6)]

    def footer(canvas, doc_):
        canvas.saveState()
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(colors.HexColor("#777777"))
        canvas.drawString(15 * mm, 8 * mm, f"{spec['title']} — dibuat oleh Asisten AI FnB Group ERP")
        canvas.drawRightString(A4[0] - 15 * mm, 8 * mm, f"Hal. {doc_.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buf.getvalue()


def build(spec: dict) -> tuple[bytes, str, str]:
    spec = validate(spec)
    if spec["format"] == "pdf":
        return build_pdf(spec), _filename(spec["title"], "pdf"), "application/pdf"
    return (build_xlsx(spec), _filename(spec["title"], "xlsx"),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
