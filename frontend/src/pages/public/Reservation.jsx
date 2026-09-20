/**
 * Public Reservation Booking Page
 * Terintegrasi dengan compro website — form reservasi untuk semua outlet
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { logger } from "@/lib/logger";
import {
  Calendar, Clock, Users, Phone, Mail, User, MapPin,
  Heart, Cake, Leaf, MessageSquare, ChevronRight,
  CheckCircle2, AlertCircle, Loader2, MessageCircle,
  ArrowLeft
} from "lucide-react";

const SPECIAL_REQUEST_TYPES = [
  { id: "anniversary", label: "Anniversari / Ulang Tahun Pernikahan", icon: Heart },
  { id: "birthday", label: "Ulang Tahun", icon: Cake },
  { id: "dietary", label: "Dietary / Alergi", icon: Leaf },
  { id: "other", label: "Permintaan Lain", icon: MessageSquare },
];

const DEFAULT_TIME_SLOTS = [
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "17:00", "17:30", "18:00", "18:30",
  "19:00", "19:30", "20:00", "20:30", "21:00",
];

const EMPTY_FORM = {
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
  notes: "",
  source: "website",
};

export default function Reservation() {
  const [outlets, setOutlets] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null); // {reservation_id, member_created}
  const [error, setError] = useState("");
  const [settings, setSettings] = useState(null);

  // Min date = tomorrow
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split("T")[0];

  useEffect(() => {
    // Use relative URL - works via Kubernetes ingress routing /api/* to backend
    fetch("/api/public/outlets")
      .then(r => r.json())
      .then(data => {
        if (data.success && Array.isArray(data.data)) {
          setOutlets(data.data);
        }
      })
      .catch(err => logger.error("Failed to load reservation outlets", { error: err.message }));
  }, []);

  useEffect(() => {
    if (!form.outlet_id) return;
    fetch(`/api/reservations/settings?outlet_id=${form.outlet_id}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data?.items?.length > 0) {
          setSettings(data.data.items[0]);
        } else {
          setSettings(null);
        }
      })
      .catch(() => setSettings(null));
  }, [form.outlet_id]);

  const timeSlots = settings?.time_slots?.length ? settings.time_slots : DEFAULT_TIME_SLOTS;
  const areaOptions = settings?.area_options || [];

  function setField(key, value) {
    setForm(f => ({ ...f, [key]: value }));
  }
  function setSpecial(key, value) {
    setForm(f => ({ ...f, special_requests: { ...f.special_requests, [key]: value } }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.outlet_id) { setError("Pilih outlet terlebih dahulu"); return; }
    if (!form.reservation_date) { setError("Pilih tanggal reservasi"); return; }
    if (!form.reservation_time) { setError("Pilih waktu reservasi"); return; }
    if (!form.customer_name.trim()) { setError("Nama tamu diperlukan"); return; }
    if (!form.customer_phone.trim()) { setError("Nomor WhatsApp diperlukan"); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/public/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          pax: parseInt(form.pax),
          deposit_amount: 0,
          deposit_status: "none",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(data.data);
      } else {
        setError(data.errors?.[0]?.message || "Terjadi kesalahan");
      }
    } catch (err) {
      setError("Gagal mengirim reservasi. Periksa koneksi internet Anda.");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedOutlet = outlets.find(o => o.id === form.outlet_id);

  // WA message for WhatsApp booking
  const waMessage = selectedOutlet ? encodeURIComponent(
    `Halo, saya ingin reservasi meja di ${selectedOutlet.name}.\n` +
    `Nama: [Nama Anda]\nTanggal: [Tanggal]\nWaktu: [Waktu]\nJumlah tamu: [Jumlah]`
  ) : "";

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-950 to-stone-900 flex items-center justify-center px-4">
        <div className="max-w-lg w-full bg-stone-900 border border-stone-700 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Reservasi Dikirim!</h2>
          <p className="text-stone-300 mb-6">
            Terima kasih! Tim kami akan segera mengkonfirmasi reservasi Anda.
          </p>
          <div className="bg-stone-800 rounded-xl p-4 text-left mb-6 space-y-2">
            <div className="flex justify-between">
              <span className="text-stone-400 text-sm">ID Reservasi</span>
              <span className="text-white text-sm font-mono">{submitted.reservation_id?.slice(-8).toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-400 text-sm">Status</span>
              <span className="text-amber-400 text-sm font-medium">Menunggu Konfirmasi</span>
            </div>
            {submitted.member_created && (
              <div className="pt-2 border-t border-stone-700">
                <p className="text-xs text-stone-400">
                  ✨ Akun FnB Rewards baru telah dibuat untuk Anda!
                </p>
              </div>
            )}
          </div>
          <p className="text-stone-400 text-sm mb-6">
            Konfirmasi akan dikirim via WhatsApp ke nomor yang Anda daftarkan.
          </p>
          <div className="flex gap-3">
            <Link to="/" className="flex-1 py-2 px-4 bg-stone-700 text-white rounded-lg text-center text-sm hover:bg-stone-600 transition-colors">
              Kembali ke Beranda
            </Link>
            <button
              onClick={() => { setSubmitted(null); setForm(EMPTY_FORM); }}
              className="flex-1 py-2 px-4 bg-amber-500 text-black rounded-lg text-sm font-medium hover:bg-amber-400 transition-colors"
            >
              Reservasi Lagi
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-950 to-stone-900">
      {/* Hero */}
      <div className="relative py-20 px-4 text-center border-b border-stone-800">
        <Link to="/" className="absolute top-6 left-6 flex items-center gap-2 text-stone-400 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </Link>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Reservasi Meja</h1>
        <p className="text-stone-400 text-lg max-w-lg mx-auto">
          Pesan meja Anda sekarang dan nikmati pengalaman kuliner terbaik bersama orang-orang terkasih.
        </p>
        {/* WA Alternative */}
        {selectedOutlet && (
          <a
            href={`https://wa.me/6281234567890?text=${waMessage}`}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-green-600 text-white rounded-full text-sm hover:bg-green-500 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Atau reservasi via WhatsApp
          </a>
        )}
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 py-12">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Outlet Selection */}
          <div className="bg-stone-900 border border-stone-700 rounded-2xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-500" />
              Pilih Lokasi
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {outlets.map(outlet => (
                <button
                  key={outlet.id}
                  type="button"
                  onClick={() => setField("outlet_id", outlet.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    form.outlet_id === outlet.id
                      ? "border-amber-500 bg-amber-500/10"
                      : "border-stone-700 bg-stone-800 hover:border-stone-500"
                  }`}
                >
                  <p className="font-medium text-white text-sm">{outlet.name}</p>
                  {outlet.address && <p className="text-stone-400 text-xs mt-1">{outlet.address}</p>}
                </button>
              ))}
            </div>
          </div>

          {/* Date & Time */}
          <div className="bg-stone-900 border border-stone-700 rounded-2xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-500" />
              Tanggal & Waktu
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-stone-400 text-sm mb-2 block">Tanggal *</label>
                <input
                  type="date"
                  min={minDateStr}
                  value={form.reservation_date}
                  onChange={e => setField("reservation_date", e.target.value)}
                  required
                  className="w-full bg-stone-800 border border-stone-600 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-stone-400 text-sm mb-2 block">Jumlah Tamu *</label>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setField("pax", Math.max(1, form.pax - 1))} className="w-8 h-8 rounded-full bg-stone-700 text-white flex items-center justify-center hover:bg-stone-600">-</button>
                  <span className="text-white font-medium w-6 text-center">{form.pax}</span>
                  <button type="button" onClick={() => setField("pax", Math.min(settings?.max_pax || 20, form.pax + 1))} className="w-8 h-8 rounded-full bg-stone-700 text-white flex items-center justify-center hover:bg-stone-600">+</button>
                  <span className="text-stone-400 text-sm ml-1"><Users className="w-4 h-4 inline" /> orang</span>
                </div>
              </div>
            </div>

            {/* Time Slots */}
            {form.reservation_date && (
              <div className="mt-4">
                <label className="text-stone-400 text-sm mb-3 block">Pilih Waktu *</label>
                <div className="flex flex-wrap gap-2">
                  {timeSlots.map(slot => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setField("reservation_time", slot)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                        form.reservation_time === slot
                          ? "bg-amber-500 text-black font-medium"
                          : "bg-stone-800 text-stone-300 hover:bg-stone-700 border border-stone-600"
                      }`}
                    >
                      <Clock className="w-3 h-3 inline mr-1" />{slot}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Area Preference */}
            {areaOptions.length > 0 && (
              <div className="mt-4">
                <label className="text-stone-400 text-sm mb-2 block">Preferensi Area (opsional)</label>
                <div className="flex flex-wrap gap-2">
                  {areaOptions.map(area => (
                    <button
                      key={area}
                      type="button"
                      onClick={() => setField("area_preference", form.area_preference === area ? "" : area)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                        form.area_preference === area
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500"
                          : "bg-stone-800 text-stone-300 hover:bg-stone-700 border border-stone-600"
                      }`}
                    >
                      {area}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Guest Info */}
          <div className="bg-stone-900 border border-stone-700 rounded-2xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-amber-500" />
              Informasi Tamu
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-stone-400 text-sm mb-1 block">Nama Lengkap *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                  <input
                    type="text"
                    placeholder="Masukkan nama lengkap"
                    value={form.customer_name}
                    onChange={e => setField("customer_name", e.target.value)}
                    required
                    className="w-full bg-stone-800 border border-stone-600 rounded-lg pl-9 pr-3 py-2.5 text-white text-sm placeholder-stone-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-stone-400 text-sm mb-1 block">Nomor WhatsApp *</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                  <input
                    type="tel"
                    placeholder="08xx-xxxx-xxxx"
                    value={form.customer_phone}
                    onChange={e => setField("customer_phone", e.target.value)}
                    required
                    className="w-full bg-stone-800 border border-stone-600 rounded-lg pl-9 pr-3 py-2.5 text-white text-sm placeholder-stone-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <p className="text-stone-500 text-xs mt-1">Konfirmasi reservasi akan dikirim ke nomor ini</p>
              </div>
              <div>
                <label className="text-stone-400 text-sm mb-1 block">Email (opsional)</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                  <input
                    type="email"
                    placeholder="email@contoh.com"
                    value={form.customer_email}
                    onChange={e => setField("customer_email", e.target.value)}
                    className="w-full bg-stone-800 border border-stone-600 rounded-lg pl-9 pr-3 py-2.5 text-white text-sm placeholder-stone-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Special Requests */}
          <div className="bg-stone-900 border border-stone-700 rounded-2xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-amber-500" />
              Permintaan Khusus (opsional)
            </h3>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {SPECIAL_REQUEST_TYPES.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSpecial("type", form.special_requests.type === id ? "" : id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-all ${
                    form.special_requests.type === id
                      ? "bg-rose-500/20 text-rose-400 border border-rose-500"
                      : "bg-stone-800 text-stone-300 hover:bg-stone-700 border border-stone-600"
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
            {form.special_requests.type && (
              <textarea
                rows={3}
                placeholder="Ceritakan lebih detail permintaan Anda..."
                value={form.special_requests.notes}
                onChange={e => setSpecial("notes", e.target.value)}
                className="w-full bg-stone-800 border border-stone-600 rounded-lg px-3 py-2.5 text-white text-sm placeholder-stone-500 focus:border-amber-500 focus:outline-none resize-none"
              />
            )}
            <div className="mt-3">
              <label className="text-stone-400 text-sm mb-1 block">Catatan tambahan</label>
              <textarea
                rows={2}
                placeholder="Ada hal lain yang ingin kami ketahui?"
                value={form.notes}
                onChange={e => setField("notes", e.target.value)}
                className="w-full bg-stone-800 border border-stone-600 rounded-lg px-3 py-2.5 text-white text-sm placeholder-stone-500 focus:border-amber-500 focus:outline-none resize-none"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-amber-500 text-black font-semibold rounded-xl hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-base"
          >
            {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Mengirim...</> : <><ChevronRight className="w-5 h-5" /> Kirim Reservasi</>}
          </button>

          <p className="text-center text-stone-500 text-xs">
            Dengan mengirim form ini, Anda setuju dengan syarat &amp; ketentuan reservasi kami.
            Nomor yang Anda daftarkan akan otomatis terdaftar di program FnB Rewards.
          </p>
        </form>
      </div>
    </div>
  );
}
