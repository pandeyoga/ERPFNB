"""Seed demo E-Menu data: brand_menu_items, brand_menu_categories, brand_menu_pdfs.

Run: cd /app/backend && PYTHONPATH=/app/backend python seed/seed_emenu.py
"""
import asyncio
import uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

# Unsplash images for menu items (food photography)
IMAGES = {
    "coffee": [
        "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&q=80",
        "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&q=80",
        "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&q=80",
        "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=600&q=80",
    ],
    "pastry": [
        "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&q=80",
        "https://images.unsplash.com/photo-1509365465985-25d11c17e812?w=600&q=80",
        "https://images.unsplash.com/photo-1608198093002-ad4e005484ec?w=600&q=80",
    ],
    "food": [
        "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80",
        "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=600&q=80",
        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80",
        "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80",
        "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=600&q=80",
        "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&q=80",
    ],
    "drinks": [
        "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=600&q=80",
        "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600&q=80",
        "https://images.unsplash.com/photo-1536935338788-846bb9981813?w=600&q=80",
    ],
    "bread": [
        "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80",
        "https://images.unsplash.com/photo-1549931319-a545dcf3bc7c?w=600&q=80",
        "https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=600&q=80",
    ],
    "dessert": [
        "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600&q=80",
        "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=600&q=80",
        "https://images.unsplash.com/photo-1571115177098-24ec42ed204d?w=600&q=80",
    ],
    "burger": [
        "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80",
        "https://images.unsplash.com/photo-1586816001966-79b736744398?w=600&q=80",
    ],
    "latin": [
        "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&q=80",
        "https://images.unsplash.com/photo-1552332386-f8dd00dc2f85?w=600&q=80",
        "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&q=80",
    ],
}

_img_counters = {}
def next_img(category):
    imgs = IMAGES.get(category, IMAGES["food"])
    idx = _img_counters.get(category, 0) % len(imgs)
    _img_counters[category] = idx + 1
    return imgs[idx]


NOW = datetime.now(timezone.utc)


async def seed():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    # Get public_brands to get brand IDs
    brands_data = await db.public_brands.find({"deleted_at": None}).to_list(20)
    brands_map = {b["code"]: b for b in brands_data}

    if not brands_map:
        print("ERROR: No public brands found. Run seed_public_content.py first!")
        return

    print(f"Found brands: {list(brands_map.keys())}")

    # Clear existing demo data
    await db.brand_menu_items.delete_many({})
    await db.brand_menu_categories.delete_many({})
    await db.brand_menu_pdfs.delete_many({})
    print("Cleared existing E-Menu data")

    # =================== THE COFFEESHOP (Coffee & Brunch) ===================
    the_coffeeshop = brands_map.get("the-coffeeshop")
    if the_coffeeshop:
        bid = the_coffeeshop["id"]
        cats_the_coffeeshop = [
            ("Specialty Coffee", 1),
            ("Matcha & Tea", 2),
            ("Brunch", 3),
            ("Pastry", 4),
            ("Cold Drinks", 5),
        ]
        for name, order in cats_the_coffeeshop:
            await db.brand_menu_categories.insert_one({
                "id": str(uuid.uuid4()), "brand_id": bid,
                "name": name, "description": f"Category: {name}", "sort_order": order,
                "created_at": NOW, "deleted_at": None,
            })

        items_the_coffeeshop = [
            ("Signature Aeropress", "Specialty Coffee", 52000, "Single origin Flores AA, bright citrus finish", ["signature"], True, next_img("coffee"), True),
            ("Smoked Latte", "Specialty Coffee", 58000, "Smoked caramel, espresso double shot, whole milk froth", ["signature", "bestseller"], True, next_img("coffee"), False),
            ("Cold Brew Tonic", "Cold Drinks", 48000, "18-hour cold brew, Mediterranean tonic, lime zest", ["bestseller"], True, next_img("coffee"), False),
            ("Matcha Ceremonial", "Matcha & Tea", 55000, "Ceremonial grade matcha from Uji, Japan, oat milk foam", ["vegan", "vegetarian"], True, next_img("drinks"), False),
            ("Houjicha Latte", "Matcha & Tea", 50000, "Roasted Japanese green tea, almond milk, honey drizzle", ["vegetarian"], True, next_img("drinks"), False),
            ("Eggs Benedict The Coffeeshop", "Brunch", 95000, "Sourdough, poached eggs, hollandaise, smoked salmon", ["signature"], True, next_img("food"), True),
            ("Avocado Toast Deluxe", "Brunch", 85000, "House-baked sourdough, smashed avocado, cherry tomato, sesame", ["vegetarian", "vegan"], True, next_img("food"), False),
            ("Granola Bowl", "Brunch", 72000, "House granola, Greek yogurt, seasonal berries, honey", ["vegetarian", "gluten-free"], True, next_img("food"), False),
            ("Kouign-Amann", "Pastry", 45000, "Caramelized Breton butter cake, flaky layers", ["signature", "bestseller"], True, next_img("pastry"), True),
            ("Almond Croissant", "Pastry", 42000, "Twice-baked croissant, frangipane, toasted almonds", ["vegetarian"], True, next_img("pastry"), False),
            ("Pain au Chocolat", "Pastry", 38000, "Butter laminated dough, Valrhona dark chocolate", ["vegetarian"], True, next_img("pastry"), False),
            ("Berry Compote Galette", "Pastry", 48000, "Seasonal berry, brown butter galette, powdered sugar", ["vegetarian"], True, next_img("pastry"), False),
        ]

        for i, (name, cat, price, desc, tags, is_avail, img, featured) in enumerate(items_the_coffeeshop):
            await db.brand_menu_items.insert_one({
                "id": str(uuid.uuid4()), "brand_id": bid,
                "name": name, "description": desc, "price": price, "category": cat,
                "dietary_tags": tags, "image_url": img, "is_featured": featured,
                "is_available": is_avail, "sort_order": i,
                "created_at": NOW, "deleted_at": None,
            })
        print(f"  The Coffeeshop: {len(items_the_coffeeshop)} items seeded")

    # =================== THE BAKERY (Artisan Bakery) ===================
    the_bakery = brands_map.get("the-bakery")
    if the_bakery:
        bid = the_bakery["id"]
        cats = [("Sourdough & Breads", 1), ("Pastries & Viennoiserie", 2), ("Celebration Cakes", 3), ("Seasonal Specials", 4), ("Drinks", 5)]
        for name, order in cats:
            await db.brand_menu_categories.insert_one({
                "id": str(uuid.uuid4()), "brand_id": bid,
                "name": name, "description": f"Category: {name}", "sort_order": order,
                "created_at": NOW, "deleted_at": None,
            })

        items = [
            ("Country Sourdough", "Sourdough & Breads", 65000, "72-hour fermented, stone-milled wheat, crispy crust", ["vegan", "signature"], True, next_img("bread"), True),
            ("Focaccia di Giornata", "Sourdough & Breads", 55000, "Daily-changing toppings, extra-virgin olive oil, sea salt", ["vegan", "vegetarian"], True, next_img("bread"), False),
            ("Whole Wheat Batard", "Sourdough & Breads", 72000, "50% whole grain, nutty flavor, dense chewy crumb", ["vegan"], True, next_img("bread"), False),
            ("Butter Brioche Loaf", "Sourdough & Breads", 80000, "French butter, milk, eggs — pillowy enriched dough", ["vegetarian"], True, next_img("bread"), False),
            ("Croissant Pur Beurre", "Pastries & Viennoiserie", 45000, "AOP butter lamination, 32 layers, honeyed crust", ["vegetarian", "signature", "bestseller"], True, next_img("pastry"), True),
            ("Twice-Baked Pistachio", "Pastries & Viennoiserie", 52000, "Croissant filled with pistachio cream, roasted pistachios", ["vegetarian"], True, next_img("pastry"), False),
            ("Kouign-Amann Mini", "Pastries & Viennoiserie", 38000, "Individual caramelized butter cakes, flaky and rich", ["vegetarian"], True, next_img("pastry"), False),
            ("Seasonal Tart", "Seasonal Specials", 68000, "Monthly changing fruit tart, pastry cream, local produce", ["vegetarian", "signature"], True, next_img("dessert"), True),
            ("Opera Cake", "Celebration Cakes", 185000, "Coffee ganache + joconde sponge, 7-layer French classic", ["signature"], True, next_img("dessert"), False),
            ("Tarte Tatin", "Celebration Cakes", 145000, "Caramelized apple upside-down tart, crème fraîche", ["vegetarian"], True, next_img("dessert"), False),
            ("Single Origin Filter", "Drinks", 42000, "Weekly rotating single origin, pour-over style", ["vegan", "vegetarian"], True, next_img("coffee"), False),
        ]

        for i, (name, cat, price, desc, tags, is_avail, img, featured) in enumerate(items):
            await db.brand_menu_items.insert_one({
                "id": str(uuid.uuid4()), "brand_id": bid,
                "name": name, "description": desc, "price": price, "category": cat,
                "dietary_tags": tags, "image_url": img, "is_featured": featured,
                "is_available": is_avail, "sort_order": i,
                "created_at": NOW, "deleted_at": None,
            })
        print(f"  The Bakery: {len(items)} items seeded")

    # =================== THE BISTRO (European Bistro) ===================
    the_bistro = brands_map.get("the-bistro")
    if the_bistro:
        bid = the_bistro["id"]
        cats = [("Appetizers", 1), ("Soups & Salads", 2), ("Mains", 3), ("Pasta & Risotto", 4), ("Desserts", 5), ("Beverages", 6)]
        for name, order in cats:
            await db.brand_menu_categories.insert_one({
                "id": str(uuid.uuid4()), "brand_id": bid,
                "name": name, "description": f"Category: {name}", "sort_order": order,
                "created_at": NOW, "deleted_at": None,
            })

        items = [
            ("Burrata Caprese", "Appetizers", 125000, "Stracciatella burrata, heirloom tomatoes, basil oil, sea salt flakes", ["vegetarian", "signature"], True, next_img("food"), True),
            ("Duck Liver Parfait", "Appetizers", 115000, "Smooth duck liver parfait, brioche toast, cornichon, grape jelly", ["signature"], True, next_img("food"), False),
            ("Prawn Bisque", "Soups & Salads", 95000, "Slow-reduced prawn shell bisque, crème fraîche, chive oil", ["gluten-free"], True, next_img("food"), False),
            ("Nicoise Revisited", "Soups & Salads", 105000, "Seared tuna, haricots verts, quail egg, olive tapenade, Dijon", ["signature"], True, next_img("food"), False),
            ("Duck Confit", "Mains", 215000, "48-hour confit duck leg, pomme sarladaise, cherry jus", ["signature", "gluten-free"], True, next_img("food"), True),
            ("Pan-Seared Salmon", "Mains", 195000, "Scottish salmon, beurre blanc, asparagus, fennel salad", ["gluten-free"], True, next_img("food"), False),
            ("Braised Short Rib", "Mains", 235000, "18-hour red wine braised rib, celery root purée, gremolata", ["signature", "bestseller", "gluten-free"], True, next_img("food"), False),
            ("Tagliatelle al Ragu", "Pasta & Risotto", 155000, "Hand-rolled pasta, slow-cooked beef & pork ragù, Parmigiano", ["signature"], True, next_img("food"), True),
            ("Truffle Risotto", "Pasta & Risotto", 175000, "Carnaroli rice, black truffle, Parmigiano, 24-month Aceto", ["vegetarian", "signature"], True, next_img("food"), False),
            ("Crème Brûlée", "Desserts", 85000, "Tahitian vanilla bean custard, caramelized sugar crust", ["vegetarian", "gluten-free"], True, next_img("dessert"), False),
            ("Opera Cake", "Desserts", 95000, "Almond biscuit, coffee buttercream, dark chocolate ganache", ["vegetarian", "signature"], True, next_img("dessert"), True),
            ("Sparkling Water", "Beverages", 35000, "San Pellegrino 500ml", ["vegan", "vegetarian", "gluten-free"], True, next_img("drinks"), False),
        ]

        for i, (name, cat, price, desc, tags, is_avail, img, featured) in enumerate(items):
            await db.brand_menu_items.insert_one({
                "id": str(uuid.uuid4()), "brand_id": bid,
                "name": name, "description": desc, "price": price, "category": cat,
                "dietary_tags": tags, "image_url": img, "is_featured": featured,
                "is_available": is_avail, "sort_order": i,
                "created_at": NOW, "deleted_at": None,
            })
        print(f"  The Bistro: {len(items)} items seeded")

    # =================== THE RESTAURANT (Latin Kitchen) ===================
    delasol = brands_map.get("the-restaurant")
    if delasol:
        bid = delasol["id"]
        cats = [("Antojitos", 1), ("Tacos", 2), ("Latin Plates", 3), ("Sides", 4), ("Cocktails & Drinks", 5)]
        for name, order in cats:
            await db.brand_menu_categories.insert_one({
                "id": str(uuid.uuid4()), "brand_id": bid,
                "name": name, "description": f"Category: {name}", "sort_order": order,
                "created_at": NOW, "deleted_at": None,
            })

        items = [
            ("Guacamole de la Casa", "Antojitos", 65000, "Fresh avocado, lime, jalapeño, roasted tomato, tortilla chips", ["vegan", "gluten-free", "signature"], True, next_img("latin"), True),
            ("Ceviche Norteño", "Antojitos", 95000, "Sea bass, tiger's milk, corn, sweet potato, cilantro", ["gluten-free", "signature"], True, next_img("latin"), False),
            ("Quesadilla Funghi", "Antojitos", 75000, "Flour tortilla, mixed mushrooms, Oaxaca cheese, chipotle crema", ["vegetarian"], True, next_img("latin"), False),
            ("Taco Al Pastor", "Tacos", 42000, "Achiote pork, pineapple, onion, cilantro, corn tortilla", ["signature", "bestseller"], True, next_img("latin"), True),
            ("Taco de Camarón", "Tacos", 52000, "Grilled tiger prawns, cabbage slaw, chipotle mayo, lime", ["gluten-free", "signature"], True, next_img("latin"), False),
            ("Taco Vegetariano", "Tacos", 38000, "Roasted jackfruit, avocado, pico de gallo, corn tortilla", ["vegan", "vegetarian", "gluten-free"], True, next_img("latin"), False),
            ("Pollo en Mole Negro", "Latin Plates", 175000, "Slow-braised chicken, Oaxacan black mole, sesame, white rice", ["signature", "gluten-free"], True, next_img("latin"), True),
            ("Carnitas de Cerdo", "Latin Plates", 165000, "Citrus-braised pork, pickled jalapeño, refried beans, cilantro rice", ["gluten-free"], True, next_img("food"), False),
            ("Elotes Callejeros", "Sides", 35000, "Grilled corn, mayonesa, Cotija cheese, tajin, lime", ["vegetarian", "gluten-free"], True, next_img("food"), False),
            ("Arroz Verde", "Sides", 30000, "Cilantro-lime rice, roasted poblano, scallion", ["vegan", "gluten-free", "vegetarian"], True, next_img("food"), False),
            ("Agua de Jamaica", "Cocktails & Drinks", 38000, "Hibiscus flower iced tea, cane sugar, lime twist", ["vegan", "gluten-free"], True, next_img("drinks"), False),
            ("Margarita Clásica", "Cocktails & Drinks", 78000, "Blanco tequila, fresh lime, triple sec, Tajin rim", ["vegan", "signature"], True, next_img("drinks"), True),
        ]

        for i, (name, cat, price, desc, tags, is_avail, img, featured) in enumerate(items):
            await db.brand_menu_items.insert_one({
                "id": str(uuid.uuid4()), "brand_id": bid,
                "name": name, "description": desc, "price": price, "category": cat,
                "dietary_tags": tags, "image_url": img, "is_featured": featured,
                "is_available": is_avail, "sort_order": i,
                "created_at": NOW, "deleted_at": None,
            })
        print(f"  The Restaurant: {len(items)} items seeded")

    # =================== THE LOUNGE ===================
    lounge = brands_map.get("the-lounge")
    if lounge:
        bid = lounge["id"]
        cats = [("Starters", 1), ("Burgers & Sandwiches", 2), ("Mains", 3), ("Sides", 4), ("Drinks", 5)]
        for name, order in cats:
            await db.brand_menu_categories.insert_one({
                "id": str(uuid.uuid4()), "brand_id": bid,
                "name": name, "description": f"Category: {name}", "sort_order": order,
                "created_at": NOW, "deleted_at": None,
            })

        items = [
            ("Wings à la Lounge", "Starters", 88000, "Crispy chicken wings, choice of sauce: buffalo, honey garlic, dry rub", ["signature", "bestseller"], True, next_img("food"), True),
            ("Loaded Nachos", "Starters", 92000, "Tortilla chips, pulled pork, cheddar, jalapeño, sour cream, pico", ["signature"], True, next_img("food"), False),
            ("Smashed Double Smash", "Burgers & Sandwiches", 135000, "Two smashed beef patties, American cheese, special sauce, brioche bun", ["signature", "bestseller"], True, next_img("burger"), True),
            ("Crispy Chicken Sandwich", "Burgers & Sandwiches", 115000, "Buttermilk fried thigh, coleslaw, pickles, chipotle aioli", ["signature"], True, next_img("burger"), False),
            ("Veggie Smash Burger", "Burgers & Sandwiches", 105000, "Black bean & beet patty, vegan cheddar, lettuce, tomato", ["vegetarian", "vegan"], True, next_img("burger"), False),
            ("Ribeye Steak Frites", "Mains", 225000, "200g grain-fed ribeye, truffle fries, house salad, chimichurri", ["signature", "gluten-free"], True, next_img("food"), True),
            ("Spicy Ramen Bowl", "Mains", 115000, "Tonkotsu broth, chashu pork, soft egg, nori, bamboo shoots", ["bestseller"], True, next_img("food"), False),
            ("Truffle Fries", "Sides", 55000, "Hand-cut fries, black truffle oil, Parmigiano, fresh herbs", ["vegetarian"], True, next_img("food"), False),
            ("Caesar Salad", "Sides", 65000, "Romaine, anchovy dressing, ciabatta croutons, Parmigiano", ["vegetarian"], True, next_img("food"), False),
            ("Draft Beer", "Drinks", 65000, "Rotating local craft, ask staff for today's selection", ["vegan"], True, next_img("drinks"), False),
            ("Signature Lemonade", "Drinks", 42000, "Fresh lemon, rosemary syrup, sparkling water, cucumber", ["vegan", "vegetarian"], True, next_img("drinks"), False),
        ]

        for i, (name, cat, price, desc, tags, is_avail, img, featured) in enumerate(items):
            await db.brand_menu_items.insert_one({
                "id": str(uuid.uuid4()), "brand_id": bid,
                "name": name, "description": desc, "price": price, "category": cat,
                "dietary_tags": tags, "image_url": img, "is_featured": featured,
                "is_available": is_avail, "sort_order": i,
                "created_at": NOW, "deleted_at": None,
            })
        print(f"  The Lounge: {len(items)} items seeded")

    # Summary
    total_cats = await db.brand_menu_categories.count_documents({})
    total_items = await db.brand_menu_items.count_documents({})
    print("\n✅ E-Menu seed complete!")
    print(f"   Categories: {total_cats}")
    print(f"   Menu Items: {total_items}")
    print("   PDFs: 0 (use Admin CMS to upload)")

    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
