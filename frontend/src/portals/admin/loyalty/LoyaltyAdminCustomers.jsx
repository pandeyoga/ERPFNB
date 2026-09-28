import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ChevronRight, UserX, UserCheck } from "lucide-react";
import api from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DataTable from "@/components/shared/DataTable";
import { toast } from "sonner";

const TIER_BADGE = {
  bronze: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  silver: "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100",
  gold: "bg-yellow-100 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-200",
};

export default function LoyaltyAdminCustomers() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState("all");
  const [status, setStatus] = useState("all"); // all | active | inactive
  const [page, setPage] = useState(1);
  const limit = 20;

  async function load() {
    setLoading(true);
    try {
      const params = {
        limit,
        skip: (page - 1) * limit,
      };
      if (search) params.search = search;
      if (tier && tier !== "all") params.tier = tier;
      if (status !== "all") params.is_active = status === "active";
      const res = await api.get("/admin/loyalty/customers", { params });
      setItems(res.data?.items || []);
      setTotal(res.data?.total || 0);
    } catch {
      toast.error("Gagal memuat customer");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, status, page]);

  useEffect(() => {
    const id = setTimeout(() => {
      setPage(1);
      load();
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function toggleActive(customer) {
    const action = customer.is_active ? "disable" : "enable";
    try {
      await api.post(`/admin/loyalty/customers/${customer.id}/${action}`);
      toast.success(
        customer.is_active ? "Customer dinonaktifkan" : "Customer diaktifkan"
      );
      load();
    } catch {
      toast.error("Gagal mengubah status customer");
    }
  }

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total]);

  return (
    <div className="space-y-4" data-testid="admin-loyalty-customers">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari nama, email, atau telepon…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
            data-testid="loyalty-customers-search"
          />
        </div>
        <Select value={tier} onValueChange={setTier}>
          <SelectTrigger className="w-[140px] h-10" data-testid="tier-filter">
            <SelectValue placeholder="Tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Tier</SelectItem>
            <SelectItem value="bronze">Bronze</SelectItem>
            <SelectItem value="silver">Silver</SelectItem>
            <SelectItem value="gold">Gold</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[140px] h-10" data-testid="status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="active">Aktif</SelectItem>
            <SelectItem value="inactive">Nonaktif</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={[
              { key: "full_name", label: "Customer", primary: true, sortable: true, render: (c) => (<div><div className="font-medium">{c.full_name}</div><div className="text-xs text-muted-foreground">{c.email}</div></div>) },
              { key: "phone", label: "Phone", hideOnMobile: true, render: (c) => <span className="text-muted-foreground">{c.phone || "—"}</span> },
              { key: "loyalty_tier", label: "Tier", sortable: true, render: (c) => <Badge className={`capitalize ${TIER_BADGE[c.loyalty_tier] || ""}`} variant="secondary">{c.loyalty_tier}</Badge> },
              { key: "total_points", label: "Points", numeric: true, sortable: true, render: (c) => <span className="font-semibold">{c.total_points.toLocaleString()}</span> },
              { key: "lifetime_points", label: "Lifetime", numeric: true, sortable: true, hideOnMobile: true, render: (c) => <span className="text-muted-foreground">{c.lifetime_points.toLocaleString()}</span> },
              { key: "is_active", label: "Status", align: "center", sortable: true, render: (c) => c.is_active ? <Badge variant="outline" className="border-emerald-500/40 text-emerald-600">Aktif</Badge> : <Badge variant="outline" className="border-red-500/40 text-red-600">Nonaktif</Badge> },
            ]}
            rows={items}
            loading={loading}
            empty={<div className="p-10 text-center text-sm text-muted-foreground" data-testid="customers-empty">Tidak ada customer ditemukan.</div>}
            rowAction={(c) => (
              <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                <Button size="sm" variant="ghost" onClick={() => toggleActive(c)} title={c.is_active ? "Nonaktifkan" : "Aktifkan"} data-testid={`toggle-active-${c.id}`}>
                  {c.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                </Button>
                <Link to={`/admin/loyalty/customers/${c.id}`}>
                  <Button size="sm" variant="ghost" data-testid={`view-customer-${c.id}`}>Detail <ChevronRight className="h-4 w-4 ml-1" /></Button>
                </Link>
              </div>
            )}
            rowTestIdPrefix="customer-row"
          />
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm" data-testid="customers-pagination">
          <div className="text-muted-foreground" data-testid="customers-pagination-info">
            Menampilkan {(page - 1) * limit + 1}-{Math.min(page * limit, total)} dari {total}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              data-testid="customers-prev-page"
            >
              Sebelumnya
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              data-testid="customers-next-page"
            >
              Berikutnya
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
