/**
 * Global, promise-based confirmation dialog — a styled drop-in replacement for the
 * native window.confirm(). Keeps confirmations consistent across the whole app.
 *
 * Usage (inside an async handler):
 *   if (!(await confirmDialog("Approve PR ini?"))) return;
 *   if (!(await confirmDialog({ title: "Hapus role", description: "...", destructive: true }))) return;
 *
 * <ConfirmDialogHost /> di-mount sekali di App.js (juga melayani promptDialog).
 */
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle } from "lucide-react";

const EVT = "app:confirm-dialog";

// Words that imply a destructive/irreversible action -> red confirm button.
const DESTRUCTIVE_RE = /(hapus|nonaktif|cabut|arsip|reset|tolak|reject|batalk|archival|hapus|delete|tutup|close|lock)/i;

/**
 * Show a confirmation dialog. Returns Promise<boolean> (true = confirmed).
 * @param {string|object} opts - message string, or { title, description, confirmText, cancelText, destructive }
 */
export function confirmDialog(opts) {
  const cfg = typeof opts === "string" ? { description: opts } : (opts || {});
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    window.dispatchEvent(new CustomEvent(EVT, { detail: { cfg, resolve } }));
  });
}

/**
 * Prompt dialog — pengganti window.prompt() dengan input berlabel (mis. alasan penolakan).
 * Returns Promise<string|null> (null = dibatalkan).
 * @param {object} opts - { title, description, label, placeholder, defaultValue, required,
 *                          multiline, confirmText, cancelText, destructive, testId }
 *   testId → `${testId}` (dialog), `${testId}-input`, `${testId}-confirm`, `${testId}-cancel`
 */
export function promptDialog(opts) {
  const cfg = { ...(typeof opts === "string" ? { title: opts } : (opts || {})), prompt: true };
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(null);
    window.dispatchEvent(new CustomEvent(EVT, { detail: { cfg, resolve } }));
  });
}

/** Mount SEKALI di root aplikasi (App.js). Tanpa host ini confirmDialog/promptDialog
 * tidak pernah selesai (Promise menggantung) dan tombol yang memakainya tidak bereaksi. */
export function ConfirmDialogHost() {
  const [state, setState] = useState(null); // { cfg, resolve }
  const [value, setValue] = useState("");

  useEffect(() => {
    const onOpen = (e) => { setValue(e.detail?.cfg?.defaultValue || ""); setState(e.detail); };
    window.addEventListener(EVT, onOpen);
    return () => window.removeEventListener(EVT, onOpen);
  }, []);

  if (!state) return null;
  const { cfg, resolve } = state;
  const isPrompt = !!cfg.prompt;
  const description = cfg.description || (isPrompt ? "" : "Apakah Anda yakin?");
  const title = cfg.title || "Konfirmasi";
  const destructive = cfg.destructive ?? DESTRUCTIVE_RE.test(`${title} ${description}`);
  const confirmText = cfg.confirmText || (isPrompt ? "Simpan" : destructive ? "Ya, Lanjutkan" : "Lanjutkan");
  const cancelText = cfg.cancelText || "Batal";
  const required = isPrompt && cfg.required !== false;
  const invalid = required && !value.trim();

  const finish = (val) => { resolve(val); setState(null); };
  const cancel = () => finish(isPrompt ? null : false);
  const ok = () => { if (isPrompt) { if (!invalid) finish(value.trim()); } else finish(true); };
  const InputEl = cfg.multiline === false ? Input : Textarea;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) cancel(); }}>
      <DialogContent className="max-w-md" data-testid={cfg.testId || (isPrompt ? "prompt-dialog" : "confirm-dialog")}>
        <DialogHeader>
          <div className="flex items-start gap-3">
            {!isPrompt && (
              <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${destructive ? "bg-red-100 text-red-700 dark:text-red-400 dark:bg-red-950/50" : "bg-amber-100 text-amber-800 dark:text-amber-400 dark:bg-amber-950/50"}`}>
                <AlertTriangle className="h-4 w-4" />
              </div>
            )}
            <div className="space-y-1">
              <DialogTitle data-testid="confirm-dialog-title">{title}</DialogTitle>
              {description && (
                <DialogDescription className="whitespace-pre-line" data-testid="confirm-dialog-desc">{description}</DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>
        {isPrompt && (
          <div className="space-y-1.5">
            <Label htmlFor="prompt-dialog-input">{cfg.label || "Alasan"}{required && " *"}</Label>
            <InputEl
              id="prompt-dialog-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={cfg.placeholder || ""}
              rows={3}
              autoFocus
              data-testid={cfg.testId ? `${cfg.testId}-input` : "prompt-dialog-input"}
            />
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={cancel} data-testid={cfg.testId ? `${cfg.testId}-cancel` : "confirm-cancel"}>
            {cancelText}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={ok}
            disabled={invalid}
            data-testid={cfg.testId ? `${cfg.testId}-confirm` : "confirm-ok"}
            autoFocus={!isPrompt}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default confirmDialog;
