# Skrip verifikasi audit ERPFNB (2026-09-27)
Reproduksi temuan P0/P1 terhadap kode backend asli, memakai MongoDB in-memory (mongomock-motor) — TIDAK menyentuh DB nyata.

    pip install mongomock-motor motor pyjwt bcrypt python-dotenv fastapi pydantic
    ERP_BACKEND=/app/backend python3 t_payroll.py   # dst.

| Skrip | Temuan |
|---|---|
| t_payroll.py  | P0-01 jurnal payroll tidak balance (BPJS) |
| t_payroll2.py | P0-02 SC/insentif double-count, P0-03 payroll ganda |
| t_pay.py      | P0-04 dua modul payment request, mark-paid tanpa JE |
| t_ar.py       | P0-05 penerimaan AR parsial ke-2 tidak masuk GL, P1 mark_sent |
| t_fa.py       | P0-06 penyusutan hanya bulan pertama masuk GL |
| t_inv.py      | P0-07 GR tanpa validasi PO/qty, P0-08 transfer qty negatif, P0-09 TB/P&L outlet diabaikan |
| t_opn.py      | P0-10 opname snapshot basi + submit tidak atomik |
| t_pr.py       | P0-11 status PR dari payload (bypass approval & budget) |
| t_adv.py      | P0-12 kasbon di-approve & dicairkan user tanpa izin |
| t_reports.py  | P0-15 saldo TB terbalik, RPT-01 Excel P&L kosong, RPT-02 Excel TB |
| t_tax.py      | P0-16 e-Faktur kosong + preview membakar nomor faktur |
| t_excel.py    | RPT-03 Excel PO/GR, RPT-04 Excel stok |
| t_ratelimit.py| SEC-17 bypass rate limit via X-Forwarded-For |
Setelah perbaikan, setiap skrip harus menampilkan perilaku yang benar (bisa dijadikan regression test pytest).
