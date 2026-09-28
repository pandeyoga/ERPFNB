/**
 * CMSPendingReviews — Sprint I: Review queue dashboard
 * Shows all content types awaiting review + quick approve/reject actions.
 */
import { useState, useEffect, useCallback } from "react";
import { Clock, CheckCircle2, XCircle, RefreshCw, Loader2, Globe, Newspaper, Tag, UtensilsCrossed, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import api from "@/lib/api";

const TYPE_CONFIG = {
  brand:  { label: "Brand",  icon: Globe,           color: "bg-purple-100 text-purple-700" },
  news:   { label: "News",   icon: Newspaper,        color: "bg-blue-100 text-blue-700" },
  outlet: { label: "Outlet", icon: Tag,              color: "bg-teal-100 text-teal-700" },
  menu:   { label: "Menu",   icon: UtensilsCrossed,  color: "bg-orange-100 text-orange-700" },
};

export default function CMSPendingReviews() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [modalAction, setModalAction] = useState(null); // { type: "approve"|"reject", item }
  const [comment, setComment] = useState("");
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = typeFilter !== "all" ? { content_type: typeFilter } : {};
      const r = await api.get("/admin/cms/pending-reviews", { params });
      setItems(r.data?.data?.items || []);
      setTotal(r.data?.data?.total || 0);
    } catch { toast.error("Gagal memuat pending reviews"); }
    finally { setLoading(false); }
  }, [typeFilter]);

  useEffect(() => { load(); }, [load]);

  const doAction = async () => {
    if (!modalAction) return;
    const { type, item } = modalAction;
    const ct = item._content_type;
    const id = item.id;
    if (type === "reject" && !comment.trim()) { toast.error("Berikan alasan penolakan"); return; }
    setActing(true);
    try {
      if (type === "approve") {
        await api.post(`/admin/cms/${ct}/${id}/approve`, { comment: comment || "Approved" });
        toast.success(`"${item.name || item.title}" disetujui dan dipublish!`);
      } else {
        await api.post(`/admin/cms/${ct}/${id}/reject`, { comment });
        toast.success(`"${item.name || item.title}" ditolak`);
      }
      setModalAction(null);
      setComment("");
      await load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal memproses");
    } finally { setActing(false); }
  };

  const getTitle = (item) => item.name || item.title || item.id;
  const getSubtitle = (item) => item.tagline || item.excerpt || item.category || item.brand_name || "";
  const getImage = (item) => item.card_image || item.hero_image || item.image || null;

  const TYPES = ["all", "brand", "news", "outlet", "menu"];

  return (
    <div className="space-y-5" data-testid="cms-pending-reviews">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-600" />
            Pending Reviews
            {total > 0 && (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200">{total}</Badge>
            )}
          </h3>
          <p className="text-sm text-muted-foreground">Konten yang menunggu persetujuan editor.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {/* Type Filter */}
      <div className="flex gap-2 items-center flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {TYPES.map(t => (
          <Button key={t} size="sm" variant={typeFilter === t ? "default" : "outline"}
                  onClick={() => setTypeFilter(t)}
                  data-testid={`filter-type-${t}`}>
            {t === "all" ? "Semua" : TYPE_CONFIG[t]?.label || t}
          </Button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-amber-600" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-20">
          <CheckCircle2 className="h-14 w-14 mx-auto mb-4 text-green-400" />
          <h4 className="font-semibold text-lg">Semua bersih!</h4>
          <p className="text-muted-foreground text-sm mt-1">Tidak ada konten yang menunggu review saat ini.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map(item => {
            const ct = item._content_type;
            const cfg = TYPE_CONFIG[ct] || {};
            const Icon = cfg.icon || Globe;
            const img = getImage(item);
            return (
              <div key={item.id}
                   className="border rounded-xl p-4 bg-white flex items-start gap-4 hover:shadow-md transition-shadow"
                   data-testid={`review-item-${item.id}`}>
                {/* Image / Icon */}
                <div className="w-14 h-14 rounded-lg flex-shrink-0 overflow-hidden bg-muted flex items-center justify-center">
                  {img
                    ? <img src={img} alt={getTitle(item)} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    : <Icon className="h-6 w-6 text-muted-foreground" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold line-clamp-1">{getTitle(item)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </div>
                  {getSubtitle(item) && (
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{getSubtitle(item)}</p>
                  )}
                  {item.submitted_by && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Dikirim oleh <strong>{item.submitted_by}</strong>
                      {item.submitted_at && ` · ${new Date(item.submitted_at).toLocaleString("id-ID", {dateStyle:"short",timeStyle:"short"})}`}
                    </p>
                  )}
                  {item.review_comment && (
                    <p className="text-xs text-red-600 mt-1 line-clamp-1">⚠️ {item.review_comment}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button size="sm" variant="outline"
                          className="border-green-300 text-green-700 hover:bg-green-50"
                          onClick={() => { setComment(""); setModalAction({ type: "approve", item }); }}
                          data-testid={`approve-btn-${item.id}`}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Approve
                  </Button>
                  <Button size="sm" variant="outline"
                          className="border-red-300 text-red-700 hover:bg-red-50"
                          onClick={() => { setComment(""); setModalAction({ type: "reject", item }); }}
                          data-testid={`reject-btn-${item.id}`}>
                    <XCircle className="h-3.5 w-3.5 mr-1.5" /> Reject
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Action Modal */}
      <Dialog open={!!modalAction} onOpenChange={() => { setModalAction(null); setComment(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${modalAction?.type === "approve" ? "text-green-700" : "text-red-700"}`}>
              {modalAction?.type === "approve"
                ? <><CheckCircle2 className="h-5 w-5" /> Setujui & Publish</>
                : <><XCircle className="h-5 w-5" /> Tolak Konten</>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {modalAction && (
              <p className="text-sm font-medium line-clamp-2">
                {modalAction.type === "approve" ? "Publish: " : "Tolak: "}
                &ldquo;{getTitle(modalAction.item)}&rdquo;
              </p>
            )}
            <div className="space-y-1">
              <label className="text-sm font-medium">
                {modalAction?.type === "approve" ? "Catatan (opsional)" : "Alasan Penolakan *"}
              </label>
              <Textarea rows={3} value={comment} onChange={e => setComment(e.target.value)}
                        placeholder={modalAction?.type === "approve" ? "Catatan approval..." : "Jelaskan alasan penolakan..."} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalAction(null)}>Batal</Button>
            <Button
              className={modalAction?.type === "approve" ? "bg-green-600 hover:bg-green-700 text-white" : ""}
              variant={modalAction?.type === "reject" ? "destructive" : "default"}
              onClick={doAction} disabled={acting}>
              {acting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {modalAction?.type === "approve" ? "Setujui & Publish" : "Tolak"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
