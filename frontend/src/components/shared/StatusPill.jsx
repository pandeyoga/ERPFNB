/** Status pill — maps backend status string to a labelled, colored pill.
 *
 * Satu kamus status untuk seluruh aplikasi (label + tone warna). Aturan bahasa (DESIGN_SYSTEM §10.5): status
 * persetujuan/umum Bahasa Indonesia; status akuntansi teknis Bahasa Inggris (Posted, Void, Overdue, Partial,
 * Written Off, …); Jatuh Tempo dan Lunas tetap Indonesia. Status yang belum terdaftar
 * tidak tampil sebagai enum mentah — di-humanize (mis. "Partially shipped") dengan warna netral.
 * Tab & filter status di halaman daftar memakai `statusLabel()` agar labelnya sama dengan pill.
 */
import { cn } from "@/lib/utils";

const TONE = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-blue-500/15 text-blue-800 dark:text-blue-400",
  success: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-400",
  warning: "bg-amber-500/15 text-amber-800 dark:text-amber-400",
  danger: "bg-rose-500/15 text-rose-800 dark:text-rose-400",
  accent: "bg-violet-500/15 text-violet-800 dark:text-violet-400",
};

// key → [label, tone]
const STATUS = {
  draft: ["Draft", "neutral"],
  new: ["Baru", "info"],
  open: ["Terbuka", "info"],
  pending: ["Menunggu", "warning"],
  submitted: ["Diajukan", "info"],
  awaiting_approval: ["Menunggu Approval", "warning"],
  pending_approval: ["Menunggu Approval", "warning"],
  pending_validation: ["Menunggu Validasi", "warning"],
  pending_review: ["Menunggu Review", "warning"],
  validating: ["Sedang Divalidasi", "warning"],
  validated: ["Tervalidasi", "success"],
  approved: ["Disetujui", "success"],
  rejected: ["Ditolak", "danger"],
  returned: ["Dikembalikan", "warning"],
  in_progress: ["Dalam Proses", "info"],
  processing: ["Diproses", "info"],
  queued: ["Antre", "neutral"],
  scheduled: ["Terjadwal", "info"],
  rescheduled: ["Dijadwal Ulang", "info"],
  confirmed: ["Dikonfirmasi", "success"],
  sent: ["Terkirim", "info"],
  sending: ["Mengirim", "info"],
  issued: ["Diterbitkan", "info"],
  partial: ["Partial", "warning"],
  partially_received: ["Partial", "warning"],
  receiving: ["Proses Terima", "info"],
  received: ["Diterima", "success"],
  in_transit: ["Dalam Perjalanan", "info"],
  converted: ["Dikonversi", "accent"],
  converted_to_po: ["Dikonversi ke PO", "accent"],
  posting: ["Posting", "info"],
  posted: ["Posted", "success"],
  paying: ["Proses Bayar", "info"],
  paid: ["Dibayar", "success"],
  settled: ["Lunas", "success"],
  repaying: ["Cicilan Berjalan", "info"],
  calculated: ["Dihitung", "info"],
  completed: ["Selesai", "success"],
  closed: ["Ditutup", "neutral"],
  overdue: ["Overdue", "danger"],
  due: ["Jatuh Tempo", "warning"],
  locked: ["Dikunci", "neutral"],
  reopened: ["Dibuka Ulang", "warning"],
  published: ["Published", "success"],
  archived: ["Diarsipkan", "neutral"],
  active: ["Aktif", "success"],
  inactive: ["Nonaktif", "neutral"],
  disabled: ["Nonaktif", "neutral"],
  expired: ["Kedaluwarsa", "neutral"],
  claimed: ["Diklaim", "success"],
  redeemed: ["Ditukar", "success"],
  used: ["Terpakai", "neutral"],
  cancelled: ["Dibatalkan", "danger"],
  canceled: ["Dibatalkan", "danger"],
  void: ["Void", "danger"],
  written_off: ["Written Off", "danger"],
  disposed: ["Disposed", "neutral"],
  fully_depreciated: ["Fully Depreciated", "neutral"],
  revalued: ["Revalued", "info"],
  failed: ["Gagal", "danger"],
  error: ["Error", "danger"],
  ok: ["OK", "success"],
  success: ["Berhasil", "success"],
  warn: ["Peringatan", "warning"],
  no_show: ["Tidak Hadir", "danger"],
  seated: ["Sudah Datang", "success"],
  waitlist: ["Waitlist", "warning"],
  done: ["Selesai", "success"],
};


const ACRONYMS = new Set(["po", "pr", "gr", "ap", "ar", "je", "rfq", "ok", "fdo", "kdo", "bdo"]);

function humanize(key) {
  return key
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w, i) => (ACRONYMS.has(w) ? w.toUpperCase() : i === 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Label status yang sama dengan StatusPill (untuk teks/opsi filter). */
export function statusLabel(status) {
  if (!status) return "—";
  const key = String(status).toLowerCase();
  return STATUS[key]?.[0] || humanize(key);
}

export default function StatusPill({ status, className, label }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const key = String(status).toLowerCase();
  const [knownLabel, tone] = STATUS[key] || [humanize(key), "neutral"];
  return (
    <span
      className={cn(
        // Tinggi tetap (h-5) + leading-none: tanpa ini tinggi pill mengikuti line-height induk
        // (terukur 18/20/24px berbeda per halaman).
        "inline-flex h-5 items-center px-2 text-xs leading-none rounded-full font-medium whitespace-nowrap",
        `status-${key}`,
        TONE[tone],
        className,
      )}
      data-status={key}
    >
      {label || knownLabel}
    </span>
  );
}
