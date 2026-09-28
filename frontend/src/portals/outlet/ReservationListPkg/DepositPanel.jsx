/** ReservationList/DepositPanel.jsx */
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
import { DEPOSIT_CONFIG, PAYMENT_METHODS, fmtRp, fmtDate } from "./constants";
import StatusBadge from "./StatusBadge";

function DepositPanel({ reservation, onUpdated }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    deposit_status: reservation.deposit_status || "none",
    deposit_amount: reservation.deposit_amount || 0,
    dp_payment_method: reservation.dp_payment_method || "",
    dp_reference: reservation.dp_reference || "",
    dp_deadline: reservation.dp_deadline || "",
  });

  const ds = DEPOSIT_CONFIG[reservation.deposit_status] || DEPOSIT_CONFIG.none;
  const needsDP = reservation.deposit_amount > 0;

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await api.patch(`/reservations/${reservation.id}/deposit`, form);
      toast.success("Informasi DP diperbarui");
      onUpdated(res.data?.data);
      setOpen(false);
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal memperbarui DP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        className={`rounded-xl border p-4 ${
          reservation.deposit_status === "paid"   ? "bg-emerald-50 border-emerald-200" :
          reservation.deposit_status === "pending" ? "bg-amber-50 border-amber-200" :
          reservation.deposit_status === "forfeited" ? "bg-red-50 border-red-200" :
          "bg-gray-50 border-gray-200"
        }`}
        data-testid="deposit-panel"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Banknote className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-sm">Down Payment (DP)</span>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setOpen(true)} data-testid="btn-update-dp">
            <Edit2 className="h-3 w-3 mr-1" /> Edit DP
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Jumlah DP</p>
            <p className="font-semibold">{needsDP ? fmtRp(reservation.deposit_amount) : "Tidak diperlukan"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status DP</p>
            <p className={`font-semibold ${ds.color}`}>{ds.label}</p>
          </div>
          {reservation.dp_deadline && (
            <div>
              <p className="text-xs text-muted-foreground">Deadline Bayar</p>
              <p className="font-medium">{fmtDate(reservation.dp_deadline)}</p>
            </div>
          )}
          {reservation.dp_payment_method && (
            <div>
              <p className="text-xs text-muted-foreground">Metode Bayar</p>
              <p className="font-medium">{PAYMENT_METHODS.find(m => m.value === reservation.dp_payment_method)?.label || reservation.dp_payment_method}</p>
            </div>
          )}
          {reservation.dp_reference && (
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">No. Referensi / Bukti</p>
              <p className="font-medium font-mono text-xs">{reservation.dp_reference}</p>
            </div>
          )}
          {reservation.dp_paid_at && (
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">Waktu Pembayaran</p>
              <p className="font-medium text-xs">{fmtDate(reservation.dp_paid_at)}</p>
            </div>
          )}
        </div>

        {/* Quick "Tandai Lunas" button */}
        {reservation.deposit_status === "pending" && reservation.deposit_amount > 0 && (
          <div className="mt-3 pt-3 border-t border-amber-200">
            <Button
              size="sm"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-8"
              onClick={() => { setForm(f => ({ ...f, deposit_status: "paid" })); setOpen(true); }}
              data-testid="btn-tandai-dp-lunas"
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1.5" /> Tandai DP Lunas
            </Button>
          </div>
        )}
      </div>

      {/* DP Update Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Down Payment</DialogTitle>
            <DialogDescription>Perbarui informasi DP untuk reservasi {reservation.customer_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Status DP</Label>
              <Select value={form.deposit_status} onValueChange={v => setForm(f => ({ ...f, deposit_status: v }))}>
                <SelectTrigger data-testid="dp-status-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DEPOSIT_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Jumlah DP (Rp)</Label>
              <Input type="number" value={form.deposit_amount}
                onChange={e => setForm(f => ({ ...f, deposit_amount: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-1">
              <Label>Metode Pembayaran</Label>
              <Select value={form.dp_payment_method || ""} onValueChange={v => setForm(f => ({ ...f, dp_payment_method: v }))}>
                <SelectTrigger data-testid="dp-method-select">
                  <SelectValue placeholder="Pilih metode..." />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>No. Referensi / Bukti Transfer</Label>
              <Input placeholder="Contoh: TRF-2026051100123"
                value={form.dp_reference || ""}
                onChange={e => setForm(f => ({ ...f, dp_reference: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Deadline Bayar DP</Label>
              <Input type="date" value={form.dp_deadline || ""}
                onChange={e => setForm(f => ({ ...f, dp_deadline: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={loading} data-testid="btn-save-dp">
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── RESCHEDULE DIALOG ───────────────────────────────────────────
export default DepositPanel;
