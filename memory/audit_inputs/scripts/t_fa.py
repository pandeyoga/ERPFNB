from common import *
async def main():
    await setup()
    from services import fixed_asset_service as fa
    await db.fixed_assets.insert_one({"id":"a1","name":"Oven","asset_code":"FA1","status":"active","purchase_cost":12_000_000,"current_cost":12_000_000,
        "salvage_value":0,"useful_life_years":1,"dep_method":"straight_line","book_value":12_000_000,"accumulated_dep":0,"purchase_date":"2026-01-01",
        "coa_dep_exp_id":"coa-cogs","coa_accum_dep_id":"coa-inventory","deleted_at":None})
    for p in ["2026-01","2026-02","2026-03"]:
        await fa.post_depreciation("a1", p, user_id="u-admin")
    a = await db.fixed_assets.find_one({"id":"a1"})
    jes = await db.journal_entries.find({"source_type":"fixed_asset_dep"}).to_list(10)
    print("asset accumulated_dep:", a.get("accumulated_dep"), "| GL dep JEs:", len(jes), "periods:", [j["period"] for j in jes])
asyncio.run(main())
