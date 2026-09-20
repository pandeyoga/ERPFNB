import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertCircle, CheckCircle, Gift, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import axios from "axios";

const API_URL = process.env.REACT_APP_BACKEND_URL || "";

export default function RedeemModal({ open, onClose, reward, customer, token, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [redemption, setRedemption] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const pointsAfter = customer.total_points - reward.points_required;

  const handleRedeem = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await axios.post(
        `${API_URL}/api/loyalty/rewards/redeem`,
        { reward_id: reward.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setRedemption(response.data);
      setShowSuccess(true);
      toast.success("Reward berhasil ditukar! 🎉");
      
      // Notify parent
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      const message = err.response?.data?.detail || "Gagal menukar reward";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Only allow close if not loading
    if (loading) return;
    
    setShowSuccess(false);
    setRedemption(null);
    setError("");
    onClose();
  };
  
  const handleDialogOpenChange = (newOpen) => {
    // Prevent closing during loading or when showing success screen
    if (!newOpen && (loading || showSuccess)) {
      return;
    }
    if (!newOpen) {
      handleClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-md">
        <AnimatePresence mode="wait">
          {!showSuccess ? (
            <motion.div
              key="confirm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Gift className="h-5 w-5 text-primary" />
                  Konfirmasi Penukaran
                </DialogTitle>
                <DialogDescription>
                  Pastikan detail penukaran sudah benar
                </DialogDescription>
              </DialogHeader>

              <div className="py-6 space-y-4">
                {/* Reward Info */}
                <div className="p-4 rounded-lg bg-muted/50">
                  <h3 className="font-semibold mb-1">{reward.name}</h3>
                  <p className="text-sm text-muted-foreground">{reward.description}</p>
                </div>

                {/* Points Info */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Poin Anda saat ini:</span>
                    <span className="font-semibold">{customer.total_points.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Poin yang digunakan:</span>
                    <span className="font-semibold text-red-500">-{reward.points_required.toLocaleString()}</span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex justify-between">
                    <span className="font-medium">Poin setelah penukaran:</span>
                    <span className="font-bold text-primary">{pointsAfter.toLocaleString()}</span>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={handleClose} disabled={loading}>
                  Batal
                </Button>
                <Button onClick={handleRedeem} disabled={loading}>
                  {loading ? "Memproses..." : `Tukar (${reward.points_required.toLocaleString()} poin)`}
                </Button>
              </DialogFooter>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="py-8 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20 mb-4"
              >
                <CheckCircle className="h-8 w-8 text-green-500" />
              </motion.div>

              <DialogTitle className="text-2xl mb-2">Penukaran Berhasil!</DialogTitle>
              <DialogDescription className="mb-6">
                {reward.name} berhasil ditukar
              </DialogDescription>

              {/* Voucher Code */}
              {redemption?.voucher_code && (
                <div className="mb-6 p-6 rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-2 border-dashed border-primary/30">
                  <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Kode Voucher</div>
                  <div className="text-2xl font-mono font-bold text-primary mb-2 tracking-widest">
                    {redemption.voucher_code}
                  </div>
                  {redemption.expires_at && (
                    <div className="text-xs text-muted-foreground">
                      Berlaku hingga: {new Date(redemption.expires_at).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* New Points Balance */}
              <div className="mb-6 p-4 rounded-lg bg-muted/50">
                <div className="text-sm text-muted-foreground mb-1">Sisa poin Anda</div>
                <div className="text-3xl font-bold text-primary">{pointsAfter.toLocaleString()}</div>
              </div>

              <Button onClick={handleClose} className="w-full">
                Tutup
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
