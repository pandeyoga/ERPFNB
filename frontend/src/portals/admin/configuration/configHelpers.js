/** Helpers shared by /admin/configuration/* pages. */
import { fmtDate } from "@/lib/format";

// Nama jenis aturan = nama tab di /admin/configuration (istilah ERP berbahasa Inggris).
export const RULE_LABELS = {
  sales_input_schema: "Sales Schema",
  petty_cash_policy: "Petty Cash Policy",
  service_charge_policy: "Service Charge Policy",
  incentive_policy: "Incentive Scheme",
  anomaly_threshold_policy: "Anomaly Threshold",
};

export function ruleStatus(rule) {
  if (!rule) return "disabled";
  if (!rule.active) return "disabled";
  const today = new Date().toISOString().slice(0, 10);
  if (rule.effective_from && rule.effective_from > today) return "draft";
  if (rule.effective_to && rule.effective_to < today) return "closed";
  return "active";
}

export function effectiveText(rule) {
  const a = rule?.effective_from ? fmtDate(rule.effective_from) : "sejak awal";
  const b = rule?.effective_to ? fmtDate(rule.effective_to) : "tanpa batas";
  return `${a} → ${b}`;
}
