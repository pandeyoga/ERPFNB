/** Period Lock guard banner — Phase 3 hardening.
 *
 * Watches a target date prop; resolves to a YYYY-MM period; queries
 * `/api/finance/periods/{period}/lock-status`. If the period is locked or
 * closed, renders a red/amber warning banner. Optionally exposes a
 * `disabled` boolean via `onLockState` callback.
 *
 * Props:
 *   date           string   — ISO date or YYYY-MM
 *   action         string   — e.g. "submit Journal Entry"
 *   onLockState    fn       — ({ locked, closed, info }) => void
 *   className      string
 *   blockOnClosed  bool     — default true; if false, only hard-locked is treated as blocking
 */
import { useEffect, useState } from "react";
import { Lock, AlertTriangle, Info } from "lucide-react";
import api, { unwrap } from "@/lib/api";

function toPeriod(date) {
  if (!date) return null;
  const s = String(date);
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 7);
  // try to parse arbitrary date
  try {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
  } catch (e) { /* ignore */ }
  return null;
}

export default function PeriodLockBanner({
  date, action = "posting di period ini", onLockState,
  className = "", blockOnClosed = true,
}) {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    const period = toPeriod(date);
    if (!period) { setInfo(null); onLockState?.({ locked: false, closed: false, info: null }); return; }
    let cancelled = false;
    api.get(`/finance/periods/${period}/lock-status`)
      .then(r => {
        if (cancelled) return;
        const data = unwrap(r);
        setInfo(data || null);
        onLockState?.({
          locked: !!data?.locked,
          closed: !!data?.closed,
          info: data,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setInfo(null);
        onLockState?.({ locked: false, closed: false, info: null });
      });
    return () => { cancelled = true; };
  }, [date]); // eslint-disable-line

  if (!info || info.status === "open") return null;
  const blocked = info.locked || (blockOnClosed && info.closed);
  const Icon = info.locked ? Lock : (blocked ? AlertTriangle : Info);
  const tone = info.locked
    ? "bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-300"
    : info.closed && blockOnClosed
      ? "bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300"
      : "bg-blue-500/10 border-blue-500/40 text-blue-700 dark:text-blue-300";

  const label = info.locked
    ? `Period ${info.period} sudah LOCKED`
    : `Period ${info.period} sudah CLOSED`;

  return (
    <div
      className={`glass-card p-3 border-l-4 ${tone} ${className} flex items-start gap-2.5`}
      data-testid="period-lock-banner"
      role="alert"
    >
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="flex-1 text-xs">
        <div className="font-semibold">{label}</div>
        <div className="opacity-90 mt-0.5">
          {action} ditolak karena period ini sudah {info.locked ? "locked" : "closed"}.
          {info.lock_reason && <> Alasan: “{info.lock_reason}”.</>}
          {" "}Pilih tanggal di period yang masih open atau hubungi Finance Manager untuk reopen.
        </div>
      </div>
    </div>
  );
}
