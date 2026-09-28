/** ReservationList/constants.js */
/**
 * Outlet Portal — Reservation Management
 * Statuses: pending, waitlist, confirmed, rescheduled, cancelled, completed, no_show
 * DP/Downpayment: amount, status, payment_method, dp_deadline, dp_reference, dp_paid_at
 */
import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Calendar, Clock, Users, Phone, Plus, Search, Filter,
  CheckCircle2, XCircle, Eye, RefreshCw, CalendarCheck, Loader2,
  ChevronLeft, ChevronRight, MoreVertical, MessageCircle, AlertCircle,
  UserCheck, X, Edit2, Trash2, CalendarX, CalendarClock, ListOrdered,
  Banknote, CreditCard, Wallet, QrCode, Clock3, CheckCheck,
  History, ChevronDown, AlertTriangle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import api from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useOutletScopeCtx } from "../OutletScopeContext";

// ─── STATUS CONFIG ──────────────────────────────────────────────

const STATUS_CONFIG = {
  pending:     { label: "Menunggu",       color: "bg-amber-100 text-amber-700 border-amber-300",    dot: "bg-amber-500",   icon: Clock3 },
  waitlist:    { label: "Waitlist",       color: "bg-teal-100 text-teal-700 border-teal-300",       dot: "bg-teal-500",    icon: ListOrdered },
  confirmed:   { label: "Dikonfirmasi",   color: "bg-blue-100 text-blue-700 border-blue-300",       dot: "bg-blue-500",    icon: CheckCircle2 },
  rescheduled: { label: "Dijadwal Ulang", color: "bg-indigo-100 text-indigo-700 border-indigo-300", dot: "bg-indigo-500",  icon: CalendarClock },
  completed:   { label: "Selesai",        color: "bg-emerald-100 text-emerald-700 border-emerald-300", dot: "bg-emerald-500", icon: CheckCheck },
  cancelled:   { label: "Dibatalkan",     color: "bg-red-100 text-red-700 border-red-300",          dot: "bg-red-400",     icon: XCircle },
  no_show:     { label: "Tidak Hadir",    color: "bg-gray-100 text-gray-600 border-gray-300",       dot: "bg-gray-400",    icon: CalendarX },
};

// ─── DEPOSIT STATUS CONFIG ───────────────────────────────────────
const DEPOSIT_CONFIG = {
  none:      { label: "Tidak Diperlukan",  color: "text-gray-500" },
  pending:   { label: "Menunggu Pembayaran", color: "text-amber-600" },
  paid:      { label: "Lunas",             color: "text-emerald-600" },
  refunded:  { label: "Dikembalikan",      color: "text-blue-600" },
  forfeited: { label: "Hangus",            color: "text-red-600" },
};

const PAYMENT_METHODS = [
  { value: "cash",         label: "Cash",         icon: Banknote },
  { value: "transfer_bank",label: "Transfer Bank", icon: CreditCard },
  { value: "qris",         label: "QRIS",         icon: QrCode },
  { value: "ovo",          label: "OVO",          icon: Wallet },
  { value: "gopay",        label: "GoPay",        icon: Wallet },
  { value: "dana",         label: "DANA",         icon: Wallet },
  { value: "shopeepay",    label: "ShopeePay",    icon: Wallet },
  { value: "other",        label: "Lainnya",      icon: Wallet },
];

const SOURCE_LABELS = {
  website: "Website", whatsapp: "WhatsApp", phone: "Telepon", walkin: "Walk-in", app: "App",
};

function fmtRp(n) {
  return `Rp ${(n || 0).toLocaleString("id-ID")}`;
}
function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export { STATUS_CONFIG, DEPOSIT_CONFIG, PAYMENT_METHODS, SOURCE_LABELS, fmtRp, fmtDate };
