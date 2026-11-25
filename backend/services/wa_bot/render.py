"""Format jawaban Asisten AI untuk WhatsApp: markdown → gaya WA (*tebal*, _miring_, ```kode```), tabel → baris butir,
pecah pesan panjang; grafik (spesifikasi show_chart) → gambar PNG dengan Pillow."""
from __future__ import annotations

import io
import re

MAX_CHUNK = 3500


def _inline(s: str) -> str:
    s = re.sub(r"\*\*(.+?)\*\*", "\x01\\1\x01", s)                 # tebal → penanda sementara
    s = re.sub(r"(?<![\w*])\*(?!\s)([^*\n]+?)\*(?!\w)", r"_\1_", s)  # *miring* → _miring_
    s = s.replace("\x01", "*")
    s = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", r"\1 (\2)", s)
    s = re.sub(r"\[([^\]]+)\]\((/[^)\s]*)\)", r"\1", s)              # tautan internal → teks saja
    s = re.sub(r"`([^`]+)`", r"\1", s)
    return s


def _table(lines: list[str]) -> list[str]:
    rows = [[c.strip() for c in ln.strip().strip("|").split("|")] for ln in lines]
    head, body = rows[0], [r for r in rows[2:] if any(c for c in r)]
    out = []
    for r in body:
        first = _inline(r[0]) if r else ""
        rest = "; ".join(f"{_inline(h)}: {_inline(v)}" for h, v in zip(head[1:], r[1:]) if v)
        out.append(f"• {first}" + (f" — {rest}" if rest else ""))
    return out


def to_whatsapp(md: str) -> str:
    lines = (md or "").replace("\r\n", "\n").split("\n")
    out: list[str] = []
    i = 0
    while i < len(lines):
        ln = lines[i]
        if ln.strip().startswith("```"):
            block = [ln]
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                block.append(lines[i])
                i += 1
            block.append("```")
            out.extend(block)
            i += 1
            continue
        if "|" in ln and i + 1 < len(lines) and re.match(r"^\s*\|?\s*:?-{2,}", lines[i + 1]):
            tbl = [ln]
            i += 1
            while i < len(lines) and "|" in lines[i] and lines[i].strip():
                tbl.append(lines[i])
                i += 1
            out.extend(_table(tbl))
            continue
        m = re.match(r"^\s*#{1,6}\s+(.*)$", ln)
        if m:
            out.append(f"*{_inline(m.group(1)).strip('*')}*")
        elif re.match(r"^\s*[-*]\s+", ln):
            out.append("• " + _inline(re.sub(r"^\s*[-*]\s+", "", ln)))
        elif re.match(r"^\s*-{3,}\s*$", ln):
            out.append("")
        else:
            out.append(_inline(ln))
        i += 1
    text = "\n".join(out)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def chunks(text: str, size: int = MAX_CHUNK) -> list[str]:
    """Pecah di batas paragraf/baris agar tiap pesan ≤ size karakter."""
    if len(text) <= size:
        return [text] if text else []
    parts, cur = [], ""
    for para in text.split("\n"):
        if len(cur) + len(para) + 1 > size and cur:
            parts.append(cur.rstrip())
            cur = ""
        while len(para) > size:
            parts.append(para[:size])
            para = para[size:]
        cur += para + "\n"
    if cur.strip():
        parts.append(cur.rstrip())
    return parts


def _fmt(v: float, unit: str) -> str:
    a = abs(v)
    if unit == "pct":
        return f"{v:.1f}%".replace(".", ",")
    if a >= 1e9:
        s = f"{v / 1e9:.1f} M".replace(".", ",")
    elif a >= 1e6:
        s = f"{v / 1e6:.1f} jt".replace(".", ",")
    elif a >= 1e3:
        s = f"{v / 1e3:.0f} rb"
    else:
        s = f"{v:.0f}"
    return s


PALETTE = [(79, 70, 229), (124, 58, 237), (14, 165, 233), (16, 185, 129), (245, 158, 11), (239, 68, 68)]


def chart_png(spec: dict, width: int = 1000, height: int = 600) -> bytes:
    """Grafik sederhana (bar/line/area/pie) → PNG untuk dikirim lewat WhatsApp."""
    from PIL import Image, ImageDraw, ImageFont
    img = Image.new("RGB", (width, height), "white")
    d = ImageDraw.Draw(img)

    def font(sz):
        try:
            return ImageFont.load_default(size=sz)
        except TypeError:
            return ImageFont.load_default()
    f_title, f_lbl = font(26), font(16)
    title = str(spec.get("title") or "")[:80]
    d.text((30, 18), title, fill=(20, 20, 30), font=f_title)
    data = spec.get("data") or []
    series = spec.get("series") or []
    xk = spec.get("x_key")
    unit = spec.get("unit") or "num"
    labels = [str(r.get(f"{xk}_name") or r.get(xk) or "")[:16] for r in data]
    vals = [[float(r.get(s["key"]) or 0) for r in data] for s in series]
    if not data or not series:
        d.text((30, 80), "Tidak ada data", fill=(100, 100, 100), font=f_lbl)
    elif spec.get("type") == "pie":
        v = vals[0]
        tot = sum(x for x in v if x > 0) or 1
        box = (40, 80, 40 + height - 120, height - 40)
        ang = -90.0
        for i, x in enumerate(v):
            if x <= 0:
                continue
            sweep = 360 * x / tot
            d.pieslice(box, ang, ang + sweep, fill=PALETTE[i % len(PALETTE)], outline="white")
            ang += sweep
        lx = box[2] + 40
        for i, (lab, x) in enumerate(zip(labels, v)):
            y = 100 + i * 30
            if y > height - 40:
                break
            d.rectangle((lx, y, lx + 18, y + 18), fill=PALETTE[i % len(PALETTE)])
            d.text((lx + 28, y), f"{lab}: {_fmt(x, unit)} ({x / tot * 100:.0f}%)", fill=(30, 30, 40), font=f_lbl)
    else:
        left, top, right, bottom = 110, 80, width - 30, height - 80
        flat = [x for row in vals for x in row]
        vmax = max(flat + [0]) or 1
        vmin = min(flat + [0])
        span = (vmax - vmin) or 1
        for k in range(5):                                       # garis bantu
            y = bottom - (bottom - top) * k / 4
            d.line((left, y, right, y), fill=(230, 230, 236))
            d.text((10, y - 9), _fmt(vmin + span * k / 4, unit), fill=(110, 110, 120), font=f_lbl)
        n = len(data)
        step = (right - left) / max(n, 1)
        y0 = bottom - (0 - vmin) / span * (bottom - top)
        for si, row in enumerate(vals):
            color = PALETTE[si % len(PALETTE)]
            pts = []
            for i, x in enumerate(row):
                cx = left + step * (i + 0.5)
                y = bottom - (x - vmin) / span * (bottom - top)
                if spec.get("type") == "bar":
                    bw = max(4, step * 0.7 / len(vals))
                    bx = cx - step * 0.35 + si * bw
                    d.rectangle((bx, min(y, y0), bx + bw - 2, max(y, y0)), fill=color)
                pts.append((cx, y))
            if spec.get("type") in ("line", "area") and len(pts) > 1:
                if spec.get("type") == "area":
                    d.polygon([(pts[0][0], y0), *pts, (pts[-1][0], y0)], fill=tuple(int(c * 0.25 + 255 * 0.75) for c in color))
                d.line(pts, fill=color, width=4)
        every = max(1, n // 10)
        for i, lab in enumerate(labels):
            if i % every == 0:
                cx = left + step * (i + 0.5)
                d.text((cx - len(lab) * 4, bottom + 10), lab, fill=(80, 80, 90), font=f_lbl)
        if len(series) > 1:
            for si, s in enumerate(series):
                x = left + si * 200
                d.rectangle((x, height - 34, x + 16, height - 18), fill=PALETTE[si % len(PALETTE)])
                d.text((x + 24, height - 36), str(s.get("label") or s["key"])[:22], fill=(40, 40, 50), font=f_lbl)
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()
