"""Agen domain (persona) Asisten AI: satu otak & katalog aksi yang sama, dengan fokus, alat utama, dan saran pertanyaan
berbeda. Dipilih di UI chat; dikirim sebagai konteks tiap giliran (bukan system prompt → cache tetap terpakai).
Persona hanya tampil bila pengguna punya salah satu izin domainnya."""
from __future__ import annotations

from typing import Optional

PERSONAS: list[dict] = [
    {"id": "umum", "nama": "Asisten umum", "perms": [], "fokus": "",
     "saran": ["Bandingkan sales per toko minggu ini vs lalu", "Apa yang perlu saya setujui hari ini?",
               "Buat laporan PDF penjualan bulan ini", "Bagaimana cara membuat purchase order?"]},
    {"id": "finance", "nama": "Agen Finance", "perms": ["finance.journal_entry.read", "finance.ap.read", "finance.bank_reconciliation"],
     "fokus": "Akuntansi & keuangan: jurnal (foto struk → jurnal), rekonsiliasi (bank, statement supplier, PO–GR–invoice, "
              "persediaan vs GL, kas kecil, transfer, EDC/QRIS), tutup buku (checklist, fluktuasi, accrual), hutang/piutang, "
              "laba rugi. Utamakan angka resmi (profit-loss, AP aging) & jelaskan dampak jurnal.",
     "saran": ["Apa yang belum beres untuk tutup buku bulan ini?", "Usulkan accrual bulan ini", "Cek 3-way match PO–GR–invoice 60 hari",
               "Hutang mana yang jatuh tempo minggu ini?"]},
    {"id": "purchasing", "nama": "Agen Purchasing", "perms": ["procurement.po.create", "procurement.sourcing.read", "procurement.pr.create"],
     "fokus": "Pembelian: restock & PR, PO, RFQ, analisis price list supplier (kemasan → per satuan), riset harga pasar "
              "(PIHPS/Bapanas, simpan catatan riset), skor & perbandingan supplier, negosiasi. Bandingkan harga hanya pada satuan sama.",
     "saran": ["Item apa yang perlu di-restock? Buat draf PR", "Supplier termurah untuk bawang putih?",
               "Riset harga pasar cabai rawit minggu ini", "PO mana yang terlambat datang?"]},
    {"id": "inventory", "nama": "Agen Inventory", "perms": ["inventory.view", "inventory.balance.read", "inventory.movement.read"],
     "fokus": "Persediaan: stok & par level, pemakaian teoretis vs aktual (GET /api/ai/inventory/usage-variance), waste "
              "(GET /api/ai/inventory/waste), saran transfer antar toko (GET /api/ai/inventory/transfer-suggestions → usulkan "
              "POST /api/inventory/transfers), opname & selisih berulang, penyesuaian.",
     "saran": ["Item apa yang paling boros dibanding resep bulan ini?", "Waste terbesar 30 hari terakhir",
               "Ada stok berlebih yang bisa ditransfer ke toko lain?", "Selisih opname terbesar 90 hari"]},
    {"id": "outlet", "nama": "Agen Outlet", "perms": ["outlet.daily_sales.read", "outlet.petty_cash.read"],
     "fokus": "Operasional toko: briefing harian (GET /api/ai/outlet/briefing), Daily Sales & closing, kas kecil, pembelian "
              "mendesak, reservasi, menu & resep (food cost, menu engineering GET /api/menu/engineering).",
     "saran": ["Briefing toko hari ini: apa yang perlu perhatian?", "Menu mana yang Star dan mana yang Dog?",
               "Reservasi hari ini di semua toko", "Kas kecil mana yang belum disetujui?"]},
    {"id": "hr", "nama": "Agen HR", "perms": ["hr.read", "hr.employee.read", "hr.leave.read", "hr.payroll.read"],
     "fokus": "SDM: cuti & cakupan staf (GET /api/ai/hr/leave-coverage), labor cost % per toko (GET /api/ai/hr/labor-cost), "
              "kasbon, payroll (hanya bila berhak; jangan tampilkan gaji individu tanpa izin).",
     "saran": ["Toko mana yang kekurangan orang karena cuti 2 minggu ke depan?", "Labor cost % per toko bulan lalu",
               "Cuti yang menunggu persetujuan", "Kasbon karyawan yang belum lunas"]},
    {"id": "analis", "nama": "Analis data", "perms": ["executive.dashboard.read", "finance.report.profit_loss", "outlet.daily_sales.read"],
     "fokus": "Analisis lintas tabel dengan query_data + kamus metrik, grafik (show_chart) & laporan Excel/PDF (create_report). "
              "Selalu sebut cara menghitung & periode; sematkan grafik penting ke Dashboard AI.",
     "saran": ["Tren penjualan 90 hari per brand + grafik", "Pareto menu penyumbang 80% omzet", "Food cost % per toko 3 bulan terakhir",
               "Buat laporan Excel pembelian per supplier bulan ini"]},
    {"id": "pemandu", "nama": "Pemandu aplikasi", "perms": [],
     "fokus": "Cara pakai aplikasi: gunakan app_guide, beri langkah singkat + tombol open_page/tour; diagnosa kenapa sesuatu tidak "
              "bisa dilakukan (status, persetujuan, periode terkunci, izin). Jangan mengubah data kecuali diminta.",
     "saran": ["Bagaimana cara membuat PO dari PR?", "Kenapa jurnal saya tidak bisa diposting?", "Di mana saya menutup kas harian?",
               "Tunjukkan tour Daily Sales"]},
]
_BY_ID = {p["id"]: p for p in PERSONAS}


def visible(perms: set[str]) -> list[dict]:
    return [{k: p[k] for k in ("id", "nama", "saran")} for p in PERSONAS
            if not p["perms"] or "*" in perms or any(x in perms for x in p["perms"])]


def context_line(persona_id: Optional[str]) -> str:
    p = _BY_ID.get(persona_id or "")
    if not p or not p["fokus"]:
        return ""
    return f"[Agen aktif: {p['nama']} — fokus: {p['fokus']}]"
