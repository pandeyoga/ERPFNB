from common import *
async def main():
    await setup()
    await db.daily_sales.insert_one({"id":"s1","outlet_id":"o1","sales_date":"2026-08-05","status":"validated","deleted_at":None,
        "revenue_buckets":[{"bucket":"food","amount":1_000_000}],"tax_amount":100_000,"grand_total":1_100_000})
    from services import procurement_service
    await procurement_service.post_gr({"vendor_id":"v1","outlet_id":"o1","receive_date":"2026-08-10","tax_rate":0.11,
        "lines":[{"item_id":"i1","qty_received":10,"unit_cost":100_000}]}, user=USER)
    from services import efaktur_service as ef
    p = await ef.preview_dataset("2026-08","all")
    print("e-Faktur preview: keluaran rows", len(p["keluaran"]), "| masukan rows", len(p["masukan"]))
    seqs = await db.system_settings.find({"key":{"$regex":"^EFAKTUR_SEQ"}}).to_list(10)
    print("faktur sequences after preview:", [(s["key"], s.get("seq")) for s in seqs])
    await db.daily_sales.update_one({"id":"s1"},{"$set":{"period":"2026-08","total_revenue":1_100_000,"total_tax":100_000}})
    p = await ef.preview_dataset("2026-08","keluaran")
    seqs = await db.system_settings.find({"key":{"$regex":"^EFAKTUR_SEQ"}}).to_list(10)
    print("after adding legacy fields -> rows", len(p["keluaran"]), "| seq consumed by preview:", [(s["key"], s.get("seq")) for s in seqs])
asyncio.run(main())
