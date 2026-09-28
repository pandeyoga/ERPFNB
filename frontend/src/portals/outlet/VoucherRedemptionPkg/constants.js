/** VoucherRedemption/constants.js */
/**
 * VoucherRedemption.jsx — Sprint CRM-B
 * Outlet Voucher Redemption Station
 *
 * Flow: Lookup Customer → See Active Vouchers / Enter Code → Verify → Confirm Claim → Success
 * Side panel: Today’s Redemption Log (live)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  QrCode, Search, CheckCircle2, XCircle, Clock, ArrowLeft,
  User, Gift, RefreshCw, ClipboardCheck, AlertTriangle, Loader2,
  Ticket, ChevronRight, PhoneCall, Star, CalendarDays,
} from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

// ── Constants ─────────────────────────────────────────────────────────────────

const TIER_CONFIG = {
  bronze:   { label: "Bronze",   className: "bg-amber-100 text-amber-800 border-amber-200" },
  silver:   { label: "Silver",   className: "bg-gray-100 text-gray-700 border-gray-200" },
  gold:     { label: "Gold",     className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  platinum: { label: "Platinum", className: "bg-purple-100 text-purple-800 border-purple-200" },
};

const STATUS_CONFIG = {
  valid:            { label: "Voucher Valid",       icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  expired:          { label: "Voucher Kadaluarsa",  icon: XCircle,      color: "text-red-600",     bg: "bg-red-50 border-red-200" },
  used:             { label: "Voucher Sudah Dipakai",icon: XCircle,     color: "text-red-600",     bg: "bg-red-50 border-red-200" },
  already_claimed:  { label: "Sudah Diklaim",       icon: XCircle,      color: "text-red-600",     bg: "bg-red-50 border-red-200" },
  invalid:          { label: "Kode Tidak Valid",    icon: AlertTriangle, color: "text-amber-600",  bg: "bg-amber-50 border-amber-200" },
  customer_mismatch:{ label: "Bukan Milik Customer",icon: AlertTriangle, color: "text-amber-600",  bg: "bg-amber-50 border-amber-200" },
};

const STEP = { LOOKUP: 0, VERIFY: 1, CONFIRM: 2, SUCCESS: 3 };

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(dt) {
  if (!dt) return "-";
  try { return new Date(dt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return dt; }
}
function fmtTime(dt) {
  if (!dt) return "-";
  try { return new Date(dt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }); }
  catch { return dt; }
}
function daysUntil(dt) {
  if (!dt) return null;
  const diff = Math.ceil((new Date(dt) - Date.now()) / 86400000);
  return diff;
}

// ── Sub-components ────────────────────────────────────────────────────────────
export { TIER_CONFIG, STATUS_CONFIG, STEP, fmtDate, fmtTime, daysUntil };
