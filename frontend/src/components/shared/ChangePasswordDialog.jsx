/** ChangePasswordDialog — staff self-service password change.
 * Parity gap (PARITY_AUDIT Kategori A, P1): backend POST /auth/change-password
 * existed but the UserMenu "Change Password" item was a dead placeholder.
 */
import { useState } from "react";
import { KeyRound, Loader2, Eye, EyeOff, Check, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import api, { unwrapError } from "@/lib/api";
import { toast } from "sonner";

// Mirrors backend core/validators.validate_password_strength
const RULES = [
  { id: "len", label: "Minimal 8 karakter", test: (v) => v.length >= 8 },
  { id: "upper", label: "1 huruf besar (A-Z)", test: (v) => /[A-Z]/.test(v) },
  { id: "lower", label: "1 huruf kecil (a-z)", test: (v) => /[a-z]/.test(v) },
  { id: "num", label: "1 angka (0-9)", test: (v) => /[0-9]/.test(v) },
  { id: "special", label: "1 karakter spesial (!@#$…)", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

// Module-scope component (NOT defined inside the dialog) so typing doesn't
// remount the input and lose focus after each keystroke.
function PwField({ id, label, value, onChange, showValue, onToggleShow, placeholder, autoComplete }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={showValue ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="pr-10"
          data-testid={`change-pwd-${id}`}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={onToggleShow}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={showValue ? "Sembunyikan password" : "Tampilkan password"}
        >
          {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export default function ChangePasswordDialog({ open, onOpenChange }) {
  const [form, setForm] = useState({ old_password: "", new_password: "", confirm: "" });
  const [show, setShow] = useState({ old: false, neu: false, conf: false });
  const [submitting, setSubmitting] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const reset = () => { setForm({ old_password: "", new_password: "", confirm: "" }); setShow({ old: false, neu: false, conf: false }); };

  const rulesPass = RULES.map((r) => ({ ...r, ok: r.test(form.new_password) }));
  const allRulesOk = rulesPass.every((r) => r.ok);
  const matchOk = form.new_password.length > 0 && form.new_password === form.confirm;
  const canSubmit = form.old_password.length > 0 && allRulesOk && matchOk && !submitting;

  async function handleSubmit(e) {
    e?.preventDefault?.();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await api.post("/auth/change-password", {
        old_password: form.old_password,
        new_password: form.new_password,
      });
      toast.success("Password berhasil diubah");
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(unwrapError(err) || "Gagal mengubah password");
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenChange(v) {
    if (!v) reset();
    onOpenChange(v);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" data-testid="change-password-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" /> Ganti Password
          </DialogTitle>
          <DialogDescription>
            Demi keamanan, masukkan password lama lalu password baru yang kuat.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <PwField id="old" label="Password Lama" value={form.old_password}
            onChange={(e) => set("old_password", e.target.value)}
            showValue={show.old} onToggleShow={() => setShow((s) => ({ ...s, old: !s.old }))}
            placeholder="Password saat ini" autoComplete="current-password" />
          <PwField id="new" label="Password Baru" value={form.new_password}
            onChange={(e) => set("new_password", e.target.value)}
            showValue={show.neu} onToggleShow={() => setShow((s) => ({ ...s, neu: !s.neu }))}
            placeholder="Password baru" autoComplete="new-password" />

          {/* Strength checklist */}
          {form.new_password.length > 0 && (
            <ul className="grid grid-cols-1 gap-1 rounded-lg bg-muted/40 p-2.5" data-testid="change-pwd-rules">
              {rulesPass.map((r) => (
                <li key={r.id} className={`flex items-center gap-1.5 text-xs ${r.ok ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                  {r.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                  {r.label}
                </li>
              ))}
            </ul>
          )}

          <PwField id="confirm" label="Konfirmasi Password Baru" value={form.confirm}
            onChange={(e) => set("confirm", e.target.value)}
            showValue={show.conf} onToggleShow={() => setShow((s) => ({ ...s, conf: !s.conf }))}
            placeholder="Ulangi password baru" autoComplete="new-password" />
          {form.confirm.length > 0 && !matchOk && (
            <p className="text-xs text-destructive" data-testid="change-pwd-mismatch">Password baru dan konfirmasi tidak sama</p>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting} data-testid="change-pwd-cancel">
              Batal
            </Button>
            <Button type="submit" disabled={!canSubmit} data-testid="change-pwd-submit">
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Simpan Password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
