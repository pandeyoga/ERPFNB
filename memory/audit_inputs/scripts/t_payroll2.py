from common import *
async def main():
    await setup()
    await db.employees.insert_one({"id":"e1","full_name":"A","outlet_id":"o1","status":"active","basic_salary":4_000_000,"deleted_at":None})
    await db.salary_masters.insert_one({"employee_id":"e1","basic_salary":4_000_000,"bpjs_enrolled":False,"components":[],"deleted_at":None})
    # posted service charge allocation for e1
    await db.service_charge_periods.insert_one({"id":"sc1","period":"2026-08","outlet_id":"o1","status":"posted","deleted_at":None,"allocations":[{"employee_id":"e1","amount":500_000}]})
    from services._hr_payroll import cycle
    p = await cycle.create_payroll({"period":"2026-08","outlet_id":"o1"}, user=USER)
    r = await cycle.post_payroll(p["id"], user=USER)
    je = await db.journal_entries.find_one({"source_type":"payroll"})
    print("posted; JE lines:", [(l["coa_id"],l["dr"],l["cr"]) for l in je["lines"]])
    print("gross incl. SC share (already credited to salary_payable by SC posting):", p["total_gross"])
    p2 = await cycle.create_payroll({"period":"2026-08","outlet_id":"o1"}, user=USER)
    print("SECOND payroll for same period/outlet after posting created:", p2["id"]!=p["id"])
    p3 = await cycle.create_payroll({"period":"2026-08"}, user=USER)
    print("ALL-outlet payroll also created, includes e1 again:", any(e["employee_id"]=="e1" for e in p3["employees"]))
asyncio.run(main())
