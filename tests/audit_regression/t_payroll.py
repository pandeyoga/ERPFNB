from common import *
async def main():
    await setup()
    await db.employees.insert_one({"id":"e1","full_name":"A","outlet_id":"o1","status":"active","basic_salary":4_000_000,"deleted_at":None})
    from services._hr_payroll import cycle
    p = await cycle.create_payroll({"period":"2026-08","outlet_id":"o1"}, user=USER)
    e = p["employees"][0]
    print("gross",p["total_gross"],"bpjs_emp",p["total_bpjs_employee"],"take_home",p["total_take_home"])
    try:
        r = await cycle.post_payroll(p["id"], user=USER)
        print("POSTED", r["status"])
    except Exception as ex:
        print("POST FAILED:", type(ex).__name__, getattr(ex,'message',ex))
    # duplicate payroll after posted?
    try:
        p2 = await cycle.create_payroll({"period":"2026-08","outlet_id":"o1"}, user=USER)
        print("DUPLICATE payroll created for same period after first:", p2["doc_no"], "status", (await db.payroll_cycles.find_one({"id":p["id"]}))["status"])
    except Exception as ex:
        print("dup blocked", ex)
asyncio.run(main())
