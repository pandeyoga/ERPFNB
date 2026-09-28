"""PO PDF generation service (Phase 9B).

Pure-Python (reportlab) — no system deps. Generates a clean,
print-ready Purchase Order PDF in Indonesian.

Usage:
  pdf_bytes = await build_po_pdf(po_id, user=...)
"""
from __future__ import annotations

import io
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

from core.db import get_db
from core.exceptions import NotFoundError


def _fmt_rp(amount: float | int | None) -> str:
    if amount is None:
        return "Rp 0"
    try:
        n = int(round(float(amount)))
    except Exception:  # noqa: BLE001
        return "Rp 0"
    s = f"{n:,}".replace(",", ".")
    if n < 0:
        return f"-Rp {s.lstrip('-')}"
    return f"Rp {s}"


def _fmt_date_id(s: str | None) -> str:
    if not s:
        return "—"
    try:
        d = datetime.strptime(s[:10], "%Y-%m-%d")
        months_id = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
                     "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
        return f"{d.day} {months_id[d.month-1]} {d.year}"
    except Exception:  # noqa: BLE001
        return s


async def _load_context(po_id: str) -> dict:
    db = get_db()
    po = await db.purchase_orders.find_one({"id": po_id, "deleted_at": None})
    if not po:
        raise NotFoundError("PO")
    vendor = await db.vendors.find_one({"id": po.get("vendor_id"), "deleted_at": None}) if po.get("vendor_id") else None
    outlet = await db.outlets.find_one({"id": po.get("outlet_id"), "deleted_at": None}) if po.get("outlet_id") else None
    brand = None
    if outlet and outlet.get("brand_id"):
        brand = await db.brands.find_one({"id": outlet["brand_id"], "deleted_at": None})
    group = await db.groups.find_one({"deleted_at": None})
    return {"po": po, "vendor": vendor, "outlet": outlet, "brand": brand, "group": group}


async def build_po_pdf(po_id: str, *, user: dict | None = None) -> bytes:
    ctx = await _load_context(po_id)
    po = ctx["po"]
    vendor = ctx["vendor"] or {}
    outlet = ctx["outlet"] or {}
    brand = ctx["brand"] or {}
    group = ctx["group"] or {"name": "FnB Group"}

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        topMargin=15 * mm, bottomMargin=15 * mm,
        leftMargin=15 * mm, rightMargin=15 * mm,
        title=f"PO {po.get('doc_no', po_id[:8])}",
        author=group.get("name", "FnB Group"),
    )

    styles = getSampleStyleSheet()
    base_font = "Helvetica"
    bold_font = "Helvetica-Bold"

    # h1/sub reserved for future heading customization
    _ = ParagraphStyle("h1", parent=styles["Title"], fontName=bold_font,
                       fontSize=18, spaceAfter=2, textColor=colors.HexColor("#0a0a0a"))
    _ = ParagraphStyle("sub", parent=styles["Normal"], fontName=base_font,
                       fontSize=9, textColor=colors.HexColor("#525252"))
    heading = ParagraphStyle("heading", parent=styles["Normal"], fontName=bold_font,
                             fontSize=10, textColor=colors.HexColor("#0a0a0a"),
                             spaceBefore=4, spaceAfter=4)
    label = ParagraphStyle("label", parent=styles["Normal"], fontName=base_font,
                           fontSize=8, textColor=colors.HexColor("#737373"))
    val = ParagraphStyle("val", parent=styles["Normal"], fontName=bold_font,
                         fontSize=10, textColor=colors.HexColor("#0a0a0a"))
    note = ParagraphStyle("note", parent=styles["Normal"], fontName=base_font,
                          fontSize=8, textColor=colors.HexColor("#525252"),
                          leading=11)

    flow = []

    # Header band
    header_data = [[
        Paragraph(f"<b>{group.get('name','FnB Group')}</b><br/>"
                  f"<font size=8 color='#737373'>"
                  f"Sistem ERP F&amp;B Multi-Brand</font>", val),
        Paragraph(f"<para align='right'><b>PURCHASE ORDER</b><br/>"
                  f"<font size=10>{po.get('doc_no', po_id[:8])}</font></para>",
                  val),
    ]]
    header_tbl = Table(header_data, colWidths=[100 * mm, 80 * mm])
    header_tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -1), 1.2, colors.HexColor("#0a0a0a")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    flow.append(header_tbl)
    flow.append(Spacer(1, 6 * mm))

    # Vendor + Delivery info
    vendor_block = (
        f"<b>{vendor.get('name', '—')}</b><br/>"
        + (f"{vendor.get('contact_name','')}<br/>" if vendor.get("contact_name") else "")
        + (f"{vendor.get('phone','')}<br/>" if vendor.get("phone") else "")
        + (f"{vendor.get('email','')}<br/>" if vendor.get("email") else "")
        + (f"<font size=8>{vendor.get('address','')}</font><br/>" if vendor.get("address") else "")
        + (f"<font size=8>NPWP: {vendor.get('npwp','')}</font>" if vendor.get("npwp") else "")
    )
    delivery_block = (
        f"<b>{outlet.get('name', 'Central / Belum ditentukan')}</b><br/>"
        + (f"<font size=8>{brand.get('name','')}</font><br/>" if brand.get("name") else "")
        + (f"<font size=8>{outlet.get('address','')}</font>" if outlet.get("address") else "")
    )
    info_data = [
        [Paragraph("KEPADA / TO", label), Paragraph("DELIVER TO", label)],
        [Paragraph(vendor_block, note), Paragraph(delivery_block, note)],
    ]
    info_tbl = Table(info_data, colWidths=[90 * mm, 90 * mm])
    info_tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f5f5f5")),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
    ]))
    flow.append(info_tbl)
    flow.append(Spacer(1, 6 * mm))

    # PO Meta strip
    meta_data = [
        [
            Paragraph("Tanggal PO", label),
            Paragraph("Expected Delivery", label),
            Paragraph("Payment Terms", label),
            Paragraph("Status", label),
        ],
        [
            Paragraph(_fmt_date_id(po.get("order_date")), val),
            Paragraph(_fmt_date_id(po.get("expected_delivery_date")), val),
            Paragraph(f"{po.get('payment_terms_days', 30)} hari", val),
            Paragraph(po.get("status", "draft").upper(), val),
        ],
    ]
    meta_tbl = Table(meta_data, colWidths=[45 * mm, 45 * mm, 45 * mm, 45 * mm])
    meta_tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#fafafa")),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e5e5")),
    ]))
    flow.append(meta_tbl)
    flow.append(Spacer(1, 6 * mm))

    # Line items table
    flow.append(Paragraph("RINCIAN BARANG", heading))
    line_header = ["No", "Item", "Qty", "Unit", "Harga Satuan", "Diskon", "Pajak%", "Total"]
    rows: list[list] = [line_header]
    for i, ln in enumerate(po.get("lines", []) or [], 1):
        item_name = ln.get("item_name", "—")
        qty = ln.get("qty", 0)
        unit = ln.get("unit", "pcs")
        unit_cost = ln.get("unit_cost", 0)
        disc = ln.get("discount", 0)
        tax = ln.get("tax_rate", ln.get("tax_pct", 0))
        total = ln.get("total", 0)
        rows.append([
            str(i),
            Paragraph(f"<b>{item_name}</b>", note),
            f"{qty}",
            unit,
            _fmt_rp(unit_cost),
            _fmt_rp(disc) if disc else "—",
            f"{float(tax)*100:.0f}%" if (isinstance(tax, (int, float)) and tax <= 1) else f"{tax}",
            _fmt_rp(total),
        ])
    line_tbl = Table(
        rows,
        colWidths=[10 * mm, 60 * mm, 14 * mm, 14 * mm, 26 * mm, 18 * mm, 14 * mm, 24 * mm],
        repeatRows=1,
    )
    line_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0a0a0a")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
        ("FONTNAME", (0, 0), (-1, 0), bold_font),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("ALIGN", (2, 0), (2, -1), "RIGHT"),
        ("ALIGN", (4, 0), (4, -1), "RIGHT"),
        ("ALIGN", (5, 0), (5, -1), "RIGHT"),
        ("ALIGN", (6, 0), (6, -1), "RIGHT"),
        ("ALIGN", (7, 0), (7, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fafafa")]),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, colors.HexColor("#0a0a0a")),
        ("LINEBELOW", (0, -1), (-1, -1), 0.5, colors.HexColor("#0a0a0a")),
    ]))
    flow.append(line_tbl)
    flow.append(Spacer(1, 4 * mm))

    # Totals
    totals_data = [
        ["Subtotal", _fmt_rp(po.get("subtotal", 0))],
        ["Pajak", _fmt_rp(po.get("tax_total", 0))],
        ["Diskon", _fmt_rp(po.get("discount_total", 0))],
        ["Grand Total", _fmt_rp(po.get("grand_total", 0))],
    ]
    totals_tbl = Table(totals_data, colWidths=[40 * mm, 40 * mm], hAlign="RIGHT")
    totals_tbl.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), base_font),
        ("FONTNAME", (0, -1), (-1, -1), bold_font),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTSIZE", (0, -1), (-1, -1), 11),
        ("ALIGN", (0, 0), (0, -1), "RIGHT"),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("LINEABOVE", (0, -1), (-1, -1), 0.8, colors.HexColor("#0a0a0a")),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#f5f5f5")),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    flow.append(totals_tbl)
    flow.append(Spacer(1, 8 * mm))

    # Notes / Terms
    if po.get("notes"):
        flow.append(Paragraph("CATATAN", heading))
        flow.append(Paragraph(po.get("notes"), note))
        flow.append(Spacer(1, 6 * mm))

    flow.append(Paragraph("SYARAT &amp; KETENTUAN", heading))
    terms = (
        "1. Harga sudah termasuk PPN (jika berlaku) sesuai detail di atas.<br/>"
        "2. Pembayaran dilakukan sesuai term yang telah disetujui.<br/>"
        "3. Penerimaan barang harus dilakukan oleh personil yang berwenang.<br/>"
        "4. Setiap perubahan harus disetujui pihak procurement secara tertulis.<br/>"
    )
    flow.append(Paragraph(terms, note))
    flow.append(Spacer(1, 12 * mm))

    # Signature blocks
    sig_data = [
        ["Disiapkan oleh", "Disetujui oleh", "Diterima oleh"],
        ["", "", ""],
        ["", "", ""],
        ["___________________", "___________________", "___________________"],
        ["Procurement", "Manager", "Vendor"],
    ]
    sig_tbl = Table(sig_data, colWidths=[60 * mm, 60 * mm, 60 * mm])
    sig_tbl.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTNAME", (0, 0), (-1, 0), bold_font),
        ("FONTNAME", (0, -1), (-1, -1), bold_font),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#525252")),
        ("TEXTCOLOR", (0, -1), (-1, -1), colors.HexColor("#0a0a0a")),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    flow.append(sig_tbl)

    # Footer
    flow.append(Spacer(1, 8 * mm))
    footer_text = (
        f"Dicetak pada {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')} UTC · "
        f"Generated by {group.get('name', 'FnB Group')} ERP"
    )
    flow.append(Paragraph(f"<font size=7 color='#a3a3a3'>{footer_text}</font>", note))

    doc.build(flow)
    return buf.getvalue()
