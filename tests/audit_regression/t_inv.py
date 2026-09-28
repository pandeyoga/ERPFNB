from common import *
async def main():
    await setup()
    from services import procurement_service, inventory_service
    from services._finance import reports
    po = await procurement_service.create_po({"vendor_id":"v1","outlet_id":"o1","lines":[{"item_id":"i1","qty":10,"unit_cost":1000}]}, user=USER)
    await procurement_service.cancel_po(po["id"], user=USER, reason="x")
    gr = await procurement_service.post_gr({"po_id":po["id"],"vendor_id":"v2","outlet_id":"o2","receive_date":"2026-08-10",
        "lines":[{"item_id":"i1","qty_received":10,"unit_cost":999999}]}, user=USER)
    p = await db.purchase_orders.find_one({"id":po["id"]})
    print("GR against CANCELLED PO accepted; PO status now:", p["status"], "| GR vendor/outlet differ from PO:", gr["vendor_id"], gr["outlet_id"])
    gr2 = await procurement_service.post_gr({"vendor_id":"v1","outlet_id":"o1","receive_date":"2026-08-10",
        "lines":[{"item_id":"i9","qty_received":-5,"unit_cost":1000}]}, user=USER)
    print("Negative-qty GR accepted, grand_total:", gr2["grand_total"])
    # transfer with negative qty creates stock at source from nothing
    t = await inventory_service.create_transfer({"from_outlet_id":"o1","to_outlet_id":"o2","lines":[{"item_id":"i7","qty":-5,"unit_cost":100}]}, user=USER)
    await inventory_service.send_transfer(t["id"], user=USER)
    await inventory_service.receive_transfer(t["id"], user=USER)
    bal,_ = await inventory_service.stock_balance(item_id="i7")
    print("Transfer qty=-5: balances", [(r["outlet_id"], r["qty"]) for r in bal])
    # TB outlet filter ignored
    tb_all = await reports.trial_balance(period="2026-08")
    tb_o9 = await reports.trial_balance(period="2026-08", outlet_id="o-nonexistent")
    print("TB total Dr all:", tb_all["totals"]["period_dr"], "| TB for nonexistent outlet:", tb_o9["totals"]["period_dr"])
    pl = await reports.profit_loss(period="2026-08", outlet_id="o-nonexistent")
    # Opname stale snapshot
    await db.inventory_movements.insert_one({"id":"m1","item_id":"i5","outlet_id":"o1","qty":100,"unit_cost":10,"movement_date":"2026-08-01","deleted_at":None})
    s = await inventory_service.start_opname({"outlet_id":"o1"}, user=USER)
    await db.inventory_movements.insert_one({"id":"m2","item_id":"i5","outlet_id":"o1","qty":50,"unit_cost":10,"movement_date":"2026-08-02","deleted_at":None})
    await inventory_service.update_opname_lines(s["id"], [{"item_id":"i5","counted_qty":150}], user=USER)
    try:
        await inventory_service.submit_opname(s["id"], user=USER)
    except Exception as e: print("opname submit err", e)
    bal,_ = await inventory_service.stock_balance(item_id="i5", outlet_id="o1")
    print("Opname: physical 150 counted, system after submit:", bal[0]["qty"])
asyncio.run(main())
