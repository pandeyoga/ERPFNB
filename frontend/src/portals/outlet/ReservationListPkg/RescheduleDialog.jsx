/** ReservationList/RescheduleDialog.jsx */
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
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useOutletScopeCtx } from "../OutletScopeContext";

// ─── STATUS CONFIG ──────────────────────────────────────────────

function RescheduleDialog({ reservation, open, onClose, onSuccess }) {
  const [form, setForm] = useState({
    new_date: reservation?.reservation_date || "",
    new_time: reservation?.reservation_time || "",
    reason: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (reservation) {
      setForm({ new_date: reservation.reservation_date || "", new_time: reservation.reservation_time || "", reason: "" });
    }
  }, [reservation]);

  const handleSave = async () => {
    if (!form.new_date || !form.new_time) { toast.error("Tanggal dan waktu baru harus diisi"); return; }
    setLoading(true);
    try {
      const res = await api.post(`/reservations/${reservation.id}/reschedule`, form);
      toast.success("Reservasi dijadwalkan ulang");
      onSuccess(res.data?.data);
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal menjadwalkan ulang");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-indigo-600" /> Jadwal Ulang Reservasi
          </DialogTitle>
          <DialogDescription>
            Ubah jadwal untuk <strong>{reservation?.customer_name}</strong>.
            Reservasi lama: {reservation?.reservation_date} pukul {reservation?.reservation_time}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Tanggal Baru *</Label>
            <Input type="date" value={form.new_date}
              onChange={e => setForm(f => ({ ...f, new_date: e.target.value }))}
              data-testid="reschedule-date-input" />
          </div>
          <div className="space-y-1">
            <Label>Waktu Baru *</Label>
            <Input type="time" value={form.new_time}
              onChange={e => setForm(f => ({ ...f, new_time: e.target.value }))}
              data-testid="reschedule-time-input" />
          </div>
          <div className="space-y-1">
            <Label>Alasan Penjadwalan Ulang</Label>
            <Input placeholder="Misal: permintaan tamu, outlet full, dll."
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
          </div>
        </div>
        {/* History */}
        {reservation?.reschedule_history?.length > 0 && (
          <div className="bg-indigo-50 rounded-lg p-3">
            <p className="text-xs font-medium text-indigo-700 mb-1.5 flex items-center gap-1">
              <History className="h-3.5 w-3.5" /> Riwayat Penjadwalan Ulang
            </p>
            <div className="space-y-1">
              {reservation.reschedule_history.slice(-3).map((h, i) => (
                <p key={i} className="text-xs text-indigo-600">
                  {fmtDate(h.changed_at)}: {h.old_date} {h.old_time} → {h.new_date} {h.new_time}
                  {h.reason && ` (${h.reason})`}
                </p>
              ))}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button onClick={handleSave} disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700"
            data-testid="btn-confirm-reschedule">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <CalendarClock className="h-4 w-4 mr-1.5" /> Jadwalkan Ulang
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────
export default RescheduleDialog;
