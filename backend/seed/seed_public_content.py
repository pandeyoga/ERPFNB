"""Seed comprehensive public-facing content: public_brands, public_outlets, brand_instagram_posts.

Run: python3 -m seed.seed_public_content
"""
import asyncio
import sys
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))
load_dotenv(ROOT_DIR / ".env")

from core.db import init_db, get_db, close_db  # noqa: E402

NOW = lambda: datetime.now(timezone.utc).isoformat()


def uid() -> str:
    return str(uuid.uuid4())


def days_ago(n):
    return (datetime.now(timezone.utc) - timedelta(days=n)).isoformat()


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC BRANDS — rich content for 5 FnB Group brands
# ─────────────────────────────────────────────────────────────────────────────
PUBLIC_BRANDS = [
    {
        "id": uid(),
        "code": "the-coffeeshop",
        "name": "The Coffeeshop",
        "tagline": "Modern Indonesian Bistronomie",
        "short_desc": "The Coffeeshop menghadirkan masakan Indonesia kontemporer dengan teknik memasak modern dan bahan-bahan lokal pilihan dari seluruh Nusantara.",
        "story": "Lahir dari cinta mendalam terhadap kekayaan kuliner Nusantara, The Coffeeshop berdiri pada 2018 sebagai sebuah bistronomie — perpaduan bistro yang hangat dan gastronomi yang serius. Chef kami percaya bahwa masakan Indonesia modern bukan sekadar penyajian ulang resep nenek moyang, melainkan sebuah dialog antara tradisi dan inovasi.\n\nSetiap hidangan di The Coffeeshop bercerita: rempah dari Maluku bertemu dengan teknik fermentasi kontemporer, sambal terasi Banyuwangi dipresentasikan dalam bentuk yang mengejutkan namun tetap autentik. Kami bermitra langsung dengan lebih dari 20 petani dan nelayan lokal Jawa Barat untuk memastikan kesegaran dan keberlanjutan bahan baku.\n\nThe Coffeeshop bukan sekadar tempat makan — ia adalah ruang untuk merayakan identitas kuliner Indonesia yang kaya dan terus berkembang.",
        "color": "#D4AF37",
        "accent_color": "rgba(212,175,55,0.15)",
        "tags": ["Indonesian Contemporary", "Farm to Table", "Wine Pairing", "Private Dining"],
        "hero_image": "https://images.unsplash.com/photo-1768675142660-949249bcd484?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=2400",
        "card_image": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=800",
        "signature_dishes": [
            {"name": "Rendang Wagyu Confit", "desc": "Wagyu chuck confit 72 jam dalam rempah rendang Minang, disajikan dengan nasi jinggo dan acar kuning.", "price": "Rp 285.000"},
            {"name": "Soto Betawi Bisque", "desc": "Kaldu soto Betawi direformulasi sebagai bisque creamy, dengan crispy offal dan foam santan.", "price": "Rp 145.000"},
            {"name": "Pisang Goreng Soufflé", "desc": "Soufflé panas terinspirasi pisang goreng klasik, dengan es krim kelapa pandan dan caramel kecap.", "price": "Rp 95.000"},
        ],
        "established": "2018",
        "status": "published",
        "instagram": "@the-coffeeshop.id",
        "instagram_username": "the-coffeeshop.id",
        "website": "https://the-coffeeshop.fnbgroup.id",
        "awards": ["Best Indonesian Contemporary 2024 — Bandung Food Award", "Top 50 Restaurants West Java 2023"],
        "atmosphere": "Elegant & Warm",
        "price_range": "Rp 200.000 – 500.000 / orang",
        "seating_capacity": 85,
        "dress_code": "Smart Casual",
        "reservation_required": True,
        "publish_at": None,
        "unpublish_at": None,
        "seo_title": "The Coffeeshop — Modern Indonesian Bistronomie Bandung",
        "seo_description": "Rasakan perpaduan masakan Indonesia kontemporer dengan teknik modern di The Coffeeshop, Bandung. Reservasi meja sekarang.",
        "seo_slug": "the-coffeeshop",
        "workflow_status": "approved",
        "created_at": NOW(),
        "updated_at": NOW(),
        "deleted_at": None,
        "active": True,
    },
    {
        "id": uid(),
        "code": "the-restaurant",
        "name": "The Restaurant",
        "tagline": "Mediterranean Flavours & Tapas Bar",
        "short_desc": "The Restaurant membawa semangat meja makan Mediterania ke Bandung — penuh warna, penuh rasa, penuh tawa. Tapas, mezes, dan wine yang dirayakan bersama.",
        "story": "The Restaurant lahir dari sebuah perjalanan panjang menyusuri pesisir Mediterania — dari tapas bar sempit di Barcelona, taverna batu putih di Santorini, hingga kedai mezze di Istanbul. Yang dibawa pulang bukan sekadar resep, melainkan filosofi makan: bahwa makanan terbaik selalu dinikmati bersama, di atas meja yang penuh hidangan kecil dan gelas yang selalu terisi.\n\nKonsep tapas bar kami memungkinkan setiap tamu untuk menjelajahi berbagai cita rasa dalam satu malam — patatas bravas yang renyah, burrata dengan tomat confit, gambas al ajillo yang harum bawang putih, hingga paella hitam cumi yang dramatis. Menu berubah mengikuti musim dan ketersediaan bahan lokal terbaik.\n\nDengan koleksi wine Spanyol, Italia, dan Prancis yang dikurasi dengan cermat, serta cocktail signature berbasis Aperol dan Vermouth, The Restaurant adalah undangan untuk merayakan — apa saja, kapan saja.",
        "color": "#4A7C59",
        "accent_color": "rgba(74,124,89,0.15)",
        "tags": ["Mediterranean", "Tapas Bar", "Wine Bar", "Group Dining"],
        "hero_image": "https://images.unsplash.com/photo-1557079604-d28080618be0?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=2400",
        "card_image": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=800",
        "signature_dishes": [
            {"name": "Gambas Al Ajillo", "desc": "Udang segar ditumis dalam minyak zaitun, bawang putih, cabai merah, dan white wine. Disajikan panas dengan sourdough bakar.", "price": "Rp 175.000"},
            {"name": "Paella Negra", "desc": "Nasi paella hitam dengan tinta cumi, seafood mix, dan aioli saffron. Dimasak tradisional dalam paellera besi.", "price": "Rp 310.000 / porsi berdua"},
            {"name": "Burrata Caprese", "desc": "Burrata segar impor dengan tomat heirloom lokal Lembang, pesto basil, dan drizzle olive oil premium.", "price": "Rp 145.000"},
        ],
        "established": "2019",
        "status": "published",
        "instagram": "@delasol.bdg",
        "instagram_username": "delasol.bdg",
        "website": "https://delasol.fnbgroup.id",
        "awards": ["Best Mediterranean Restaurant Bandung 2024", "Best Wine Selection West Java 2023"],
        "atmosphere": "Vibrant & Festive",
        "price_range": "Rp 150.000 – 400.000 / orang",
        "seating_capacity": 110,
        "dress_code": "Casual to Smart Casual",
        "reservation_required": False,
        "publish_at": None,
        "unpublish_at": None,
        "seo_title": "The Restaurant — Mediterranean Tapas Bar Bandung",
        "seo_description": "Tapas, mezes, dan wine Mediterania di jantung Bandung. Rayakan momen spesial di The Restaurant.",
        "seo_slug": "the-restaurant",
        "workflow_status": "approved",
        "created_at": NOW(),
        "updated_at": NOW(),
        "deleted_at": None,
        "active": True,
    },
    {
        "id": uid(),
        "code": "the-bistro",
        "name": "The Bistro",
        "tagline": "All-Day Refined Café & Brunch",
        "short_desc": "The Bistro adalah ruang untuk memperlambat waktu — brunch yang tak terburu-buru, kopi yang diseduh dengan perhatian, dan makanan yang merayakan kesederhanaan.",
        "story": "Namanya terinspirasi dari tanaman heather (The Bistro vulgaris) yang tumbuh liar di padang Eropa Utara — sederhana, tahan banting, namun indah pada caranya sendiri. Sama seperti filosifi dapur kami: menemukan keindahan dalam bahan-bahan sederhana yang diperlakukan dengan hormat.\n\nThe Bistro dibuka pada 2020 sebagai respons terhadap ketidakhadiran ruang makan pagi-siang yang sungguh-sungguh baik di Bandung. Bukan sekadar tempat sarapan, The Bistro adalah sanctum — tempat di mana buku bisa dibaca tanpa diusir, di mana laptop boleh dibuka tanpa ditatap sinis, di mana secangkir kopi kedua terasa seperti hadiah.\n\nMenu brunch kami menggabungkan comfort food klasik Eropa (eggs benedict, french toast brioche, kedgeree) dengan sentuhan lokal yang hangat (nasi goreng truffle dengan telur ceplok setengah matang, bubur sumsum dengan caramel lontar). Semua dibuat dari nol setiap paginya, termasuk roti, selai, dan granola.",
        "color": "#C47B5A",
        "accent_color": "rgba(196,123,90,0.15)",
        "tags": ["All-Day Café", "Brunch", "Specialty Coffee", "Work-Friendly"],
        "hero_image": "https://images.unsplash.com/photo-1766832255363-c9f060ade8b0?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=2400",
        "card_image": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=800",
        "signature_dishes": [
            {"name": "Eggs Benedict Saumon", "desc": "Sourdough homemade, salmon gravlax cured 48 jam, telur pochés, hollandaise butter beurre blanc. Disajikan dengan salad mesclun.", "price": "Rp 145.000"},
            {"name": "Ricotta Pancakes", "desc": "Pancakes fluffy dengan ricotta homemade, blueberry compote, lemon curd, dan maple syrup aged Vermont.", "price": "Rp 95.000"},
            {"name": "The Bistro Cold Brew", "desc": "Cold brew single origin Aceh Gayo, diextract 20 jam, disajikan dengan oat milk foam dan cinnamon dusting.", "price": "Rp 65.000"},
        ],
        "established": "2020",
        "status": "published",
        "instagram": "@the-bistro.cafe",
        "instagram_username": "the-bistro.cafe",
        "website": "https://the-bistro.fnbgroup.id",
        "awards": ["Best Brunch Spot Bandung 2024 — Lifestyle Magazine", "Best Coffee Experience 2023"],
        "atmosphere": "Cozy & Intimate",
        "price_range": "Rp 75.000 – 200.000 / orang",
        "seating_capacity": 65,
        "dress_code": "Casual",
        "reservation_required": False,
        "publish_at": None,
        "unpublish_at": None,
        "seo_title": "The Bistro Café — All-Day Brunch & Specialty Coffee Bandung",
        "seo_description": "Brunch terbaik di Bandung. The Bistro café hadir dengan menu brunch autentik dan specialty coffee pilihan.",
        "seo_slug": "the-bistro",
        "workflow_status": "approved",
        "created_at": NOW(),
        "updated_at": NOW(),
        "deleted_at": None,
        "active": True,
    },
    {
        "id": uid(),
        "code": "the-lounge",
        "name": "The Lounge",
        "tagline": "American Street Food & Sports Bar",
        "short_desc": "The Lounge adalah perpaduan kultur street food Amerika yang autentik dengan energi sports bar yang hidup — tempat di mana burger epic, wing yang fierce, dan game yang seru bersatu.",
        "story": "The Lounge mengambil nama dari lapangan basket legendaris di Harlem, New York — sebuah tempat yang melahirkan street cred, komunitas, dan budaya yang kuat. Kami membawa semangat itu ke Bandung: tempat yang egaliter, energik, dan autentik.\n\nMenu kami terinspirasi dari tradisi street food Amerika yang paling ikonik: smash burger dengan patty beef chuck bully 80/20 yang dimasak di flat-top grill, chicken wings dalam 12 varian saus dari classic buffalo hingga Korean honey garlic, loaded fries yang hadir dalam berbagai persona, dan hot dog gaya Coney Island.\n\nDengan 8 layar besar yang menayangkan live sports dari seluruh dunia (NBA, Premier League, UFC, MotoGP), draft beer terpilih, dan playlist hip-hop & R&B yang diseleksi dengan baik, The Lounge adalah destination untuk malam yang tak terlupakan.",
        "color": "#2C3E8C",
        "accent_color": "rgba(44,62,140,0.15)",
        "tags": ["Sports Bar", "American Street Food", "Craft Beer", "Live Sports"],
        "hero_image": "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=2400",
        "card_image": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=800",
        "signature_dishes": [
            {"name": "The Harlem Smash Burger", "desc": "Double smash patty 80/20 beef chuck, American cheese, special sauce Lounge, pickles, onion, dalam brioche bun homemade yang di-toast butter.", "price": "Rp 145.000"},
            {"name": "Lounge Wings (12 pcs)", "desc": "Wings ayam kampung goreng crispy, pilih saus: Buffalo Classic, Korean Honey Garlic, Ghost Pepper, atau BBQ Bourbon.", "price": "Rp 155.000"},
            {"name": "Dirty Loaded Fries", "desc": "Fries crispy dengan pulled beef smoked 8 jam, cheddar sauce, jalapeño, crispy onion, dan ranch drizzle.", "price": "Rp 115.000"},
        ],
        "established": "2019",
        "status": "published",
        "instagram": "@thelounge.bdg",
        "instagram_username": "thelounge.bdg",
        "website": "https://thelounge.fnbgroup.id",
        "awards": ["Best Burger Bandung 2024 — Food Critic's Choice", "Best Sports Bar West Java 2023"],
        "atmosphere": "Energetic & Lively",
        "price_range": "Rp 100.000 – 250.000 / orang",
        "seating_capacity": 140,
        "dress_code": "Casual",
        "reservation_required": False,
        "publish_at": None,
        "unpublish_at": None,
        "seo_title": "The Lounge — Sports Bar & American Street Food Bandung",
        "seo_description": "Burger terbaik, wings epic, dan live sports di The Lounge Bandung. The ultimate hangout spot.",
        "seo_slug": "the-lounge",
        "workflow_status": "approved",
        "created_at": NOW(),
        "updated_at": NOW(),
        "deleted_at": None,
        "active": True,
    },
    {
        "id": uid(),
        "code": "the-bakery",
        "name": "The Bakery",
        "tagline": "Specialty Coffee & Artisan Bakery",
        "short_desc": "The Bakery adalah persimpangan antara keahlian roasting kopi single origin Nusantara dan seni pembuatan roti artisan yang penuh cinta dan kesabaran.",
        "story": "The Bakery dimulai dari sebuah obsesi kecil: bagaimana membuat secangkir kopi dan sepotong roti menjadi pengalaman yang benar-benar berarti di tengah keseharian yang sibuk.\n\nKopi kami bersumber dari petani-petani pilihan di Aceh Gayo, Toraja, Flores Ende, dan Kintamani Bali — masing-masing dengan profil rasa yang unik dan telah melalui seleksi ketat di cupping table kami. Kami me-roast in-house setiap minggu untuk memastikan kesegaran optimal, kemudian menyeduh dengan metode yang sesuai: espresso, V60 pour-over, Aeropress, hingga syphon.\n\nDapur bakery kami mulai bekerja pukul 03.00 setiap paginya: sourdough starter yang telah kami rawat selama 3 tahun, croissant dengan 72 lapis butter yang di-laminate dengan sabar, kouign-amann yang karamelnya harum hingga ke ujung jalan. The Bakery bukan sekadar kafe — ia adalah komitmen pada kesempurnaan dalam hal-hal kecil yang membuat hari lebih baik.",
        "color": "#3D2B1F",
        "accent_color": "rgba(61,43,31,0.12)",
        "tags": ["Specialty Coffee", "Artisan Bakery", "Roastery", "Work-Friendly"],
        "hero_image": "https://images.unsplash.com/photo-1509440159596-0249088772ff?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=2400",
        "card_image": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=800",
        "signature_dishes": [
            {"name": "Single Origin Pour-Over", "desc": "V60 pour-over dengan biji kopi single origin pilihan (Aceh Gayo / Toraja / Flores) — tasting notes lengkap tersedia di menu.", "price": "Rp 65.000"},
            {"name": "Croissant Beurre", "desc": "Croissant klasik dengan 72 lapis butter Fonterra, di-bake segar setiap pagi. Tersedia plain, almond, atau ham & cheese.", "price": "Rp 55.000"},
            {"name": "The Bakery Sourdough Toast", "desc": "Slice tebal sourdough 3-hari dari starter 3 tahun, di-toast kecokelatan, dengan pilihan topping: avocado & feta, ricotta & honey, atau butter & jam homemade.", "price": "Rp 85.000"},
        ],
        "established": "2020",
        "status": "published",
        "instagram": "@the-bakery.id",
        "instagram_username": "the-bakery.id",
        "website": "https://the-bakery.fnbgroup.id",
        "awards": ["Best Specialty Coffee Bandung 2025 — Bandung Coffee Awards", "Best Artisan Bakery West Java 2024"],
        "atmosphere": "Warm & Focused",
        "price_range": "Rp 50.000 – 150.000 / orang",
        "seating_capacity": 55,
        "dress_code": "Casual",
        "reservation_required": False,
        "publish_at": None,
        "unpublish_at": None,
        "seo_title": "The Bakery — Specialty Coffee & Artisan Bakery Bandung",
        "seo_description": "Kopi single origin Nusantara dan roti artisan terbaik di Bandung. The Bakery hadir untuk membuat hari Anda lebih baik.",
        "seo_slug": "the-bakery",
        "workflow_status": "approved",
        "created_at": NOW(),
        "updated_at": NOW(),
        "deleted_at": None,
        "active": True,
    },
]

# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC OUTLETS — rich content per outlet
# ─────────────────────────────────────────────────────────────────────────────
PUBLIC_OUTLETS_DATA = [
    # THE COFFEESHOP outlets
    {
        "brand_code": "the-coffeeshop",
        "name": "The Coffeeshop Dago",
        "area": "Dago",
        "address": "Jl. Ir. H. Djuanda No. 28A, Dago, Bandung 40135",
        "lat": -6.8945, "lng": 107.6066,
        "phone": "+62-22-250-7890",
        "whatsapp": "628112207890",
        "hours_weekday": "11:00 – 22:30",
        "hours_weekend": "10:00 – 23:00",
        "image": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800",
        "features": ["Reservasi Tersedia", "Private Dining Room", "Wine Bar", "Outdoor Terrace"],
        "maps_url": "https://maps.google.com/?q=The Coffeeshop+Dago+Bandung",
        "ig_tag": "#TheCoffeeshopDago",
    },
    {
        "brand_code": "the-coffeeshop",
        "name": "The Coffeeshop Setiabudi",
        "area": "Setiabudi",
        "address": "Jl. Setiabudi No. 45, Bandung 40143",
        "lat": -6.8800, "lng": 107.5955,
        "phone": "+62-22-203-1122",
        "whatsapp": "628112203112",
        "hours_weekday": "11:30 – 22:00",
        "hours_weekend": "11:00 – 22:30",
        "image": "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800",
        "features": ["Reservasi Tersedia", "Business Dinner", "Wine List", "Valet Parking"],
        "maps_url": "https://maps.google.com/?q=The Coffeeshop+Setiabudi+Bandung",
        "ig_tag": "#TheCoffeeshopSetiabudi",
    },
    # THE RESTAURANT
    {
        "brand_code": "the-restaurant",
        "name": "The Restaurant Riau",
        "area": "Jl. Riau",
        "address": "Jl. RE. Martadinata No. 17, Bandung 40114",
        "lat": -6.9119, "lng": 107.6283,
        "phone": "+62-22-423-5566",
        "whatsapp": "628122235566",
        "hours_weekday": "12:00 – 23:00",
        "hours_weekend": "11:00 – 00:00",
        "image": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800",
        "features": ["Walk-in Welcome", "Tapas Bar", "Wine Selection", "Happy Hour 15:00–18:00"],
        "maps_url": "https://maps.google.com/?q=De+La+Sol+Riau+Bandung",
        "ig_tag": "#TheRestaurantRiau",
    },
    {
        "brand_code": "the-restaurant",
        "name": "The Restaurant Kemang BDG",
        "area": "Buah Batu",
        "address": "Jl. Buah Batu No. 166, Bandung 40264",
        "lat": -6.9386, "lng": 107.6375,
        "phone": "+62-22-731-4455",
        "whatsapp": "628122314455",
        "hours_weekday": "12:00 – 22:30",
        "hours_weekend": "11:30 – 23:30",
        "image": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800",
        "features": ["Walk-in Welcome", "Live Music Weekends", "Rooftop Seating", "Cocktail Bar"],
        "maps_url": "https://maps.google.com/?q=De+La+Sol+Buah+Batu+Bandung",
        "ig_tag": "#TheRestaurantBuahBatu",
    },
    # THE BISTRO
    {
        "brand_code": "the-bistro",
        "name": "The Bistro Braga",
        "area": "Braga",
        "address": "Jl. Braga No. 87, Bandung 40111",
        "lat": -6.9175, "lng": 107.6082,
        "phone": "+62-22-423-7788",
        "whatsapp": "628112427788",
        "hours_weekday": "07:00 – 21:00",
        "hours_weekend": "07:00 – 22:00",
        "image": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800",
        "features": ["Walk-in Welcome", "All-Day Brunch", "Work Space Available", "Dog Friendly"],
        "maps_url": "https://maps.google.com/?q=The Bistro+Braga+Bandung",
        "ig_tag": "#TheBistroBraga",
    },
    # THE LOUNGE
    {
        "brand_code": "the-lounge",
        "name": "The Lounge Cihampelas",
        "area": "Cihampelas",
        "address": "Jl. Cihampelas No. 88, Bandung 40131",
        "lat": -6.8977, "lng": 107.5998,
        "phone": "+62-22-204-3344",
        "whatsapp": "628112043344",
        "hours_weekday": "15:00 – 00:00",
        "hours_weekend": "12:00 – 01:00",
        "image": "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=800",
        "features": ["Walk-in Welcome", "8 Large Screens", "Draft Beer", "Live Sports Everyday"],
        "maps_url": "https://maps.google.com/?q=Lounge+Park+Cihampelas+Bandung",
        "ig_tag": "#TheLoungeBdg",
    },
    # THE BAKERY
    {
        "brand_code": "the-bakery",
        "name": "The Bakery Riau Street",
        "area": "Jl. Riau",
        "address": "Jl. RE. Martadinata No. 55, Bandung 40114",
        "lat": -6.9130, "lng": 107.6295,
        "phone": "+62-22-423-1122",
        "whatsapp": "628112431122",
        "hours_weekday": "07:00 – 20:00",
        "hours_weekend": "07:00 – 21:00",
        "image": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800",
        "features": ["Walk-in Welcome", "In-house Roastery", "Specialty Beans Available", "Work Space"],
        "maps_url": "https://maps.google.com/?q=The Bakery+Riau+Bandung",
        "ig_tag": "#TheBakeryRiau",
    },
    {
        "brand_code": "the-bakery",
        "name": "The Bakery Dago Atas",
        "area": "Dago Atas",
        "address": "Jl. Dago Atas No. 12, Bandung 40135",
        "lat": -6.8700, "lng": 107.6100,
        "phone": "+62-22-250-4433",
        "whatsapp": "628112504433",
        "hours_weekday": "07:30 – 20:30",
        "hours_weekend": "07:00 – 21:30",
        "image": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800",
        "features": ["Walk-in Welcome", "Bakery Takeaway", "Scenic View", "Morning Deals"],
        "maps_url": "https://maps.google.com/?q=The Bakery+Dago+Atas+Bandung",
        "ig_tag": "#TheBakeryDago",
    },
]

# ─────────────────────────────────────────────────────────────────────────────
# INSTAGRAM POSTS — sample posts per brand
# ─────────────────────────────────────────────────────────────────────────────
IG_POSTS_DATA = {
    "the-coffeeshop": [
        {
            "caption": "Ketika rendang bertemu teknik sous-vide 72 jam. Rendang Wagyu Confit kami — rempah Minang yang autentik, presisi memasak yang modern. ✨\n\n#TheCoffeeshop #ModernIndonesian #Bandung #Finedining #Rendang #WagyuBeef",
            "image_url": "https://images.unsplash.com/photo-1574484284002-952d92456975?w=800",
            "thumbnail_url": "https://images.unsplash.com/photo-1574484284002-952d92456975?w=400",
            "likes": 847, "comments": 43, "post_type": "photo",
            "post_url": "https://www.instagram.com/p/the-coffeeshop_rendang/",
            "is_pinned": True, "days_ago": 2,
        },
        {
            "caption": "Sunday brunch vibes at The Coffeeshop Dago 🌿 Meja tamu kami selalu siap untuk pertemuan yang bermakna, entah itu keluarga, kolega, atau momen introspeksi bersama secangkir teh.\n\n#TheCoffeeshop #DiningSunday #Bandung #BrunchBDG",
            "image_url": "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800",
            "thumbnail_url": "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400",
            "likes": 612, "comments": 28, "post_type": "photo",
            "post_url": "https://www.instagram.com/p/the-coffeeshop_brunch/",
            "is_pinned": False, "days_ago": 5,
        },
        {
            "caption": "Soto Betawi Bisque — ketika warisan kuliner Jakarta bertemu estetika bistro modern. Kaldu bening yang pekat, foam santan yang lembut, crispy tripe yang renyah. 🍲\n\n#TheCoffeeshop #SotoBetawi #FusionFood #ChefSpecial",
            "image_url": "https://images.unsplash.com/photo-1547592180-85f173990554?w=800",
            "thumbnail_url": "https://images.unsplash.com/photo-1547592180-85f173990554?w=400",
            "likes": 934, "comments": 67, "post_type": "photo",
            "post_url": "https://www.instagram.com/p/the-coffeeshop_soto/",
            "is_pinned": False, "days_ago": 12,
        },
        {
            "caption": "Private dining room kami tersedia untuk momen-momen yang layak dirayakan. Ulang tahun, anniversary, business dinner — kami siapkan semuanya. DM untuk booking.\n\n#TheCoffeeshop #PrivateDining #Bandung #EventDining",
            "image_url": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800",
            "thumbnail_url": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400",
            "likes": 523, "comments": 19, "post_type": "photo",
            "post_url": "https://www.instagram.com/p/the-coffeeshop_private/",
            "is_pinned": False, "days_ago": 18,
        },
        {
            "caption": "New on menu: Pisang Goreng Soufflé. Kenangan masa kecil, disajikan ulang dengan teknik patisserie. Hangat di dalam, crispy di luar, nostalgia di setiap suap. 🍌✨\n\n#TheCoffeeshop #NewDish #Dessert #PisangGoreng",
            "image_url": "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800",
            "thumbnail_url": "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400",
            "likes": 1243, "comments": 89, "post_type": "photo",
            "post_url": "https://www.instagram.com/p/the-coffeeshop_dessert/",
            "is_pinned": False, "days_ago": 25,
        },
        {
            "caption": "Farm to table bukan sekadar tagline. Setiap Selasa pagi, kami kunjungi petani mitra di Lembang untuk memilih langsung sayuran dan herbs untuk menu minggu ini. 🌱\n\n#TheCoffeeshop #FarmToTable #Sustainable #LocalIngredient",
            "image_url": "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800",
            "thumbnail_url": "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400",
            "likes": 768, "comments": 34, "post_type": "photo",
            "post_url": "https://www.instagram.com/p/the-coffeeshop_farm/",
            "is_pinned": False, "days_ago": 32,
        },
    ],
    "the-restaurant": [
        {
            "caption": "Paella Negra — hitam pekat, harum laut, dramatis di panggung. Dimasak dalam paellera besi asli, untuk dua orang yang berani merayakan. 🦑🖤\n\n#TheRestaurant #Paella #Mediterranean #BandungEats",
            "image_url": "https://images.unsplash.com/photo-1534080564583-6be75777b70a?w=800",
            "thumbnail_url": "https://images.unsplash.com/photo-1534080564583-6be75777b70a?w=400",
            "likes": 1102, "comments": 78, "post_type": "photo",
            "post_url": "https://www.instagram.com/p/delasol_paella/",
            "is_pinned": True, "days_ago": 3,
        },
        {
            "caption": "Happy Hour every day 15:00–18:00. House wine mulai dari Rp 75.000 per gelas, tapas pilihan diskon 30%. Akhir hari yang layak dirayakan. 🍷\n\n#TheRestaurant #HappyHour #Wine #Tapas",
            "image_url": "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800",
            "thumbnail_url": "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400",
            "likes": 843, "comments": 52, "post_type": "photo",
            "post_url": "https://www.instagram.com/p/delasol_happyhour/",
            "is_pinned": False, "days_ago": 7,
        },
        {
            "caption": "Gambas al Ajillo — udang segar, minyak zaitun extra virgin, bawang putih berlimpah, cabai merah, white wine. Sesederhana itu, senikmat itu. 🍤\n\n#TheRestaurant #Gambas #Tapas #SpanishFood",
            "image_url": "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800",
            "thumbnail_url": "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400",
            "likes": 967, "comments": 45, "post_type": "photo",
            "post_url": "https://www.instagram.com/p/delasol_gambas/",
            "is_pinned": False, "days_ago": 14,
        },
        {
            "caption": "Rooftop The Restaurant Buah Batu — tempat terbaik untuk menunggu senja di Bandung. Live acoustic every Friday & Saturday night. Reservasi via link di bio. 🌅\n\n#TheRestaurant #Rooftop #Bandung #LiveMusic",
            "image_url": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800",
            "thumbnail_url": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400",
            "likes": 1567, "comments": 93, "post_type": "photo",
            "post_url": "https://www.instagram.com/p/delasol_rooftop/",
            "is_pinned": False, "days_ago": 21,
        },
        {
            "caption": "Burrata yang selalu membuat kami jatuh cinta lagi dan lagi. Creamy di dalam, fresh di luar, dengan tomat heirloom Lembang yang manis-asam sempurna. 🍅\n\n#TheRestaurant #Burrata #Caprese #Italian",
            "image_url": "https://images.unsplash.com/photo-1464219789935-c2d9d9aba644?w=800",
            "thumbnail_url": "https://images.unsplash.com/photo-1464219789935-c2d9d9aba644?w=400",
            "likes": 889, "comments": 41, "post_type": "photo",
            "post_url": "https://www.instagram.com/p/delasol_burrata/",
            "is_pinned": False, "days_ago": 28,
        },
        {
            "caption": "Group gathering? Corporate event? Kami punya private space untuk 20-50 orang dengan menu tapas set yang bisa dikustomisasi. Hubungi kami untuk penawaran.\n\n#TheRestaurant #EventBDG #CorporateDining",
            "image_url": "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800",
            "thumbnail_url": "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400",
            "likes": 456, "comments": 22, "post_type": "photo",
            "post_url": "https://www.instagram.com/p/delasol_event/",
            "is_pinned": False, "days_ago": 35,
        },
    ],
    "the-bistro": [
        {
            "caption": "Eggs Benedict Saumon — kami cured salmonnya sendiri selama 48 jam. Karena kebaikan terbaik selalu membutuhkan waktu. 🍳✨\n\n#TheBistro #EggsBenedict #BrunchBDG #AllDayCafe",
            "image_url": "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=800",
            "thumbnail_url": "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=400",
            "likes": 1034, "comments": 67, "post_type": "photo",
            "post_url": "https://www.instagram.com/p/the-bistro_eggs/",
            "is_pinned": True, "days_ago": 1,
        },
        {
            "caption": "Pagi yang ideal: sourdough toast, avocado feta, dan pour-over single origin Toraja. Tidak ada yang lebih kamu butuhkan. ☀️\n\n#TheBistro #MorningRitual #SpecialtyCoffee #Sourdough",
            "image_url": "https://images.unsplash.com/photo-1497515114629-f71d768fd07c?w=800",
            "thumbnail_url": "https://images.unsplash.com/photo-1497515114629-f71d768fd07c?w=400",
            "likes": 1289, "comments": 84, "post_type": "photo",
            "post_url": "https://www.instagram.com/p/the-bistro_morning/",
            "is_pinned": False, "days_ago": 6,
        },
        {
            "caption": "Ricotta pancakes kami dibuat fresh setiap pagi dengan ricotta homemade. Blueberry compote dari buah segar, lemon curd yang tajam, maple syrup Vermont yang kaya. 🫐\n\n#TheBistro #Pancakes #Brunch #HomemadeGoodness",
            "image_url": "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800",
            "thumbnail_url": "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400",
            "likes": 1567, "comments": 112, "post_type": "photo",
            "post_url": "https://www.instagram.com/p/the-bistro_pancakes/",
            "is_pinned": False, "days_ago": 10,
        },
        {
            "caption": "Starter starter kami, si old bread: sourdough yang lahir 3 tahun lalu dan masih kami rawat setiap hari. Tanpa dia, tidak ada The Bistro. 🍞\n\n#TheBistro #Sourdough #ArtisanBread #BreadBaking",
            "image_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800",
            "thumbnail_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400",
            "likes": 923, "comments": 56, "post_type": "photo",
            "post_url": "https://www.instagram.com/p/the-bistro_sourdough/",
            "is_pinned": False, "days_ago": 16,
        },
        {
            "caption": "New special: Nasi Goreng Truffle. Masakan rumahan favorit, diangkat ke level yang lebih tinggi dengan truffle oil Périgord dan telur onsen dari peternak Lembang. 🍳\n\n#TheBistro #NasiGoreng #Truffle #FusionBrunch",
            "image_url": "https://images.unsplash.com/photo-1588137378633-dea1336ce1e2?w=800",
            "thumbnail_url": "https://images.unsplash.com/photo-1588137378633-dea1336ce1e2?w=400",
            "likes": 1788, "comments": 134, "post_type": "photo",
            "post_url": "https://www.instagram.com/p/the-bistro_nasgortruffle/",
            "is_pinned": False, "days_ago": 22,
        },
        {
            "caption": "The Bistro Braga — sudut favorit kami setelah hujan turun. Dog friendly, wi-fi kencang, dan kopi yang selalu panas. Duduklah selama yang kamu mau. 🐕☕\n\n#TheBistro #DogFriendly #CafeVibes #BragaBandung",
            "image_url": "https://images.unsplash.com/photo-1493857671505-72967e2e2760?w=800",
            "thumbnail_url": "https://images.unsplash.com/photo-1493857671505-72967e2e2760?w=400",
            "likes": 2103, "comments": 178, "post_type": "photo",
            "post_url": "https://www.instagram.com/p/the-bistro_vibes/",
            "is_pinned": False, "days_ago": 30,
        },
    ],
    "the-lounge": [
        {
            "caption": "GAME NIGHT IS ON 🏀 NBA Playoffs di semua layar, Lounge wings unlimited, draft beer mulai dari Rp 45.000. Let's gooooo.\n\n#TheLounge #NBAPlayoffs #SportBar #BandungNightlife",
            "image_url": "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800",
            "thumbnail_url": "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400",
            "likes": 2341, "comments": 198, "post_type": "photo",
            "post_url": "https://www.instagram.com/p/lounge_nba/",
            "is_pinned": True, "days_ago": 1,
        },
        {
            "caption": "The Harlem Smash Burger — dua patty 80/20 yang dismash di flat-top grill panas, American cheese melted sempurna, special sauce kami, pickles, dalam brioche bun homemade. Ini bukan burger biasa. 🍔\n\n#TheLounge #SmashBurger #Bandung #BurgerLovers",
            "image_url": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800",
            "thumbnail_url": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400",
            "likes": 3102, "comments": 234, "post_type": "photo",
            "post_url": "https://www.instagram.com/p/lounge_burger/",
            "is_pinned": False, "days_ago": 4,
        },
        {
            "caption": "Ghost Pepper Wings challenge — apakah kamu cukup berani? 🌶️🔥 Selesaikan 24 pcs dalam 10 menit dan makan gratis. Banyak yang sudah coba, sedikit yang berhasil.\n\n#TheLounge #WingsChallenge #SpicyFood #BdgChallenge",
            "image_url": "https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=800",
            "thumbnail_url": "https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=400",
            "likes": 4567, "comments": 389, "post_type": "photo",
            "post_url": "https://www.instagram.com/p/lounge_challenge/",
            "is_pinned": False, "days_ago": 8,
        },
        {
            "caption": "Dirty Loaded Fries — pulled beef yang di-smoke 8 jam, cheddar sauce homemade, jalapeños fresh, crispy onion, dan ranch drizzle. Ini bukan side dish. Ini adalah experience. 🍟\n\n#TheLounge #LoadedFries #PulledBeef #Comfort",
            "image_url": "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=800",
            "thumbnail_url": "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400",
            "likes": 1876, "comments": 145, "post_type": "photo",
            "post_url": "https://www.instagram.com/p/lounge_fries/",
            "is_pinned": False, "days_ago": 15,
        },
        {
            "caption": "UFC Fight Night di The Lounge 🥊 Satu-satunya tempat di Bandung dengan full-size projection screen untuk UFC. Book table early, selalu sold out!\n\n#TheLounge #UFC #FightNight #SportBar",
            "image_url": "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=800",
            "thumbnail_url": "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=400",
            "likes": 2890, "comments": 267, "post_type": "photo",
            "post_url": "https://www.instagram.com/p/lounge_ufc/",
            "is_pinned": False, "days_ago": 20,
        },
        {
            "caption": "Craft beer selection terbaru kami: 6 taps, 3 local brewery (Bali Hai Craft, Prost, Stark), 3 imported. Selalu berputar, selalu segar. Tanya bartender kami apa yang tap-nya on hari ini! 🍺\n\n#TheLounge #CraftBeer #DraftBeer #BeerLovers",
            "image_url": "https://images.unsplash.com/photo-1608270586620-248524c67de9?w=800",
            "thumbnail_url": "https://images.unsplash.com/photo-1608270586620-248524c67de9?w=400",
            "likes": 1234, "comments": 89, "post_type": "photo",
            "post_url": "https://www.instagram.com/p/lounge_beer/",
            "is_pinned": False, "days_ago": 27,
        },
    ],
    "the-bakery": [
        {
            "caption": "Croissant fresh dari oven jam 6 pagi — 72 lapis butter yang butuh 3 hari untuk di-laminate. Tidak ada jalan pintas untuk kebaikan sejati. 🥐✨\n\n#TheBakery #Croissant #ArtisanBakery #BandungBakery",
            "image_url": "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800",
            "thumbnail_url": "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400",
            "likes": 2345, "comments": 167, "post_type": "photo",
            "post_url": "https://www.instagram.com/p/the-bakery_croissant/",
            "is_pinned": True, "days_ago": 2,
        },
        {
            "caption": "New beans in: Flores Bajawa Natural Process. Tasting notes: dark chocolate, raisins, brown sugar, medium body. Tersedia untuk V60, Aeropress, dan retail bag 200gr. ☕\n\n#TheBakery #SpecialtyCoffee #FloresCoffee #SingleOrigin",
            "image_url": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800",
            "thumbnail_url": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400",
            "likes": 1678, "comments": 123, "post_type": "photo",
            "post_url": "https://www.instagram.com/p/the-bakery_flores/",
            "is_pinned": False, "days_ago": 5,
        },
        {
            "caption": "Pukul 03:30. Dapur mulai menyala. Adonan sourdough yang sudah fermentasi semalam masuk oven. Empat jam lagi, kamu bisa merasakannya. 🌙🍞\n\n#TheBakery #BehindTheScenes #EarlyMorning #SourdoughLife",
            "image_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800",
            "thumbnail_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400",
            "likes": 3456, "comments": 234, "post_type": "photo",
            "post_url": "https://www.instagram.com/p/the-bakery_morning/",
            "is_pinned": False, "days_ago": 9,
        },
        {
            "caption": "Kouign-Amann hari ini — caramel yang terbentuk sempurna di tepinya, berlapis-lapis butter dan gula, crispy di luar dan fluffy di dalam. Stock terbatas, biasanya habis sebelum jam 10. 🍮\n\n#TheBakery #KouignAmann #BretonnePastry #Bandung",
            "image_url": "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800",
            "thumbnail_url": "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400",
            "likes": 2890, "comments": 198, "post_type": "photo",
            "post_url": "https://www.instagram.com/p/the-bakery_kouign/",
            "is_pinned": False, "days_ago": 13,
        },
        {
            "caption": "Cupping session every Saturday 10:00 WIB — gratis untuk siapapun. Kami akan guide kamu untuk merasakan perbedaan antara washed, natural, dan honey process. Tempat terbatas, DM untuk registrasi. ☕🎓\n\n#TheBakery #CuppingSession #CoffeeEducation #SpecialtyCoffee",
            "image_url": "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800",
            "thumbnail_url": "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=400",
            "likes": 1234, "comments": 89, "post_type": "photo",
            "post_url": "https://www.instagram.com/p/the-bakery_cupping/",
            "is_pinned": False, "days_ago": 19,
        },
        {
            "caption": "Whole bean bags tersedia untuk dibawa pulang — 200gr Rp 120.000, 500gr Rp 280.000. Pilihan origin: Aceh Gayo, Toraja Sapan, Flores Bajawa, Kintamani Bali. Gratis grind on-site. 🫘\n\n#TheBakery #CoffeeBeans #RetailCoffee #TakeHome",
            "image_url": "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800",
            "thumbnail_url": "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=400",
            "likes": 987, "comments": 67, "post_type": "photo",
            "post_url": "https://www.instagram.com/p/the-bakery_beans/",
            "is_pinned": False, "days_ago": 25,
        },
    ],
}


async def seed_public_brands(db):
    print("Seeding public_brands...")
    await db.public_brands.delete_many({})
    await db.public_brands.insert_many(PUBLIC_BRANDS)
    print(f"  → {len(PUBLIC_BRANDS)} brands seeded")
    return {b["code"]: b["id"] for b in PUBLIC_BRANDS}


async def seed_public_outlets(db, brand_id_map: dict):
    print("Seeding public_outlets...")
    await db.public_outlets.delete_many({})

    outlets = []
    for outlet_data in PUBLIC_OUTLETS_DATA:
        brand_code = outlet_data.pop("brand_code")
        brand_id = brand_id_map.get(brand_code)
        outlets.append({
            "id": uid(),
            "brand_id": brand_id,
            "brand_code": brand_code,
            "status": "published",
            "publish_at": None,
            "unpublish_at": None,
            "created_at": NOW(),
            "updated_at": NOW(),
            "deleted_at": None,
            "active": True,
            **outlet_data,
        })

    await db.public_outlets.insert_many(outlets)
    print(f"  → {len(outlets)} outlets seeded")


async def seed_instagram_posts(db, brand_id_map: dict):
    print("Seeding brand_instagram_posts...")
    await db.brand_instagram_posts.delete_many({})

    all_posts = []
    for brand_code, posts in IG_POSTS_DATA.items():
        brand_id = brand_id_map.get(brand_code)
        for post in posts:
            days = post.pop("days_ago", 10)
            all_posts.append({
                "id": uid(),
                "brand_id": brand_id,
                "brand_code": brand_code,
                "posted_at": days_ago(days),
                "created_at": NOW(),
                "updated_at": NOW(),
                "active": True,
                **post,
            })

    await db.brand_instagram_posts.insert_many(all_posts)
    print(f"  → {len(all_posts)} IG posts seeded across {len(IG_POSTS_DATA)} brands")


async def main():
    await init_db()
    db = get_db()
    print("\n🌐 Seeding public content for FnB Group website...\n")

    brand_id_map = await seed_public_brands(db)
    await seed_public_outlets(db, brand_id_map)
    await seed_instagram_posts(db, brand_id_map)

    print("\n📊 Final counts:")
    for coll in ["public_brands", "public_outlets", "brand_instagram_posts"]:
        count = await db[coll].count_documents({})
        print(f"  {coll}: {count}")

    await close_db()
    print("\n✅ Public content seed complete!")


if __name__ == "__main__":
    asyncio.run(main())
