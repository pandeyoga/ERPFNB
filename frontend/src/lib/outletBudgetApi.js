/**
 * Outlet Operational Budget — API helper + utilities.
 *
 * Different from /finance/budget (accounting/P&L COA-based) — this is
 * Executive-set cost control for outlet KDO/FDO/BDO procurement.
 */
import api from "@/lib/api";

export const BUCKETS = ["kdo", "fdo", "bdo"];
export const BUCKET_LABELS = {
  kdo: "KDO — Kitchen",
  fdo: "FDO — Floor",
  bdo: "BDO — Bar",
};
export const BUCKET_COLORS = {
  kdo: "#22c55e", // emerald
  fdo: "#3b82f6", // blue
  bdo: "#a855f7", // purple
};
export const PERIOD_TYPES = ["weekly", "monthly", "custom"];

// ============================================================================
// Period key helpers (mirror backend logic)
// ============================================================================

export function isoWeekKey(date = new Date()) {
  // ISO week number
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function weekRange(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return [monday, sunday];
}

export function monthRange(date = new Date()) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return [first, last];
}

export function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

export function prevPeriod(periodType, periodKey) {
  if (periodType === "weekly") {
    const m = periodKey.match(/^(\d{4})-W(\d{2})$/);
    if (!m) return periodKey;
    let y = parseInt(m[1]), w = parseInt(m[2]);
    w -= 1;
    if (w < 1) {
      y -= 1;
      // ISO weeks per year: 52 or 53 — use 52 as safe default
      w = 52;
    }
    return `${y}-W${String(w).padStart(2, "0")}`;
  }
  if (periodType === "monthly") {
    const m = periodKey.match(/^(\d{4})-(\d{2})$/);
    if (!m) return periodKey;
    let y = parseInt(m[1]), mm = parseInt(m[2]);
    mm -= 1;
    if (mm < 1) {
      y -= 1;
      mm = 12;
    }
    return `${y}-${String(mm).padStart(2, "0")}`;
  }
  return periodKey;
}

export function nextPeriod(periodType, periodKey) {
  if (periodType === "weekly") {
    const m = periodKey.match(/^(\d{4})-W(\d{2})$/);
    if (!m) return periodKey;
    let y = parseInt(m[1]), w = parseInt(m[2]);
    w += 1;
    if (w > 52) {
      y += 1;
      w = 1;
    }
    return `${y}-W${String(w).padStart(2, "0")}`;
  }
  if (periodType === "monthly") {
    const m = periodKey.match(/^(\d{4})-(\d{2})$/);
    if (!m) return periodKey;
    let y = parseInt(m[1]), mm = parseInt(m[2]);
    mm += 1;
    if (mm > 12) {
      y += 1;
      mm = 1;
    }
    return `${y}-${String(mm).padStart(2, "0")}`;
  }
  return periodKey;
}

/** Get the [start,end] dates for a given period key + type. */
export function rangeForKey(periodType, periodKey) {
  if (periodType === "monthly") {
    const m = periodKey.match(/^(\d{4})-(\d{2})$/);
    if (!m) return [null, null];
    const y = parseInt(m[1]), mm = parseInt(m[2]) - 1;
    return monthRange(new Date(y, mm, 1));
  }
  if (periodType === "weekly") {
    const m = periodKey.match(/^(\d{4})-W(\d{2})$/);
    if (!m) return [null, null];
    const y = parseInt(m[1]), w = parseInt(m[2]);
    // ISO: Jan 4 is always in W01 of ISO year y
    const ref = new Date(Date.UTC(y, 0, 4));
    const refDay = ref.getUTCDay() || 7;
    const w1Monday = new Date(ref);
    w1Monday.setUTCDate(ref.getUTCDate() - (refDay - 1));
    const monday = new Date(w1Monday);
    monday.setUTCDate(w1Monday.getUTCDate() + (w - 1) * 7);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return [
      new Date(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate()),
      new Date(sunday.getUTCFullYear(), sunday.getUTCMonth(), sunday.getUTCDate()),
    ];
  }
  return [null, null];
}

// ============================================================================
// API wrappers
// ============================================================================

export async function fetchBudgets({ periodType, periodKey, brandId, outletId } = {}) {
  const params = {};
  if (periodType) params.period_type = periodType;
  if (periodKey) params.period_key = periodKey;
  if (brandId) params.brand_id = brandId;
  if (outletId) params.outlet_id = outletId;
  const res = await api.get("/outlet-budget/budgets", { params });
  return res.data.data;
}

export async function saveBulkBudgets(payload) {
  const res = await api.post("/outlet-budget/budgets/bulk", payload);
  return res.data.data;
}

export async function saveBudget(payload) {
  const res = await api.post("/outlet-budget/budgets", payload);
  return res.data.data;
}

export async function fetchMonitorOverview({ periodType, periodKey, brandId }) {
  const params = { period_type: periodType, period_key: periodKey };
  if (brandId) params.brand_id = brandId;
  const res = await api.get("/outlet-budget/monitor/overview", { params });
  return res.data.data;
}

export async function fetchHeatmap({ periodType, periodKeys, outletIds }) {
  const params = {
    period_type: periodType,
    period_keys: periodKeys.join(","),
  };
  if (outletIds) params.outlet_ids = outletIds.join(",");
  const res = await api.get("/outlet-budget/monitor/heatmap", { params });
  return res.data.data;
}

export async function fetchMyCurrent() {
  const res = await api.get("/outlet-budget/my-current");
  return res.data.data;
}

export async function fetchCurrentByOutlet(outletId) {
  const res = await api.get(`/outlet-budget/by-outlet/${outletId}/current`);
  return res.data.data;
}

export async function precheckPR(payload) {
  const res = await api.post("/outlet-budget/precheck-pr", payload);
  return res.data.data;
}

export async function submitIncreaseRequest(payload) {
  const res = await api.post("/outlet-budget/increase-requests", payload);
  return res.data.data;
}

export async function fetchIncreaseRequests({ status, outletId } = {}) {
  const params = {};
  if (status) params.status = status;
  if (outletId) params.outlet_id = outletId;
  const res = await api.get("/outlet-budget/increase-requests", { params });
  return res.data.data;
}

export async function approveIncrease(reqId, { approvedAmount, note }) {
  const res = await api.post(`/outlet-budget/increase-requests/${reqId}/approve`, {
    approved_amount: approvedAmount,
    note,
  });
  return res.data.data;
}

export async function rejectIncrease(reqId, { note }) {
  const res = await api.post(`/outlet-budget/increase-requests/${reqId}/reject`, { note });
  return res.data.data;
}

// ============================================================================
// Display helpers
// ============================================================================

export function paceColor(status) {
  if (status === "red") return "text-red-500";
  if (status === "amber") return "text-amber-500";
  return "text-emerald-500";
}

export function paceBg(status) {
  if (status === "red") return "bg-red-500/10 border-red-500/30";
  if (status === "amber") return "bg-amber-500/10 border-amber-500/30";
  return "bg-emerald-500/10 border-emerald-500/30";
}

export function paceProgressColor(status) {
  if (status === "red") return "#ef4444";
  if (status === "amber") return "#f59e0b";
  return "#10b981";
}
