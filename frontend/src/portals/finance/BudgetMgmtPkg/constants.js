/** BudgetManagement/constants.js */
import { Send, Check, Lock, XCircle } from "lucide-react";

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

const APPROVAL_STATUS_LABELS = {
  draft: { label: "Draft", variant: "secondary", icon: null },
  submitted: { label: "Menunggu Approval", variant: "warning", icon: Send },
  approved: { label: "Disetujui", variant: "success", icon: Check },
  locked: { label: "Terkunci", variant: "default", icon: Lock },
  rejected: { label: "Ditolak", variant: "destructive", icon: XCircle },
};

export { EMPTY_FORM, CATEGORIES, APPROVAL_STATUS_LABELS };
