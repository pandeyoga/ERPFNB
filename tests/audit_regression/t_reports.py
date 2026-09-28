from common import *
async def main():
    await setup()
    # set seed-style normal_balance + types
    await db.chart_of_accounts.update_many({}, {"$set":{"normal_balance":"Dr","type":"asset"}})
    await db.chart_of_accounts.update_one({"id":"coa-revenue_food"},{"$set":{"normal_balance":"Cr","type":"revenue"}})
    from services._journal._common import _post_journal
    await _post_journal(entry_date="2026-08-05", description="x", source_type="t", source_id="1",
        lines=[{"coa_id":"coa-cash_on_hand","dr":1000,"cr":0},{"coa_id":"coa-revenue_food","dr":0,"cr":1000}], user_id="u")
    from services._finance import reports
    tb = await reports.trial_balance(period="2026-08")
    print("TB rows (Cash is Dr-normal, balance should be +1000):", [(r["name"], r["balance_cumulative"]) for r in tb["rows"]])
    pl = await reports.profit_loss(period="2026-08", compare_prev=False)
    print("profit_loss keys:", sorted(pl.keys()), "| has 'sections':", "sections" in pl, "| revenue total:", pl["revenue"]["total"])
    from services._reports_excel_finance.pl_group import generate_pl_group_excel
    import openpyxl, io
    out = await generate_pl_group_excel(period_from="2026-08", period_to="2026-08")
    ws = out.active
    vals=[c.value for row in ws.iter_rows() for c in row if isinstance(c.value,(int,float)) and c.value]
    print("P&L Excel non-zero numeric cells (revenue 1000 expected):", vals[:10])
    from services._reports_excel_finance.trial_balance import generate_trial_balance_excel
    wb = await generate_trial_balance_excel(period="2026-08")
    rows=[[c.value for c in r] for r in wb.active.iter_rows()]
    print("TB Excel rows:", [r for r in rows if r and r[0] in ("OTHER","ASSET")] , [r for r in rows if r and r[1] in ("cash_on_hand",)])
asyncio.run(main())
