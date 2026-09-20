/**
 * LoyaltyAdminRedemptions — Sprint CRM-C
 * Admin view of ALL redemptions: table, filter, search, status update, export
 */
import { useEffect, useState, useCallback } from "react";
import {
  CheckCircle, Clock, XCircle, Search, Download, RefreshCw, Loader2, ChevronLeft, ChevronRight,
} from "lucide-react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import DataTable from "@/components/shared/DataTable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const PAGE_SIZE = 50;

const STATUS_CONFIG = {
  pending: {
    label: "Menunggu",
    icon: Clock,
    badge: "bg-amber-100 text-amber-700 border-amber-200",
  },
  claimed: {
    label: "Diklaim",
    icon: CheckCircle,
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  expired: {
    label: "Kedaluwarsa",
    icon: XCircle,
    badge: "bg-red-100 text-red-600 border-red-200",
  },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, badge: "bg-gray-100 text-gray-600" };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.badge}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {cfg.label}
    </span>
  );
}

function fmtDate(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

export default function LoyaltyAdminRedemptions() {
  const [data, setData] = useState({ items: [], total: 0, limit: PAGE_SIZE, skip: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [confirmAction, setConfirmAction] = useState(null); // { redemption, newStatus }
  const [statusUpdating, setStatusUpdating] = useState(false);

  const load = useCallback(async (pg = page, sf = statusFilter, sq = search) => {
    setLoading(true);
    try {
      const params = {
        limit: PAGE_SIZE,
        skip: pg * PAGE_SIZE,
      };
      if (sf && sf !== "all") params.status = sf;
      if (sq.trim()) params.search = sq.trim();
      const res = await api.get("/admin/loyalty/redemptions", { params });
      setData(res.data || { items: [], total: 0, limit: PAGE_SIZE, skip: 0 });
    } catch {
      toast.error("Gagal memuat redemptions");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    load();
  }, [load]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(0);
      load(0, statusFilter, search);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function handleStatusChange(val) {
    setStatusFilter(val);
    setPage(0);
    load(0, val, search);
  }

  async function doStatusUpdate() {
    if (!confirmAction) return;
    setStatusUpdating(true);
    try {
      await api.patch(`/admin/loyalty/redemptions/${confirmAction.redemption.id}/status`, {
        status: confirmAction.newStatus,
      });
      toast.success(`Status diubah menjadi ${STATUS_CONFIG[confirmAction.newStatus]?.label || confirmAction.newStatus}`);
      setConfirmAction(null);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal mengubah status");
    } finally {
      setStatusUpdating(false);
    }
  }

  function exportCSV() {
    const items = data.items;
    if (!items.length) { toast.error("Tidak ada data untuk diekspor"); return; }
    const headers = ["ID", "Customer", "Email", "Reward", "Poin Dipakai", "Voucher Code", "Status", "Tanggal", "Kedaluwarsa"];
    const rows = items.map((r) => [
      r.id,
      r.customer_name || "-",
      r.customer_email || "-",
      r.reward_name,
      r.points_used,
      r.voucher_code || "-",
      r.status,
      fmtDate(r.created_at),
      fmtDate(r.expires_at),
    ]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `redemptions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Diekspor ${items.length} baris`);
  }

  const totalPages = Math.ceil((data.total || 0) / PAGE_SIZE);

  return (
    <div className="space-y-4" data-testid="admin-loyalty-redemptions">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-semibold">Redemption History</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Semua redemption reward oleh customer. Total: <strong>{(data.total || 0).toLocaleString()}</strong>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => load()} className="h-8">
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} className="h-8" data-testid="export-csv">
            <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari customer, voucher, reward…"
            className="pl-9 h-9"
            data-testid="redemptions-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[160px] h-9" data-testid="status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="pending">Menunggu</SelectItem>
            <SelectItem value="claimed">Diklaim</SelectItem>
            <SelectItem value="expired">Kedaluwarsa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <DataTable
          columns={[
            { key: "customer_name", label: "Customer", primary: true, sortable: true, render: (item) => (
              <div>
                <div className="font-medium">{item.customer_name || "-"}</div>
                <div className="text-xs text-muted-foreground">{item.customer_email || "-"}</div>
              </div>
            ) },
            { key: "reward_name", label: "Reward", sortable: true, render: (item) => (
              <div className="font-medium line-clamp-1 max-w-[160px]">{item.reward_name}</div>
            ) },
            { key: "points_used", label: "Poin", numeric: true, sortable: true, render: (item) => (item.points_used || 0).toLocaleString() },
            { key: "voucher_code", label: "Voucher Code", render: (item) => (
              item.voucher_code ? (
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{item.voucher_code}</code>
              ) : (
                <span className="text-muted-foreground text-xs">-</span>
              )
            ) },
            { key: "status", label: "Status", align: "center", sortable: true, render: (item) => <StatusBadge status={item.status} /> },
            { key: "created_at", label: "Tanggal", sortable: true, render: (item) => <span className="text-xs text-muted-foreground">{fmtDate(item.created_at)}</span> },
            { key: "expires_at", label: "Kedaluwarsa", hideOnMobile: true, render: (item) => <span className="text-xs text-muted-foreground">{fmtDate(item.expires_at)}</span> },
          ]}
          rows={data.items}
          loading={loading}
          defaultSort={{ key: "created_at", dir: "desc" }}
          empty={<div className="px-4 py-10 text-center text-sm text-muted-foreground" data-testid="redemptions-empty">Tidak ada redemption ditemukan.</div>}
          rowAction={(item) => (
            item.status === "pending" ? (
              <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs px-2 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                  onClick={() => setConfirmAction({ redemption: item, newStatus: "claimed" })}
                  data-testid={`claim-btn-${item.id}`}
                >
                  Klaim
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs px-2 text-red-600 border-red-300 hover:bg-red-50"
                  onClick={() => setConfirmAction({ redemption: item, newStatus: "expired" })}
                  data-testid={`expire-btn-${item.id}`}
                >
                  Expired
                </Button>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Final</span>
            )
          )}
          rowTestIdPrefix="redemption-row"
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="text-xs text-muted-foreground">
              Halaman {page + 1} dari {totalPages} ({data.total} total)
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2"
                onClick={() => { setPage(p => p - 1); load(page - 1, statusFilter, search); }}
                disabled={page === 0}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2"
                onClick={() => { setPage(p => p + 1); load(page + 1, statusFilter, search); }}
                disabled={page >= totalPages - 1}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Confirm Status Change */}
      <AlertDialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <AlertDialogContent data-testid="confirm-status-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.newStatus === "claimed" ? "Konfirmasi Klaim" : "Konfirmasi Expired"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.newStatus === "claimed"
                ? `Tandai redemption "${confirmAction?.redemption?.reward_name}" oleh ${confirmAction?.redemption?.customer_name || "customer"} sebagai sudah diklaim? Tindakan ini tidak bisa diubah.`
                : `Tandai redemption ini sebagai kedaluwarsa?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={statusUpdating}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={doStatusUpdate}
              disabled={statusUpdating}
              className={confirmAction?.newStatus === "claimed" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}
              data-testid="confirm-status-action"
            >
              {statusUpdating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Memproses…</> : "Ya, Lanjutkan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
