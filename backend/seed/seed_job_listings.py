"""Seed sample job_listings (8 positions across F&B roles).

Idempotent — clears prior seed marker rows then re-inserts. Safe to re-run.
Documented in plan.md as already-seeded state; this script provides a
deterministic way to recreate the dataset after a fresh DB.

Run: python -m seed.seed_job_listings
"""
import asyncio
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))
load_dotenv(ROOT_DIR / ".env")

from core.db import init_db, get_db, close_db  # noqa: E402


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


JOBS = [
    {
        "title": "Outlet Manager — The Coffeeshop (Sudirman)",
        "department": "Operations",
        "brand": "The Coffeeshop",
        "job_type": "Full-time",
        "location": "Jakarta — Sudirman",
        "salary_min": 9000000,
        "salary_max": 13000000,
        "summary": "Memimpin operasional harian outlet The Coffeeshop, supervisi tim 8–12 karyawan, dan memastikan target sales, service, serta kebersihan tercapai.",
        "responsibilities": [
            "Memastikan SOP service, kitchen, dan kebersihan dijalankan ketat.",
            "Mengontrol cost (food cost ≤32%, labor ≤22%) dan profit margin outlet.",
            "Melakukan briefing harian, evaluasi mingguan, dan coaching tim.",
            "Berkoordinasi dengan Finance, HR, dan Procurement untuk closing harian.",
        ],
        "requirements": [
            "Minimal 3 tahun di posisi serupa di F&B casual dining / cafe premium.",
            "Pengalaman closing harian, daily sales validation, opname inventory.",
            "Familiar dengan POS, kasbon karyawan, dan service charge distribution.",
            "Komunikatif, problem solver, siap kerja shift termasuk weekend.",
        ],
    },
    {
        "title": "Head Chef — The Bakery Steakhouse",
        "department": "Kitchen",
        "brand": "The Bakery",
        "job_type": "Full-time",
        "location": "Jakarta — Senopati",
        "salary_min": 15000000,
        "salary_max": 22000000,
        "summary": "Memimpin tim kitchen The Bakery (premium steakhouse), bertanggung jawab atas konsistensi rasa, plating, food cost, dan inovasi menu seasonal.",
        "responsibilities": [
            "Standardisasi resep & plating; kontrol kualitas per shift.",
            "Manajemen food cost, waste, dan stock opname mingguan.",
            "Mentoring sous chef & line cook, rotasi training.",
            "Berkolaborasi dengan FOH untuk service excellence.",
        ],
        "requirements": [
            "Min. 5 tahun sebagai Head Chef / Sous Chef di steakhouse atau fine dining.",
            "Mahir butchering / dry aging beef, sauce mastery, grilling.",
            "Sertifikasi food safety (HACCP) lebih disukai.",
            "Bisa bekerja di bawah tekanan saat peak hour.",
        ],
    },
    {
        "title": "Barista — The Bistro Coffee",
        "department": "Bar",
        "brand": "The Bistro",
        "job_type": "Full-time",
        "location": "Jakarta — Kemang",
        "salary_min": 4500000,
        "salary_max": 6500000,
        "summary": "Bergabung dengan tim The Bistro Coffee. Kami mencari barista yang passionate terhadap third-wave coffee dan latte art.",
        "responsibilities": [
            "Espresso extraction, milk steaming, latte art (rosetta, tulip, swan).",
            "Menjaga konsistensi quality cup; kalibrasi grinder per shift.",
            "Edukasi customer tentang origin & profile kopi.",
            "Maintenance & cleaning espresso machine harian.",
        ],
        "requirements": [
            "Min. 1 tahun pengalaman barista (specialty coffee shop).",
            "Tahu basic SCA standards, brew ratio, TDS.",
            "Latte art level intermediate ke atas.",
            "Bersih, ramah, dan bersedia kerja shift.",
        ],
    },
    {
        "title": "Pastry Chef — The Restaurant Bakery",
        "department": "Pastry",
        "brand": "The Restaurant",
        "job_type": "Full-time",
        "location": "Jakarta — Kelapa Gading",
        "salary_min": 8000000,
        "salary_max": 12000000,
        "summary": "Pastry chef untuk lini bakery & viennoiserie The Restaurant — croissant, sourdough, cake, dan dessert plated.",
        "responsibilities": [
            "Mengembangkan resep croissant, sourdough, laminated dough.",
            "Standardisasi production schedule untuk multi-outlet.",
            "Quality control & training assistant.",
            "Manajemen ingredient cost dan waste.",
        ],
        "requirements": [
            "Min. 3 tahun pengalaman pastry/bakery profesional.",
            "Mastery laminated dough, sourdough, viennoiserie.",
            "Pendidikan culinary / pastry school lebih disukai.",
            "Kreatif dalam menu development musiman.",
        ],
    },
    {
        "title": "Accountant / Finance Staff",
        "department": "Finance",
        "brand": "FnB Group",
        "job_type": "Full-time",
        "location": "Jakarta — HQ Sudirman",
        "salary_min": 6000000,
        "salary_max": 9000000,
        "summary": "Memproses jurnal harian multi-outlet, AP/AR ledger, rekonsiliasi bank, dan support periode closing.",
        "responsibilities": [
            "Input & validasi journal entries multi-outlet (5 brands).",
            "Process AP invoice, payment requests, bank reconciliation.",
            "Bantuan periodic closing (monthly trial balance, P&L).",
            "Support tax compliance (PPN, PPh 21/23/4(2)).",
        ],
        "requirements": [
            "S1 Akuntansi.",
            "Min. 2 tahun di F&B atau hospitality.",
            "Familiar dengan PSAK, perpajakan Indonesia, ERP system.",
            "Brevet A/B lebih disukai.",
        ],
    },
    {
        "title": "HR Generalist",
        "department": "HR",
        "brand": "FnB Group",
        "job_type": "Full-time",
        "location": "Jakarta — HQ Sudirman",
        "salary_min": 7000000,
        "salary_max": 10000000,
        "summary": "End-to-end HR generalist supporting recruitment, payroll, employee relations, dan training untuk 5 brands.",
        "responsibilities": [
            "Manage recruitment cycle (job listing → interview → onboarding).",
            "Proses payroll bulanan, kasbon, incentive distribution.",
            "Maintain employee database, contract renewal, BPJS.",
            "Coordinate training & development program.",
        ],
        "requirements": [
            "S1 Psikologi/Manajemen SDM/Hukum.",
            "Min. 2 tahun di F&B/hospitality HR generalist.",
            "Paham UU Cipta Kerja, BPJS Ketenagakerjaan & Kesehatan.",
            "Multitasking, empathy, dan teamplayer.",
        ],
    },
    {
        "title": "Procurement Staff",
        "department": "Procurement",
        "brand": "FnB Group",
        "job_type": "Full-time",
        "location": "Jakarta — HQ Sudirman",
        "salary_min": 5500000,
        "salary_max": 8000000,
        "summary": "Process PR → PO → GR untuk 5 brands; manage vendor sourcing, price comparison, dan delivery follow-up.",
        "responsibilities": [
            "Konsolidasi PR dari outlet, buat PO ke vendor terbaik.",
            "Bandingkan harga 3+ vendor per item; track vendor performance.",
            "Koordinasi delivery, GR posting, dan invoice matching.",
            "Maintain vendor master, item master, price history.",
        ],
        "requirements": [
            "D3/S1 dari berbagai jurusan.",
            "Min. 1 tahun di procurement / purchasing F&B.",
            "Mahir negosiasi vendor dan analisa harga.",
            "Detail oriented, paham flow PR → PO → GR.",
        ],
    },
    {
        "title": "Marketing & Social Media Officer",
        "department": "Marketing",
        "brand": "FnB Group",
        "job_type": "Full-time",
        "location": "Jakarta — HQ Sudirman",
        "salary_min": 6500000,
        "salary_max": 9500000,
        "summary": "Drive social media presence untuk 5 brands; konten, campaign, influencer collaboration, dan brand awareness.",
        "responsibilities": [
            "Content planning & production (foto, video, copywriting) untuk IG/TikTok/Facebook.",
            "Manage paid ads, influencer collab, dan event promosi.",
            "Monitor metrics (engagement, reach, CAC) dan A/B testing.",
            "Coordinate dengan tim outlet untuk in-store campaign.",
        ],
        "requirements": [
            "S1 Marketing/Komunikasi/DKV.",
            "Min. 2 tahun social media management — preferably F&B / lifestyle.",
            "Portfolio konten kuat (Reels, TikTok, foto produk).",
            "Familiar dengan Meta Business Suite, TikTok Creator, basic Adobe / Canva.",
        ],
    },
]


async def seed():
    print("Seeding job_listings…")
    db = get_db()
    # Clear ANY existing entries so dataset is deterministic
    await db.job_listings.delete_many({})
    inserted = 0
    for job in JOBS:
        doc = {
            "id": str(uuid.uuid4()),
            "title": job["title"],
            "department": job["department"],
            "brand": job["brand"],
            "job_type": job["job_type"],
            "location": job["location"],
            "salary_min": job["salary_min"],
            "salary_max": job["salary_max"],
            "summary": job["summary"],
            "responsibilities": job["responsibilities"],
            "requirements": job["requirements"],
            "is_active": True,
            "created_at": now(),
            "updated_at": now(),
        }
        await db.job_listings.insert_one(doc)
        inserted += 1
    print(f"✅ Seeded {inserted} job listings.")
    total = await db.job_listings.count_documents({"is_active": True})
    print(f"   Total active in DB: {total}")


async def main():
    await init_db()
    try:
        await seed()
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(main())
