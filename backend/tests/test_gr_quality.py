"""Kualitas di Goods Receipt (Tahap 2 sourcing): qty ditolak + alasan + foto, dan dampaknya ke skor supplier.

Barang ditolak tidak masuk stok/AP dan tidak mengurangi sisa PO. Kiriman yang ditolak seluruhnya dicatat sebagai GR
berstatus `rejected` tanpa jurnal. Tes membersihkan datanya sendiri (snapshot conftest butuh mongodump).
"""
from datetime import datetime, timezone

import pytest
from pymongo import MongoClient

from services.sourcing_service import _supplier_stats

from .conftest import _load_backend_env, api_get, api_post


def _line(**kw):
    base = {"item_id": "i1", "vendor_id": "v1", "outlet_id": "o1", "date": "2026-11-01", "doc_no": "GR-1",
            "unit_norm": "kg", "unit": "kg", "price": 10000.0, "qty_received": 10.0, "qty_ordered": 10.0,
            "qty_rejected": 0.0, "inspected": False, "reject_reason": None, "on_time": None, "lead_days": None,
            "po_id": None, "po_line_index": None}
    base.update(kw)
    return base


# ---------- unit ----------
def test_fill_rate_counts_po_line_once_for_partial_receipts():
    # PO 10 kg diterima 2× 5 kg → 100% lengkap (dulu qty PO terhitung dua kali → 50%)
    st = _supplier_stats([
        _line(doc_no="GR-1", qty_received=5, po_id="p1", po_line_index=0),
        _line(doc_no="GR-2", qty_received=5, po_id="p1", po_line_index=0, date="2026-11-02"),
    ])
    assert st["fill_rate_pct"] == 100.0


def test_reject_rate_only_from_inspected_lines():
    old = _line(doc_no="GR-OLD")                                   # GR lama: tanpa data kualitas
    assert _supplier_stats([old])["reject_rate_pct"] is None        # bukan 0% / skor kualitas 100
    new = _line(doc_no="GR-NEW", qty_received=8, qty_rejected=2, inspected=True, reject_reason="busuk")
    st = _supplier_stats([old, new])
    assert st["reject_rate_pct"] == 20.0 and st["qty_rejected"] == 2 and st["reject_reasons"] == {"busuk": 2}


def test_fully_rejected_delivery_is_not_last_price():
    st = _supplier_stats([
        _line(doc_no="GR-1", price=10000, date="2026-11-01"),
        _line(doc_no="GR-2", price=15000, qty_received=0, qty_rejected=10, inspected=True, reject_reason="rusak",
              date="2026-11-03"),
    ])
    assert st["last_price"] == 10000 and st["max_price"] == 10000
    assert st["reject_rate_pct"] == 100.0  # hanya baris yang diperiksa dihitung


# ---------- live ----------
@pytest.fixture(scope="module")
def ctx(http_client, tokens):
    if "admin" not in tokens:
        pytest.skip("butuh token admin")
    env = _load_backend_env()
    db = MongoClient(env["MONGO_URL"])[env["DB_NAME"]]
    start = datetime.now(timezone.utc).isoformat()
    c, tok = http_client, tokens["admin"]
    items = api_get(c, "/master/items?per_page=50", tok).json()["data"]
    items = items if isinstance(items, list) else items.get("items", [])
    vendor = (lambda d: d if isinstance(d, list) else d.get("items", []))(api_get(c, "/master/vendors?per_page=5", tok).json()["data"])[0]
    outlet = db.outlets.find_one({"deleted_at": None}, {"_id": 0, "id": 1})
    # hook GR memperbarui katalog vendor (vendor_items) → kembalikan seperti semula setelah tes
    vi_q = {"vendor_id": vendor["id"], "item_id": {"$in": [i["id"] for i in items[:2]]}}
    vi_before = list(db.vendor_items.find(vi_q))
    yield {"c": c, "tok": tok, "db": db, "items": items[:2], "vendor": vendor, "outlet": outlet}
    grs = list(db.goods_receipts.find({"created_at": {"$gte": start}, "notes": "QA GR quality"}, {"id": 1}))
    ids = [g["id"] for g in grs]
    db.vendor_item_price_history.delete_many({"source_doc_id": {"$in": ids}})
    db.vendor_items.delete_many({**vi_q, "created_at": {"$gte": start}})
    for d in vi_before:
        db.vendor_items.replace_one({"_id": d["_id"]}, d)
    db.anomaly_events.delete_many({"source_doc_no": {"$in": [g.get("doc_no") for g in db.goods_receipts.find({"id": {"$in": ids}})]}})
    db.inventory_movements.delete_many({"ref_type": "goods_receipt", "ref_id": {"$in": ids}})
    db.ap_ledgers.delete_many({"gr_id": {"$in": ids}})
    db.journal_entries.delete_many({"source_type": "goods_receipt", "source_id": {"$in": ids}})
    db.goods_receipts.delete_many({"id": {"$in": ids}})


def _gr(ctx, lines):
    return api_post(ctx["c"], "/procurement/grs", ctx["tok"], json={
        "vendor_id": ctx["vendor"]["id"], "outlet_id": ctx["outlet"]["id"], "notes": "QA GR quality",
        "lines": lines})


def _ln(item, **kw):
    return {"item_id": item["id"], "item_name": item["name"], "unit": item.get("unit_default") or "pcs",
            "qty_ordered": 10, "unit_cost": 1000, **kw}


def test_gr_partial_rejection_and_validation(ctx):
    a, b = ctx["items"]
    # alasan wajib bila ada qty ditolak
    r = _gr(ctx, [_ln(a, qty_received=8, qty_rejected=2)])
    assert r.status_code in (400, 422) and "alasan" in r.text.lower()
    r = _gr(ctx, [_ln(a, qty_received=8, qty_rejected=2, reject_reason="tidak-ada")])
    assert r.status_code in (400, 422)

    r = _gr(ctx, [_ln(a, qty_received=8, qty_rejected=2, reject_reason="busuk", condition_note="layu"),
                  _ln(b, qty_received=0, qty_rejected=5, reject_reason="kemasan")])
    assert r.status_code == 200, r.text
    gr = r.json()["data"]
    assert gr["status"] == "posted"
    la, lb = gr["lines"]
    assert la["inspected"] and la["qty_rejected"] == 2 and la["reject_reason"] == "busuk"
    assert lb["qty_received"] == 0 and lb["total_cost"] == 0
    assert gr["subtotal"] == 8000  # hanya barang yang diterima ditagih
    movs = list(ctx["db"].inventory_movements.find({"ref_type": "goods_receipt", "ref_id": gr["id"]}))
    assert [m["item_id"] for m in movs] == [a["id"]] and movs[0]["qty"] == 8


def test_gr_fully_rejected_is_recorded_without_stock_or_journal(ctx):
    a, _ = ctx["items"]
    r = _gr(ctx, [_ln(a, qty_received=0, qty_rejected=10, reject_reason="rusak")])
    assert r.status_code == 200, r.text
    gr = r.json()["data"]
    assert gr["status"] == "rejected" and gr["journal_entry_id"] is None and gr["ap_id"] is None
    assert ctx["db"].inventory_movements.count_documents({"ref_type": "goods_receipt", "ref_id": gr["id"]}) == 0
    assert ctx["db"].ap_ledgers.count_documents({"gr_id": gr["id"]}) == 0
    # baris tanpa qty diterima maupun ditolak tetap ditolak
    r = _gr(ctx, [_ln(a, qty_received=0, qty_rejected=0)])
    assert r.status_code in (400, 422)


def test_item_detail_shows_reject_rate(ctx):
    a, _ = ctx["items"]
    d = api_get(ctx["c"], f"/sourcing/items/{a['id']}", ctx["tok"]).json()["data"]
    sup = next((s for s in d["suppliers"] if s["vendor_id"] == ctx["vendor"]["id"]), None)
    if (a.get("unit_default") or "pcs").lower() != (d["item"].get("unit_default") or "pcs").lower() or sup is None:
        pytest.skip("item tanpa satuan default yang sama")
    assert sup["reject_rate_pct"] is not None and sup["qty_rejected"] >= 12
    assert "kualitas" in sup["score_basis"]
    assert any("Ditolak saat diterima" in i["text"] for i in d["insights"])
