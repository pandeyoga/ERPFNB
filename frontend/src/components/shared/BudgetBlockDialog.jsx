/**
 * Re-usable dialog displayed when PR creation is blocked by the Outlet
 * Operational Budget guard. Lets Outlet Manager submit an increase request
 * with reason — then auto-retries the PR submission.
 */
import { useState } from "react";
import { AlertCircle, X, Send } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { fmtRp } from "@/lib/format";
import { BUCKET_COLORS, submitIncreaseRequest } from "@/lib/outletBudgetApi";

/**
 * Props:
 *   open: bool
 *   onClose: fn
 *   verdict: object — from precheckPR (has bucket, pr_total, remaining, shortfall, budget_id, reason)
 *   outletId: string
 *   relatedPrId: string?
 *   onSubmitted: fn(req)  — called after request submitted
 */
export default function BudgetBlockDialog({ open, onClose, verdict, outletId, relatedPrId, onSubmitted }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // pre-fill amount with shortfall
  const shortfall = verdict?.shortfall || verdict?.pr_total || 0;
  const mode = verdict?.mode || "per_bucket";
  // Routed bucket: use effective_bucket which is "combined" in combined mode
  const bucket = verdict?.effective_bucket || verdict?.bucket || "kdo";
  const requestBucket = mode === "combined" ? "combined" : bucket;
  const reason_kind = verdict?.reason;
  const budget_id = verdict?.budget_id;

  const submit = async () => {
    if (!budget_id) {
      toast.error("Budget belum di-set. Hubungi Executive.");
      return;
    }
    const amt = parseFloat(amount || shortfall);
    if (!amt || amt <= 0) {
      toast.error("Jumlah harus > 0");
      return;
    }
    if ((reason || "").trim().length < 10) {
      toast.error("Alasan minimal 10 karakter");
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitIncreaseRequest({
        outlet_id: outletId,
        budget_id,
        bucket: requestBucket,
        requested_amount: amt,
        reason,
        related_pr_id: relatedPrId || null,
        related_pr_amount: verdict?.pr_total,
      });
      toast.success("Request terkirim ke Executive. Menunggu approval.");
      onSubmitted?.(res);
      onClose?.();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal kirim request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            PR Diblokir oleh Budget
          </DialogTitle>
          <DialogDescription>
            {reason_kind === "NO_BUDGET"
              ? "Periode ini belum diset budgetnya oleh Executive. Anda harus minta penetapan budget terlebih dahulu."
              : reason_kind === "BUCKET_ZERO"
                ? (mode === "combined"
                    ? "Budget gabungan periode ini = 0. Submit request agar Executive set budget."
                    : "Bucket ini bernilai 0 di periode aktif. Submit request agar Executive tambah budget.")
                : (mode === "combined"
                    ? "PR melebihi sisa budget gabungan. Submit request agar Executive menambah budget, lalu coba submit PR lagi."
                    : "PR melebihi sisa budget. Submit request agar Executive menambah budget, lalu coba submit PR lagi.")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
            <div>
              <span className="text-muted-foreground">Mode:</span>{" "}
              <Badge variant="outline" className={mode === "combined" ? "border-sky-500/40 text-sky-600 dark:text-sky-400" : "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"}>
                {mode === "combined" ? "Gabungan" : "Per-Bucket"}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Bucket PR:</span>{" "}
              <Badge variant="outline" style={{ borderColor: BUCKET_COLORS[verdict?.bucket] || "#0ea5e9" }}>
                {(verdict?.bucket || "").toUpperCase()}
              </Badge>
              {mode === "combined" && (
                <span className="text-[11px] text-muted-foreground ml-2">
                  → consume dari pool <strong>GABUNGAN</strong>
                </span>
              )}
            </div>
            <div>
              <span className="text-muted-foreground">PR Total:</span>{" "}
              <strong>{fmtRp(verdict?.pr_total)}</strong>
            </div>
            {verdict?.remaining != null && (
              <div>
                <span className="text-muted-foreground">Sisa budget:</span>{" "}
                <strong>{fmtRp(verdict.remaining)}</strong>
              </div>
            )}
            {verdict?.shortfall != null && (
              <div>
                <span className="text-muted-foreground">Kekurangan:</span>{" "}
                <strong className="text-amber-600">{fmtRp(verdict.shortfall)}</strong>
              </div>
            )}
          </div>

          {budget_id ? (
            <>
              <div>
                <Label htmlFor="amt">Jumlah Penambahan (Rp)</Label>
                <Input
                  id="amt" type="number" min="0" step="100000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={String(shortfall)}
                  className="mt-1"
                  data-testid="block-input-amount"
                />
                <div className="text-[11px] text-muted-foreground mt-1">
                  Default = nilai kekurangan {fmtRp(shortfall)}
                </div>
              </div>
              <div>
                <Label htmlFor="reason">Alasan (min 10 karakter)</Label>
                <Textarea
                  id="reason" rows={3} value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Misal: Promo musiman, demand sayur dan daging meningkat 25%…"
                  className="mt-1"
                  data-testid="block-input-reason"
                />
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">
              Executive belum menetapkan budget periode ini. Hubungi tim Executive langsung.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            <X className="h-4 w-4 mr-1" /> Tutup
          </Button>
          {budget_id && (
            <Button onClick={submit} disabled={submitting} className="pill-active gap-2" data-testid="block-btn-submit">
              <Send className="h-4 w-4" /> {submitting ? "Mengirim…" : "Kirim Request"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
