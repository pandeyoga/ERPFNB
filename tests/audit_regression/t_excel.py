from common import *
def cells(wb): return [[c.value for c in r] for r in wb.active.iter_rows()]
async def main():
    await setup()
    from services import procurement_service
    po = await procurement_service.create_po({"vendor_id":"v1","outlet_id":"o1","order_date":"2026-08-01","lines":[{"item_id":"i1","qty":10,"unit_cost":1000}]}, user=USER)
    await procurement_service.post_gr({"po_id":po["id"],"vendor_id":"v1","outlet_id":"o1","receive_date":"2026-08-02","lines":[{"item_id":"i1","qty_received":10,"unit_cost":1000}]}, user=USER)
    await db.items.insert_one({"id":"i1","name":"Kopi","code":"K1","deleted_at":None})
    import services.reports_excel_procurement_service as rp, services.reports_excel_inventory_service as ri
    import inspect
    wb = await rp.generate_po_summary_excel() if hasattr(rp,"generate_po_summary_excel") else None
    names=[n for n,_ in inspect.getmembers(rp, inspect.iscoroutinefunction)]; print("procurement fns:", names)
    for n in names:
        if "po" in n and "summary" in n:
            wb = await getattr(rp,n)(); print(n, "data rows:", [r for r in cells(wb) if r and r[2]=="v1" or (r and r[0]=="" and r[3]=="TOTAL")][:3] or [r for r in cells(wb)][-3:])
        if "gr" in n and "summary" in n:
            wb = await getattr(rp,n)(); print(n, "last rows:", cells(wb)[-3:])
    inames=[n for n,_ in inspect.getmembers(ri, inspect.iscoroutinefunction)]; print("inventory fns:", inames)
    for n in inames:
        if "balance" in n:
            wb = await getattr(ri,n)(); print(n, "rows:", cells(wb)[-3:])
asyncio.run(main())
