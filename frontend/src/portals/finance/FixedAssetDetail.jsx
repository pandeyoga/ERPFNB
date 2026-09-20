/** Fixed Asset Detail — Sprint B */
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Building2, Calendar, DollarSign, TrendingDown,
  AlertTriangle, CheckCircle2, Wrench, RefreshCw, Trash2,
  ChevronRight, Loader2, Edit2, FileText,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DataTable from "@/components/shared/DataTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import api from "@/lib/api";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";

const STATUS_CONFIG = {
  active: { label: "Aktif", variant: "default", icon: CheckCircle2, color: "text-green-600" },
  disposed: { label: "Disposed", variant: "destructive", icon: Trash2, color: "text-red-600" },
  fully_depreciated: { label: "Fully Depreciated", variant: "secondary", icon: TrendingDown, color: "text-gray-600" },
  revalued: { label: "Revalued", variant: "outline", icon: RefreshCw, color: "text-blue-600" },
};

export default function FixedAssetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [asset, setAsset] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [disposeOpen, setDisposeOpen] = useState(false);
  const [revalueOpen, setRevalueOpen] = useState(false);
  const [postDepOpen, setPostDepOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Forms
  const [disposeForm, setDisposeForm] = useState({ disposal_date: "", disposal_proceeds: 0, notes: "" });
  const [revalueForm, setRevalueForm] = useState({ new_fair_value: 0, revaluation_date: "", notes: "" });
  const [postDepForm, setPostDepForm] = useState({ period: new Date().toISOString().slice(0, 7) });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, sRes] = await Promise.all([
        api.get(`/assets/${id}`),
        api.get(`/assets/${id}/schedule`),
      ]);
      if (aRes.data.success) setAsset(aRes.data.data);
      if (sRes.data.success) setSchedule(sRes.data.data.schedule || []);
    } catch (e) {
      toast.error("Gagal memuat data aset");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  if (!asset) return (
    <div className="text-center py-16 text-muted-foreground">
      <AlertTriangle className="mx-auto h-8 w-8 mb-2" />
      Aset tidak ditemukan
    </div>
  );

  const statusCfg = STATUS_CONFIG[asset.status] || STATUS_CONFIG.active;
  const StatusIcon = statusCfg.icon;
  const depPct = asset.purchase_cost > 0
    ? Math.min(100, Math.round((asset.accumulated_dep / asset.purchase_cost) * 100))
    : 0;

  async function handleDispose() {
    setSubmitting(true);
    try {
      await api.post(`/assets/${id}/dispose`, disposeForm);
      toast.success("Aset berhasil di-dispose");
      setDisposeOpen(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Dispose gagal");
    } finally { setSubmitting(false); }
  }

  async function handleRevalue() {
    setSubmitting(true);
    try {
      await api.post(`/assets/${id}/revalue`, revalueForm);
      toast.success("Revaluasi berhasil");
      setRevalueOpen(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Revaluasi gagal");
    } finally { setSubmitting(false); }
  }

  async function handlePostDep() {
    setSubmitting(true);
    try {
      await api.post(`/assets/${id}/depreciation/post`, postDepForm);
      toast.success(`Depresiasi ${postDepForm.period} berhasil diposting`);
      setPostDepOpen(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Posting gagal");
    } finally { setSubmitting(false); }
  }

  return (
    <div className="space-y-6" data-testid="fixed-asset-detail">
      {/* Header */}
      <div className="flex items-start justify-between gap-4" data-testid="asset-detail-header">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" aria-label="Kembali ke daftar aset" onClick={() => navigate("/finance/assets")}
            data-testid="asset-detail-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-semibold" data-testid="asset-detail-name">{asset.name}</h2>
              <Badge variant={statusCfg.variant} className="gap-1" data-testid="asset-detail-status">
                <StatusIcon className="h-3 w-3" />
                {statusCfg.label}
              </Badge>
            </div>
            <p className="text-muted-foreground font-mono text-sm mt-0.5" data-testid="asset-detail-code">{asset.asset_code}</p>
          </div>
        </div>
        {asset.status === "active" && (
          <div className="flex gap-2" data-testid="asset-detail-actions">
            <Button variant="outline" size="sm" onClick={() => setPostDepOpen(true)} data-testid="post-dep-btn">
              <TrendingDown className="h-4 w-4 mr-1" /> Post Depresiasi
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRevalueOpen(true)} data-testid="revalue-btn">
              <RefreshCw className="h-4 w-4 mr-1" /> Revaluasi
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setDisposeOpen(true)} data-testid="dispose-btn">
              <Trash2 className="h-4 w-4 mr-1" /> Dispose
            </Button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="asset-summary-grid">
        <Card data-testid="asset-summary-cost">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Harga Perolehan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold" data-testid="asset-purchase-cost">{formatCurrency(asset.purchase_cost)}</div>
            <div className="text-xs text-muted-foreground mt-1">Tanggal: {asset.purchase_date}</div>
          </CardContent>
        </Card>
        <Card data-testid="asset-summary-accum-dep">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Akumulasi Depresiasi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-red-600" data-testid="asset-accumulated-dep">({formatCurrency(asset.accumulated_dep)})</div>
            <Progress value={depPct} className="h-1.5 mt-2" />
            <div className="text-xs text-muted-foreground mt-1">{depPct}% dari harga perolehan</div>
          </CardContent>
        </Card>
        <Card data-testid="asset-summary-book">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Nilai Buku</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-green-600" data-testid="asset-book-value">{formatCurrency(asset.book_value)}</div>
            <div className="text-xs text-muted-foreground mt-1">Sisa: {asset.useful_life_years} tahun</div>
          </CardContent>
        </Card>
        <Card data-testid="asset-summary-method">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Metode Depresiasi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-base font-semibold capitalize" data-testid="asset-dep-method">
              {asset.dep_method === "straight_line"
                ? "Garis Lurus"
                : asset.dep_method === "sum_of_years_digits"
                ? "Jumlah Angka Tahun"
                : "Saldo Menurun"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Depresiasi terakhir: {asset.last_dep_period || "-"}</div>
          </CardContent>
        </Card>
      </div>

      {/* Info */}
      <Card data-testid="asset-info-card">
        <CardHeader><CardTitle>Informasi Aset</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8 text-sm">
            <div><span className="text-muted-foreground">Kategori: </span><span className="font-medium" data-testid="asset-info-category">{asset.category}</span></div>
            <div><span className="text-muted-foreground">Nilai Residu: </span><span className="font-medium" data-testid="asset-info-salvage">{formatCurrency(asset.salvage_value)}</span></div>
            <div><span className="text-muted-foreground">Lokasi: </span><span className="font-medium" data-testid="asset-info-location">{asset.location || "-"}</span></div>
            <div><span className="text-muted-foreground">No. Invoice: </span><span className="font-medium" data-testid="asset-info-invoice">{asset.invoice_no || "-"}</span></div>
            <div><span className="text-muted-foreground">Catatan: </span><span className="font-medium" data-testid="asset-info-notes">{asset.notes || "-"}</span></div>
          </div>
        </CardContent>
      </Card>

      {/* Depreciation Schedule */}
      <Card data-testid="dep-schedule-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> Jadwal Depresiasi
          </CardTitle>
          <CardDescription>Proyeksi {schedule.length} bulan ke depan</CardDescription>
        </CardHeader>
        <CardContent className="max-h-80 overflow-y-auto">
          <DataTable
            rows={schedule}
            keyField="period"
            rowTestIdPrefix="dep-row"
            rowClassName={(row) => row.period === asset.last_dep_period ? "bg-primary/5" : ""}
            empty={<p className="text-center text-muted-foreground py-6" data-testid="dep-schedule-empty">Tidak ada jadwal (aset tidak dapat disusutkan)</p>}
            columns={[
              { key: "period", label: "Periode", primary: true,
                render: (row) => <span className="font-mono text-sm">{row.period}</span> },
              { key: "dep_amount", label: "Depresiasi", numeric: true,
                render: (row) => <span className="text-sm">{formatCurrency(row.dep_amount)}</span> },
              { key: "accumulated_dep", label: "Akum. Dep.", numeric: true,
                render: (row) => <span className="text-sm text-red-600">({formatCurrency(row.accumulated_dep)})</span> },
              { key: "book_value", label: "Nilai Buku", numeric: true,
                render: (row) => <span className="text-sm font-semibold">{formatCurrency(row.book_value)}</span> },
            ]}
          />
        </CardContent>
      </Card>

      {/* Post Depreciation Modal */}
      <Dialog open={postDepOpen} onOpenChange={setPostDepOpen}>
        <DialogContent data-testid="post-dep-dialog">
          <DialogHeader>
            <DialogTitle>Post Depresiasi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Periode</Label>
              <Input type="month" value={postDepForm.period}
                onChange={e => setPostDepForm({ period: e.target.value })} data-testid="dep-period-input" />
            </div>
            <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
              Akan memposting jurnal depresiasi untuk {asset.name} periode {postDepForm.period}.
              Idempoten — tidak akan double-post jika sudah ada.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPostDepOpen(false)} data-testid="cancel-post-dep">Batal</Button>
            <Button onClick={handlePostDep} disabled={submitting} data-testid="confirm-post-dep">
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Post Depresiasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revalue Modal */}
      <Dialog open={revalueOpen} onOpenChange={setRevalueOpen}>
        <DialogContent data-testid="revalue-dialog">
          <DialogHeader>
            <DialogTitle>Revaluasi Aset</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nilai Wajar Baru (Rp)</Label>
              <Input type="number" placeholder="0" value={revalueForm.new_fair_value}
                onChange={e => setRevalueForm(f => ({ ...f, new_fair_value: parseFloat(e.target.value) || 0 }))}
                data-testid="fair-value-input" />
            </div>
            <div className="space-y-2">
              <Label>Tanggal Revaluasi</Label>
              <Input type="date" value={revalueForm.revaluation_date}
                onChange={e => setRevalueForm(f => ({ ...f, revaluation_date: e.target.value }))}
                data-testid="revalue-date-input" />
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea value={revalueForm.notes}
                onChange={e => setRevalueForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Alasan revaluasi..." data-testid="revalue-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevalueOpen(false)} data-testid="cancel-revalue">Batal</Button>
            <Button onClick={handleRevalue} disabled={submitting} data-testid="confirm-revalue">
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Simpan Revaluasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispose Modal */}
      <Dialog open={disposeOpen} onOpenChange={setDisposeOpen}>
        <DialogContent data-testid="dispose-dialog">
          <DialogHeader>
            <DialogTitle className="text-red-600">Dispose Aset</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700" data-testid="dispose-warning">
              <AlertTriangle className="inline h-4 w-4 mr-1" />
              Aksi ini permanen. Aset akan dikeluarkan dari register dan jurnal disposal akan diposting.
            </div>
            <div className="space-y-2">
              <Label>Tanggal Disposal</Label>
              <Input type="date" value={disposeForm.disposal_date}
                onChange={e => setDisposeForm(f => ({ ...f, disposal_date: e.target.value }))}
                data-testid="disposal-date-input" />
            </div>
            <div className="space-y-2">
              <Label>Hasil Penjualan (Rp)</Label>
              <Input type="number" placeholder="0 jika tidak ada" value={disposeForm.disposal_proceeds}
                onChange={e => setDisposeForm(f => ({ ...f, disposal_proceeds: parseFloat(e.target.value) || 0 }))}
                data-testid="disposal-proceeds-input" />
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea value={disposeForm.notes}
                onChange={e => setDisposeForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Alasan disposal..." data-testid="dispose-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisposeOpen(false)} data-testid="cancel-dispose">Batal</Button>
            <Button variant="destructive" onClick={handleDispose} disabled={submitting} data-testid="confirm-dispose">
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Konfirmasi Dispose
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
