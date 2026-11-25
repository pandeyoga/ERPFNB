# Finance / Inventory / Procurement audit (subagent report, saved by lead)
Counts: P0 6 · P1 15 · P2 11 · P3 1 (33; 30 verified). Probe scripts scratchpad/fin/. Test data FINAUDIT (2019 periods, 2099-01).
NOTE: JE JAE-2610-00742 (2019-05) is an app-produced 1-cent imbalanced JE (evidence FIN-09); auto-created open periods 2018-06, 2019-01..06, 2099-01 block later closes → reseed before final verification.

FIN-01 P0 VERIFIED — Concurrent AR receipts double-book cash: _ar/receipt.py:35-90 read outstanding → post JE → insert → $set paid from stale read. 3 parallel full receipts → 3 JEs 3.36M, invoice paid once, GL AR negative. Fix: atomic $inc claim with outstanding>=amt filter, Idempotency-Key unique on ar_receipts; ValueError→4xx (overpay & /send unknown also 500).
FIN-02 P0 VERIFIED — GR over-receipt race: procurement_service.py:363-412 (received_before via find, insert 472-497). 3 parallel GR of 10kg PO → 30kg, 3 AP. Fix atomic qty_received $inc with filter; unique (vendor_id, invoice_no).
FIN-03 P0 VERIFIED — Same approved PAY paid twice via two payment runs (_finance/payment_runs.py:120-147, :267 non-atomic, :429 unconditional mark paid). No maker-checker on runs.
FIN-04 P0 VERIFIED — PATCH payment bypasses GR/AP validation (payment_service.py:218-243 vs 141-162); overpayment: 400 returned but JE 5,000,000 posted & status paid (AP settle after JE :445; rollback filters "paying").
FIN-05 P0 VERIFIED — AR auto_post posts JE while invoice draft; edits after never reach GL (_ar/invoice.py:97-98,153,160-210): JE 112k vs invoice 1.12M.
FIN-06 P0 VERIFIED — P&L adds contra-revenue 4010 Discount (type revenue, normal Dr) to revenue (_finance/reports.py:103-131): NI overstated by 2× discount; P&L ≠ BS ΔNI.
FIN-07 P1 VERIFIED — Fixed assets never post to GL (fixed_asset_service.py:48-51 codes 1601/6101 missing; :247-264 exception swallowed; disposal 1001/8001/7001; revaluation 3300/3200); periods "garbage"/before purchase accepted.
FIN-08 P1 VERIFIED — AR write-off no JE (6500/bad_debt_expense missing; _ar/write_off.py:19,54-104) but invoice zeroed; written_off shown overdue (invoice.py:142).
FIN-09 P1 VERIFIED — Float money + per-line rounding (_journal/_common.py:70-99 rounds lines but checks unrounded sum): GR 0.13kg×87,350+PPN rejected "not balanced"; 0.09×15,750 posted 1-cent imbalanced JE → TB unbalanced → close blocked. Sim: 4.5% single-line GRs rejected, 1.2% imbalanced; multi-line 13.6%/8%.
FIN-10 P1 VERIFIED — Period lock bypass with malformed manual JE date "2019-1-15" (journals.py:107-110 period=entry_date[:7]; _period/guards.py:35-36 returns on invalid).
FIN-11 P1 VERIFIED — _post_journal accepts any coa_id (nonexistent/header/inactive). gl_mapping.ar_revenue fallback picks header 4000 (non-postable) — all AR JEs credit 4000. Petty cash gl_account_id from client "NOT-A-COA" accepted → BS unbalanced.
FIN-12 P1 VERIFIED — Adjustment unit_cost from client (inventory_service.py:383-396); 3 parallel approvals → 3 movements +12kg, 1 JE, 2×500 (no atomic claim :413-426; movements before JE :449-481); zero-cost write-off → empty JE.
FIN-13 P1 VERIFIED — Opname: negative counts accepted (:592-602), no approval (:619-665), variance at $last cost (often 0).
FIN-14 P1 VERIFIED — P2P controls: PO lines unvalidated (tax_rate 11 = 1100%, negative qty/price), non-PO GR free price, ghost vendor/item, duplicate invoice numbers, no 3-way match.
FIN-15 P1 VERIFIED — Sales never relieve inventory; no recipe/BOM/COGS. GL 1301 −1.126B.
FIN-16 P1 VERIFIED — Valuation inconsistent: $last cost vs avg Σtotal_cost/Σqty (seed uses total_value → 0); items.unit_default vs code reads unit → "pcs"; GL −1.126B vs valuation 80.5M vs matrix 0.5M.
FIN-17 P1 VERIFIED — Budget vs Actual sign + BS accounts as OPEX (= UI-01).
FIN-18 P1 VERIFIED — e-Faktur Keluaran only reads daily_sales, ignores AR invoices; 123/124 zero-PPN fakturs; tarif hardcoded "12" (efaktur_service.py:257); total 157,500 vs settlement 8,353,500.
FIN-19 P1 LIKELY — Restaurant tax as PPN (= POS-02); AR PPN 12% on full DPP (should be DPP Nilai Lain 11/12 under 2025 rules — confirm with tax consultant).
FIN-20 P1 VERIFIED — RFQ accept 500: rfq_service.py:189-215 calls create_po(po_data, user) but signature keyword-only user; field names qty_ordered/unit_price vs qty/unit_cost.
FIN-21 P1 VERIFIED — WHT silently dropped when wh_coa_id missing (payment_service.py:194-199, :361); payment_runs net vs WHT predicate mismatch (:153 vs :346).
FIN-22 P2 VERIFIED — Automated postings accept any future date & auto-create periods before validation (_journal/_common.py:18-36); phantom open periods block close order.
FIN-23 P2 VERIFIED — Exec/owner revenue KPIs disagree: executive_service.py:53-100 gross UTC; owner_digest_service.py:105-133 no deleted_at, reads transactions_count (field is transaction_count) → 0. 1,282,303,354 vs 1,280,180,854 vs P&L 1,235,659,000.
FIN-24 P2 VERIFIED — AP/AR aging as_of ignored (_finance/ap.py:31-46; _ar/aging.py:56-74 includes drafts); AR reconciliation double-subtracts.
FIN-25 P2 VERIFIED — No correction path for posted docs (reverse_journal manual only; no GR void/vendor return; no AR credit note).
FIN-26 P2 VERIFIED — No purchase-UOM→stock-UOM conversion (procurement_service.py:477-488; items.conversion_units unused).
FIN-27 P2 VERIFIED — Vendor price catalog updated from draft/cancelled POs and non-PO GRs.
FIN-28 P2 VERIFIED — DuplicateKeyError 500 after side effects (adjustment/urgent purchase parallel approval).
FIN-29 P2 VERIFIED — Seed subledgers don't tie to GL (inventory, petty cash, SC 2120, sales revenue).
FIN-30 P2 LIKELY — PPh21 not TER (PP 58/2023), JP cap outdated, future payroll allowed.
FIN-31 P2 LIKELY — Bank recon can match one ledger item to several lines/sessions.
FIN-32 P2 LIKELY — Tax settlement not re-settled after reopen; lock ignores order.
FIN-33 P3 — AR invoice number from system_settings counter by UTC year (not number_series); TB flags inconsistent; cash-flow swallowed TypeError; cash position manual.
