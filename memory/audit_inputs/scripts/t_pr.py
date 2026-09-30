from common import *
async def main():
    await setup()
    from services import procurement_service
    pr = await procurement_service.create_pr({"outlet_id":"o1","source":"kdo","status":"approved","lines":[{"item_id":"i1","qty":1000,"est_cost":1_000_000}]}, user=USER)
    print("PR created with client-supplied status:", pr["status"], "| approval_chain:", pr["approval_chain"])
    pr2 = await procurement_service.create_pr({"outlet_id":"o1","source":"kdo","skip_budget_check":True,"lines":[{"item_id":"i1","qty":1000,"est_cost":1_000_000}]}, user=USER)
    print("skip_budget_check honored from client; status:", pr2["status"])
asyncio.run(main())
