/** BudgetManagement/constants.js */
const EMPTY_FORM = { name: "", period: new Date().toISOString().slice(0, 7), notes: "", lines: [], scope: "outlet", outlet_id: "", brand_id: "" };
const CATEGORIES = [
  { code: "REV", name: "Revenue" },
  { code: "COGS", name: "HPP / COGS" },
  { code: "OPEX", name: "Operating Expenses" },
  { code: "PAYROLL", name: "Payroll" },
  { code: "MKTG", name: "Marketing" },
  { code: "DEP", name: "Depreciation" },
  { code: "TAX", name: "Tax Expense" },
];

/** Status approval budget — label & warna dari kamus global StatusPill. */
const APPROVAL_STATUSES = ["draft", "submitted", "approved", "locked", "rejected"];

export { EMPTY_FORM, CATEGORIES, APPROVAL_STATUSES };
