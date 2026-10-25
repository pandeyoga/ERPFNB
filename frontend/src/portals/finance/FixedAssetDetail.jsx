/** Fixed Asset Detail — Sprint B */
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Building2, TrendingDown, Wallet, BookOpen, Settings2,
  AlertTriangle, RefreshCw, Trash2,
  Loader2, FileText,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusPill from "@/components/shared/StatusPill";
import DataTable from "@/components/shared/DataTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/shared/PageHeader";
import CompactStatCard from "@/components/shared/CompactStatCard";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import api from "@/lib/api";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";

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

  const backBtn = (
    <Button variant="ghost" size="sm" className="-ml-2 mb-1 text-muted-foreground" onClick={() => navigate("/finance/assets")}
      data-testid="asset-detail-back">
      <ArrowLeft /> Kembali ke Fixed Assets
    </Button>
  );

  if (loading) return (
    <div data-testid="fixed-asset-detail">
      {backBtn}
      <LoadingState rows={6} />
    </div>
  );

  if (!asset) return (
    <div data-testid="fixed-asset-detail">
      {backBtn}
      <EmptyState icon={AlertTriangle} title="Aset tidak ditemukan"
        description="Aset mungkin sudah dihapus atau tautan tidak valid."
        action={<Button variant="outline" size="sm" onClick={() => navigate("/finance/assets")}>Lihat daftar aset</Button>} />
    </div>
  );

  const depPct = asset.purchase_cost > 0
    ? Math.min(100, Math.round((asset.accumulated_dep / asset.purchase_cost) * 100))
    : 0;

  async function handleDispose() {
    setSubmitting(true);
    try {
      await api.post(`/assets/${id}/dispose`, disposeForm);
      toast.success("Pelepasan aset berhasil diposting");
      setDisposeOpen(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Pelepasan aset gagal");
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
    <div data-testid="fixed-asset-detail">
      {backBtn}
      <PageHeader
        icon={Building2}
        testId="asset-detail-header"
        title={<span data-testid="asset-detail-name">{asset.name}</span>}
        subtitle={<span className="font-medium tabular-nums" data-testid="asset-detail-code">{asset.asset_code}</span>}
        actions={asset.status === "active" && (
          <div className="flex flex-wrap gap-2" data-testid="asset-detail-actions">
            <Button variant="outline" onClick={() => setPostDepOpen(true)} data-testid="post-dep-btn">
              <TrendingDown /> Posting Depresiasi
            </Button>
            <Button variant="outline" onClick={() => setRevalueOpen(true)} data-testid="revalue-btn">
              <RefreshCw /> Revaluasi
            </Button>
            <Button variant="destructive" onClick={() => setDisposeOpen(true)} data-testid="dispose-btn">
              <Trash2 /> Lepas Aset
            </Button>
          </div>
        )}
      >
        <span data-testid="asset-detail-status"><StatusPill status={asset.status} /></span>
      </PageHeader>

      <div className="space-y-3 lg:space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="asset-summary-grid">
        <CompactStatCard testId="asset-summary-cost" label="Harga perolehan" icon={Wallet} color="aurora-1"
          value={<span data-testid="asset-purchase-cost">{formatCurrency(asset.purchase_cost)}</span>}
          sub={`Tanggal: ${asset.purchase_date || "-"}`} />
        <CompactStatCard testId="asset-summary-accum-dep" label="Akumulasi depresiasi" icon={TrendingDown} color="aurora-6" tone="danger"
          value={<span data-testid="asset-accumulated-dep">({formatCurrency(asset.accumulated_dep)})</span>}
          sub={`${depPct}% dari harga perolehan`} />
        <CompactStatCard testId="asset-summary-book" label="Nilai buku" icon={BookOpen} color="aurora-4" tone="success"
          value={<span data-testid="asset-book-value">{formatCurrency(asset.book_value)}</span>}
          sub={`Masa manfaat: ${asset.useful_life_years} tahun`} />
        <CompactStatCard testId="asset-summary-method" label="Metode depresiasi" icon={Settings2} color="aurora-2"
          value={(
            <span data-testid="asset-dep-method">
              {asset.dep_method === "straight_line"
                ? "Garis Lurus"
                : asset.dep_method === "sum_of_years_digits"
                ? "Jumlah Angka Tahun"
                : "Saldo Menurun"}
            </span>
          )}
          sub={`Depresiasi terakhir: ${asset.last_dep_period || "-"}`} />
      </div>

      {/* Info */}
      <Card data-testid="asset-info-card">
        <CardHeader><CardTitle>Informasi Aset</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-sm">
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
        <CardContent className="max-h-80 overflow-y-auto p-0">
          <DataTable
            rows={schedule}
            keyField="period"
            rowTestIdPrefix="dep-row"
            rowClassName={(row) => row.period === asset.last_dep_period ? "bg-primary/5" : ""}
            empty={<p className="text-center text-sm text-muted-foreground py-6" data-testid="dep-schedule-empty">Tidak ada jadwal (aset tidak dapat disusutkan)</p>}
            columns={[
              { key: "period", label: "Periode", primary: true,
                render: (row) => <span className="text-sm font-medium tabular-nums">{row.period}</span> },
              { key: "dep_amount", label: "Depresiasi", numeric: true,
                render: (row) => <span className="text-sm">{formatCurrency(row.dep_amount)}</span> },
              { key: "accumulated_dep", label: "Akum. Dep.", numeric: true,
                render: (row) => <span className="text-sm text-red-600 dark:text-red-400">({formatCurrency(row.accumulated_dep)})</span> },
              { key: "book_value", label: "Nilai Buku", numeric: true,
                render: (row) => <span className="text-sm font-semibold">{formatCurrency(row.book_value)}</span> },
            ]}
          />
        </CardContent>
      </Card>
      </div>

      {/* Post Depreciation Modal */}
      <Dialog open={postDepOpen} onOpenChange={setPostDepOpen}>
        <DialogContent data-testid="post-dep-dialog">
          <DialogHeader>
            <DialogTitle>Posting Depresiasi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="dep-period-input">Periode <span className="text-destructive">*</span></Label>
              <Input id="dep-period-input" type="month" value={postDepForm.period}
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
              {submitting && <Loader2 className="animate-spin" />}
              Posting Depresiasi
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
              <Label htmlFor="fair-value-input">Nilai Wajar Baru (Rp) <span className="text-destructive">*</span></Label>
              <Input id="fair-value-input" type="number" placeholder="0" value={revalueForm.new_fair_value}
                onChange={e => setRevalueForm(f => ({ ...f, new_fair_value: parseFloat(e.target.value) || 0 }))}
                data-testid="fair-value-input" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="revalue-date-input">Tanggal Revaluasi <span className="text-destructive">*</span></Label>
              <Input id="revalue-date-input" type="date" value={revalueForm.revaluation_date}
                onChange={e => setRevalueForm(f => ({ ...f, revaluation_date: e.target.value }))}
                data-testid="revalue-date-input" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="revalue-notes">Catatan</Label>
              <Textarea id="revalue-notes" value={revalueForm.notes}
                onChange={e => setRevalueForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Alasan revaluasi..." data-testid="revalue-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevalueOpen(false)} data-testid="cancel-revalue">Batal</Button>
            <Button onClick={handleRevalue} disabled={submitting} data-testid="confirm-revalue">
              {submitting && <Loader2 className="animate-spin" />}
              Simpan Revaluasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispose Modal */}
      <Dialog open={disposeOpen} onOpenChange={setDisposeOpen}>
        <DialogContent data-testid="dispose-dialog">
          <DialogHeader>
            <DialogTitle className="text-red-600 dark:text-red-400">Pelepasan Aset</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-md text-sm text-red-700 dark:text-red-300" data-testid="dispose-warning">
              <AlertTriangle className="inline h-4 w-4 mr-1" />
              Aksi ini permanen. Aset akan dikeluarkan dari register dan jurnal disposal akan diposting.
            </div>
            <div className="space-y-2">
              <Label htmlFor="disposal-date-input">Tanggal Pelepasan <span className="text-destructive">*</span></Label>
              <Input id="disposal-date-input" type="date" value={disposeForm.disposal_date}
                onChange={e => setDisposeForm(f => ({ ...f, disposal_date: e.target.value }))}
                data-testid="disposal-date-input" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="disposal-proceeds-input">Hasil Penjualan (Rp)</Label>
              <Input id="disposal-proceeds-input" type="number" placeholder="0 jika tidak ada" value={disposeForm.disposal_proceeds}
                onChange={e => setDisposeForm(f => ({ ...f, disposal_proceeds: parseFloat(e.target.value) || 0 }))}
                data-testid="disposal-proceeds-input" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dispose-notes">Catatan</Label>
              <Textarea id="dispose-notes" value={disposeForm.notes}
                onChange={e => setDisposeForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Alasan pelepasan aset…" data-testid="dispose-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisposeOpen(false)} data-testid="cancel-dispose">Batal</Button>
            <Button variant="destructive" onClick={handleDispose} disabled={submitting} data-testid="confirm-dispose">
              {submitting && <Loader2 className="animate-spin" />}
              Konfirmasi Pelepasan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
