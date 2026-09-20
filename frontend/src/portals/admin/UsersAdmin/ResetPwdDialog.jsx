/** ResetPwdDialog — password reset modal. */
import { useEffect, useState } from "react";
import {
  Plus, Edit2, Trash2, Search, KeyRound, Building2, Store, Globe2,
  ShieldCheck, Users2, UserCog,
} from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { fmtRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import useOutletScope from "@/hooks/useOutletScope";

/* ─── Access Level helper ──────────────────────────────────────────── */

function ResetPwdDialog({ target, onClose }) {
  const [pw, setPw] = useState("");
  const [saving, setSaving] = useState(false);
  if (!target) return null;
  const submit = async () => {
    if (pw.length < 8) { toast.error("Min 8 karakter"); return; }
    setSaving(true);
    try {
      await api.post(`/admin/users/${target.id}/reset-password`, { new_password: pw });
      toast.success("Password direset");
      setPw("");
      onClose();
    } catch (e) {
      toast.error("Gagal reset");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-card max-w-md" data-testid="reset-pwd-dialog">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>Untuk: {target.full_name} ({target.email})</DialogDescription>
        </DialogHeader>
        <Field label="Password Baru (min 8)">
          <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)}
                 className="glass-input" autoFocus data-testid="reset-pwd-input" />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="reset-pwd-cancel">Batal</Button>
          <Button onClick={submit} disabled={saving} className="pill-active" data-testid="reset-pwd-save">
            {saving ? "…" : "Reset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Helpers ──────────────────────────────────────────────────────── */
function Section({ title, children, badge }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
        {badge}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children, className }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export default ResetPwdDialog;
export { Section, Field };
