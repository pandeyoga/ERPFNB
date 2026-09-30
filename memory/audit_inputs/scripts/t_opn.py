from common import *
async def main():
    await setup()
    from services import inventory_service
    await db.inventory_movements.insert_one({"id":"m1","item_id":"i5","outlet_id":"o1","qty":100,"unit_cost":10,"movement_date":"2026-08-01","deleted_at":None})
    s = await inventory_service.start_opname({"outlet_id":"o1"}, user=USER)
    await db.inventory_movements.insert_one({"id":"m2","item_id":"i5","outlet_id":"o1","qty":50,"unit_cost":10,"movement_date":"2026-08-02","deleted_at":None})
    await inventory_service.update_opname_lines(s["id"], [{"item_id":"i5","counted_qty":150}], user=USER)
    # 1st submit fails at JE (mapping missing) -> retry after fixing mapping
    try: await inventory_service.submit_opname(s["id"], user=USER)
    except Exception as e: print("1st submit failed:", e)
    m = (await db.system_settings.find_one({"key":"gl_mapping"}))["value"]; m["adjustment_income"]="coa-cogs"; m["adjustment_expense"]="coa-cogs"
    await db.system_settings.update_one({"key":"gl_mapping"},{"$set":{"value":m}})
    import services.gl_mapping as gm; gm.invalidate_cache()
    await inventory_service.submit_opname(s["id"], user=USER)
    bal,_ = await inventory_service.stock_balance(item_id="i5", outlet_id="o1")
    print("Physical=150; system on-hand after retry:", bal[0]["qty"])
asyncio.run(main())
