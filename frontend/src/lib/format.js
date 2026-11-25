import dayjs from "dayjs";
import "dayjs/locale/id";
import relativeTime from "dayjs/plugin/relativeTime";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);
dayjs.locale("id");
dayjs.tz.setDefault("Asia/Jakarta");

export const TZ = "Asia/Jakarta";

/** Rp 1.234.567 with no decimals. Spasi setelah "Rp" = NBSP (\u00A0) agar "Rp" tidak terpisah
 *  dari angka saat kolom sempit (sebelumnya nominal pecah jadi dua baris di tabel). */
export function fmtRp(value, opts = {}) {
  if (value == null || isNaN(value)) return "-";
  const n = Number(value);
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("id-ID", {
    maximumFractionDigits: opts.decimals ?? 0,
  });
  return `${sign}Rp\u00A0${formatted}`;
}

export function fmtNumber(value, decimals = 0) {
  if (value == null || isNaN(value)) return "-";
  return Number(value).toLocaleString("id-ID", { maximumFractionDigits: decimals });
}

export function fmtPct(value, decimals = 1) {
  if (value == null || isNaN(value)) return "-";
  return `${(value > 0 ? "+" : "")}${Number(value).toFixed(decimals)}%`;
}

/** "23 Apr 2026" — spasi = NBSP agar tanggal tidak terpecah dua baris di kolom sempit. */
export function fmtDate(d, fmt = "DD MMM YYYY") {
  if (!d) return "-";
  return dayjs(d).tz(TZ).format(fmt).replace(/ /g, "\u00A0");
}

/** "23 Apr 2026 17:42" */
export function fmtDateTime(d) {
  if (!d) return "-";
  return dayjs(d).tz(TZ).format("DD MMM YYYY HH:mm");
}

/** "2 jam lalu" */
export function fmtRelative(d) {
  if (!d) return "-";
  return dayjs(d).fromNow();
}

export function todayJakartaISO() {
  return dayjs().tz(TZ).format("YYYY-MM-DD");
}

export function initials(name) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Aliases for consistency across codebase
export const formatCurrency = fmtRp;
export const formatDateID = fmtDate;

export { dayjs };
