/**
 * Global, promise-based confirmation dialog — a styled drop-in replacement for the
 * native window.confirm(). Keeps confirmations consistent across the whole app.
 *
 * Usage (inside an async handler):
 *   if (!(await confirmDialog("Approve PR ini?"))) return;
 *   if (!(await confirmDialog({ title: "Hapus role", description: "...", destructive: true }))) return;
 *
 * Mount <ConfirmDialogHost /> ONCE near the app root.
 */
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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

export function ConfirmDialogHost() {
  const [state, setState] = useState(null); // { cfg, resolve }

  useEffect(() => {
    const onOpen = (e) => setState(e.detail);
    window.addEventListener(EVT, onOpen);
    return () => window.removeEventListener(EVT, onOpen);
  }, []);

  if (!state) return null;
  const { cfg, resolve } = state;
  const description = cfg.description || "Apakah Anda yakin?";
  const title = cfg.title || "Konfirmasi";
  const destructive = cfg.destructive ?? DESTRUCTIVE_RE.test(`${title} ${description}`);
  const confirmText = cfg.confirmText || (destructive ? "Ya, Lanjutkan" : "Lanjutkan");
  const cancelText = cfg.cancelText || "Batal";

  const finish = (val) => { resolve(val); setState(null); };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) finish(false); }}>
      <DialogContent className="max-w-md" data-testid="confirm-dialog">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${destructive ? "bg-red-100 text-red-600 dark:bg-red-950/50" : "bg-amber-100 text-amber-600 dark:bg-amber-950/50"}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle data-testid="confirm-dialog-title">{title}</DialogTitle>
              <DialogDescription className="whitespace-pre-line" data-testid="confirm-dialog-desc">{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" className="rounded-full" onClick={() => finish(false)} data-testid="confirm-cancel">
            {cancelText}
          </Button>
          <Button
            className={`rounded-full ${destructive ? "bg-red-600 hover:bg-red-700 text-white" : "pill-active"}`}
            onClick={() => finish(true)}
            data-testid="confirm-ok"
            autoFocus
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default confirmDialog;
