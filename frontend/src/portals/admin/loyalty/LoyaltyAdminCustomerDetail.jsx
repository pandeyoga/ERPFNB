import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, TrendingDown, Gift, Save, Plus, Minus } from "lucide-react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const TIER_BADGE = {
  bronze: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  silver: "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100",
  gold: "bg-yellow-100 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-200",
};

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function LoyaltyAdminCustomerDetail() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    full_name: "",
    phone: "",
    date_of_birth: "",
    gender: "",
  });
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    points: 100,
    description: "",
    is_lifetime: true,
    sign: "+",
  });
  const [adjusting, setAdjusting] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const [detRes, txRes, redRes] = await Promise.all([
        api.get(`/admin/loyalty/customers/${customerId}`),
        api.get(`/admin/loyalty/customers/${customerId}/transactions?limit=100`),
        api.get(`/admin/loyalty/customers/${customerId}/redemptions?limit=100`),
      ]);
      setDetail(detRes.data);
      setTransactions(txRes.data || []);
      setRedemptions(redRes.data || []);
      const c = detRes.data?.customer || {};
      setProfileForm({
        full_name: c.full_name || "",
        phone: c.phone || "",
        date_of_birth: c.date_of_birth || "",
        gender: c.gender || "",
      });
    } catch {
      toast.error("Gagal memuat detail customer");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      await api.put(`/admin/loyalty/customers/${customerId}`, profileForm);
      toast.success("Profile customer diupdate");
      loadAll();
    } catch {
      toast.error("Gagal update profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function submitAdjust() {
    if (!adjustForm.description || adjustForm.description.length < 3) {
      toast.error("Deskripsi minimal 3 karakter");
      return;
    }
    const absPoints = Number(adjustForm.points) || 0;
    if (absPoints <= 0) {
      toast.error("Jumlah poin harus > 0");
      return;
    }
    const points = adjustForm.sign === "+" ? absPoints : -absPoints;
    setAdjusting(true);
    try {
      await api.post(`/admin/loyalty/customers/${customerId}/adjust-points`, {
        points,
        description: adjustForm.description,
        is_lifetime: adjustForm.is_lifetime,
      });
      toast.success(
        `${points > 0 ? "Menambahkan" : "Mengurangi"} ${absPoints.toLocaleString()} poin`
      );
      setAdjustOpen(false);
      setAdjustForm({ points: 100, description: "", is_lifetime: true, sign: "+" });
      loadAll();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal adjust poin");
    } finally {
      setAdjusting(false);
    }
  }

  if (loading && !detail) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!detail) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">Customer tidak ditemukan.</p>
          <Button variant="outline" onClick={() => navigate("/admin/loyalty/customers")}>
            Kembali
          </Button>
        </CardContent>
      </Card>
    );
  }

  const c = detail.customer;

  return (
    <div className="space-y-5" data-testid="admin-loyalty-customer-detail">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/admin/loyalty/customers">
          <Button variant="ghost" size="sm" data-testid="customer-detail-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>
        </Link>
        <div className="flex-1">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            {c.full_name}
            <Badge className={`capitalize ${TIER_BADGE[c.loyalty_tier] || ""}`} variant="secondary">
              {c.loyalty_tier}
            </Badge>
            {detail.is_active ? (
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-600">
                Aktif
              </Badge>
            ) : (
              <Badge variant="outline" className="border-red-500/40 text-red-600">
                Nonaktif
              </Badge>
            )}
          </h2>
          <div className="text-sm text-muted-foreground">{c.email}</div>
        </div>
        <Button onClick={() => setAdjustOpen(true)} data-testid="open-adjust-points">
          <Plus className="h-4 w-4 mr-2" />
          Adjust Poin
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" data-testid="customer-stats">
        <Card data-testid="stat-total-points">
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Total Poin</div>
            <div className="text-2xl font-bold tabular-nums mt-1" data-testid="customer-total-points">
              {c.total_points.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-lifetime-points">
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Lifetime Poin</div>
            <div className="text-2xl font-bold tabular-nums mt-1" data-testid="customer-lifetime-points">
              {c.lifetime_points.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-transaction-count">
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Transaksi</div>
            <div className="text-2xl font-bold tabular-nums mt-1" data-testid="customer-tx-count">{detail.transaction_count}</div>
          </CardContent>
        </Card>
        <Card data-testid="stat-redemption-count">
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Redemption</div>
            <div className="text-2xl font-bold tabular-nums mt-1" data-testid="customer-redemption-count">{detail.redemption_count}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile">
        <TabsList data-testid="customer-detail-tabs">
          <TabsTrigger value="profile" data-testid="tab-profile">Profile</TabsTrigger>
          <TabsTrigger value="transactions" data-testid="tab-transactions">Transaksi ({transactions.length})</TabsTrigger>
          <TabsTrigger value="redemptions" data-testid="tab-redemptions">Redemption ({redemptions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <Card data-testid="profile-form-card">
            <CardHeader>
              <CardTitle className="text-base">Informasi Customer</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Nama Lengkap</Label>
                <Input
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                  className="mt-1.5"
                  data-testid="profile-full-name"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={c.email} disabled className="mt-1.5 bg-muted" data-testid="profile-email" />
              </div>
              <div>
                <Label>Nomor Telepon</Label>
                <Input
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  className="mt-1.5"
                  placeholder="+628..."
                  data-testid="profile-phone"
                />
              </div>
              <div>
                <Label>Tanggal Lahir</Label>
                <Input
                  type="date"
                  value={profileForm.date_of_birth || ""}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, date_of_birth: e.target.value })
                  }
                  className="mt-1.5"
                  data-testid="profile-dob"
                />
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button onClick={saveProfile} disabled={savingProfile} data-testid="save-customer-profile">
                  <Save className="h-4 w-4 mr-2" />
                  {savingProfile ? "Menyimpan…" : "Simpan Perubahan"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {transactions.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  Belum ada transaksi.
                </div>
              ) : (
                <ul className="divide-y">
                  {transactions.map((t) => {
                    const pos = t.points > 0;
                    return (
                      <li key={t.id} className="flex items-center justify-between px-4 py-3" data-testid={`tx-${t.id}`}>
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-9 w-9 rounded-full flex items-center justify-center ${pos ? "bg-emerald-500/15 text-emerald-600" : "bg-red-500/15 text-red-600"}`}
                          >
                            {pos ? (
                              <TrendingUp className="h-4 w-4" />
                            ) : (
                              <TrendingDown className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-sm">{t.description}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatDate(t.created_at)} · {t.transaction_type}
                            </div>
                          </div>
                        </div>
                        <div className={`font-semibold tabular-nums ${pos ? "text-emerald-600" : "text-red-600"}`}>
                          {pos ? "+" : ""}
                          {t.points.toLocaleString()}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="redemptions" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {redemptions.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  Belum ada redemption.
                </div>
              ) : (
                <ul className="divide-y">
                  {redemptions.map((r) => (
                    <li key={r.id} className="flex items-center justify-between px-4 py-3" data-testid={`redemption-${r.id}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
                          <Gift className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{r.reward_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(r.created_at)}
                            {r.voucher_code && (
                              <>
                                {" · "}
                                <span className="font-mono">{r.voucher_code}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge variant="secondary" className="capitalize">
                          {r.status}
                        </Badge>
                        <div className="font-semibold text-red-600 tabular-nums">
                          -{r.points_used.toLocaleString()}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Adjust points dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent data-testid="adjust-points-dialog">
          <DialogHeader>
            <DialogTitle>Adjust Poin Customer</DialogTitle>
            <DialogDescription>
              Menambah atau mengurangi poin akan tercatat di audit trail transaksi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={adjustForm.sign === "+" ? "default" : "outline"}
                onClick={() => setAdjustForm({ ...adjustForm, sign: "+" })}
                size="sm"
                className="flex-1"
              >
                <Plus className="h-4 w-4 mr-1" /> Tambah
              </Button>
              <Button
                type="button"
                variant={adjustForm.sign === "-" ? "default" : "outline"}
                onClick={() => setAdjustForm({ ...adjustForm, sign: "-" })}
                size="sm"
                className="flex-1"
              >
                <Minus className="h-4 w-4 mr-1" /> Kurangi
              </Button>
            </div>
            <div>
              <Label>Jumlah Poin</Label>
              <Input
                type="number"
                min={1}
                value={adjustForm.points}
                onChange={(e) => setAdjustForm({ ...adjustForm, points: e.target.value })}
                className="mt-1.5"
                data-testid="adjust-points-amount"
              />
            </div>
            <div>
              <Label>Deskripsi / Alasan</Label>
              <Input
                value={adjustForm.description}
                onChange={(e) => setAdjustForm({ ...adjustForm, description: e.target.value })}
                placeholder="Contoh: Kompensasi promo Lebaran"
                className="mt-1.5"
                data-testid="adjust-points-description"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={adjustForm.is_lifetime}
                onChange={(e) => setAdjustForm({ ...adjustForm, is_lifetime: e.target.checked })}
              />
              <span>
                Update <span className="font-medium">lifetime points</span> (mempengaruhi tier)
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)} disabled={adjusting}>
              Batal
            </Button>
            <Button onClick={submitAdjust} disabled={adjusting} data-testid="submit-adjust-points">
              {adjusting ? "Memproses…" : "Konfirmasi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
