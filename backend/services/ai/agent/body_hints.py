"""Petunjuk isi body untuk aksi tulis yang menerima `dict` tanpa skema Pydantic.

Kunci: "METHOD /api/path" persis seperti route. Untuk endpoint yang tidak tercantum di sini, katalog membuat
petunjuk otomatis dari field yang dibaca endpoint & service-nya (`catalog._auto_hint`). Tambahkan entri di sini bila
sebuah aksi sering gagal karena isinya kurang jelas.
"""

BODY_HINTS: dict[str, str] = {
    # ---- Procurement ----
    "POST /api/procurement/prs": (
        '{"outlet_id": "<id toko>", "request_date": "YYYY-MM-DD", "needed_by": "YYYY-MM-DD", "notes": "",'
        ' "lines": [{"item_id": "<id item>", "item_name": "", "qty": 1, "unit": "kg", "notes": ""}]}'),
    "POST /api/procurement/pos": (
        '{"vendor_id": "<id vendor>", "outlet_id": "<id toko tujuan>", "order_date": "YYYY-MM-DD",'
        ' "expected_delivery_date": "YYYY-MM-DD", "payment_terms_days": 30, "pr_ids": [], "notes": "",'
        ' "lines": [{"item_id": "", "item_name": "", "qty": 1, "unit": "kg", "unit_cost": 0, "discount": 0,'
        ' "tax_rate": 0}]} — PO tersimpan sebagai draft; ajukan/kirim dengan aksi submit/send.'),
    "POST /api/procurement/grs": (
        '{"po_id": "<id PO atau null>", "vendor_id": "", "outlet_id": "", "receive_date": "YYYY-MM-DD",'
        ' "invoice_no": "", "invoice_date": "YYYY-MM-DD", "tax_rate": 0, "payment_terms_days": 30, "notes": "",'
        ' "lines": [{"po_line_index": 0, "item_id": "", "item_name": "", "qty_ordered": 0, "qty_received": 0,'
        ' "unit": "", "unit_cost": 0, "qty_rejected": 0, "reject_reason": "busuk|rusak|spesifikasi|kedaluwarsa|'
        'suhu|kemasan|salah_item|lainnya", "condition_note": ""}]} — GR memposting stok, jurnal, dan hutang.'),
    "POST /api/rfq": (
        '{"title": "", "outlet_id": "", "brand_id": "", "deadline": "YYYY-MM-DD", "vendor_ids": ["<id vendor>"],'
        ' "pr_ids": [], "notes": "", "items": [{"item_id": "", "item_name": "", "qty": 1, "uom": "kg"}]}'),
    # ---- Sourcing ----
    "POST /api/sourcing/offers": (
        '{"vendor_id": "", "item_id": "", "unit": "kg", "price": 0, "valid_from": "YYYY-MM-DD",'
        ' "valid_to": "YYYY-MM-DD|null", "min_order_qty": 0, "lead_time_days": 0, "region_id": null,'
        ' "source": "manual|rfq|contract|import", "notes": ""}'),
    "POST /api/sourcing/benchmarks": (
        '{"item_id": "", "unit": "kg", "price": 0, "region_id": null, "period_type": "weekly|monthly|quarterly",'
        ' "on": "YYYY-MM-DD", "source": "survey|manual|offers_median|import", "source_note": ""}'),
    # ---- Finance ----
    "POST /api/finance/journals/manual": (
        '{"entry_date": "YYYY-MM-DD", "description": "", "outlet_id": "<id toko atau null untuk pusat>",'
        ' "lines": [{"coa_id": "<id akun COA, bukan kode>", "dr": 0, "cr": 0, "memo": ""}]} — total debit harus'
        ' sama dengan kredit; tiap baris hanya debit ATAU kredit; langsung terposting.'),
    "POST /api/ar/invoices": (
        '{"customer_id": "", "customer_name": "", "outlet_id": "", "invoice_date": "YYYY-MM-DD", "due_date":'
        ' "YYYY-MM-DD", "credit_terms_days": 30, "include_ppn": false, "notes": "",'
        ' "lines": [{"description": "", "qty": 1, "unit_price": 0, "discount": 0, "include_ppn": false}],'
        ' "auto_post": false}'),
    # ---- Outlet ----
    "POST /api/outlet/daily-sales/draft": (
        '{"outlet_id": "", "sales_date": "YYYY-MM-DD", "transaction_count": 0, "service_charge": 0,'
        ' "tax_amount": 0, "notes": "", "channels": [{"channel": "dine_in|takeaway|gofood|grabfood|shopeefood",'
        ' "gross": 0, "discount": 0, "net": 0}], "payment_breakdown": [{"payment_method_id": "<id dari GET'
        ' /api/master/payment-methods>", "amount": 0}], "revenue_buckets": [{"bucket": "food|beverage|other",'
        ' "amount": 0}]} — draft; submit lalu validasi Finance untuk jurnal.'),
    "POST /api/outlet/petty-cash": (
        '{"outlet_id": "", "txn_date": "YYYY-MM-DD", "type": "purchase|replenish|adjustment", "amount": 0,'
        ' "description": "", "category_id": null, "gl_account_id": "<id akun beban>", "vendor_id": null,'
        ' "vendor_text": "", "receipt_url": null, "notes": ""}'),
    "POST /api/outlet/urgent-purchases": (
        '{"outlet_id": "", "purchase_date": "YYYY-MM-DD", "vendor_id": null, "vendor_text": "",'
        ' "payment_method_id": null, "paid_by": "", "receipt_url": null, "notes": "",'
        ' "items": [{"item_id": null, "name": "", "qty": 1, "unit": "", "unit_price": 0, "total": 0}]} —'
        ' total pembelian = jumlah items[].total.'),
    # ---- Inventory ----
    "POST /api/inventory/adjustments": (
        '{"outlet_id": "", "adjustment_date": "YYYY-MM-DD", "reason": "", "notes": "",'
        ' "lines": [{"item_id": "", "qty_delta": 0, "unit_cost": 0}]}'),
    "POST /api/inventory/transfers": (
        '{"from_outlet_id": "", "to_outlet_id": "", "transfer_date": "YYYY-MM-DD", "notes": "",'
        ' "lines": [{"item_id": "", "qty": 0}]}'),
    # ---- HR ----
    "POST /api/hr/leaves": (
        '{"employee_id": "", "leave_type": "annual|sick|unpaid|…", "start_date": "YYYY-MM-DD", "end_date":'
        ' "YYYY-MM-DD", "days_count": 1, "notes": "", "allow_over_quota": false}'),
    # ---- Reservasi ----
    "POST /api/reservations": (
        '{"outlet_id": "", "brand_id": "", "reservation_date": "YYYY-MM-DD", "reservation_time": "HH:MM",'
        ' "pax": 2, "customer_name": "", "customer_phone": "", "customer_email": "", "area_preference": "",'
        ' "table_preference": "", "special_requests": "", "deposit_amount": 0, "source": "admin", "notes": ""}'),
    # ---- Master data (generik) ----
    "POST /api/master/{entity}": (
        'entity: groups | brands | outlets | items | categories | vendors | employees | chart-of-accounts | '
        'tax-codes | payment-methods | bank-accounts | number-series | regions. Field mengikuti dokumen yang ada: '
        'baca dulu 1–2 contoh lewat GET /api/master/{entity}, lalu tiru field-nya (kode harus unik).'),
    "PATCH /api/master/{entity}/{id_}": (
        'Kirim HANYA field yang diubah. Baca dokumen saat ini dulu (GET /api/master/{entity}) agar tahu nama field.'),
}
