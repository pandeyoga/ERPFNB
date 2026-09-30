from common import *
async def main():
    await setup()
    for code,cid in [("1201","coa-ar"),("1111","coa-bank"),("4000","coa-rev"),("2110","coa-ppn")]:
        await db.chart_of_accounts.insert_one({"id":cid,"code":code,"name":code,"deleted_at":None})
    from services._ar import invoice as inv, receipt as rc
    i = await inv.create_invoice({"invoice_no":"INV-1","invoice_date":"2026-08-01","lines":[{"qty":1,"unit_price":1_000_000}],"auto_post":True}, user_id="u-admin")
    await rc.record_receipt(i["id"], "2026-08-05", 400_000, user_id="u-admin")
    await rc.record_receipt(i["id"], "2026-08-10", 600_000, user_id="u-admin")
    jes = await db.journal_entries.find({"source_type":"ar_receipt"}).to_list(10)
    print("AR receipts recorded: 2 (total 1,000,000); receipt JEs in GL:", len(jes), "amounts:", [j["total_dr"] for j in jes])
    r = await db.ar_receipts.find({}).to_list(10); print("receipt je_ids:", [x.get("je_id")==jes[0]["id"] for x in r])
    d = await db.ar_invoices.find_one({"id":i["id"]}); print("invoice status:", d["status"])
    await inv.mark_sent(i["id"], user_id="u-admin")
    d = await db.ar_invoices.find_one({"id":i["id"]}); print("after mark_sent on PAID invoice, status:", d["status"])
asyncio.run(main())
