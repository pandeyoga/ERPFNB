"""
Seed script for CMS public content (brands, outlets, news, menu items).
Run with: python -m seed.seed_cms_content
"""
import asyncio
import sys
import os
from datetime import datetime, timezone

# Add backend root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.db import get_db
import uuid


async def seed_cms_content():
    """Seed CMS content for public company profile pages."""
    from core.db import init_db
    
    # Initialize database connection
    await init_db()
    
    db = get_db()
    now = datetime.now(timezone.utc)
    
    print("🌱 Seeding CMS content...")
    
    # ============================================================================
    # 1. BRANDS
    # ============================================================================
    brands = [
        {
            "id": str(uuid.uuid4()),
            "code": "the-coffeeshop",
            "name": "The Coffeeshop",
            "tagline": "Specialty Coffee & All-Day Dining",
            "short_desc": "Tempat di mana secangkir kopi sempurna bertemu dengan suasana yang hangat dan penuh karakter.",
            "story": "The Coffeeshop lahir dari kecintaan terhadap specialty coffee dan filosofi bahwa setiap cangkir adalah pengalaman. Dengan biji kopi pilihan dari berbagai penjuru Nusantara, kami menyeduh cerita di setiap tegukan. Dari pagi yang tenang hingga sore yang produktif, The Coffeeshop adalah rumah ketiga Anda.",
            "color": "#C8A96E",
            "accent_color": "rgba(200,169,110,0.15)",
            "tags": ["Coffee", "All-Day Dining", "Brunch"],
            "hero_image": "https://images.unsplash.com/photo-1617837965404-1e571e841de2?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
            "card_image": "https://images.unsplash.com/photo-1737027985637-78a08f2ad0ea?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
            "signature_dishes": [
                {"name": "The Coffeeshop Signature Blend", "desc": "Single-origin Flores blend, bright and chocolatey", "price": "Rp 55.000"},
                {"name": "Avocado Toast Supreme", "desc": "Sourdough, smashed avocado, poached egg, dukkah", "price": "Rp 78.000"},
                {"name": "Eggs Benedict The Coffeeshop", "desc": "House-cured salmon, hollandaise, toasted brioche", "price": "Rp 89.000"},
            ],
            "established": "2018",
            "status": "published",
            "created_at": now,
            "updated_at": now,
            "deleted_at": None,
        },
        {
            "id": str(uuid.uuid4()),
            "code": "the-restaurant",
            "name": "The Restaurant",
            "tagline": "Modern Latin & Mediterranean",
            "short_desc": "Merayakan kelimpahan rasa Mediterania dan Latin Amerika dengan semangat yang menyala-nyala.",
            "story": "The Restaurant adalah perayaan — cita rasa Mediterania yang kaya dipadukan dengan semangat Latin yang menyala. Setiap hidangan adalah undangan untuk merasakan kehangatan dari pantai-pantai jauh, dinikmati bersama orang-orang terkasih di suasana yang vibrant namun tetap elegan.",
            "color": "#E05C3A",
            "accent_color": "rgba(224,92,58,0.15)",
            "tags": ["Latin", "Mediterranean", "Tapas", "Bar"],
            "hero_image": "https://images.unsplash.com/photo-1670313977220-71e3169af7ad?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
            "card_image": "https://images.unsplash.com/photo-1579888944880-d98341245702?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
            "signature_dishes": [
                {"name": "Paella The Restaurant", "desc": "Saffron rice, seasonal seafood, chorizo, pimentón", "price": "Rp 195.000"},
                {"name": "Burrata & Heirloom", "desc": "Fresh burrata, heirloom tomatoes, aged balsamic, basil oil", "price": "Rp 125.000"},
                {"name": "Churros con Chocolate", "desc": "House-made churros, dark chocolate dipping sauce", "price": "Rp 68.000"},
            ],
            "established": "2019",
            "status": "published",
            "created_at": now,
            "updated_at": now,
            "deleted_at": None,
        },
        {
            "id": str(uuid.uuid4()),
            "code": "the-bistro",
            "name": "The Bistro",
            "tagline": "European Bistro & Wine",
            "short_desc": "Keanggunan masakan Eropa klasik disajikan dengan sentuhan kontemporer yang tidak lekang oleh waktu.",
            "story": "The Bistro membawa jiwa bistro Eropa ke jantung kota. Named after the heather flower of Scottish highlands, The Bistro menghadirkan keanggunan masakan Prancis dan Italia dengan bahan-bahan terbaik, wine list yang dikurasi dengan cermat, dan suasana yang membuat setiap makan malam terasa istimewa.",
            "color": "#7B9E87",
            "accent_color": "rgba(123,158,135,0.15)",
            "tags": ["European", "Bistro", "Wine", "Fine Dining"],
            "hero_image": "https://images.unsplash.com/photo-1642477303430-ad6b97b6ad78?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
            "card_image": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
            "signature_dishes": [
                {"name": "Confit de Canard", "desc": "Duck leg confit, lentil du Puy, jus de canard", "price": "Rp 285.000"},
                {"name": "Risotto al Tartufo", "desc": "Arborio rice, black truffle, aged Parmigiano-Reggiano", "price": "Rp 245.000"},
                {"name": "Crème Brûlée Classique", "desc": "Vanilla bean custard, caramelized sugar crust", "price": "Rp 88.000"},
            ],
            "established": "2020",
            "status": "published",
            "created_at": now,
            "updated_at": now,
            "deleted_at": None,
        },
        {
            "id": str(uuid.uuid4()),
            "code": "the-bakery",
            "name": "The Bakery",
            "tagline": "Artisan Bakery & Coffee",
            "short_desc": "Kue dan roti artisan yang dipanggang segar setiap hari dengan cinta dan keahlian turun-temurun.",
            "story": "The Bakery adalah hati dari setiap pagi yang sempurna. Dari adonan yang difermentasi secara alami hingga kue yang dipanggang dengan sempurna, kami percaya bahwa roti yang baik adalah seni yang membutuhkan waktu, kesabaran, dan bahan terbaik. Setiap gigitan adalah cerita dari tangan-tangan terampil yang merangkai tradisi dan inovasi.",
            "color": "#D4A574",
            "accent_color": "rgba(212,165,116,0.15)",
            "tags": ["Bakery", "Artisan", "Coffee", "Pastry"],
            "hero_image": "https://images.unsplash.com/photo-1509440159596-0249088772ff?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
            "card_image": "https://images.unsplash.com/photo-1555507036-ab1f4038808a?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
            "signature_dishes": [
                {"name": "Sourdough Loaf", "desc": "24-hour fermented, crusty exterior, airy crumb", "price": "Rp 48.000"},
                {"name": "Pain au Chocolat", "desc": "Laminated croissant dough, dark chocolate batons", "price": "Rp 38.000"},
                {"name": "The Bakery Special Cake", "desc": "Seasonal cake with premium ingredients", "price": "Rp 65.000"},
            ],
            "established": "2022",
            "status": "published",
            "created_at": now,
            "updated_at": now,
            "deleted_at": None,
        },
        {
            "id": str(uuid.uuid4()),
            "code": "the-lounge",
            "name": "The Lounge",
            "tagline": "Sports Bar & American Grill",
            "short_desc": "Vibes urban New York, grill premium, dan craft beer — tempat nonton game sambil menikmati makanan terbaik.",
            "story": "The Lounge lahir dari inspirasi basketball court legendaris di Harlem yang menjadi simbol semangat, komunitas, dan kebersamaan. Kami menghadirkan vibe urban New York yang autentik — craft beer yang dikurasi, grill dan smoked meats kelas premium, plus layar besar untuk setiap pertandingan. Ini bukan sekadar bar, ini adalah ruang untuk semua orang berkumpul.",
            "color": "#E84D0E",
            "accent_color": "rgba(232,77,14,0.15)",
            "tags": ["Sports Bar", "American Grill", "Craft Beer", "BBQ"],
            "hero_image": "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
            "card_image": "https://images.unsplash.com/photo-1565299507177-b0ac66763828?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
            "signature_dishes": [
                {"name": "Lounge Smash Burger", "desc": "Double smash patty, American cheese, special sauce, brioche bun", "price": "Rp 145.000"},
                {"name": "BBQ Baby Back Ribs", "desc": "12-hour smoked pork ribs, house BBQ sauce, coleslaw", "price": "Rp 295.000"},
                {"name": "Craft Beer Flight", "desc": "4 rotating craft beers, tasting notes card", "price": "Rp 165.000"},
            ],
            "established": "2023",
            "status": "published",
            "created_at": now,
            "updated_at": now,
            "deleted_at": None,
        },
    ]
    
    # Clear and insert brands
    await db.public_brands.delete_many({})
    result_brands = await db.public_brands.insert_many(brands)
    print(f"✅ Seeded {len(result_brands.inserted_ids)} brands")
    
    # Create brand map for outlets/menu
    brand_map = {b["code"]: {"id": b["id"], "name": b["name"]} for b in brands}
    
    # ============================================================================
    # 2. OUTLETS
    # ============================================================================
    outlets = [
        {
            "id": str(uuid.uuid4()),
            "brand_id": brand_map["the-coffeeshop"]["id"],
            "brand_name": brand_map["the-coffeeshop"]["name"],
            "code": "the-coffeeshop-sudirman",
            "name": "The Coffeeshop Sudirman",
            "address": "Jl. Jend. Sudirman No. 28, Karet Tengsin, Jakarta Pusat 10220",
            "area": "Jakarta Pusat",
            "phone": "+62 21 5798 1234",
            "email": "sudirman@the-coffeeshop.id",
            "hours_weekday": "07:00 – 22:00",
            "hours_weekend": "08:00 – 23:00",
            "features": ["Dine In", "Takeaway", "Delivery", "Coworking"],
            "map_url": "https://maps.google.com/?q=The Coffeeshop+Sudirman+Jakarta",
            "lat": -6.2088,
            "lng": 106.8456,
            "status": "published",
            "created_at": now,
            "updated_at": now,
            "deleted_at": None,
        },
        {
            "id": str(uuid.uuid4()),
            "brand_id": brand_map["the-coffeeshop"]["id"],
            "brand_name": brand_map["the-coffeeshop"]["name"],
            "code": "the-coffeeshop-kemang",
            "name": "The Coffeeshop Kemang",
            "address": "Jl. Kemang Raya No. 45, Kemang, Jakarta Selatan 12730",
            "area": "Jakarta Selatan",
            "phone": "+62 21 7179 5678",
            "email": "kemang@the-coffeeshop.id",
            "hours_weekday": "08:00 – 22:00",
            "hours_weekend": "08:00 – 23:00",
            "features": ["Dine In", "Takeaway", "Delivery", "Pet Friendly"],
            "map_url": "https://maps.google.com/?q=The Coffeeshop+Kemang+Jakarta",
            "lat": -6.2646,
            "lng": 106.8150,
            "status": "published",
            "created_at": now,
            "updated_at": now,
            "deleted_at": None,
        },
        {
            "id": str(uuid.uuid4()),
            "brand_id": brand_map["the-restaurant"]["id"],
            "brand_name": brand_map["the-restaurant"]["name"],
            "code": "delasal-scbd",
            "name": "The Restaurant SCBD",
            "address": "Jl. Jend. Sudirman Kav 52-53, SCBD, Jakarta Selatan 12190",
            "area": "SCBD Jakarta",
            "phone": "+62 21 5140 9012",
            "email": "scbd@delasol.id",
            "hours_weekday": "11:00 – 23:00",
            "hours_weekend": "11:00 – 00:00",
            "features": ["Dine In", "Bar", "Private Dining", "Events"],
            "map_url": "https://maps.google.com/?q=De+La+Sol+SCBD+Jakarta",
            "lat": -6.2242,
            "lng": 106.8001,
            "status": "published",
            "created_at": now,
            "updated_at": now,
            "deleted_at": None,
        },
        {
            "id": str(uuid.uuid4()),
            "brand_id": brand_map["the-restaurant"]["id"],
            "brand_name": brand_map["the-restaurant"]["name"],
            "code": "delasal-bali",
            "name": "The Restaurant Seminyak",
            "address": "Jl. Kayu Aya No. 18, Seminyak, Badung, Bali 80361",
            "area": "Seminyak, Bali",
            "phone": "+62 361 847 3456",
            "email": "seminyak@delasol.id",
            "hours_weekday": "12:00 – 23:30",
            "hours_weekend": "11:00 – 00:00",
            "features": ["Dine In", "Bar", "Rooftop", "Sunset View"],
            "map_url": "https://maps.google.com/?q=De+La+Sol+Seminyak+Bali",
            "lat": -8.6748,
            "lng": 115.1607,
            "status": "published",
            "created_at": now,
            "updated_at": now,
            "deleted_at": None,
        },
        {
            "id": str(uuid.uuid4()),
            "brand_id": brand_map["the-bistro"]["id"],
            "brand_name": brand_map["the-bistro"]["name"],
            "code": "the-bistro-gandaria",
            "name": "The Bistro Gandaria",
            "address": "Gandaria City Mall LG Floor, Jl. Sultan Iskandar Muda, Jakarta Selatan 12240",
            "area": "Jakarta Selatan",
            "phone": "+62 21 2278 7890",
            "email": "gandaria@the-bistro.id",
            "hours_weekday": "11:00 – 22:00",
            "hours_weekend": "11:00 – 22:30",
            "features": ["Dine In", "Wine Bar", "Private Room"],
            "map_url": "https://maps.google.com/?q=The Bistro+Gandaria+Jakarta",
            "lat": -6.2449,
            "lng": 106.7893,
            "status": "published",
            "created_at": now,
            "updated_at": now,
            "deleted_at": None,
        },
        {
            "id": str(uuid.uuid4()),
            "brand_id": brand_map["the-bistro"]["id"],
            "brand_name": brand_map["the-bistro"]["name"],
            "code": "the-bistro-senopati",
            "name": "The Bistro Senopati",
            "address": "Jl. Senopati No. 58, Kebayoran Baru, Jakarta Selatan 12110",
            "area": "Jakarta Selatan",
            "phone": "+62 21 7209 2345",
            "email": "senopati@the-bistro.id",
            "hours_weekday": "17:00 – 23:00",
            "hours_weekend": "12:00 – 23:00",
            "features": ["Dine In", "Wine Bar", "Live Jazz", "Events"],
            "map_url": "https://maps.google.com/?q=The Bistro+Senopati+Jakarta",
            "lat": -6.2425,
            "lng": 106.8048,
            "status": "published",
            "created_at": now,
            "updated_at": now,
            "deleted_at": None,
        },
        {
            "id": str(uuid.uuid4()),
            "brand_id": brand_map["the-bakery"]["id"],
            "brand_name": brand_map["the-bakery"]["name"],
            "code": "the-bakery-pik",
            "name": "The Bakery PIK",
            "address": "Pantai Indah Kapuk, Jakarta Utara 14470",
            "area": "Jakarta Utara",
            "phone": "+62 21 5088 6789",
            "email": "pik@the-bakery.id",
            "hours_weekday": "06:00 – 21:00",
            "hours_weekend": "07:00 – 22:00",
            "features": ["Dine In", "Takeaway", "Fresh Baked Daily", "Coffee"],
            "map_url": "https://maps.google.com/?q=The Bakery+PIK+Jakarta",
            "lat": -6.1121,
            "lng": 106.7374,
            "status": "published",
            "created_at": now,
            "updated_at": now,
            "deleted_at": None,
        },
        {
            "id": str(uuid.uuid4()),
            "brand_id": brand_map["the-lounge"]["id"],
            "brand_name": brand_map["the-lounge"]["name"],
            "code": "the-lounge-scbd",
            "name": "The Lounge SCBD",
            "address": "Sudirman Central Business District, Jl. Jend. Sudirman Kav. 52-53, Jakarta Selatan 12190",
            "area": "Jakarta Selatan",
            "phone": "+62 21 5140 5678",
            "email": "scbd@thelounge.id",
            "hours_weekday": "16:00 – 01:00",
            "hours_weekend": "14:00 – 02:00",
            "features": ["Dine In", "Bar", "Live Sports Screening", "Craft Beer", "Private Events"],
            "map_url": "https://maps.google.com/?q=Lounge+Park+SCBD+Jakarta",
            "lat": -6.2221,
            "lng": 106.8084,
            "status": "published",
            "created_at": now,
            "updated_at": now,
            "deleted_at": None,
        },
    ]
    
    # Clear and insert outlets
    await db.public_outlets.delete_many({})
    result_outlets = await db.public_outlets.insert_many(outlets)
    print(f"✅ Seeded {len(result_outlets.inserted_ids)} outlets")
    
    # ============================================================================
    # 3. NEWS
    # ============================================================================
    news = [
        {
            "id": str(uuid.uuid4()),
            "title": "The Coffeeshop Opens Third Location: Kemang Village",
            "excerpt": "Memperluas kehadiran kami di Jakarta Selatan, The Coffeeshop Kemang Village hadir dengan konsep terbaru — coffee lab terbuka dan garden seating yang luas.",
            "content": "The Coffeeshop dengan bangga mengumumkan pembukaan outlet ketiga kami di Kemang Village. Outlet ini menampilkan coffee lab terbuka di mana tamu dapat melihat langsung proses brewing specialty coffee, serta garden seating yang luas untuk pengalaman outdoor yang nyaman.",
            "date": "2026-04-18",
            "category": "Opening",
            "brand_id": brand_map["the-coffeeshop"]["id"],
            "image": "https://images.unsplash.com/photo-1745611159885-1b7d6d272247?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
            "status": "published",
            "created_at": now,
            "updated_at": now,
            "deleted_at": None,
        },
        {
            "id": str(uuid.uuid4()),
            "title": "The Restaurant Seminyak: A New Chapter in Bali",
            "excerpt": "Dengan view rooftop yang menakjubkan menghadap sunset Seminyak, gerai terbaru kami di Bali menghadirkan nuansa Mediterranean yang autentik.",
            "content": "The Restaurant membawa cita rasa Latin-Mediterranean ke Bali. Outlet Seminyak kami menawarkan pengalaman kuliner yang luar biasa dengan rooftop bar yang menghadap sunset ikonik Seminyak, menu tapas autentik, dan cocktail signature.",
            "date": "2026-03-25",
            "category": "Opening",
            "brand_id": brand_map["the-restaurant"]["id"],
            "image": "https://images.unsplash.com/photo-1670313977220-71e3169af7ad?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
            "status": "published",
            "created_at": now,
            "updated_at": now,
            "deleted_at": None,
        },
        {
            "id": str(uuid.uuid4()),
            "title": "The Bistro Wine Dinner: A Journey Through Burgundy",
            "excerpt": "Malam spesial bersama sommelière kami, menjelajahi enam label Pinot Noir terbaik dari Côte de Nuits, dipasangkan dengan six-course dinner oleh Chef Alain.",
            "content": "Bergabunglah dengan kami untuk wine dinner eksklusif di The Bistro Senopati. Sommelière kami akan memandu Anda melalui enam wine Pinot Noir pilihan dari Burgundy, dipasangkan sempurna dengan six-course menu dari Chef Alain. Tempat terbatas.",
            "date": "2026-03-10",
            "category": "Events",
            "brand_id": brand_map["the-bistro"]["id"],
            "image": "https://images.unsplash.com/photo-1642477303430-ad6b97b6ad78?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
            "status": "published",
            "created_at": now,
            "updated_at": now,
            "deleted_at": None,
        },
        {
            "id": str(uuid.uuid4()),
            "title": "The Bakery Artisan Workshop 2026",
            "excerpt": "Belajar seni membuat roti sourdough dari master baker kami — workshop hands-on dengan bahan premium dan resep eksklusif.",
            "content": "The Bakery mengadakan workshop sourdough baking untuk pecinta roti artisan. Dalam sesi 4 jam ini, Anda akan belajar membuat sourdough starter, teknik kneading, shaping, dan baking dari master baker kami. Peserta membawa pulang sourdough loaf buatan sendiri.",
            "date": "2026-02-28",
            "category": "Events",
            "brand_id": brand_map["the-bakery"]["id"],
            "image": "https://images.unsplash.com/photo-1509440159596-0249088772ff?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
            "status": "published",
            "created_at": now,
            "updated_at": now,
            "deleted_at": None,
        },
        {
            "id": str(uuid.uuid4()),
            "title": "FnB Group Wins F&B Excellence Award 2026",
            "excerpt": "Kami dengan bangga mengumumkan penghargaan F&B Excellence dari Indonesia Restaurant Association, mengakui komitmen kami pada kualitas dan inovasi.",
            "content": "FnB Group menerima penghargaan F&B Excellence 2026 dari Indonesia Restaurant Association. Penghargaan ini mengakui dedikasi kami terhadap kualitas makanan, inovasi menu, sustainability practices, dan pengalaman pelanggan yang luar biasa di semua brand kami.",
            "date": "2026-02-14",
            "category": "Award",
            "brand_id": None,
            "image": "https://images.unsplash.com/photo-1617837965404-1e571e841de2?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
            "status": "published",
            "created_at": now,
            "updated_at": now,
            "deleted_at": None,
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Behind the Beans: The Coffeeshop's Farm-to-Cup Journey",
            "excerpt": "Perjalanan kami ke Flores — mengunjungi petani kopi mitra kami dan memahami proses dari kebun hingga cangkir yang Anda nikmati setiap pagi.",
            "content": "Tim The Coffeeshop mengunjungi kebun kopi mitra kami di Flores untuk memahami lebih dalam proses dari farm ke cup. Kami berkomitmen untuk sourcing yang ethical dan sustainable, memastikan setiap cangkir kopi Anda tidak hanya lezat, tetapi juga mendukung petani lokal.",
            "date": "2026-01-30",
            "category": "Story",
            "brand_id": brand_map["the-coffeeshop"]["id"],
            "image": "https://images.unsplash.com/photo-1736798939697-90ec682d0567?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
            "status": "published",
            "created_at": now,
            "updated_at": now,
            "deleted_at": None,
        },
    ]
    
    # Clear and insert news
    await db.public_news.delete_many({})
    result_news = await db.public_news.insert_many(news)
    print(f"✅ Seeded {len(result_news.inserted_ids)} news articles")
    
    # ============================================================================
    # 4. MENU ITEMS
    # ============================================================================
    menu_items = [
        # The Coffeeshop
        {"id": str(uuid.uuid4()), "brand_id": brand_map["the-coffeeshop"]["id"], "brand_name": brand_map["the-coffeeshop"]["name"], "code": "a1", "category": "Coffee", "name": "The Coffeeshop Signature Blend", "description": "Single-origin Flores, bright & chocolatey notes", "price": 55000, "tags": ["Signature", "Hot"], "available": True, "status": "published", "created_at": now, "updated_at": now, "deleted_at": None},
        {"id": str(uuid.uuid4()), "brand_id": brand_map["the-coffeeshop"]["id"], "brand_name": brand_map["the-coffeeshop"]["name"], "code": "a2", "category": "Coffee", "name": "Cold Brew Tonic", "description": "18-hour cold brew, premium tonic water, citrus", "price": 65000, "tags": ["Cold", "Signature"], "available": True, "status": "published", "created_at": now, "updated_at": now, "deleted_at": None},
        {"id": str(uuid.uuid4()), "brand_id": brand_map["the-coffeeshop"]["id"], "brand_name": brand_map["the-coffeeshop"]["name"], "code": "a3", "category": "Coffee", "name": "Latte Susu Segar", "description": "Double ristretto, full-cream local dairy", "price": 48000, "tags": ["Hot", "Classic"], "available": True, "status": "published", "created_at": now, "updated_at": now, "deleted_at": None},
        {"id": str(uuid.uuid4()), "brand_id": brand_map["the-coffeeshop"]["id"], "brand_name": brand_map["the-coffeeshop"]["name"], "code": "a4", "category": "Brunch", "name": "Avocado Toast Supreme", "description": "Sourdough, smashed avocado, poached egg, dukkah", "price": 78000, "tags": ["Healthy", "Vegetarian"], "available": True, "status": "published", "created_at": now, "updated_at": now, "deleted_at": None},
        {"id": str(uuid.uuid4()), "brand_id": brand_map["the-coffeeshop"]["id"], "brand_name": brand_map["the-coffeeshop"]["name"], "code": "a5", "category": "Brunch", "name": "Eggs Benedict The Coffeeshop", "description": "House-cured salmon, hollandaise, brioche", "price": 89000, "tags": ["Signature"], "available": True, "status": "published", "created_at": now, "updated_at": now, "deleted_at": None},
        {"id": str(uuid.uuid4()), "brand_id": brand_map["the-coffeeshop"]["id"], "brand_name": brand_map["the-coffeeshop"]["name"], "code": "a6", "category": "Light Bites", "name": "Banana Bread", "description": "House-baked, walnuts, honey butter", "price": 42000, "tags": ["Sweet"], "available": True, "status": "published", "created_at": now, "updated_at": now, "deleted_at": None},
        {"id": str(uuid.uuid4()), "brand_id": brand_map["the-coffeeshop"]["id"], "brand_name": brand_map["the-coffeeshop"]["name"], "code": "a7", "category": "Light Bites", "name": "Acai Bowl", "description": "Blended acai, granola, seasonal fruits, honey", "price": 75000, "tags": ["Healthy", "Vegan"], "available": True, "status": "published", "created_at": now, "updated_at": now, "deleted_at": None},
        
        # The Restaurant
        {"id": str(uuid.uuid4()), "brand_id": brand_map["the-restaurant"]["id"], "brand_name": brand_map["the-restaurant"]["name"], "code": "d1", "category": "Tapas", "name": "Patatas Bravas", "description": "Crispy potatoes, aioli, bravas sauce", "price": 72000, "tags": ["Spanish", "Vegetarian"], "available": True, "status": "published", "created_at": now, "updated_at": now, "deleted_at": None},
        {"id": str(uuid.uuid4()), "brand_id": brand_map["the-restaurant"]["id"], "brand_name": brand_map["the-restaurant"]["name"], "code": "d2", "category": "Tapas", "name": "Burrata & Heirloom", "description": "Fresh burrata, heirloom tomatoes, balsamic", "price": 125000, "tags": ["Italian", "Vegetarian"], "available": True, "status": "published", "created_at": now, "updated_at": now, "deleted_at": None},
        {"id": str(uuid.uuid4()), "brand_id": brand_map["the-restaurant"]["id"], "brand_name": brand_map["the-restaurant"]["name"], "code": "d3", "category": "Mains", "name": "Paella The Restaurant", "description": "Saffron rice, seasonal seafood, chorizo", "price": 195000, "tags": ["Signature", "Seafood"], "available": True, "status": "published", "created_at": now, "updated_at": now, "deleted_at": None},
        {"id": str(uuid.uuid4()), "brand_id": brand_map["the-restaurant"]["id"], "brand_name": brand_map["the-restaurant"]["name"], "code": "d4", "category": "Mains", "name": "Grilled Octopus", "description": "Spanish octopus, chimichurri, smoked paprika", "price": 215000, "tags": ["Seafood", "Grilled"], "available": True, "status": "published", "created_at": now, "updated_at": now, "deleted_at": None},
        {"id": str(uuid.uuid4()), "brand_id": brand_map["the-restaurant"]["id"], "brand_name": brand_map["the-restaurant"]["name"], "code": "d5", "category": "Drinks", "name": "Sangria Blanca", "description": "White wine, elderflower, citrus, white peach", "price": 95000, "tags": ["Cocktail"], "available": True, "status": "published", "created_at": now, "updated_at": now, "deleted_at": None},
        {"id": str(uuid.uuid4()), "brand_id": brand_map["the-restaurant"]["id"], "brand_name": brand_map["the-restaurant"]["name"], "code": "d6", "category": "Desserts", "name": "Churros con Chocolate", "description": "House churros, dark chocolate sauce", "price": 68000, "tags": ["Spanish", "Sweet"], "available": True, "status": "published", "created_at": now, "updated_at": now, "deleted_at": None},
        
        # The Bistro
        {"id": str(uuid.uuid4()), "brand_id": brand_map["the-bistro"]["id"], "brand_name": brand_map["the-bistro"]["name"], "code": "c1", "category": "Starters", "name": "Foie Gras Torchon", "description": "Port wine jelly, brioche, micro herbs", "price": 185000, "tags": ["French", "Premium"], "available": True, "status": "published", "created_at": now, "updated_at": now, "deleted_at": None},
        {"id": str(uuid.uuid4()), "brand_id": brand_map["the-bistro"]["id"], "brand_name": brand_map["the-bistro"]["name"], "code": "c2", "category": "Pasta", "name": "Risotto al Tartufo", "description": "Black truffle, Parmigiano-Reggiano", "price": 245000, "tags": ["Italian", "Premium", "Vegetarian"], "available": True, "status": "published", "created_at": now, "updated_at": now, "deleted_at": None},
        {"id": str(uuid.uuid4()), "brand_id": brand_map["the-bistro"]["id"], "brand_name": brand_map["the-bistro"]["name"], "code": "c3", "category": "Mains", "name": "Confit de Canard", "description": "Duck leg confit, lentil du Puy, jus", "price": 285000, "tags": ["French", "Signature"], "available": True, "status": "published", "created_at": now, "updated_at": now, "deleted_at": None},
        {"id": str(uuid.uuid4()), "brand_id": brand_map["the-bistro"]["id"], "brand_name": brand_map["the-bistro"]["name"], "code": "c4", "category": "Mains", "name": "Steak Frites Maison", "description": "200g strip loin, béarnaise, thin-cut fries", "price": 325000, "tags": ["French", "Beef"], "available": True, "status": "published", "created_at": now, "updated_at": now, "deleted_at": None},
        {"id": str(uuid.uuid4()), "brand_id": brand_map["the-bistro"]["id"], "brand_name": brand_map["the-bistro"]["name"], "code": "c5", "category": "Wine", "name": "House Champagne", "description": "Per glass, Brut NV", "price": 175000, "tags": ["Wine", "Champagne"], "available": True, "status": "published", "created_at": now, "updated_at": now, "deleted_at": None},
        {"id": str(uuid.uuid4()), "brand_id": brand_map["the-bistro"]["id"], "brand_name": brand_map["the-bistro"]["name"], "code": "c6", "category": "Desserts", "name": "Crème Brûlée Classique", "description": "Vanilla bean custard, caramelized sugar", "price": 88000, "tags": ["French", "Sweet"], "available": True, "status": "published", "created_at": now, "updated_at": now, "deleted_at": None},
        
        # The Bakery
        {"id": str(uuid.uuid4()), "brand_id": brand_map["the-bakery"]["id"], "brand_name": brand_map["the-bakery"]["name"], "code": "b1", "category": "Bread", "name": "Sourdough Loaf", "description": "24-hour fermented, crusty exterior", "price": 48000, "tags": ["Artisan", "Signature"], "available": True, "status": "published", "created_at": now, "updated_at": now, "deleted_at": None},
        {"id": str(uuid.uuid4()), "brand_id": brand_map["the-bakery"]["id"], "brand_name": brand_map["the-bakery"]["name"], "code": "b2", "category": "Pastry", "name": "Pain au Chocolat", "description": "Laminated croissant, dark chocolate batons", "price": 38000, "tags": ["French", "Pastry"], "available": True, "status": "published", "created_at": now, "updated_at": now, "deleted_at": None},
        {"id": str(uuid.uuid4()), "brand_id": brand_map["the-bakery"]["id"], "brand_name": brand_map["the-bakery"]["name"], "code": "b3", "category": "Pastry", "name": "Almond Croissant", "description": "Butter croissant, almond cream filling", "price": 42000, "tags": ["Pastry", "Sweet"], "available": True, "status": "published", "created_at": now, "updated_at": now, "deleted_at": None},
        {"id": str(uuid.uuid4()), "brand_id": brand_map["the-bakery"]["id"], "brand_name": brand_map["the-bakery"]["name"], "code": "b4", "category": "Cake", "name": "The Bakery Special Cake", "description": "Seasonal cake, premium ingredients", "price": 65000, "tags": ["Sweet", "Signature"], "available": True, "status": "published", "created_at": now, "updated_at": now, "deleted_at": None},
        {"id": str(uuid.uuid4()), "brand_id": brand_map["the-bakery"]["id"], "brand_name": brand_map["the-bakery"]["name"], "code": "b5", "category": "Coffee", "name": "Flat White", "description": "Double shot espresso, microfoam milk", "price": 38000, "tags": ["Hot", "Classic"], "available": True, "status": "published", "created_at": now, "updated_at": now, "deleted_at": None},
        {"id": str(uuid.uuid4()), "brand_id": brand_map["the-bakery"]["id"], "brand_name": brand_map["the-bakery"]["name"], "code": "b6", "category": "Coffee", "name": "Pour Over", "description": "Single origin, V60 method", "price": 45000, "tags": ["Hot", "Specialty"], "available": True, "status": "published", "created_at": now, "updated_at": now, "deleted_at": None},
        {"id": str(uuid.uuid4()), "brand_id": brand_map["the-bakery"]["id"], "brand_name": brand_map["the-bakery"]["name"], "code": "b7", "category": "Coffee", "name": "Cold Brew", "description": "12-hour cold extraction, smooth finish", "price": 40000, "tags": ["Cold"], "available": True, "status": "published", "created_at": now, "updated_at": now, "deleted_at": None},
        
        # The Lounge
        {"id": str(uuid.uuid4()), "brand_id": brand_map["the-lounge"]["id"], "brand_name": brand_map["the-lounge"]["name"], "code": "r1", "category": "Burgers", "name": "Lounge Smash Burger", "description": "Double smash patty, American cheese, special sauce, brioche bun", "price": 145000, "tags": ["Signature", "Beef"], "available": True, "status": "published", "created_at": now, "updated_at": now, "deleted_at": None},
        {"id": str(uuid.uuid4()), "brand_id": brand_map["the-lounge"]["id"], "brand_name": brand_map["the-lounge"]["name"], "code": "r2", "category": "BBQ", "name": "BBQ Baby Back Ribs", "description": "12-hour smoked pork ribs, house BBQ sauce, coleslaw", "price": 295000, "tags": ["Signature", "Smoked"], "available": True, "status": "published", "created_at": now, "updated_at": now, "deleted_at": None},
        {"id": str(uuid.uuid4()), "brand_id": brand_map["the-lounge"]["id"], "brand_name": brand_map["the-lounge"]["name"], "code": "r3", "category": "Wings", "name": "Buffalo Wings", "description": "Crispy chicken wings, buffalo sauce, blue cheese dip", "price": 115000, "tags": ["Spicy", "Classic"], "available": True, "status": "published", "created_at": now, "updated_at": now, "deleted_at": None},
        {"id": str(uuid.uuid4()), "brand_id": brand_map["the-lounge"]["id"], "brand_name": brand_map["the-lounge"]["name"], "code": "r4", "category": "Sides", "name": "Loaded Fries", "description": "Thick-cut fries, cheddar sauce, pulled pork, jalapeño", "price": 95000, "tags": ["Indulgent"], "available": True, "status": "published", "created_at": now, "updated_at": now, "deleted_at": None},
        {"id": str(uuid.uuid4()), "brand_id": brand_map["the-lounge"]["id"], "brand_name": brand_map["the-lounge"]["name"], "code": "r5", "category": "Beer", "name": "Craft Beer Flight", "description": "4 rotating craft beers, tasting notes card", "price": 165000, "tags": ["Craft Beer", "Signature"], "available": True, "status": "published", "created_at": now, "updated_at": now, "deleted_at": None},
        {"id": str(uuid.uuid4()), "brand_id": brand_map["the-lounge"]["id"], "brand_name": brand_map["the-lounge"]["name"], "code": "r6", "category": "Cocktails", "name": "Harlem Mule", "description": "Bourbon, ginger beer, lime, mint, aromatic bitters", "price": 125000, "tags": ["Cocktail"], "available": True, "status": "published", "created_at": now, "updated_at": now, "deleted_at": None},
        {"id": str(uuid.uuid4()), "brand_id": brand_map["the-lounge"]["id"], "brand_name": brand_map["the-lounge"]["name"], "code": "r7", "category": "Desserts", "name": "S'mores Skillet", "description": "Warm chocolate brownie, toasted marshmallow, graham crumble", "price": 85000, "tags": ["Sweet", "Sharing"], "available": True, "status": "published", "created_at": now, "updated_at": now, "deleted_at": None},
    ]
    
    # Clear and insert menu items
    await db.public_menu_items.delete_many({})
    result_menu = await db.public_menu_items.insert_many(menu_items)
    print(f"✅ Seeded {len(result_menu.inserted_ids)} menu items")
    
    print("\n🎉 CMS content seeding complete!")
    print(f"   - {len(brands)} brands")
    print(f"   - {len(outlets)} outlets")
    print(f"   - {len(news)} news articles")
    print(f"   - {len(menu_items)} menu items")


if __name__ == "__main__":
    asyncio.run(seed_cms_content())
