"""AR PDF invoice generation (reportlab)."""
from __future__ import annotations

import io
from core.db import get_db, serialize


def _generate_pdf_sync(invoice: dict, company_info: dict) -> bytes:
    """Generate PDF invoice using reportlab."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.enums import TA_RIGHT

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm, leftMargin=2*cm, rightMargin=2*cm)
    styles = getSampleStyleSheet()
    story = []

    header_data = [
        [Paragraph(f"<b>{company_info.get('name', 'PT FnB Group')}</b>", styles["Heading2"]),
         Paragraph("<b>INVOICE</b>", ParagraphStyle(name="InvTitle", fontSize=20, alignment=TA_RIGHT, textColor=colors.HexColor("#1a1a2e")))],
        [Paragraph(company_info.get("address", ""), styles["Normal"]),
         Paragraph(f"No: <b>{invoice.get('invoice_no', '')}</b>", ParagraphStyle(name="R", alignment=TA_RIGHT))],
        [Paragraph(f"NPWP: {company_info.get('npwp', '-')}", styles["Normal"]),
         Paragraph(f"Tanggal: {invoice.get('invoice_date', '')}", ParagraphStyle(name="R2", alignment=TA_RIGHT))],
        ["",
         Paragraph(f"Jatuh Tempo: <b>{invoice.get('due_date', '')}</b>", ParagraphStyle(name="R3", alignment=TA_RIGHT))],
    ]
    ht = Table(header_data, colWidths=[10*cm, 7.5*cm])
    ht.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(ht)
    story.append(Spacer(1, 0.5*cm))

    story.append(Paragraph("<b>Ditagihkan kepada:</b>", styles["Normal"]))
    story.append(Paragraph(invoice.get("customer_name", "-"), styles["Normal"]))
    if invoice.get("customer_address"):
        story.append(Paragraph(invoice["customer_address"], styles["Normal"]))
    if invoice.get("customer_npwp"):
        story.append(Paragraph(f"NPWP: {invoice['customer_npwp']}", styles["Normal"]))
    story.append(Spacer(1, 0.5*cm))

    tbl_data = [["No", "Deskripsi", "Qty", "Harga Satuan", "DPP", "PPN", "Total"]]
    for i, ln in enumerate(invoice.get("lines", []), 1):
        tbl_data.append([
            str(i),
            ln.get("description", ""),
            f"{ln.get('qty', 1):.0f}",
            f"Rp {ln.get('unit_price', 0):,.0f}",
            f"Rp {ln.get('dpp', 0):,.0f}",
            f"Rp {ln.get('ppn', 0):,.0f}",
            f"Rp {(ln.get('dpp', 0) + ln.get('ppn', 0)):,.0f}",
        ])
    tbl_data.append(["", "", "", "", "Subtotal", "", f"Rp {invoice.get('subtotal', 0):,.0f}"])
    tbl_data.append(["", "", "", "", "PPN (12%)", "", f"Rp {invoice.get('tax_amount', 0):,.0f}"])
    tbl_data.append(["", "", "", "", "TOTAL", "", f"Rp {invoice.get('total_amount', 0):,.0f}"])

    tbl = Table(tbl_data, colWidths=[1*cm, 6*cm, 1.5*cm, 3*cm, 2.5*cm, 2*cm, 3*cm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a1a2e")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -4), 0.5, colors.HexColor("#e0e0e0")),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -4), [colors.white, colors.HexColor("#f8f9fa")]),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("LINEABOVE", (0, -1), (-1, -1), 1, colors.black),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 1*cm))
    if invoice.get("notes"):
        story.append(Paragraph(f"<i>Catatan: {invoice['notes']}</i>", styles["Normal"]))
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph("Terima kasih atas kepercayaan Anda.", styles["Normal"]))
    doc.build(story)
    return buf.getvalue()


async def generate_invoice_pdf(invoice_id: str) -> bytes:
    """Async wrapper: fetch invoice then generate PDF."""
    db = get_db()
    invoice = await db.ar_invoices.find_one({"id": invoice_id, "deleted_at": None})
    if not invoice:
        raise ValueError("Invoice not found")
    inv = serialize(invoice)
    try:
        from services.system_settings_service import get_value
        company_name = await get_value("COMPANY_NAME") or "PT FnB Group"
        company_address = await get_value("COMPANY_ADDRESS") or "Jakarta, Indonesia"
        company_npwp = await get_value("COMPANY_NPWP") or "-"
    except Exception:
        company_name = "PT FnB Group"
        company_address = "Jakarta, Indonesia"
        company_npwp = "-"
    company_info = {"name": company_name, "address": company_address, "npwp": company_npwp}
    return _generate_pdf_sync(inv, company_info)
