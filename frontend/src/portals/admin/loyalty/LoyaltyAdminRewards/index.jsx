/**
 * LoyaltyAdminRewards — Sprint CRM-C
 * Full admin management: create / edit / activate / deactivate / restock / image upload / search
 */
import { useEffect, useState, useRef } from "react";
import {
  Plus, Edit2, PowerOff, Gift, Power, Search, Image as ImageIcon,
  Package, BarChart2, Sparkles, AlertTriangle, RefreshCw, Upload, X, Loader2,
} from "lucide-react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const CATEGORY_LABELS = {
  voucher: "Voucher",
  merchandise: "Merchandise",
  experience: "Experience",
};

const CATEGORY_COLORS = {
  voucher: "bg-blue-100 text-blue-700 border-blue-200",
  merchandise: "bg-purple-100 text-purple-700 border-purple-200",
  experience: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const EMPTY_FORM = {
  name: "",
  description: "",
  points_required: 100,
  category: "voucher",
  image_url: "",
  stock: "",
  is_active: true,
};

function SummaryCard({ label, value, icon: Icon, accent }) {
  const accentMap = {
    primary: "from-violet-500/10 to-purple-500/10 text-violet-600",
    success: "from-emerald-500/10 to-teal-500/10 text-emerald-600",
    warning: "from-amber-500/10 to-orange-500/10 text-amber-600",
    info: "from-blue-500/10 to-cyan-500/10 text-blue-600",
  };
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
            <div className="mt-1.5 text-2xl font-bold tabular-nums">{value}</div>
          </div>
          <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${accentMap[accent]} flex items-center justify-center`}>
            <Icon className="h-4.5 w-4.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ImageUploadField({ value, onChange }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState("url"); // "url" | "file"

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post("/admin/loyalty/rewards/upload-image", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url = res.data?.url;
      if (url) {
        const backendUrl = process.env.REACT_APP_BACKEND_URL || "";
        onChange(url.startsWith("http") ? url : `${backendUrl}${url}`);
        toast.success("Gambar berhasil diupload");
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal upload gambar");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1 border-b">
        {["url", "file"].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors ${
              tab === t ? "bg-white border border-b-white -mb-px" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "url" ? "URL" : "Upload File"}
          </button>
        ))}
      </div>
      {tab === "url" ? (
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://…"
            className="flex-1"
            data-testid="reward-form-image-url"
          />
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 gap-2 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => fileRef.current?.click()}>
          {uploading ? (
            <><Loader2 className="h-5 w-5 animate-spin" /><span className="text-xs text-muted-foreground">Mengupload…</span></>
          ) : (
            <><Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Klik untuk pilih gambar (max 5MB)</span></>
          )}
          <input type="file" ref={fileRef} className="hidden" accept="image/jpeg,image/png,image/webp" onChange={handleFile} />
        </div>
      )}
      {value && (
        <div className="relative w-24 h-16 rounded-md overflow-hidden border">
          <img src={value} alt="preview" className="w-full h-full object-cover" loading="lazy" decoding="async" onError={(e) => { e.target.style.display="none"; }} />
        </div>
      )}
    </div>
  );
}

export default function LoyaltyAdminRewards() {
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmToggle, setConfirmToggle] = useState(null); // reward to toggle
  const [restocking, setRestocking] = useState(null); // reward to restock
  const [restockAmount, setRestockAmount] = useState(10);
  const [restockSaving, setRestockSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (category !== "all") params.category = category;
      if (!showInactive) params.is_active = true;
      if (search.trim()) params.search = search.trim();
      const res = await api.get("/admin/loyalty/rewards", { params });
      setRewards(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error("Gagal memuat rewards");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, showInactive]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => load(), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditing({});
  }

  function openEdit(reward) {
    setForm({
      name: reward.name || "",
      description: reward.description || "",
      points_required: reward.points_required || 0,
      category: reward.category || "voucher",
      image_url: reward.image_url || "",
      stock: reward.stock === null || reward.stock === undefined ? "" : String(reward.stock),
      is_active: reward.is_active,
    });
    setEditing(reward);
  }

  async function saveReward() {
    if (!form.name || !form.description) {
      toast.error("Nama & deskripsi wajib diisi");
      return;
    }
    const payload = {
      name: form.name,
      description: form.description,
      points_required: Number(form.points_required) || 0,
      category: form.category,
      image_url: form.image_url || null,
      stock: form.stock === "" ? null : Number(form.stock),
      is_active: !!form.is_active,
    };
    setSaving(true);
    try {
      if (editing && editing.id) {
        await api.put(`/admin/loyalty/rewards/${editing.id}`, payload);
        toast.success("Reward diupdate");
      } else {
        await api.post("/admin/loyalty/rewards", payload);
        toast.success("Reward dibuat");
      }
      setEditing(null);
      setForm(EMPTY_FORM);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal menyimpan reward");
    } finally {
      setSaving(false);
    }
  }

  async function doToggle() {
    const reward = confirmToggle;
    setConfirmToggle(null);
    try {
      if (reward.is_active) {
        await api.delete(`/admin/loyalty/rewards/${reward.id}`);
        toast.success("Reward dinonaktifkan");
      } else {
        await api.put(`/admin/loyalty/rewards/${reward.id}`, { is_active: true });
        toast.success("Reward diaktifkan");
      }
      load();
    } catch {
      toast.error("Gagal mengubah status reward");
    }
  }

  async function doRestock() {
    setRestockSaving(true);
    try {
      await api.post(`/admin/loyalty/rewards/${restocking.id}/restock`, { add_stock: Number(restockAmount) });
      toast.success(`Stok +${restockAmount} berhasil ditambahkan`);
      setRestocking(null);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal restock");
    } finally {
      setRestockSaving(false);
    }
  }

  // Summary stats
  const totalRewards = rewards.length + (showInactive ? 0 : 0); // based on current filter
  const activeCount = rewards.filter((r) => r.is_active).length;
  const totalRedeemed = rewards.reduce((s, r) => s + (r.redemption_count || 0), 0);
  const lowStockCount = rewards.filter((r) => r.stock !== null && r.stock !== undefined && r.stock <= 5).length;

  return (
    <div className="space-y-5" data-testid="admin-loyalty-rewards">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="Total Rewards" value={totalRewards} icon={Gift} accent="primary" />
        <SummaryCard label="Aktif" value={activeCount} icon={Sparkles} accent="success" />
        <SummaryCard label="Total Diredeem" value={totalRedeemed.toLocaleString()} icon={BarChart2} accent="info" />
        <SummaryCard label="Stok Rendah" value={lowStockCount} icon={AlertTriangle} accent="warning" />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari reward…"
            className="pl-9 h-9"
            data-testid="rewards-search"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[160px] h-9" data-testid="category-filter">
            <SelectValue placeholder="Kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kategori</SelectItem>
            <SelectItem value="voucher">Voucher</SelectItem>
            <SelectItem value="merchandise">Merchandise</SelectItem>
            <SelectItem value="experience">Experience</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            data-testid="show-inactive"
          />
          Tampilkan nonaktif
        </label>
        <Button variant="outline" size="sm" onClick={load} className="h-9" data-testid="rewards-refresh">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
        <Button onClick={openCreate} data-testid="rewards-new" className="h-9">
          <Plus className="h-4 w-4 mr-2" /> Reward Baru
        </Button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64" />)}
        </div>
      ) : rewards.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Belum ada reward. Klik tombol <span className="font-medium">Reward Baru</span> untuk membuat.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rewards.map((r) => (
            <RewardCard
              key={r.id}
              reward={r}
              onEdit={() => openEdit(r)}
              onToggle={() => setConfirmToggle(r)}
              onRestock={() => { setRestocking(r); setRestockAmount(10); }}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg" data-testid="reward-dialog">
          <DialogHeader>
            <DialogTitle>{editing && editing.id ? "Edit Reward" : "Reward Baru"}</DialogTitle>
            <DialogDescription>
              Reward aktif akan langsung tampil di katalog customer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div>
              <Label>Nama Reward *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1.5"
                data-testid="reward-form-name"
              />
            </div>
            <div>
              <Label>Deskripsi *</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="mt-1.5"
                data-testid="reward-form-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Poin Dibutuhkan</Label>
                <Input
                  type="number" min={1}
                  value={form.points_required}
                  onChange={(e) => setForm({ ...form, points_required: e.target.value })}
                  className="mt-1.5"
                  data-testid="reward-form-points"
                />
              </div>
              <div>
                <Label>Kategori</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="mt-1.5" data-testid="reward-form-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="voucher">Voucher</SelectItem>
                    <SelectItem value="merchandise">Merchandise</SelectItem>
                    <SelectItem value="experience">Experience</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Stok (kosongkan = unlimited)</Label>
              <Input
                type="number" min={0}
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                className="mt-1.5"
                placeholder="unlimited"
                data-testid="reward-form-stock"
              />
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <ImageIcon className="h-3.5 w-3.5" /> Gambar Reward
              </Label>
              <div className="mt-1.5">
                <ImageUploadField
                  value={form.image_url}
                  onChange={(url) => setForm({ ...form, image_url: url })}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                data-testid="reward-form-active"
              />
              Aktif (tampil di katalog)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Batal
            </Button>
            <Button onClick={saveReward} disabled={saving} data-testid="save-reward">
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menyimpan…</> : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Toggle Dialog */}
      <AlertDialog open={!!confirmToggle} onOpenChange={(o) => !o && setConfirmToggle(null)}>
        <AlertDialogContent data-testid="confirm-toggle-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmToggle?.is_active ? "Nonaktifkan Reward?" : "Aktifkan Reward?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmToggle?.is_active
                ? `"${confirmToggle?.name}" akan disembunyikan dari katalog customer.`
                : `"${confirmToggle?.name}" akan kembali tampil di katalog customer.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={doToggle}
              className={confirmToggle?.is_active ? "bg-red-600 hover:bg-red-700" : ""}
              data-testid="confirm-toggle-action"
            >
              {confirmToggle?.is_active ? "Nonaktifkan" : "Aktifkan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restock Dialog */}
      <Dialog open={!!restocking} onOpenChange={(o) => !o && setRestocking(null)}>
        <DialogContent className="max-w-sm" data-testid="restock-dialog">
          <DialogHeader>
            <DialogTitle>Tambah Stok</DialogTitle>
            <DialogDescription>
              {restocking?.name} — Stok saat ini:{" "}
              <strong>{restocking?.stock === null || restocking?.stock === undefined ? "Unlimited" : restocking?.stock}</strong>
            </DialogDescription>
          </DialogHeader>
          {restocking?.stock === null || restocking?.stock === undefined ? (
            <p className="text-sm text-amber-600">
              Reward ini memiliki stok unlimited. Atur batas stok terlebih dahulu melalui Edit.
            </p>
          ) : (
            <div>
              <Label>Jumlah Penambahan Stok</Label>
              <Input
                type="number" min={1}
                value={restockAmount}
                onChange={(e) => setRestockAmount(e.target.value)}
                className="mt-1.5"
                data-testid="restock-amount"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestocking(null)}>
              Batal
            </Button>
            {restocking?.stock !== null && restocking?.stock !== undefined && (
              <Button
                onClick={doRestock}
                disabled={restockSaving}
                data-testid="confirm-restock"
              >
                {restockSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menyimpan…</> : "Tambah Stok"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RewardCard({ reward: r, onEdit, onToggle, onRestock }) {
  const backendUrl = process.env.REACT_APP_BACKEND_URL || "";
  const imgSrc = r.image_url
    ? (r.image_url.startsWith("/") ? `${backendUrl}${r.image_url}` : r.image_url)
    : null;

  return (
    <Card
      className={`flex flex-col overflow-hidden transition-opacity ${r.is_active ? "" : "opacity-60"}`}
      data-testid={`reward-card-${r.id}`}
    >
      {/* Image or placeholder */}
      <div className="h-36 bg-gradient-to-br from-amber-500/10 to-orange-500/10 flex items-center justify-center overflow-hidden">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={r.name}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.parentElement.querySelector(".fallback-icon").style.display = "flex"; }}
          />
        ) : null}
        <div className="fallback-icon w-full h-full items-center justify-center" style={{ display: imgSrc ? "none" : "flex" }}>
          <Gift className="h-10 w-10 text-amber-400/50" />
        </div>
      </div>

      <CardContent className="p-4 flex flex-col gap-2.5 flex-1">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm leading-tight line-clamp-2">{r.name}</div>
            <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{r.description}</div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge variant="outline" className={`capitalize text-xs ${CATEGORY_COLORS[r.category]}`}>
              {CATEGORY_LABELS[r.category] || r.category}
            </Badge>
            {!r.is_active && (
              <Badge variant="outline" className="border-red-300 text-red-600 text-xs">Nonaktif</Badge>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 pt-1 border-t">
          <div>
            <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Poin</div>
            <div className="font-bold tabular-nums">{r.points_required.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Stok</div>
            <div className={`font-medium ${
              r.stock !== null && r.stock !== undefined && r.stock <= 5 ? "text-red-600" : ""
            }`}>
              {r.stock === null || r.stock === undefined ? "∞" : r.stock}
              {r.stock !== null && r.stock !== undefined && r.stock <= 5 && (
                <AlertTriangle className="inline h-3 w-3 ml-1 text-red-500" />
              )}
            </div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Redeemed</div>
            <div className="font-medium">{(r.redemption_count || 0).toLocaleString()}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-1.5 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-xs"
            onClick={onEdit}
            data-testid={`edit-reward-${r.id}`}
          >
            <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
          </Button>
          {r.stock !== null && r.stock !== undefined && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs px-2"
              onClick={onRestock}
              title="Tambah stok"
              data-testid={`restock-reward-${r.id}`}
            >
              <Package className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2"
            onClick={onToggle}
            title={r.is_active ? "Nonaktifkan" : "Aktifkan"}
            data-testid={`toggle-reward-${r.id}`}
          >
            {r.is_active ? (
              <PowerOff className="h-3.5 w-3.5 text-red-500" />
            ) : (
              <Power className="h-3.5 w-3.5 text-emerald-500" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
