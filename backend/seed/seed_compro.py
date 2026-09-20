"""Comprehensive Company Profile seed for FnB Group.
Seeds:
- Company profile / about us content in system_settings
- Complete CMS content (brands, outlets, team, menus, news)
- Financial demo data (journal entries, AP invoices, payments)
- HR demo (employee advances, payroll snapshots, service charge)
- Loyalty demo (customers, points, redemptions)
- Reservations
- Procurement (PR/PO/GR cycles)
- Inventory (complete stock movements)
- Fixed assets
Run: python3 -m seed.seed_compro
"""
import asyncio
import sys
import uuid
import random
from datetime import datetime, timezone, timedelta, date
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))
load_dotenv(ROOT_DIR / ".env")

from core.db import init_db, get_db, close_db  # noqa: E402
from core.security import hash_password  # noqa: E402


def now_str() -> str:
    return datetime.now(timezone.utc).isoformat()


def days_ago(n: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=n)).isoformat()


def date_ago(n: int) -> str:
    return (date.today() - timedelta(days=n)).isoformat()


def uid() -> str:
    return str(uuid.uuid4())


def doc(extra=None):
    base = {"id": uid(), "created_at": now_str(), "updated_at": now_str(),
            "deleted_at": None, "active": True}
    if extra:
        base.update(extra)
    return base


# ───────────────────────────────────────────────────────────
# COMPANY PROFILE DATA
# ───────────────────────────────────────────────────────────
COMPANY_PROFILE = {
    "id": "fnbgroup-group-profile",
    "company_name": "FnB Group",
    "legal_name": "PT FnB Group Kuliner Nusantara",
    "npwp": "01.234.567.8-421.000",
    "nib": "1234567890123",
    "pkp_since": "2019-01-01",
    "address": "Jl. Setiabudi No. 12, Bandung, Jawa Barat 40141",
    "phone": "+62-22-1234-5678",
    "email": "info@fnbgroup.id",
    "website": "https://www.fnbgroup.id",
    "instagram": "@fnbgroup.id",
    "founded": "2018",
    "tagline": "Crafted for moments that matter",
    "about": "FnB Group adalah perusahaan kuliner yang berfokus pada pengalaman bersantap berkualitas tinggi di Bandung. Dengan 5 brand unik, kami melayani lebih dari 10.000 pelanggan setiap bulannya.",
    "mission": "Menghadirkan pengalaman kuliner premium yang autentik dengan bahan-bahan lokal berkualitas tinggi.",
    "vision": "Menjadi grup kuliner terdepan di Indonesia yang dikenal dengan standar kualitas dan inovasi.",
    "brands": [
        {"name": "The Coffeeshop", "concept": "Modern Indonesian bistro", "color": "#D4AF37"},
        {"name": "The Restaurant", "concept": "Mediterranean & tapas", "color": "#4A7C59"},
        {"name": "The Bistro", "concept": "All-day breakfast café", "color": "#C47B5A"},
        {"name": "The Lounge", "concept": "American street food & sports bar", "color": "#2C3E8C"},
        {"name": "The Bakery", "concept": "Specialty coffee & artisan bakery", "color": "#3D2B1F"},
    ],
    "team": [
        {"name": "Yoga Swastika", "title": "Founder & CEO", "bio": "Visionary entrepreneur dengan 10 tahun pengalaman di industri F&B"},
        {"name": "Rina Kartika", "title": "COO", "bio": "Ahli operasional F&B dengan rekam jejak 8 tahun di chain restoran nasional"},
        {"name": "Budi Santoso", "title": "CFO", "bio": "CPA berpengalaman, ex-senior manager Big 4 accounting firm"},
        {"name": "Dewi Permata", "title": "Head of Marketing", "bio": "Digital marketing specialist dengan fokus pada F&B branding"},
    ],
    "created_at": now_str(),
    "updated_at": now_str(),
}

# ───────────────────────────────────────────────────────────
# CMS CONTENT
# ───────────────────────────────────────────────────────────
CMS_PAGES = [
    doc({"slug": "home", "title": "Beranda", "page_type": "home", "status": "published",
         "meta_title": "FnB Group — Culinary Experience in Bandung",
         "meta_description": "5 brand kuliner premium di Bandung. Reservasi meja, lihat menu, bergabung loyalty program kami.",
         "hero_title": "Crafted for Moments That Matter",
         "hero_subtitle": "Lima brand kuliner premium di jantung Bandung",
         "hero_cta": "Reservasi Sekarang"}),
    doc({"slug": "about", "title": "Tentang Kami", "page_type": "about", "status": "published",
         "content": "FnB Group lahir dari kecintaan terhadap kuliner berkualitas tinggi dan pengalaman bersantap yang tak terlupakan. Didirikan pada 2018 di Bandung, kami telah melayani lebih dari 500.000 pelanggan dan terus bertumbuh.",
         "meta_title": "Tentang FnB Group"}),
    doc({"slug": "careers", "title": "Karir", "page_type": "careers", "status": "published",
         "meta_title": "Karir di FnB Group — Bergabung Bersama Kami",
         "intro": "Kami selalu mencari individu berbakat yang bersemangat di industri F&B."}),
]

CMS_NEWS = [
    doc({"title": "FnB Group Buka Outlet Ke-6 di Dago",
         "slug": "fnbgroup-buka-outlet-dago",
         "category": "news",
         "excerpt": "FnB Group dengan bangga mengumumkan pembukaan outlet ke-6 di kawasan Dago, Bandung.",
         "content": "Setelah sukses dengan 5 outlet eksisting, FnB Group siap ekspansi ke Dago. Outlet baru ini akan mengusung konsep The Restaurant Extended dengan kapasitas 120 pax.",
         "image_url": "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800",
         "published_at": days_ago(15), "status": "published", "author": "Tim Marketing"}),
    doc({"title": "The Bakery Raih Penghargaan Best Specialty Coffee Bandung 2025",
         "slug": "the-bakery-best-coffee-award",
         "category": "achievement",
         "excerpt": "The Bakery dinobatkan sebagai Best Specialty Coffee Shop di Bandung Coffee Awards 2025.",
         "content": "Keunggulan The Bakery dalam kurasi biji kopi single origin Nusantara dan keahlian barista berstandar internasional membawa kami meraih penghargaan bergengsi ini.",
         "image_url": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800",
         "published_at": days_ago(45), "status": "published", "author": "Tim Marketing"}),
    doc({"title": "Program Sustainability: Farm to Table FnB Group",
         "slug": "farm-to-table-program",
         "category": "csr",
         "excerpt": "Inisiatif kami bermitra langsung dengan 20 petani lokal Jawa Barat.",
         "content": "Sebagai bentuk komitmen kami terhadap keberlanjutan, FnB Group meluncurkan program Farm to Table yang menghubungkan restoran kami langsung dengan petani lokal. Program ini memastikan kesegaran bahan baku sekaligus mendukung ekonomi petani lokal.",
         "image_url": "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800",
         "published_at": days_ago(90), "status": "published", "author": "CSR Team"}),
    doc({"title": "The Lounge Luncurkan Menu Ramadan Eksklusif",
         "slug": "the-lounge-menu-ramadan",
         "category": "promo",
         "excerpt": "Nikmati berbuka puasa dengan paket spesial The Lounge senilai Rp 125.000.",
         "content": "Rayakan momen berbuka puasa bersama orang tersayang di The Lounge. Menu spesial Ramadan kami hadir dengan pilihan makanan autentik Amerika yang telah diadaptasi untuk selera lokal.",
         "image_url": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800",
         "published_at": days_ago(120), "status": "published", "author": "The Lounge Team"}),
]

CMS_JOBS = [
    doc({"title": "Head Chef — The Restaurant", "department": "Kitchen", "outlet": "The Restaurant",
         "type": "full_time", "level": "senior", "status": "open",
         "description": "Kami mencari Head Chef berpengalaman untuk memimpin dapur The Restaurant. Kandidat ideal memiliki minimum 5 tahun pengalaman di restoran fine dining dengan spesialisasi masakan Mediterranean.",
         "requirements": ["Min. 5 tahun pengalaman sebagai Head Chef", "Keahlian masakan Mediterranean/Western", "Familiar dengan standar HACCP", "Kemampuan leadership yang kuat"],
         "benefits": ["Gaji kompetitif + bonus", "BPJS Kesehatan & Ketenagakerjaan", "Makan 1x sehari", "Pelatihan berkala"],
         "salary_range": "Rp 8.000.000 - Rp 12.000.000", "location": "Bandung",
         "posted_at": days_ago(7)}),
    doc({"title": "Barista Specialist — The Bakery", "department": "Bar", "outlet": "The Bakery",
         "type": "full_time", "level": "mid", "status": "open",
         "description": "Bergabunglah dengan tim The Bakery sebagai Barista Specialist. Kami mencari individu yang passionate tentang specialty coffee dan memiliki kemampuan latte art.",
         "requirements": ["Certified barista (SCA/SCAI)", "Min. 2 tahun pengalaman", "Kemampuan latte art tingkat lanjut", "Pengetahuan tentang coffee origin dan processing"],
         "benefits": ["Gaji + tip sharing", "Akses ke coffee training", "BPJS lengkap"],
         "salary_range": "Rp 4.500.000 - Rp 6.500.000", "location": "Bandung",
         "posted_at": days_ago(3)}),
    doc({"title": "Restaurant Manager — The Coffeeshop", "department": "Operations", "outlet": "The Coffeeshop",
         "type": "full_time", "level": "senior", "status": "open",
         "description": "The Coffeeshop mencari Restaurant Manager yang berpengalaman untuk mengawasi operasional harian, memimpin tim FOH, dan memastikan pengalaman pelanggan yang luar biasa.",
         "requirements": ["Min. 3 tahun sebagai Restaurant/Outlet Manager", "Kemampuan analisis bisnis", "Pengalaman dengan sistem POS", "Kemampuan komunikasi yang baik"],
         "salary_range": "Rp 7.000.000 - Rp 10.000.000", "location": "Bandung",
         "posted_at": days_ago(10)}),
    doc({"title": "Marketing Executive — FnB Group", "department": "Marketing", "outlet": "HQ",
         "type": "full_time", "level": "junior", "status": "open",
         "description": "Bergabung dengan tim marketing FnB Group untuk mengelola konten digital, kampanye media sosial, dan aktivasi brand.",
         "requirements": ["S1 Marketing/Komunikasi", "Pengalaman di F&B brand adalah nilai tambah", "Familiar dengan tools: Canva, Meta Ads, Google Analytics"],
         "salary_range": "Rp 4.000.000 - Rp 6.000.000", "location": "Bandung",
         "posted_at": days_ago(5)}),
]


async def seed_company_profile(db):
    print("Seeding company profile...")
    coll = db["company_profile"]
    await coll.delete_many({})
    await coll.insert_one(COMPANY_PROFILE)
    print("  → Company profile inserted")


async def seed_cms_pages(db):
    print("Seeding CMS pages...")
    coll = db["cms_pages"]
    await coll.delete_many({})
    await coll.insert_many(CMS_PAGES)
    print(f"  → {len(CMS_PAGES)} CMS pages")


async def seed_cms_news(db):
    print("Seeding CMS news...")
    coll = db["cms_articles"]
    await coll.delete_many({})
    await coll.insert_many(CMS_NEWS)
    print(f"  → {len(CMS_NEWS)} news articles")


async def seed_cms_jobs(db):
    print("Seeding CMS careers...")
    coll = db["cms_careers"]
    await coll.delete_many({})
    await coll.insert_many(CMS_JOBS)
    print(f"  → {len(CMS_JOBS)} job postings")


async def seed_finance_journals(db):
    print("Seeding finance journal entries...")

    # Get outlets & COA
    outlets = await db["outlets"].find({"active": True}).to_list(None)
    coa = await db["chart_of_accounts"].find({"active": True}).to_list(None)
    if not outlets or not coa:
        print("  ⚠ No outlets or COA found, skipping journals")
        return

    # Map account types
    cash_acc = next((a for a in coa if "Kas" in a.get("name", "")), coa[0])
    sales_acc = next((a for a in coa if "Pendapatan" in a.get("name", "") or "Sales" in a.get("name", "")), None)
    cogs_acc = next((a for a in coa if "HPP" in a.get("name", "") or "Pokok" in a.get("name", "")), None)
    rent_acc = next((a for a in coa if "Sewa" in a.get("name", "")), None)
    salary_acc = next((a for a in coa if "Gaji" in a.get("name", "") or "Upah" in a.get("name", "")), None)
    marketing_acc = next((a for a in coa if "Marketing" in a.get("name", "") or "Promosi" in a.get("name", "")), None)
    ap_acc = next((a for a in coa if "Hutang" in a.get("name", "") or "AP" in a.get("name", "")), None)

    journals = []
    journal_lines = []

    # Monthly salary journals for last 3 months
    for m in range(3, 0, -1):
        je_id = uid()
        je_date = date_ago(m * 30)
        total_salary = random.randint(75_000_000, 90_000_000)
        journals.append(doc({
            "id": je_id, "number": f"JE-{je_date[:7].replace('-','')}-SAL",
            "date": je_date, "description": f"Jurnal Penggajian Karyawan - {je_date[:7]}",
            "type": "manual", "status": "posted",
            "total_debit": total_salary, "total_credit": total_salary,
            "period": je_date[:7], "outlet_id": None, "posted_by": "admin@fnbgroup.id",
        }))
        if salary_acc:
            journal_lines.append({"id": uid(), "je_id": je_id, "account_id": salary_acc["id"],
                "account_code": salary_acc.get("code"), "debit": total_salary, "credit": 0,
                "description": "Beban Gaji Karyawan", "created_at": now_str()})
        if cash_acc:
            journal_lines.append({"id": uid(), "je_id": je_id, "account_id": cash_acc["id"],
                "account_code": cash_acc.get("code"), "debit": 0, "credit": total_salary,
                "description": "Pembayaran Gaji via Transfer", "created_at": now_str()})

    # Monthly rent journals for last 3 months
    for m in range(3, 0, -1):
        je_id = uid()
        je_date = date_ago(m * 30)
        rent_total = 45_000_000
        journals.append(doc({
            "id": je_id, "number": f"JE-{je_date[:7].replace('-','')}-RENT",
            "date": je_date, "description": f"Beban Sewa Outlet - {je_date[:7]}",
            "type": "manual", "status": "posted",
            "total_debit": rent_total, "total_credit": rent_total,
            "period": je_date[:7],
        }))
        if rent_acc:
            journal_lines.append({"id": uid(), "je_id": je_id, "account_id": rent_acc["id"],
                "account_code": rent_acc.get("code"), "debit": rent_total, "credit": 0,
                "description": "Beban Sewa 5 Outlet", "created_at": now_str()})
        if cash_acc:
            journal_lines.append({"id": uid(), "je_id": je_id, "account_id": cash_acc["id"],
                "account_code": cash_acc.get("code"), "debit": 0, "credit": rent_total,
                "description": "Pembayaran Sewa", "created_at": now_str()})

    # Marketing expenses
    for m in range(3, 0, -1):
        je_id = uid()
        je_date = date_ago(m * 30)
        mkt_amt = random.randint(8_000_000, 15_000_000)
        journals.append(doc({
            "id": je_id, "number": f"JE-{je_date[:7].replace('-','')}-MKT",
            "date": je_date, "description": f"Beban Marketing & Promosi - {je_date[:7]}",
            "type": "manual", "status": "posted",
            "total_debit": mkt_amt, "total_credit": mkt_amt, "period": je_date[:7],
        }))

    await db["journal_entries"].delete_many({})
    await db["journal_lines"].delete_many({})
    if journals:
        await db["journal_entries"].insert_many(journals)
    if journal_lines:
        await db["journal_lines"].insert_many(journal_lines)
    print(f"  → {len(journals)} journal entries, {len(journal_lines)} lines")


async def seed_ap_invoices(db):
    print("Seeding AP invoices...")
    vendors = await db["vendors"].find({"active": True}).to_list(None)
    outlets = await db["outlets"].find({"active": True}).to_list(None)
    if not vendors:
        print("  ⚠ No vendors found, skipping AP invoices")
        return

    invoices = []
    ITEMS = ["Bahan Baku Makanan", "Minuman & Beverage", "Perlengkapan Dapur", "Kemasan",
             "Bahan Pembersih", "Gas LPG", "Produk Bakery", "Kopi Single Origin"]

    for i in range(20):
        vendor = random.choice(vendors)
        outlet = random.choice(outlets)
        days = random.randint(5, 60)
        inv_date = date_ago(days)
        due_date = (date.today() - timedelta(days=days) + timedelta(days=30)).isoformat()
        amount = random.randint(2_000_000, 25_000_000)
        ppn = int(amount * 0.11)
        total = amount + ppn
        status = random.choice(["open", "open", "paid", "overdue"])

        invoices.append(doc({
            "number": f"SINV-{inv_date[:7].replace('-','')}-{str(i+1).zfill(3)}",
            "vendor_id": vendor["id"], "vendor_name": vendor.get("name"),
            "outlet_id": outlet["id"], "outlet_name": outlet.get("name"),
            "invoice_date": inv_date, "due_date": due_date,
            "description": f"{random.choice(ITEMS)} - {outlet.get('name')}",
            "subtotal": amount, "ppn": ppn, "total": total,
            "currency": "IDR", "status": status,
            "paid_at": now_str() if status == "paid" else None,
            "period": inv_date[:7],
        }))

    await db["ap_invoices"].delete_many({})
    await db["ap_invoices"].insert_many(invoices)
    print(f"  → {len(invoices)} AP invoices")


async def seed_procurement_cycle(db):
    print("Seeding procurement cycle (PR → PO → GR)...")
    vendors = await db["vendors"].find({"active": True}).to_list(None)
    outlets = await db["outlets"].find({"active": True}).to_list(None)
    items = await db["items"].find({"active": True}).to_list(None)
    users = await db["users"].find({"active": True}).to_list(None)

    if not vendors or not outlets or not items:
        print("  ⚠ Missing master data, skipping procurement")
        return

    pr_list, po_list, gr_list = [], [], []
    CATEGORIES = ["Bahan Baku", "Packaging", "Perlengkapan", "Minuman"]

    for i in range(15):
        outlet = random.choice(outlets)
        vendor = random.choice(vendors)
        days = random.randint(3, 45)
        pr_date = date_ago(days + 5)
        po_date = date_ago(days + 2)
        gr_date = date_ago(days)

        # PR
        pr_id = uid()
        pr_items = []
        for j in range(random.randint(2, 5)):
            item = random.choice(items)
            qty = random.randint(5, 50)
            price = random.randint(10_000, 150_000)
            pr_items.append({"item_id": item["id"], "item_name": item.get("name"),
                             "qty": qty, "unit": item.get("unit", "pcs"),
                             "est_price": price, "total": qty * price,
                             "category": random.choice(CATEGORIES)})
        pr_total = sum(x["total"] for x in pr_items)

        pr = doc({
            "id": pr_id, "number": f"PR-{pr_date[:7].replace('-','')}-{str(i+1).zfill(3)}",
            "outlet_id": outlet["id"], "outlet_name": outlet.get("name"),
            "date": pr_date, "status": "approved", "priority": "normal",
            "items": pr_items, "total": pr_total,
            "requested_by": outlet.get("manager_email", "admin@fnbgroup.id"),
            "approved_at": date_ago(days + 3), "notes": f"Kebutuhan rutin {outlet.get('name')}",
        })
        pr_list.append(pr)

        # PO
        po_id = uid()
        po_items = []
        for pi in pr_items:
            po_items.append({**pi, "unit_price": pi["est_price"], "line_total": pi["qty"] * pi["est_price"]})
        po_total = sum(x["line_total"] for x in po_items)
        ppn = int(po_total * 0.11)

        po = doc({
            "id": po_id, "number": f"PO-{po_date[:7].replace('-','')}-{str(i+1).zfill(3)}",
            "pr_id": pr_id, "vendor_id": vendor["id"], "vendor_name": vendor.get("name"),
            "outlet_id": outlet["id"], "outlet_name": outlet.get("name"),
            "date": po_date, "delivery_date": gr_date, "status": "received",
            "items": po_items, "subtotal": po_total, "ppn": ppn, "total": po_total + ppn,
            "currency": "IDR", "payment_terms": "Net 30",
        })
        po_list.append(po)

        # GR
        gr_items = [{**pi, "received_qty": pi["qty"], "variance": 0} for pi in po_items]
        gr = doc({
            "number": f"GR-{gr_date[:7].replace('-','')}-{str(i+1).zfill(3)}",
            "po_id": po_id, "pr_id": pr_id,
            "vendor_id": vendor["id"], "vendor_name": vendor.get("name"),
            "outlet_id": outlet["id"], "outlet_name": outlet.get("name"),
            "date": gr_date, "status": "completed",
            "items": gr_items, "total_received": po_total,
            "received_by": "admin@fnbgroup.id",
        })
        gr_list.append(gr)

    await db["purchase_requests"].delete_many({})
    await db["purchase_orders"].delete_many({})
    await db["goods_receipts"].delete_many({})

    await db["purchase_requests"].insert_many(pr_list)
    await db["purchase_orders"].insert_many(po_list)
    await db["goods_receipts"].insert_many(gr_list)
    print(f"  → {len(pr_list)} PRs, {len(po_list)} POs, {len(gr_list)} GRs")


async def seed_hr_data(db):
    print("Seeding HR demo data...")
    employees = await db["employees"].find({"active": True}).to_list(None)
    if not employees:
        print("  ⚠ No employees found, skipping HR data")
        return

    advances = []
    for i in range(12):
        emp = random.choice(employees)
        days = random.randint(5, 60)
        amt = random.choice([500_000, 1_000_000, 1_500_000, 2_000_000])
        status = random.choice(["approved", "approved", "paid", "pending"])
        advances.append(doc({
            "number": f"ADV-{date_ago(days)[:7].replace('-','')}-{str(i+1).zfill(3)}",
            "employee_id": emp.get("id"), "employee_name": emp.get("name"),
            "outlet_id": emp.get("outlet_id"),
            "amount": amt, "purpose": random.choice(["Kebutuhan Pribadi", "Biaya Medis", "Pendidikan", "Darurat"]),
            "status": status, "date": date_ago(days),
            "approved_at": date_ago(days - 2) if status in ["approved", "paid"] else None,
        }))

    await db["employee_advances"].delete_many({})
    await db["employee_advances"].insert_many(advances)
    print(f"  → {len(advances)} employee advances")


async def seed_loyalty_customers(db):
    print("Seeding loyalty customers...")
    NAMES = ["Budi Santoso", "Rina Dewi", "Ahmad Fauzi", "Sari Indah", "Joko Widodo",
             "Maya Putri", "Deni Kurnia", "Fitri Lestari", "Hendra Gunawan", "Novi Anggraeni",
             "Agus Pramono", "Wulan Sari", "Bambang Susilo", "Citra Dewi", "Eko Prasetyo",
             "Fajar Nugroho", "Gita Nirmala", "Hafiz Rahman", "Ika Permatasari", "Jihan Safira"]

    existing = await db["loyalty_users"].count_documents({})
    if existing >= 10:
        print(f"  → Already have {existing} loyalty users, skipping")
        return

    customers = []
    for i, name in enumerate(NAMES):
        pts = random.randint(500, 15000)
        customers.append({
            "id": uid(), "name": name,
            "email": f"{name.lower().replace(' ', '.')}{i+1}@gmail.com",
            "phone": f"08{random.randint(10000000, 99999999):08d}",
            "points": pts, "total_points_earned": pts + random.randint(0, 5000),
            "total_points_redeemed": random.randint(0, pts // 2),
            "tier": "gold" if pts > 10000 else ("silver" if pts > 3000 else "bronze"),
            "total_visits": random.randint(5, 80),
            "total_spent": random.randint(500_000, 15_000_000),
            "joined_at": days_ago(random.randint(30, 365)),
            "last_visit": days_ago(random.randint(1, 30)),
            "created_at": now_str(), "updated_at": now_str(), "active": True,
            "password_hash": hash_password("Demo@2026"),
        })

    await db["loyalty_users"].insert_many(customers)
    print(f"  → {len(customers)} loyalty customers")


async def seed_reservations(db):
    print("Seeding reservations...")
    outlets = await db["outlets"].find({"active": True}).to_list(None)
    loyalty_users = await db["loyalty_users"].find({}).to_list(20)
    if not outlets:
        print("  ⚠ No outlets, skipping reservations")
        return

    reservations = []
    OCCASIONS = ["Birthday", "Anniversary", "Business Dinner", "Gathering", "Date Night", "Family Dinner"]
    TIMES = ["12:00", "13:00", "18:00", "19:00", "19:30", "20:00"]

    for i in range(30):
        outlet = random.choice(outlets)
        days_offset = random.randint(-7, 14)  # past and future
        res_date = (date.today() + timedelta(days=days_offset)).isoformat()
        user = random.choice(loyalty_users) if loyalty_users else None
        status = "confirmed" if days_offset > 0 else "completed"

        reservations.append(doc({
            "number": f"RES-{res_date[:7].replace('-','')}-{str(i+1).zfill(3)}",
            "outlet_id": outlet["id"], "outlet_name": outlet.get("name"),
            "guest_name": user.get("name") if user else f"Tamu {i+1}",
            "guest_phone": user.get("phone") if user else f"0812{random.randint(10000000,99999999)}",
            "guest_email": user.get("email") if user else None,
            "loyalty_id": user.get("id") if user else None,
            "date": res_date, "time": random.choice(TIMES),
            "pax": random.randint(2, 12),
            "occasion": random.choice(OCCASIONS),
            "notes": random.choice(["Tolong siapkan kue ulang tahun", "Meja dekat jendela",
                                    "Vegetarian menu needed", "", "No pork please"]),
            "status": status, "table_number": str(random.randint(1, 20)),
        }))

    await db["reservations"].delete_many({})
    await db["reservations"].insert_many(reservations)
    print(f"  → {len(reservations)} reservations")


async def seed_fixed_assets(db):
    print("Seeding fixed assets...")
    outlets = await db["outlets"].find({"active": True}).to_list(None)
    if not outlets:
        print("  ⚠ No outlets, skipping fixed assets")
        return

    ASSET_TYPES = [
        {"name": "Espresso Machine Nuova Simonelli", "category": "Peralatan Dapur", "value": 45_000_000, "life": 10},
        {"name": "Commercial Oven Rational", "category": "Peralatan Dapur", "value": 85_000_000, "life": 10},
        {"name": "POS System Terminal", "category": "Peralatan IT", "value": 8_500_000, "life": 5},
        {"name": "Showcase Refrigerator", "category": "Peralatan Dapur", "value": 22_000_000, "life": 8},
        {"name": "CCTV System (8 kamera)", "category": "Peralatan Keamanan", "value": 15_000_000, "life": 5},
        {"name": "Furniture Set Meja Kursi", "category": "Inventaris", "value": 35_000_000, "life": 8},
        {"name": "AC Split 2PK (4 unit)", "category": "Peralatan Gedung", "value": 28_000_000, "life": 10},
        {"name": "Signage & Branding", "category": "Inventaris", "value": 18_000_000, "life": 5},
        {"name": "Sound System", "category": "Peralatan Hiburan", "value": 12_000_000, "life": 5},
        {"name": "Laptop & Komputer", "category": "Peralatan IT", "value": 16_000_000, "life": 5},
    ]

    assets = []
    for i, outlet in enumerate(outlets):
        asset_types_for_outlet = random.sample(ASSET_TYPES, min(len(ASSET_TYPES), random.randint(4, 8)))
        for at in asset_types_for_outlet:
            acq_date = date_ago(random.randint(180, 1095))  # 6 months to 3 years ago
            acq_value = at["value"]
            useful_life = at["life"]
            dep_per_year = acq_value / useful_life
            dep_per_month = dep_per_year / 12
            months_elapsed = random.randint(6, min(36, useful_life * 12))
            accum_dep = dep_per_month * months_elapsed
            book_value = max(0, acq_value - accum_dep)

            assets.append(doc({
                "asset_number": f"FA-{outlet.get('name', '')[:3].upper()}-{str(len(assets)+1).zfill(4)}",
                "name": f"{at['name']}",
                "category": at["category"],
                "outlet_id": outlet["id"], "outlet_name": outlet.get("name"),
                "acquisition_date": acq_date,
                "acquisition_value": acq_value,
                "useful_life_years": useful_life,
                "depreciation_method": "straight_line",
                "depreciation_per_month": round(dep_per_month),
                "accumulated_depreciation": round(accum_dep),
                "book_value": round(book_value),
                "status": "active" if book_value > 0 else "fully_depreciated",
                "notes": f"Aset {at['category']} untuk {outlet.get('name')}",
                "condition": random.choice(["excellent", "good", "good", "fair"]),
            }))

    await db["fixed_assets"].delete_many({})
    await db["fixed_assets"].insert_many(assets)
    print(f"  → {len(assets)} fixed assets")


async def main():
    await init_db()
    db = get_db()
    print("\n🌱 Seeding FnB Group comprehensive company data...\n")

    await seed_company_profile(db)
    await seed_cms_pages(db)
    await seed_cms_news(db)
    await seed_cms_jobs(db)
    await seed_finance_journals(db)
    await seed_ap_invoices(db)
    await seed_procurement_cycle(db)
    await seed_hr_data(db)
    await seed_loyalty_customers(db)
    await seed_reservations(db)
    await seed_fixed_assets(db)

    # Final count
    print("\n📊 Final collection counts:")
    col_names = ["company_profile", "cms_pages", "cms_articles", "cms_careers",
                 "journal_entries", "ap_invoices", "purchase_requests",
                 "purchase_orders", "goods_receipts", "employee_advances",
                 "loyalty_users", "reservations", "fixed_assets"]
    for cn in col_names:
        count = await db[cn].count_documents({})
        print(f"  {cn}: {count}")

    await close_db()
    print("\n✅ Compro seed complete!")


if __name__ == "__main__":
    asyncio.run(main())
