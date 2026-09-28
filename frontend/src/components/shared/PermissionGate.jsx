/** PermissionGate — Phase 3.
 *
 * <PermissionGate perm="finance.period.lock"> ... </PermissionGate>
 *
 * Shows children if user has the perm; otherwise renders a fallback
 * (default: <ForbiddenPage requiredPerm={...}/>).
 */
import ForbiddenPage from "@/components/shared/ForbiddenPage";
import { useAuth } from "@/lib/auth";

export default function PermissionGate({ perm, anyOf, children, fallback }) {
  const { can, user } = useAuth();
  if (!user) return null;
  let allowed = false;
  if (perm) allowed = can(perm);
  else if (Array.isArray(anyOf)) allowed = anyOf.some(p => can(p));
  else allowed = true;
  if (allowed) return <>{children}</>;
  if (fallback) return fallback;
  return <ForbiddenPage requiredPerm={perm || (anyOf || []).join(" | ") || "unknown"} />;
}
