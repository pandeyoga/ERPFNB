from common import *
async def main():
    await setup()
    from services.approval_service import seed_defaults
    await seed_defaults(user_id="system", overwrite=False)
    await db.roles.insert_one({"id":"r-cashier","code":"CASHIER","permissions":["outlet.daily_sales.read"]})
    cashier = {"id":"u-cash","full_name":"Kasir","role_ids":["r-cashier"],"outlet_ids":["o1"],"status":"active"}
    await db.employees.insert_one({"id":"e1","full_name":"A","outlet_id":"o1","status":"active","deleted_at":None})
    from services._hr import advances
    a = await advances.create_advance({"employee_id":"e1","principal":5_000_000,"terms_months":2}, user=cashier)
    r = await advances.approve_advance(a["id"], user=cashier)
    print("Advance approved+disbursed by user with only outlet.daily_sales.read:", r["status"], "JE:", bool(r.get("journal_entry_id")))
asyncio.run(main())
