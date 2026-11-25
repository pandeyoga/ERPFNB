/**
 * LegacyRedirect — pengganti route lama yang dulu menduplikasi tab sebuah hub.
 *
 * Halaman duplikatnya sudah dihapus; URL lama (bookmark, notifikasi, email, link backend)
 * tetap berfungsi karena diarahkan ke tab hub yang benar. Query lama ikut dibawa
 * (mis. `/finance/anomalies?id=…` → `/finance/period-closing?phase=1&id=…`); param milik
 * tujuan (tab/phase/type) tidak ditimpa. `rename` memetakan param lama yang bentrok dengan param
 * hub ke nama baru (mis. `/hr/payroll?tab=salary` → `/hr/compensation?tab=payroll&view=salary`).
 */
import { Navigate, useLocation } from "react-router-dom";

export default function LegacyRedirect({ to, rename = {} }) {
  const { search, hash } = useLocation();
  const [path, query = ""] = to.split("?");
  const params = new URLSearchParams(query);
  new URLSearchParams(search).forEach((value, key) => {
    const target = rename[key] || key;
    if (!params.has(target)) params.set(target, value);
  });
  const qs = params.toString();
  return <Navigate to={`${path}${qs ? `?${qs}` : ""}${hash}`} replace />;
}
