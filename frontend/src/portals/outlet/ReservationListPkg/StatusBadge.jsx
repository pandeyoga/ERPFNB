/** ReservationList/StatusBadge.jsx
 * Status reservasi (pending, waitlist, confirmed, rescheduled, cancelled, completed, no_show)
 * memakai StatusPill global — label & warna sama dengan status di modul lain.
 */
import StatusPill from "@/components/shared/StatusPill";

export default function StatusBadge({ status }) {
  return <StatusPill status={status} />;
}
