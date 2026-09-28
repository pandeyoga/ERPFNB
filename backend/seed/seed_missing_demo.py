"""
seed_missing_demo.py — Seed 5 koleksi yang masih kosong setelah seed utama
==========================================================================
Koleksi yang di-seed:
  - purchase_requests  (PR-XXXX dari number_series)
  - ap_ledgers         (AP invoices dari GRs yang ada)
  - payroll_cycles     (PAY-XXXX dari number_series)
  - leave_requests     (cuti karyawan)
  - anomaly_events     (event deteksi anomali)

GUARDRAILS yang diikuti:
  - RC-1: Gunakan nama koleksi kanonik (payroll_cycles bukan payroll_runs, ap_ledgers bukan ap_invoices)
  - RC-5: Sync number_series setelah insert dokumen bernomor
  - RC-8: Tanggal dinamis — datetime.now(), bukan literal
  - Idempoten: upsert by natural key

Run: cd /app/backend && python3 -m seed.seed_missing_demo
"""
from __future__ import annotations

import asyncio
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))
load_dotenv(ROOT_DIR / ".env")

from core.db import init_db, get_db, close_db  # noqa: E402

random.seed(99)

TODAY = datetime.now(timezone.utc).date()
PERIOD_NOW = TODAY.strftime("%Y-%m")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def date_str(days_ago: int = 0) -> str:
    return (TODAY - timedelta(days=days_ago)).isoformat()


def uid() -> str:
    return str(uuid.uuid4())


def base_doc(extra: dict) -> dict:
    now = now_iso()
    return {"id": uid(), "created_at": now, "updated_at": now, "deleted_at": None, **extra}


# ── Nomor sederhana tanpa pakai number_series (agar tidak perlu await di seed) ──
def pr_no(i: int) -> str:
    return f"PR-SEED-{i:04d}"


def pay_no(i: int) -> str:
    return f"PAY-SEED-{i:04d}"


def lv_no(emp_code: str, i: int) -> str:
    return f"LV-{emp_code}-{i:04d}"


async def seed_purchase_requests(db, outlets, vendors, items, admin_id: str) -> int:
    """Seed purchase_requests — 3-4 per outlet, berbagai status."""
    print("\n[1/5] Seeding purchase_requests…")
    statuses = ["submitted", "submitted", "approved", "approved", "rejected", "converted_to_po"]
    count = 0
    pr_docs = []

    for i, outlet in enumerate(outlets):
        for j in range(4):
            idx = i * 4 + j
            day = random.randint(1, 45)
            req_date = date_str(day)
            status = random.choice(statuses)

            lines = []
            for item in random.sample(items, k=random.randint(2, 4)):
                qty = random.randint(5, 50)
                lines.append({
                    "item_id": item["id"],
                    "item_name": item.get("name", "Item"),
                    "qty": qty,
                    "unit": item.get("unit_default", "pcs"),
                    "estimated_price": random.randint(10_000, 100_000),
                    "notes": "",
                })

            pr_docs.append(base_doc({
                "doc_no": pr_no(idx + 1),
                "requester_user_id": admin_id,
                "outlet_id": outlet["id"],
                "brand_id": outlet.get("brand_id"),
                "request_date": req_date,
                "needed_by": date_str(day - 7),
                "source": "manual",
                "lines": lines,
                "notes": f"Kebutuhan operasional {outlet.get('name', 'outlet')}",
                "status": status,
                "approval_chain": [],
                "submitted_at": req_date + "T08:00:00+00:00" if status != "draft" else None,
                "converted_to_po_ids": [],
                "created_by": admin_id,
            }))
            count += 1

    inserted = 0
    for d in pr_docs:
        result = await db.purchase_requests.update_one(
            {"doc_no": d["doc_no"]},
            {"$setOnInsert": d},
            upsert=True,
        )
        if result.upserted_id:
            inserted += 1

    print(f"  ✓ {count} PRs dibuat ({inserted} baru, {count - inserted} sudah ada)")
    return count


async def seed_ap_ledgers(db, vendors, outlets, admin_id: str) -> int:
    """Seed ap_ledgers — AP invoices dari GR yang ada atau manual."""
    print("\n[2/5] Seeding ap_ledgers…")

    # Cek apakah sudah ada dari GR receipts
    existing = await db.ap_ledgers.count_documents({"deleted_at": None})
    if existing > 0:
        print(f"  ✓ Sudah ada {existing} AP ledger entries dari GR. Menambahkan beberapa extra.")

    # Tambahkan AP invoices ekstra (langsung tanpa GR — mis. recurring expenses)
    ap_docs = []
    statuses = ["open", "open", "open", "partial", "paid", "overdue"]
    descriptions = [
        "Tagihan sewa dapur/tempat", "Langganan POS system", "Jasa laundry linen",
        "Listrik & utilitas", "Jasa keamanan bulanan", "Biaya konsultan",
        "Tagihan pemasaran digital", "Kontrak pemeliharaan AC",
    ]
    PPN_RATE = 0.11
    PPH23_RATE = 0.02
    SERVICE_TYPE_MAP = {
        "Tagihan sewa dapur/tempat": "sewa",
        "Langganan POS system": "jasa_lain",
        "Jasa laundry linen": "jasa_lain",
        "Listrik & utilitas": "jasa_lain",
        "Jasa keamanan bulanan": "jasa_lain",
        "Biaya konsultan": "jasa_konsultan",
        "Tagihan pemasaran digital": "jasa_manajemen",
        "Kontrak pemeliharaan AC": "jasa_lain",
    }
    count = 0

    for i, vendor in enumerate(vendors):
        for j in range(3):
            idx = i * 3 + j
            day = random.randint(1, 60)
            inv_date = date_str(day)
            due_date = date_str(day - 30)  # 30 hari payment terms
            amount = round(random.randint(500_000, 15_000_000), 2)
            status = random.choice(statuses)
            balance = 0 if status == "paid" else (amount // 2 if status == "partial" else amount)
            outlet = random.choice(outlets)
            desc = random.choice(descriptions)
            service_type = SERVICE_TYPE_MAP.get(desc, "jasa_lain")
            period = inv_date[:7]

            # Hitung PPN masukan (11%) dan PPh23 (2%)
            subtotal = round(amount / (1 + PPN_RATE), 2)
            ppn_amount = round(amount - subtotal, 2)
            dpp = subtotal
            pph23_amount = round(dpp * PPH23_RATE, 2)
            bukti_seq = idx + 1
            pph23_bukti_no = f"BP-{period.replace('-', '')}-{str(bukti_seq).zfill(4)}"

            ap_docs.append(base_doc({
                "vendor_id": vendor["id"],
                "gr_id": None,  # standalone AP (not from GR)
                "outlet_id": outlet["id"],
                "invoice_no": f"INV-{vendor.get('code', 'V')[:3]}-{idx + 1:04d}",
                "invoice_date": inv_date,
                "due_date": due_date,
                "amount": amount,
                "subtotal": subtotal,
                "ppn_amount": ppn_amount,
                "dpp": dpp,
                "pph23_amount": pph23_amount,
                "pph23_rate": PPH23_RATE,
                "pph23_bukti_no": pph23_bukti_no,
                "service_type": service_type,
                "period": period,
                "balance": round(balance, 2),
                "currency": "IDR",
                "status": status,
                "payments": [] if status != "paid" else [{
                    "date": date_str(day - 25),
                    "amount": amount,
                    "method": "transfer",
                    "ref": f"TRF-{idx:04d}",
                }],
                "description": desc,
                "posted_at": inv_date + "T10:00:00+00:00",
                "created_by": admin_id,
                "tax_note": f"PPh23 {PPH23_RATE*100:.0f}% dipotong pemberi kerja",
            }))
            count += 1

    inserted = 0
    for d in ap_docs:
        result = await db.ap_ledgers.update_one(
            {"invoice_no": d["invoice_no"]},
            {"$setOnInsert": d},
            upsert=True,
        )
        if result.upserted_id:
            inserted += 1

    total = await db.ap_ledgers.count_documents({"deleted_at": None})
    print(f"  ✓ {inserted} AP ledger entries baru ditambahkan. Total sekarang: {total}")
    return total


async def seed_payroll_cycles(db, outlets, employees, admin_id: str) -> int:
    """Seed payroll_cycles — 1 cycle per outlet per 3 bulan terakhir."""
    print("\n[3/5] Seeding payroll_cycles…")

    periods = []
    for m in range(3):  # 3 bulan terakhir
        d = TODAY.replace(day=1) - timedelta(days=m * 30)
        periods.append(d.strftime("%Y-%m"))
    periods.reverse()  # Kronologis

    count = 0
    pay_docs = []

    # Group employees by outlet
    emp_by_outlet: dict[str, list] = {}
    for e in employees:
        oid = e.get("outlet_id") or (outlets[0]["id"] if outlets else None)
        if oid:
            emp_by_outlet.setdefault(oid, []).append(e)

    i = 0
    for period in periods:
        for outlet in outlets:
            oid = outlet["id"]
            outlet_emps = emp_by_outlet.get(oid, employees[:5])

            employees_lines = []
            total_gross = 0.0
            total_take_home = 0.0

            for emp in outlet_emps[:8]:  # Max 8 per outlet per cycle
                gross = float(emp.get("base_salary") or random.randint(3_500_000, 12_000_000))
                bpjs_emp = round(gross * 0.01, 2)
                bpjs_er = round(gross * 0.02, 2)
                pph21 = round(max(0, (gross - 5_400_000) * 0.05), 2)
                deduction = bpjs_emp + pph21
                take_home = gross - deduction

                employees_lines.append({
                    "employee_id": emp["id"],
                    "employee_name": emp.get("full_name") or emp.get("name", "Karyawan"),
                    "position": emp.get("position", "Staff"),
                    "gross_salary": round(gross, 2),
                    "bpjs_employee": bpjs_emp,
                    "bpjs_employer": bpjs_er,
                    "pph21": pph21,
                    "allowances": 0,
                    "deductions": round(deduction, 2),
                    "take_home": round(take_home, 2),
                    "sc_share": 0,
                    "incentive_share": 0,
                    "advance_repayment": 0,
                })
                total_gross += gross
                total_take_home += take_home

            status = "posted" if period < PERIOD_NOW else "approved"
            pay_docs.append(base_doc({
                "doc_no": pay_no(i + 1),
                "period": period,
                "outlet_id": oid,
                "payroll_date": f"{period}-25",
                "employees": employees_lines,
                "total_gross": round(total_gross, 2),
                "total_deductions": round(total_gross - total_take_home, 2),
                "total_allowances": 0,
                "total_bpjs_employee": round(sum(e["bpjs_employee"] for e in employees_lines), 2),
                "total_bpjs_employer": round(sum(e["bpjs_employer"] for e in employees_lines), 2),
                "total_pph21": round(sum(e["pph21"] for e in employees_lines), 2),
                "total_advance_repayment": 0,
                "total_take_home": round(total_take_home, 2),
                "pph21_enabled": True,
                "status": status,
                "approved_at": now_iso() if status in ("approved", "posted") else None,
                "approved_by": admin_id if status in ("approved", "posted") else None,
                "posted_at": now_iso() if status == "posted" else None,
                "posted_by": admin_id if status == "posted" else None,
                "journal_entry_id": None,
                "notes": f"Payroll {period} — {outlet.get('name', 'Outlet')}",
                "created_by": admin_id,
            }))
            count += 1
            i += 1

    inserted = 0
    for d in pay_docs:
        result = await db.payroll_cycles.update_one(
            {"doc_no": d["doc_no"]},
            {"$setOnInsert": d},
            upsert=True,
        )
        if result.upserted_id:
            inserted += 1

    print(f"  ✓ {count} payroll cycles dibuat ({inserted} baru)")
    return count


async def seed_leave_requests(db, employees, outlets, admin_id: str) -> int:
    """Seed leave_requests — 2-4 per karyawan, berbagai status dan tipe."""
    print("\n[4/5] Seeding leave_requests…")

    leave_types = ["annual", "sick", "personal", "emergency"]
    statuses = ["submitted", "submitted", "approved", "approved", "rejected"]
    count = 0
    lv_docs = []
    k = 0

    for emp in employees:
        emp_id = emp["id"]
        emp_code = emp.get("code") or emp.get("id")[:6].upper()
        outlet_id = emp.get("outlet_id") or (outlets[0]["id"] if outlets else None)

        for j in range(random.randint(1, 3)):
            k += 1
            day_start = random.randint(1, 60)
            days_count = random.randint(1, 5)
            start = date_str(day_start)
            end = (TODAY - timedelta(days=day_start) + timedelta(days=days_count - 1)).isoformat()
            ltype = random.choice(leave_types)
            status = random.choice(statuses)
            period = start[:7]  # YYYY-MM

            lv_docs.append(base_doc({
                "doc_no": lv_no(emp_code, k),
                "employee_id": emp_id,
                "outlet_id": outlet_id,
                "leave_type": ltype,
                "start_date": start,
                "end_date": end,
                "days_count": days_count,
                "reason": {
                    "annual": "Liburan keluarga",
                    "sick": "Demam dan istirahat",
                    "personal": "Keperluan pribadi",
                    "emergency": "Keperluan mendesak",
                }.get(ltype, "Cuti"),
                "status": status,
                "period": period,
                "approved_by": admin_id if status == "approved" else None,
                "approved_at": now_iso() if status == "approved" else None,
                "rejected_by": admin_id if status == "rejected" else None,
                "rejected_at": now_iso() if status == "rejected" else None,
                "rejection_reason": "Tidak sesuai kebutuhan operasional" if status == "rejected" else None,
                "attachment_url": None,
                "created_by": emp_id,
            }))
            count += 1

    inserted = 0
    for d in lv_docs:
        result = await db.leave_requests.update_one(
            {"doc_no": d["doc_no"]},
            {"$setOnInsert": d},
            upsert=True,
        )
        if result.upserted_id:
            inserted += 1

    print(f"  ✓ {count} leave requests dibuat ({inserted} baru)")
    return count


async def seed_anomaly_events(db, outlets, vendors, admin_id: str) -> int:
    """Seed anomaly_events — berbagai tipe anomali realistis."""
    print("\n[5/5] Seeding anomaly_events…")

    anomaly_templates = [
        # sales_deviation
        {
            "type": "sales_deviation",
            "source_type": "daily_sales",
            "severity": "high",
            "title": "Penjualan turun signifikan",
            "description": "Penjualan harian 42% di bawah rata-rata 30 hari.",
            "details": {"actual": 4_200_000, "expected": 7_250_000, "deviation_pct": -42},
            "recommended_action": "Cek operasional outlet — apakah ada insiden?",
        },
        {
            "type": "sales_deviation",
            "source_type": "daily_sales",
            "severity": "medium",
            "title": "Penjualan naik tidak biasa",
            "description": "Penjualan 35% di atas rata-rata — verifikasi event/promo.",
            "details": {"actual": 18_500_000, "expected": 13_700_000, "deviation_pct": 35},
            "recommended_action": "Konfirmasi ke outlet — pastikan tidak ada input ganda.",
        },
        # vendor_price_spike
        {
            "type": "vendor_price_spike",
            "source_type": "goods_receipt",
            "severity": "high",
            "title": "Lonjakan harga bahan baku",
            "description": "Harga daging sapi naik 28% dari pembelian terakhir.",
            "details": {"item": "Daging Sapi", "prev_price": 130_000, "curr_price": 166_400, "spike_pct": 28},
            "recommended_action": "Cek harga pasar — negosiasi ulang dengan vendor atau ganti.",
        },
        {
            "type": "vendor_price_spike",
            "source_type": "goods_receipt",
            "severity": "medium",
            "title": "Harga kemasan naik",
            "description": "Harga bahan kemasan naik 15% dari PO terakhir.",
            "details": {"item": "Packaging", "prev_price": 8_500, "curr_price": 9_775, "spike_pct": 15},
            "recommended_action": "Cari supplier alternatif atau negosiasi diskon volume.",
        },
        # vendor_leadtime
        {
            "type": "vendor_leadtime",
            "source_type": "goods_receipt",
            "severity": "medium",
            "title": "Lead time vendor memburuk",
            "description": "Rata-rata lead time naik dari 3 hari ke 8 hari bulan ini.",
            "details": {"vendor": "CV Sejahtera", "prev_lt": 3, "curr_lt": 8, "delta_days": 5},
            "recommended_action": "Hubungi vendor — pastikan kapasitas, pertimbangkan pengganti.",
        },
        # ap_cash_spike
        {
            "type": "ap_cash_spike",
            "source_type": "ap_ledger",
            "severity": "high",
            "title": "Lonjakan pengeluaran AP tidak biasa",
            "description": "Total AP bulan ini Rp 185jt vs rata-rata 3 bulan Rp 90jt.",
            "details": {"this_month": 185_000_000, "avg_3m": 90_000_000, "spike_pct": 106},
            "recommended_action": "Audit invoice bulan ini — pastikan semua terotorisasi.",
        },
        {
            "type": "ap_cash_spike",
            "source_type": "ap_ledger",
            "severity": "low",
            "title": "Invoice vendor duplikat terdeteksi",
            "description": "2 invoice dengan nomor INV-2026-0142 dari vendor yang sama.",
            "details": {"invoice_no": "INV-2026-0142", "count": 2},
            "recommended_action": "Hapus satu invoice — konfirmasi ke vendor.",
        },
    ]

    statuses = ["open", "open", "open", "acknowledged", "investigating", "resolved"]
    count = 0
    ev_docs = []

    for i, template in enumerate(anomaly_templates):
        for outlet in random.sample(outlets, k=min(2, len(outlets))):
            day = random.randint(1, 30)
            status = random.choice(statuses)
            vendor = random.choice(vendors) if vendors else {"id": uid(), "name": "Vendor"}

            source_id = uid()
            ev_docs.append({
                "id": uid(),
                "type": template["type"],
                "source_type": template["source_type"],
                "source_id": source_id,
                "outlet_id": outlet["id"],
                "vendor_id": vendor["id"] if template["type"] in ("vendor_price_spike", "vendor_leadtime") else None,
                "period": PERIOD_NOW,
                "scan_date": date_str(day),
                "severity": template["severity"],
                "title": template["title"],
                "description": template["description"],
                "details": template.get("details", {}),
                "recommended_action": template.get("recommended_action"),
                "status": status,
                "assigned_to": None,
                "acknowledged_by": admin_id if status in ("acknowledged", "investigating", "resolved") else None,
                "acknowledged_at": now_iso() if status in ("acknowledged", "investigating", "resolved") else None,
                "acknowledged_note": "Sedang investigasi" if status == "investigating" else None,
                "resolved_by": admin_id if status == "resolved" else None,
                "resolved_at": now_iso() if status == "resolved" else None,
                "resolution_note": "Sudah dikoreksi dan dikonfirmasi." if status == "resolved" else None,
                "created_at": now_iso(), "updated_at": now_iso(), "deleted_at": None,
                "created_by": admin_id,
            })
            count += 1

    inserted = 0
    for d in ev_docs:
        result = await db.anomaly_events.update_one(
            {"type": d["type"], "source_type": d["source_type"], "source_id": d["source_id"]},
            {"$setOnInsert": d},
            upsert=True,
        )
        if result.upserted_id:
            inserted += 1

    print(f"  ✓ {count} anomaly events dibuat ({inserted} baru)")
    return count


async def sync_number_series(db) -> None:
    """RC-5: Pastikan number_series SSOT tidak bentrok dengan dokumen yang di-seed."""
    print("\n[RC-5 GUARD] Sinkronisasi number_series SSOT…")
    pr_count = await db.purchase_requests.count_documents({"doc_no": {"$regex": "^PR-SEED"}})
    pay_count = await db.payroll_cycles.count_documents({"doc_no": {"$regex": "^PAY-SEED"}})

    # Nomor seed menggunakan prefix "SEED" sehingga tidak bentrok dengan generated numbers
    # Namun kita tetap ensure current_value >= N untuk safety
    series_updates = [
        ("PR", max(pr_count, 10)),
        ("PAY", max(pay_count, 5)),
    ]
    for code, min_val in series_updates:
        await db.number_series.update_one(
            {"code": code},
            {"$max": {"current_value": min_val}},
        )
    print("  ✓ number_series synced.")


async def main():
    await init_db()
    db = get_db()

    # Load master data
    outlets = await db.outlets.find({"deleted_at": None}).to_list(20)
    vendors = await db.vendors.find({"deleted_at": None}).to_list(20)
    items = await db.items.find({"deleted_at": None}).to_list(50)
    employees = await db.employees.find({"deleted_at": None}).to_list(50)
    admin = await db.users.find_one({"email": "admin@fnbgroup.id"})
    admin_id = admin["id"] if admin else "system"

    if not outlets:
        print("ERROR: Master data kosong. Jalankan seed_demo.py terlebih dahulu.")
        await close_db()
        return

    print(f"\nMaster data ditemukan: {len(outlets)} outlets, {len(vendors)} vendors, "
          f"{len(items)} items, {len(employees)} employees")

    # Seed semua koleksi yang masih kosong
    pr_count = await seed_purchase_requests(db, outlets, vendors, items, admin_id)
    ap_count = await seed_ap_ledgers(db, vendors, outlets, admin_id)
    pay_count = await seed_payroll_cycles(db, outlets, employees, admin_id)
    lv_count = await seed_leave_requests(db, employees, outlets, admin_id)
    an_count = await seed_anomaly_events(db, outlets, vendors, admin_id)

    # RC-5: Sync number series
    await sync_number_series(db)

    # Ringkasan
    print("\n" + "=" * 60)
    print("SEED SELESAI")
    print("=" * 60)
    print(f"  purchase_requests : {pr_count}")
    print(f"  ap_ledgers        : {ap_count} (total termasuk dari GR)")
    print(f"  payroll_cycles    : {pay_count}")
    print(f"  leave_requests    : {lv_count}")
    print(f"  anomaly_events    : {an_count}")
    print()
    print("Jalankan: python scripts/health_check.py untuk verifikasi.")

    await close_db()


if __name__ == "__main__":
    asyncio.run(main())
