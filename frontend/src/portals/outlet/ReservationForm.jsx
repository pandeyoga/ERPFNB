/**
 * Outlet Portal — Create / Edit Reservation (Staff-managed)
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Calendar, Clock, Users, Phone, Mail, User, MapPin,
  Heart, Cake, Leaf, MessageSquare, ChevronLeft, Loader2,
  CheckCircle2, AlertCircle, Save, ArrowLeft, Minus, Plus, CalendarCheck
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import PageHeader from "@/components/shared/PageHeader";
import api from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useOutletScopeCtx } from "./OutletScopeContext";

const SPECIAL_TYPES = [
  { id: "anniversary", label: "Anniversari" },
  { id: "birthday", label: "Ulang Tahun" },
  { id: "dietary", label: "Dietary / Alergi" },
  { id: "other", label: "Lainnya" },
];

const TIME_SLOTS = [
  "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "16:00",
  "17:00", "17:30", "18:00", "18:30", "19:00", "19:30",
  "20:00", "20:30", "21:00", "21:30", "22:00",
];

const SOURCES = [
  { id: "phone", label: "Telepon" },
  { id: "walkin", label: "Walk-in" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "website", label: "Website" },
];

const EMPTY = {
  outlet_id: "",
  reservation_date: "",
  reservation_time: "",
  pax: 2,
  customer_name: "",
  customer_phone: "",
  customer_email: "",
  area_preference: "",
  table_preference: "",
  special_requests: { type: "", notes: "" },
  deposit_amount: 0,
  deposit_status: "none",
  dp_payment_method: "",
  dp_deadline: "",
  dp_reference: "",
  notes: "",
  outlet_notes: "",
  source: "phone",
};

export default function ReservationForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { user } = useAuth();
  const { outletId: scopeOutletId, scopedOutlets } = useOutletScopeCtx();
  const [form, setForm] = useState({ ...EMPTY });
  const [outlets, setOutlets] = useState([]); // outlets list for the selector
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Use scoped outlets from context (already filtered to user's scope)
    if (scopedOutlets.length > 0) {
      setOutlets(scopedOutlets);
      if (!isEdit) {
        // Pre-fill outlet using functional setState to avoid stale-closure reads on form.outlet_id
        setForm(prev => {
          if (prev.outlet_id) return prev; // already set, don't override
          const targetId = scopeOutletId || (scopedOutlets.length === 1 ? scopedOutlets[0].id : "");
          return targetId ? { ...prev, outlet_id: targetId } : prev;
        });
      }
    }
  }, [scopedOutlets, scopeOutletId, isEdit]); // eslint-disable-line

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/reservations/${id}`).then(res => {
      if (res.data.success) {
        const r = res.data.data;
        setForm({
          outlet_id: r.outlet_id || "",
          reservation_date: r.reservation_date || "",
          reservation_time: r.reservation_time || "",
          pax: r.pax || 2,
          customer_name: r.customer_name || "",
          customer_phone: r.customer_phone || "",
          customer_email: r.customer_email || "",
          area_preference: r.area_preference || "",
          table_preference: r.table_preference || "",
          special_requests: r.special_requests || { type: "", notes: "" },
          deposit_amount: r.deposit_amount || 0,
          deposit_status: r.deposit_status || "none",
          dp_payment_method: r.dp_payment_method || "",
          dp_deadline: r.dp_deadline || "",
          dp_reference: r.dp_reference || "",
          notes: r.notes || "",
          outlet_notes: r.outlet_notes || "",
          source: r.source || "phone",
        });
      }
    }).catch(() => toast.error("Gagal memuat data reservasi"));
  }, [id, isEdit]);

  function setField(key, value) {
    setForm(f => ({ ...f, [key]: value }));
  }
  function setSpecial(key, value) {
    setForm(f => ({ ...f, special_requests: { ...f.special_requests, [key]: value } }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.outlet_id) { setError("Pilih outlet"); return; }
    if (!form.reservation_date) { setError("Pilih tanggal"); return; }
    if (!form.reservation_time) { setError("Pilih waktu"); return; }
    if (!form.customer_name.trim()) { setError("Nama tamu diperlukan"); return; }
    if (!form.customer_phone.trim()) { setError("Nomor HP diperlukan"); return; }

    setSubmitting(true);
    try {
      if (isEdit) {
        await api.put(`/reservations/${id}`, { ...form, pax: parseInt(form.pax) });
        toast.success("Reservasi diperbarui");
      } else {
        await api.post("/reservations", { ...form, pax: parseInt(form.pax) });
        toast.success("Reservasi dibuat");
      }
      navigate("/outlet/reservations");
    } catch (err) {
      setError(err.response?.data?.errors?.[0]?.message || "Gagal menyimpan reservasi");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-3 lg:space-y-4" data-testid="reservation-form-page">
      <div data-testid="reservation-form-header">
        <Button variant="ghost" size="sm" onClick={() => navigate("/outlet/reservations")} className="-ml-2 mb-1" data-testid="reservation-form-back">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Reservations
        </Button>
        <PageHeader
          icon={CalendarCheck}
          title={isEdit ? "Edit Reservasi" : "Buat Reservasi"}
          subtitle="Catat reservasi dari telepon, walk-in, WhatsApp, atau website."
          className="mb-0 md:mb-0"
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 lg:space-y-4" data-testid="reservation-form">
        {/* Outlet & Source */}
        <Card data-testid="reservation-form-outlet-card">
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="res-outlet" className="text-xs md:text-sm font-medium">Outlet *</Label>
                <Select value={form.outlet_id} onValueChange={v => setField("outlet_id", v)}>
                  <SelectTrigger id="res-outlet" data-testid="reservation-form-outlet"><SelectValue placeholder="Pilih outlet" /></SelectTrigger>
                  <SelectContent>
                    {outlets.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="res-source" className="text-xs md:text-sm font-medium">Sumber reservasi</Label>
                <Select value={form.source} onValueChange={v => setField("source", v)}>
                  <SelectTrigger id="res-source" data-testid="reservation-form-source"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Date & Time */}
        <Card data-testid="reservation-form-datetime-card">
          <CardHeader><CardTitle>Tanggal & Waktu</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="res-date" className="text-xs md:text-sm font-medium">Tanggal reservasi *</Label>
                <Input
                  id="res-date"
                  type="date"
                  value={form.reservation_date}
                  onChange={e => setField("reservation_date", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="res-time" className="text-xs md:text-sm font-medium">Waktu *</Label>
                <Select value={form.reservation_time} onValueChange={v => setField("reservation_time", v)}>
                  <SelectTrigger id="res-time" data-testid="reservation-form-time"><SelectValue placeholder="Pilih waktu" /></SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Label id="res-pax-label" className="text-xs md:text-sm font-medium">Jumlah tamu *</Label>
              <div className="flex items-center gap-2" role="group" aria-labelledby="res-pax-label">
                <Button type="button" variant="outline" size="icon-sm" onClick={() => setField("pax", Math.max(1, form.pax - 1))} aria-label="Kurangi jumlah tamu" data-testid="reservation-form-pax-minus">
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="font-medium w-8 text-center tabular-nums" aria-live="polite" data-testid="reservation-form-pax">{form.pax}</span>
                <Button type="button" variant="outline" size="icon-sm" onClick={() => setField("pax", Math.min(50, form.pax + 1))} aria-label="Tambah jumlah tamu" data-testid="reservation-form-pax-plus">
                  <Plus className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">orang</span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="res-area" className="text-xs md:text-sm font-medium">Area preferensi</Label>
                <Input
                  id="res-area"
                  placeholder="Misal: Indoor, Outdoor, VIP..."
                  value={form.area_preference}
                  onChange={e => setField("area_preference", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="res-table" className="text-xs md:text-sm font-medium">Nomor meja (opsional)</Label>
                <Input
                  id="res-table"
                  placeholder="Misal: Meja 5"
                  value={form.table_preference}
                  onChange={e => setField("table_preference", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Guest Info */}
        <Card data-testid="reservation-form-guest-card">
          <CardHeader><CardTitle>Informasi Tamu</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="res-name" className="text-xs md:text-sm font-medium">Nama tamu *</Label>
              <Input
                id="res-name"
                placeholder="Nama lengkap"
                value={form.customer_name}
                onChange={e => setField("customer_name", e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="res-phone" className="text-xs md:text-sm font-medium">Nomor HP / WA *</Label>
                <Input
                  id="res-phone"
                  type="tel"
                  placeholder="08xx-xxxx-xxxx"
                  value={form.customer_phone}
                  onChange={e => setField("customer_phone", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="res-email" className="text-xs md:text-sm font-medium">Email (opsional)</Label>
                <Input
                  id="res-email"
                  type="email"
                  placeholder="email@contoh.com"
                  value={form.customer_email}
                  onChange={e => setField("customer_email", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Special Requests */}
        <Card data-testid="reservation-form-special-card">
          <CardHeader><CardTitle>Permintaan Khusus</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="group" aria-label="Jenis permintaan khusus">
              {SPECIAL_TYPES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={form.special_requests.type === t.id}
                  onClick={() => setSpecial("type", form.special_requests.type === t.id ? "" : t.id)}
                  className={`h-9 px-3 rounded-md border text-sm transition-colors ${
                    form.special_requests.type === t.id
                      ? "bg-amber-500/10 border-amber-500/60 text-amber-800 dark:text-amber-300"
                      : "border-input hover:bg-accent"
                  }`}
                  data-testid={`reservation-form-special-${t.id}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {form.special_requests.type && (
              <div className="space-y-1">
                <Label htmlFor="res-special-notes" className="text-xs md:text-sm font-medium">Detail permintaan</Label>
                <Textarea
                  id="res-special-notes"
                  rows={2}
                  placeholder="Ceritakan lebih lanjut..."
                  value={form.special_requests.notes}
                  onChange={e => setSpecial("notes", e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="res-notes" className="text-xs md:text-sm font-medium">Catatan untuk tamu</Label>
              <Textarea
                id="res-notes"
                rows={2}
                placeholder="Catatan umum tamu..."
                value={form.notes}
                onChange={e => setField("notes", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="res-outlet-notes" className="text-xs md:text-sm font-medium">Catatan internal (untuk staf)</Label>
              <Textarea
                id="res-outlet-notes"
                rows={2}
                placeholder="Catatan internal, tidak ditampilkan ke tamu..."
                value={form.outlet_notes}
                onChange={e => setField("outlet_notes", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Deposit / DP */}
        <Card data-testid="reservation-form-deposit-card">
          <CardHeader><CardTitle>Down Payment / DP (opsional)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="res-dp-amount" className="text-xs md:text-sm font-medium">Jumlah DP (Rp)</Label>
                <Input id="res-dp-amount" type="number" min={0} value={form.deposit_amount}
                  onChange={e => setField("deposit_amount", parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="res-dp-status" className="text-xs md:text-sm font-medium">Status DP</Label>
                <Select value={form.deposit_status} onValueChange={v => setField("deposit_status", v)}>
                  <SelectTrigger id="res-dp-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak Diperlukan</SelectItem>
                    <SelectItem value="pending">Menunggu Pembayaran</SelectItem>
                    <SelectItem value="paid">Lunas</SelectItem>
                    <SelectItem value="refunded">Dikembalikan</SelectItem>
                    <SelectItem value="forfeited">Hangus</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.deposit_amount > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="res-dp-method" className="text-xs md:text-sm font-medium">Metode pembayaran DP</Label>
                  <Select value={form.dp_payment_method || ""} onValueChange={v => setField("dp_payment_method", v)}>
                    <SelectTrigger id="res-dp-method"><SelectValue placeholder="Pilih metode..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="transfer_bank">Transfer Bank</SelectItem>
                      <SelectItem value="qris">QRIS</SelectItem>
                      <SelectItem value="ovo">OVO</SelectItem>
                      <SelectItem value="gopay">GoPay</SelectItem>
                      <SelectItem value="dana">DANA</SelectItem>
                      <SelectItem value="shopeepay">ShopeePay</SelectItem>
                      <SelectItem value="other">Lainnya</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="res-dp-deadline" className="text-xs md:text-sm font-medium">Deadline bayar DP</Label>
                  <Input id="res-dp-deadline" type="date" value={form.dp_deadline || ""} onChange={e => setField("dp_deadline", e.target.value)} />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <Label htmlFor="res-dp-reference" className="text-xs md:text-sm font-medium">No. referensi / bukti transfer</Label>
                  <Input id="res-dp-reference" placeholder="Contoh: TRF-2026051100123" value={form.dp_reference || ""}
                    onChange={e => setField("dp_reference", e.target.value)} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end gap-2" data-testid="reservation-form-actions">
          <Button type="button" variant="outline" onClick={() => navigate("/outlet/reservations")}>
            Batal
          </Button>
          <Button type="submit" disabled={submitting} data-testid="reservation-form-submit">
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan…</> : <><Save className="w-4 h-4" /> {isEdit ? "Simpan Perubahan" : "Buat Reservasi"}</>}
          </Button>
        </div>
      </form>
    </div>
  );
}
