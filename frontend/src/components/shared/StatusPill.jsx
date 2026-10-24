/** Status pill — maps backend status string to a labelled, colored pill.
 *
 * Satu kamus status untuk seluruh aplikasi (label + tone warna). Status yang belum
 * terdaftar tidak lagi tampil sebagai enum mentah (`converted_to_po`) — di-humanize
 * ("Converted to PO") dan diberi warna netral.
 */
import { cn } from "@/lib/utils";

const TONE = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  danger: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  accent: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
};

// key → [label, tone]
const STATUS = {
  draft: ["Draft", "neutral"],
  new: ["New", "info"],
  open: ["Open", "info"],
  pending: ["Pending", "warning"],
  submitted: ["Submitted", "info"],
  awaiting_approval: ["Menunggu Approval", "warning"],
  pending_approval: ["Menunggu Approval", "warning"],
  pending_validation: ["Menunggu Validasi", "warning"],
  validating: ["Validating", "warning"],
  validated: ["Validated", "success"],
  approved: ["Approved", "success"],
  rejected: ["Rejected", "danger"],
  returned: ["Returned", "warning"],
  in_progress: ["In Progress", "info"],
  processing: ["Processing", "info"],
  queued: ["Queued", "neutral"],
  scheduled: ["Scheduled", "info"],
  rescheduled: ["Rescheduled", "info"],
  confirmed: ["Confirmed", "success"],
  sent: ["Sent", "info"],
  sending: ["Sending", "info"],
  issued: ["Issued", "info"],
  partial: ["Partial", "warning"],
  partially_received: ["Partially Received", "warning"],
  receiving: ["Receiving", "info"],
  received: ["Received", "success"],
  in_transit: ["In Transit", "info"],
  converted: ["Converted", "accent"],
  converted_to_po: ["Converted to PO", "accent"],
  posting: ["Posting", "info"],
  posted: ["Posted", "success"],
  paying: ["Paying", "info"],
  paid: ["Paid", "success"],
  settled: ["Settled", "success"],
  repaying: ["Repaying", "info"],
  calculated: ["Calculated", "info"],
  completed: ["Completed", "success"],
  closed: ["Closed", "neutral"],
  locked: ["Locked", "neutral"],
  reopened: ["Reopened", "warning"],
  published: ["Published", "success"],
  archived: ["Archived", "neutral"],
  active: ["Aktif", "success"],
  inactive: ["Nonaktif", "neutral"],
  disabled: ["Nonaktif", "neutral"],
  expired: ["Expired", "neutral"],
  claimed: ["Claimed", "success"],
  redeemed: ["Redeemed", "success"],
  used: ["Used", "neutral"],
  cancelled: ["Cancelled", "danger"],
  canceled: ["Cancelled", "danger"],
  void: ["Void", "danger"],
  written_off: ["Written Off", "danger"],
  disposed: ["Disposed", "neutral"],
  fully_depreciated: ["Fully Depreciated", "neutral"],
  revalued: ["Revalued", "info"],
  failed: ["Failed", "danger"],
  error: ["Error", "danger"],
  ok: ["OK", "success"],
  success: ["Success", "success"],
  warn: ["Warning", "warning"],
  no_show: ["No Show", "danger"],
  seated: ["Seated", "success"],
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
        "inline-flex items-center text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap",
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
