import sys, asyncio, uuid, logging
logging.disable(logging.CRITICAL)
import os
sys.path.insert(0, os.environ.get('ERP_BACKEND', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'backend')))
from mongomock_motor import AsyncMongoMockClient
import core.db as cdb
cdb._db = AsyncMongoMockClient()['audit']
db = cdb._db
USER = {"id": "u-admin", "full_name": "Admin", "role_ids": ["r-super"], "outlet_ids": ["o1"], "status":"active"}
LOGICAL = ["salary_expense","salary_payable","employee_advance_receivable","service_charge_liability",
 "lb_fund_liability","ld_fund_liability","incentive_expense","inventory","accounts_payable","input_vat","output_vat",
 "vat_payable","cash_on_hand","cards_receivable","petty_cash","revenue_food","revenue_beverage","revenue_other",
 "discount_expense","bank_default","cogs","inventory_variance","inventory_adjustment","hpp","opname_variance"]
async def setup():
    await db.roles.insert_one({"id":"r-super","code":"SUPER_ADMIN","permissions":["*"]})
    await db.users.insert_one({**USER, "email":"a@x", "deleted_at":None})
    mapping = {}
    for i,l in enumerate(LOGICAL):
        cid = f"coa-{l}"
        await db.chart_of_accounts.insert_one({"id":cid,"code":str(1000+i),"name":l,"deleted_at":None,"is_postable":True})
        mapping[l]=cid
    await db.chart_of_accounts.insert_one({"id":"coa-2112","code":"2112","name":"PPh21 payable","deleted_at":None})
    await db.system_settings.insert_one({"key":"gl_mapping","value":mapping})
    for c in ["PR","PO","GR","JAE","JE","JER","PAY","KB","EA","ADJ","OPN","TRF","VOC","FOC","PRN"]:
        await db.number_series.insert_one({"id":"ns-"+c,"code":c,"current_value":0,"format":c+"-{0000}","padding":4,"deleted_at":None})
    await db.bank_accounts.insert_one({"id":"ba1","code":"BCA","gl_account_id":"coa-bank_default","deleted_at":None,"bank":"BCA","account_number":"1"})
def run(coro): return asyncio.get_event_loop().run_until_complete(coro) if False else asyncio.run(coro)
