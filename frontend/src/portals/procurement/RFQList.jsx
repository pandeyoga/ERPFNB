/**
 * RFQ List Page — Sprint E
 * Lists all Requests for Quotation with status filters and quick actions.
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FileSearch, Plus, RefreshCw, Search, Filter, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/useDebounce";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DataTable from "@/components/shared/DataTable";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import StatusPill, { statusLabel } from "@/components/shared/StatusPill";
import { toast } from "sonner";
import api from "@/lib/api";
import { formatDateID } from "@/lib/format";

/** Status RFQ (label & warna dari kamus global StatusPill). */
const RFQ_STATUSES = ["draft", "sent", "quotes_received", "accepted", "cancelled"];

export default function RFQList() {
  const navigate = useNavigate();
  const [rfqs, setRfqs] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const debouncedSearch = useDebounce(search.trim(), 350);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { per_page: 30 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter !== "all") params.status = statusFilter;
      const res = await api.get("/rfq", { params });
      if (res.data.success) {
        setRfqs(res.data.data.items || []);
        setMeta(res.data.data.meta || {});
      }
    } catch (err) {
      toast.error("Gagal memuat RFQ");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = () => navigate("/procurement/rfq/new");

  const columns = [
    { key: "rfq_no", label: "No. RFQ", primary: true, sortable: true,
      render: (rfq) => <span className="font-mono text-xs" data-testid={`rfq-no-${rfq.rfq_no}`}>{rfq.rfq_no}</span> },
    { key: "title", label: "Judul", sortable: true,
      render: (rfq) => (<div><p className="font-medium text-sm">{rfq.title}</p><p className="text-xs text-muted-foreground">{rfq.items?.length || 0} item</p></div>) },
    { key: "vendors", label: "Vendor", render: (rfq) => <span className="text-sm">{rfq.vendor_ids?.length || 0} vendor</span> },
    { key: "deadline", label: "Deadline", sortable: true, sortAccessor: (rfq) => rfq.deadline || "",
      render: (rfq) => <span className="text-sm">{rfq.deadline ? formatDateID(rfq.deadline) : "-"}</span> },
    { key: "quotes", label: "Penawaran",
      render: (rfq) => (<><span className="text-sm font-medium">{rfq.quotes?.length || 0}</span><span className="text-xs text-muted-foreground"> / {rfq.vendor_ids?.length || 0}</span></>) },
    { key: "status", label: "Status",
      render: (rfq) => <span data-testid={`rfq-status-${rfq.rfq_no}`}><StatusPill status={rfq.status || "draft"} /></span> },
  ];

  const hasFilter = !!search || statusFilter !== "all";

  return (
    <div className="space-y-3 lg:space-y-4" data-testid="rfq-list-page">
      <PageHeader
        icon={FileSearch}
        title="RFQ"
        subtitle="Request for Quotation — minta penawaran harga dari beberapa vendor sebelum membuat PO."
        actions={
          <Button onClick={handleCreate} data-testid="create-rfq-btn">
            <Plus /> Buat RFQ
          </Button>
        }
      />

      {/* Filters */}
      <div className="glass-card p-3 flex flex-col gap-2 sm:flex-row sm:items-center" data-testid="rfq-filters">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Cari nomor RFQ atau judul…"
            aria-label="Cari RFQ"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="glass-input pl-9"
            data-testid="rfq-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="glass-input sm:w-48" aria-label="Filter status" data-testid="rfq-status-filter">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            {RFQ_STATUSES.map((k) => (
              <SelectItem key={k} value={k}>{statusLabel(k)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={load} aria-label="Muat ulang daftar RFQ" data-testid="rfq-refresh">
          <RefreshCw className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden" data-testid="rfq-table-card">
        <DataTable
          columns={columns}
          rows={rfqs}
          keyField="id"
          loading={loading}
          onRowClick={(rfq) => navigate(`/procurement/rfq/${rfq.id}`)}
          rowTestIdPrefix="rfq-row"
          rowAction={(rfq) => (
            <Button size="sm" variant="ghost" onClick={() => navigate(`/procurement/rfq/${rfq.id}`)} data-testid={`rfq-detail-${rfq.rfq_no}`}>
              <Eye /> Detail
            </Button>
          )}
          empty={
            <div data-testid="rfq-empty">
              {hasFilter ? (
                <EmptyState icon={FileSearch} title="Tidak ada RFQ yang cocok" description="Ubah kata kunci atau filter status." />
              ) : (
                <EmptyState icon={FileSearch} title="Belum ada RFQ"
                  description="Buat RFQ untuk meminta penawaran harga dari beberapa vendor sekaligus."
                  action={<Button onClick={handleCreate} data-testid="rfq-empty-create-btn"><Plus /> Buat RFQ pertama</Button>} />
              )}
            </div>
          }
        />
        {meta.total > 0 && (
          <div className="px-4 py-2.5 border-t border-border/50 text-xs text-muted-foreground" data-testid="rfq-meta">
            Menampilkan {rfqs.length} dari {meta.total} RFQ
          </div>
        )}
      </div>
    </div>
  );
}
