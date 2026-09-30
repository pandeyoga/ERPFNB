from common import *
async def main():
    await setup()
    from services import payment_service, payment_request_service, procurement_service
    # GR creates AP 1,000,000
    gr = await procurement_service.post_gr({"vendor_id":"v1","outlet_id":"o1","receive_date":"2026-08-10",
        "lines":[{"item_id":"i1","qty_received":10,"unit_cost":100_000}]}, user=USER)
    pay = await payment_service.create_payment({"payee_type":"vendor","payee_id":"v1","amount":1_000_000,"description":"x",
        "gl_debit_id":"coa-accounts_payable","bank_account_id":"ba1","gr_id":gr["id"]}, user=USER)
    await payment_service.submit_payment(pay["id"], user=USER)
    # approve through engine (no workflow)
    from services import approval_service
    await approval_service.approve("payment_request", pay["id"], user=USER)
    d = await db.payment_requests.find_one({"id":pay["id"]}); print("PAY status:", d["status"])
    # legacy endpoint marks it paid
    r = await payment_request_service.mark_payment_request_paid(pay["id"], user={**USER,"email":"a@x"})
    print("legacy mark-paid ->", r["status"])
    print("JE for payment:", await db.journal_entries.count_documents({"source_type":"payment_request"}))
    ap = await db.ap_ledgers.find_one({"gr_id":gr["id"]}); print("AP balance still:", ap["balance"])
    # open AP helper
    print("open-ap helper returns:", len(await payment_request_service.get_open_ap_for_pr()))
    # double mark_paid race via payment_service
    pay2 = await payment_service.create_payment({"payee_type":"vendor","payee_id":"v1","amount":400_000,"description":"y",
        "gl_debit_id":"coa-accounts_payable","bank_account_id":"ba1","gr_id":gr["id"]}, user=USER)
    await payment_service.submit_payment(pay2["id"], user=USER)
    await approval_service.approve("payment_request", pay2["id"], user=USER)
    await payment_service.mark_paid(pay2["id"],{"payment_date":"2026-08-20"},user=USER)
    ap = await db.ap_ledgers.find_one({"gr_id":gr["id"]}); g = await db.goods_receipts.find_one({"id":gr["id"]})
    print("AP balance after ONE 400k payment:", ap["balance"], "| GR paid_amount:", g["paid_amount"], "| payments pushed:", len(ap["payments"]))
    # self-approval: creator == approver
    print("creator==approver allowed:", d["created_by"]==USER["id"])
asyncio.run(main())
