"""Normalisasi kemasan & satuan untuk membandingkan harga secara adil (aturan: jangan bandingkan beda satuan).

"dus isi 12x1L" → 12 l · "karton 24 x 250 ml" → 6 l · "tray 30 butir" → 30 pcs · "@ 2,5 kg" → 2,5 kg · "500 gr" → 0,5 kg ·
"pack isi 10" → 10 pcs. Dimensi: massa (kg), volume (l), hitungan (pcs). Satuan kemasan lain (btl, pack, dus) hanya
sebanding dengan satuan yang persis sama.
"""
from __future__ import annotations

import re
from typing import Optional

MASS = {"kg": 1.0, "kilo": 1.0, "kilogram": 1.0, "g": 0.001, "gr": 0.001, "gram": 0.001, "grm": 0.001, "ons": 0.1, "mg": 1e-6}
VOL = {"l": 1.0, "lt": 1.0, "ltr": 1.0, "liter": 1.0, "litre": 1.0, "ml": 0.001, "cc": 0.001}
COUNT = {"pcs": 1.0, "pc": 1.0, "butir": 1.0, "biji": 1.0, "buah": 1.0, "bh": 1.0, "ekor": 1.0, "lembar": 1.0, "lbr": 1.0}
_UNIT_RE = "|".join(sorted([*MASS, *VOL, *COUNT], key=len, reverse=True))


def _num(s: str) -> float:
    return float(s.replace(".", "").replace(",", ".")) if re.fullmatch(r"\d{1,3}(\.\d{3})+", s) else float(s.replace(",", "."))


def dim_of(unit: Optional[str]) -> tuple[Optional[str], float]:
    """Satuan → (dimensi dasar, faktor ke dasar). 'gram' → ('kg', 0.001); 'btl' → ('btl', 1)."""
    u = re.sub(r"[^a-z]", "", (unit or "").lower())
    if u in MASS:
        return "kg", MASS[u]
    if u in VOL:
        return "l", VOL[u]
    if u in COUNT:
        return "pcs", COUNT[u]
    return (u or None), 1.0


def parse_pack(text: Optional[str], unit: Optional[str] = None) -> tuple[Optional[float], Optional[str]]:
    """Teks kemasan/nama + satuan → (jumlah dalam satuan dasar, satuan dasar). (None, None) bila tidak bisa."""
    s = f"{text or ''} {unit or ''}".lower().replace("×", "x")
    m = re.search(rf"(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*({_UNIT_RE})\b", s)
    if m:
        d, f = dim_of(m.group(3))
        return _num(m.group(1)) * _num(m.group(2)) * f, d
    m = re.search(rf"isi\s*(\d+(?:[.,]\d+)?)\s*({_UNIT_RE})?\b", s)
    if m and m.group(2) and dim_of(m.group(2))[0] in ("kg", "l"):
        d, f = dim_of(m.group(2))
        return _num(m.group(1)) * f, d
    if m:
        return _num(m.group(1)), "pcs"
    m = re.search(rf"(\d+(?:[.,]\d+)?)\s*({_UNIT_RE})\b", s)
    if m:
        d, f = dim_of(m.group(2))
        return _num(m.group(1)) * f, d
    d, f = dim_of(unit)
    return (f, d) if d else (None, None)


def per_unit(price: float, pack_qty: Optional[float], pack_dim: Optional[str], target_unit: Optional[str]) -> Optional[float]:
    """Harga kemasan → harga per satuan target (mis. per kg item). None bila beda dimensi (tidak sebanding)."""
    td, tf = dim_of(target_unit)
    if not pack_qty or not pack_dim or not td or pack_dim != td:
        return None
    return price / (pack_qty / tf)
