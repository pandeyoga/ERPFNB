/** ProfileDialog — read-only account profile.
 * Replaces the dead "Profile" placeholder in UserMenu (consistency with Phase 2
 * "no dead affordance" principle).
 */
import { useEffect } from "react";
import { User as UserIcon, Mail, Phone, ShieldCheck, Globe2, Store, Building2, LayoutGrid } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { initials, formatDateID } from "@/lib/format";

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</div>
        <div className="text-sm font-medium break-words">{value || "—"}</div>
      </div>
    </div>
  );
}

export default function ProfileDialog({ open, onOpenChange }) {
  const { user, refreshMe } = useAuth();

  useEffect(() => {
    if (open) refreshMe?.();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  const perms = user.permissions || [];
  const isFullAccess = perms.includes("*");
  const outletCount = (user.outlet_ids || []).length;
  const brandCount = (user.brand_ids || []).length;

  let scopeValue;
  if (isFullAccess) scopeValue = "Full Access — semua brand & outlet";
  else if (outletCount > 0) scopeValue = `Dibatasi: ${outletCount} outlet · ${brandCount} brand`;
  else scopeValue = "Tidak ada scope outlet khusus";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="profile-dialog">
        <DialogHeader>
          <DialogTitle>Profil Akun</DialogTitle>
          <DialogDescription>Informasi akun Anda (hanya-baca).</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 pb-2 border-b border-border">
          <div className="h-12 w-12 rounded-full grad-aurora flex items-center justify-center text-white text-base font-bold">
            {initials(user.full_name)}
          </div>
          <div className="min-w-0">
            <div className="text-base font-semibold truncate" data-testid="profile-name">{user.full_name}</div>
            <div className="text-xs text-muted-foreground truncate">{user.email}</div>
          </div>
        </div>

        <div className="divide-y divide-border/60">
          <Row icon={Mail} label="Email" value={user.email} />
          <Row icon={Phone} label="Telepon" value={user.phone} />
          <Row icon={LayoutGrid} label="Portal Default" value={user.default_portal} />
          <Row
            icon={isFullAccess ? Globe2 : Store}
            label="Akses Data"
            value={scopeValue}
          />
          <Row icon={ShieldCheck} label="Permissions" value={isFullAccess ? "Semua (superadmin)" : `${perms.length} permission`} />
          {user.last_login_at && (
            <Row icon={Building2} label="Login Terakhir" value={formatDateID(user.last_login_at)} />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="profile-close">Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
