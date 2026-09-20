/**
 * CMS Version History Dialog
 * Shows version list for a CMS item + allow restore.
 */
import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { History, RotateCcw, Loader2, Clock, User, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

export default function CMSVersionHistory({ open, onClose, contentType, itemId, itemName, onRestored }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(null);

  const load = async () => {
    if (!open || !itemId) return;
    setLoading(true);
    try {
      const r = await api.get(`/admin/cms/${contentType}/${itemId}/versions`);
      setVersions(r.data?.data || []);
    } catch {
      toast.error("Gagal memuat version history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [open, itemId]); // eslint-disable-line

  const handleRestore = async (versionNum) => {
    setRestoring(versionNum);
    try {
      await api.post(`/admin/cms/${contentType}/${itemId}/versions/${versionNum}/restore`);
      toast.success(`Konten dipulihkan ke versi ${versionNum}`);
      onRestored?.();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal memulihkan versi");
    } finally {
      setRestoring(null);
    }
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return "-";
    try {
      return new Date(isoStr).toLocaleString("id-ID", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return isoStr; }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Version History
          </DialogTitle>
          <DialogDescription>
            {itemName ? `Riwayat perubahan: ${itemName}` : "Riwayat versi konten ini"}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : versions.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Belum ada version history.{" "}
            <span className="block text-xs mt-1">History akan tersimpan otomatis setiap kali Anda menyimpan perubahan.</span>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2 pr-2">
              {versions.map((v, idx) => (
                <div
                  key={v.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 hover:bg-accent/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={idx === 0 ? "default" : "outline"} className="text-xs h-5">
                        v{v.version_num}
                      </Badge>
                      {idx === 0 && (
                        <Badge variant="secondary" className="text-xs h-5">Terbaru</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatDate(v.saved_at)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <User className="h-3 w-3" />
                      <span>{v.saved_by}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => handleRestore(v.version_num)}
                    disabled={restoring === v.version_num}
                    data-testid={`restore-version-${v.version_num}`}
                  >
                    {restoring === v.version_num ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" />
                    )}
                    <span className="ml-1.5">Pulihkan</span>
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <Separator />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
